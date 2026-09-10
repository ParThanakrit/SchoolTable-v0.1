/* หน้า P16 — เงื่อนไขการจัดตาราง (กฎรองที่ปรับได้เอง) */
(function (global) {
  'use strict';
  var U = global.ST.util, M = global.ST.model, UI = global.ST.ui;
  global.ST.pages = global.ST.pages || {};

  var RULES = [
    {
      code: 'S2',
      icon: 'route',
      title: 'ลดการเดินระหว่างคาบ',
      desc: 'เมื่อชั้นเรียนต้องย้ายห้องระหว่างคาบที่ติดกัน ระบบจะเลือกห้องที่อยู่อาคารเดียวกันและชั้นเดียวกันก่อน',
      why: 'ลดเวลาเดินของนักเรียน ไม่ต้องวิ่งข้ามอาคารระหว่างคาบ ทำให้เข้าเรียนคาบถัดไปทัน'
    },
    {
      code: 'S1',
      icon: 'sun',
      title: 'วิชาหลักอยู่ช่วงเช้า',
      desc: 'วิชาที่ติ๊กไว้ว่าควรอยู่ช่วงเช้า ระบบจะพยายามจัดให้อยู่ก่อนคาบที่กำหนดเป็นสิ้นสุดช่วงเช้า',
      why: 'นักเรียนมีสมาธิดีที่สุดในช่วงเช้า จึงควรเก็บวิชาที่ต้องคิดมากไว้ช่วงนั้น'
    },
    {
      code: 'S3',
      icon: 'link',
      title: 'คาบคู่ควรอยู่ติดกัน',
      desc: 'วิชาที่ตั้งไว้ว่าเป็นคาบคู่ ระบบจะพยายามวางสองคาบให้ติดกันในวันเดียวกัน',
      why: 'วิชาปฏิบัติการต้องใช้เวลาเตรียมอุปกรณ์ ถ้าคาบถูกแยกจะทำการทดลองไม่จบ'
    },
    {
      code: 'S4',
      icon: 'balance',
      title: 'กระจายภาระสอนครู',
      desc: 'ระบบจะพยายามไม่ให้ครูคนหนึ่งมีคาบสอนอัดแน่นอยู่ในวันเดียว',
      why: 'ครูที่สอนติดกันหลายคาบในวันเดียวจะเหนื่อยและไม่มีเวลาเตรียมการสอน'
    }
  ];

  var WEIGHTS = [
    { value: 'high', label: 'สำคัญมาก' },
    { value: 'medium', label: 'สำคัญปานกลาง' },
    { value: 'low', label: 'สำคัญน้อย' }
  ];

  global.ST.pages.conditions = {
    render: function (root) {
      var app = global.ST.app;
      var st = app.state();
      if (!st.conditions || !st.conditions.rules) st.conditions = global.ST.store.defaultConditions();
      var draft = U.deepClone(st.conditions);
      var morningEnd = U.num(st.periodConfig.morningEndsAtPeriod);
      var coreIds = {};
      st.subjects.forEach(function (s) { if (s.isCore) coreIds[s.id] = true; });
      root._hasUnsaved = function () {
        return JSON.stringify(draft) !== JSON.stringify(st.conditions) || morningEnd !== U.num(st.periodConfig.morningEndsAtPeriod) || st.subjects.some(function (s) { return !!s.isCore !== !!coreIds[s.id]; });
      };

      UI.pageHeader(root, {
        title: 'เงื่อนไขการจัดตาราง',
        desc: 'เลือกว่าอยากให้ระบบให้ความสำคัญกับเรื่องใดก่อน เช่น ห้องใกล้กันเดินหากันใกล้ หรือวิชาไหนควรอยู่ช่วงเช้า',
        actions: [
          { label: '❓ ช่วยเหลือ', onClick: function () { global.ST.help.show('conditions'); } },
          { label: 'คืนค่าเริ่มต้น', onClick: function () { resetDefaults(); } },
          { label: 'บันทึกเงื่อนไข', className: 'btn--primary', onClick: function () { saveAll(); } }
        ]
      });

      root.appendChild(U.elFromHTML(
        '<div class="callout">เลือกระดับความสำคัญตามโรงเรียน ระบบจะพยายามทำตามและแสดงข้อเสนอปรับตารางเมื่อทำได้ไม่ครบ โดยตรวจครูและห้องชนกันเสมอ</div>'));
      /* ---------- กฎรอง S1–S4 ---------- */
      var rulesCard = U.elFromHTML('<div class="card"><div class="card__title">สิ่งที่อยากให้ระบบพยายามทำ</div>' +
        '<div class="card__desc">ปิดข้อไหนก็ได้ที่โรงเรียนไม่ถือ · ข้อที่ตั้งเป็นสำคัญมากจะถูกทำก่อนเมื่อขัดกันเอง</div>' +
        '<div class="rulelist" id="ruleList"></div></div>');
      var ruleList = rulesCard.querySelector('#ruleList');

      function paintRules() {
        ruleList.innerHTML = RULES.map(function (r) {
          var cfg = draft.rules[r.code] || { enabled: false, weight: 'low' };
          return '<div class="rulerow' + (cfg.enabled ? '' : ' is-off') + '" data-code="' + r.code + '">' +
            '<div class="rulerow__top"><span class="rulerow__icon" aria-hidden="true">' + global.ST.ux.icon(r.icon) + '</span>' +
            '<span class="rulerow__title">' + U.esc(r.title) + '</span>' +
            '<label class="rule-switch" title="เปิดหรือปิดเงื่อนไขนี้">' +
            '<input type="checkbox" data-toggle="' + r.code + '"' + (cfg.enabled ? ' checked' : '') + '>' +
            '<span class="rule-switch__track" aria-hidden="true"></span><span class="sr-only">เปิดหรือปิด ' + U.esc(r.title) + '</span></label></div>' +
            '<div class="rulerow__desc">' + U.esc(r.desc) + '</div>' +
            '<details class="rulerow__why"><summary>ดูเหตุผล</summary><p>' + U.esc(r.why) + '</p></details>' +
            '<div class="rulerow__weight"><span class="small muted">ความสำคัญ</span><div class="rule-priority" role="group" aria-label="ระดับความสำคัญของ ' + U.esc(r.title) + '">' +
            WEIGHTS.map(function (w) {
              var shortLabel = w.value === 'high' ? 'มาก' : w.value === 'medium' ? 'กลาง' : 'น้อย';
              return '<button type="button" data-weight="' + r.code + '" data-value="' + w.value + '"' +
                (w.value === cfg.weight ? ' class="is-active" aria-pressed="true"' : ' aria-pressed="false"') +
                (cfg.enabled ? '' : ' disabled') + '>' + shortLabel + '</button>';
            }).join('') + '</div></div></div>';
        }).join('');
      }

      U.on(ruleList, 'change', 'input[data-toggle]', function (ev, input) {
        var code = input.dataset.toggle;
        draft.rules[code].enabled = input.checked;
        paintRules();
      });
      U.on(ruleList, 'click', 'button[data-weight]', function (ev, btn) {
        draft.rules[btn.dataset.weight].weight = btn.dataset.value;
        paintRules();
      });
      paintRules();
      root.appendChild(rulesCard);

      /* ---------- ช่วงเช้า และวิชาที่ควรอยู่ช่วงเช้า ---------- */
      var maxNo = M.maxPeriodNo(st);
      var morningCard = U.elFromHTML('<div class="card morning-card">' +
        '<div class="card__title">จัดวิชาสำคัญไว้ช่วงเช้า</div>' +
        '<div class="card__desc">กำหนดว่าช่วงเช้าสิ้นสุดที่คาบใด แล้วติ๊กวิชาที่อยากให้อยู่ช่วงเช้า ' +
        'ระบบจะใช้ข้อมูลนี้กับเงื่อนไขข้อแรก</div>' +
        '<section class="morning-step"><div class="morning-step__head"><span class="morning-step__num">1</span>' +
        '<div><b>เลือกคาบสุดท้ายของช่วงเช้า</b><div class="small muted">กดหมายเลขคาบที่โรงเรียนใช้</div></div></div>' +
        '<select class="sr-only" id="morningEnd" aria-label="ช่วงเช้าสิ้นสุดที่คาบ"></select>' +
        '<div class="morning-periods" id="morningPeriods"></div>' +
        '<div class="morning-summary" id="morningHint"></div></section>' +
        '<section class="morning-subjects"><div class="morning-step__head"><span class="morning-step__num">2</span>' +
        '<div><b>เลือกวิชาที่ควรเรียนช่วงเช้า</b><div class="small muted">ติ๊กเฉพาะวิชาที่ต้องการให้ระบบจัดก่อน</div></div></div>' +
        '<div class="table-tools no-print"><input type="search" class="input" id="coreSearch" placeholder="ค้นหารหัสหรือชื่อวิชา…">' +
        '<span class="small muted" id="coreCount"></span></div>' +
        '<div class="table-wrap morning-table-wrap"><table class="data" id="coreTable"></table></div></section></div>');

      var morningSel = morningCard.querySelector('#morningEnd');
      var morningHint = morningCard.querySelector('#morningHint');
      var morningPeriods = morningCard.querySelector('#morningPeriods');
      var coreTable = morningCard.querySelector('#coreTable');
      var coreSearch = morningCard.querySelector('#coreSearch');
      var coreCount = morningCard.querySelector('#coreCount');

      var opts = '';
      for (var i = 1; i <= maxNo; i++) {
        opts += '<option value="' + i + '"' + (i === morningEnd ? ' selected' : '') + '>คาบ ' + i + '</option>';
      }
      morningSel.innerHTML = opts;
      morningPeriods.innerHTML = Array.from({ length: maxNo }, function (_, index) {
        var no = index + 1;
        return '<button type="button" data-period="' + no + '"' + (no === morningEnd ? ' class="is-active"' : '') +
          ' aria-pressed="' + (no === morningEnd) + '"><span>คาบ</span><b>' + no + '</b></button>';
      }).join('');

      function paintMorningHint() {
        var lines = st.periodConfig.days.map(function (d) {
          var p = M.periodByNo(st, d, morningEnd);
          return U.DAY_SHORT[d] + ' ' + (p ? p.endTime : 'ไม่มีคาบนี้');
        });
        morningHint.innerHTML = '<span aria-hidden="true">☀️</span><span><b>ช่วงเช้าถึงคาบ ' + morningEnd +
          '</b><small>' + U.esc(lines.join(' · ')) + '</small></span>';
        U.qsa('button[data-period]', morningPeriods).forEach(function (btn) {
          var active = U.num(btn.dataset.period) === morningEnd;
          btn.classList.toggle('is-active', active);
          btn.setAttribute('aria-pressed', String(active));
        });
      }
      morningSel.addEventListener('change', function (ev) {
        morningEnd = U.num(ev.target.value);
        paintMorningHint();
      });
      U.on(morningPeriods, 'click', 'button[data-period]', function (ev, btn) {
        morningSel.value = btn.dataset.period;
        morningSel.dispatchEvent(new Event('change'));
      });
      paintMorningHint();

      function paintCore() {
        var term = coreSearch.value.trim().toLowerCase();
        var n = 0;
        st.subjects.forEach(function (s) { if (coreIds[s.id]) n++; });
        coreCount.textContent = 'ติ๊กไว้ ' + U.fmtNum(n) + ' วิชา จากทั้งหมด ' + U.fmtNum(st.subjects.length) + ' วิชา';

        if (!st.subjects.length) {
          coreTable.innerHTML = '<tbody><tr><td class="muted" style="padding:18px">' +
            'ยังไม่มีรายวิชาในระบบ ให้ไปเพิ่มรายวิชาก่อน</td></tr></tbody>';
          return;
        }
        var html = '<thead><tr><th style="width:72px">เลือก</th><th>รายวิชา</th><th>กลุ่มสาระ</th></tr></thead><tbody>';
        var shown = 0;
        st.subjectGroups.forEach(function (grp) {
          var list = st.subjects.filter(function (s) {
            if (s.subjectGroupId !== grp.id) return false;
            return !term || (s.code + ' ' + s.name).toLowerCase().indexOf(term) !== -1;
          });
          if (!list.length) return;
          html += '<tr class="row-group"><td colspan="3"><b>' + U.esc(grp.name) + '</b> ' +
            '<button type="button" class="btn btn--sm" data-group="' + grp.id + '">เลือกทั้งหมด</button> ' +
            '<button type="button" class="btn btn--sm btn--ghost" data-ungroup="' + grp.id + '">ล้างที่เลือก</button></td></tr>';
          list.forEach(function (s) {
            shown++;
            html += '<tr' + (coreIds[s.id] ? ' class="is-picked"' : '') + '>' +
              '<td><input type="checkbox" data-core="' + s.id + '"' + (coreIds[s.id] ? ' checked' : '') + '></td>' +
              '<td><span class="dot" style="background:' + U.esc((grp && grp.color) || '#94a3b8') + '"></span> ' +
              U.esc(s.code) + ' ' + U.esc(s.name) + '</td>' +
              '<td class="small muted">' + U.esc(grp.name) + '</td></tr>';
          });
        });
        html += '</tbody>';
        coreTable.innerHTML = shown ? html
          : '<tbody><tr><td class="muted" style="padding:18px">ไม่พบรายวิชาที่ตรงกับคำค้น</td></tr></tbody>';
      }

      U.on(coreTable, 'change', 'input[data-core]', function (ev, input) {
        coreIds[input.dataset.core] = input.checked;
        input.closest('tr').classList.toggle('is-picked', input.checked);
        var n = 0;
        st.subjects.forEach(function (s) { if (coreIds[s.id]) n++; });
        coreCount.textContent = 'ติ๊กไว้ ' + U.fmtNum(n) + ' วิชา จากทั้งหมด ' + U.fmtNum(st.subjects.length) + ' วิชา';
      });
      U.on(coreTable, 'click', 'button[data-group]', function (ev, btn) {
        st.subjects.forEach(function (s) { if (s.subjectGroupId === btn.dataset.group) coreIds[s.id] = true; });
        paintCore();
      });
      U.on(coreTable, 'click', 'button[data-ungroup]', function (ev, btn) {
        st.subjects.forEach(function (s) { if (s.subjectGroupId === btn.dataset.ungroup) coreIds[s.id] = false; });
        paintCore();
      });
      coreSearch.addEventListener('input', paintCore);
      paintCore();
      root.appendChild(morningCard);

      /* ---------- เงื่อนไขอื่น ---------- */
      var otherCard = U.elFromHTML('<div class="card"><div class="card__title">เงื่อนไขอื่น</div>' +
        '<div class="rulelist"><div class="rulerow' + (draft.avoidSameSubjectTwiceADay ? '' : ' is-off') + '" id="avoidRow">' +
        '<label class="checkline rulerow__check"><input type="checkbox" id="avoidSame"' +
        (draft.avoidSameSubjectTwiceADay ? ' checked' : '') + '>' +
        '<span class="rulerow__title">ไม่ควรเรียนวิชาเดียวกันหลายคาบในวันเดียว</span></label>' +
        '<div class="rulerow__desc">ยกเว้นวิชาที่ตั้งไว้ว่าเป็นคาบคู่ ซึ่งตั้งใจให้อยู่ติดกันอยู่แล้ว</div>' +
        '<div class="rulerow__why">เหตุผล: กระจายวิชาให้นักเรียนได้เรียนสม่ำเสมอทั้งสัปดาห์ ไม่กระจุกวันเดียวแล้วหายไปหลายวัน</div>' +
        '</div></div></div>');
      var avoidEl = otherCard.querySelector('#avoidSame');
      avoidEl.addEventListener('change', function () {
        draft.avoidSameSubjectTwiceADay = avoidEl.checked;
        otherCard.querySelector('#avoidRow').classList.toggle('is-off', !avoidEl.checked);
      });
      root.appendChild(otherCard);

      /* ---------- ปุ่มท้ายหน้า ---------- */
      var footer = U.elFromHTML('<div class="flex gap-8 no-print">' +
        '<button type="button" class="btn btn--primary" id="saveBottom">บันทึกเงื่อนไข</button>' +
        '<button type="button" class="btn" id="saveAndGo">บันทึกแล้วไปล็อกคาบ</button></div>');
      footer.querySelector('#saveBottom').addEventListener('click', function () { saveAll(); });
      footer.querySelector('#saveAndGo').addEventListener('click', function () { saveAll('locks'); });
      root.appendChild(footer);

      /* ---------- บันทึก ---------- */
      function saveAll(goTo) {
        var anyMissing = st.periodConfig.days.filter(function (d) {
          return !M.periodByNo(st, d, morningEnd);
        });
        var enabledCount = 0;
        Object.keys(draft.rules).forEach(function (k) { if (draft.rules[k].enabled) enabledCount++; });

        st.conditions = draft;
        st.periodConfig.morningEndsAtPeriod = morningEnd;
        st.subjects.forEach(function (s) { s.isCore = !!coreIds[s.id]; });

        var msg = 'บันทึกเงื่อนไขแล้ว เปิดใช้ ' + enabledCount + ' ข้อ';
        if (anyMissing.length) {
          msg += ' · หมายเหตุ วัน' + anyMissing.map(function (d) { return U.DAY_NAMES[d]; }).join(' และ ') +
            ' ไม่มีคาบ ' + morningEnd + ' วันนั้นจึงถือว่าทุกคาบอยู่ช่วงเช้า';
        }
        if (goTo) {
          global.ST.store.save();
          U.toast(msg, 'success', 7000);
          app.go(goTo);
          return;
        }
        app.saveAndRefresh(msg);
      }

      function resetDefaults() {
        U.confirmDialog({
          title: 'คืนค่าเงื่อนไขเริ่มต้น',
          message: 'ต้องการคืนค่าเงื่อนไขทั้งหมดกลับเป็นค่าเริ่มต้นของระบบใช่หรือไม่',
          hint: 'วิชาที่ติ๊กว่าควรอยู่ช่วงเช้า และคาบสิ้นสุดช่วงเช้า จะไม่ถูกเปลี่ยน',
          confirmText: 'คืนค่าเริ่มต้น'
        }).then(function (ok) {
          if (!ok) return;
          st.conditions = global.ST.store.defaultConditions();
          app.saveAndRefresh('คืนค่าเงื่อนไขเริ่มต้นแล้ว');
        });
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
