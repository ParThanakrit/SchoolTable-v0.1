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
        title: 'ตรวจและปรับตาราง',
        desc: 'ดูผลการจัดคาบ ปัญหาที่ต้องแก้ และข้อเสนอที่ช่วยให้ตารางเหมาะสมยิ่งขึ้น',
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

      /* การ์ดสถานะหลัก — ข้อเสนอไม่ถือเป็นข้อผิดพลาด จึงไม่ใช้สีเตือนเมื่อจัดครบ */
      var isComplete = tt.stats.unplaced === 0;
      var kind = isComplete ? 'success' : 'danger';
      root.appendChild(U.elFromHTML(
        '<section class="issues-status issues-status--' + kind + '">' +
        '<div class="issues-status__main"><span class="issues-status__icon" aria-hidden="true">' +
        global.ST.ux.icon(isComplete ? 'check' : 'warning') + '</span><div class="issues-status__copy">' +
        '<span class="issues-status__eyebrow">ผลการจัดตาราง</span>' +
        '<strong>' + (isComplete ? 'จัดครบทุกคาบ พร้อมใช้งาน' : 'ยังมีคาบที่ต้องแก้ไข') + '</strong>' +
        '<span>ตาราง “' + U.esc(tt.name) + '” · สถานะ ' + M.statusLabel(tt.status) + '</span></div>' +
        '<div class="issues-status__score"><strong>' + pct + '%</strong><span>ความสำเร็จ</span></div></div>' +
        '<div class="issues-status__metrics">' +
        '<div><span>คาบทั้งหมด</span><b>' + U.fmtNum(tt.stats.totalRequired) + '</b></div>' +
        '<div class="is-success"><span>จัดลงตารางแล้ว</span><b>' + U.fmtNum(tt.stats.placed) + '</b></div>' +
        '<div class="' + (tt.stats.unplaced ? 'is-danger' : 'is-success') + '"><span>คาบที่ยังค้าง</span><b>' + U.fmtNum(tt.stats.unplaced) + '</b></div>' +
        '<div class="is-warning"><span>ข้อเสนอปรับเพิ่ม</span><b>' + U.fmtNum(soft.length) + '</b></div></div></section>'
      ));

      /* กราฟภาพรวม */
      var chartCodes = Object.keys(SCH.SOFT_LABEL);
      var maxCount = Math.max.apply(null, [1].concat(chartCodes.map(function (code) { return counts[code] || 0; })));
      var issueChart = U.elFromHTML('<div class="issue-chart-grid">' +
        '<section class="card issue-donut-card"><div class="issue-chart-head"><div><b>สถานะคาบเรียน</b>' +
        '<span>ดูจำนวนคาบที่จัดสำเร็จและยังค้าง</span></div></div>' +
        '<div class="issue-donut-layout"><div class="issue-donut" style="--issue-pct:' + pct + '%">' +
        '<div><strong>' + pct + '%</strong><span>จัดสำเร็จ</span></div></div>' +
        '<div class="issue-chart-legend"><div><i class="is-placed"></i><span>จัดได้</span><b>' + U.fmtNum(tt.stats.placed) + '</b></div>' +
        '<div><i class="is-unplaced"></i><span>ค้าง</span><b>' + U.fmtNum(tt.stats.unplaced) + '</b></div>' +
        '<div><i class="is-soft"></i><span>ควรปรับ</span><b>' + U.fmtNum(soft.length) + '</b></div></div></div></section>' +
        '<section class="card issue-bars-card"><div class="issue-chart-head"><div><b>ข้อเสนอแยกตามประเภท</b>' +
        '<span>เลือกแท่งเพื่อกรองดูรายละเอียดด้านล่าง</span></div><strong>' + U.fmtNum(soft.length) + ' จุด</strong></div>' +
        '<div class="issue-bars">' + chartCodes.map(function (code) {
          var count = counts[code] || 0;
          var width = Math.round((count / maxCount) * 1000) / 10;
          return '<button type="button" class="' + (filterRule === code ? 'is-active' : '') + '" data-chart-rule="' + code + '" title="กรองรายการประเภทนี้">' +
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
          desc: 'จัดครบทุกคาบ ไม่มีครู ชั้นเรียน หรือห้องชนกัน และตรงตามเงื่อนไขที่ต้องการทุกข้อ',
          actions: [
            { label: 'พิมพ์ตาราง', onClick: function () { app.go('print'); } },
            { label: 'ดูตาราง', className: 'btn', onClick: function () { app.go('timetable'); } }
          ]
        }));
        return;
      }

      /* ---------- ส่วนที่ 1 คาบที่จัดไม่ลง ---------- */
      var card1 = U.elFromHTML('<div class="card issues-unplaced-card' + (!unplaced.length ? ' is-clear' : '') + '"><div class="card__title">คาบที่จัดไม่ลง ' +
        '<span class="badge badge--danger">' + U.fmtNum(unplaced.length) + ' รายการ</span></div>' +
        '<div class="card__desc">ต้องแก้ที่ข้อมูลต้นทาง แล้วกดจัดตารางใหม่</div><div id="unplacedHost"></div></div>');
      var host1 = card1.querySelector('#unplacedHost');
      if (!unplaced.length) {
        host1.innerHTML = '<div class="issues-clear-state"><span aria-hidden="true">' + global.ST.ux.icon('check') + '</span>' +
          '<div><b>ไม่มีคาบที่จัดไม่ลง</b><small>ระบบจัดครบทุกคาบ ไม่ต้องแก้ข้อมูลต้นทาง</small></div></div>';
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
        return '<button type="button" class="chip' + (filterRule === code ? ' is-on' : '') + '" data-rule="' + code + '">' +
          U.esc(SCH.SOFT_LABEL[code]) + ' <span>' + U.fmtNum(counts[code] || 0) + '</span></button>';
      }).join('');

      var card2 = U.elFromHTML('<div class="card issues-suggestions-card"><div class="card__title">ข้อเสนอปรับตาราง ' +
        '<span class="badge badge--warning">' + U.fmtNum(soft.length) + ' จุด</span></div>' +
        '<div class="card__desc">รายการเหล่านี้ไม่ใช่ข้อผิดพลาด ตารางยังใช้งานได้ และสามารถปรับเองด้วยการลากคาบ</div>' +
        '<div class="chipset issues-filter-chips mb-8 no-print"><button type="button" class="chip' + (filterRule === '' ? ' is-on' : '') +
        '" data-rule="">ทั้งหมด <span>' + U.fmtNum(soft.length) + '</span></button>' + chips + '</div>' +
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
