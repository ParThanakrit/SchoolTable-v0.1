/* หน้า P10 — จัดตารางอัตโนมัติ */
(function (global) {
  'use strict';
  var U = global.ST.util, M = global.ST.model, UI = global.ST.ui;
  global.ST.pages = global.ST.pages || {};

  var lastResult = null;
  var options = { keepManual: true, regenerateAll: false };

  function currentDraft(st) {
    return M.currentSemesterTimetables(st).filter(function (t) { return t.status === 'DRAFT'; })[0] || null;
  }

  global.ST.pages.generate = {
    render: function (root, params) {
      var app = global.ST.app;
      var st = app.state();
      var detail = M.preflightDetail(st);
      var problems = detail.blockers;
      var warnings = detail.warnings;
      var draft = currentDraft(st);
      var active = M.activeTimetable(st);

      UI.pageHeader(root, {
        title: 'จัดตารางอัตโนมัติ',
        desc: 'กดปุ่มเดียว ระบบจะจัดตารางสอนทั้งโรงเรียนโดยไม่ให้ครู ชั้นเรียน หรือห้องชนกันแม้แต่จุดเดียว'
      });

      if (params && params.result) lastResult = params.result;

      /* ---------- ข้อมูลไม่ครบ ---------- */
      if (problems.length) {
        var card = U.elFromHTML('<div class="result-card result-card--danger">' +
          '<div class="result-card__title">ยังเริ่มจัดตารางไม่ได้ เพราะข้อมูลยังไม่ครบ</div>' +
          '<div class="result-card__line">ระบบตรวจแล้วพบ ' + problems.length + ' เรื่องที่ต้องแก้ก่อน</div></div>');
        root.appendChild(card);
        var list = U.elFromHTML('<div class="card"><div class="card__title">สิ่งที่ต้องแก้ก่อน</div><div id="pfList"></div></div>');
        var host = list.querySelector('#pfList');
        problems.forEach(function (p) {
          var item = U.elFromHTML('<div class="issue issue--high">' +
            '<div class="issue__head"><span class="issue__title">' + U.esc(p.title) + '</span></div>' +
            '<div class="issue__reason">' + U.esc(p.message) + '</div>' +
            '<div class="mt-8"><button type="button" class="btn btn--sm">ไปหน้าที่ต้องแก้</button></div></div>');
          item.querySelector('button').addEventListener('click', function () { app.go(p.page); });
          host.appendChild(item);
        });
        root.appendChild(list);
        return;
      }

      /* ---------- คำเตือนที่ยังจัดต่อได้ ---------- */
      if (warnings.length) {
        var warnCard = U.elFromHTML('<div class="card">' +
          '<div class="card__title text-warning">⚠ จัดได้ แต่จะมีคาบค้างแน่นอน</div>' +
          '<div class="card__desc">ระบบยังจัดตารางให้ได้ และจะรายงานทุกคาบที่จัดไม่ลงพร้อมเหตุผล ' +
          'แต่ถ้าแก้เรื่องเหล่านี้ก่อนจะได้ตารางที่สมบูรณ์กว่า</div><div id="warnList"></div></div>');
        var warnHost = warnCard.querySelector('#warnList');
        warnings.forEach(function (w) {
          var item = U.elFromHTML('<div class="issue issue--medium">' +
            '<div class="issue__head"><span class="issue__title">' + U.esc(w.title) + '</span></div>' +
            '<div class="issue__reason">' + U.esc(w.message) + '</div>' +
            '<div class="mt-8 no-print"><button type="button" class="btn btn--sm">ไปหน้าที่ต้องแก้</button></div></div>');
          item.querySelector('button').addEventListener('click', function () { app.go(w.page); });
          warnHost.appendChild(item);
        });
        root.appendChild(warnCard);
      }

      /* ---------- ตารางที่ประกาศใช้แล้ว ---------- */
      if (active && active.status !== 'DRAFT' && !draft) {
        root.appendChild(U.elFromHTML('<div class="result-card result-card--warning">' +
          '<div class="result-card__title">ตารางที่ดูอยู่ประกาศใช้แล้ว จึงจัดทับโดยตรงไม่ได้</div>' +
          '<div class="result-card__line">ตารางที่ประกาศใช้แล้วคือตารางที่ครูและนักเรียนกำลังใช้อยู่จริง ' +
          'ระบบจึงป้องกันไม่ให้จัดทับ เพื่อไม่ให้ตารางเสียหายระหว่างที่ยังแก้ไม่เสร็จ</div></div>'));
        var mk = U.elFromHTML('<div class="card"><button type="button" class="btn btn--primary">สร้างร่างใหม่จากตารางนี้</button></div>');
        mk.querySelector('button').addEventListener('click', function () {
          global.ST.pages.history.createDraftFrom(active.id);
        });
        root.appendChild(mk);
      }

      /* ---------- ก่อนกด ---------- */
      var totalPeriods = st.assignments.reduce(function (s, a) {
        return s + (a.teacherId ? U.num(a.periodsPerWeek) : 0);
      }, 0);
      var summary = U.elFromHTML('<div class="card"><div class="card__title">ข้อมูลที่จะใช้จัด</div>' +
        '<div class="table-wrap"><table class="data"><tbody>' +
        '<tr><th style="width:230px">ชั้นเรียน</th><td>' + U.fmtNum(st.classSections.length) + ' ห้อง</td></tr>' +
        '<tr><th>ครู</th><td>' + U.fmtNum(st.teachers.length) + ' คน</td></tr>' +
        '<tr><th>ห้องสถานที่</th><td>' + U.fmtNum(st.rooms.length) + ' ห้อง ใน ' + st.buildings.length + ' อาคาร</td></tr>' +
        '<tr><th>รายการมอบหมายสอน</th><td>' + U.fmtNum(st.assignments.length) + ' รายการ</td></tr>' +
        '<tr><th>คาบที่ต้องจัด</th><td><b>' + U.fmtNum(totalPeriods) + ' คาบต่อสัปดาห์</b></td></tr>' +
        '<tr><th>คาบที่ล็อกไว้</th><td>' + U.fmtNum(st.lockedSlots.length) + ' รายการ (ระบบจะไม่แตะต้อง)</td></tr>' +
        '</tbody></table></div></div>');
      root.appendChild(summary);

      var optCard = U.elFromHTML('<div class="card generation-options"><div class="card__title">วิธีจัดตาราง</div>' +
        '<div class="card__desc">คาบที่ล็อกไว้จะอยู่ตำแหน่งเดิมเสมอ</div>' +
        '<label class="checkline generation-option"><input type="radio" name="generationMode" id="optManual"' + (!options.regenerateAll ? ' checked' : '') + '>' +
        '<span class="generation-option__copy"><b>จัดใหม่ โดยเก็บคาบที่ฉันปรับไว้</b><span class="generation-option__desc">จัดเฉพาะส่วนที่เหลือ โดยคงคาบที่เคยลากปรับและคาบล็อกไว้ตำแหน่งเดิม</span></span></label>' +
        '<label class="checkline generation-option"><input type="radio" name="generationMode" id="optAll"' + (options.regenerateAll ? ' checked' : '') + '>' +
        '<span class="generation-option__copy"><b>จัดใหม่ทั้งหมด โดยเก็บเฉพาะคาบล็อก</b><span class="generation-option__desc">จัดตำแหน่งคาบใหม่ทั้งตาราง รวมถึงคาบที่เคยลากปรับเอง</span></span></label></div>');
      root.appendChild(optCard);
      optCard.querySelector('#optManual').addEventListener('change', function () { options.keepManual = true; options.regenerateAll = false; });
      optCard.querySelector('#optAll').addEventListener('change', function () { options.regenerateAll = true; options.keepManual = false; });

      var runCard = U.elFromHTML('<div class="card" id="runCard"></div>');
      root.appendChild(runCard);
      var hero = U.elFromHTML('<button type="button" class="btn-hero">⚡ จัดตารางอัตโนมัติ' +
        '<span class="btn-hero__sub">ข้อมูลพร้อมแล้ว · จะจัด ' + U.fmtNum(totalPeriods) + ' คาบให้ทั้งโรงเรียน</span></button>');
      hero.addEventListener('click', start);
      runCard.appendChild(hero);

      /* ---------- ผลลัพธ์ครั้งล่าสุด ---------- */
      if (lastResult && U.byId(st.timetables, lastResult.timetableId)) {
        var resultNode = resultCard(lastResult);
        resultNode.classList.add('generation-result');
        root.insertBefore(resultNode, root.querySelector('.page-header').nextSibling);
      }

      function start() {
        var proceed = Promise.resolve(true);
        if (warnings.length) {
          proceed = U.confirmDialog({
            title: 'จัดต่อไปทั้งที่รู้ว่าจะมีคาบค้าง',
            message: 'ระบบตรวจพบ ' + warnings.length + ' เรื่องที่จะทำให้บางคาบจัดไม่ลง',
            detail: '<ul class="list-plain">' + warnings.map(function (w) {
              return '<li>' + U.esc(w.title) + ' — ' + U.esc(w.message) + '</li>';
            }).join('') + '</ul>',
            hint: 'ถ้ายืนยัน ระบบจะจัดเท่าที่ทำได้ แล้วแสดงคาบที่ค้างพร้อมเหตุผลในรายงานปัญหา',
            confirmText: 'จัดต่อไป'
          });
        }
        if (draft && draft.entries.length) {
          proceed = proceed.then(function (ok) {
            if (!ok) return false;
            return U.confirmDialog({
            title: 'จัดตารางทับร่างเดิม',
            message: 'มีตารางฉบับร่างอยู่แล้ว (' + draft.name + ') การจัดใหม่จะเขียนทับร่างนี้',
            detail: '<b>ผลที่จะเกิดขึ้น</b><br>' + (options.regenerateAll
              ? 'ผลเดิมทั้งหมดจะถูกล้าง ยกเว้นคาบที่ล็อกไว้'
              : 'คาบที่ระบบจัดไว้เดิมจะถูกจัดใหม่' + (options.keepManual ? ' ยกเว้นคาบที่คุณลากปรับเองไว้' : ' รวมถึงคาบที่คุณลากปรับเองไว้')),
            confirmText: 'จัดตารางใหม่', danger: true
          });
          });
        }
        proceed.then(function (ok) { if (ok) run(); });
      }

      function run() {
        var stopped = false;
        root.dataset.generating = 'true';
        optCard.querySelectorAll('input').forEach(function (input) { input.disabled = true; });
        runCard.innerHTML = '';
        var panel = U.elFromHTML('<div>' +
          '<div class="card__title">กำลังจัดตาราง</div>' +
          '<div class="progress"><div class="progress__fill" id="pgFill"></div></div>' +
          '<div class="progress__text" id="pgText">กำลังเตรียมข้อมูล…</div>' +
          '<div class="mt-16"><button type="button" class="btn btn--danger" id="btnStop">หยุดการจัด</button></div></div>');
        runCard.appendChild(panel);
        panel.querySelector('#btnStop').addEventListener('click', function () {
          stopped = true;
          panel.querySelector('#pgText').textContent = 'กำลังหยุดและคืนสภาพเดิม…';
        });

        var preserve = [];
        if (draft && !options.regenerateAll) {
          preserve = draft.entries.filter(function (e) {
            return e.isLocked || (options.keepManual && e.isManual);
          });
        } else if (draft && options.regenerateAll) {
          preserve = draft.entries.filter(function (e) { return e.isLocked; });
        }

        global.ST.scheduler.generate(st, {
          preserveEntries: preserve,
          shouldStop: function () { return stopped; },
          onProgress: function (p) {
            panel.querySelector('#pgFill').style.width = p.percent + '%';
            panel.querySelector('#pgText').textContent = p.message;
          }
        }).then(function (result) {
          root.dataset.generating = 'false';
          optCard.querySelectorAll('input').forEach(function (input) { input.disabled = false; });
          if (result.stopped) {
            runCard.innerHTML = '';
            runCard.appendChild(U.elFromHTML('<div class="result-card result-card--warning">' +
              '<div class="result-card__title">หยุดการจัดตารางแล้ว</div>' +
              '<div class="result-card__line">ตารางเดิมยังอยู่เหมือนเดิม ไม่มีอะไรถูกเปลี่ยน</div></div>'));
            var again = U.elFromHTML('<button type="button" class="btn btn--primary mt-16">เริ่มจัดใหม่</button>');
            again.addEventListener('click', function () { app.go('generate'); });
            runCard.appendChild(again);
            return;
          }

          var target = draft;
          if (!target) {
            var n = M.currentSemesterTimetables(st).length + 1;
            target = {
              id: U.uid('tt'),
              academicYear: st.school.academicYear,
              semester: st.school.semester,
              status: 'DRAFT',
              name: 'ร่างที่ ' + n,
              sourceTimetableId: '',
              entries: [], issues: [],
              stats: {}, createdAt: new Date().toISOString()
            };
            st.timetables.push(target);
          }
          target.entries = result.entries;
          target.issues = result.issues;
          target.stats = result.stats;
          target.generatedAt = new Date().toISOString();
          target.generationTimeMs = result.elapsedMs;
          target.updatedAt = target.generatedAt;
          st.activeTimetableId = target.id;
          global.ST.store.save();
          lastResult = { result: result, timetableId: target.id };
          app.go('generate', { result: lastResult });
        });
      }

      function resultCard(payload) {
        var saved = U.byId(st.timetables, payload.timetableId);
        var result = saved ? {stats:saved.stats, issues:saved.issues, elapsedMs:saved.generationTimeMs || 0} : payload.result;
        var s = result.stats;
        var kind = s.unplaced > 0 ? 'warning' : 'success';
        var title = s.unplaced > 0 ? 'ยังเหลือคาบที่ต้องจัด ' + U.fmtNum(s.unplaced) + ' คาบ' : 'จัดครบ ' + U.fmtNum(s.placed) + ' คาบแล้ว';

        var byRule = {};
        result.issues.forEach(function (i) {
          if (i.type === 'SOFT_VIOLATION') byRule[i.ruleCode] = (byRule[i.ruleCode] || 0) + 1;
        });
        var softText = Object.keys(byRule).map(function (code) {
          return global.ST.scheduler.SOFT_LABEL[code] + ' ' + U.fmtNum(byRule[code]) + ' จุด';
        }).join(' · ') || 'ไม่มี';

        var node = U.elFromHTML('<div class="result-card result-card--' + kind + '">' +
          '<div class="result-card__title">' + title + '</div>' +
          '<div class="result-card__line">จัดสำเร็จ <b>' + U.fmtNum(s.placed) + '</b> จาก <b>' +
          U.fmtNum(s.totalRequired) + '</b> คาบ · เหลือ <b>' + U.fmtNum(s.unplaced) +
          '</b> คาบที่จัดไม่ลง · ใช้เวลา <b>' + (result.elapsedMs / 1000).toFixed(1) + ' วินาที</b></div>' +
          '<div class="result-card__line">ข้อเสนอปรับตาราง: ' + U.esc(softText) + '</div>' +
          '<div class="result-card__line">ผลลัพธ์ถูกบันทึกเป็นตารางสถานะ <b>ฉบับร่าง</b> แก้ไขและลากปรับได้</div>' +
          '<div class="flex gap-8 flex-wrap mt-16"></div></div>');
        var actions = node.querySelector('.flex');
        [
          { label: 'เปิดตารางเพื่อตรวจ', page: 'timetable', cls: 'btn--primary' },
          { label: 'ดูรายงานปัญหา', page: 'issues' },
          { label: 'พิมพ์ตาราง', page: 'print' }
        ].forEach(function (a) {
          var b = U.elFromHTML('<button type="button" class="btn ' + (a.cls || '') + '">' + a.label + '</button>');
          b.addEventListener('click', function () { app.go(a.page); });
          actions.appendChild(b);
        });
        if (s.softViolations > 0) {
          var tune = U.elFromHTML('<button type="button" class="btn">✨ ปรับให้ดีขึ้น</button>');
          tune.addEventListener('click', function () { runOptimize(payload.timetableId, tune); });
          actions.appendChild(tune);
        }

        var again = U.elFromHTML('<button type="button" class="btn">จัดใหม่อีกครั้ง</button>');
        again.addEventListener('click', function () { lastResult = null; app.go('generate'); });
        actions.appendChild(again);
        return node;
      }

      function runOptimize(timetableId, btn) {
        var tt = U.byId(st.timetables, timetableId);
        if (!tt) return;
        if (tt.status !== 'DRAFT') {
          U.toast('ปรับได้เฉพาะตารางฉบับร่าง ให้สร้างร่างใหม่ก่อน', 'danger');
          return;
        }
        if (btn) { btn.disabled = true; btn.textContent = 'กำลังปรับ…'; }
        U.nextFrame().then(function () {
          var before = tt.stats.softViolations || 0;
          var res = global.ST.scheduler.optimize(st, tt.entries, { timeBudgetMs: 4000 });
          tt.entries = res.entries;
          tt.issues = tt.issues.filter(function (i) { return i.type === 'UNPLACED'; })
            .concat(global.ST.scheduler.collectSoftIssues(st, tt.entries));
          tt.stats.softViolations = tt.issues.filter(function (i) { return i.type === 'SOFT_VIOLATION'; }).length;
          tt.updatedAt = new Date().toISOString();
          if (lastResult && lastResult.result) {
            lastResult.result.entries = tt.entries;
            lastResult.result.issues = tt.issues;
            lastResult.result.stats = tt.stats;
          }
          global.ST.store.save();
          var after = tt.stats.softViolations;
          var diff = before - after;
          U.toast(diff > 0 ? ('ปรับแล้ว ลดข้อเสนอปรับตารางลง ' + U.fmtNum(diff) + ' จุด (เหลือ ' + U.fmtNum(after) + ')')
            : 'ตารางนี้ดีที่สุดเท่าที่ปรับได้แล้ว ไม่มีจุดที่ย้ายแล้วดีขึ้น', diff > 0 ? 'success' : 'info');
          app.go('generate', { result: lastResult });
        });
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
