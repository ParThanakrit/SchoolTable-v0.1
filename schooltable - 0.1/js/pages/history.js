/* หน้า P14 — ประวัติตาราง (ร่าง / ประกาศใช้ / ประวัติ / เปรียบเทียบ) */
(function (global) {
  'use strict';
  var U = global.ST.util, M = global.ST.model, UI = global.ST.ui;
  global.ST.pages = global.ST.pages || {};

  var compare = { a: '', b: '' };

  function createDraftFrom(sourceId) {
    var app = global.ST.app;
    var st = app.state();
    var source = U.byId(st.timetables, sourceId);
    if (!source) return;
    var existingDraft = M.currentSemesterTimetables(st).filter(function (t) { return t.status === 'DRAFT'; })[0];
    var ask = existingDraft ? U.confirmDialog({
      title: 'มีตารางฉบับร่างอยู่แล้ว',
      message: 'ภาคเรียนนี้มีฉบับร่าง "' + existingDraft.name + '" อยู่แล้ว การสร้างร่างใหม่จะเขียนทับร่างเดิม',
      detail: '<b>ผลที่จะเกิดขึ้น</b><br>เนื้อหาในร่างเดิมจะถูกแทนที่ด้วยสำเนาของ "' + U.esc(source.name) + '"',
      confirmText: 'สร้างร่างใหม่ทับ', danger: true
    }) : Promise.resolve(true);

    ask.then(function (ok) {
      if (!ok) return;
      var target = existingDraft;
      if (!target) {
        target = {
          id: U.uid('tt'),
          academicYear: st.school.academicYear,
          semester: st.school.semester,
          status: 'DRAFT',
          name: 'ร่างจาก ' + source.name,
          createdAt: new Date().toISOString()
        };
        st.timetables.push(target);
      } else {
        target.name = 'ร่างจาก ' + source.name;
      }
      target.sourceTimetableId = source.id;
      target.entries = U.deepClone(source.entries).map(function (e) {
        e.id = U.uid('en');
        return e;
      });
      target.issues = U.deepClone(source.issues);
      target.stats = U.deepClone(source.stats);
      target.generatedAt = new Date().toISOString();
      target.publishedAt = '';
      st.activeTimetableId = target.id;
      app.saveAndRefresh('สร้างร่างใหม่จากตารางนี้แล้ว แก้ไขได้ทันที');
      app.go('timetable');
    });
  }

  global.ST.pages.history = {
    createDraftFrom: createDraftFrom,
    render: function (root) {
      var app = global.ST.app;
      var st = app.state();
      var list = st.timetables.slice().sort(function (a, b) {
        return new Date(b.generatedAt || b.createdAt || 0) - new Date(a.generatedAt || a.createdAt || 0);
      });

      UI.pageHeader(root, {
        title: 'ประวัติตาราง',
        desc: 'จัดการสถานะฉบับร่างและฉบับประกาศใช้ เก็บประวัติย้อนหลัง และเปรียบเทียบสองเวอร์ชัน'
      });

      if (!list.length) {
        root.appendChild(UI.emptyState({
          icon: '🗂', title: 'ยังไม่มีตารางในระบบ',
          desc: 'เมื่อกดจัดตารางอัตโนมัติแล้ว ตารางจะถูกบันทึกเป็นฉบับร่างและแสดงที่นี่',
          actions: [{ label: 'จัดตารางอัตโนมัติ', onClick: function () { app.go('generate'); } }]
        }));
        return;
      }

      root.appendChild(U.elFromHTML('<div class="card small">' +
        '<b>กฎการใช้งาน</b> · หนึ่งภาคเรียนมีตารางที่ประกาศใช้ได้ทีละ 1 ชุดเท่านั้น · ' +
        'ตารางที่ประกาศใช้แล้วและตารางที่เป็นประวัติ แก้ไขและลบไม่ได้ ต้องสร้างร่างใหม่จากตารางนั้นก่อน</div>'));

      var card = U.elFromHTML('<div class="card"><div class="card__title">เวอร์ชันทั้งหมด</div>' +
        '<div class="table-wrap"><table class="data"><thead><tr>' +
        '<th>ชื่อ</th><th>ภาคเรียน</th><th>สถานะ</th><th>วันที่จัด</th>' +
        '<th class="num">คาบ</th><th class="num">ปัญหา</th><th>การกระทำ</th></tr></thead><tbody id="ttBody"></tbody></table></div></div>');
      var body = card.querySelector('#ttBody');
      body.innerHTML = list.map(function (t) {
        var pct = t.stats.totalRequired ? Math.round((t.stats.placed / t.stats.totalRequired) * 1000) / 10 : 0;
        return '<tr><td><b>' + U.esc(t.name) + '</b>' +
          (t.id === st.activeTimetableId ? ' <span class="badge badge--info">กำลังดูอยู่</span>' : '') + '</td>' +
          '<td>' + t.semester + '/' + t.academicYear + '</td>' +
          '<td>' + UI.statusBadge(t.status) + '</td>' +
          '<td>' + U.esc(t.generatedAt ? U.thaiDateTime(t.generatedAt) : '-') + '</td>' +
          '<td class="num">' + U.fmtNum(t.stats.placed) + '/' + U.fmtNum(t.stats.totalRequired) +
          '<div class="small muted">' + pct + '%</div></td>' +
          '<td class="num">' + (t.stats.unplaced ? '<span class="text-danger">ค้าง ' + U.fmtNum(t.stats.unplaced) + '</span>'
            : '<span class="text-success">ครบ</span>') +
          '<div class="small muted">กฎรอง ' + U.fmtNum(t.stats.softViolations || 0) + '</div></td>' +
          '<td><div class="row-actions">' +
          '<button type="button" class="btn btn--sm" data-act="open" data-id="' + t.id + '">เปิดดู</button>' +
          (t.status === 'DRAFT'
            ? '<button type="button" class="btn btn--sm btn--primary" data-act="publish" data-id="' + t.id + '">ประกาศใช้</button>' +
            '<button type="button" class="btn btn--sm" data-act="delete" data-id="' + t.id + '">ลบร่าง</button>'
            : '<button type="button" class="btn btn--sm" data-act="draft" data-id="' + t.id + '">สร้างร่างใหม่จากตารางนี้</button>') +
          (t.status !== 'DRAFT' ? '<button type="button" class="btn btn--sm" data-act="copy" data-id="' + t.id + '">คัดลอกไปภาคเรียนใหม่</button>' : '') +
          '</div></td></tr>';
      }).join('');
      root.appendChild(card);

      U.on(body, 'click', 'button[data-act="open"]', function (ev, btn) {
        st.activeTimetableId = btn.dataset.id;
        global.ST.store.save();
        app.go('timetable');
      });
      U.on(body, 'click', 'button[data-act="draft"]', function (ev, btn) { createDraftFrom(btn.dataset.id); });
      U.on(body, 'click', 'button[data-act="publish"]', function (ev, btn) { publish(btn.dataset.id); });
      U.on(body, 'click', 'button[data-act="delete"]', function (ev, btn) { removeDraft(btn.dataset.id); });
      U.on(body, 'click', 'button[data-act="copy"]', function (ev, btn) { copyToNextTerm(btn.dataset.id); });

      /* ---------- เปรียบเทียบ ---------- */
      var cmp = U.elFromHTML('<div class="card"><div class="card__title">เปรียบเทียบ 2 เวอร์ชัน</div>' +
        '<div class="card__desc">เลือกตาราง 2 ชุดเพื่อดูว่าคาบใดเพิ่ม ลด หรือย้ายที่</div>' +
        '<div class="table-tools">' +
        '<select class="select" id="cmpA"></select><span>เทียบกับ</span><select class="select" id="cmpB"></select>' +
        '<button type="button" class="btn btn--primary" id="cmpGo">เปรียบเทียบ</button></div>' +
        '<div id="cmpResult"></div></div>');
      root.appendChild(cmp);
      var optionsHtml = list.map(function (t) {
        return '<option value="' + t.id + '">' + U.esc(t.name) + ' — ' + M.statusLabel(t.status) + '</option>';
      }).join('');
      cmp.querySelector('#cmpA').innerHTML = optionsHtml;
      cmp.querySelector('#cmpB').innerHTML = optionsHtml;
      if (list.length > 1) cmp.querySelector('#cmpB').selectedIndex = 1;
      cmp.querySelector('#cmpGo').addEventListener('click', function () {
        doCompare(cmp.querySelector('#cmpA').value, cmp.querySelector('#cmpB').value, cmp.querySelector('#cmpResult'));
      });

      function doCompare(aId, bId, host) {
        var A = U.byId(st.timetables, aId), B = U.byId(st.timetables, bId);
        if (!A || !B || A === B) {
          host.innerHTML = '<p class="text-danger">ต้องเลือกตารางคนละชุดจึงจะเปรียบเทียบได้</p>';
          return;
        }
        var subjectById = U.indexById(st.subjects);
        var sectionById = U.indexById(st.classSections);
        var assignmentById = U.indexById(st.assignments);
        function mapOf(tt) {
          var m = {};
          tt.entries.forEach(function (e) {
            var a = assignmentById[e.assignmentId];
            if (!a) return;
            var k = a.classSectionId + '|' + a.subjectId + '|' + e.day + '#' + e.periodNo;
            m[k] = e;
          });
          return m;
        }
        var ma = mapOf(A), mb = mapOf(B);
        var rows = [];
        Object.keys(ma).forEach(function (k) {
          if (!mb[k]) rows.push({ kind: 'removed', key: k });
        });
        Object.keys(mb).forEach(function (k) {
          if (!ma[k]) rows.push({ kind: 'added', key: k });
        });
        if (!rows.length) {
          host.innerHTML = '<p class="text-success mt-8">ตารางสองชุดนี้เหมือนกันทุกคาบ ไม่มีอะไรเปลี่ยน</p>';
          return;
        }
        host.innerHTML = '<div class="mt-8"><b>พบความแตกต่าง ' + U.fmtNum(rows.length) + ' จุด</b> ' +
          '(มีใน "' + U.esc(A.name) + '" แต่ไม่มีใน "' + U.esc(B.name) + '" และกลับกัน)</div>' +
          '<div class="table-wrap mt-8"><table class="data"><thead><tr>' +
          '<th>ชั้นเรียน</th><th>วิชา</th><th>เวลา</th><th>สถานะการเปลี่ยน</th></tr></thead><tbody>' +
          rows.slice(0, 300).map(function (r) {
            var parts = r.key.split('|');
            var sec = sectionById[parts[0]];
            var sub = subjectById[parts[1]];
            var when = parts[2].split('#');
            return '<tr><td>' + U.esc(sec ? sec.name : '-') + '</td>' +
              '<td>' + U.esc(sub ? sub.name : '-') + '</td>' +
              '<td>วัน' + U.DAY_NAMES[when[0]] + ' คาบ ' + when[1] + '</td>' +
              '<td>' + (r.kind === 'removed'
                ? '<span class="badge badge--danger">มีเฉพาะใน ' + U.esc(A.name) + '</span>'
                : '<span class="badge badge--success">มีเฉพาะใน ' + U.esc(B.name) + '</span>') + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
          (rows.length > 300 ? '<div class="small muted mt-8">แสดง 300 จุดแรก</div>' : '');
      }

      /* ---------- การกระทำ ---------- */
      function publish(id) { global.ST.ux.publishTimetable(st, U.byId(st.timetables, id)); }

      function removeDraft(id) {
        var tt = U.byId(st.timetables, id);
        if (tt.status !== 'DRAFT') {
          U.explainDialog({
            title: 'ลบตารางนี้ไม่ได้',
            cause: 'ตารางที่ประกาศใช้แล้วหรือที่เป็นประวัติ ลบไม่ได้ เพราะเป็นหลักฐานของตารางที่เคยใช้จริง',
            fix: 'ลบได้เฉพาะตารางฉบับร่างเท่านั้น'
          });
          return;
        }
        U.confirmDialog({
          title: 'ลบตารางฉบับร่าง',
          message: 'ลบร่าง "' + tt.name + '" ใช่หรือไม่',
          detail: '<b>ผลที่จะเกิดขึ้น</b><br>คาบทั้งหมดในร่างนี้จะหายไป และกู้คืนไม่ได้',
          confirmText: 'ลบร่าง', danger: true
        }).then(function (ok) {
          if (!ok) return;
          st.timetables = st.timetables.filter(function (t) { return t.id !== id; });
          if (st.activeTimetableId === id) {
            st.activeTimetableId = st.timetables.length ? st.timetables[0].id : null;
          }
          app.saveAndRefresh('ลบตารางฉบับร่างแล้ว');
        });
      }

      function copyToNextTerm(id) {
        var source = U.byId(st.timetables, id);
        var nextSem = source.semester === 1 ? 2 : 1;
        var nextYear = source.semester === 1 ? source.academicYear : source.academicYear + 1;
        U.confirmDialog({
          title: 'คัดลอกไปภาคเรียนใหม่',
          message: 'สร้างตารางฉบับร่างของภาคเรียนที่ ' + nextSem + ' ปีการศึกษา ' + nextYear +
            ' โดยใช้ "' + source.name + '" เป็นจุดตั้งต้น',
          detail: '<b>ผลที่จะเกิดขึ้น</b><br>จะได้ร่างใหม่ที่มีคาบเหมือนต้นฉบับทุกประการ แก้ไขต่อได้',
          confirmText: 'คัดลอก'
        }).then(function (ok) {
          if (!ok) return;
          var copy = {
            id: U.uid('tt'), academicYear: nextYear, semester: nextSem, status: 'DRAFT',
            name: 'ร่างภาคเรียนที่ ' + nextSem + '/' + nextYear,
            sourceTimetableId: source.id,
            entries: U.deepClone(source.entries).map(function (e) { e.id = U.uid('en'); return e; }),
            issues: U.deepClone(source.issues),
            stats: U.deepClone(source.stats),
            generatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
          };
          st.timetables.push(copy);
          app.saveAndRefresh('คัดลอกตารางไปภาคเรียนใหม่แล้ว');
        });
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
