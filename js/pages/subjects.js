/* หน้า P4 — รายวิชา */
(function (global) {
  'use strict';
  var U = global.ST.util, M = global.ST.model, UI = global.ST.ui;
  global.ST.pages = global.ST.pages || {};

  var filterGroup = '';

  var DOUBLE_OPTIONS = [
    { value: 'NONE', label: 'ไม่ใช่คาบคู่' },
    { value: 'STRICT', label: 'คาบคู่ ห้ามแยก' },
    { value: 'PREFERRED', label: 'คาบคู่ แยกได้เมื่อจำเป็น' }
  ];

  global.ST.pages.subjects = {
    render: function (root) {
      var app = global.ST.app;
      var st = app.state();

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

      var card = U.elFromHTML('<div class="card"></div>');
      var table = UI.dataTable({
        rows: st.subjects,
        tools: [groupSelect],
        searchPlaceholder: 'ค้นหารหัสหรือชื่อวิชา…',
        filter: function (s, term) {
          return (s.code + ' ' + s.name).toLowerCase().indexOf(term) !== -1;
        },
        extraFilter: function (s) { return !filterGroup || s.subjectGroupId === filterGroup; },
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
        UI.formModal({
          title: subject ? 'แก้ไขวิชา' : 'เพิ่มวิชา',
          size: 'md',
          values: subject ? U.deepClone(subject) : {
            code: '', name: '', shortName: '',
            subjectGroupId: st.subjectGroups[0].id,
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
            if (code && st.subjects.some(function (s) {
              return s.code === code && (!subject || s.id !== subject.id);
            })) errors.code = 'มีวิชารหัสนี้อยู่แล้ว ให้ใช้รหัสอื่น';
            if (Object.keys(errors).length) return { ok: false, errors: errors };

            var target = subject || { id: U.uid('sj') };
            target.code = code;
            target.name = name;
            target.shortName = String(v.shortName || '').trim() || U.abbreviate(name, 10);
            target.subjectGroupId = v.subjectGroupId;
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
            M.syncAssignments(st);
            app.saveAndRefresh('บันทึกวิชาแล้ว');
          }
        });
      }

      function groupManager() {
        var body = document.createElement('div');
        function paint() {
          body.innerHTML = '<div class="table-wrap"><table class="data"><thead><tr>' +
            '<th>กลุ่มสาระ</th><th class="num">จำนวนวิชา</th><th></th></tr></thead><tbody>' +
            st.subjectGroups.map(function (g) {
              var count = st.subjects.filter(function (s) { return s.subjectGroupId === g.id; }).length;
              return '<tr><td><span class="dot" style="background:' + U.esc(g.color) + '"></span> ' + U.esc(g.name) + '</td>' +
                '<td class="num">' + count + '</td>' +
                '<td><button type="button" class="btn btn--sm" data-del="' + g.id + '">ลบ</button></td></tr>';
            }).join('') + '</tbody></table></div>' +
            '<div class="flex gap-8 mt-16"><input class="input" id="newGroupName" placeholder="ชื่อกลุ่มสาระใหม่">' +
            '<input type="color" class="input" id="newGroupColor" value="#5b50ef" style="width:70px">' +
            '<button type="button" class="btn btn--primary" id="addGroup">เพิ่ม</button></div>';
          body.querySelector('#addGroup').addEventListener('click', function () {
            var name = body.querySelector('#newGroupName').value.trim();
            if (!name) { U.toast('ต้องกรอกชื่อกลุ่มสาระก่อน จึงจะเพิ่มได้', 'danger'); return; }
            st.subjectGroups.push({ id: U.uid('sg'), name: name, color: body.querySelector('#newGroupColor').value });
            global.ST.store.save();
            paint();
            U.toast('เพิ่มกลุ่มสาระแล้ว', 'success');
          });
          U.on(body, 'click', 'button[data-del]', function (ev, btn) {
            var g = U.byId(st.subjectGroups, btn.dataset.del);
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
        }
        paint();
        U.openModal({
          title: 'จัดการกลุ่มสาระ', size: 'md', content: body,
          buttons: [{ label: 'ปิด', className: 'btn--primary', onClick: function () { app.refresh(); } }]
        });
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
