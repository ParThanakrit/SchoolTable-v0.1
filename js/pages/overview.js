/* ภาพรวม: งานที่ยังค้างและตารางล่าสุด */
(function (global) {
  'use strict';
  var U = global.ST.util, M = global.ST.model, UI = global.ST.ui;
  global.ST.pages = global.ST.pages || {};
  global.ST.pages.overview = {
    render: function (root) {
      var app = global.ST.app, st = app.state(), steps = M.readiness(st), problems = M.preflight(st);
      var ready = !problems.length, tt = M.activeTimetable(st), pending = steps.filter(function (s) { return !s.done; });
      var done = steps.filter(function (s) { return s.done; });
      var total = st.assignments.reduce(function (sum, a) { return sum + U.num(a.periodsPerWeek); }, 0);
      UI.pageHeader(root, { title: 'ภาพรวม', desc: 'ดูงานที่ยังค้าง เตรียมข้อมูลให้พร้อม แล้วเปิดตารางเพื่อตรวจและพิมพ์' });
      var next = pending[0], hero = U.elFromHTML('<section class="overview-hero"><div><span class="badge ' + (tt ? 'badge--info' : ready ? 'badge--success' : 'badge--warning') + '">' + (tt ? 'ตารางล่าสุด' : ready ? 'ข้อมูลพร้อมจัดตาราง' : 'เตรียมข้อมูลแล้ว ' + done.length + '/' + steps.length + ' รายการ') + '</span><h2>' + U.esc(tt ? tt.name : ready ? 'พร้อมจัดตารางของโรงเรียนแล้ว' : next ? next.label : 'ตรวจข้อมูลก่อนจัดตาราง') + '</h2><p>' + U.esc(tt ? 'ภาคเรียนที่ ' + tt.semester + '/' + tt.academicYear + ' · ' + M.statusLabel(tt.status) : ready ? 'ตั้งเงื่อนไขหรือล็อกคาบเพิ่มเติมได้ ก่อนเริ่มจัดอัตโนมัติ' : next ? next.missing : 'มีข้อมูลที่ต้องแก้ก่อนเริ่มจัด') + '</p></div><div class="hero-actions"></div></section>');
      var actions = hero.querySelector('.hero-actions');
      function button(host, label, page, primary) {
        var b = U.elFromHTML('<button type="button" class="btn' + (primary ? ' btn--primary' : '') + '">' + U.esc(label) + '</button>');
        b.addEventListener('click', function () { app.go(page); }); host.appendChild(b);
      }
      if (tt) {
        button(actions, 'เปิดตารางเพื่อตรวจ', 'timetable', true); button(actions, 'พิมพ์ตาราง', 'print');
        var summary = U.elFromHTML('<div class="overview-summary"><span>จัดแล้ว <b>' + U.fmtNum(tt.stats.placed) + '/' + U.fmtNum(tt.stats.totalRequired) + '</b> คาบ</span><span class="' + (tt.stats.unplaced ? 'text-danger' : 'text-success') + '">คาบค้าง ' + U.fmtNum(tt.stats.unplaced) + '</span><span>ข้อเสนอปรับตาราง ' + U.fmtNum(tt.stats.softViolations) + ' จุด</span></div>');
        hero.firstElementChild.appendChild(summary);
      } else if (ready) {
        button(actions, 'จัดตารางอัตโนมัติ', 'generate', true); button(actions, 'ตั้งเงื่อนไข', 'conditions');
      } else {
        button(actions, next ? 'เริ่ม: ' + next.label : 'ดูข้อมูลที่ต้องแก้', next ? next.page : 'generate', true);
      }
      root.appendChild(hero);
      var stats = U.elFromHTML('<div class="grid grid--4" style="margin-bottom:20px"></div>');
      var ux = global.ST.ux;
      [{label:'ครู',value:st.teachers.length,hint:'คน',icon:'users',c:'c1'}, {label:'ชั้นเรียน',value:st.classSections.length,hint:'ห้อง',icon:'grid',c:'c2'}, {label:'ห้องสถานที่',value:st.rooms.length,hint:'ห้อง',icon:'building',c:'c3'}, {label:'คาบตามหลักสูตร',value:total,hint:'คาบต่อสัปดาห์',icon:'calendar',c:'c4'}].forEach(function (s) {
        stats.appendChild(U.elFromHTML('<div class="stat stat--' + s.c + '"><div class="stat__icon" aria-hidden="true">' + ux.icon(s.icon) + '</div><div class="stat__body"><div class="stat__label">' + s.label + '</div><div class="stat__value">' + U.fmtNum(s.value) + '</div><div class="stat__hint">' + s.hint + '</div></div></div>'));
      });
      root.appendChild(stats);
      var card = U.elFromHTML('<div class="card"><div class="card__title">' + (pending.length ? 'งานที่ยังต้องเตรียม · ' + pending.length + ' รายการ' : 'ข้อมูลพื้นฐานครบแล้ว') + '</div><div class="card__desc">เลือกแก้เฉพาะส่วนที่ต้องการ หรือใช้ไฟล์ Excel / CSV เพื่อเริ่มได้เร็วขึ้น</div><div class="readiness"></div></div>');
      var labels = {settings:'ตั้งค่าโรงเรียน',rooms:'เพิ่มอาคารและห้อง',subjects:'เพิ่มรายวิชา',teachers:'เพิ่มครู',sections:'จัดการชั้นเรียน',curriculum:'จัดการหลักสูตร',assignments:'เลือกครูที่ยังขาด'};
      function addStep(host, step) {
        var row = U.elFromHTML('<div class="readiness__item' + (step.done ? ' is-done' : '') + '"><div class="readiness__mark">' + (step.done ? '✓' : '○') + '</div><div class="readiness__label">' + U.esc(step.label) + '<span class="readiness__detail">' + U.esc(step.done ? step.detail || 'ทำเรียบร้อยแล้ว' : step.missing || 'ยังไม่ได้ทำ') + '</span></div><button type="button" class="btn btn--sm">' + U.esc(step.done ? 'แก้ไข' : labels[step.page] || 'ไปทำรายการ') + '</button></div>');
        row.querySelector('button').addEventListener('click', function () { app.go(step.page, { onlyIncomplete: step.page === 'assignments' && !step.done }); }); host.appendChild(row);
      }
      pending.forEach(function (s) { addStep(card.querySelector('.readiness'), s); });
      if (done.length) {
        var completed = U.elFromHTML('<details class="readiness-complete"><summary>เตรียมแล้ว ' + done.length + ' รายการ · ดูหรือแก้ไข</summary><div class="readiness"></div></details>');
        done.forEach(function (s) { addStep(completed.querySelector('.readiness'), s); }); card.appendChild(completed);
      }
      var help = U.elFromHTML('<div class="readiness-help"></div>');
      button(help, 'นำเข้าข้อมูลจากไฟล์', 'import'); button(help, 'ตรวจความพร้อมก่อนจัด', 'generate'); card.appendChild(help);
      root.appendChild(card);
      if (tt) {
        var links = U.elFromHTML('<div class="flex gap-8 flex-wrap"></div>');
        button(links, 'ตรวจและปรับตาราง', 'issues'); button(links, 'ประวัติตาราง', 'history'); button(links, 'จัดตารางใหม่', 'generate'); root.appendChild(links);
      }
    }
  };
})(window);
