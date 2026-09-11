/* หน้า P9 — ล็อกคาบ (ปักหมุดวิชาที่จัดไว้ และกันช่องไว้ทำกิจกรรม) */
(function (global) {
  'use strict';
  var U = global.ST.util, M = global.ST.model, UI = global.ST.ui;
  global.ST.pages = global.ST.pages || {};

  var view = { scope: 'SCHOOL', targetId: '' };

  var SCOPE_LABEL = {
    SCHOOL: 'ทั้งโรงเรียน', GRADE: 'เฉพาะระดับชั้น',
    SECTION: 'เฉพาะชั้นเรียน', TEACHER: 'เฉพาะครู'
  };

  global.ST.pages.locks = {
    render: function (root) {
      var app = global.ST.app;
      var st = app.state();
      var slots = M.slotsPerWeek(st);

      UI.pageHeader(root, {
        title: 'ล็อกคาบ',
        desc: 'ปักหมุดวิชาที่จัดครูไว้แล้วให้อยู่วันและคาบที่ต้องการ หรือกันช่องไว้ทำกิจกรรมโดยไม่ให้ระบบจัดวิชาลง',
        actions: [
          { label: '+ กันช่องไว้ทำกิจกรรม', onClick: function () { lockForm(); } },
          { label: '📌 ปักหมุดวิชาที่จัดไว้', className: 'btn--primary', onClick: function () { pinForm(); } }
        ]
      });

      var anyTeaching = st.periodConfig.days.some(function (d) {
        return M.teachingPeriodNos(st, d).length > 0;
      });
      if (!anyTeaching) {
        root.appendChild(UI.emptyState({
          icon: '🔒', title: 'ยังล็อกคาบไม่ได้',
          desc: 'ยังไม่มีคาบสำหรับสอนในผังคาบเลย ทุกคาบถูกตั้งเป็นคาบพัก ให้ไปตั้งค่าผังคาบเรียนก่อน',
          actions: [{ label: 'ไปหน้าตั้งค่าโรงเรียน', onClick: function () { app.go('settings'); } }]
        }));
        return;
      }

      var lockGuide = U.elFromHTML(
        '<div class="lock-type-guide"><div class="lock-type-guide__head"><b>ต้องการทำอะไร?</b>' +
        '<span>เลือกประเภทแล้วเริ่มตั้งค่าได้ทันที</span></div>' +
        '<button type="button" class="lock-type lock-type--pin" id="quickPin"><span class="lock-type__icon">📌</span>' +
        '<span><b>กำหนดวิชาไว้คาบนี้</b><small>วิชาจะอยู่ตำแหน่งนี้เสมอ</small></span><span class="lock-type__arrow">›</span></button>' +
        '<button type="button" class="lock-type lock-type--block" id="quickBlock"><span class="lock-type__icon">🔒</span>' +
        '<span><b>กันเวลาไว้ทำกิจกรรม</b><small>ระบบจะไม่นำวิชามาลง</small></span><span class="lock-type__arrow">›</span></button></div>');
      lockGuide.querySelector('#quickPin').addEventListener('click', function () { pinForm(); });
      lockGuide.querySelector('#quickBlock').addEventListener('click', function () { lockForm(); });
      root.appendChild(lockGuide);

      var gradeOptions = st.gradeLevels.map(function (g) { return { id: g.id, name: g.name }; });
      var sectionOptions = U.sortThai(st.classSections, function (s) { return s.name; })
        .map(function (s) { return { id: s.id, name: s.name }; });
      var teacherOptions = U.sortThai(st.teachers, function (t) { return t.name; })
        .map(function (t) { return { id: t.id, name: t.name }; });

      function targetsFor(scope) {
        if (scope === 'GRADE') return gradeOptions;
        if (scope === 'SECTION') return sectionOptions;
        if (scope === 'TEACHER') return teacherOptions;
        return [];
      }
      var targets = targetsFor(view.scope);
      if (view.scope !== 'SCHOOL' && !targets.some(function (t) { return t.id === view.targetId; })) {
        view.targetId = targets.length ? targets[0].id : '';
      }

      var cols = U.elFromHTML('<div class="grid grid--side"></div>');
      var left = document.createElement('div');
      var right = document.createElement('div');

      /* ---------- ผังสัปดาห์ ---------- */
      var gridCard = U.elFromHTML('<div class="card lock-grid-card">' +
        '<div class="card__title">ผังสัปดาห์</div>' +
        '<div class="card__desc">คลิกช่องว่างเพื่อกันช่องไว้ทำกิจกรรม หรือคลิกช่องที่ล็อกแล้วเพื่อแก้ไข · ' +
        'เลือกมุมมองเป็นชั้นเรียนเพื่อดูวิชาที่ปักหมุดไว้ของห้องนั้น</div>' +
        '<div class="table-tools">' +
        '<select class="select" id="lkScope">' + Object.keys(SCOPE_LABEL).map(function (k) {
          return '<option value="' + k + '"' + (view.scope === k ? ' selected' : '') + '>ดูมุมมอง: ' + SCOPE_LABEL[k] + '</option>';
        }).join('') + '</select>' +
        (view.scope === 'SCHOOL' ? '' :
          '<select class="select" id="lkTarget">' + targets.map(function (t) {
            return '<option value="' + t.id + '"' + (view.targetId === t.id ? ' selected' : '') + '>' + U.esc(t.name) + '</option>';
          }).join('') + '</select>') +
        '</div><div id="lkGrid"></div></div>');
      left.appendChild(gridCard);

      gridCard.querySelector('#lkScope').addEventListener('change', function (ev) {
        view.scope = ev.target.value;
        view.targetId = '';
        app.refresh();
      });
      var targetSel = gridCard.querySelector('#lkTarget');
      if (targetSel) targetSel.addEventListener('change', function (ev) {
        view.targetId = ev.target.value;
        app.refresh();
      });

      function visibleLocks() {
        return st.lockedSlots.filter(function (l) {
          if (l.kind === 'SUBJECT') {
            /* หมุดวิชาแสดงเฉพาะมุมมองชั้นเรียน เพื่อไม่ให้ผังรกจนอ่านไม่ออก */
            if (view.scope !== 'SECTION') return false;
            var sec = U.byId(st.classSections, view.targetId);
            return !!sec && M.lockAppliesToSection(st, l, sec);
          }
          if (view.scope === 'SCHOOL') return true;
          if (view.scope === 'TEACHER') {
            return (l.scope === 'TEACHER' && l.targetId === view.targetId) || l.teacherId === view.targetId;
          }
          if (view.scope === 'GRADE') {
            if (l.scope === 'SCHOOL') return true;
            if (l.scope === 'GRADE') return l.targetId === view.targetId;
            if (l.scope === 'SECTION') {
              var s2 = U.byId(st.classSections, l.targetId);
              return s2 && s2.gradeLevelId === view.targetId;
            }
            return false;
          }
          var section = U.byId(st.classSections, view.targetId);
          if (!section) return false;
          return M.lockAppliesToSection(st, l, section);
        });
      }

      var selectedMap = {};
      visibleLocks().forEach(function (l) { selectedMap[l.day + '#' + l.periodNo] = l; });

      var grid = UI.weekPicker(st, {
        selected: selectedMap,
        labelFor: function (day, periodNo) {
          var l = selectedMap[day + '#' + periodNo];
          if (!l) return '';
          return (l.kind === 'SUBJECT' ? '📌 ' : '') + U.abbreviate(l.label, 14);
        },
        onToggle: function (day, periodNo) {
          var existing = selectedMap[day + '#' + periodNo];
          if (existing && existing.kind === 'SUBJECT') { pinForm(existing); return; }
          if (existing) lockForm(existing);
          else lockForm(null, day, periodNo);
        }
      });
      gridCard.querySelector('#lkGrid').appendChild(grid);

      /* ---------- ตัวนับช่องที่เหลือ ---------- */
      var maps = M.buildLockMaps(st);
      var worst = null;
      st.classSections.forEach(function (sec) {
        var locked = Object.keys(maps.section[sec.id] || {}).length;
        var free = slots - locked;
        var need = M.sectionWeeklyTotal(st, sec.id);
        if (!worst || (free - need) < (worst.free - worst.need)) {
          worst = { section: sec, free: free, need: need, locked: locked };
        }
      });

      var counterCard = U.elFromHTML('<div class="card lock-counter-card"><div class="card__title">ความพร้อมของตาราง</div>' +
        '<div class="card__desc">นับจากช่องทั้งหมดในหนึ่งสัปดาห์ หักช่องที่กันไว้ทำกิจกรรม</div></div>');
      if (worst) {
        var diff = worst.free - worst.need;
        counterCard.appendChild(U.elFromHTML(
          '<div class="lock-tight-room"><span>ห้องที่มีพื้นที่น้อยที่สุด</span><b>' + U.esc(worst.section.name) + '</b></div>' +
          '<div class="lock-stats">' +
          '<div><strong>' + slots + '</strong><span>ช่องทั้งหมด</span></div>' +
          '<div><strong>' + worst.locked + '</strong><span>กันไว้</span></div>' +
          '<div><strong>' + worst.need + '</strong><span>คาบที่ต้องใช้</span></div>' +
          '<div class="lock-stat--accent"><strong>' + worst.free + '</strong><span>ช่องที่เหลือ</span></div></div>' +
          '<div class="lock-capacity-result ' + (diff < 0 ? 'is-danger' : 'is-success') + '">' +
          '<span aria-hidden="true">' + (diff < 0 ? '!' : '✓') + '</span><div><b>' +
          (diff < 0 ? 'พื้นที่ไม่เพียงพอ' : 'พื้นที่เพียงพอ') + '</b><small>' +
          (diff < 0 ? 'ขาดอีก ' + (-diff) + ' ช่อง' : 'ยังเหลือว่างอีก ' + diff + ' ช่อง') + '</small></div></div>'
        ));
        if (diff < 0) {
          counterCard.appendChild(U.elFromHTML('<div class="issue issue--high mt-8">' +
            '<div class="issue__title">กันช่องไว้มากเกินไป</div>' +
            '<div class="issue__reason">สาเหตุ: ห้อง ' + U.esc(worst.section.name) + ' เหลือช่องว่างเพียง ' +
            worst.free + ' ช่อง แต่หลักสูตรกำหนดไว้ ' + worst.need + ' คาบ</div>' +
            '<div class="issue__suggestion"><b>วิธีแก้</b> ปลดช่องที่กันไว้บางช่อง ลดจำนวนคาบในหลักสูตร ' +
            'หรือเพิ่มจำนวนคาบต่อวันในหน้าตั้งค่าโรงเรียน</div></div>'));
        }
      }
      right.appendChild(counterCard);

      /* ---------- รายการหมุดวิชา ---------- */
      var pins = M.pinnedLocks(st);
      var pinCard = U.elFromHTML('<div class="card"><div class="card__title">วิชาที่ปักหมุดไว้ ' +
        '<span class="badge badge--pin">' + pins.length + ' รายการ</span></div>' +
        '<div class="card__desc">ระบบจะวางวิชาเหล่านี้ลงช่องที่ระบุก่อนวิชาอื่น และห้ามขยับ</div>' +
        '<div id="pinList"></div></div>');
      var pinHost = pinCard.querySelector('#pinList');
      if (!pins.length) {
        pinHost.appendChild(UI.emptyState({
          icon: '📌', title: 'ยังไม่มีวิชาที่ปักหมุดไว้',
          desc: 'ใช้เมื่ออยากบังคับว่าวิชาใดของห้องใดต้องอยู่วันและคาบไหนแน่นอน เช่น คาบแนะแนวของครูที่ปรึกษา',
          actions: [{ label: 'ปักหมุดวิชา', onClick: function () { pinForm(); } }]
        }));
      } else {
        pinHost.innerHTML = '<div class="table-wrap"><table class="data"><thead><tr>' +
          '<th>ชั้นเรียน</th><th>วิชา</th><th>เวลา</th><th>เหตุผล</th><th></th></tr></thead><tbody>' +
          pins.map(function (l) {
            var a = U.byId(st.assignments, l.assignmentId);
            var sec = a ? U.byId(st.classSections, a.classSectionId) : null;
            var sub = a ? U.byId(st.subjects, a.subjectId) : null;
            var t = a ? U.byId(st.teachers, a.teacherId) : null;
            return '<tr><td><b>' + U.esc(sec ? sec.name : '-') + '</b></td>' +
              '<td>' + U.esc(sub ? sub.code + ' ' + sub.name : '-') +
              '<div class="small muted">ครู' + U.esc(t ? t.name : 'ยังไม่ได้เลือก') + '</div></td>' +
              '<td>' + U.DAY_NAMES[l.day] + ' คาบ ' + l.periodNo +
              '<div class="small muted">' + U.esc(M.timeLabel(st, l.day, l.periodNo)) + '</div></td>' +
              '<td class="small muted">' + U.esc(l.reason || '-') + '</td>' +
              '<td><div class="row-actions">' +
              '<button type="button" class="btn btn--sm" data-pinedit="' + l.id + '">แก้ไข</button>' +
              '<button type="button" class="btn btn--sm btn--danger-ghost" data-pindel="' + l.id + '">เอาหมุดออก</button>' +
              '</div></td></tr>';
          }).join('') + '</tbody></table></div>';
        U.on(pinHost, 'click', 'button[data-pinedit]', function (ev, btn) {
          pinForm(U.byId(st.lockedSlots, btn.dataset.pinedit));
        });
        U.on(pinHost, 'click', 'button[data-pindel]', function (ev, btn) {
          var l = U.byId(st.lockedSlots, btn.dataset.pindel);
          U.confirmDialog({
            title: 'เอาหมุดออกจากวิชานี้',
            message: 'เอาหมุด "' + l.label + '" วัน' + U.DAY_NAMES[l.day] + ' คาบ ' + l.periodNo + ' ออกใช่หรือไม่',
            hint: 'เมื่อเอาหมุดออกแล้ว ระบบจะเลือกวันและคาบให้วิชานี้เองในการจัดตารางครั้งถัดไป',
            confirmText: 'เอาหมุดออก', danger: true
          }).then(function (ok) {
            if (!ok) return;
            st.lockedSlots = st.lockedSlots.filter(function (x) { return x.id !== l.id; });
            app.saveAndRefresh('เอาหมุดออกแล้ว');
          });
        });
      }
      left.appendChild(pinCard);

      /* ---------- รายการช่องที่กันไว้ ---------- */
      var blocks = st.lockedSlots.filter(function (l) { return l.kind !== 'SUBJECT'; });
      var listCard = U.elFromHTML('<div class="card"><div class="card__title">ช่องที่กันไว้ทำกิจกรรม ' +
        '<span class="badge badge--locked">' + blocks.length + ' รายการ</span></div><div id="lkList"></div></div>');
      var listHost = listCard.querySelector('#lkList');
      if (!blocks.length) {
        listHost.appendChild(UI.emptyState({
          icon: '🔒', title: 'ยังไม่มีช่องที่กันไว้',
          desc: 'คลิกช่องบนผังสัปดาห์ หรือกดปุ่มกันช่องไว้ทำกิจกรรม',
          actions: [{ label: 'กันช่องไว้ทำกิจกรรม', onClick: function () { lockForm(); } }]
        }));
      } else {
        listHost.innerHTML = '<div class="table-wrap"><table class="data"><thead><tr>' +
          '<th>ขอบเขต</th><th>เวลา</th><th>สิ่งที่อยู่ในคาบ</th><th></th></tr></thead><tbody>' +
          blocks.map(function (l) {
            return '<tr><td>' + U.esc(SCOPE_LABEL[l.scope]) +
              (l.targetId ? '<div class="small muted">' + U.esc(targetName(st, l)) + '</div>' : '') + '</td>' +
              '<td>' + U.DAY_NAMES[l.day] + ' คาบ ' + l.periodNo + '</td>' +
              '<td><b>' + U.esc(l.label) + '</b>' +
              (l.reason ? '<div class="small muted">' + U.esc(l.reason) + '</div>' : '') + '</td>' +
              '<td><div class="row-actions">' +
              '<button type="button" class="btn btn--sm" data-act="edit" data-id="' + l.id + '">แก้ไข</button>' +
              '<button type="button" class="btn btn--sm btn--danger-ghost" data-act="del" data-id="' + l.id + '">ปลดล็อก</button>' +
              '</div></td></tr>';
          }).join('') + '</tbody></table></div>';
        U.on(listHost, 'click', 'button[data-act="edit"]', function (ev, btn) {
          lockForm(U.byId(st.lockedSlots, btn.dataset.id));
        });
        U.on(listHost, 'click', 'button[data-act="del"]', function (ev, btn) {
          var l = U.byId(st.lockedSlots, btn.dataset.id);
          U.confirmDialog({
            title: 'ปลดช่องที่กันไว้',
            message: 'ปลด "' + l.label + '" วัน' + U.DAY_NAMES[l.day] + ' คาบ ' + l.periodNo + ' ใช่หรือไม่',
            hint: 'เมื่อปลดแล้ว ระบบจะจัดวิชาลงช่องนี้ได้ในการจัดตารางครั้งถัดไป',
            confirmText: 'ปลดล็อก', danger: true
          }).then(function (ok) {
            if (!ok) return;
            st.lockedSlots = st.lockedSlots.filter(function (x) { return x.id !== l.id; });
            app.saveAndRefresh('ปลดช่องที่กันไว้แล้ว');
          });
        });
      }
      left.appendChild(listCard);

      cols.appendChild(left);
      cols.appendChild(right);
      root.appendChild(cols);

      function targetName(state, lock) {
        if (lock.scope === 'GRADE') { var g = U.byId(state.gradeLevels, lock.targetId); return g ? g.name : '-'; }
        if (lock.scope === 'SECTION') { var s = U.byId(state.classSections, lock.targetId); return s ? s.name : '-'; }
        if (lock.scope === 'TEACHER') { var t = U.byId(state.teachers, lock.targetId); return t ? t.name : '-'; }
        return '';
      }

      /* ---------- ปักหมุดวิชาที่จัดไว้ ---------- */
      function pinForm(pin) {
        var ready = st.assignments.filter(function (a) { return !!a.teacherId; });
        if (!ready.length) {
          U.explainDialog({
            title: 'ปักหมุดวิชาไม่ได้',
            cause: 'ยังไม่มีวิชาใดที่จัดครูผู้สอนไว้ หมุดต้องอ้างอิงวิชาที่จัดครูแล้ว ระบบจึงจะรู้ว่าจะวางใครลงช่องนั้น',
            fix: 'ให้ไปที่หน้าจัดครูผู้สอน เลือกครูให้วิชาที่ต้องการก่อน แล้วกลับมาปักหมุดอีกครั้ง'
          });
          return;
        }

        var current = pin ? U.byId(st.assignments, pin.assignmentId) : null;
        var sectionId = current ? current.classSectionId
          : (view.scope === 'SECTION' && view.targetId ? view.targetId : ready[0].classSectionId);
        var assignmentId = current ? current.id : '';
        var day = pin ? pin.day : st.periodConfig.days[0];
        var periodNo = pin ? U.num(pin.periodNo) : 0;
        var reason = pin ? (pin.reason || '') : '';

        var body = document.createElement('div');
        body.innerHTML =
          '<div class="form-grid">' +
          '<div class="field"><label class="field__label" for="pinSection">ชั้นเรียน</label>' +
          '<select class="select" id="pinSection"></select></div>' +
          '<div class="field"><label class="field__label" for="pinSubject">วิชาที่จัดครูไว้แล้ว</label>' +
          '<select class="select" id="pinSubject"></select>' +
          '<div class="field__hint" id="pinInfo"></div></div>' +
          '</div>' +
          '<div class="field"><label class="field__label">เลือกวันและคาบที่ต้องการปักหมุด</label>' +
          '<div id="pinGrid"></div></div>' +
          '<div class="field"><label class="field__label" for="pinReason">เหตุผลที่ปักหมุด</label>' +
          '<textarea class="textarea" id="pinReason" rows="2">' + U.esc(reason) + '</textarea>' +
          '<div class="field__hint">แสดงในรายงาน เพื่อให้จำได้ว่าปักหมุดไว้ทำไม</div></div>';

        var secSel = body.querySelector('#pinSection');
        var subSel = body.querySelector('#pinSubject');
        var infoEl = body.querySelector('#pinInfo');
        var gridHost = body.querySelector('#pinGrid');

        var sectionsWithWork = st.classSections.filter(function (s) {
          return ready.some(function (a) { return a.classSectionId === s.id; });
        });
        if (!sectionsWithWork.some(function (s) { return s.id === sectionId; })) {
          sectionId = sectionsWithWork[0].id;
        }
        secSel.innerHTML = U.sortThai(sectionsWithWork, function (s) { return s.name; }).map(function (s) {
          return '<option value="' + s.id + '"' + (s.id === sectionId ? ' selected' : '') + '>' + U.esc(s.name) + '</option>';
        }).join('');

        function paintSubjects() {
          var list = ready.filter(function (a) { return a.classSectionId === sectionId; });
          subSel.innerHTML = list.map(function (a) {
            var sub = U.byId(st.subjects, a.subjectId);
            return '<option value="' + a.id + '"' + (a.id === assignmentId ? ' selected' : '') + '>' +
              U.esc(sub ? sub.code + ' ' + sub.name : '-') + ' (' + U.num(a.periodsPerWeek) + ' คาบ)</option>';
          }).join('');
          if (!list.some(function (a) { return a.id === assignmentId; })) {
            assignmentId = list.length ? list[0].id : '';
            subSel.value = assignmentId;
          }
          paintInfo();
        }

        function paintInfo() {
          var a = U.byId(st.assignments, assignmentId);
          if (!a) { infoEl.textContent = ''; return; }
          var t = U.byId(st.teachers, a.teacherId);
          var already = st.lockedSlots.filter(function (l) {
            return l.kind === 'SUBJECT' && l.assignmentId === a.id && (!pin || l.id !== pin.id);
          }).length;
          infoEl.textContent = 'ครูผู้สอน ' + (t ? t.name : '-') +
            ' · วิชานี้มี ' + U.num(a.periodsPerWeek) + ' คาบต่อสัปดาห์ ปักหมุดไว้แล้ว ' + already + ' คาบ';
        }

        function paintGrid() {
          gridHost.innerHTML = '';
          var sel = {};
          if (periodNo) sel[day + '#' + periodNo] = true;
          gridHost.appendChild(UI.weekPicker(st, {
            selected: sel,
            labelFor: function () { return '📌'; },
            onToggle: function (d, p) {
              day = d; periodNo = p;
              paintGrid();
            }
          }));
        }

        secSel.addEventListener('change', function (ev) { sectionId = ev.target.value; paintSubjects(); });
        subSel.addEventListener('change', function (ev) { assignmentId = ev.target.value; paintInfo(); });
        paintSubjects();
        paintGrid();

        U.openModal({
          title: pin ? 'แก้ไขหมุดวิชา' : 'ปักหมุดวิชาที่จัดไว้',
          size: 'lg',
          content: body,
          buttons: [
            { label: 'ยกเลิก', className: 'btn--ghost' },
            {
              label: 'บันทึกหมุด', className: 'btn--primary', onClick: function () {
                var a = U.byId(st.assignments, assignmentId);
                if (!a) {
                  U.explainDialog({
                    title: 'บันทึกหมุดไม่ได้',
                    cause: 'ยังไม่ได้เลือกวิชาที่จะปักหมุด',
                    fix: 'ให้เลือกชั้นเรียนและวิชาที่จัดครูไว้แล้วจากช่องด้านบน'
                  });
                  return true;
                }
                if (!periodNo) {
                  U.explainDialog({
                    title: 'บันทึกหมุดไม่ได้',
                    cause: 'ยังไม่ได้เลือกวันและคาบบนผังสัปดาห์',
                    fix: 'ให้คลิกช่องบนผังสัปดาห์หนึ่งช่อง เพื่อระบุว่าวิชานี้ต้องอยู่วันไหนคาบไหน'
                  });
                  return true;
                }
                var err = validatePin(a, day, periodNo, pin);
                if (err) { U.explainDialog(err); return true; }

                var target = pin || { id: U.uid('lk'), kind: 'SUBJECT', createdAt: new Date().toISOString() };
                var sec = U.byId(st.classSections, a.classSectionId);
                var sub = U.byId(st.subjects, a.subjectId);
                target.kind = 'SUBJECT';
                target.assignmentId = a.id;
                target.scope = 'SECTION';
                target.targetId = a.classSectionId;
                target.day = day;
                target.periodNo = periodNo;
                target.subjectId = a.subjectId;
                target.teacherId = a.teacherId;
                target.roomId = a.roomId || '';
                target.label = (sec ? sec.name : '-') + ' · ' + (sub ? sub.name : '-');
                target.reason = body.querySelector('#pinReason').value.trim();
                target.updatedAt = new Date().toISOString();
                if (!pin) st.lockedSlots.push(target);
                U.closeModal();
                app.saveAndRefresh('บันทึกหมุดวิชาแล้ว');
                return true;
              }
            }
          ]
        });
      }

      /* ตรวจว่าปักหมุดตรงนี้ได้จริงไหม พร้อมบอกสาเหตุและวิธีแก้ */
      function validatePin(a, day, periodNo, pin) {
        var sec = U.byId(st.classSections, a.classSectionId);
        var sub = U.byId(st.subjects, a.subjectId);
        var p = M.periodByNo(st, day, periodNo);
        if (!p) {
          return {
            title: 'ปักหมุดช่องนี้ไม่ได้',
            cause: 'วัน' + U.DAY_NAMES[day] + ' ไม่มีคาบ ' + periodNo + ' เพราะวันนั้นมีคาบน้อยกว่าวันอื่น',
            fix: 'ให้เลือกคาบอื่นในวันนั้น หรือไปเพิ่มจำนวนคาบของวันนั้นที่หน้าตั้งค่าโรงเรียน'
          };
        }
        if (p.isBreak) {
          return {
            title: 'ปักหมุดช่องนี้ไม่ได้',
            cause: 'วัน' + U.DAY_NAMES[day] + ' คาบ ' + periodNo + ' ถูกตั้งไว้เป็นคาบพัก จึงจัดวิชาลงไม่ได้',
            fix: 'ให้เลือกคาบที่ไม่ใช่คาบพัก หรือไปแก้ผังคาบที่หน้าตั้งค่าโรงเรียน'
          };
        }
        var teacher = U.byId(st.teachers, a.teacherId);
        if (teacher && (teacher.availableDays || []).indexOf(day) === -1) {
          return {
            title: 'ปักหมุดช่องนี้ไม่ได้',
            cause: 'ครู' + teacher.name + ' ไม่ได้มาสอนวัน' + U.DAY_NAMES[day] + ' จึงสอนวิชานี้ในวันนั้นไม่ได้',
            fix: 'ให้เลือกวันอื่นที่ครูมาสอน เปลี่ยนครูผู้สอนที่หน้าจัดครูผู้สอน หรือแก้วันที่มาสอนของครูที่หน้าครู'
          };
        }
        if (teacher && (teacher.unavailableSlots || []).some(function (u) {
          return u.day === day && U.num(u.periodNo) === periodNo;
        })) {
          return {
            title: 'ปักหมุดช่องนี้ไม่ได้',
            cause: 'ครู' + teacher.name + ' แจ้งไว้ว่าไม่สะดวกสอนวัน' + U.DAY_NAMES[day] + ' คาบ ' + periodNo,
            fix: 'ให้เลือกวันหรือคาบอื่น หรือไปแก้คาบที่ไม่สะดวกสอนของครูคนนี้ที่หน้าครู'
          };
        }
        /* ช่องที่ถูกกันไว้ */
        var maps2 = M.buildLockMaps(st);
        var blocked = (maps2.section[sec.id] || {})[day + '#' + periodNo];
        if (blocked) {
          return {
            title: 'ปักหมุดช่องนี้ไม่ได้',
            cause: 'วัน' + U.DAY_NAMES[day] + ' คาบ ' + periodNo + ' ของห้อง ' + sec.name +
              ' ถูกกันไว้ทำกิจกรรม "' + blocked.label + '" อยู่แล้ว',
            fix: 'ให้เลือกช่องอื่น หรือปลดช่องที่กันไว้รายการนั้นก่อน'
          };
        }
        var teacherBlocked = teacher ? (maps2.teacher[teacher.id] || {})[day + '#' + periodNo] : null;
        if (teacherBlocked) {
          return {
            title: 'ปักหมุดช่องนี้ไม่ได้',
            cause: 'ครู' + teacher.name + ' ถูกกันช่องไว้ทำ "' + teacherBlocked.label + '" ในวัน' +
              U.DAY_NAMES[day] + ' คาบ ' + periodNo,
            fix: 'ให้เลือกช่องอื่น หรือปลดช่องที่กันไว้ของครูคนนี้ก่อน'
          };
        }
        /* หมุดอื่นชนกัน */
        var clash = st.lockedSlots.filter(function (l) {
          if (l.kind !== 'SUBJECT') return false;
          if (pin && l.id === pin.id) return false;
          if (l.day !== day || U.num(l.periodNo) !== periodNo) return false;
          var other = U.byId(st.assignments, l.assignmentId);
          if (!other) return false;
          return other.classSectionId === a.classSectionId ||
            (other.teacherId && other.teacherId === a.teacherId);
        })[0];
        if (clash) {
          return {
            title: 'ปักหมุดช่องนี้ไม่ได้',
            cause: 'ช่องนี้มีหมุดอยู่แล้วคือ "' + clash.label + '" ซึ่งใช้ห้องเรียนเดียวกันหรือครูคนเดียวกัน ' +
              'ถ้าปักซ้อนจะกลายเป็นคนเดียวสอนสองที่พร้อมกัน',
            fix: 'ให้เลือกวันหรือคาบอื่น หรือเอาหมุดเดิมออกก่อน'
          };
        }
        /* ปักหมุดเกินจำนวนคาบของวิชานั้น */
        var pinnedCount = st.lockedSlots.filter(function (l) {
          return l.kind === 'SUBJECT' && l.assignmentId === a.id && (!pin || l.id !== pin.id);
        }).length;
        if (pinnedCount + 1 > U.num(a.periodsPerWeek)) {
          return {
            title: 'ปักหมุดช่องนี้ไม่ได้',
            cause: 'วิชา ' + (sub ? sub.name : '-') + ' ของห้อง ' + sec.name + ' มีเพียง ' +
              U.num(a.periodsPerWeek) + ' คาบต่อสัปดาห์ แต่ปักหมุดไว้แล้ว ' + pinnedCount + ' คาบ',
            fix: 'ให้เอาหมุดเดิมของวิชานี้ออกก่อน หรือเพิ่มจำนวนคาบของวิชานี้ในหลักสูตร'
          };
        }
        return null;
      }

      /* ---------- กันช่องไว้ทำกิจกรรม ---------- */
      function lockForm(lock, presetDay, presetPeriod) {
        var allNos = M.allPeriodNos(st);
        var values = lock ? U.deepClone(lock) : {
          scope: view.scope, targetId: view.targetId,
          day: presetDay || st.periodConfig.days[0],
          periodNo: presetPeriod || allNos[0],
          label: '', reason: '', teacherId: '', roomId: ''
        };

        UI.formModal({
          title: lock ? 'แก้ไขช่องที่กันไว้' : 'กันช่องไว้ทำกิจกรรม',
          size: 'md',
          values: values,
          fields: [
            {
              name: 'scope', label: 'ขอบเขต', type: 'select',
              options: Object.keys(SCOPE_LABEL).map(function (k) { return { value: k, label: SCOPE_LABEL[k] }; }),
              hint: 'ทั้งโรงเรียน = ทุกชั้นเรียนว่างพร้อมกันในคาบนี้'
            },
            {
              name: 'targetId', label: 'เป้าหมาย', type: 'select',
              options: [{ value: '', label: '— ไม่ต้องระบุ (ใช้กับทั้งโรงเรียน) —' }].concat(
                gradeOptions.concat(sectionOptions).concat(teacherOptions).map(function (t) {
                  return { value: t.id, label: t.name };
                })),
              hint: 'เลือกระดับชั้น ชั้นเรียน หรือครู ให้ตรงกับขอบเขตที่เลือกไว้'
            },
            {
              name: 'day', label: 'วัน', type: 'select',
              options: st.periodConfig.days.map(function (d) { return { value: d, label: U.DAY_NAMES[d] }; })
            },
            {
              name: 'periodNo', label: 'คาบ', type: 'select',
              options: allNos.map(function (p) { return { value: p, label: 'คาบ ' + p }; })
            },
            { name: 'label', label: 'สิ่งที่อยู่ในคาบนั้น', required: true, hint: 'เช่น ประชุมครู, กิจกรรมชุมนุม, หน้าเสาธง' },
            {
              name: 'teacherId', label: 'ครูที่เกี่ยวข้อง (ไม่บังคับ)', type: 'select',
              options: [{ value: '', label: '— ไม่ระบุ —' }].concat(teacherOptions.map(function (t) {
                return { value: t.id, label: t.name };
              }))
            },
            {
              name: 'roomId', label: 'ห้องที่ใช้ (ไม่บังคับ)', type: 'select',
              options: [{ value: '', label: '— ไม่ระบุ —' }].concat(st.rooms.map(function (r) {
                return { value: r.id, label: r.name };
              }))
            },
            { name: 'reason', label: 'เหตุผลที่กันช่องไว้', type: 'textarea', rows: 2, hint: 'แสดงในรายงาน เพื่อให้จำได้ว่ากันไว้ทำไม' }
          ],
          onSubmit: function (v) {
            var errors = {};
            var label = String(v.label || '').trim();
            if (!label) errors.label = 'ต้องกรอกว่ามีอะไรอยู่ในคาบนี้ เพราะข้อความนี้จะแสดงบนตารางที่พิมพ์';
            if (v.scope !== 'SCHOOL' && !v.targetId) errors.targetId = 'ขอบเขตนี้ต้องระบุเป้าหมาย';
            if (Object.keys(errors).length) return { ok: false, errors: errors };

            var periodNo = U.num(v.periodNo);
            if (!M.periodByNo(st, v.day, periodNo)) {
              U.explainDialog({
                title: 'กันช่องนี้ไม่ได้',
                cause: 'วัน' + U.DAY_NAMES[v.day] + ' ไม่มีคาบ ' + periodNo + ' เพราะวันนั้นมีคาบน้อยกว่าวันอื่น',
                fix: 'ให้เลือกคาบอื่นในวันนั้น หรือไปเพิ่มจำนวนคาบของวันนั้นที่หน้าตั้งค่าโรงเรียน'
              });
              return { ok: false };
            }
            var checkTeacherId = v.scope === 'TEACHER' ? v.targetId : v.teacherId;
            if (checkTeacherId) {
              var t = U.byId(st.teachers, checkTeacherId);
              if (t && (t.availableDays || []).indexOf(v.day) === -1) {
                U.explainDialog({
                  title: 'กันช่องนี้ไม่ได้',
                  cause: 'ครู' + t.name + ' ไม่ได้มาสอนวัน' + U.DAY_NAMES[v.day] + ' จึงกันช่องของครูคนนี้ในวันนั้นไม่ได้',
                  fix: 'ให้เลือกวันอื่นที่ครูมาสอน หรือไปแก้วันที่มาสอนของครูในหน้าครูก่อน'
                });
                return { ok: false };
              }
            }
            var clash = st.lockedSlots.filter(function (l) {
              if (l.kind === 'SUBJECT') return false;
              if (lock && l.id === lock.id) return false;
              if (l.day !== v.day || U.num(l.periodNo) !== periodNo) return false;
              if (l.scope === 'SCHOOL' || v.scope === 'SCHOOL') return true;
              return l.scope === v.scope && l.targetId === v.targetId;
            })[0];
            if (clash) {
              U.explainDialog({
                title: 'กันช่องนี้ไม่ได้',
                cause: 'วัน' + U.DAY_NAMES[v.day] + ' คาบ ' + periodNo + ' ถูกกันไว้แล้วโดยรายการ "' +
                  clash.label + '" (' + SCOPE_LABEL[clash.scope] + ')',
                fix: 'ให้เลือกวันหรือคาบอื่น หรือไปแก้รายการเดิมแทนการสร้างรายการใหม่'
              });
              return { ok: false };
            }

            var target = lock || { id: U.uid('lk'), kind: 'BLOCK', createdAt: new Date().toISOString() };
            target.kind = 'BLOCK';
            target.assignmentId = '';
            target.scope = v.scope;
            target.targetId = v.scope === 'SCHOOL' ? '' : v.targetId;
            target.day = v.day;
            target.periodNo = periodNo;
            target.label = label;
            target.reason = v.reason;
            target.teacherId = v.teacherId;
            target.roomId = v.roomId;
            target.subjectId = '';
            target.updatedAt = new Date().toISOString();
            if (!lock) st.lockedSlots.push(target);

            /* เตือนเมื่อช่องที่เหลือไม่พอ */
            var newMaps = M.buildLockMaps(st);
            var short = [];
            st.classSections.forEach(function (sec) {
              var free = slots - Object.keys(newMaps.section[sec.id] || {}).length;
              var need = M.sectionWeeklyTotal(st, sec.id);
              if (need > free) short.push(sec.name + ' ขาด ' + (need - free) + ' ช่อง');
            });
            if (short.length) {
              U.toast('กันช่องไว้มากเกินไป มี ' + short.length + ' ห้องที่ช่องว่างไม่พอใส่คาบตามหลักสูตร เช่น ' +
                short.slice(0, 2).join(', '), 'danger', 10000);
            }
            app.saveAndRefresh('บันทึกช่องที่กันไว้แล้ว');
          }
        });
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
