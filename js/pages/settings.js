/* หน้า P2 — ตั้งค่าโรงเรียนและคาบเรียน + การจัดการข้อมูล */
(function (global) {
  'use strict';
  var U = global.ST.util, M = global.ST.model, UI = global.ST.ui, store = global.ST.store;
  global.ST.pages = global.ST.pages || {};

  /* ตัวอย่างผังสัปดาห์ — แต่ละวันมีจำนวนคาบไม่เท่ากันได้ */
  function periodPreview(cfg, morningEnd) {
    var maxNo = 0;
    cfg.days.forEach(function (d) {
      var list = (cfg.dayPlans[d] || {}).periods || [];
      list.forEach(function (p) { if (p.no > maxNo) maxNo = p.no; });
    });
    var html = '<div class="table-wrap"><table class="weekpicker"><thead><tr><th>วัน</th>';
    for (var i = 1; i <= maxNo; i++) html += '<th>คาบ ' + i + '</th>';
    html += '</tr></thead><tbody>';
    cfg.days.forEach(function (d) {
      var list = (cfg.dayPlans[d] || {}).periods || [];
      html += '<tr><th>' + U.DAY_NAMES[d] + '<div class="small muted">' +
        list.filter(function (p) { return !p.isBreak; }).length + ' คาบสอน</div></th>';
      for (var n = 1; n <= maxNo; n++) {
        var p = list.filter(function (x) { return x.no === n; })[0];
        if (!p) html += '<td><div class="wp-cell is-none">ไม่มีคาบ</div></td>';
        else if (p.isBreak) html += '<td><div class="wp-cell is-break">' + U.esc(p.label || 'พัก') +
          '<div class="small">' + U.esc(p.startTime) + '</div></div></td>';
        else if (p.no <= morningEnd) html += '<td><div class="wp-cell is-on">ช่วงเช้า<div class="small">' +
          U.esc(p.startTime) + '</div></div></td>';
        else html += '<td><div class="wp-cell">ช่วงบ่าย<div class="small">' + U.esc(p.startTime) + '</div></div></td>';
      }
      html += '</tr>';
    });
    html += '</tbody></table></div>' +
      '<div class="print-legend small muted mt-8">ช่องสีม่วง = ช่วงเช้า (ใช้ตัดสินเงื่อนไขวิชาที่ควรอยู่ช่วงเช้า) · ' +
      'ช่องลายทแยง = คาบพัก ระบบจะไม่จัดวิชาลงคาบนี้ · ช่องจาง = วันนั้นไม่มีคาบนี้</div>';
    return U.elFromHTML('<div>' + html + '</div>');
  }

  global.ST.pages.settings = {
    render: function (root) {
      var app = global.ST.app;
      var st = app.state();
      var draft = U.deepClone(st.periodConfig);

      UI.pageHeader(root, {
        title: 'ตั้งค่าโรงเรียนและคาบเรียน',
        desc: 'ข้อมูลพื้นฐานของโรงเรียน และโครงสร้างเวลาเรียนในหนึ่งสัปดาห์',
        actions: [
          { label: '❓ ช่วยเหลือ', onClick: function () { global.ST.help.show('settings'); } }
        ]
      });

      var saveStatus = U.createSaveIndicator(root);

      /* ---------- ข้อมูลโรงเรียน ---------- */
      var schoolCard = U.elFromHTML(
        '<div class="card"><div class="card__title">ข้อมูลโรงเรียน</div>' +
        '<div class="card__desc">ข้อมูลชุดนี้จะปรากฏบนหัวกระดาษของเอกสารที่พิมพ์ออกมา</div>' +
        '<div class="grid grid--2">' +
        '<div><div class="field"><label class="field__label" for="scName">ชื่อโรงเรียน <span class="text-danger">*</span></label>' +
        '<input class="input" id="scName" value="' + U.esc(st.school.name) + '"></div>' +
        '<div class="field"><label class="field__label" for="scDirector">ชื่อผู้อำนวยการ <span class="text-danger">*</span></label>' +
        '<input class="input" id="scDirector" value="' + U.esc(st.school.directorName) + '">' +
        '<div class="field__hint">ใช้ในช่องลงนามท้ายเอกสารที่พิมพ์</div></div>' +
        '<div class="grid grid--2">' +
        '<div class="field"><label class="field__label" for="scYear">ปีการศึกษา</label>' +
        '<input type="number" class="input" id="scYear" value="' + U.esc(st.school.academicYear) + '"></div>' +
        '<div class="field"><label class="field__label" for="scSem">ภาคเรียน</label>' +
        '<select class="select" id="scSem">' +
        '<option value="1"' + (st.school.semester === 1 ? ' selected' : '') + '>ภาคเรียนที่ 1</option>' +
        '<option value="2"' + (st.school.semester === 2 ? ' selected' : '') + '>ภาคเรียนที่ 2</option>' +
        '</select></div></div></div>' +
        '<div><div class="field"><label class="field__label">ตราโรงเรียน</label>' +
        '<div class="flex gap-16 items-center">' +
        '<div class="print-head__logo" id="logoBox">' +
        (st.school.logoData ? '<img src="' + U.esc(st.school.logoData) + '" alt="ตราโรงเรียน">' : 'ยังไม่มีตรา') +
        '</div>' +
        '<div><input type="file" id="logoFile" accept="image/*" class="input">' +
        '<div class="field__hint">ถ้าไม่มีตราโรงเรียน ระบบจะเว้นพื้นที่ไว้บนเอกสารที่พิมพ์</div>' +
        '<button type="button" class="btn btn--sm mt-8" id="logoClear">ลบตราโรงเรียน</button></div>' +
        '</div></div></div>' +
        '</div>' +
        '<div class="flex gap-8 mt-16"><button type="button" class="btn btn--primary" id="saveSchool">บันทึกข้อมูลโรงเรียน</button></div>' +
        '</div>'
      );
      root.appendChild(schoolCard);

      var pendingLogo = st.school.logoData;
      schoolCard.querySelector('#logoFile').addEventListener('change', function (ev) {
        var file = ev.target.files && ev.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          shrinkImage(String(reader.result), 220, function (dataUrl) {
            pendingLogo = dataUrl;
            schoolCard.querySelector('#logoBox').innerHTML = '<img src="' + dataUrl + '" alt="ตราโรงเรียน">';
            U.toast('เลือกตราโรงเรียนแล้ว อย่าลืมกดบันทึกข้อมูลโรงเรียน', 'info');
          });
        };
        reader.readAsDataURL(file);
      });
      schoolCard.querySelector('#logoClear').addEventListener('click', function () {
        pendingLogo = '';
        schoolCard.querySelector('#logoBox').textContent = 'ยังไม่มีตรา';
      });
      schoolCard.querySelector('#saveSchool').addEventListener('click', function () {
        var name = schoolCard.querySelector('#scName').value.trim();
        var director = schoolCard.querySelector('#scDirector').value.trim();
        if (!name) {
          U.explainDialog({
            title: 'บันทึกไม่ได้',
            cause: 'ยังไม่ได้กรอกชื่อโรงเรียน ซึ่งจำเป็นต้องใช้พิมพ์บนหัวกระดาษ',
            fix: 'ให้กรอกชื่อโรงเรียนในช่องชื่อโรงเรียน แล้วกดบันทึกอีกครั้ง'
          });
          return;
        }
        if (!director) {
          U.explainDialog({
            title: 'บันทึกไม่ได้',
            cause: 'ยังไม่ได้กรอกชื่อผู้อำนวยการ ซึ่งใช้ในช่องลงนามท้ายเอกสาร',
            fix: 'ให้กรอกชื่อผู้อำนวยการ แล้วกดบันทึกอีกครั้ง'
          });
          return;
        }
        st.school.name = name;
        st.school.directorName = director;
        st.school.academicYear = U.num(schoolCard.querySelector('#scYear').value) || st.school.academicYear;
        st.school.semester = U.num(schoolCard.querySelector('#scSem').value) || 1;
        st.school.logoData = pendingLogo;
        st.school.updatedAt = new Date().toISOString();
        saveStatus.show('saving', 'บันทึกอัตโนมัติ...');
        app.saveAndRefresh('บันทึกแล้ว');
        saveStatus.success('บันทึกข้อมูลโรงเรียนแล้ว');
      });

      /* ---------- ผังคาบเรียนรายวัน ---------- */
      var periodCard = U.elFromHTML(
        '<div class="card"><div class="card__title">ผังคาบเรียน</div>' +
        '<div class="card__desc">ตั้งได้ว่าแต่ละวันสอนกี่คาบ เริ่มกี่โมง และตั้ง “คาบพัก” ได้หลายช่วง ' +
        '(เช่น พักเช้า พักกลางวัน) พร้อมตั้งชื่อและความยาวเอง · วันที่ไม่เท่ากันก็ตั้งต่างกันได้ เช่น วันศุกร์เลิกเร็วกว่าวันอื่น</div>' +
        '<div class="field"><label class="field__label">วันเรียนในสัปดาห์</label><div class="chipset" id="pcDays"></div></div>' +
        '<div class="table-wrap"><table class="data" id="dayPlanTable"></table></div>' +
        '<div class="grid grid--2 mt-16">' +
        '<div class="field"><label class="field__label" for="pcMorning">คาบสุดท้ายของช่วงเช้า</label>' +
        '<select class="select" id="pcMorning"></select>' +
        '<div class="field__hint">ใช้ตัดสินเงื่อนไขวิชาที่ควรอยู่ช่วงเช้า · วันที่ไม่มีคาบนี้ ถือว่าทั้งวันเป็นช่วงเช้า</div></div>' +
        '<div class="field"><label class="field__label" for="pcTimeDay">แก้เวลารายคาบของวัน</label>' +
        '<select class="select" id="pcTimeDay"></select>' +
        '<div class="field__hint">เลือกวันแล้วแก้เวลาเริ่ม–เลิกของแต่ละคาบได้เอง</div></div>' +
        '</div>' +
        '<div id="periodTimes"></div>' +
        '<div class="mt-16" id="pcPreview"></div>' +
        '<div class="flex gap-8 mt-16 flex-wrap">' +
        '<button type="button" class="btn btn--primary" id="savePeriods">บันทึกผังคาบเรียน</button>' +
        '<button type="button" class="btn" id="resetTimes">คำนวณเวลาคาบใหม่อัตโนมัติ</button></div>' +
        '</div>'
      );
      root.appendChild(periodCard);

      var elDays = periodCard.querySelector('#pcDays');
      var elPlan = periodCard.querySelector('#dayPlanTable');
      var elMorning = periodCard.querySelector('#pcMorning');
      var elTimeDay = periodCard.querySelector('#pcTimeDay');
      var elTimes = periodCard.querySelector('#periodTimes');
      var elPreview = periodCard.querySelector('#pcPreview');
      var timeDay = draft.days[0] || 'MON';

      function planOf(day) {
        if (!draft.dayPlans[day]) {
          draft.dayPlans[day] = { periods: store.buildDayPeriods(8, 5, 8 * 60 + 30, 50, 50) };
        }
        return draft.dayPlans[day];
      }
      function lunchNoOf(day) {
        var found = 0;
        planOf(day).periods.forEach(function (p) { if (p.isBreak) found = p.no; });
        return found;
      }
      function maxNoOf() {
        var max = 0;
        draft.days.forEach(function (d) {
          planOf(d).periods.forEach(function (p) { if (p.no > max) max = p.no; });
        });
        return max || 1;
      }
      /* อ่านคาบพักปัจจุบันของวันเป็น map { periodNo: {label, minutes} } */
      function breaksOf(plan) {
        var b = {};
        plan.periods.forEach(function (p) {
          if (p.isBreak) b[p.no] = {
            label: p.label || 'พัก',
            minutes: Math.max(5, U.timeToMinutes(p.endTime) - U.timeToMinutes(p.startTime))
          };
        });
        return b;
      }
      function breaksSummary(plan) {
        var list = plan.periods.filter(function (p) { return p.isBreak; });
        if (!list.length) return '<span class="muted">ไม่มีคาบพัก</span>';
        return list.map(function (p) {
          var mins = Math.max(0, U.timeToMinutes(p.endTime) - U.timeToMinutes(p.startTime));
          return '<b>' + U.esc(p.label || 'พัก') + '</b> <span class="small muted">(คาบ ' + p.no + ' · ' + mins + ' น.)</span>';
        }).join('<br>');
      }

      function renderDays() {
        elDays.innerHTML = U.DAY_KEYS.map(function (d) {
          return '<label class="chip' + (draft.days.indexOf(d) !== -1 ? ' is-on' : '') + '" data-day="' + d + '">' +
            '<input type="checkbox"' + (draft.days.indexOf(d) !== -1 ? ' checked' : '') + '>' + U.DAY_NAMES[d] + '</label>';
        }).join('');
      }
      U.on(elDays, 'change', '.chip', function (ev, chip) {
        var d = chip.dataset.day;
        var idx = draft.days.indexOf(d);
        if (chip.querySelector('input').checked) { if (idx === -1) { draft.days.push(d); planOf(d); } }
        else if (idx !== -1) draft.days.splice(idx, 1);
        draft.days.sort(function (a, b) { return U.DAY_KEYS.indexOf(a) - U.DAY_KEYS.indexOf(b); });
        if (draft.days.indexOf(timeDay) === -1) timeDay = draft.days[0] || 'MON';
        renderDays();
        renderAll();
      });

      /* ตารางตั้งค่ารายวัน */
      function renderPlanTable() {
        if (!draft.days.length) {
          elPlan.innerHTML = '<tbody><tr><td class="muted" style="padding:16px">' +
            'ยังไม่ได้เลือกวันเรียน ให้ติ๊กวันเรียนอย่างน้อย 1 วันด้านบน</td></tr></tbody>';
          return;
        }
        elPlan.innerHTML = '<thead><tr><th>วัน</th><th class="num">จำนวนคาบ</th>' +
          '<th>เวลาเริ่มคาบแรก</th><th>คาบพัก</th><th class="num">คาบสอนจริง</th><th></th></tr></thead><tbody>' +
          draft.days.map(function (d) {
            var plan = planOf(d);
            var teach = plan.periods.filter(function (p) { return !p.isBreak; }).length;
            var first = plan.periods[0];
            return '<tr><td><b>' + U.DAY_NAMES[d] + '</b></td>' +
              '<td class="num"><input type="number" class="input" style="width:84px;text-align:right" min="1" max="15" ' +
              'data-count="' + d + '" value="' + plan.periods.length + '"></td>' +
              '<td><input type="time" class="input" style="width:130px" data-start="' + d + '" value="' +
              U.esc(first ? first.startTime : '08:30') + '"></td>' +
              '<td>' + breaksSummary(plan) +
              '<div class="mt-8"><button type="button" class="btn btn--sm" data-breaks="' + d + '">จัดการคาบพัก</button></div></td>' +
              '<td class="num">' + teach + ' คาบ</td>' +
              '<td><button type="button" class="btn btn--sm" data-copy="' + d + '">ใช้ผังวันนี้กับทุกวัน</button></td></tr>';
          }).join('') + '</tbody>';
      }

      function rebuildDay(day, count, breaks, startTime) {
        var startMin = U.timeToMinutes(startTime || '08:30');
        draft.dayPlans[day] = { periods: store.buildDayPeriods(count, breaks || {}, startMin, 50) };
      }

      U.on(elPlan, 'change', 'input[data-count]', function (ev, input) {
        var d = input.dataset.count;
        var count = Math.max(1, Math.min(15, U.num(input.value) || 1));
        input.value = count;
        var breaks = breaksOf(planOf(d));
        Object.keys(breaks).forEach(function (no) { if (Number(no) > count) delete breaks[no]; });
        var first = planOf(d).periods[0];
        rebuildDay(d, count, breaks, first ? first.startTime : '08:30');
        renderAll();
      });
      U.on(elPlan, 'change', 'input[data-start]', function (ev, input) {
        var d = input.dataset.start;
        var plan = planOf(d);
        rebuildDay(d, plan.periods.length, breaksOf(plan), input.value);
        renderAll();
      });
      U.on(elPlan, 'click', 'button[data-breaks]', function (ev, btn) {
        breaksModal(btn.dataset.breaks);
      });

      /* ตัวจัดการคาบพักหลายช่วงต่อวัน — ตั้งชื่อและความยาว (นาที) ได้เอง */
      function breaksModal(day) {
        var count = planOf(day).periods.length;
        var rows = planOf(day).periods.filter(function (p) { return p.isBreak; }).map(function (p) {
          return { no: p.no, label: p.label || 'พัก', minutes: Math.max(5, U.timeToMinutes(p.endTime) - U.timeToMinutes(p.startTime)) };
        });
        var body = document.createElement('div');
        function periodOptions(sel) {
          var o = '';
          for (var i = 1; i <= count; i++) o += '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>คาบ ' + i + '</option>';
          return o;
        }
        function paint() {
          body.innerHTML = '<div class="card__desc">เพิ่มคาบพักได้หลายช่วง เช่น พักเช้า พักกลางวัน · กำหนดชื่อและความยาว (นาที) ของแต่ละช่วงได้เอง (วันนี้มี ' + count + ' คาบ)</div>' +
            '<div id="brList"></div>' +
            '<button type="button" class="btn btn--sm mt-8" id="brAdd">+ เพิ่มคาบพัก</button>';
          var host = body.querySelector('#brList');
          host.innerHTML = rows.length ? rows.map(function (r, i) {
            return '<div class="flex gap-8 items-center flex-wrap mb-8" data-row="' + i + '">' +
              '<select class="select select--sm" data-f="no" style="min-width:110px" aria-label="คาบที่พัก">' + periodOptions(r.no) + '</select>' +
              '<input class="input" data-f="label" value="' + U.esc(r.label) + '" placeholder="ชื่อคาบพัก" style="min-width:150px" aria-label="ชื่อคาบพัก">' +
              '<input type="number" class="input" data-f="minutes" value="' + U.num(r.minutes) + '" min="5" max="180" style="width:96px" aria-label="ความยาว (นาที)"> <span class="small muted">นาที</span>' +
              '<button type="button" class="btn btn--sm btn--danger-ghost" data-del="' + i + '">ลบ</button></div>';
          }).join('') : '<div class="muted mb-8">ยังไม่มีคาบพักในวันนี้ กด “เพิ่มคาบพัก” เพื่อเริ่ม</div>';
          body.querySelector('#brAdd').addEventListener('click', function () {
            var used = {}; rows.forEach(function (r) { used[r.no] = true; });
            var def = 1; for (var i = 1; i <= count; i++) { if (!used[i]) { def = i; break; } }
            rows.push({ no: def, label: 'พัก', minutes: 50 }); paint();
          });
          U.on(host, 'click', 'button[data-del]', function (ev, b) { rows.splice(Number(b.dataset.del), 1); paint(); });
          U.on(host, 'change', 'select[data-f="no"]', function (ev, el) { rows[Number(el.closest('[data-row]').dataset.row)].no = U.num(el.value); });
          U.on(host, 'input', 'input[data-f="label"]', function (ev, el) { rows[Number(el.closest('[data-row]').dataset.row)].label = el.value; });
          U.on(host, 'input', 'input[data-f="minutes"]', function (ev, el) { rows[Number(el.closest('[data-row]').dataset.row)].minutes = U.num(el.value); });
        }
        paint();
        U.openModal({
          title: 'คาบพักของวัน' + U.DAY_NAMES[day], size: 'md', content: body,
          buttons: [
            { label: 'ยกเลิก', className: 'btn--ghost' },
            {
              label: 'ใช้คาบพักนี้', className: 'btn--primary', onClick: function () {
                var breaks = {};
                rows.forEach(function (r) {
                  if (r.no >= 1 && r.no <= count) breaks[r.no] = { label: (r.label || 'พัก').trim() || 'พัก', minutes: Math.max(5, U.num(r.minutes) || 50) };
                });
                var first = planOf(day).periods[0];
                rebuildDay(day, count, breaks, first ? first.startTime : '08:30');
                renderAll();
              }
            }
          ]
        });
      }
      U.on(elPlan, 'click', 'button[data-copy]', function (ev, btn) {
        var src = btn.dataset.copy;
        draft.days.forEach(function (d) {
          if (d === src) return;
          draft.dayPlans[d] = { periods: U.deepClone(planOf(src).periods) };
        });
        renderAll();
        U.toast('ใช้ผังของวัน' + U.DAY_NAMES[src] + ' กับทุกวันเรียนแล้ว', 'info');
      });

      function renderSelects() {
        var maxNo = maxNoOf();
        var morning = U.num(draft.morningEndsAtPeriod);
        if (morning > maxNo) { morning = maxNo; draft.morningEndsAtPeriod = maxNo; }
        var opts = '';
        for (var i = 1; i <= maxNo; i++) {
          opts += '<option value="' + i + '"' + (i === morning ? ' selected' : '') + '>คาบ ' + i + '</option>';
        }
        elMorning.innerHTML = opts;
        elTimeDay.innerHTML = draft.days.map(function (d) {
          return '<option value="' + d + '"' + (d === timeDay ? ' selected' : '') + '>' + U.DAY_NAMES[d] + '</option>';
        }).join('');
      }
      elMorning.addEventListener('change', function () {
        draft.morningEndsAtPeriod = U.num(elMorning.value);
        renderPreview();
      });
      elTimeDay.addEventListener('change', function () {
        timeDay = elTimeDay.value;
        renderTimes();
      });

      function renderTimes() {
        if (!draft.days.length) { elTimes.innerHTML = ''; return; }
        if (draft.days.indexOf(timeDay) === -1) timeDay = draft.days[0];
        var plan = planOf(timeDay);
        var html = '<div class="card__desc mt-8">เวลาของวัน' + U.DAY_NAMES[timeDay] + '</div>' +
          '<div class="table-wrap"><table class="data"><thead><tr>' +
          '<th>คาบ</th><th>เวลาเริ่ม</th><th>เวลาเลิก</th><th>ชนิด</th></tr></thead><tbody>';
        plan.periods.forEach(function (p, i) {
          html += '<tr><td>คาบ ' + p.no + '</td>' +
            '<td><input type="time" class="input" data-time="start" data-i="' + i + '" value="' + U.esc(p.startTime) + '"></td>' +
            '<td><input type="time" class="input" data-time="end" data-i="' + i + '" value="' + U.esc(p.endTime) + '"></td>' +
            '<td>' + (p.isBreak ? '<span class="badge badge--muted">' + U.esc(p.label || 'พัก') + '</span>'
              : '<span class="badge badge--info">คาบเรียน</span>') + '</td></tr>';
        });
        html += '</tbody></table></div>';
        elTimes.innerHTML = html;
      }
      U.on(elTimes, 'change', 'input[data-time]', function (ev, input) {
        var i = Number(input.dataset.i);
        var plan = planOf(timeDay);
        if (!plan.periods[i]) return;
        if (input.dataset.time === 'start') plan.periods[i].startTime = input.value;
        else plan.periods[i].endTime = input.value;
        renderPreview();
      });

      function renderPreview() {
        elPreview.innerHTML = '';
        elPreview.appendChild(periodPreview(draft, U.num(draft.morningEndsAtPeriod)));
      }

      function renderAll() {
        renderPlanTable();
        renderSelects();
        renderTimes();
        renderPreview();
      }

      periodCard.querySelector('#resetTimes').addEventListener('click', function () {
        draft.days.forEach(function (d) {
          var plan = planOf(d);
          var first = plan.periods[0];
          rebuildDay(d, plan.periods.length, breaksOf(plan), first ? first.startTime : '08:30');
        });
        renderAll();
        U.toast('คำนวณเวลาคาบใหม่ทุกวันแล้ว', 'info');
      });

      periodCard.querySelector('#savePeriods').addEventListener('click', function () {
        if (!draft.days.length) {
          U.explainDialog({
            title: 'บันทึกผังคาบเรียนไม่ได้',
            cause: 'ยังไม่ได้เลือกวันเรียนแม้แต่วันเดียว ระบบจึงไม่มีช่องให้จัดคาบ',
            fix: 'ให้เลือกวันเรียนอย่างน้อย 1 วัน แล้วกดบันทึกอีกครั้ง'
          });
          return;
        }
        var maxNo = maxNoOf();
        var morning = U.num(draft.morningEndsAtPeriod);
        if (morning > maxNo) {
          U.explainDialog({
            title: 'บันทึกผังคาบเรียนไม่ได้',
            cause: 'ตั้งคาบสุดท้ายของช่วงเช้าเป็นคาบ ' + morning +
              ' ซึ่งมากกว่าจำนวนคาบต่อวันที่มากที่สุดในผังนี้ คือ ' + maxNo + ' คาบ',
            fix: 'ให้เลือกคาบสุดท้ายของช่วงเช้าไม่เกินคาบ ' + maxNo + ' หรือเพิ่มจำนวนคาบต่อวันก่อน'
          });
          return;
        }
        var noTeaching = draft.days.filter(function (d) {
          return planOf(d).periods.filter(function (p) { return !p.isBreak; }).length === 0;
        });
        if (noTeaching.length === draft.days.length) {
          U.explainDialog({
            title: 'บันทึกผังคาบเรียนไม่ได้',
            cause: 'ทุกวันที่เลือกไว้ไม่มีคาบสำหรับสอนเลย เพราะคาบทั้งหมดถูกตั้งเป็นคาบพัก',
            fix: 'ให้เพิ่มจำนวนคาบของบางวัน หรือเปลี่ยนคาบพักกลางวันเป็น “ไม่มีคาบพัก”'
          });
          return;
        }

        /* คาบในตารางเดิมที่จะหลุดออกจากผังใหม่ */
        var affected = 0;
        st.timetables.forEach(function (t) {
          t.entries.forEach(function (e) {
            if (draft.days.indexOf(e.day) === -1) { affected++; return; }
            var p = (draft.dayPlans[e.day] || { periods: [] }).periods
              .filter(function (x) { return x.no === U.num(e.periodNo); })[0];
            if (!p || p.isBreak) affected++;
          });
        });
        var lostLocks = st.lockedSlots.filter(function (l) {
          if (draft.days.indexOf(l.day) === -1) return true;
          var p = (draft.dayPlans[l.day] || { periods: [] }).periods
            .filter(function (x) { return x.no === U.num(l.periodNo); })[0];
          return !p;
        }).length;

        var proceed = (affected || lostLocks) ? U.confirmDialog({
          title: 'ยืนยันการเปลี่ยนผังคาบเรียน',
          message: 'ผังใหม่ทำให้มีคาบที่อยู่นอกผัง ' + affected + ' คาบ และคาบล็อก ' + lostLocks + ' รายการที่ไม่มีที่อยู่',
          detail: '<b>ผลที่จะเกิดขึ้น</b><br>คาบและคาบล็อกเหล่านั้นจะถูกลบออก และต้องจัดตารางใหม่',
          confirmText: 'ยืนยันเปลี่ยนผังคาบ', danger: true
        }) : Promise.resolve(true);

        proceed.then(function (ok) {
          if (!ok) return;
          var keepDays = {};
          draft.days.forEach(function (d) { keepDays[d] = true; });
          Object.keys(draft.dayPlans).forEach(function (d) {
            if (!keepDays[d]) delete draft.dayPlans[d];
          });
          st.periodConfig = U.deepClone(draft);
          st.timetables.forEach(function (t) {
            t.entries = t.entries.filter(function (e) {
              var p = M.periodByNo(st, e.day, U.num(e.periodNo));
              return p && !p.isBreak && st.periodConfig.days.indexOf(e.day) !== -1;
            });
          });
          st.lockedSlots = st.lockedSlots.filter(function (l) {
            var p = M.periodByNo(st, l.day, U.num(l.periodNo));
            return p && st.periodConfig.days.indexOf(l.day) !== -1;
          });
          app.saveAndRefresh('บันทึกผังคาบเรียนแล้ว');
        });
      });

      renderDays();
      renderAll();

      /* ---------- การจัดการข้อมูล ---------- */
      var dataCard = U.elFromHTML(
        '<div class="card"><div class="card__title">ข้อมูลของระบบ</div>' +
        '<div class="card__desc">ข้อมูลทั้งหมดเก็บอยู่ในเครื่องของคุณเท่านั้น ไม่ได้ส่งออกไปที่ใด</div>' +
        '<div class="flex gap-8 flex-wrap">' +
        '<button type="button" class="btn" id="btnSample">โหลดข้อมูลตัวอย่างใหม่</button>' +
        '<button type="button" class="btn" id="btnExport">ส่งออกไฟล์สำรองข้อมูล</button>' +
        '<button type="button" class="btn" id="btnImport">นำเข้าไฟล์สำรองข้อมูล</button>' +
        '<button type="button" class="btn btn--danger" id="btnClear">ล้างข้อมูลทั้งหมด</button>' +
        '</div><input type="file" id="backupFile" accept=".json,application/json" style="display:none"></div>'
      );
      root.appendChild(dataCard);

      dataCard.querySelector('#btnSample').addEventListener('click', function () {
        U.confirmDialog({
          title: 'โหลดข้อมูลโรงเรียนตัวอย่าง',
          message: 'ข้อมูลปัจจุบันทั้งหมดจะถูกแทนที่ด้วยข้อมูลโรงเรียนตัวอย่าง',
          detail: '<b>ผลที่จะเกิดขึ้น</b><br>ครู วิชา ห้อง หลักสูตร ชั้นเรียน การจัดครูผู้สอน และตารางทุกชุดที่มีอยู่จะหายไป',
          hint: 'หากยังต้องการข้อมูลเดิม ให้กดยกเลิกแล้วส่งออกไฟล์สำรองก่อน',
          confirmText: 'โหลดข้อมูลตัวอย่าง', danger: true
        }).then(function (ok) {
          if (!ok) return;
          store.replaceState(global.ST.mockdata.build());
          app.go('overview');
          U.toast('โหลดข้อมูลโรงเรียนตัวอย่างเรียบร้อยแล้ว', 'success');
        });
      });
      dataCard.querySelector('#btnExport').addEventListener('click', function () {
        store.exportBackup();
        U.toast('ส่งออกไฟล์สำรองข้อมูลแล้ว', 'success');
      });
      dataCard.querySelector('#btnImport').addEventListener('click', function () {
        dataCard.querySelector('#backupFile').click();
      });
      dataCard.querySelector('#backupFile').addEventListener('change', function (ev) {
        var file = ev.target.files && ev.target.files[0];
        if (!file) return;
        U.readFileText(file).then(function (text) {
          var res = store.importBackup(text);
          if (!res.ok) {
            U.explainDialog({
              title: 'นำเข้าไฟล์สำรองไม่สำเร็จ',
              cause: res.message,
              fix: 'ให้เลือกไฟล์ที่ได้จากปุ่มส่งออกไฟล์สำรองข้อมูลของระบบนี้ ซึ่งเป็นไฟล์นามสกุล .json'
            });
            return;
          }
          app.go('overview');
          U.toast('กู้ข้อมูลจากไฟล์สำรองเรียบร้อยแล้ว', 'success');
        });
        ev.target.value = '';
      });
      dataCard.querySelector('#btnClear').addEventListener('click', function () {
        U.confirmDialog({
          title: 'ล้างข้อมูลทั้งหมด',
          message: 'ข้อมูลทุกอย่างในระบบจะถูกลบ และเริ่มจากศูนย์',
          detail: '<b>ผลที่จะเกิดขึ้น</b><br>ครู วิชา ห้อง หลักสูตร ชั้นเรียน การจัดครูผู้สอน คาบล็อก และตารางทุกชุดจะหายทั้งหมด',
          hint: 'แนะนำให้กดส่งออกไฟล์สำรองข้อมูลก่อน เพราะลบแล้วกู้คืนไม่ได้',
          confirmText: 'ล้างข้อมูลทั้งหมด', danger: true
        }).then(function (ok) {
          if (!ok) return;
          store.resetAll();
          app.go('overview');
          U.toast('ล้างข้อมูลทั้งหมดแล้ว เริ่มตั้งค่าโรงเรียนใหม่ได้เลย', 'success');
        });
      });
    }
  };

  /* ย่อขนาดรูปตราโรงเรียนก่อนเก็บ */
  function shrinkImage(dataUrl, maxSize, done) {
    var img = new Image();
    img.onload = function () {
      var scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      var w = Math.max(1, Math.round(img.width * scale));
      var h = Math.max(1, Math.round(img.height * scale));
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      try { done(canvas.toDataURL('image/png')); }
      catch (e) { done(dataUrl); }
    };
    img.onerror = function () { done(dataUrl); };
    img.src = dataUrl;
  }
})(typeof window !== 'undefined' ? window : globalThis);
