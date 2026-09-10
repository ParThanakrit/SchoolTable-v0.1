/* หน้า P13 — พิมพ์ตาราง */
(function (global) {
  'use strict';
  var U = global.ST.util, M = global.ST.model, UI = global.ST.ui, P = global.ST.printing;
  global.ST.pages = global.ST.pages || {};

  var config = {
    format: 'class', scope: 'all', ids: [],
    showTeacher: true, showRoom: true, showTime: true, showSignature: true,
    timetableId: '', previewPage: 1, zoom: 'fit'
  };

  global.ST.pages.print = {
    render: function (root) {
      var app = global.ST.app;
      var st = app.state();
      if (st.activeTimetableId) config.timetableId = st.activeTimetableId;
      var timetables = st.timetables.slice().sort(function (a, b) {
        return new Date(b.generatedAt || b.createdAt || 0) - new Date(a.generatedAt || a.createdAt || 0);
      });

      UI.pageHeader(root, {
        title: 'พิมพ์ตาราง',
        desc: 'เลือกรูปแบบและขอบเขต ดูตัวอย่างกระดาษจริง แล้วสั่งพิมพ์'
      });

      if (!timetables.length) {
        root.appendChild(UI.emptyState({
          icon: '🖨', title: 'ยังไม่มีตารางให้พิมพ์',
          desc: 'ต้องกดจัดตารางอัตโนมัติก่อน จึงจะมีตารางให้พิมพ์',
          actions: [{ label: 'จัดตารางอัตโนมัติ', onClick: function () { app.go('generate'); } }]
        }));
        return;
      }
      if (!U.byId(st.timetables, config.timetableId)) {
        config.timetableId = st.activeTimetableId || timetables[0].id;
      }
      var tt = U.byId(st.timetables, config.timetableId);

      var cols = U.elFromHTML('<div class="grid print-layout"></div>');

      /* ---------- ตัวเลือก ---------- */
      var opt = U.elFromHTML('<div class="card no-print print-controls"><div class="card__title">ตัวเลือกการพิมพ์</div>' +
        '<div class="field"><label class="field__label" for="prTT">ตารางที่จะพิมพ์</label>' +
        '<select class="select" id="prTT">' + timetables.map(function (t) {
          return '<option value="' + t.id + '"' + (t.id === tt.id ? ' selected' : '') + '>' +
            U.esc(t.name) + ' — ' + M.statusLabel(t.status) + '</option>';
        }).join('') + '</select>' +
        (tt.status === 'DRAFT' ? '<div class="field__hint">ตารางฉบับร่างจะมีคำว่า “ฉบับร่าง” กำกับบนกระดาษ</div>' : '') +
        '</div>' +
        '<div class="field"><label class="field__label" for="prFormat">รูปแบบ</label>' +
        '<select class="select" id="prFormat">' +
        '<option value="class"' + (config.format === 'class' ? ' selected' : '') + '>ตารางเรียนรายชั้นเรียน</option>' +
        '<option value="teacher"' + (config.format === 'teacher' ? ' selected' : '') + '>ตารางสอนรายครู</option>' +
        '<option value="school"' + (config.format === 'school' ? ' selected' : '') + '>ตารางรวมทั้งโรงเรียน</option>' +
        '</select></div>' +
        '<div class="field" id="scopeField"><label class="field__label" for="prScope">ขอบเขต</label>' +
        '<select class="select" id="prScope">' +
        '<option value="all"' + (config.scope === 'all' ? ' selected' : '') + '>ทั้งหมดในครั้งเดียว</option>' +
        '<option value="pick"' + (config.scope === 'pick' ? ' selected' : '') + '>เลือกเฉพาะบางรายการ</option>' +
        '</select></div>' +
        '<div class="field" id="pickField"></div>' +
        '<div class="field"><label class="field__label">ข้อมูลที่แสดงในช่อง</label>' +
        '<div class="checkline"><input type="checkbox" id="prTeacher"' + (config.showTeacher ? ' checked' : '') + '><label for="prTeacher">แสดงชื่อครู</label></div>' +
        '<div class="checkline"><input type="checkbox" id="prRoom"' + (config.showRoom ? ' checked' : '') + '><label for="prRoom">แสดงห้องเรียน</label></div>' +
        '<div class="checkline"><input type="checkbox" id="prTime"' + (config.showTime ? ' checked' : '') + '><label for="prTime">แสดงเวลาคาบ</label></div>' +
        '<div class="checkline"><input type="checkbox" id="prSign"' + (config.showSignature ? ' checked' : '') + '><label for="prSign">มีช่องลงนามผู้อำนวยการ</label></div>' +
        '</div>' +
        '<button type="button" class="btn btn--primary btn--block" id="btnDoPrint">🖨 พิมพ์</button>' +
        '<div class="small muted mt-8" id="prCount"></div>' +
        '</div>');
      cols.appendChild(opt);

      var previewCard = U.elFromHTML('<div class="card preview-card"><div class="card__title no-print">ตัวอย่างก่อนพิมพ์</div>' +
        '<div class="card__desc no-print">แสดงตามสัดส่วนกระดาษ A4 แนวนอน เมนูและปุ่มจะไม่ถูกพิมพ์ออกมา</div>' +
        '<div class="preview-tools no-print"><button type="button" class="btn btn--sm" id="prPrev" aria-label="หน้าก่อนหน้า">←</button><label for="prPage">หน้า</label><input class="input" id="prPage" type="number" min="1" value="1"><span id="prPages"></span><button type="button" class="btn btn--sm" id="prNext" aria-label="หน้าถัดไป">→</button><label for="prZoom">ซูม</label><select class="select" id="prZoom"><option value="fit">พอดีหน้าจอ</option><option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option><option value="1.25">125%</option></select></div>' +
        '<div id="previewHost"></div></div>');
      cols.appendChild(previewCard);
      root.appendChild(cols);

      var pickField = opt.querySelector('#pickField');

      function itemsForFormat() {
        if (config.format === 'teacher') return U.sortThai(st.teachers, function (t) { return t.name; });
        if (config.format === 'class') return U.sortThai(st.classSections, function (s) { return s.name; });
        return [];
      }

      function paintPick() {
        if (config.format === 'school' || config.scope !== 'pick') {
          pickField.innerHTML = '';
          opt.querySelector('#scopeField').style.display = config.format === 'school' ? 'none' : '';
          return;
        }
        opt.querySelector('#scopeField').style.display = '';
        var items = itemsForFormat();
        pickField.innerHTML = '<label class="field__label">เลือกรายการที่จะพิมพ์</label>' +
          '<div class="scroll-y" style="max-height:220px;border:1px solid var(--line);border-radius:8px;padding:6px">' +
          items.map(function (i) {
            return '<div class="checkline"><input type="checkbox" id="printPick_' + i.id + '" value="' + i.id + '"' +
              (config.ids.indexOf(i.id) !== -1 ? ' checked' : '') + '><label for="printPick_' + i.id + '">' + U.esc(i.name) + '</label></div>';
          }).join('') + '</div>';
        U.on(pickField, 'change', 'input[type="checkbox"]', function () {
          config.ids = U.qsa('input[type="checkbox"]:checked', pickField).map(function (c) { return c.value; });
          paintPreview();
        });
      }

      function currentConfig() {
        return {
          format: config.format,
          ids: config.scope === 'pick' ? config.ids : [],
          showTeacher: config.showTeacher,
          showRoom: config.showRoom,
          showTime: config.showTime,
          showSignature: config.showSignature
        };
      }

      var previewHost = previewCard.querySelector('#previewHost'), previewPages = [];
      function documentHtml() {
        if (config.format !== 'school' && config.scope === 'pick' && !config.ids.length) return '';
        return P.buildDocument(st, tt, currentConfig());
      }
      function updatePreviewPage() {
        config.previewPage = Math.max(1, Math.min(config.previewPage, previewPages.length || 1));
        var field = previewCard.querySelector('#prPage');
        field.value = config.previewPage; field.max = previewPages.length || 1; field.disabled = !previewPages.length;
        previewCard.querySelector('#prPages').textContent = '/ ' + previewPages.length;
        previewCard.querySelector('#prPrev').disabled = !previewPages.length || config.previewPage <= 1;
        previewCard.querySelector('#prNext').disabled = !previewPages.length || config.previewPage >= previewPages.length;
        previewPages.forEach(function (page, i) { page.style.display = i === config.previewPage - 1 ? '' : 'none'; });
        var zoom = config.zoom === 'fit' ? Math.min(1, Math.max(.2, (previewHost.clientWidth - 32) / 1047)) : Number(config.zoom);
        previewPages.forEach(function (page) { page.style.zoom = zoom; });
        previewHost.scrollTop = 0; previewHost.scrollLeft = 0;
      }
      function paintPreview() {
        var html = documentHtml();
        P.showPreview(html, previewHost);
        previewPages = Array.from(previewHost.querySelectorAll('.print-page'));
        var pageCount = previewPages.length;
        opt.querySelector('#prCount').textContent = pageCount ? 'พิมพ์ทุกหน้าตามขอบเขตที่เลือก · การซูมมีผลเฉพาะตัวอย่าง' : 'เลือกรายการอย่างน้อย 1 รายการก่อนพิมพ์';
        var printButton = opt.querySelector('#btnDoPrint');
        printButton.textContent = pageCount ? 'พิมพ์' + (config.scope === 'all' || config.format === 'school' ? 'ทั้งหมด ' : 'ที่เลือก ') + U.fmtNum(pageCount) + ' หน้า' : 'ยังไม่มีรายการที่เลือก';
        printButton.disabled = !pageCount;
        if (!pageCount) previewHost.innerHTML = '<div class="empty-preview">เลือกรายการทางซ้ายเพื่อดูตัวอย่างก่อนพิมพ์</div>';
        updatePreviewPage();
      }
      previewCard.querySelector('#prZoom').value = config.zoom;
      previewCard.querySelector('#prZoom').addEventListener('change', function (ev) { config.zoom = ev.target.value; updatePreviewPage(); });
      previewCard.querySelector('#prPage').addEventListener('change', function (ev) { config.previewPage = Math.floor(Number(ev.target.value)) || 1; updatePreviewPage(); });
      previewCard.querySelector('#prPrev').addEventListener('click', function () { config.previewPage--; updatePreviewPage(); });
      previewCard.querySelector('#prNext').addEventListener('click', function () { config.previewPage++; updatePreviewPage(); });
      var resize = new ResizeObserver(function () { if (config.zoom === 'fit') updatePreviewPage(); });
      resize.observe(previewHost);
      root._cleanup = function () { resize.disconnect(); };

      opt.querySelector('#prTT').addEventListener('change', function (ev) {
        config.timetableId = ev.target.value;
        st.activeTimetableId = ev.target.value;
        global.ST.store.save();
        app.refresh();
      });
      opt.querySelector('#prFormat').addEventListener('change', function (ev) {
        config.format = ev.target.value;
        config.ids = [];
        paintPick();
        paintPreview();
      });
      opt.querySelector('#prScope').addEventListener('change', function (ev) {
        config.scope = ev.target.value;
        paintPick();
        paintPreview();
      });
      ['prTeacher:showTeacher', 'prRoom:showRoom', 'prTime:showTime', 'prSign:showSignature'].forEach(function (pair) {
        var parts = pair.split(':');
        opt.querySelector('#' + parts[0]).addEventListener('change', function (ev) {
          config[parts[1]] = ev.target.checked;
          paintPreview();
        });
      });

      opt.querySelector('#btnDoPrint').addEventListener('click', function () {
        if (!documentHtml()) return;
        var proceed = Promise.resolve(true);
        if (tt.stats.unplaced > 0) {
          proceed = U.confirmDialog({
            title: 'ตารางนี้ยังไม่สมบูรณ์',
            message: 'ตาราง "' + tt.name + '" ยังมีคาบที่จัดไม่ลงอยู่ ' + U.fmtNum(tt.stats.unplaced) + ' คาบ',
            detail: '<b>ผลที่จะเกิดขึ้น</b><br>ช่องของคาบที่จัดไม่ลงจะว่างบนเอกสารที่พิมพ์ออกมา',
            hint: 'ถ้ายังไม่พร้อม ให้กดยกเลิกแล้วไปดูรายงานปัญหาก่อน',
            confirmText: 'พิมพ์ต่อไป'
          });
        }
        proceed.then(function (ok) {
          if (!ok) return;
          P.doPrint(documentHtml());
        });
      });

      paintPick();
      paintPreview();
    }
  };

  /* ล้างตัวอย่างเมื่อออกจากหน้าพิมพ์ */
  if (typeof document !== 'undefined') {
    document.addEventListener('click', function (ev) {
      var nav = ev.target.closest ? ev.target.closest('.nav-item') : null;
      if (nav && nav.dataset.page !== 'print') {
        var host = document.getElementById('printRoot');
        if (host) host.innerHTML = '';
      }
    }, true);
  }
})(typeof window !== 'undefined' ? window : globalThis);
