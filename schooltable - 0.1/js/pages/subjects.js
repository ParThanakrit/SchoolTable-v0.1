/* หน้า P4 — รายวิชา */
(function (global) {
  'use strict';
  var U = global.ST.util, M = global.ST.model, UI = global.ST.ui;
  global.ST.pages = global.ST.pages || {};

  var filterGroup = '';
  var filterGrade = '';

  var DOUBLE_OPTIONS = [
    { value: 'NONE', label: 'ไม่ใช่คาบคู่' },
    { value: 'STRICT', label: 'คาบคู่ ห้ามแยก' },
    { value: 'PREFERRED', label: 'คาบคู่ แยกได้เมื่อจำเป็น' }
  ];

  global.ST.pages.subjects = {
    render: function (root) {
      var app = global.ST.app;
      var st = app.state();
      var grades = st.gradeLevels.slice().sort(function (a, b) { return U.num(a.order) - U.num(b.order); });
      var gradeById = U.indexById(grades);

      function gradeIdOf(subject) {
        if (!subject) return '';
        return subject.gradeLevelId || (Array.isArray(subject.gradeLevelIds) ? subject.gradeLevelIds[0] : '') || '';
      }

      function gradeOf(subject) { return gradeById[gradeIdOf(subject)] || null; }

      UI.pageHeader(root, {
        title: 'รายวิชา',
        desc: 'คุณสมบัติของวิชาเป็นตัวกำหนดกฎการจัดตารางเกือบทั้งหมด',
        actions: [
          { label: '❓ ช่วยเหลือ', onClick: function () { global.ST.help.show('subjects'); } },
          { label: 'จัดการกลุ่มสาระ', onClick: function () { groupManager(); } },
          { label: '+ เพิ่มวิชา', className: 'btn--primary', onClick: function () { subjectForm(); } },
          { label: '📥 นำเข้าจากไฟล์', onClick: function () { app.go('import', { kind: 'subjects' }); } }
        ]
      });

      var groupSelect = U.elFromHTML('<select class="select" aria-label="กรองตามกลุ่มสาระ">' +
        '<option value="">ทุกกลุ่มสาระ</option>' +
        st.subjectGroups.map(function (g) {
          return '<option value="' + g.id + '"' + (filterGroup === g.id ? ' selected' : '') + '>' + U.esc(g.name) + '</option>';
        }).join('') + '</select>');
      groupSelect.addEventListener('change', function () {
        filterGroup = groupSelect.value;
        app.refresh();
      });

      var gradeCounts = {};
      st.subjects.forEach(function (s) {
        var id = gradeIdOf(s);
        if (id) gradeCounts[id] = (gradeCounts[id] || 0) + 1;
      });
      var gradesWithSubjects = grades.filter(function (g) { return !!gradeCounts[g.id]; });
      if (filterGrade && !gradeCounts[filterGrade]) filterGrade = '';
      var gradeSelect = U.elFromHTML('<select class="select" aria-label="กรองตามระดับชั้น">' +
        '<option value="">ทุกระดับชั้น</option>' +
        gradesWithSubjects.map(function (g) {
          var count = gradeCounts[g.id] || 0;
          return '<option value="' + g.id + '"' + (filterGrade === g.id ? ' selected' : '') + '>' +
            U.esc(g.name) + ' (' + count + ')</option>';
        }).join('') + '</select>');
      gradeSelect.addEventListener('change', function () {
        filterGrade = gradeSelect.value;
        app.refresh();
      });

      var subjectRows = st.subjects.slice().sort(function (a, b) {
        var ga = gradeOf(a), gb = gradeOf(b);
        var ao = ga ? U.num(ga.order) : 9999, bo = gb ? U.num(gb.order) : 9999;
        return ao - bo || String(a.code).localeCompare(String(b.code), 'th');
      });

      var card = U.elFromHTML('<div class="card"></div>');
      var table = UI.dataTable({
        rows: subjectRows,
        tools: [gradeSelect, groupSelect],
        searchPlaceholder: 'ค้นหารหัสหรือชื่อวิชา…',
        filter: function (s, term) {
          var grade = gradeOf(s);
          var gradeText = grade ? grade.name : '';
          return (s.code + ' ' + s.name + ' ' + gradeText).toLowerCase().indexOf(term) !== -1;
        },
        extraFilter: function (s) {
          return (!filterGroup || s.subjectGroupId === filterGroup) &&
            (!filterGrade || gradeIdOf(s) === filterGrade);
        },
        empty: {
          icon: '📘', title: 'ยังไม่มีรายวิชาในระบบ',
          desc: 'เพิ่มรายวิชาที่โรงเรียนเปิดสอน หรือใช้การนำเข้าจากไฟล์',
          actions: [
            { label: 'เพิ่มวิชา', onClick: function () { subjectForm(); } },
            { label: 'นำเข้าจากไฟล์', className: 'btn', onClick: function () { app.go('import', { kind: 'subjects' }); } }
          ]
        },
        columns: [
          {
            label: 'รายวิชา', className: 'subject-col-main', render: function (s) {
              var g = U.byId(st.subjectGroups, s.subjectGroupId);
              return '<div class="subject-name">' +
                '<span class="subject-color" style="background:' + U.esc((g && g.color) || '#94a3b8') + '" aria-hidden="true"></span>' +
                '<span><span class="subject-code">' + U.esc(s.code) + '</span>' +
                '<span class="subject-title">' + U.esc(s.name) + '</span></span></div>' +
                '<div class="subject-group">กลุ่มสาระ: ' + U.esc(g ? g.name : 'ไม่ระบุกลุ่มสาระ') + '</div>';
            }
          },
          { label: 'ชื่อย่อในตาราง', className: 'subject-col-short', render: function (s) {
            return '<span class="subject-short-name">' + U.esc(s.shortName || '-') + '</span>';
          } },
          {
            label: 'ระดับชั้น', className: 'subject-col-grades', render: function (s) {
              var grade = gradeOf(s);
              return grade
                ? '<span class="badge badge--grade">' + U.esc(grade.name) + '</span>'
                : '<span class="badge badge--danger">ยังไม่ระบุ</span>';
            }
          },
          {
            label: 'คุณสมบัติ', className: 'subject-col-tags', render: function (s) {
              var tags = [];
              if (s.isCore) tags.push('<span class="badge badge--info">หลัก</span>');
              if (s.doubleMode === 'STRICT') tags.push('<span class="badge badge--warning">คาบคู่ (ห้ามแยก)</span>');
              if (s.doubleMode === 'PREFERRED') tags.push('<span class="badge badge--warning">คาบคู่ (แยกได้)</span>');
              if (s.isElective) tags.push('<span class="badge badge--locked">เลือกเสรี</span>');
              if (s.isActivity) tags.push('<span class="badge badge--muted">กิจกรรม</span>');
              return tags.join(' ') || '<span class="muted">-</span>';
            }
          },
          {
            label: 'จัดการ', className: 'subject-col-actions', render: function (s) {
              return '<div class="row-actions">' +
                '<button type="button" class="btn btn--sm" data-act="edit" data-id="' + s.id + '">แก้ไข</button>' +
                '<button type="button" class="btn btn--sm" data-act="del" data-id="' + s.id + '">ลบ</button></div>';
            }
          }
        ],
        onRendered: function (body) {
          U.on(body, 'click', 'button[data-act="edit"]', function (ev, btn) {
            subjectForm(U.byId(st.subjects, btn.dataset.id));
          });
          U.on(body, 'click', 'button[data-act="del"]', function (ev, btn) {
            var s = U.byId(st.subjects, btn.dataset.id);
            UI.deleteWithGuard({
              what: 'วิชา', name: s.code + ' ' + s.name,
              references: M.referencesOfSubject(st, s.id),
              fix: 'ให้เอาวิชานี้ออกจากหลักสูตรและการจัดครูผู้สอนก่อน แล้วจึงลบวิชา'
            }).then(function (ok) {
              if (!ok) return;
              st.subjects = st.subjects.filter(function (x) { return x.id !== s.id; });
              app.saveAndRefresh('ลบวิชาแล้ว');
            });
          });
        }
      });
      card.appendChild(table);
      root.appendChild(card);

      function subjectForm(subject) {
        if (!st.subjectGroups.length) {
          U.explainDialog({
            title: 'เพิ่มวิชาไม่ได้',
            cause: 'ยังไม่มีกลุ่มสาระในระบบ วิชาต้องระบุกลุ่มสาระ',
            fix: 'ให้กดปุ่มจัดการกลุ่มสาระเพื่อเพิ่มกลุ่มสาระก่อน'
          });
          return;
        }
        if (!grades.length) {
          U.explainDialog({
            title: 'เพิ่มวิชาไม่ได้',
            cause: 'ยังไม่มีระดับชั้นในระบบ รายวิชาต้องระบุว่าใช้กับระดับชั้นใด',
            fix: 'ให้สร้างระดับชั้นก่อน แล้วกลับมาเพิ่มรายวิชาอีกครั้ง'
          });
          return;
        }
        UI.formModal({
          title: subject ? 'แก้ไขวิชา' : 'เพิ่มวิชา',
          size: 'md',
          values: subject ? Object.assign(U.deepClone(subject), { gradeLevelId: gradeIdOf(subject) }) : {
            code: '', name: '', shortName: '',
            subjectGroupId: st.subjectGroups[0].id,
            gradeLevelId: grades[0].id,
            isCore: false, doubleMode: 'NONE', isElective: false, isActivity: false
          },
          fields: [
            { name: 'code', label: 'รหัสวิชา', required: true, hint: 'เช่น ค21101 ต้องไม่ซ้ำกับวิชาอื่น' },
            { name: 'name', label: 'ชื่อวิชา', required: true },
            { name: 'shortName', label: 'ชื่อย่อ', hint: 'ใช้แสดงในช่องตารางที่แคบ เว้นว่างได้ ระบบจะย่อให้เอง' },
            {
              name: 'subjectGroupId', label: 'กลุ่มสาระ', type: 'select',
              options: st.subjectGroups.map(function (g) { return { value: g.id, label: g.name }; })
            },
            {
              name: 'gradeLevelId', label: 'ระดับชั้นที่เรียนวิชานี้', type: 'select', required: true,
              options: grades.map(function (g) { return { value: g.id, label: g.name }; }),
              hint: 'หนึ่งรายวิชาอยู่ได้เพียงหนึ่งระดับชั้น และจะแสดงเฉพาะในหลักสูตรของชั้นนี้'
            },
            {
              name: 'isCore', label: 'วิชาหลัก', type: 'checkbox',
              checkLabel: 'เป็นวิชาหลัก — ระบบจะพยายามจัดในช่วงเช้า'
            },
            {
              name: 'doubleMode', label: 'คาบคู่', type: 'select', options: DOUBLE_OPTIONS,
              hint: 'ห้ามแยก = ต้องได้คาบติดกันเสมอ ถ้าหาไม่ได้ถือว่าจัดไม่ลง'
            },
            {
              name: 'isElective', label: 'วิชาเลือกเสรี', type: 'checkbox',
              checkLabel: 'เป็นวิชาเลือกเสรี — ต้องจัดพร้อมกันทั้งระดับชั้น'
            },
            {
              name: 'isActivity', label: 'คาบพิเศษ', type: 'checkbox',
              checkLabel: 'เป็นคาบพิเศษ เช่น โฮมรูม ลูกเสือ ชุมนุม'
            }
          ],
          onSubmit: function (v) {
            var errors = {};
            var code = String(v.code || '').trim();
            var name = String(v.name || '').trim();
            if (!code) errors.code = 'ต้องกรอกรหัสวิชา';
            if (!name) errors.name = 'ต้องกรอกชื่อวิชา';
            if (!v.gradeLevelId) errors.gradeLevelId = 'ต้องเลือกระดับชั้น';
            if (code && st.subjects.some(function (s) {
              return s.code === code && gradeIdOf(s) === v.gradeLevelId && (!subject || s.id !== subject.id);
            })) errors.code = 'มีรหัสวิชานี้ในระดับชั้นที่เลือกแล้ว';
            if (Object.keys(errors).length) return { ok: false, errors: errors };

            var oldGradeId = subject ? gradeIdOf(subject) : '';
            var target = subject || { id: U.uid('sj') };
            target.code = code;
            target.name = name;
            target.shortName = String(v.shortName || '').trim() || U.abbreviate(name, 10);
            target.subjectGroupId = v.subjectGroupId;
            target.gradeLevelId = v.gradeLevelId;
            delete target.gradeLevelIds;
            target.isCore = !!v.isCore;
            target.doubleMode = v.doubleMode;
            target.isElective = !!v.isElective;
            target.isActivity = !!v.isActivity;
            target.updatedAt = new Date().toISOString();
            if (!subject) { target.createdAt = target.updatedAt; st.subjects.push(target); }

            /* เตือนเมื่อคาบคู่แต่หลักสูตรกำหนดเป็นเลขคี่ */
            if (v.doubleMode !== 'NONE') {
              var odd = st.curriculumItems.filter(function (ci) {
                return ci.subjectId === target.id && U.num(ci.periodsPerWeek) % 2 === 1;
              });
              if (odd.length) {
                U.toast('วิชานี้เป็นคาบคู่ แต่มี ' + odd.length +
                  ' ระดับชั้นที่กำหนดจำนวนคาบเป็นเลขคี่ จะเหลือเศษ 1 คาบที่ต้องจัดเดี่ยว', 'warning', 9000);
              }
            }
            /* เมื่อตัดระดับชั้นออก ให้ลบวิชานี้จากหลักสูตรระดับนั้นและข้อมูลร่างที่ต่อเนื่องกัน */
            var removedCurriculumIds = {};
            st.curricula.forEach(function (c) {
              if (c.gradeLevelId !== target.gradeLevelId) removedCurriculumIds[c.id] = true;
            });
            var removedItems = st.curriculumItems.filter(function (ci) {
              return ci.subjectId === target.id && removedCurriculumIds[ci.curriculumId];
            }).length;
            if (removedItems) {
              st.curriculumItems = st.curriculumItems.filter(function (ci) {
                return !(ci.subjectId === target.id && removedCurriculumIds[ci.curriculumId]);
              });
            }

            M.syncAssignments(st);
            var validAssignmentIds = {};
            st.assignments.forEach(function (a) { validAssignmentIds[a.id] = true; });
            st.timetables.forEach(function (t) {
              if (t.status !== 'DRAFT') return;
              t.entries = t.entries.filter(function (e) { return validAssignmentIds[e.assignmentId]; });
            });
            var gradeChanged = !!oldGradeId && oldGradeId !== target.gradeLevelId;
            var message = 'บันทึกวิชาและระดับชั้นแล้ว';
            if (removedItems) message += ' · ปรับหลักสูตรที่เกี่ยวข้อง ' + removedItems + ' รายการ';
            else if (gradeChanged) message += ' · ไม่พบหลักสูตรที่ต้องลบตาม';
            app.saveAndRefresh(message);
          }
        });
      }

      function groupManager() {
        var body = document.createElement('div');
        body.className = 'subject-group-manager';
        function paint() {
          var totalSubjects = st.subjects.length;
          body.innerHTML = '<div class="subject-group-summary"><div><b>กลุ่มสาระทั้งหมด ' +
            U.fmtNum(st.subjectGroups.length) + ' กลุ่ม</b><span>ใช้สีช่วยแยกรายวิชาในตารางเรียนและตารางสอน</span></div>' +
            '<span class="subject-group-summary__total">' + U.fmtNum(totalSubjects) + ' วิชา</span></div>' +
            '<section class="subject-group-create"><div class="subject-group-create__head"><b>เพิ่มกลุ่มสาระใหม่</b>' +
            '<span>ตั้งชื่อและเลือกสีที่จำง่าย</span></div><div class="subject-group-create__form">' +
            '<input class="input" id="newGroupName" placeholder="เช่น วิทยาศาสตร์และเทคโนโลยี" aria-label="ชื่อกลุ่มสาระใหม่">' +
            '<label class="subject-group-color" title="เลือกสีประจำกลุ่ม"><input type="color" id="newGroupColor" value="#2563eb">' +
            '<span id="newGroupColorDot" style="background:#2563eb"></span><span>เลือกสี</span></label>' +
            '<button type="button" class="btn btn--primary" id="addGroup">+ เพิ่มกลุ่ม</button></div></section>' +
            '<div class="subject-group-grid">' +
            st.subjectGroups.map(function (g) {
              var count = st.subjects.filter(function (s) { return s.subjectGroupId === g.id; }).length;
              return '<article class="subject-group-card" style="--group-color:' + U.esc(g.color || '#94a3b8') + '">' +
                '<span class="subject-group-card__color" aria-hidden="true"></span><div class="subject-group-card__info">' +
                '<b>' + U.esc(g.name) + '</b><span>' + (count ? U.fmtNum(count) + ' รายวิชา' : 'ยังไม่มีรายวิชา') + '</span></div>' +
                '<span class="subject-group-card__count">' + U.fmtNum(count) + '</span>' +
                '<button type="button" class="subject-group-card__delete" data-del="' + g.id + '" aria-label="ลบกลุ่มสาระ ' +
                U.esc(g.name) + '" title="ลบกลุ่มสาระ">ลบ</button></article>';
            }).join('') + '</div>';

          var nameInput = body.querySelector('#newGroupName');
          var colorInput = body.querySelector('#newGroupColor');
          var addButton = body.querySelector('#addGroup');
          function addGroup() {
            var name = body.querySelector('#newGroupName').value.trim();
            if (!name) { U.toast('ต้องกรอกชื่อกลุ่มสาระก่อน จึงจะเพิ่มได้', 'danger'); return; }
            if (st.subjectGroups.some(function (g) { return String(g.name).trim().toLowerCase() === name.toLowerCase(); })) {
              U.toast('มีกลุ่มสาระชื่อนี้อยู่แล้ว', 'warning');
              nameInput.focus();
              return;
            }
            st.subjectGroups.push({ id: U.uid('sg'), name: name, color: colorInput.value });
            global.ST.store.save();
            paint();
            U.toast('เพิ่มกลุ่มสาระแล้ว', 'success');
          }
          addButton.addEventListener('click', addGroup);
          nameInput.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter') { ev.preventDefault(); addGroup(); }
          });
          colorInput.addEventListener('input', function () {
            body.querySelector('#newGroupColorDot').style.background = colorInput.value;
          });
        }
        paint();
        U.on(body, 'click', 'button[data-del]', function (ev, btn) {
          var g = U.byId(st.subjectGroups, btn.dataset.del);
          if (!g) return;
          var used = st.subjects.filter(function (s) { return s.subjectGroupId === g.id; }).length +
            st.teachers.filter(function (t) { return t.subjectGroupId === g.id; }).length;
          if (used) {
            U.explainDialog({
              title: 'ลบกลุ่มสาระนี้ไม่ได้',
              cause: 'กลุ่มสาระ "' + g.name + '" ถูกใช้อยู่กับวิชาและครูรวม ' + used + ' รายการ',
              fix: 'ให้ย้ายวิชาและครูเหล่านั้นไปกลุ่มสาระอื่นก่อน แล้วจึงลบ'
            });
            return;
          }
          st.subjectGroups = st.subjectGroups.filter(function (x) { return x.id !== g.id; });
          global.ST.store.save();
          paint();
        });
        U.openModal({
          title: 'จัดการกลุ่มสาระ', size: 'md', content: body,
          buttons: [{ label: 'ปิด', className: 'btn--primary', onClick: function () { app.refresh(); } }]
        });
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
