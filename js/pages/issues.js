/* หน้า P12 — รายงานปัญหา */
(function (global) {
  'use strict';
  var U = global.ST.util, M = global.ST.model, UI = global.ST.ui, SCH = global.ST.scheduler;
  global.ST.pages = global.ST.pages || {};

  var filterRule = '';

  var FIX_PAGE = {
    R1: 'teachers', R2: 'teachers', R3: 'settings', R4: 'rooms',
    R5: 'subjects', R6: 'locks', R7: 'curriculum'
  };

  global.ST.pages.issues = {
    render: function (root) {
      var app = global.ST.app;
      var st = app.state();
      var tt = M.activeTimetable(st);

      UI.pageHeader(root, {
        title: 'รายงานปัญหา',
        desc: 'คาบที่จัดไม่ลงพร้อมเหตุผล และข้อเสนอปรับตารางที่ยอมรับได้แต่ควรรู้',
        actions: tt ? [
          { label: '🖨 พิมพ์รายงาน', onClick: function () { printReport(); } },
          { label: 'ดูตาราง', onClick: function () { app.go('timetable'); } }
        ] : []
      });

      if (!tt) {
        root.appendChild(UI.emptyState({
          icon: '📄', title: 'ยังไม่มีตารางให้ตรวจ',
          desc: 'ต้องกดจัดตารางอัตโนมัติก่อน จึงจะมีรายงานปัญหาให้ดู',
          actions: [{ label: 'จัดตารางอัตโนมัติ', onClick: function () { app.go('generate'); } }]
        }));
        return;
      }

      var unplaced = tt.issues.filter(function (i) { return i.type === 'UNPLACED'; });
      var soft = tt.issues.filter(function (i) { return i.type === 'SOFT_VIOLATION'; });
      var pct = tt.stats.totalRequired
        ? Math.round((tt.stats.placed / tt.stats.totalRequired) * 1000) / 10 : 100;
      var counts = {};
      soft.forEach(function (i) { counts[i.ruleCode] = (counts[i.ruleCode] || 0) + 1; });

      /* การ์ดสรุป */
      var kind = tt.stats.unplaced > 0 ? 'danger' : (soft.length ? 'warning' : 'success');
      root.appendChild(U.elFromHTML(
        '<div class="result-card result-card--' + kind + '">' +
        '<div class="result-card__title">ตารางนี้สมบูรณ์ ' + pct + '%</div>' +
        '<div class="result-card__line">ต้องจัดทั้งหมด ' + U.fmtNum(tt.stats.totalRequired) +
        ' คาบ · จัดได้ ' + U.fmtNum(tt.stats.placed) + ' คาบ · ค้าง ' + U.fmtNum(tt.stats.unplaced) + ' คาบ</div>' +
        '<div class="result-card__line">ข้อเสนอปรับตาราง ' + U.fmtNum(soft.length) + ' จุด · ' +
        'ตาราง "' + U.esc(tt.name) + '" สถานะ ' + M.statusLabel(tt.status) + '</div></div>'
      ));

      /* กราฟภาพรวม */
      var chartCodes = Object.keys(SCH.SOFT_LABEL);
      var maxCount = Math.max.apply(null, [1].concat(chartCodes.map(function (code) { return counts[code] || 0; })));
      var issueChart = U.elFromHTML('<div class="issue-chart-grid">' +
        '<section class="card issue-donut-card"><div class="issue-chart-head"><div><b>ภาพรวมการจัดคาบ</b>' +
        '<span>สัดส่วนคาบที่จัดลงตารางแล้ว</span></div></div>' +
        '<div class="issue-donut-layout"><div class="issue-donut" style="--issue-pct:' + pct + '%">' +
        '<div><strong>' + pct + '%</strong><span>จัดสำเร็จ</span></div></div>' +
        '<div class="issue-chart-legend"><div><i class="is-placed"></i><span>จัดได้</span><b>' + U.fmtNum(tt.stats.placed) + '</b></div>' +
        '<div><i class="is-unplaced"></i><span>ค้าง</span><b>' + U.fmtNum(tt.stats.unplaced) + '</b></div>' +
        '<div><i class="is-soft"></i><span>ควรปรับ</span><b>' + U.fmtNum(soft.length) + '</b></div></div></div></section>' +
        '<section class="card issue-bars-card"><div class="issue-chart-head"><div><b>ข้อเสนอแยกตามประเภท</b>' +
        '<span>แท่งยาวหมายถึงพบประเด็นประเภทนั้นมาก</span></div><strong>' + U.fmtNum(soft.length) + ' จุด</strong></div>' +
        '<div class="issue-bars">' + chartCodes.map(function (code) {
          var count = counts[code] || 0;
          var width = Math.round((count / maxCount) * 1000) / 10;
          return '<button type="button" data-chart-rule="' + code + '" title="กรองรายการประเภทนี้">' +
            '<span class="issue-bar-label">' + U.esc(SCH.SOFT_LABEL[code]) + '</span>' +
            '<span class="issue-bar-track"><i style="width:' + width + '%"></i></span><b>' + U.fmtNum(count) + '</b></button>';
        }).join('') + '</div></section></div>');
      U.on(issueChart, 'click', 'button[data-chart-rule]', function (ev, btn) {
        filterRule = btn.dataset.chartRule;
        app.refresh();
      });
      root.appendChild(issueChart);

      if (!unplaced.length && !soft.length) {
        root.appendChild(UI.emptyState({
          icon: '✅', title: 'ตารางนี้สมบูรณ์ ไม่มีคาบค้างและไม่ละเมิดกฎใด',
          desc: 'จัดครบทุกคาบ ไม่มีครู ชั้นเรียน หรือห้องชนกัน และไม่ไม่ตรงเงื่อนไขที่ต้องการแม้แต่จุดเดียว',
          actions: [
            { label: 'พิมพ์ตาราง', onClick: function () { app.go('print'); } },
            { label: 'ดูตาราง', className: 'btn', onClick: function () { app.go('timetable'); } }
          ]
        }));
        return;
      }

      /* ---------- ส่วนที่ 1 คาบที่จัดไม่ลง ---------- */
      var card1 = U.elFromHTML('<div class="card"><div class="card__title">คาบที่จัดไม่ลง ' +
        '<span class="badge badge--danger">' + U.fmtNum(unplaced.length) + ' รายการ</span></div>' +
        '<div class="card__desc">ต้องแก้ที่ข้อมูลต้นทาง แล้วกดจัดตารางใหม่</div><div id="unplacedHost"></div></div>');
      var host1 = card1.querySelector('#unplacedHost');
      if (!unplaced.length) {
        host1.innerHTML = '<p class="text-success">ไม่มีคาบที่จัดไม่ลง ระบบจัดได้ครบทุกคาบ</p>';
      } else {
        unplaced.forEach(function (i) {
          var ctxInfo = i.context || {};
          var node = U.elFromHTML('<div class="issue issue--high">' +
            '<div class="issue__head"><span class="issue__title">' + U.esc(ctxInfo.sectionName) + ' · ' +
            U.esc(ctxInfo.subjectName) + '</span>' +
            '<span class="badge badge--danger">ค้าง ' + U.fmtNum(i.remainingPeriods) + ' คาบ</span>' +
            '<span class="badge badge--muted">ครู ' + U.esc(ctxInfo.teacherName) + '</span></div>' +
            '<div class="issue__reason"><b>สาเหตุ</b> ' + U.esc(i.message) + '</div>' +
            '<div class="issue__suggestion"><b>ข้อเสนอแนะ</b> ' + U.esc(i.suggestion) + '</div>' +
            '<div class="mt-8 no-print"><button type="button" class="btn btn--sm">ไปหน้าที่ต้องแก้</button></div></div>');
          node.querySelector('button').addEventListener('click', function () {
            app.go(FIX_PAGE[i.reasonCode] || 'assignments');
          });
          host1.appendChild(node);
        });
      }
      root.appendChild(card1);

      /* ---------- ส่วนที่ 2 ข้อเสนอปรับตาราง ---------- */
      var chips = Object.keys(SCH.SOFT_LABEL).map(function (code) {
        return '<label class="chip' + (filterRule === code ? ' is-on' : '') + '" data-rule="' + code + '">' +
          U.esc(SCH.SOFT_LABEL[code]) + ' (' + U.fmtNum(counts[code] || 0) + ')</label>';
      }).join('');

      var card2 = U.elFromHTML('<div class="card"><div class="card__title">ข้อเสนอปรับตาราง ' +
        '<span class="badge badge--warning">' + U.fmtNum(soft.length) + ' จุด</span></div>' +
        '<div class="card__desc">ยอมรับได้ ตารางยังใช้งานได้จริง แต่ควรรู้ไว้ และปรับเองได้ด้วยการลากคาบ</div>' +
        '<div class="chipset mb-8 no-print"><label class="chip' + (filterRule === '' ? ' is-on' : '') +
        '" data-rule="">ทั้งหมด (' + U.fmtNum(soft.length) + ')</label>' + chips + '</div>' +
        '<div id="softHost"></div></div>');
      var host2 = card2.querySelector('#softHost');
      U.on(card2, 'click', '.chip', function (ev, chip) {
        filterRule = chip.dataset.rule;
        app.refresh();
      });

      var shown = soft.filter(function (i) { return !filterRule || i.ruleCode === filterRule; });
      if (!shown.length) {
        host2.innerHTML = '<p class="text-success">ไม่มีข้อเสนอปรับตารางในหมวดที่เลือก</p>';
      } else {
        host2.innerHTML = '<div class="table-wrap"><table class="data"><thead><tr>' +
          '<th style="width:220px">ประเภท</th><th>รายละเอียด</th><th style="width:110px">ระดับ</th>' +
          '<th>ข้อเสนอแนะ</th></tr></thead><tbody>' +
          shown.slice(0, 400).map(function (i) {
            var sev = i.severity === 'HIGH' ? '<span class="badge badge--danger">สูง</span>'
              : (i.severity === 'MEDIUM' ? '<span class="badge badge--warning">ปานกลาง</span>'
                : '<span class="badge badge--muted">ต่ำ</span>');
            return '<tr><td>' + U.esc(SCH.SOFT_LABEL[i.ruleCode] || i.ruleCode) +
              ' <span class="small muted">(' + i.ruleCode + ')</span></td>' +
              '<td>' + U.esc(i.message) + '</td><td>' + sev + '</td>' +
              '<td class="small muted">' + U.esc(i.suggestion || '-') + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
          (shown.length > 400 ? '<div class="small muted mt-8">แสดง 400 รายการแรกจาก ' +
            U.fmtNum(shown.length) + ' รายการ · กดพิมพ์รายงานเพื่อดูทั้งหมด</div>' : '');
      }
      root.appendChild(card2);

      function printReport() {
        global.ST.printing.printIssueReport(st, tt);
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
