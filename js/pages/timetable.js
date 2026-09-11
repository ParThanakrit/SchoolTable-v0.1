/* หน้า P11 — ตารางสอน (ดู 3 มุมมอง และลากปรับ) */
(function (global) {
  'use strict';
  var U = global.ST.util, M = global.ST.model, UI = global.ST.ui, SCH = global.ST.scheduler;
  global.ST.pages = global.ST.pages || {};

  var view = { mode: 'section', targetId: '', timetableId: '', size: 'normal', focus: false };
  var drag = null;
  var kbd = null;                              /* สถานะการย้ายคาบด้วยคีย์บอร์ด */
  var editHistory = { ttId: '', past: [], future: [] };

  /* ---------- ประวัติแก้ไข (Undo/Redo) ---------- */
  function histReset(tt) {
    if (editHistory.ttId !== tt.id) editHistory = { ttId: tt.id, past: [], future: [] };
  }
  function histSnapshot(tt) {                  /* เรียกก่อนแก้ไขทุกครั้ง */
    editHistory.past.push(U.deepClone(tt.entries));
    if (editHistory.past.length > 60) editHistory.past.shift();
    editHistory.future = [];
  }
  function histUndo(tt) {
    if (!editHistory.past.length) return false;
    editHistory.future.push(U.deepClone(tt.entries));
    tt.entries = editHistory.past.pop();
    return true;
  }
  function histRedo(tt) {
    if (!editHistory.future.length) return false;
    editHistory.past.push(U.deepClone(tt.entries));
    tt.entries = editHistory.future.pop();
    return true;
  }

  function ensureTargets(st) {
    var list = targetList(st);
    if (!list.some(function (x) { return x.id === view.targetId; })) {
      view.targetId = list.length ? list[0].id : '';
    }
  }

  function targetList(st) {
    if (view.mode === 'teacher') return U.sortThai(st.teachers, function (t) { return t.name; });
    if (view.mode === 'room') return U.sortThai(st.rooms, function (r) { return r.name; });
    return U.sortThai(st.classSections, function (s) { return s.name; });
  }

  /* คาบที่ต้องแสดงในมุมมองปัจจุบัน */
  function entriesFor(st, tt, targetId) {
    var assignmentById = U.indexById(st.assignments);
    return tt.entries.filter(function (e) {
      var a = assignmentById[e.assignmentId];
      if (!a) return false;
      if (view.mode === 'section') return a.classSectionId === targetId;
      if (view.mode === 'teacher') return a.teacherId === targetId || a.coTeacherId === targetId;
      return e.roomId === targetId;
    });
  }

  function locksFor(st, targetId) {
    return st.lockedSlots.filter(function (l) {
      if (view.mode === 'section') {
        var sec = U.byId(st.classSections, targetId);
        return sec && M.lockAppliesToSection(st, l, sec);
      }
      if (view.mode === 'teacher') {
        return (l.scope === 'TEACHER' && l.targetId === targetId) || l.teacherId === targetId;
      }
      return l.roomId === targetId;
    });
  }

  global.ST.pages.timetable = {
    render: function (root) {
      var app = global.ST.app;
      var st = app.state();
      if (st.activeTimetableId) view.timetableId = st.activeTimetableId;
      document.body.classList.toggle('tt-focus', view.focus);
      root.classList.add('tt-view-' + view.size);
      var timetables = st.timetables.slice().sort(function (a, b) {
        return new Date(b.generatedAt || b.createdAt || 0) - new Date(a.generatedAt || a.createdAt || 0);
      });

      UI.pageHeader(root, {
        title: 'ตารางสอน',
        desc: 'ดูตารางได้ 3 มุมมอง และลากคาบไปวางเพื่อปรับเอง ระบบจะตรวจการชนให้ทันที',
        actions: [
          { label: '❓ ช่วยเหลือ', onClick: function () { global.ST.help.show('timetable'); } },
          { label: '🖨 พิมพ์ตาราง', onClick: function () { app.go('print'); } },
          { label: 'จัดตารางใหม่', onClick: function () { app.go('generate'); } }
        ]
      });

      if (!timetables.length) {
        root.appendChild(UI.emptyState({
          icon: '📅', title: 'ยังไม่ได้จัดตารางสอนของภาคเรียนนี้',
          desc: 'กดจัดตารางอัตโนมัติเพื่อให้ระบบจัดตารางทั้งโรงเรียนให้ก่อน',
          actions: [{ label: 'จัดตารางอัตโนมัติ', onClick: function () { app.go('generate'); } }]
        }));
        return;
      }

      if (!U.byId(st.timetables, view.timetableId)) {
        view.timetableId = st.activeTimetableId || timetables[0].id;
      }
      var tt = U.byId(st.timetables, view.timetableId) || timetables[0];
      var editable = tt.status === 'DRAFT';
      histReset(tt);
      var headerActions = root.querySelector('.page-header__actions');
      if (editable) {
        var publish = U.elFromHTML('<button type="button" class="btn btn--primary" id="ttPublish">ประกาศใช้ตาราง</button>');
        publish.addEventListener('click', function () { global.ST.ux.publishTimetable(st, tt); });
        headerActions.appendChild(publish);
      }
      ensureTargets(st);

      /* คำนวณคาบที่ยังขาดจากจำนวนคาบตามการมอบหมาย เทียบกับคาบที่อยู่ในตารางจริง */
      function pendingAssignments() {
        var placedByAssignment = {};
        tt.entries.forEach(function (e) {
          placedByAssignment[e.assignmentId] = (placedByAssignment[e.assignmentId] || 0) + 1;
        });
        return st.assignments.map(function (a) {
          var remaining = Math.max(0, U.num(a.periodsPerWeek) - (placedByAssignment[a.id] || 0));
          return {
            assignment: a,
            remaining: remaining,
            subject: U.byId(st.subjects, a.subjectId),
            section: U.byId(st.classSections, a.classSectionId),
            teacher: U.byId(st.teachers, a.teacherId)
          };
        }).filter(function (item) {
          return item.remaining > 0 && item.assignment.teacherId && item.subject && item.section;
        });
      }

      function pendingForCurrentView() {
        return pendingAssignments().filter(function (item) {
          var a = item.assignment;
          if (view.mode === 'section') return a.classSectionId === view.targetId;
          if (view.mode === 'teacher') return a.teacherId === view.targetId || a.coTeacherId === view.targetId;
          return true; /* มุมมองห้อง: เลือกจากคาบค้างทั้งโรงเรียน แล้วตรวจว่าห้องนี้รองรับหรือไม่ตอนวาง */
        });
      }

      /* ---------- แถบควบคุม ---------- */
      var targetLabel = view.mode === 'teacher' ? 'เลือกครู' : view.mode === 'room' ? 'เลือกห้องสถานที่' : 'เลือกชั้นเรียน';
      var controls = U.elFromHTML('<div class="card no-print timetable-control-card"><div class="tt-control-grid">' +
        '<div class="tt-control-group tt-control-group--view"><span class="tt-control-label">1 · ดูตารางตาม</span>' +
        '<div class="view-switch" id="ttSwitch">' +
        '<button type="button" data-mode="section"' + (view.mode === 'section' ? ' class="is-active"' : '') + '><span aria-hidden="true">🏫</span> ชั้นเรียน</button>' +
        '<button type="button" data-mode="teacher"' + (view.mode === 'teacher' ? ' class="is-active"' : '') + '><span aria-hidden="true">👩‍🏫</span> ครู</button>' +
        '<button type="button" data-mode="room"' + (view.mode === 'room' ? ' class="is-active"' : '') + '><span aria-hidden="true">🚪</span> ห้อง</button>' +
        '</div></div>' +
        '<label class="tt-control-group"><span class="tt-control-label">2 · ' + targetLabel + '</span>' +
        '<select class="select" id="ttTarget" aria-label="ชั้นเรียน ครู หรือห้องที่ต้องการดู"></select></label>' +
        '<label class="tt-control-group tt-control-group--version"><span class="tt-control-label">3 · ฉบับตาราง</span>' +
        '<select class="select" id="ttPick" aria-label="ฉบับตารางที่ต้องการดู">' + timetables.map(function (t) {
          return '<option value="' + t.id + '"' + (t.id === tt.id ? ' selected' : '') + '>' +
            U.esc(t.name) + ' — ' + M.statusLabel(t.status) + ' (ภาคเรียนที่ ' + t.semester + '/' + t.academicYear + ')</option>';
        }).join('') + '</select></label>' +
        '</div><div id="ttNotice" class="tt-notice"></div></div>');
      root.appendChild(controls);
      var displayTools = U.elFromHTML('<div class="tt-display-tools"><span class="tt-control-label">การแสดงผล</span><label class="tt-size-control" for="ttSize"><span>ขนาด</span><select class="select" id="ttSize"><option value="compact">กระชับ</option><option value="normal">ปกติ</option><option value="large">ตัวอักษรใหญ่</option></select></label><button type="button" class="btn btn--sm" id="ttFocus" aria-pressed="' + view.focus + '">⛶ ' + (view.focus ? 'ออกจากเต็มพื้นที่' : 'เต็มพื้นที่') + '</button><span class="tt-keyboard-hint">คลิกคาบเพื่อดูรายละเอียด <kbd>F2</kbd> รายละเอียด <kbd>Enter</kbd> ย้ายคาบ</span></div>');
      controls.appendChild(displayTools);
      displayTools.querySelector('#ttSize').value = view.size;
      displayTools.querySelector('#ttSize').addEventListener('change', function (ev) { root.classList.remove('tt-view-' + view.size); view.size = ev.target.value; root.classList.add('tt-view-' + view.size); });
      displayTools.querySelector('#ttFocus').addEventListener('click', function (ev) { view.focus = !view.focus; document.body.classList.toggle('tt-focus', view.focus); ev.currentTarget.textContent = '⛶ ' + (view.focus ? 'ออกจากเต็มพื้นที่' : 'เต็มพื้นที่'); ev.currentTarget.setAttribute('aria-pressed', String(view.focus)); });

      var targetSelect = controls.querySelector('#ttTarget');
      targetSelect.innerHTML = targetList(st).map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === view.targetId ? ' selected' : '') + '>' + U.esc(x.name) + '</option>';
      }).join('');
      targetSelect.addEventListener('change', function (ev) { view.targetId = ev.target.value; app.refresh(); });
      controls.querySelector('#ttPick').addEventListener('change', function (ev) {
        view.timetableId = ev.target.value;
        st.activeTimetableId = ev.target.value;
        global.ST.store.save();
        app.refresh();
      });
      U.on(controls.querySelector('#ttSwitch'), 'click', 'button', function (ev, btn) {
        view.mode = btn.dataset.mode;
        view.targetId = '';
        app.refresh();
      });

      var notice = controls.querySelector('#ttNotice');
      notice.innerHTML = '<div class="flex gap-8 items-center flex-wrap mt-8">' +
        UI.statusBadge(tt.status) + ' <b>' + U.esc(tt.name) + '</b>' +
        '<span class="small muted">' + (tt.generatedAt ? 'จัดเมื่อ ' + U.thaiDateTime(tt.generatedAt) : '') + '</span>' +
        (editable ? '<span class="badge badge--info">แก้ไขได้ · ลากคาบเพื่อย้าย</span>'
          : '<span class="badge badge--muted">แก้ไขไม่ได้ ต้องสร้างร่างใหม่ก่อน</span>') +
        '</div>';
      if (!editable) {
        var mk = U.elFromHTML('<button type="button" class="btn btn--sm mt-8">สร้างร่างใหม่จากตารางนี้</button>');
        mk.addEventListener('click', function () { global.ST.pages.history.createDraftFrom(tt.id); });
        notice.appendChild(mk);
      } else {
        var soft = (tt.stats && tt.stats.softViolations) || 0;
        var toolbar = U.elFromHTML('<div class="flex gap-8 items-center flex-wrap mt-8" role="toolbar" aria-label="เครื่องมือแก้ไขตาราง">' +
          '<button type="button" class="btn btn--sm" id="btnUndo" title="ย้อนกลับ (Ctrl+Z)"' +
          (editHistory.past.length ? '' : ' disabled') + '>↶ ย้อนกลับ</button>' +
          '<button type="button" class="btn btn--sm" id="btnRedo" title="ทำซ้ำ (Ctrl+Y)"' +
          (editHistory.future.length ? '' : ' disabled') + '>↷ ทำซ้ำ</button>' +
          (soft > 0 ? '<button type="button" class="btn btn--sm" id="btnTune" title="ย้ายคาบอัตโนมัติเพื่อลดข้อเสนอปรับตาราง">✨ ปรับให้ดีขึ้น (' + U.fmtNum(soft) + ')</button>' : '') +
          '</div>');
        notice.appendChild(toolbar);
        toolbar.querySelector('#btnUndo').addEventListener('click', function () { doUndo(); });
        toolbar.querySelector('#btnRedo').addEventListener('click', function () { doRedo(); });
        var tuneBtn = toolbar.querySelector('#btnTune');
        if (tuneBtn) tuneBtn.addEventListener('click', function () { runOptimize(tuneBtn); });
      }

      if (!view.targetId) {
        root.appendChild(UI.emptyState({
          icon: '📋', title: 'ยังไม่มีรายการให้เลือกดู',
          desc: 'ต้องมีชั้นเรียน ครู หรือห้องสถานที่ในระบบก่อน',
          actions: [{ label: 'ไปหน้าชั้นเรียน', onClick: function () { app.go('sections'); } }]
        }));
        return;
      }

      /* ---------- ตารางสัปดาห์ ---------- */
      var gridCard = U.elFromHTML('<div class="card"><div id="gridHost"></div></div>');
      root.appendChild(gridCard);
      renderGrid(gridCard.querySelector('#gridHost'));

      /* ---------- ถาดคาบที่ยังไม่ได้จัด ---------- */
      var pendingPool = renderPendingPool();
      if (pendingPool) root.appendChild(pendingPool);

      /* ---------- คำอธิบายสัญลักษณ์ ---------- */
      root.appendChild(U.elFromHTML('<div class="card small">' +
        '<b>คำอธิบายสัญลักษณ์</b> · ' +
        '<span class="tt-flag tt-flag--pair">คาบคู่</span> คาบคู่ที่ต้องย้ายไปพร้อมกัน · ' +
        '<span class="tt-flag tt-flag--lock">ล็อก</span> คาบที่ล็อกไว้ ย้ายไม่ได้ · ' +
        '<span class="tt-flag tt-flag--manual">ปรับเอง</span> คาบที่ลากปรับเอง · ' +
        '<span class="tt-flag tt-flag--soft">เตือน</span> คาบที่ไม่ตรงเงื่อนไขที่ต้องการ</div>'));

      function renderGrid(host) {
        var days = st.periodConfig.days;
        var periodNos = M.allPeriodNos(st);   /* แต่ละวันมีจำนวนคาบไม่เท่ากันได้ */
        var entries = entriesFor(st, tt, view.targetId);
        var locks = locksFor(st, view.targetId);
        var assignmentById = U.indexById(st.assignments);
        var subjectById = U.indexById(st.subjects);
        var groupById = U.indexById(st.subjectGroups);
        var roomById = U.indexById(st.rooms);
        var teacherById = U.indexById(st.teachers);
        var sectionById = U.indexById(st.classSections);
        var softByEntry = {};
        tt.issues.forEach(function (i) {
          if (i.type === 'SOFT_VIOLATION' && i.entryId) softByEntry[i.entryId] = i;
        });

        var byKey = {};
        entries.forEach(function (e) { byKey[e.day + '#' + e.periodNo] = e; });
        var lockByKey = {};
        locks.forEach(function (l) { lockByKey[l.day + '#' + l.periodNo] = l; });

        var html = '<div class="tt-scroll"><table class="timetable" role="grid" aria-label="ตารางสอนรายสัปดาห์ แถวคือวัน คอลัมน์คือคาบ"><thead><tr><th class="tt-daycol">วัน \\ คาบ</th>';
        periodNos.forEach(function (no) {
          var sample = null;
          for (var i = 0; i < days.length && !sample; i++) sample = M.periodByNo(st, days[i], no);
          html += '<th><div class="tt-periodhead">คาบ ' + no +
            '<span class="tt-periodhead__time">' +
            (sample ? U.esc(sample.startTime) + '–' + U.esc(sample.endTime) : '') + '</span></div></th>';
        });
        html += '</tr></thead><tbody>';
        days.forEach(function (d) {
          html += '<tr><th class="tt-daycol">' + U.DAY_NAMES[d] + '</th>';
          periodNos.forEach(function (no) {
            var p = M.periodByNo(st, d, no);
            if (!p) {
              html += '<td class="tt-cell--none"><div class="tt-breaklabel">ไม่มีคาบ</div></td>';
              return;
            }
            if (p.isBreak) {
              html += '<td class="tt-cell--break"><div class="tt-breaklabel">' + U.esc(p.label || 'พัก') + '</div></td>';
              return;
            }
            var k = d + '#' + p.no;
            var e = byKey[k];
            var lock = lockByKey[k];
            html += '<td><div class="tt-cell" data-day="' + d + '" data-period="' + p.no + '">';
            if (lock && !e) {
              html += '<div class="tt-lock"><div class="tt-lock__title">🔒 ' + U.esc(lock.label) + '</div>' +
                '<div>' + U.esc(lock.reason || 'คาบล็อกตายตัว') + '</div></div>';
            } else if (e) {
              var a = assignmentById[e.assignmentId];
              var subject = a ? subjectById[a.subjectId] : null;
              var room = roomById[e.roomId];
              var teacher = a ? teacherById[a.teacherId] : null;
              var co = a && a.coTeacherId ? teacherById[a.coTeacherId] : null;
              var section = a ? sectionById[a.classSectionId] : null;
              var line2 = view.mode === 'section'
                ? (teacher ? teacher.name : '-') + (co ? ' / ' + co.name : '')
                : (section ? section.name : '-');
              var line3 = view.mode === 'room'
                ? (teacher ? teacher.name : '-')
                : 'ห้อง ' + (room ? room.name : '-');
              var flags = '';
              if (e.pairGroupId) flags += '<span class="tt-flag tt-flag--pair">คาบคู่</span>';
              if (e.isLocked) flags += '<span class="tt-flag tt-flag--lock">ล็อก</span>';
              if (e.isManual) flags += '<span class="tt-flag tt-flag--manual">ปรับเอง</span>';
              if (softByEntry[e.id]) flags += '<span class="tt-flag tt-flag--soft">เตือน</span>';
              var canMove = editable && !e.isLocked;
              var ariaLabel = (subject ? subject.name : '') + ' ' + line2 + ' ' + line3 +
                ' วัน' + U.DAY_NAMES[d] + ' คาบ ' + p.no +
                (canMove ? ' กด Enter เพื่อย้ายด้วยแป้นลูกศร' : '');
              var subGroup = subject ? groupById[subject.subjectGroupId] : null;
              var subColor = subGroup && subGroup.color ? subGroup.color : '#4f46e5';
              html += '<div class="tt-entry" data-entry="' + e.id + '"' +
                ' tabindex="0" role="button"' + (canMove ? ' draggable="true"' : '') +
                ' aria-label="' + U.esc(ariaLabel) + '"' +
                ' style="--subject-color:' + U.esc(subColor) + ';border-left-color:' + U.esc(subColor) + '"' +
                ' title="' + U.esc((subject ? subject.name : '') + ' · ' + line2 + ' · ' + line3) + '">' +
                '<div class="tt-entry__subject">' + U.esc(subject ? (subject.shortName && !/[.…]/.test(subject.shortName) ? subject.shortName : subject.name) : '-') + '</div>' +
                '<div class="tt-entry__meta">' + U.esc(line2) + '</div>' +
                '<div class="tt-entry__meta">' + U.esc(line3) + '</div>' +
                (flags ? '<div class="tt-entry__flags">' + flags + '</div>' : '') +
                '</div>';
            }
            html += '</div></td>';
          });
          html += '</tr>';
        });
        html += '</tbody></table></div>';
        host.innerHTML = html;

        /* สรุปจำนวนคาบ */
        host.appendChild(U.elFromHTML('<div class="small muted mt-8">แสดง ' + entries.length +
          ' คาบ · ช่องว่างคือคาบที่ไม่มีวิชา</div>'));

        U.on(host, 'click', '.tt-entry', function (ev, el) {
          if (drag || kbd) return;
          openEntryDetail(el.dataset.entry);
        });
        U.on(host, 'keydown', '.tt-entry', function (ev, el) {
          if (ev.key === 'F2' || ((!editable || !el.draggable) && (ev.key === 'Enter' || ev.key === ' '))) {
            ev.preventDefault(); openEntryDetail(el.dataset.entry);
          }
        });
        if (!editable) return;
        bindDragAndDrop(host);
      }

      function movingEntriesOf(entryId) {
        var e = U.byId(tt.entries, entryId);
        if (!e) return [];
        if (!e.pairGroupId) return [e];
        return tt.entries.filter(function (x) { return x.pairGroupId === e.pairGroupId; })
          .sort(function (a, b) { return a.periodNo - b.periodNo; });
      }

      function renderPendingPool() {
        var pending = pendingForCurrentView();
        if (!pending.length) return null;
        pending.sort(function (a, b) {
          var sectionOrder = String(a.section.name).localeCompare(String(b.section.name), 'th', { numeric: true });
          return sectionOrder || String(a.subject.name).localeCompare(String(b.subject.name), 'th');
        });
        var count = pending.reduce(function (sum, item) { return sum + item.remaining; }, 0);
        var modeName = view.mode === 'section' ? 'ชั้นเรียนนี้' : view.mode === 'teacher' ? 'ครูคนนี้' : 'คาบค้างทั้งโรงเรียน';
        var groupById = U.indexById(st.subjectGroups);
        var panel = U.elFromHTML('<section class="card tt-pending-panel no-print" aria-label="คาบที่ยังไม่ได้จัด">' +
          '<div class="tt-pending-head"><span class="tt-pending-head__icon" aria-hidden="true">' + global.ST.ux.icon('download') + '</span>' +
          '<div><div class="card__title">คาบที่ยังไม่ได้จัด <span class="badge badge--warning">' + U.fmtNum(count) + ' คาบ</span></div>' +
          '<div class="card__desc">' + (editable ? 'ลากการ์ดขึ้นไปวางในช่องว่าง หรือคลิกการ์ดแล้วคลิกช่องที่ต้องการ' : 'ตารางฉบับนี้แก้ไขไม่ได้ ต้องสร้างร่างใหม่ก่อน') +
          ' · แสดงเฉพาะ' + modeName + '</div></div></div><div class="tt-pending-list"></div></section>');
        var list = panel.querySelector('.tt-pending-list');
        list.innerHTML = pending.map(function (item) {
          var subject = item.subject, a = item.assignment;
          var group = groupById[subject.subjectGroupId];
          var color = group && group.color ? group.color : '#2563eb';
          var pairSize = item.remaining >= 2 && (subject.doubleMode === 'STRICT' || subject.doubleMode === 'PREFERRED') ? 2 : 1;
          var canPlace = editable && !subject.isElective;
          var disabledReason = !editable ? 'ต้องสร้างตารางฉบับร่างก่อน' :
            (subject.isElective ? 'วิชาเลือกเสรีต้องจัดพร้อมกันทั้งระดับชั้น ให้ใช้การจัดตารางอัตโนมัติ' : '');
          return '<button type="button" class="tt-pending-item' + (canPlace ? '' : ' is-disabled') + '"' +
            ' data-pending="' + a.id + '" data-size="' + pairSize + '" data-disabled-reason="' + U.esc(disabledReason) + '"' +
            (canPlace ? ' draggable="true"' : ' aria-disabled="true"') + ' style="--subject-color:' + U.esc(color) + '">' +
            '<span class="tt-pending-item__grip" aria-hidden="true">⠿</span><span class="tt-pending-item__copy">' +
            '<strong>' + U.esc(subject.name) + '</strong><span>' + U.esc(item.section.name) + ' · ' + U.esc(item.teacher ? item.teacher.name : '-') + '</span></span>' +
            '<span class="tt-pending-item__badges"><b>เหลือ ' + U.fmtNum(item.remaining) + '</b>' +
            (pairSize === 2 ? '<em>ลากครั้งละ 2 คาบ</em>' : '') + (subject.isElective ? '<em>จัดพร้อมกันทั้งระดับ</em>' : '') + '</span></button>';
        }).join('');

        function clearPendingDrag(host) {
          U.qsa('.tt-pending-item', panel).forEach(function (item) { item.classList.remove('is-selected', 'is-dragging'); });
          if (host) clearDropTargets(host);
        }

        function beginPending(card) {
          var reason = card.dataset.disabledReason;
          if (reason) {
            U.explainDialog({ title: 'ยังวางคาบนี้เองไม่ได้', cause: reason, fix: editable ? 'กดจัดตารางอัตโนมัติใหม่เพื่อให้วิชาเลือกลงพร้อมกันทุกห้อง' : 'สร้างร่างใหม่จากตารางนี้ แล้วจึงลากคาบลงช่องว่าง' });
            return false;
          }
          var a = U.byId(st.assignments, card.dataset.pending);
          if (!a) return false;
          var size = Math.max(1, Number(card.dataset.size) || 1);
          var pairGroupId = size === 2 ? U.uid('pg') : '';
          var moving = [];
          for (var i = 0; i < size; i++) {
            moving.push({ id: U.uid('en'), assignmentId: a.id, day: '', periodNo: 0, roomId: '', isLocked: false, isManual: true, pairGroupId: pairGroupId });
          }
          var ctx = SCH.buildContext(st);
          tt.entries.forEach(function (e) { SCH.occupy(ctx, e); });
          if (view.mode === 'room' && ctx.assignmentById[a.id]) {
            ctx.assignmentById[a.id] = Object.assign({}, ctx.assignmentById[a.id], { roomId: view.targetId });
          }
          var host = root.querySelector('#gridHost');
          clearPendingDrag(host);
          drag = { entryId: moving[0].id, moving: moving, prep: { ctx: ctx, ignore: {}, moving: moving }, fromPending: true, pendingCard: card };
          card.classList.add('is-selected');
          paintDropTargets(host);
          return true;
        }

        U.qsa('.tt-pending-item', panel).forEach(function (card) {
          card.addEventListener('dragstart', function (ev) {
            if (!beginPending(card)) { ev.preventDefault(); return; }
            card.classList.add('is-dragging');
            try { ev.dataTransfer.setData('text/plain', card.dataset.pending); } catch (e) { /* บางเบราว์เซอร์ */ }
            ev.dataTransfer.effectAllowed = 'move';
          });
          card.addEventListener('dragend', function () {
            clearPendingDrag(root.querySelector('#gridHost'));
            if (drag && drag.pendingCard === card) drag = null;
          });
          card.addEventListener('click', function () {
            if (drag && drag.pendingCard === card) {
              clearPendingDrag(root.querySelector('#gridHost'));
              drag = null;
              return;
            }
            if (beginPending(card)) U.toast('เลือกคาบแล้ว · คลิกช่องว่างในตารางเพื่อวาง หรือคลิกการ์ดซ้ำเพื่อยกเลิก', 'info', 6000);
          });
        });
        return panel;
      }

      function bindDragAndDrop(host) {
        kbd = null;                              /* กริดถูกวาดใหม่ ยกเลิกการย้ายด้วยคีย์บอร์ดที่ค้างอยู่ */
        U.qsa('.tt-entry[draggable="true"]', host).forEach(function (el) {
          el.addEventListener('dragstart', function (ev) {
            var entryId = el.dataset.entry;
            var moving = movingEntriesOf(entryId);
            drag = { entryId: entryId, moving: moving, prep: SCH.prepareMove(st, tt, moving) };
            el.classList.add('is-dragging');
            try { ev.dataTransfer.setData('text/plain', entryId); } catch (e) { /* บางเบราว์เซอร์ */ }
            ev.dataTransfer.effectAllowed = 'move';
            paintDropTargets(host);
          });
          el.addEventListener('dragend', function () {
            el.classList.remove('is-dragging');
            clearDropTargets(host);
            drag = null;
          });
          el.addEventListener('keydown', function (ev) {
            if (kbd) return;                     /* อยู่ในโหมดย้ายแล้ว ให้ host จัดการ */
            if (ev.key === 'Enter' || ev.key === ' ') {
              ev.preventDefault();
              ev.stopPropagation();
              startKbdMove(el.dataset.entry);
            }
          });
        });

        host.addEventListener('keydown', function (ev) {
          var ctrl = ev.ctrlKey || ev.metaKey;
          if (ctrl && !ev.shiftKey && (ev.key === 'z' || ev.key === 'Z')) { ev.preventDefault(); doUndo(); return; }
          if (ctrl && ((ev.key === 'y' || ev.key === 'Y') || ((ev.key === 'z' || ev.key === 'Z') && ev.shiftKey))) {
            ev.preventDefault(); doRedo(); return;
          }
          if (!kbd) return;
          if (ev.key === 'ArrowLeft') { ev.preventDefault(); kbdNavigate(0, -1); }
          else if (ev.key === 'ArrowRight') { ev.preventDefault(); kbdNavigate(0, 1); }
          else if (ev.key === 'ArrowUp') { ev.preventDefault(); kbdNavigate(-1, 0); }
          else if (ev.key === 'ArrowDown') { ev.preventDefault(); kbdNavigate(1, 0); }
          else if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); commitKbd(); }
          else if (ev.key === 'Escape') { ev.preventDefault(); cancelKbd(); }
        });

        U.qsa('.tt-cell', host).forEach(function (cell) {
          cell.addEventListener('dragover', function (ev) {
            if (!drag) return;
            /* รับการวางทุกช่อง เพื่อให้อธิบายเหตุผลได้เมื่อวางไม่ได้ */
            ev.preventDefault();
            ev.dataTransfer.dropEffect = 'move';
          });
          cell.addEventListener('drop', function (ev) {
            ev.preventDefault();
            if (!drag) return;
            doDrop(cell.dataset.day, Number(cell.dataset.period));
          });
          /* รองรับการคลิกช่องว่างเพื่อย้ายบนอุปกรณ์ที่ลากไม่ได้ */
          cell.addEventListener('click', function () {
            if (!drag) return;
            doDrop(cell.dataset.day, Number(cell.dataset.period));
          });
        });
      }

      function paintDropTargets(host) {
        U.qsa('.tt-cell', host).forEach(function (cell) {
          if (!drag) return;
          if (cell.querySelector('.tt-entry[data-entry="' + drag.entryId + '"]')) return;
          var res = SCH.checkMoveTarget(drag.prep, cell.dataset.day, Number(cell.dataset.period));
          cell.classList.add(res.ok ? 'tt-cell--drop-ok' : 'tt-cell--drop-bad');
          cell.dataset.reason = res.ok ? '' : res.cause;
          cell.title = res.ok ? 'วางที่นี่ได้' : ('วางที่นี่ไม่ได้ — ' + res.cause);
        });
      }

      function clearDropTargets(host) {
        U.qsa('.tt-cell', host).forEach(function (cell) {
          cell.classList.remove('tt-cell--drop-ok', 'tt-cell--drop-bad');
          cell.removeAttribute('title');
          delete cell.dataset.reason;
        });
      }

      function moveWarningTitle(message) {
        if (/ข้ามอาคาร/.test(message)) return 'ต้องเดินข้ามอาคาร';
        if (/ข้ามชั้น/.test(message)) return 'ต้องเดินข้ามชั้น';
        if (/วิชาหลัก|ช่วงเช้า|ช่วงบ่าย/.test(message)) return 'วิชาหลักจะถูกย้ายไปช่วงบ่าย';
        if (/คาบคู่|แยก/.test(message)) return 'คาบคู่จะไม่อยู่ติดกัน';
        return 'ไม่ตรงเงื่อนไขที่กำหนด';
      }

      function doDrop(day, periodNo) {
        var moving = drag.moving;
        var fromPending = !!drag.fromPending;
        var res = SCH.checkMoveTarget(drag.prep, day, periodNo);
        if (!res.ok) {
          U.explainDialog({
            title: 'ย้ายคาบนี้ไปช่องนั้นไม่ได้',
            cause: res.cause,
            fix: res.fix
          });
          drag = null;
          app.refresh();
          return;
        }
        var applyMove = function () {
          histSnapshot(tt);
          moving.forEach(function (e, i) {
            e.day = day;
            e.periodNo = res.targets[i];
            e.roomId = res.roomId;
            e.isManual = true;
          });
          if (fromPending) Array.prototype.push.apply(tt.entries, moving);
          recomputeStats();
          drag = null;
          app.saveAndRefresh(fromPending ? 'เพิ่มคาบลงตารางเรียบร้อยแล้ว' : 'ย้ายคาบเรียบร้อยแล้ว');
        };
        if (res.warnings && res.warnings.length) {
          U.confirmDialog({
            title: 'ตรวจสอบก่อนย้ายคาบ',
            message: 'ย้ายได้ แต่จะเกิดผลกระทบต่อเงื่อนไข ' + U.fmtNum(res.warnings.length) + ' เรื่อง',
            detail: '<ul class="move-warning-list">' + res.warnings.map(function (w) {
              return '<li class="move-warning-item"><span class="move-warning-item__icon" aria-hidden="true">!</span>' +
                '<div><span class="move-warning-item__label">สาเหตุ</span><strong>' + U.esc(moveWarningTitle(w)) + '</strong>' +
                '<p>' + U.esc(w) + '</p></div></li>';
            }).join('') + '</ul>',
            hint: 'ถ้ายืนยัน ระบบจะบันทึกจุดนี้ลงในรายงานปัญหาให้ตรวจภายหลัง',
            cancelText: 'ไม่ย้าย',
            confirmText: 'ย้ายต่อ'
          }).then(function (ok) {
            if (!ok) { drag = null; app.refresh(); return; }
            applyMove();
          });
        } else {
          applyMove();
        }
      }

      /* ---------- ย้ายคาบด้วยคีย์บอร์ด ---------- */
      function cellExists(host, day, period) {
        return !!host.querySelector('.tt-cell[data-day="' + day + '"][data-period="' + period + '"]');
      }
      function highlightCursor(host) {
        U.qsa('.tt-cell--cursor', host).forEach(function (c) { c.classList.remove('tt-cell--cursor'); });
        if (!kbd) return;
        var cell = host.querySelector('.tt-cell[data-day="' + kbd.day + '"][data-period="' + kbd.period + '"]');
        if (!cell) return;
        cell.classList.add('tt-cell--cursor');
        cell.setAttribute('tabindex', '-1');
        var res = SCH.checkMoveTarget(drag.prep, kbd.day, kbd.period);
        cell.setAttribute('aria-label', (res.ok ? 'วางที่นี่ได้ ' : 'วางที่นี่ไม่ได้ ') +
          'วัน' + U.DAY_NAMES[kbd.day] + ' คาบ ' + kbd.period + (res.ok ? '' : ' — ' + res.cause));
        cell.focus();
      }
      function startKbdMove(entryId) {
        var moving = movingEntriesOf(entryId);
        if (!moving.length) return;
        var host = U.qs('#gridHost');
        var el = host.querySelector('.tt-entry[data-entry="' + entryId + '"]');
        var cell = el ? el.closest('.tt-cell') : null;
        if (!cell) return;
        drag = { entryId: entryId, moving: moving, prep: SCH.prepareMove(st, tt, moving) };
        kbd = { entryId: entryId, day: cell.dataset.day, period: Number(cell.dataset.period) };
        paintDropTargets(host);
        highlightCursor(host);
        U.toast('เลือกคาบแล้ว · ใช้แป้นลูกศรเลือกช่องปลายทาง กด Enter เพื่อวาง กด Esc เพื่อยกเลิก', 'info', 6000);
      }
      function kbdNavigate(dRow, dCol) {
        var host = U.qs('#gridHost');
        if (!host || !kbd) return;
        var days = st.periodConfig.days;
        var periods = M.allPeriodNos(st);
        var pi = periods.indexOf(kbd.period);
        var di = days.indexOf(kbd.day);
        if (dCol !== 0) {
          var ni = pi;
          for (var s1 = 0; s1 < periods.length; s1++) {
            ni += dCol;
            if (ni < 0 || ni >= periods.length) break;
            if (cellExists(host, kbd.day, periods[ni])) { kbd.period = periods[ni]; break; }
          }
        }
        if (dRow !== 0) {
          var nd = di;
          for (var s2 = 0; s2 < days.length; s2++) {
            nd += dRow;
            if (nd < 0 || nd >= days.length) break;
            var day = days[nd];
            if (cellExists(host, day, kbd.period)) { kbd.day = day; break; }
            var found = null;
            for (var off = 1; off < periods.length && found == null; off++) {
              var a = pi - off, b = pi + off;
              if (a >= 0 && cellExists(host, day, periods[a])) found = periods[a];
              else if (b < periods.length && cellExists(host, day, periods[b])) found = periods[b];
            }
            if (found != null) { kbd.day = day; kbd.period = found; break; }
          }
        }
        highlightCursor(host);
      }
      function commitKbd() {
        if (!kbd || !drag) return;
        var res = SCH.checkMoveTarget(drag.prep, kbd.day, kbd.period);
        if (!res.ok) { U.toast('วางที่นี่ไม่ได้ — ' + res.cause, 'danger'); return; }
        var d = kbd.day, p = kbd.period;
        kbd = null;
        doDrop(d, p);
      }
      function cancelKbd() {
        var host = U.qs('#gridHost');
        kbd = null; drag = null;
        if (host) {
          clearDropTargets(host);
          U.qsa('.tt-cell--cursor', host).forEach(function (c) { c.classList.remove('tt-cell--cursor'); });
        }
      }

      /* ---------- Undo / Redo / ปรับให้ดีขึ้น ---------- */
      function doUndo() {
        if (histUndo(tt)) { recomputeStats(); app.saveAndRefresh('ย้อนกลับแล้ว'); }
        else U.toast('ไม่มีขั้นตอนให้ย้อนกลับ', 'info');
      }
      function doRedo() {
        if (histRedo(tt)) { recomputeStats(); app.saveAndRefresh('ทำซ้ำแล้ว'); }
        else U.toast('ไม่มีขั้นตอนให้ทำซ้ำ', 'info');
      }
      function runOptimize(btn) {
        if (btn) { btn.disabled = true; btn.textContent = 'กำลังปรับ…'; }
        U.nextFrame().then(function () {
          var before = (tt.stats && tt.stats.softViolations) || 0;
          histSnapshot(tt);
          var res = SCH.optimize(st, tt.entries, { timeBudgetMs: 4000 });
          tt.entries = res.entries;
          recomputeStats();
          var after = tt.stats.softViolations;
          var diff = before - after;
          app.saveAndRefresh(diff > 0
            ? ('ปรับแล้ว ลดข้อเสนอปรับตารางลง ' + U.fmtNum(diff) + ' จุด (เหลือ ' + U.fmtNum(after) + ')')
            : 'ตารางนี้ดีที่สุดเท่าที่ปรับได้แล้ว ไม่มีจุดที่ย้ายแล้วดีขึ้น');
        });
      }

      /* ---------- รายละเอียดคาบ ---------- */
      function openEntryDetail(entryId) {
        var e = U.byId(tt.entries, entryId);
        if (!e) return;
        var a = U.byId(st.assignments, e.assignmentId);
        if (!a) return;
        if (!editable) {
          var subjectRead = U.byId(st.subjects, a.subjectId), teacherRead = U.byId(st.teachers, a.teacherId), roomRead = U.byId(st.rooms, e.roomId), coRead = U.byId(st.teachers, a.coTeacherId);
          U.openModal({title:'รายละเอียดคาบ', content:'<div class="card__title">' + U.esc(subjectRead ? subjectRead.name : '-') + '</div><p>วัน' + U.DAY_NAMES[e.day] + ' คาบ ' + e.periodNo + '</p><p>ครู: ' + U.esc(teacherRead ? teacherRead.name : '-') + (coRead ? ' / ' + U.esc(coRead.name) : '') + '</p><p>ห้อง: ' + U.esc(roomRead ? roomRead.name : '-') + '</p><div class="callout">ตารางนี้ประกาศใช้แล้ว หากต้องการแก้ไข ให้สร้างร่างใหม่จากตารางนี้</div>', buttons:[{label:'ปิด'}]});
          return;
        }
        var subject = U.byId(st.subjects, a.subjectId);
        var section = U.byId(st.classSections, a.classSectionId);

        var body = document.createElement('div');
        body.className = 'entry-detail';
        body.innerHTML = '<div class="entry-detail__summary"><span class="entry-detail__code">รายวิชา · ' + U.esc(subject.code) + '</span>' +
          '<h3 class="entry-detail__subject">' + U.esc(subject.name) + '</h3>' +
          '<div class="entry-detail__facts"><span>ชั้นเรียน <b>' + U.esc(section ? section.name : '-') + '</b></span>' +
          '<span>วัน' + U.DAY_NAMES[e.day] + ' <b>คาบ ' + e.periodNo + '</b></span></div></div>' +
          '<div class="entry-detail__fields"><div class="field"><label class="field__label" for="edTeacher">ครูผู้สอน</label>' +
          '<select class="select" id="edTeacher">' + U.sortThai(st.teachers, function (t) { return t.name; })
            .map(function (t) {
              return '<option value="' + t.id + '"' + (t.id === a.teacherId ? ' selected' : '') + '>' + U.esc(t.name) + '</option>';
            }).join('') + '</select>' +
          '<div class="entry-detail__notice"><b>มีผลกับทุกคาบ</b><span>เมื่อเปลี่ยนครู ทุกคาบของวิชานี้ในชั้นเรียนนี้จะใช้ครูคนใหม่</span></div></div>' +
          '<div class="field"><label class="field__label" for="edRoom">ห้องที่ใช้</label>' +
          '<select class="select" id="edRoom">' + st.rooms.map(function (r) {
            return '<option value="' + r.id + '"' + (r.id === e.roomId ? ' selected' : '') + '>' + U.esc(r.name) + '</option>';
          }).join('') + '</select></div></div>' +
          '<label class="entry-detail__lock" for="edLock"><input type="checkbox" id="edLock"' + (e.isLocked ? ' checked' : '') + '>' +
          '<span><b>ล็อกคาบนี้ไว้</b><span>คงตำแหน่งเดิมเมื่อจัดตารางครั้งถัดไป</span></span></label>';

        U.openModal({
          title: 'รายละเอียดคาบเรียน',
          size: 'md',
          content: body,
          buttons: [
            { label: 'ปิด', className: 'btn--ghost' },
            {
              label: 'ลบคาบนี้ออกจากตาราง', className: 'btn--danger', onClick: function () {
                U.confirmDialog({
                  title: 'ลบคาบนี้',
                  message: 'ลบคาบ ' + subject.name + ' ของ ' + (section ? section.name : '') + ' ออกจากตารางใช่หรือไม่',
                  detail: '<b>ผลที่จะเกิดขึ้น</b><br>คาบนี้จะกลายเป็นคาบค้างที่ต้องจัดใหม่ และจะปรากฏในรายงานปัญหา',
                  confirmText: 'ลบคาบ', danger: true
                }).then(function (ok) {
                  if (!ok) return;
                  histSnapshot(tt);
                  var ids = movingEntriesOf(entryId).map(function (x) { return x.id; });
                  tt.entries = tt.entries.filter(function (x) { return ids.indexOf(x.id) === -1; });
                  recomputeStats();
                  app.saveAndRefresh('ลบคาบออกจากตารางแล้ว');
                });
                return true;
              }
            },
            {
              label: 'บันทึก', className: 'btn--primary', onClick: function () {
                var newTeacher = body.querySelector('#edTeacher').value;
                var newRoom = body.querySelector('#edRoom').value;
                var wantLock = body.querySelector('#edLock').checked;
                histSnapshot(tt);

                if (newTeacher !== a.teacherId) {
                  var oldTeacher = a.teacherId;
                  a.teacherId = newTeacher;
                  var conflicts = SCH.auditHardRules(st, tt.entries);
                  if (conflicts.length) {
                    a.teacherId = oldTeacher;
                    editHistory.past.pop();
                    U.explainDialog({
                      title: 'เปลี่ยนครูผู้สอนไม่ได้',
                      cause: 'ครูคนใหม่ติดสอนห้องอื่นหรือเกินโควตาในคาบที่วิชานี้อยู่ จึงเกิดการชนกัน ' +
                        conflicts.length + ' จุด',
                      fix: 'ให้ลากคาบของวิชานี้ไปช่องที่ครูคนใหม่ว่างก่อน แล้วจึงเปลี่ยนครู ' +
                        'หรือเลือกครูคนอื่นที่ว่างตรงคาบเดิม'
                    });
                    return true;
                  }
                }
                if (newRoom !== e.roomId) {
                  var oldRoom = e.roomId;
                  e.roomId = newRoom;
                  var conflicts2 = SCH.auditHardRules(st, tt.entries);
                  if (conflicts2.length) {
                    e.roomId = oldRoom;
                    editHistory.past.pop();
                    U.explainDialog({
                      title: 'เปลี่ยนห้องไม่ได้',
                      cause: 'ห้องที่เลือกถูกใช้อยู่แล้วในคาบนี้ หรือประเภทห้องไม่ตรงกับที่วิชากำหนด',
                      fix: 'ให้เลือกห้องอื่นที่ว่างและตรงประเภท หรือย้ายคาบไปช่องเวลาอื่นก่อน'
                    });
                    return true;
                  }
                }
                movingEntriesOf(entryId).forEach(function (x) { x.isLocked = wantLock; });
                recomputeStats();
                app.saveAndRefresh('บันทึกการแก้ไขคาบแล้ว');
              }
            }
          ]
        });
      }

      function recomputeStats() {
        var oldUnplaced = {};
        (tt.issues || []).forEach(function (issue) {
          if (issue.type === 'UNPLACED' && issue.assignmentId) oldUnplaced[issue.assignmentId] = issue;
        });
        var pending = pendingAssignments();
        var hardIssues = pending.map(function (item) {
          var old = oldUnplaced[item.assignment.id];
          if (old) {
            old.remainingPeriods = item.remaining;
            return old;
          }
          return {
            id: U.uid('is'), type: 'UNPLACED', severity: 'HIGH', assignmentId: item.assignment.id,
            ruleCode: 'H0', reasonCode: 'R3', remainingPeriods: item.remaining,
            message: 'คาบนี้ยังไม่ได้อยู่ในตารางหลังจากการปรับด้วยตนเอง',
            suggestion: 'ลากการ์ดคาบที่ยังไม่ได้จัดไปวางในช่องว่าง หรือลองจัดตารางอัตโนมัติใหม่',
            context: { sectionName: item.section.name, subjectName: item.subject.name, teacherName: item.teacher ? item.teacher.name : '-' }
          };
        });
        tt.issues = hardIssues.concat(SCH.collectSoftIssues(st, tt.entries));
        tt.stats = tt.stats || {};
        tt.stats.totalRequired = st.assignments.reduce(function (sum, a) { return sum + (a.teacherId ? U.num(a.periodsPerWeek) : 0); }, 0);
        tt.stats.placed = tt.entries.length;
        tt.stats.unplaced = pending.reduce(function (sum, item) { return sum + item.remaining; }, 0);
        tt.stats.softViolations = tt.issues.filter(function (i) { return i.type === 'SOFT_VIOLATION'; }).length;
        tt.updatedAt = new Date().toISOString();
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
