/* หน้า P7 — ชั้นเรียน (ตารางเดียว อ่านง่าย) */
(function (global) {
  'use strict';
  var U = global.ST.util, M = global.ST.model, UI = global.ST.ui;
  global.ST.pages = global.ST.pages || {};

  global.ST.pages.sections = {
    render: function (root) {
      var app = global.ST.app;
      var st = app.state();
      var slots = M.slotsPerWeek(st);

      UI.pageHeader(root, {
        title: 'ชั้นเรียน',
        desc: 'ห้องเรียนของนักเรียน เช่น ม.1/1 · แต่ละห้องเลือกได้ว่าใช้หลักสูตรชุดไหน',
        actions: [
          { label: '+ สร้างหลายห้องพร้อมกัน', onClick: function () { bulkForm(); } },
          { label: '+ เพิ่มชั้นเรียน', className: 'btn--primary', onClick: function () { sectionForm(); } },
          { label: '📥 นำเข้าจากไฟล์', onClick: function () { app.go('import', { kind: 'sections' }); } }
        ]
      });

      if (!st.gradeLevels.length) {
        root.appendChild(UI.emptyState({
          icon: '🏫', title: 'ยังไม่มีระดับชั้นในระบบ',
          desc: 'ชั้นเรียนต้องสังกัดระดับชั้น ให้เพิ่มระดับชั้นในหน้าหลักสูตรก่อน',
          actions: [{ label: 'ไปหน้าหลักสูตร', onClick: function () { app.go('curriculum'); } }]
        }));
        return;
      }

      var grades = st.gradeLevels.slice().sort(function (a, b) { return U.num(a.order) - U.num(b.order); });
      var gradeById = U.indexById(st.gradeLevels);

      if (!st.classSections.length) {
        root.appendChild(UI.emptyState({
          icon: '🏫', title: 'ยังไม่มีชั้นเรียนในระบบ',
          desc: 'สร้างชั้นเรียนทีละห้อง หรือกดสร้างหลายห้องพร้อมกัน เช่น ม.1/1 ถึง ม.1/10',
          actions: [
            { label: '+ สร้างหลายห้องพร้อมกัน', onClick: function () { bulkForm(); } },
            { label: '+ เพิ่มชั้นเรียน', className: 'btn--ghost', onClick: function () { sectionForm(); } }
          ]
        }));
        return;
      }

      /* ---------- แถบสรุปสั้น ๆ ---------- */
      var noCurriculum = st.classSections.filter(function (s) {
        return !s.curriculumId || !U.byId(st.curricula, s.curriculumId);
      }).length;
      var noRoom = st.classSections.filter(function (s) { return !s.homeRoomId; }).length;
      var sectionCountByGrade = {};
      st.classSections.forEach(function (s) {
        sectionCountByGrade[s.gradeLevelId] = (sectionCountByGrade[s.gradeLevelId] || 0) + 1;
      });
      var activeGrades = grades.filter(function (g) { return !!sectionCountByGrade[g.id]; });
      root.appendChild(U.elFromHTML(
        '<div class="statstrip">' +
        '<div class="statstrip__item"><span class="statstrip__num">' + U.fmtNum(st.classSections.length) +
        '</span><span class="statstrip__label">ชั้นเรียนทั้งหมด</span></div>' +
        '<div class="statstrip__item"><span class="statstrip__num">' + U.fmtNum(grades.length) +
        '</span><span class="statstrip__label">ระดับชั้น</span></div>' +
        '<div class="statstrip__item' + (noCurriculum ? ' is-warn' : '') + '"><span class="statstrip__num">' +
        U.fmtNum(noCurriculum) + '</span><span class="statstrip__label">ห้องที่ยังไม่ได้เลือกหลักสูตร</span></div>' +
        '<div class="statstrip__item' + (noRoom ? ' is-warn' : '') + '"><span class="statstrip__num">' +
        U.fmtNum(noRoom) + '</span><span class="statstrip__label">ห้องที่ยังไม่มีห้องประจำ</span></div>' +
        '</div>'));

      /* ---------- ตัวกรองระดับชั้น ---------- */
      var gradeFilter = '';
      var filterBar = U.elFromHTML('<div class="chipset chipset--filter section-grade-chips">' +
        '<button type="button" class="chip is-on" data-g="">ทุกระดับชั้น <span class="chip__count">' +
        U.fmtNum(st.classSections.length) + '</span></button>' +
        activeGrades.map(function (g) {
          var n = sectionCountByGrade[g.id];
          return '<button type="button" class="chip" data-g="' + g.id + '">' + U.esc(g.name) +
            ' <span class="chip__count">' + n + '</span></button>';
        }).join('') + '</div>');

      /* หาหลักสูตรที่ห้องส่วนใหญ่ในระดับชั้นนั้นใช้ เพื่อชี้ห้องที่เรียนต่างจากเพื่อน */
      var majorityByGrade = {};
      grades.forEach(function (g) {
        var count = {};
        var best = '', bestN = 0;
        st.classSections.forEach(function (s2) {
          if (s2.gradeLevelId !== g.id || !s2.curriculumId) return;
          count[s2.curriculumId] = (count[s2.curriculumId] || 0) + 1;
          if (count[s2.curriculumId] > bestN) { bestN = count[s2.curriculumId]; best = s2.curriculumId; }
        });
        majorityByGrade[g.id] = bestN > 1 ? best : '';
      });
      function isSpecial(sec) {
        var major = majorityByGrade[sec.gradeLevelId];
        return !!(major && sec.curriculumId && sec.curriculumId !== major);
      }

      var rows = st.classSections.slice().sort(function (a, b) {
        var ga = gradeById[a.gradeLevelId], gb = gradeById[b.gradeLevelId];
        var d = U.num(ga && ga.order) - U.num(gb && gb.order);
        return d !== 0 ? d : String(a.name).localeCompare(String(b.name), 'th', { numeric: true });
      });

      var table = UI.dataTable({
        rows: rows,
        searchPlaceholder: 'ค้นหาชื่อชั้นเรียน ห้องประจำ หรือหลักสูตร…',
        filter: function (s, term) {
          var room = U.byId(st.rooms, s.homeRoomId);
          var cur = U.byId(st.curricula, s.curriculumId);
          return (s.name + ' ' + (s.note || '') + ' ' + (room ? room.name : '') + ' ' +
            (cur ? cur.name : '')).toLowerCase().indexOf(term) !== -1;
        },
        extraFilter: function (s) { return !gradeFilter || s.gradeLevelId === gradeFilter; },
        columns: [
          {
            key: 'name', label: 'ชั้นเรียน', className: 'section-col-name', render: function (s) {
              var g = gradeById[s.gradeLevelId];
              return '<b>' + U.esc(s.name) + '</b>' +
                (g ? ' <span class="badge badge--muted">' + U.esc(g.name) + '</span>' : '') +
                (isSpecial(s) ? ' <span class="badge badge--locked">หลักสูตรต่างจากห้องอื่น</span>' : '') +
                (s.note ? '<div class="small muted">' + U.esc(s.note) + '</div>' : '');
            }
          },
          {
            key: 'students', label: 'นักเรียน', className: 'num section-col-students', render: function (s) {
              return U.fmtNum(s.studentCount) + ' คน';
            }
          },
          {
            key: 'room', label: 'ห้องประจำ', className: 'section-col-room', render: function (s) {
              var room = U.byId(st.rooms, s.homeRoomId);
              if (!room) return '<span class="text-danger">ยังไม่ได้เลือก</span>';
              var b = U.byId(st.buildings, room.buildingId);
              var over = s.studentCount && room.capacity && s.studentCount > room.capacity;
              return U.esc(room.name) +
                '<div class="small muted">' + U.esc(b ? b.name : '-') + ' ชั้น ' + U.num(room.floor) + '</div>' +
                (over ? '<span class="badge badge--warning">ห้องเล็กกว่าจำนวนนักเรียน</span>' : '');
            }
          },
          {
            key: 'curriculum', label: 'หลักสูตรที่ใช้', className: 'section-col-curriculum', render: function (s) {
              var opts = '<option value="">— ยังไม่ได้เลือกหลักสูตร —</option>' +
                st.curricula.map(function (c) {
                  var g = gradeById[c.gradeLevelId];
                  return '<option value="' + c.id + '"' + (c.id === s.curriculumId ? ' selected' : '') + '>' +
                    U.esc(c.name) + (g && g.id !== s.gradeLevelId ? ' (' + U.esc(g.name) + ')' : '') + '</option>';
                }).join('');
              return '<select class="select select--sm' + (s.curriculumId ? '' : ' select--empty') +
                (isSpecial(s) ? ' select--special' : '') +
                '" data-cur="' + s.id + '" aria-label="หลักสูตรของ ' + U.esc(s.name) + '">' + opts + '</select>';
            }
          },
          {
            key: 'total', label: 'คาบตามหลักสูตร', className: 'num section-col-periods', render: function (s) {
              if (!s.curriculumId) return '<span class="muted">—</span>';
              var total = M.sectionWeeklyTotal(st, s.id);
              return total + ' / ' + slots +
                (total > slots ? '<div class="small text-danger">เกินช่องที่มี</div>' : '');
            }
          },
          {
            key: 'act', label: 'จัดการ', className: 'col-actions section-col-actions', render: function (s) {
              return '<div class="section-row-actions"><button type="button" class="btn btn--sm" data-act="edit" data-id="' + s.id + '">แก้ไข</button>' +
                '<button type="button" class="btn btn--sm btn--danger-ghost" data-act="del" data-id="' + s.id + '">ลบ</button></div>';
            }
          }
        ],
        empty: {
          icon: '🏫', title: 'ไม่มีชั้นเรียนในระดับชั้นที่เลือก',
          desc: 'กดปุ่ม “ทุกระดับชั้น” ด้านบนเพื่อดูรายการทั้งหมด'
        },
        onRendered: function (body) {
          U.on(body, 'change', 'select[data-cur]', function (ev, sel) {
            var sec = U.byId(st.classSections, sel.dataset.cur);
            if (!sec) return;
            var before = sec.curriculumId;
            if (!sel.value && st.assignments.some(function (a) {
              return a.classSectionId === sec.id && a.teacherId;
            })) {
              U.confirmDialog({
                title: 'ยืนยันการเอาหลักสูตรออก',
                message: 'ห้อง ' + sec.name + ' จัดครูผู้สอนไว้แล้ว',
                detail: '<b>ผลที่จะเกิดขึ้น</b><br>เมื่อเอาหลักสูตรออก การจัดครูผู้สอนของห้องนี้จะถูกลบทั้งหมด',
                confirmText: 'เอาหลักสูตรออก', danger: true
              }).then(function (ok) {
                if (!ok) { sel.value = before; return; }
                sec.curriculumId = '';
                M.syncAssignments(st);
                app.saveAndRefresh('เอาหลักสูตรออกจาก ' + sec.name + ' แล้ว');
              });
              return;
            }
            sec.curriculumId = sel.value;
            sec.updatedAt = new Date().toISOString();
            M.syncAssignments(st);
            app.saveAndRefresh(sel.value
              ? (sec.name + ' ใช้หลักสูตร ' + (U.byId(st.curricula, sel.value) || {}).name + ' แล้ว')
              : ('เอาหลักสูตรออกจาก ' + sec.name + ' แล้ว'));
          });
          U.on(body, 'click', 'button[data-act="edit"]', function (ev, btn) {
            sectionForm(U.byId(st.classSections, btn.dataset.id));
          });
          U.on(body, 'click', 'button[data-act="del"]', function (ev, btn) {
            var sec = U.byId(st.classSections, btn.dataset.id);
            UI.deleteWithGuard({
              what: 'ชั้นเรียน', name: sec.name,
              references: M.referencesOfSection(st, sec.id),
              fix: 'ให้ลบตารางที่ใช้ชั้นเรียนนี้ หรือเอาครูผู้สอนของห้องนี้ออกก่อน'
            }).then(function (ok) {
              if (!ok) return;
              st.classSections = st.classSections.filter(function (x) { return x.id !== sec.id; });
              M.syncAssignments(st);
              app.saveAndRefresh('ลบชั้นเรียนแล้ว');
            });
          });
        }
      });

      U.on(filterBar, 'click', '.chip', function (ev, chip) {
        gradeFilter = chip.dataset.g;
        U.qsa('.chip', filterBar).forEach(function (c) { c.classList.toggle('is-on', c === chip); });
        table.refresh();
      });

      var card = U.elFromHTML('<div class="card"></div>');
      var filterPanel = U.elFromHTML('<section class="section-filter-panel no-print" aria-label="ค้นหาและกรองชั้นเรียน">' +
        '<div class="section-filter-panel__head"><div><b>ค้นหาและกรองชั้นเรียน</b>' +
        '<div class="small muted">แสดงเฉพาะระดับชั้นที่มีห้องเรียนอยู่ในระบบ</div></div></div></section>');
      filterPanel.appendChild(filterBar);
      var tableTools = table.querySelector('.table-tools');
      if (tableTools) filterPanel.appendChild(tableTools);
      card.appendChild(filterPanel);
      card.appendChild(table);
      root.appendChild(card);

      function roomOptions() {
        return [{ value: '', label: 'ไม่ระบุห้องประจำ' }].concat(st.rooms.map(function (r) {
          var b = U.byId(st.buildings, r.buildingId);
          return { value: r.id, label: r.name + ' (' + (b ? b.name : '-') + ' ชั้น ' + U.num(r.floor) + ')' };
        }));
      }

      function curriculumOptions() {
        return [{ value: '', label: 'ยังไม่เลือกหลักสูตร' }].concat(st.curricula.map(function (c) {
          var g = gradeById[c.gradeLevelId];
          return { value: c.id, label: c.name + (g ? ' — ' + g.name : '') };
        }));
      }

      function sectionForm(section) {
        UI.formModal({
          title: section ? 'แก้ไขชั้นเรียน' : 'เพิ่มชั้นเรียน',
          values: section ? U.deepClone(section) : {
            name: '', gradeLevelId: grades[0].id, studentCount: 35, homeRoomId: '', curriculumId: '', note: ''
          },
          fields: [
            { name: 'name', label: 'ชื่อชั้นเรียน', required: true, hint: 'เช่น ม.1/1 ต้องไม่ซ้ำ' },
            {
              name: 'gradeLevelId', label: 'ระดับชั้น', type: 'select',
              options: grades.map(function (g) { return { value: g.id, label: g.name }; })
            },
            { name: 'studentCount', label: 'จำนวนนักเรียน', type: 'number', min: 0 },
            {
              name: 'homeRoomId', label: 'ห้องประจำ', type: 'select', options: roomOptions(),
              hint: 'ใช้เป็นห้องตั้งต้นสำหรับวิชาที่ไม่ต้องใช้ห้องพิเศษ'
            },
            {
              name: 'curriculumId', label: 'หลักสูตรที่ใช้', type: 'select', options: curriculumOptions(),
              hint: st.curricula.length ? 'เลือกชุดหลักสูตรที่ห้องนี้เรียน'
                : 'ยังไม่มีหลักสูตรในระบบ ให้ไปสร้างที่หน้าหลักสูตรก่อน'
            },
            { name: 'note', label: 'หมายเหตุ', hint: 'เช่น ห้องเรียนพิเศษวิทย์-คณิต' }
          ],
          onSubmit: function (v) {
            var name = String(v.name || '').trim();
            if (!name) return { ok: false, errors: { name: 'ต้องกรอกชื่อชั้นเรียน เพราะใช้แสดงบนตารางและเอกสารที่พิมพ์' } };
            if (st.classSections.some(function (s) {
              return s.name === name && (!section || s.id !== section.id);
            })) return { ok: false, errors: { name: 'มีชั้นเรียนชื่อนี้อยู่แล้ว ให้ใช้ชื่ออื่น' } };

            var target = section || { id: U.uid('cs'), createdAt: new Date().toISOString() };
            target.name = name;
            target.gradeLevelId = v.gradeLevelId;
            target.studentCount = U.num(v.studentCount);
            target.homeRoomId = v.homeRoomId;
            target.curriculumId = v.curriculumId || '';
            target.note = v.note;
            target.updatedAt = new Date().toISOString();
            if (!section) st.classSections.push(target);

            var room = U.byId(st.rooms, target.homeRoomId);
            if (room && room.capacity && target.studentCount > room.capacity) {
              U.toast('ห้องประจำ ' + room.name + ' จุได้ ' + room.capacity + ' คน แต่ชั้นเรียนนี้มี ' +
                target.studentCount + ' คน ระบบยังบันทึกให้ แต่ควรเลือกห้องที่ใหญ่กว่า', 'warning', 8000);
            }
            M.syncAssignments(st);
            app.saveAndRefresh('บันทึกชั้นเรียนแล้ว');
          }
        });
      }

      function bulkForm() {
        UI.formModal({
          title: 'สร้างหลายห้องพร้อมกัน',
          values: {
            gradeLevelId: grades[0].id, prefix: grades[0].name + '/', from: 1, to: 8,
            studentCount: 35, curriculumId: ''
          },
          fields: [
            {
              name: 'gradeLevelId', label: 'ระดับชั้น', type: 'select',
              options: grades.map(function (g) { return { value: g.id, label: g.name }; })
            },
            { name: 'prefix', label: 'คำนำหน้าชื่อห้อง', required: true, hint: 'เช่น ม.1/ ระบบจะต่อท้ายด้วยเลขห้อง' },
            { name: 'from', label: 'เลขห้องเริ่มต้น', type: 'number', min: 1 },
            { name: 'to', label: 'เลขห้องสุดท้าย', type: 'number', min: 1 },
            { name: 'studentCount', label: 'จำนวนนักเรียนต่อห้อง', type: 'number', min: 0 },
            {
              name: 'curriculumId', label: 'ให้ทุกห้องใช้หลักสูตร', type: 'select', options: curriculumOptions(),
              hint: 'เลือกไว้ได้เลย จะได้ไม่ต้องมาเลือกทีละห้อง'
            }
          ],
          submitLabel: 'สร้างชั้นเรียน',
          onSubmit: function (v) {
            var from = U.num(v.from), to = U.num(v.to);
            if (to < from) return { ok: false, errors: { to: 'เลขห้องสุดท้ายต้องไม่น้อยกว่าเลขเริ่มต้น' } };
            if (to - from > 60) return { ok: false, errors: { to: 'สร้างได้ครั้งละไม่เกิน 60 ห้อง' } };
            var created = 0, skipped = 0;
            for (var i = from; i <= to; i++) {
              var nm = String(v.prefix) + i;
              /* eslint-disable no-loop-func */
              if (st.classSections.some(function (s) { return s.name === nm; })) { skipped++; continue; }
              st.classSections.push({
                id: U.uid('cs'), name: nm, gradeLevelId: v.gradeLevelId,
                studentCount: U.num(v.studentCount), homeRoomId: '',
                curriculumId: v.curriculumId || '', note: '',
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
              });
              created++;
            }
            M.syncAssignments(st);
            app.saveAndRefresh('สร้างชั้นเรียนใหม่ ' + created + ' ห้อง' +
              (skipped ? ' และข้าม ' + skipped + ' ห้องที่ชื่อซ้ำ' : ''));
          }
        });
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
