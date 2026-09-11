/* หน้า P5 — ครู */
(function (global) {
  'use strict';
  var U = global.ST.util, M = global.ST.model, UI = global.ST.ui;
  global.ST.pages = global.ST.pages || {};

  var filterGroup = '';
  var onlyOver = false;

  global.ST.pages.teachers = {
    render: function (root) {
      var app = global.ST.app;
      var st = app.state();
      var load = M.teacherAssignedLoad(st);
      var days = st.periodConfig.days;

      UI.pageHeader(root, {
        title: 'ครู',
        desc: 'รายชื่อครู วันที่มาสอน โควตาภาระงาน และคาบที่ไม่สะดวกสอน',
        actions: [
          { label: '❓ ช่วยเหลือ', onClick: function () { global.ST.help.show('teachers'); } },
          { label: '+ เพิ่มครู', className: 'btn--primary', onClick: function () { teacherForm(); } },
          { label: '📥 นำเข้าจากไฟล์', onClick: function () { app.go('import', { kind: 'teachers' }); } }
        ]
      });

      var overCount = st.teachers.filter(function (t) { return load[t.id] > U.num(t.maxPeriodsPerWeek); }).length;
      if (overCount) {
        root.appendChild(U.elFromHTML(
          '<div class="result-card result-card--danger"><div class="result-card__title">⚠ มีครู ' +
          U.fmtNum(overCount) + ' คนถูกมอบหมายเกินโควตา</div>' +
          '<div class="result-card__line">สาเหตุ: ภาระงานที่มอบหมายไว้ในหน้าจัดครูผู้สอน มากกว่าคาบสูงสุดต่อสัปดาห์ที่ตั้งไว้</div>' +
          '<div class="result-card__line">วิธีแก้: ให้เพิ่มโควตาของครูเหล่านี้ หรือย้ายบางวิชาไปให้ครูคนอื่นสอน มิฉะนั้นจะกดจัดตารางไม่ได้</div></div>'
        ));
      }

      var groupSelect = U.elFromHTML('<select class="select" aria-label="กรองตามกลุ่มสาระ">' +
        '<option value="">ทุกกลุ่มสาระ</option>' +
        st.subjectGroups.map(function (g) {
          return '<option value="' + g.id + '"' + (filterGroup === g.id ? ' selected' : '') + '>' + U.esc(g.name) + '</option>';
        }).join('') + '</select>');
      groupSelect.addEventListener('change', function () { filterGroup = groupSelect.value; app.refresh(); });

      var overToggle = U.elFromHTML('<label class="chip' + (onlyOver ? ' is-on' : '') + '">' +
        '<input type="checkbox"' + (onlyOver ? ' checked' : '') + '>เฉพาะครูที่เกินโควตา</label>');
      overToggle.addEventListener('change', function () { onlyOver = overToggle.querySelector('input').checked; app.refresh(); });

      var card = U.elFromHTML('<div class="card"></div>');
      card.appendChild(UI.dataTable({
        rows: st.teachers,
        tools: [groupSelect, overToggle],
        searchPlaceholder: 'ค้นหาชื่อครู…',
        filter: function (t, term) { return t.name.toLowerCase().indexOf(term) !== -1; },
        extraFilter: function (t) {
          if (filterGroup && t.subjectGroupId !== filterGroup) return false;
          if (onlyOver && load[t.id] <= U.num(t.maxPeriodsPerWeek)) return false;
          return true;
        },
        empty: {
          icon: '👩‍🏫', title: 'ยังไม่มีรายชื่อครูในระบบ',
          desc: 'เพิ่มรายชื่อครูทีละคน หรือใช้การนำเข้าจากไฟล์ Excel',
          actions: [
            { label: 'เพิ่มครู', onClick: function () { teacherForm(); } },
            { label: 'นำเข้าจากไฟล์', className: 'btn', onClick: function () { app.go('import', { kind: 'teachers' }); } }
          ]
        },
        columns: [
          {
            label: 'ชื่อ–นามสกุล', render: function (t) {
              var g = U.byId(st.subjectGroups, t.subjectGroupId);
              return '<b>' + U.esc(t.name) + '</b><div class="small muted">' +
                U.esc(g ? g.name : 'ไม่ระบุกลุ่มสาระ') + ' · ชื่อย่อ ' + U.esc(t.shortName || '-') + '</div>';
            }
          },
          { label: 'วันที่มาสอน', render: function (t) { return UI.dayChips(t.availableDays, days); } },
          {
            label: 'ภาระงาน', render: function (t) {
              return UI.workloadBar(load[t.id] || 0, U.num(t.maxPeriodsPerWeek));
            }
          },
          {
            label: 'สูงสุด/วัน', className: 'num', render: function (t) {
              return U.num(t.maxPeriodsPerDay) + ' คาบ';
            }
          },
          {
            label: 'คาบไม่สะดวก', render: function (t) {
              var list = t.unavailableSlots || [];
              if (!list.length) return '<span class="muted">-</span>';
              return list.map(function (s) {
                return '<span class="badge badge--muted">' + U.DAY_SHORT[s.day] + ' คาบ ' + s.periodNo + '</span>';
              }).join(' ');
            }
          },
          {
            label: '', render: function (t) {
              return '<div class="row-actions">' +
                '<button type="button" class="btn btn--sm" data-act="edit" data-id="' + t.id + '">แก้ไข</button>' +
                '<button type="button" class="btn btn--sm" data-act="del" data-id="' + t.id + '">ลบ</button></div>';
            }
          }
        ],
        onRendered: function (body) {
          U.on(body, 'click', 'button[data-act="edit"]', function (ev, btn) {
            teacherForm(U.byId(st.teachers, btn.dataset.id));
          });
          U.on(body, 'click', 'button[data-act="del"]', function (ev, btn) {
            var t = U.byId(st.teachers, btn.dataset.id);
            UI.deleteWithGuard({
              what: 'ครู', name: t.name,
              references: M.referencesOfTeacher(st, t.id),
              fix: 'ให้เปลี่ยนครูผู้สอนของรายการเหล่านี้เป็นคนอื่นก่อนในหน้าจัดครูผู้สอน แล้วจึงลบครูคนนี้'
            }).then(function (ok) {
              if (!ok) return;
              st.teachers = st.teachers.filter(function (x) { return x.id !== t.id; });
              app.saveAndRefresh('ลบครูแล้ว');
            });
          });
        }
      }));
      root.appendChild(card);

      function teacherForm(teacher) {
        var busy = teacher ? U.deepClone(teacher.unavailableSlots || []) : [];
        var extra = document.createElement('div');
        extra.className = 'teacher-unavailable';

        function selectedMap() {
          var map = {};
          busy.forEach(function (s) { map[s.day + '#' + s.periodNo] = true; });
          return map;
        }
        function paintPicker() {
          extra.innerHTML = '<div class="teacher-unavailable__head"><span class="teacher-unavailable__number">4</span><div><b>คาบที่ไม่สะดวกสอน</b>' +
            '<span>แตะช่องเวลาเพื่อทำเครื่องหมาย ระบบจะไม่จัดคาบสอนให้ในช่วงนั้น</span></div>' +
            '<span class="teacher-unavailable__count">เลือกแล้ว ' + U.fmtNum(busy.length) + ' คาบ</span></div>';
          extra.appendChild(UI.weekPicker(st, {
            selected: selectedMap(),
            labelFor: function () { return 'ไม่สะดวก'; },
            onToggle: function (day, periodNo, turnOn) {
              if (turnOn) busy.push({ day: day, periodNo: periodNo });
              else busy = busy.filter(function (s) { return !(s.day === day && s.periodNo === periodNo); });
              paintPicker();
            }
          }));
          extra.appendChild(U.elFromHTML('<div class="teacher-unavailable__hint">ตัวอย่าง: ครูมีประชุมประจำทุกวันพุธคาบ 7 ให้แตะช่อง “พ · คาบ 7”</div>'));
        }
        paintPicker();

        var values = teacher ? U.deepClone(teacher) : {
          name: '', shortName: '',
          subjectGroupId: st.subjectGroups.length ? st.subjectGroups[0].id : '',
          availableDays: st.periodConfig.days.slice(),
          maxPeriodsPerDay: Math.min(6, M.maxPeriodNo(st) || 6),
          maxPeriodsPerWeek: 25
        };

        UI.formModal({
          title: teacher ? 'แก้ไขข้อมูลครู' : 'เพิ่มครู',
          size: 'lg',
          formClass: 'teacher-form',
          values: values,
          fields: [
            { type: 'section', label: 'ข้อมูลครู', hint: 'ข้อมูลที่ใช้แสดงในตารางและค้นหารายชื่อ', icon: '1' },
            { name: 'name', label: 'ชื่อ–นามสกุล', required: true, hint: 'กรอกชื่อจริงและนามสกุลให้ครบ' },
            { name: 'shortName', label: 'ชื่อย่อ', hint: 'ใช้แสดงในช่องตารางที่แคบ เว้นว่างได้' },
            {
              name: 'subjectGroupId', label: 'กลุ่มสาระที่สอน', type: 'select', className: 'teacher-form__wide',
              options: [{ value: '', label: 'ไม่ระบุ' }].concat(st.subjectGroups.map(function (g) {
                return { value: g.id, label: g.name };
              }))
            },
            { type: 'section', label: 'วันที่มาสอน', hint: 'เลือกเฉพาะวันที่ครูสามารถเข้าสอนได้', icon: '2' },
            {
              name: 'availableDays', label: 'เลือกวัน', type: 'days', className: 'teacher-form__wide teacher-form__days',
              dayOptions: st.periodConfig.days, hint: 'ปุ่มสีน้ำเงินคือวันที่ครูมาสอน หากเป็นครูพิเศษให้ปิดวันที่ไม่เข้าสอน'
            },
            { type: 'section', label: 'ขีดจำกัดภาระงาน', hint: 'ระบบจะไม่จัดสอนเกินจำนวนที่กำหนด', icon: '3' },
            {
              name: 'maxPeriodsPerDay', label: 'สอนได้สูงสุดต่อวัน', type: 'number', min: 1,
              max: M.maxPeriodNo(st), suffix: 'คาบ', hint: 'จำนวนคาบสูงสุดในหนึ่งวัน'
            },
            {
              name: 'maxPeriodsPerWeek', label: 'สอนได้สูงสุดต่อสัปดาห์', type: 'number', min: 1,
              max: M.slotsPerWeek(st), suffix: 'คาบ', hint: 'รวมคาบสอนทุกวันในหนึ่งสัปดาห์'
            }
          ],
          onSubmit: function (v) {
            var errors = {};
            var name = String(v.name || '').trim();
            if (!name) errors.name = 'ต้องกรอกชื่อ–นามสกุล';
            if (!v.availableDays || !v.availableDays.length) errors.availableDays = 'ต้องเลือกวันที่มาสอนอย่างน้อย 1 วัน';
            if (U.num(v.maxPeriodsPerDay) < 1) errors.maxPeriodsPerDay = 'ต้องมากกว่า 0';
            if (U.num(v.maxPeriodsPerDay) > M.maxPeriodNo(st)) {
              errors.maxPeriodsPerDay = 'มากกว่าจำนวนคาบสูงสุดที่มีในหนึ่งวัน (' + M.maxPeriodNo(st) + ' คาบ)';
            }
            if (U.num(v.maxPeriodsPerWeek) < 1) errors.maxPeriodsPerWeek = 'ต้องมากกว่า 0';
            if (U.num(v.maxPeriodsPerWeek) > M.slotsPerWeek(st)) {
              errors.maxPeriodsPerWeek = 'มากกว่าจำนวนคาบที่มีจริงในหนึ่งสัปดาห์ (' + M.slotsPerWeek(st) + ' คาบ)';
            }
            if (Object.keys(errors).length) return { ok: false, errors: errors };

            var target = teacher || { id: U.uid('tc'), createdAt: new Date().toISOString() };
            target.name = name;
            target.shortName = String(v.shortName || '').trim() || U.teacherShort(name);
            target.subjectGroupId = v.subjectGroupId;
            target.availableDays = v.availableDays;
            target.maxPeriodsPerDay = U.num(v.maxPeriodsPerDay);
            target.maxPeriodsPerWeek = U.num(v.maxPeriodsPerWeek);
            target.unavailableSlots = busy;
            target.updatedAt = new Date().toISOString();
            if (!teacher) st.teachers.push(target);

            var assigned = M.teacherAssignedLoad(st)[target.id] || 0;
            if (assigned > target.maxPeriodsPerWeek) {
              U.toast('ครู' + target.name + ' ถูกมอบหมายไว้ ' + assigned + ' คาบ ซึ่งเกินโควตา ' +
                target.maxPeriodsPerWeek + ' คาบต่อสัปดาห์ จะกดจัดตารางไม่ได้จนกว่าจะแก้', 'danger', 9000);
            } else {
              var capacity = target.availableDays.length * target.maxPeriodsPerDay;
              if (assigned > capacity) {
                U.toast('วันที่ครู' + target.name + ' มาสอนรองรับได้เพียง ' + capacity +
                  ' คาบ แต่ถูกมอบหมาย ' + assigned + ' คาบ ขาดอีก ' + (assigned - capacity) +
                  ' คาบ ให้เพิ่มวันที่มาสอนหรือคาบสูงสุดต่อวัน', 'warning', 9000);
              }
            }
            app.saveAndRefresh('บันทึกข้อมูลครูแล้ว');
          },
          extraNode: extra
        });

        /* แทรกผังคาบที่ไม่สะดวกเข้าไปในหน้าต่างฟอร์ม */
        var modalBody = document.querySelector('.modal-overlay:last-child .modal__body');
        if (modalBody) modalBody.appendChild(extra);
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
