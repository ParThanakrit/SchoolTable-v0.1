/* หน้า P6 — หลักสูตร (สร้างเป็นชุด แล้วเลือกห้องที่ใช้ชุดนั้น) */
(function (global) {
  'use strict';
  var U = global.ST.util, M = global.ST.model, UI = global.ST.ui;
  global.ST.pages = global.ST.pages || {};
  var gradeFilter = '';
  var STANDARD_GRADES = ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];

  global.ST.pages.curriculum = {
    render: function (root) {
      var app = global.ST.app;
      var st = app.state();
      var slots = M.slotsPerWeek(st);
      var grades = st.gradeLevels.slice().sort(function (a, b) { return U.num(a.order) - U.num(b.order); });
      if (gradeFilter && !U.byId(grades, gradeFilter)) gradeFilter = '';

      UI.pageHeader(root, {
        title: 'หลักสูตร',
        desc: 'สร้างหลักสูตรเป็นชุด ใส่ว่าชุดนั้นเรียนวิชาอะไรวิชาละกี่คาบต่อสัปดาห์ แล้วจึงเลือกว่าห้องไหนใช้หลักสูตรชุดนี้',
        actions: [
          { label: '❓ ช่วยเหลือ', onClick: function () { global.ST.help.show('curriculum'); } },
          { label: 'จัดการระดับชั้น', onClick: function () { gradeManager(); } },
          { label: '+ สร้างหลักสูตรใหม่', className: 'btn--primary', onClick: function () { curriculumForm(); } }
        ]
      });

      if (!grades.length || !st.subjects.length) {
        root.appendChild(UI.emptyState({
          icon: '📚',
          title: 'ยังสร้างหลักสูตรไม่ได้',
          desc: !grades.length
            ? 'ยังไม่มีระดับชั้นในระบบ ให้ตั้งค่าระดับชั้นมาตรฐาน ป.1 ถึง ม.6 ก่อน'
            : 'ยังไม่มีรายวิชาในระบบ ให้เพิ่มรายวิชาก่อน จึงจะใส่จำนวนคาบในหลักสูตรได้',
          actions: !grades.length
            ? [{ label: 'จัดการระดับชั้น', onClick: function () { gradeManager(); } }]
            : [{ label: 'ไปหน้ารายวิชา', onClick: function () { app.go('subjects'); } }]
        }));
        return;
      }

      /* ---------- ห้องที่ยังไม่ได้เลือกหลักสูตร ---------- */
      var orphans = st.classSections.filter(function (s) {
        return !s.curriculumId || !U.byId(st.curricula, s.curriculumId);
      });
      if (orphans.length) {
        root.appendChild(U.elFromHTML(
          '<div class="callout callout--warning"><b>ยังมี ' + U.fmtNum(orphans.length) +
          ' ชั้นเรียนที่ยังไม่ได้เลือกหลักสูตร</b><div class="small">' +
          U.esc(orphans.slice(0, 12).map(function (s) { return s.name; }).join(', ')) +
          (orphans.length > 12 ? ' และอีก ' + (orphans.length - 12) + ' ห้อง' : '') +
          ' — ห้องเหล่านี้จะยังไม่มีวิชาให้จัดครูผู้สอน ให้กดปุ่ม “เลือกห้องที่ใช้” ในหลักสูตรที่ต้องการ</div></div>'));
      }

      /* ---------- รายการหลักสูตร ---------- */
      if (!st.curricula.length) {
        root.appendChild(UI.emptyState({
          icon: '🗂',
          title: 'ยังไม่มีหลักสูตรในระบบ',
          desc: 'เริ่มจากสร้างหลักสูตรหนึ่งชุด เช่น “หลักสูตร ม.1 ทั่วไป” แล้วใส่รายวิชากับจำนวนคาบ จากนั้นเลือกว่าห้องไหนใช้ชุดนี้',
          actions: [{ label: '+ สร้างหลักสูตรใหม่', onClick: function () { curriculumForm(); } }]
        }));
        return;
      }

      var sorted = st.curricula.slice().sort(function (a, b) {
        var ga = U.byId(st.gradeLevels, a.gradeLevelId);
        var gb = U.byId(st.gradeLevels, b.gradeLevelId);
        var d = U.num(ga && ga.order) - U.num(gb && gb.order);
        return d !== 0 ? d : String(a.name).localeCompare(String(b.name), 'th');
      });
      var curriculumCountByGrade = {};
      st.curricula.forEach(function (c) {
        curriculumCountByGrade[c.gradeLevelId] = (curriculumCountByGrade[c.gradeLevelId] || 0) + 1;
      });
      var gradesWithCurriculum = grades.filter(function (g) { return !!curriculumCountByGrade[g.id]; });
      if (gradeFilter && !gradesWithCurriculum.some(function (g) { return g.id === gradeFilter; })) gradeFilter = '';

      var gradeSelect = U.elFromHTML(
        '<select class="select curriculum-grade-filter" aria-label="กรองหลักสูตรตามระดับชั้น">' +
        '<option value="">ทุกระดับชั้น</option>' +
        gradesWithCurriculum.map(function (g) {
          return '<option value="' + U.esc(g.id) + '"' + (gradeFilter === g.id ? ' selected' : '') +
            '>' + U.esc(g.name) + ' (' + U.fmtNum(curriculumCountByGrade[g.id]) + ' ชุด)</option>';
        }).join('') + '</select>'
      );
      gradeSelect.addEventListener('change', function () {
        gradeFilter = gradeSelect.value;
        app.refresh();
      });

      var table = UI.dataTable({
        rows: sorted,
        tools: [gradeSelect],
        searchPlaceholder: 'ค้นหาชื่อหลักสูตร หรือชื่อห้องที่ใช้…',
        filter: function (c, term) {
          var names = M.sectionsOfCurriculum(st, c.id).map(function (s) { return s.name; }).join(' ');
          return (c.name + ' ' + (c.note || '') + ' ' + names).toLowerCase().indexOf(term) !== -1;
        },
        extraFilter: function (c) { return !gradeFilter || c.gradeLevelId === gradeFilter; },
        columns: [
          {
            key: 'name', label: 'ชุดหลักสูตร', render: function (c) {
              var g = U.byId(st.gradeLevels, c.gradeLevelId);
              return '<b>' + U.esc(c.name) + '</b>' +
                (g ? ' <span class="badge badge--muted">' + U.esc(g.name) + '</span>' : '') +
                (c.note ? '<div class="small muted">' + U.esc(c.note) + '</div>' : '');
            }
          },
          {
            key: 'items', label: 'รายวิชา', className: 'num', render: function (c) {
              return U.fmtNum(M.curriculumItemsOf(st, c.id).length) + ' วิชา';
            }
          },
          {
            key: 'total', label: 'รวมคาบต่อสัปดาห์', className: 'num', render: function (c) {
              var total = M.curriculumTotal(st, c.id);
              if (total > slots) {
                return '<span class="text-danger">' + total + ' คาบ<div class="small">เกินช่องที่มี ' +
                  (total - slots) + ' คาบ</div></span>';
              }
              return total + ' คาบ<div class="small muted">จัดเพิ่มได้อีก ' + (slots - total) + ' คาบ</div>';
            }
          },
          {
            key: 'sections', label: 'ห้องที่ใช้หลักสูตรนี้', render: function (c) {
              var list = M.sectionsOfCurriculum(st, c.id);
              if (!list.length) return '<span class="text-danger">ยังไม่มีห้องใดใช้</span>';
              return '<span class="badge badge--success">' + U.fmtNum(list.length) + ' ห้อง</span> ' +
                '<span class="small">' + U.esc(list.slice(0, 8).map(function (s) { return s.name; }).join(', ')) +
                (list.length > 8 ? ' …' : '') + '</span>';
            }
          },
          {
            key: 'act', label: 'จัดการ', className: 'col-actions curriculum-actions', render: function (c) {
              return '<div class="curriculum-action-group">' +
                '<button type="button" class="curriculum-action curriculum-action--subjects" data-items="' + c.id + '"><span aria-hidden="true">📖</span><span>แก้ไขรายวิชา</span></button>' +
                '<button type="button" class="curriculum-action curriculum-action--rooms" data-pick="' + c.id + '"><span aria-hidden="true">🏠</span><span>เลือกห้อง</span></button>' +
                '<details class="row-more curriculum-more"><summary><span aria-hidden="true">•••</span><span>เพิ่มเติม</span></summary><div class="row-more__items">' +
                '<button type="button" class="curriculum-action curriculum-action--rename" data-edit="' + c.id + '"><span aria-hidden="true">✏️</span><span>เปลี่ยนชื่อ</span></button>' +
                '<button type="button" class="curriculum-action curriculum-action--copy" data-copy="' + c.id + '"><span aria-hidden="true">📋</span><span>ทำสำเนา</span></button>' +
                '<button type="button" class="curriculum-action curriculum-action--delete" data-del="' + c.id + '"><span aria-hidden="true">🗑️</span><span>ลบหลักสูตร</span></button></div></details></div>';
            }
          }
        ],
        onRendered: function (body) {
          U.on(body, 'click', 'button[data-items]', function (ev, b) { itemsEditor(b.dataset.items); });
          U.on(body, 'click', 'button[data-pick]', function (ev, b) { sectionPicker(b.dataset.pick); });
          U.on(body, 'click', 'button[data-edit]', function (ev, b) { curriculumForm(b.dataset.edit); });
          U.on(body, 'click', 'button[data-copy]', function (ev, b) { duplicate(b.dataset.copy); });
          U.on(body, 'click', 'button[data-del]', function (ev, b) { removeCurriculum(b.dataset.del); });
        }
      });
      var card = U.elFromHTML('<div class="card"><div class="card__title">หลักสูตรทั้งหมด ' +
        U.fmtNum(st.curricula.length) + ' ชุด</div>' +
        '<div class="card__desc">หนึ่งสัปดาห์มีช่องให้จัดทั้งหมด ' + slots +
        ' ช่อง (นับเฉพาะคาบสอน ไม่รวมคาบพัก) รวมคาบของหลักสูตรต้องไม่เกินจำนวนนี้</div></div>');
      card.appendChild(table);
      root.appendChild(card);

      /* ---------- สร้าง / แก้ชื่อหลักสูตร ---------- */
      function curriculumForm(id) {
        var cur = id ? U.byId(st.curricula, id) : null;
        UI.formModal({
          title: cur ? 'แก้ไขข้อมูลหลักสูตร' : 'สร้างหลักสูตรใหม่',
          values: cur ? U.deepClone(cur) : { name: '', gradeLevelId: grades[0].id, note: '' },
          fields: [
            { name: 'name', label: 'ชื่อหลักสูตร', required: true, hint: 'เช่น หลักสูตร ม.1 ทั่วไป หรือ หลักสูตร ม.4 ห้องเรียนพิเศษวิทย์-คณิต' },
            {
              name: 'gradeLevelId', label: 'ระดับชั้น', type: 'select', required: true,
              options: grades.map(function (g) { return { value: g.id, label: g.name }; }),
              hint: 'ใช้สำหรับจัดกลุ่มและกรองรายชื่อห้องตอนเลือกห้องที่ใช้'
            },
            { name: 'note', label: 'คำอธิบาย', type: 'textarea', rows: 2, hint: 'ไม่บังคับ เช่น เพิ่มคณิตศาสตร์ 1 คาบ งดการงานอาชีพ' }
          ],
          onSubmit: function (v) {
            var name = String(v.name || '').trim();
            if (!name) {
              return { ok: false, errors: { name: 'ต้องกรอกชื่อหลักสูตร เพราะใช้เป็นชื่อที่เลือกในหน้าชั้นเรียน' } };
            }
            var dup = st.curricula.some(function (c) {
              return c.name.trim() === name && (!cur || c.id !== cur.id);
            });
            if (dup) {
              return { ok: false, errors: { name: 'มีหลักสูตรชื่อนี้อยู่แล้ว ให้ตั้งชื่อที่ต่างออกไป เช่น เติมชื่อห้องเรียนพิเศษต่อท้าย' } };
            }
            if (cur) {
              cur.name = name; cur.gradeLevelId = v.gradeLevelId; cur.note = v.note || '';
              cur.updatedAt = new Date().toISOString();
              app.saveAndRefresh('แก้ไขหลักสูตรแล้ว');
            } else {
              var rec = {
                id: U.uid('cu'), name: name, gradeLevelId: v.gradeLevelId, note: v.note || '',
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
              };
              st.curricula.push(rec);
              global.ST.store.save();
              app.refresh();
              U.toast('สร้างหลักสูตรแล้ว ขั้นต่อไปให้ใส่รายวิชาและจำนวนคาบ', 'success');
              itemsEditor(rec.id);
            }
          }
        });
      }

      /* ---------- ทำสำเนาหลักสูตร ---------- */
      function duplicate(id) {
        var cur = U.byId(st.curricula, id);
        if (!cur) return;
        var copy = {
          id: U.uid('cu'), name: cur.name + ' (สำเนา)', gradeLevelId: cur.gradeLevelId,
          note: cur.note || '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        st.curricula.push(copy);
        M.curriculumItemsOf(st, cur.id).forEach(function (ci) {
          st.curriculumItems.push({
            id: U.uid('ci'), curriculumId: copy.id, subjectId: ci.subjectId,
            periodsPerWeek: U.num(ci.periodsPerWeek),
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
          });
        });
        app.saveAndRefresh('ทำสำเนาหลักสูตรแล้ว ยังไม่มีห้องใดใช้สำเนานี้');
      }

      /* ---------- ลบหลักสูตร ---------- */
      function removeCurriculum(id) {
        var cur = U.byId(st.curricula, id);
        if (!cur) return;
        UI.deleteWithGuard({
          what: 'หลักสูตร', name: cur.name,
          references: M.referencesOfCurriculum(st, id),
          fix: 'ให้เปลี่ยนห้องเหล่านี้ไปใช้หลักสูตรชุดอื่นก่อน แล้วจึงกลับมาลบหลักสูตรนี้'
        }).then(function (ok) {
          if (!ok) return;
          st.curricula = st.curricula.filter(function (c) { return c.id !== id; });
          st.curriculumItems = st.curriculumItems.filter(function (ci) { return ci.curriculumId !== id; });
          M.syncAssignments(st);
          app.saveAndRefresh('ลบหลักสูตรแล้ว');
        });
      }

      /* ---------- รายวิชาและจำนวนคาบของหลักสูตรชุดนั้น ---------- */
      function itemsEditor(id) {
        var cur = U.byId(st.curricula, id);
        if (!cur) return;
        var map = {};
        M.curriculumItemsOf(st, id).forEach(function (ci) { map[ci.subjectId] = U.num(ci.periodsPerWeek); });

        var body = document.createElement('div');
        body.className = 'curriculum-items-editor';
        body.innerHTML =
          '<div class="callout"><b>' + U.esc(cur.name) + '</b> · ใส่จำนวนคาบต่อสัปดาห์ของแต่ละวิชา ' +
          'เว้นว่างหรือใส่ 0 หมายถึงหลักสูตรชุดนี้ไม่เรียนวิชานั้น</div>' +
          '<div class="cur-total" id="curTotal"></div>' +
          '<div class="table-tools no-print"><input type="search" class="input" id="curSearch" placeholder="ค้นหารายวิชา…" aria-label="ค้นหารายวิชา">' +
          '<label class="checkline"><input type="checkbox" id="onlyPicked"><span>แสดงเฉพาะวิชาที่เลือกไว้แล้ว</span></label></div>' +
          '<div class="table-wrap curriculum-items-table-wrap"><table class="data curriculum-items-table" id="curTable"></table></div>';

        var table = body.querySelector('#curTable');
        var totalHost = body.querySelector('#curTotal');
        var searchEl = body.querySelector('#curSearch');
        var onlyEl = body.querySelector('#onlyPicked');

        function paintTotal() {
          var total = 0;
          Object.keys(map).forEach(function (k) { total += map[k] || 0; });
          var cls = total > slots ? 'is-over' : (total === slots ? 'is-exact' : '');
          totalHost.className = 'cur-total ' + cls;
          totalHost.innerHTML = 'รวม <b>' + total + '</b> คาบ จากช่องที่มีจริง ' + slots + ' ช่องต่อสัปดาห์ · ' +
            (total > slots
              ? '<span class="text-danger">เกินไป ' + (total - slots) + ' คาบ จัดตารางไม่ได้แน่นอน</span>'
              : (total === slots ? '<span class="text-success">พอดีทุกช่อง</span>'
                : '<span class="muted">เหลือว่าง ' + (slots - total) + ' คาบ</span>'));
        }

        function paintTable() {
          var term = searchEl.value.trim().toLowerCase();
          var only = onlyEl.checked;
          var html = '<thead><tr><th style="min-width:280px">รายวิชา</th>' +
            '<th class="num" style="width:150px">คาบต่อสัปดาห์</th></tr></thead><tbody>';
          var shown = 0;
          st.subjectGroups.forEach(function (grp) {
            var list = st.subjects.filter(function (s) {
              if (s.subjectGroupId !== grp.id) return false;
              if (only && !(map[s.id] > 0)) return false;
              if (term && (s.code + ' ' + s.name).toLowerCase().indexOf(term) === -1) return false;
              return true;
            });
            if (!list.length) return;
            html += '<tr class="row-group"><td colspan="2"><b>' + U.esc(grp.name) + '</b></td></tr>';
            list.forEach(function (s) {
              shown++;
              var v = map[s.id] || 0;
              html += '<tr' + (v > 0 ? ' class="is-picked"' : '') + '><td>' +
                '<span class="dot" style="background:' + U.esc((grp && grp.color) || '#94a3b8') + '"></span> ' +
                U.esc(s.code) + ' ' + U.esc(s.name) +
                (s.doubleMode !== 'NONE' ? ' <span class="badge badge--warning">คาบคู่</span>' : '') +
                (s.isElective ? ' <span class="badge badge--locked">เลือกเสรี</span>' : '') + '</td>' +
                '<td class="num"><input type="number" min="0" max="40" class="input curriculum-period-input" ' +
                'data-s="' + s.id + '" value="' + (v || '') + '"></td></tr>';
            });
          });
          html += '</tbody>';
          table.innerHTML = shown ? html
            : '<tbody><tr><td class="muted" style="padding:20px">ไม่พบรายวิชาที่ตรงกับคำค้น ลองใช้คำค้นอื่น</td></tr></tbody>';
        }

        U.on(table, 'input', 'input[data-s]', function (ev, input) {
          map[input.dataset.s] = Math.max(0, U.num(input.value));
          input.closest('tr').classList.toggle('is-picked', map[input.dataset.s] > 0);
          paintTotal();
        });
        searchEl.addEventListener('input', paintTable);
        onlyEl.addEventListener('change', paintTable);
        paintTable();
        paintTotal();

        U.openModal({
          title: 'รายวิชาและจำนวนคาบ',
          size: 'lg',
          content: body,
          buttons: [
            { label: 'ยกเลิก', className: 'btn--ghost' },
            {
              label: 'บันทึกหลักสูตร', className: 'btn--primary', onClick: function () {
                var total = 0;
                Object.keys(map).forEach(function (k) { total += map[k] || 0; });
                if (total > slots) {
                  U.explainDialog({
                    title: 'บันทึกหลักสูตรไม่ได้',
                    cause: 'หลักสูตร "' + cur.name + '" รวม ' + total + ' คาบต่อสัปดาห์ ซึ่งมากกว่าช่องที่มีจริง ' +
                      slots + ' ช่อง จึงจัดตารางไม่ได้แน่นอน',
                    fix: 'ให้ลดจำนวนคาบของบางวิชาลงอย่างน้อย ' + (total - slots) +
                      ' คาบ หรือไปที่หน้าตั้งค่าโรงเรียนเพื่อเพิ่มจำนวนคาบต่อวัน'
                  });
                  return true;
                }

                var oddWarn = [];
                var items = [];
                st.subjects.forEach(function (s) {
                  var v = map[s.id] || 0;
                  if (v <= 0) return;
                  items.push({
                    id: U.uid('ci'), curriculumId: cur.id, subjectId: s.id, periodsPerWeek: v,
                    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
                  });
                  if (s.doubleMode !== 'NONE' && v % 2 === 1) oddWarn.push(s.name);
                });

                /* วิชาที่ถูกเอาออก แต่จัดครูผู้สอนไว้แล้ว */
                var sectionIds = {};
                M.sectionsOfCurriculum(st, cur.id).forEach(function (s) { sectionIds[s.id] = true; });
                var removed = st.assignments.filter(function (a) {
                  return sectionIds[a.classSectionId] && a.teacherId && !(map[a.subjectId] > 0);
                });

                var proceed = removed.length ? U.confirmDialog({
                  title: 'ยืนยันการบันทึกหลักสูตร',
                  message: 'มีวิชาที่ถูกเอาออกจากหลักสูตรชุดนี้ แต่จัดครูผู้สอนไว้แล้ว ' + removed.length + ' รายการ',
                  detail: '<b>ผลที่จะเกิดขึ้น</b><br>การจัดครูผู้สอนของรายการเหล่านั้นจะถูกลบไปด้วย ' +
                    'และคาบในตารางฉบับร่างที่เกี่ยวข้องจะถูกลบตาม',
                  confirmText: 'บันทึกหลักสูตร', danger: true
                }) : Promise.resolve(true);

                proceed.then(function (ok) {
                  if (!ok) return;
                  st.curriculumItems = st.curriculumItems
                    .filter(function (ci) { return ci.curriculumId !== cur.id; })
                    .concat(items);
                  cur.updatedAt = new Date().toISOString();
                  M.syncAssignments(st);
                  var validIds = {};
                  st.assignments.forEach(function (a) { validIds[a.id] = true; });
                  st.timetables.forEach(function (t) {
                    if (t.status !== 'DRAFT') return;
                    t.entries = t.entries.filter(function (e) { return validIds[e.assignmentId]; });
                  });
                  if (oddWarn.length) {
                    U.toast('วิชาคาบคู่ที่กำหนดจำนวนคาบเป็นเลขคี่ ' + oddWarn.length +
                      ' รายการ จะเหลือเศษ 1 คาบที่ต้องจัดเดี่ยว เช่น ' + oddWarn.slice(0, 2).join(', '), 'warning', 9000);
                  }
                  U.closeModal();
                  app.saveAndRefresh('บันทึกหลักสูตรแล้ว');
                });
                return true; /* ปิดเองหลังยืนยัน */
              }
            }
          ]
        });
      }

      /* ---------- เลือกห้องที่ใช้หลักสูตรชุดนี้ ---------- */
      function sectionPicker(id) {
        var cur = U.byId(st.curricula, id);
        if (!cur) return;
        if (!st.classSections.length) {
          U.explainDialog({
            title: 'ยังเลือกห้องไม่ได้',
            cause: 'ยังไม่มีชั้นเรียนในระบบ จึงไม่มีห้องให้เลือกใช้หลักสูตรนี้',
            fix: 'ให้ไปที่หน้าชั้นเรียนเพื่อสร้างชั้นเรียนก่อน แล้วกลับมาเลือกห้องอีกครั้ง'
          });
          return;
        }
        var picked = {};
        M.sectionsOfCurriculum(st, cur.id).forEach(function (s) { picked[s.id] = true; });

        var body = document.createElement('div');
        body.innerHTML =
          '<div class="callout"><b>' + U.esc(cur.name) + '</b> · ติ๊กเลือกห้องที่จะใช้หลักสูตรชุดนี้ ' +
          'หนึ่งห้องใช้ได้ชุดเดียว ถ้าเลือกห้องที่ใช้ชุดอื่นอยู่ ห้องนั้นจะย้ายมาใช้ชุดนี้แทน</div>' +
          '<div class="table-tools no-print">' +
          '<label class="checkline"><input type="checkbox" id="onlyGrade" checked><span>แสดงเฉพาะห้องในระดับชั้นเดียวกับหลักสูตร</span></label>' +
          '<button type="button" class="btn btn--sm" id="pickAll">เลือกทั้งหมดที่แสดง</button>' +
          '<button type="button" class="btn btn--sm" id="pickNone">ล้างที่แสดง</button></div>' +
          '<div class="table-wrap" style="max-height:52vh"><table class="data" id="secTable"></table></div>';

        var table = body.querySelector('#secTable');
        var onlyGrade = body.querySelector('#onlyGrade');

        function visibleSections() {
          return st.classSections.filter(function (s) {
            return !onlyGrade.checked || s.gradeLevelId === cur.gradeLevelId;
          });
        }

        function paint() {
          var list = visibleSections();
          if (!list.length) {
            table.innerHTML = '<tbody><tr><td class="muted" style="padding:20px">' +
              'ไม่มีชั้นเรียนในระดับชั้นนี้ ให้เอาเครื่องหมายถูกออกจากตัวกรองด้านบนเพื่อดูทุกห้อง</td></tr></tbody>';
            return;
          }
          table.innerHTML = '<thead><tr><th style="width:64px">เลือก</th><th>ชั้นเรียน</th>' +
            '<th>หลักสูตรที่ใช้อยู่ตอนนี้</th></tr></thead><tbody>' +
            list.map(function (s) {
              var other = U.byId(st.curricula, s.curriculumId);
              var isMine = other && other.id === cur.id;
              return '<tr' + (picked[s.id] ? ' class="is-picked"' : '') + '>' +
                '<td><input type="checkbox" data-sec="' + s.id + '"' + (picked[s.id] ? ' checked' : '') + '></td>' +
                '<td><b>' + U.esc(s.name) + '</b>' +
                (s.note ? '<div class="small muted">' + U.esc(s.note) + '</div>' : '') + '</td>' +
                '<td>' + (isMine ? '<span class="badge badge--success">ชุดนี้</span>'
                  : (other ? '<span class="badge badge--muted">' + U.esc(other.name) + '</span>'
                    : '<span class="text-danger">ยังไม่ได้เลือกหลักสูตร</span>')) + '</td></tr>';
            }).join('') + '</tbody>';
        }

        U.on(table, 'change', 'input[data-sec]', function (ev, input) {
          picked[input.dataset.sec] = input.checked;
          input.closest('tr').classList.toggle('is-picked', input.checked);
        });
        onlyGrade.addEventListener('change', paint);
        body.querySelector('#pickAll').addEventListener('click', function () {
          visibleSections().forEach(function (s) { picked[s.id] = true; });
          paint();
        });
        body.querySelector('#pickNone').addEventListener('click', function () {
          visibleSections().forEach(function (s) { picked[s.id] = false; });
          paint();
        });
        paint();

        U.openModal({
          title: 'เลือกห้องที่ใช้หลักสูตรนี้',
          size: 'lg',
          content: body,
          buttons: [
            { label: 'ยกเลิก', className: 'btn--ghost' },
            {
              label: 'บันทึกการเลือกห้อง', className: 'btn--primary', onClick: function () {
                /* ห้องที่กำลังจะถูกย้ายออกจากชุดนี้ และมีการจัดครูผู้สอนไว้แล้ว */
                var moveOut = M.sectionsOfCurriculum(st, cur.id).filter(function (s) { return !picked[s.id]; });
                var affected = moveOut.filter(function (s) {
                  return st.assignments.some(function (a) { return a.classSectionId === s.id && a.teacherId; });
                });
                var proceed = affected.length ? U.confirmDialog({
                  title: 'ยืนยันการเปลี่ยนหลักสูตรของห้อง',
                  message: 'มี ' + affected.length + ' ห้องที่ถูกเอาออกจากหลักสูตรชุดนี้ ทั้งที่จัดครูผู้สอนไว้แล้ว',
                  detail: '<b>ผลที่จะเกิดขึ้น</b><br>ห้องเหล่านั้นจะไม่มีหลักสูตร จนกว่าจะเลือกหลักสูตรชุดอื่นให้ ' +
                    'และการจัดครูผู้สอนของห้องนั้นจะถูกลบ<br><span class="small">' +
                    U.esc(affected.slice(0, 10).map(function (s) { return s.name; }).join(', ')) + '</span>',
                  confirmText: 'บันทึกการเลือกห้อง', danger: true
                }) : Promise.resolve(true);

                proceed.then(function (ok) {
                  if (!ok) return;
                  st.classSections.forEach(function (s) {
                    if (picked[s.id]) s.curriculumId = cur.id;
                    else if (s.curriculumId === cur.id) s.curriculumId = '';
                  });
                  M.syncAssignments(st);
                  U.closeModal();
                  app.saveAndRefresh('บันทึกการเลือกห้องแล้ว');
                });
                return true;
              }
            }
          ]
        });
      }

      /* ---------- จัดการระดับชั้น ---------- */
      function gradeManager() {
        var body = document.createElement('div');
        function paint() {
          body.innerHTML = '<div class="table-wrap"><table class="data"><thead><tr>' +
            '<th>ระดับชั้น</th><th class="num">ลำดับ</th><th class="num">จำนวนชั้นเรียน</th>' +
            '<th class="num">จำนวนหลักสูตร</th><th></th></tr></thead><tbody>' +
            grades.map(function (g) {
              var count = st.classSections.filter(function (s) { return s.gradeLevelId === g.id; }).length;
              var curCount = st.curricula.filter(function (c) { return c.gradeLevelId === g.id; }).length;
              return '<tr><td>' + U.esc(g.name) + '</td><td class="num">' + U.num(g.order) + '</td>' +
                '<td class="num">' + count + '</td><td class="num">' + curCount + '</td>' +
                '<td><button type="button" class="btn btn--sm" data-del="' + g.id + '">ลบ</button></td></tr>';
            }).join('') + '</tbody></table></div>' +
            '<div class="grade-preset"><div><b>ระดับชั้นมาตรฐาน</b>' +
            '<div class="small muted">เพิ่มระดับชั้นให้ครบตั้งแต่ ป.1–ป.6 และ ม.1–ม.6 โดยไม่ลบข้อมูลเดิม</div></div>' +
            '<button type="button" class="btn" id="addStandardGrades">ตั้งค่า ป.1–ม.6</button></div>' +
            '<div class="flex gap-8 mt-16"><input class="input" id="newGrade" placeholder="ชื่อระดับชั้น เช่น ม.1">' +
            '<button type="button" class="btn btn--primary" id="addGrade">เพิ่ม</button></div>';
          body.querySelector('#addStandardGrades').addEventListener('click', function () {
            var added = 0;
            STANDARD_GRADES.forEach(function (name, index) {
              var existing = st.gradeLevels.find(function (g) { return g.name === name; });
              if (existing) {
                existing.order = index + 1;
              } else {
                st.gradeLevels.push({ id: U.uid('gl'), name: name, order: index + 1 });
                added++;
              }
            });
            st.gradeLevels.filter(function (g) { return STANDARD_GRADES.indexOf(g.name) === -1; })
              .sort(function (a, b) { return U.num(a.order) - U.num(b.order); })
              .forEach(function (g, index) { g.order = STANDARD_GRADES.length + index + 1; });
            global.ST.store.save();
            U.closeModal();
            app.refresh();
            U.toast(added ? 'เพิ่มระดับชั้นมาตรฐานครบ ป.1–ม.6 แล้ว' : 'มีระดับชั้น ป.1–ม.6 ครบอยู่แล้ว', 'success');
          });
          body.querySelector('#addGrade').addEventListener('click', function () {
            var name = body.querySelector('#newGrade').value.trim();
            if (!name) { U.toast('ต้องกรอกชื่อระดับชั้นก่อน', 'danger'); return; }
            if (st.gradeLevels.some(function (g) { return g.name === name; })) {
              U.toast('มีระดับชั้นชื่อนี้อยู่แล้ว ให้ใช้ชื่ออื่น', 'danger');
              return;
            }
            var standardOrder = STANDARD_GRADES.indexOf(name);
            st.gradeLevels.push({ id: U.uid('gl'), name: name,
              order: standardOrder === -1 ? st.gradeLevels.length + 1 : standardOrder + 1 });
            global.ST.store.save();
            U.closeModal();
            app.refresh();
          });
          U.on(body, 'click', 'button[data-del]', function (ev, btn) {
            var g = U.byId(st.gradeLevels, btn.dataset.del);
            var refs = st.classSections.filter(function (s) { return s.gradeLevelId === g.id; })
              .map(function (s) { return 'ชั้นเรียน ' + s.name; })
              .concat(st.curricula.filter(function (c) { return c.gradeLevelId === g.id; })
                .map(function (c) { return 'หลักสูตร ' + c.name; }));
            UI.deleteWithGuard({
              what: 'ระดับชั้น', name: g.name, references: refs,
              fix: 'ให้ลบหรือย้ายชั้นเรียนและหลักสูตรของระดับชั้นนี้ก่อน'
            }).then(function (ok) {
              if (!ok) return;
              st.gradeLevels = st.gradeLevels.filter(function (x) { return x.id !== g.id; });
              M.syncAssignments(st);
              U.closeModal();
              app.saveAndRefresh('ลบระดับชั้นแล้ว');
            });
          });
        }
        paint();
        U.openModal({ title: 'จัดการระดับชั้น', size: 'md', content: body, buttons: [{ label: 'ปิด', className: 'btn--primary' }] });
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
