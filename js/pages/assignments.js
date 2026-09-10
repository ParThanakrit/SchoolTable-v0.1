/* หน้า P8 — จัดครูผู้สอน (เลือกห้องก่อน แล้วจัดวิชาของห้องนั้นเป็นลิสต์) */
(function (global) {
  'use strict';
  var U = global.ST.util, M = global.ST.model, UI = global.ST.ui;
  global.ST.pages = global.ST.pages || {};

  var currentSectionId = '';
  var sectionTerm = '';
  var onlyIncomplete = false;
  var gradeFilter = '';
  var lastSaved = '';
  var lastSaveOk = true;

  global.ST.pages.assignments = {
    render: function (root, params) {
      var app = global.ST.app;
      var st = app.state();
      if (params && params.onlyIncomplete) { onlyIncomplete = true; delete params.onlyIncomplete; }
      M.syncAssignments(st);

      var total = st.assignments.length;
      var done = M.assignedCount(st);

      UI.pageHeader(root, {
        title: 'จัดครูผู้สอน',
        desc: 'เลือกชั้นเรียนทางซ้าย ระบบจะแสดงวิชาของห้องนั้นตามหลักสูตร แล้วเลือกครูผู้สอน ครูผู้สอนร่วม และห้องที่ใช้สอน',
        actions: [
          { label: '❓ ช่วยเหลือ', onClick: function () { global.ST.help.show('assignments'); } },
          { label: '📊 รายงานภาพรวมการจัด', onClick: function () { app.go('overview'); } },
          { label: 'กำหนดครูหลายห้อง', onClick: function () { bulkAssign(); } },
          { label: 'อัปเดตคาบจากหลักสูตร', onClick: function () { resync(); } },
          { label: '📥 นำเข้าจากไฟล์', onClick: function () { app.go('import', { kind: 'assignments' }); } }
        ]
      });

      var saveStatus = U.createSaveIndicator(root);

      root.appendChild(U.elFromHTML(
        '<div class="mobile-note result-card result-card--warning">' +
        '<div class="result-card__title">หน้านี้ควรใช้บนคอมพิวเตอร์</div>' +
        '<div class="result-card__line">การจัดครูผู้สอนมีตารางกว้างและต้องกรอกหลายช่อง ' +
        'บนมือถือจะกรอกลำบาก แนะนำให้เปิดหน้านี้บนคอมพิวเตอร์</div></div>'
      ));

      if (!total) {
        root.appendChild(UI.emptyState({
          icon: '🧑‍🏫', title: 'ยังไม่มีรายการที่ต้องจัดครู',
          desc: 'รายการจะถูกสร้างอัตโนมัติเมื่อชั้นเรียนแต่ละห้องเลือกหลักสูตรแล้ว',
          actions: [
            { label: 'ไปหน้าหลักสูตร', onClick: function () { app.go('curriculum'); } },
            { label: 'ไปหน้าชั้นเรียน', className: 'btn', onClick: function () { app.go('sections'); } }
          ]
        }));
        return;
      }

      /* ---------- แถบความคืบหน้า ---------- */
      var pct = Math.round((done / total) * 100);
      root.appendChild(U.elFromHTML(
        '<div class="card assignment-progress-card"><div class="assignment-progress-layout">' +
        '<div class="assignment-progress-main"><div class="progress"><div class="progress__fill" style="width:' + pct + '%"></div></div>' +
        '<div class="progress__text" id="asProgress">จัดครูแล้ว <b>' + U.fmtNum(done) + '</b> จาก <b>' + U.fmtNum(total) +
        '</b> รายการ (' + pct + '%)</div></div>' +
        (done < total ? '<span class="badge badge--danger">ยังขาด ' + U.fmtNum(total - done) + ' รายการ</span>'
          : '<span class="badge badge--success">ครบทุกรายการแล้ว</span>') +
        '</div></div>'
      ));

      var sectionById = U.indexById(st.classSections);
      var subjectById = U.indexById(st.subjects);
      var gradeById = U.indexById(st.gradeLevels);

      var withCurriculum = st.classSections.filter(function (s) {
        return s.curriculumId && M.effectiveCurriculum(st, s.id).length;
      }).sort(function (a, b) {
        var d = U.num((gradeById[a.gradeLevelId] || {}).order) - U.num((gradeById[b.gradeLevelId] || {}).order);
        return d !== 0 ? d : String(a.name).localeCompare(String(b.name), 'th', { numeric: true });
      });

      if (!currentSectionId || !sectionById[currentSectionId]) {
        currentSectionId = withCurriculum.length ? withCurriculum[0].id : '';
      }

      function sectionProgress(sec) {
        var list = M.assignmentsOfSection(st, sec.id);
        var ok = list.filter(function (a) { return !!a.teacherId; }).length;
        return { total: list.length, done: ok };
      }

      /* ---------- แถบเลือกชั้นเรียน (แนวนอน เลือกห้องได้) ---------- */
      var left = U.elFromHTML('<div class="card section-picker">' +
        '<div class="section-picker__head"><div class="card__title">เลือกชั้นเรียน</div>' +
        '<div class="small muted">เลือกห้องเพื่อกำหนดครูผู้สอน</div></div>' +
        '<div class="section-picker__tools">' +
        '<label class="field__label section-picker__label" for="secGrade">ระดับชั้น</label>' +
        '<select class="select" id="secGrade"><option value="">ทุกระดับชั้น</option>' + st.gradeLevels.map(function (g) { return '<option value="' + U.esc(g.id) + '"' + (g.id === gradeFilter ? ' selected' : '') + '>' + U.esc(g.name) + '</option>'; }).join('') + '</select>' +
        '<input type="search" class="input" id="secSearch" placeholder="ค้นหาชั้นเรียน…" value="' + U.esc(sectionTerm) + '">' +
        '<label class="checkline"><input type="checkbox" id="secOnly"' + (onlyIncomplete ? ' checked' : '') +
        '><span>เฉพาะห้องที่ยังจัดครูไม่ครบ</span></label>' +
        '</div>' +
        '<div class="picklist" id="secList"></div></div>');
      var right = document.createElement('div');
      root.appendChild(left);
      root.appendChild(right);

      var secList = left.querySelector('#secList');
      var secSearch = left.querySelector('#secSearch');
      var secOnly = left.querySelector('#secOnly');

      function paintSectionList() {
        var term = sectionTerm.trim().toLowerCase();
        var list = withCurriculum.filter(function (s) {
          if (gradeFilter && s.gradeLevelId !== gradeFilter) return false;
          if (term && s.name.toLowerCase().indexOf(term) === -1) return false;
          if (onlyIncomplete) {
            var p = sectionProgress(s);
            if (p.done >= p.total) return false;
          }
          return true;
        });
        if (!list.length) {
          secList.innerHTML = '<div class="muted" style="padding:14px">ไม่พบชั้นเรียนที่ตรงกับเงื่อนไข ' +
            'ลองล้างคำค้นหรือเอาเครื่องหมายถูกด้านบนออก</div>';
          return;
        }
        secList.innerHTML = list.map(function (s) {
          var p = sectionProgress(s);
          var complete = p.total > 0 && p.done === p.total;
          return '<button type="button" class="pickitem' + (s.id === currentSectionId ? ' is-active' : '') +
            '" data-sec="' + s.id + '">' +
            '<span class="pickitem__name">' + U.esc(s.name) + '</span>' +
            '<span class="pickitem__meta ' + (complete ? 'is-ok' : 'is-todo') + '">' +
            p.done + '/' + p.total + '</span></button>';
        }).join('');
      }

      U.on(secList, 'click', '.pickitem', function (ev, btn) {
        currentSectionId = btn.dataset.sec;
        paintSectionList();
        paintDetail();
      });
      left.querySelector('#secGrade').addEventListener('change', function (ev) {
        gradeFilter = ev.target.value;
        var first = withCurriculum.filter(function (s) { return !gradeFilter || s.gradeLevelId === gradeFilter; })[0];
        if (first) currentSectionId = first.id;
        paintSectionList(); paintDetail();
      });
      secSearch.addEventListener('input', function (ev) { sectionTerm = ev.target.value; paintSectionList(); });
      secOnly.addEventListener('change', function (ev) { onlyIncomplete = ev.target.checked; paintSectionList(); });

      /* ---------- คอลัมน์ขวา: วิชาของห้องที่เลือก ---------- */
      var teacherOptionsHtml = '<option value="">— ยังไม่ได้เลือก —</option>' +
        U.sortThai(st.teachers, function (t) { return t.name; }).map(function (t) {
          var g = U.byId(st.subjectGroups, t.subjectGroupId);
          return '<option value="' + t.id + '">' + U.esc(t.name) + (g ? ' — ' + U.esc(g.name) : '') + '</option>';
        }).join('');

      function roomOptionsFor(subject) {
        function opt(r) {
          return '<option value="' + r.id + '">' + U.esc(r.name) + ' — ชั้น ' + U.num(r.floor) + '</option>';
        }
        var html = '<option value="">— ให้ระบบเลือกห้องให้ —</option>';
        st.buildings.forEach(function (b) {
          var inB = U.sortThai(st.rooms.filter(function (r) { return r.buildingId === b.id; }), function (r) { return r.name; });
          if (inB.length) html += '<optgroup label="' + U.esc(b.name) + '">' + inB.map(opt).join('') + '</optgroup>';
        });
        var noB = st.rooms.filter(function (r) { return !U.byId(st.buildings, r.buildingId); });
        if (noB.length) html += '<optgroup label="ไม่ระบุอาคาร">' + noB.map(opt).join('') + '</optgroup>';
        return html;
      }

      function paintDetail() {
        right.innerHTML = '';
        if (!currentSectionId) {
          right.appendChild(UI.emptyState({
            icon: '📚', title: 'ยังไม่มีชั้นเรียนที่เลือกหลักสูตรไว้',
            desc: 'ต้องเลือกหลักสูตรให้ชั้นเรียนก่อน จึงจะมีรายวิชาให้จัดครูผู้สอน',
            actions: [{ label: 'ไปหน้าหลักสูตร', onClick: function () { app.go('curriculum'); } }]
          }));
          return;
        }
        var sec = sectionById[currentSectionId];
        var cur = U.byId(st.curricula, sec.curriculumId);
        var room = U.byId(st.rooms, sec.homeRoomId);
        var list = M.assignmentsOfSection(st, sec.id).sort(function (x, y) {
          var sx = subjectById[x.subjectId], sy = subjectById[y.subjectId];
          if (!sx || !sy) return 0;
          if (sx.subjectGroupId !== sy.subjectGroupId) {
            var ix = st.subjectGroups.map(function (g) { return g.id; }).indexOf(sx.subjectGroupId);
            var iy = st.subjectGroups.map(function (g) { return g.id; }).indexOf(sy.subjectGroupId);
            return ix - iy;
          }
          return String(sx.code).localeCompare(String(sy.code), 'th');
        });
        var p = sectionProgress(sec);
        var weekly = M.sectionWeeklyTotal(st, sec.id);
        var slots = M.slotsPerWeek(st);

        var card = U.elFromHTML('<div class="card">' +
          '<div class="card__title">' + U.esc(sec.name) +
          (p.done === p.total ? ' <span class="badge badge--success">จัดครูครบแล้ว</span>'
            : ' <span class="badge badge--danger">ยังขาด ' + (p.total - p.done) + ' วิชา</span>') + '</div>' +
          '<div class="card__desc">หลักสูตร: <b>' + U.esc(cur ? cur.name : 'ยังไม่ได้เลือก') + '</b> · ' +
          'ห้องประจำ: ' + U.esc(room ? room.name : 'ยังไม่ได้เลือก') + ' · ' +
          'รวม ' + weekly + ' คาบ จากช่องที่มี ' + slots + ' ช่องต่อสัปดาห์</div>' +
          '<div class="save-indicator" id="asSaved" role="status">' + U.esc(lastSaved || 'เลือกครูแล้วบันทึกอัตโนมัติในเครื่องนี้') + '</div>' +
          '<div class="table-wrap assignment-table-wrap"><table class="data" id="asTable"></table></div>' +
          '<div class="flex gap-8 mt-8 no-print">' +
          '<button type="button" class="btn btn--sm" id="copyFrom">คัดลอกครูจากห้องอื่น</button>' +
          '<button type="button" class="btn btn--sm" id="clearAll">ล้างครูของห้องนี้ทั้งหมด</button>' +
          '</div></div>');
        var table = card.querySelector('#asTable');

        table.innerHTML = '<thead><tr>' +
          '<th>วิชา</th><th class="num">คาบ / สัปดาห์</th>' +
          '<th>ครูผู้สอน</th><th>ห้องที่ใช้สอน</th></tr></thead><tbody>' +
          (list.length ? list.map(function (a) {
            var sub = subjectById[a.subjectId];
            var grp = U.byId(st.subjectGroups, sub.subjectGroupId);
            return '<tr data-id="' + a.id + '"' + (a.teacherId ? '' : ' class="is-todo"') + '>' +
              '<td><div class="subj-cell" title="' + U.esc((grp ? grp.name + ' · ' : '') + sub.code + ' ' + sub.name) + '">' +
              '<span class="dot" style="background:' + U.esc((grp && grp.color) || '#94a3b8') + '"></span>' +
              '<span class="subj-cell__name"><b>' + U.esc(sub.code) + '</b> ' + U.esc(sub.name) + '</span>' +
              (sub.doubleMode !== 'NONE' ? '<span class="badge badge--warning">คาบคู่</span>' : '') +
              (sub.isElective ? '<span class="badge badge--locked">เลือกเสรี</span>' : '') +
              '</div></td>' +
              '<td class="num">' + U.num(a.periodsPerWeek) + '</td>' +
              '<td><div class="teacher-cell">' +
              '<select class="select" data-f="teacherId">' + teacherOptionsHtml + '</select>' +
              '<details class="co-teacher"><summary>+ ครูร่วม</summary>' +
              '<select class="select" data-f="coTeacherId">' + teacherOptionsHtml + '</select></details>' +
              '</div></td>' +
              '<td><select class="select" data-f="roomId">' + roomOptionsFor(sub) + '</select></td></tr>';
          }).join('')
            : '<tr><td colspan="4" class="muted" style="padding:18px">หลักสูตรของห้องนี้ยังไม่มีรายวิชา ' +
            'ให้ไปใส่รายวิชาและจำนวนคาบที่หน้าหลักสูตร</td></tr>') +
          '</tbody>';

        list.forEach(function (a) {
          var tr = table.querySelector('tr[data-id="' + a.id + '"]');
          if (!tr) return;
          tr.querySelector('[data-f="teacherId"]').value = a.teacherId || '';
          tr.querySelector('[data-f="coTeacherId"]').value = a.coTeacherId || '';
          tr.querySelector('[data-f="roomId"]').value = a.roomId || '';
          ['teacherId', 'coTeacherId'].forEach(function (f) {
            global.ST.ux.teacherPicker(tr.querySelector('[data-f="' + f + '"]'), st, a, subjectById[a.subjectId], f === 'teacherId' ? 'เลือกครูผู้สอน' : 'เลือกครูร่วม');
          });
          tr.querySelector('[data-f="roomId"]').setAttribute('aria-label', 'ห้องที่ใช้สอน วิชา' + subjectById[a.subjectId].name);
        });

        U.on(table, 'change', 'select[data-f]', function (ev, select) {
          var tr = select.closest('tr');
          var a = U.byId(st.assignments, tr.dataset.id);
          var field = select.dataset.f;
          var value = select.value;

          if (field === 'coTeacherId' && value && value === a.teacherId) {
            select.value = a.coTeacherId || '';
            U.explainDialog({
              title: 'เลือกครูผู้สอนร่วมคนนี้ไม่ได้',
              cause: 'ครูผู้สอนร่วมเป็นคนเดียวกับครูผู้สอนหลัก ซึ่งไม่มีความหมาย เพราะครูคนเดียวสอนได้ทีละที่อยู่แล้ว',
              fix: 'ให้เลือกครูคนอื่นเป็นครูผู้สอนร่วม หรือเว้นว่างไว้ถ้าไม่มีการสอนร่วม'
            });
            return;
          }
          if (field === 'teacherId' && value && value === a.coTeacherId) {
            a.coTeacherId = '';
            tr.querySelector('[data-f="coTeacherId"]').value = '';
            U.toast('ล้างครูผู้สอนร่วมออก เพราะซ้ำกับครูผู้สอนหลักที่เพิ่งเลือก', 'warning');
          }
          a[field] = value;
          a.updatedAt = new Date().toISOString();
          commit(tr, a);
        });

        card.querySelector('#clearAll').addEventListener('click', function () {
          U.confirmDialog({
            title: 'ล้างครูผู้สอนของห้องนี้',
            message: 'ต้องการล้างครูผู้สอนและครูผู้สอนร่วมของ ' + sec.name + ' ทุกวิชาใช่หรือไม่',
            hint: 'ข้อมูลหลักสูตรและจำนวนคาบยังอยู่ครบ ล้างเฉพาะชื่อครู',
            confirmText: 'ล้างครูผู้สอน', danger: true
          }).then(function (ok) {
            if (!ok) return;
            M.assignmentsOfSection(st, sec.id).forEach(function (a) {
              a.teacherId = ''; a.coTeacherId = '';
            });
            app.saveAndRefresh('ล้างครูผู้สอนของ ' + sec.name + ' แล้ว');
          });
        });
        card.querySelector('#copyFrom').addEventListener('click', function () { copyFrom(sec); });

        right.appendChild(card);
        right.appendChild(workloadCard());
      }

      function commit(tr, a) {
        lastSaveOk = global.ST.store.save();
        if (lastSaveOk) {
          saveStatus.success('บันทึกแล้ว');
        } else {
          saveStatus.error('บันทึกไม่สำเร็จ กรุณาสำรองข้อมูล');
        }
        lastSaved = lastSaveOk ? 'บันทึกแล้วในเครื่องนี้ · ' + new Date().toLocaleTimeString('th-TH', {hour:'2-digit',minute:'2-digit'}) : 'บันทึกไม่สำเร็จ · กรุณาสำรองข้อมูลก่อนปิดหน้า';
        var savedLabel = right.querySelector('#asSaved');
        savedLabel.textContent = lastSaved;
        savedLabel.style.color = lastSaveOk ? 'var(--success)' : 'var(--danger)';
        var doneNow = M.assignedCount(st), totalNow = st.assignments.length;
        var progress = root.querySelector('#asProgress');
        progress.textContent = 'จัดครูแล้ว ' + U.fmtNum(doneNow) + ' จาก ' + U.fmtNum(totalNow) + ' รายการ (' + Math.round(doneNow / totalNow * 100) + '%)';
        root.querySelector('.progress__fill').style.width = (doneNow / totalNow * 100) + '%';
        var progressBadge = progress.parentElement.parentElement.querySelector('.badge');
        progressBadge.className = 'badge ' + (doneNow === totalNow ? 'badge--success' : 'badge--danger');
        progressBadge.textContent = doneNow === totalNow ? 'ครบทุกรายการแล้ว' : 'ยังขาด ' + U.fmtNum(totalNow - doneNow) + ' รายการ';
        var sectionStatus = right.querySelector('.card__title .badge'), sectionNow = sectionProgress(sectionById[currentSectionId]);
        sectionStatus.className = 'badge ' + (sectionNow.done === sectionNow.total ? 'badge--success' : 'badge--danger');
        sectionStatus.textContent = sectionNow.done === sectionNow.total ? 'จัดครูครบแล้ว' : 'ยังขาด ' + (sectionNow.total - sectionNow.done) + ' วิชา';
        U.qsa('select[data-f]', right).forEach(function (sel) { if (sel._refreshPicker) sel._refreshPicker(); });
        tr.classList.toggle('is-todo', !a.teacherId);
        paintSectionList();
        refreshWorkload();
        checkTeacherFeasibility(a);
      }

      function checkTeacherFeasibility(a) {
        var loadNow = M.teacherAssignedLoad(st);
        [a.teacherId, a.coTeacherId].forEach(function (tid) {
          if (!tid) return;
          var t = U.byId(st.teachers, tid);
          if (!t) return;
          if (loadNow[tid] > U.num(t.maxPeriodsPerWeek)) {
            U.toast('ครู' + t.name + ' ถูกมอบหมาย ' + loadNow[tid] + ' คาบ เกินโควตา ' +
              t.maxPeriodsPerWeek + ' คาบต่อสัปดาห์ ให้เพิ่มโควตาที่หน้าครู หรือเปลี่ยนไปใช้ครูคนอื่น', 'danger', 9000);
            return;
          }
          var capacity = (t.availableDays || []).reduce(function (sum, d) {
            return sum + Math.min(U.num(t.maxPeriodsPerDay), M.teachingPeriodNos(st, d).length);
          }, 0);
          if (loadNow[tid] > capacity) {
            U.toast('ครู' + t.name + ' มาสอน ' + (t.availableDays || []).length + ' วัน วันละไม่เกิน ' +
              t.maxPeriodsPerDay + ' คาบ รองรับได้ ' + capacity + ' คาบ แต่ถูกมอบหมาย ' +
              loadNow[tid] + ' คาบ ขาดอีก ' + (loadNow[tid] - capacity) + ' คาบ', 'warning', 9000);
          }
        });
      }

      /* ---------- แผงภาระงานครู ---------- */
      var wlTerm = '';
      var wlHost = null;
      function workloadCard() {
        var node = U.elFromHTML('<div class="card"><div class="card__title">ภาระงานครู</div>' +
          '<div class="card__desc">อัปเดตทันทีที่เลือกครู · แถบสีแดงคือเกินโควตาคาบต่อสัปดาห์</div>' +
          '<input type="search" class="input mb-8" id="wlSearch" placeholder="ค้นหาชื่อครู…" value="' + U.esc(wlTerm) + '">' +
          '<div class="scroll-y" id="wlList"></div></div>');
        wlHost = node.querySelector('#wlList');
        var search = node.querySelector('#wlSearch');
        search.addEventListener('input', function (ev) { wlTerm = ev.target.value; refreshWorkload(); });
        refreshWorkload();
        return node;
      }

      function refreshWorkload() {
        if (!wlHost) return;
        var loadNow = M.teacherAssignedLoad(st);
        var term = wlTerm.trim().toLowerCase();
        var list = st.teachers.filter(function (t) {
          return !term || t.name.toLowerCase().indexOf(term) !== -1;
        }).sort(function (a, b) {
          return ((loadNow[b.id] || 0) - U.num(b.maxPeriodsPerWeek)) -
            ((loadNow[a.id] || 0) - U.num(a.maxPeriodsPerWeek));
        });
        wlHost.innerHTML = '<table class="data"><tbody>' + list.slice(0, 200).map(function (t) {
          return '<tr><td>' + U.esc(t.name) + '<div class="small muted">' +
            UI.dayChips(t.availableDays, st.periodConfig.days) + '</div></td>' +
            '<td>' + UI.workloadBar(loadNow[t.id] || 0, U.num(t.maxPeriodsPerWeek)) + '</td></tr>';
        }).join('') + '</tbody></table>';
      }

      paintSectionList();
      paintDetail();

      /* ---------- คัดลอกครูจากห้องอื่น ---------- */
      function copyFrom(sec) {
        var sources = withCurriculum.filter(function (s) {
          return s.id !== sec.id && s.curriculumId === sec.curriculumId;
        });
        if (!sources.length) {
          U.explainDialog({
            title: 'คัดลอกครูไม่ได้',
            cause: 'ยังไม่มีห้องอื่นที่ใช้หลักสูตรชุดเดียวกับ ' + sec.name + ' จึงไม่มีต้นแบบให้คัดลอก',
            fix: 'ให้เลือกหลักสูตรชุดเดียวกันให้ห้องอื่นก่อน หรือเลือกครูทีละวิชาในตารางนี้'
          });
          return;
        }
        UI.formModal({
          title: 'คัดลอกครูจากห้องอื่น',
          values: { fromId: sources[0].id, onlyEmpty: true },
          fields: [
            {
              name: 'fromId', label: 'คัดลอกจากห้อง', type: 'select',
              options: sources.map(function (s) { return { value: s.id, label: s.name }; }),
              hint: 'แสดงเฉพาะห้องที่ใช้หลักสูตรชุดเดียวกัน จึงมีรายวิชาตรงกัน'
            },
            {
              name: 'onlyEmpty', label: '', type: 'checkbox',
              checkLabel: 'ใส่เฉพาะวิชาที่ยังไม่ได้เลือกครู (ไม่ทับของเดิม)'
            }
          ],
          submitLabel: 'คัดลอกครู',
          onSubmit: function (v) {
            var src = {};
            M.assignmentsOfSection(st, v.fromId).forEach(function (a) { src[a.subjectId] = a; });
            var count = 0;
            M.assignmentsOfSection(st, sec.id).forEach(function (a) {
              var from = src[a.subjectId];
              if (!from || !from.teacherId) return;
              if (v.onlyEmpty && a.teacherId) return;
              a.teacherId = from.teacherId;
              a.coTeacherId = from.coTeacherId || '';
              count++;
            });
            app.saveAndRefresh('คัดลอกครูมา ' + count + ' วิชาแล้ว — ตรวจดูว่าครูไม่ชนกันก่อนจัดตาราง');
          }
        });
      }

      /* ---------- กรอกครูให้ทุกห้องของวิชาเดียวกัน ---------- */
      function bulkAssign() {
        var grades = st.gradeLevels.slice().sort(function (a, b) { return U.num(a.order) - U.num(b.order); });
        UI.formModal({
          title: 'กรอกครูให้ทุกห้องของวิชาเดียวกัน',
          values: { subjectId: st.subjects.length ? st.subjects[0].id : '', gradeLevelId: '', teacherId: '', onlyEmpty: true },
          fields: [
            {
              name: 'subjectId', label: 'วิชา', type: 'select',
              options: U.sortThai(st.subjects, function (s) { return s.name; }).map(function (s) {
                return { value: s.id, label: s.code + ' ' + s.name };
              })
            },
            {
              name: 'gradeLevelId', label: 'เฉพาะระดับชั้น', type: 'select',
              options: [{ value: '', label: 'ทุกระดับชั้น' }].concat(grades.map(function (g) {
                return { value: g.id, label: g.name };
              }))
            },
            {
              name: 'teacherId', label: 'ครูผู้สอน', type: 'select',
              options: [{ value: '', label: '— เลือกครู —' }].concat(
                U.sortThai(st.teachers, function (t) { return t.name; }).map(function (t) {
                  return { value: t.id, label: t.name };
                }))
            },
            {
              name: 'onlyEmpty', label: 'เฉพาะรายการที่ยังไม่จัดครู', type: 'checkbox',
              checkLabel: 'ใส่เฉพาะรายการที่ยังไม่ได้เลือกครู (ไม่ทับของเดิม)'
            }
          ],
          submitLabel: 'กรอกให้ทุกห้อง',
          onSubmit: function (v) {
            if (!v.teacherId) return { ok: false, errors: { teacherId: 'ต้องเลือกครูผู้สอนก่อน จึงจะกรอกให้ทุกห้องได้' } };
            var count = 0;
            st.assignments.forEach(function (a) {
              if (a.subjectId !== v.subjectId) return;
              var sec = sectionById[a.classSectionId];
              if (!sec) return;
              if (v.gradeLevelId && sec.gradeLevelId !== v.gradeLevelId) return;
              if (v.onlyEmpty && a.teacherId) return;
              if (a.coTeacherId === v.teacherId) a.coTeacherId = '';
              a.teacherId = v.teacherId;
              count++;
            });
            app.saveAndRefresh('กรอกครูผู้สอนให้ ' + count + ' รายการแล้ว');
          }
        });
      }

      function resync() {
        M.syncAssignments(st);
        app.saveAndRefresh('ปรับจำนวนคาบของทุกรายการให้ตรงกับหลักสูตรแล้ว');
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
