/* ============================================================
   SchoolTable — app.js   เปลือกแอป เมนู และการสลับหน้า
   ============================================================ */
(function (global) {
  'use strict';

  var U = global.ST.util;
  var store = global.ST.store;
  var M = global.ST.model;

  var NAV = [
    { phase: 0, group: '', items: [{ key: 'overview', icon: 'home', label: 'ภาพรวม' }] },
    { phase: 1, group: 'เตรียมข้อมูล', items: [
      { key: 'settings', icon: 'settings', label: 'โรงเรียนและคาบเรียน' },
      { key: 'import', icon: 'download', label: 'นำเข้าข้อมูล' },
      { key: 'rooms', icon: 'building', label: 'อาคารและห้อง' },
      { key: 'subjects', icon: 'book', label: 'รายวิชา' },
      { key: 'teachers', icon: 'users', label: 'ครู' },
      { key: 'curriculum', icon: 'layers', label: 'หลักสูตร' },
      { key: 'sections', icon: 'grid', label: 'ชั้นเรียน' }
    ] },
    { phase: 2, group: 'กำหนดการสอน', items: [
      { key: 'assignments', icon: 'clipboard', label: 'จัดครูผู้สอน', badge: 'assignments' },
      { key: 'conditions', icon: 'sliders', label: 'เงื่อนไขการจัด' },
      { key: 'locks', icon: 'lock', label: 'ล็อกคาบ' }
    ] },
    { phase: 3, group: 'จัดและตรวจตาราง', items: [
      { key: 'generate', icon: 'spark', label: 'จัดตารางอัตโนมัติ' },
      { key: 'timetable', icon: 'calendar', label: 'ตารางสอน' },
      { key: 'issues', icon: 'warning', label: 'ตรวจและปรับตาราง', badge: 'issues' },
      { key: 'print', icon: 'print', label: 'พิมพ์ตาราง' },
      { key: 'history', icon: 'history', label: 'ประวัติตาราง' }
    ] }
  ];

  var current = { key: 'overview', params: {} };

  function state() { return store.getState(); }

  function go(key, params) {
    if (!global.ST.pages[key]) key = 'overview';
    var content = U.qs('#content');
    if (content && content.dataset.generating === 'true') { U.toast('กำลังจัดตาราง กรุณารอผลหรือกดหยุดการจัดก่อนเปลี่ยนหน้า', 'info'); return; }
    if (content && content._hasUnsaved && content._hasUnsaved()) {
      U.confirmDialog({ title: 'ยังมีข้อมูลที่ไม่ได้บันทึก', message: 'บันทึกข้อมูลในหน้านี้ก่อน หรือออกจากหน้าโดยไม่เก็บการแก้ไข', confirmText: 'ออกโดยไม่บันทึก', danger: true }).then(function (ok) {
        if (ok) { content._hasUnsaved = null; go(key, params); }
      });
      return;
    }
    current = { key: key, params: params || {} };
    U.qs('#sidebar').classList.remove('is-open');
    if (window.matchMedia('(max-width: 1023px)').matches) U.qs('#btnMenu').setAttribute('aria-expanded', 'false');
    render();
    var content = U.qs('#content');
    if (content) { content.scrollTop = 0; window.scrollTo(0, 0); }
  }

  function refresh() { render(); }

  function saveAndRefresh(message, kind) {
    var saved = store.save();
    render();
    if (saved && message) U.toast(message, kind || 'success');
  }

  function issueCount() {
    var tt = M.activeTimetable(state());
    if (!tt) return 0;
    return tt.issues.length;
  }

  function renderNav() {
    var st = state();
    var total = st.assignments.length;
    var done = M.assignedCount(st);
    var issues = issueCount();
    var host = U.qs('#sidebarNav');
    var html = '';
    NAV.forEach(function (grp) {
      html += '<div class="nav-group" data-phase="' + grp.phase + '">';
      if (grp.group) {
        html += '<div class="nav-group__label">' +
          (grp.phase ? '<span class="nav-group__num" aria-hidden="true">' + grp.phase + '</span>' : '') +
          U.esc(grp.group) + '</div>';
      }
      grp.items.forEach(function (item) {
        var badge = '';
        if (item.badge === 'issues' && issues > 0) {
          badge = '<span class="nav-item__badge nav-item__badge--warning">' + U.fmtNum(issues) + '</span>';
        }
        if (item.badge === 'assignments' && total > 0) {
          badge = '<span class="nav-item__badge' + (done < total ? ' nav-item__badge--danger' : '') + '">' +
            U.fmtNum(done) + '/' + U.fmtNum(total) + '</span>';
        }
        html += '<button type="button" class="nav-item' +
          (item.primary ? ' nav-item--primary' : '') +
          (current.key === item.key ? ' is-active' : '') +
          '" data-phase="' + grp.phase + '"' + (current.key === item.key ? ' aria-current="page"' : '') +
          ' data-page="' + item.key + '" title="' + U.esc(item.label) + '">' +
          '<span class="nav-item__icon" aria-hidden="true">' + global.ST.ux.icon(item.icon) + '</span>' +
          '<span class="nav-item__text">' + U.esc(item.label) + '</span>' + badge + '</button>';
      });
      html += '</div>';
    });
    host.innerHTML = html;
  }

  function renderTopbar() {
    var st = state();
    U.qs('#topSchool').textContent = st.school.name || 'ยังไม่ได้ตั้งชื่อโรงเรียน';
    U.qs('#topTerm').textContent = 'ปีการศึกษา ' + st.school.academicYear + ' · ภาคเรียนที่ ' + st.school.semester;
    var tt = M.activeTimetable(st);
    U.qs('#topStatus').innerHTML = tt
      ? global.ST.ui.statusBadge(tt.status) + ' <span class="small muted">' + U.esc(tt.name) + '</span>'
      : '<span class="badge badge--muted">ยังไม่ได้จัดตาราง</span>';
  }

  function render() {
    renderNav();
    renderTopbar();
    var content = U.qs('#content');
    if (content._cleanup) { content._cleanup(); content._cleanup = null; }
    content.innerHTML = '';
    content._hasUnsaved = null;
    content.dataset.page = current.key;
    document.body.classList.remove('tt-focus');
    content.classList.remove('tt-view-compact', 'tt-view-normal', 'tt-view-large');
    var page = global.ST.pages[current.key];
    try {
      page.render(content, current.params);
      if (current.key === 'settings') {
        var settingsValues = function () { return JSON.stringify(U.qsa('input:not([type="file"]), select, textarea', content).map(function (el) { return [el.id, el.type === 'checkbox' ? el.checked : el.value]; })); };
        var originalSettings = settingsValues();
        content._hasUnsaved = function () { return settingsValues() !== originalSettings; };
      }
      renderNextStep(content);
      global.ST.ux.decorate(content);
    } catch (err) {
      content.appendChild(U.elFromHTML(
        '<div class="card"><div class="card__title text-danger">หน้านี้แสดงผลไม่สำเร็จ</div>' +
        '<p>สาเหตุ: ระบบพบข้อผิดพลาดระหว่างเตรียมหน้าจอ (' + U.esc(err && err.message) + ')</p>' +
        '<p>วิธีแก้: ให้กลับไปหน้าภาพรวม แล้วลองใหม่อีกครั้ง หากยังไม่หายให้กู้ข้อมูลจากไฟล์สำรอง</p></div>'
      ));
      if (global.console) console.error(err);
    }
  }

  function renderNextStep(content) {
    var routes = { settings:['rooms','อาคารและห้อง'], rooms:['subjects','รายวิชา'], subjects:['teachers','ครู'], teachers:['curriculum','หลักสูตร'], curriculum:['sections','ชั้นเรียน'], sections:['assignments','จัดครูผู้สอน'], assignments:['conditions','เงื่อนไขการจัด'], locks:['generate','จัดตารางอัตโนมัติ'], import:['overview','ตรวจความพร้อม'], issues:['timetable','เปิดตาราง'] };
    var route = routes[current.key];
    if (!route) return;
    var footer = U.elFromHTML('<div class="workflow-next no-print"><span>ขั้นตอนถัดไป · ' + U.esc(route[1]) + '</span><button type="button" class="btn btn--primary">ต่อไป: ' + U.esc(route[1]) + ' →</button></div>');
    footer.querySelector('button').addEventListener('click', function () { go(route[0]); });
    content.appendChild(footer);
  }

  /* ---------- ธีม: ตามเครื่อง · สว่าง · มืด ---------- */
  var THEME_KEY = 'schooltable.theme';
  var THEME_ORDER = ['system', 'light', 'dark'];
  var THEME_META = {
    system: { icon: '🌓', label: 'ตามเครื่อง' },
    light: { icon: '☀️', label: 'สว่าง' },
    dark: { icon: '🌙', label: 'มืด' }
  };

  function themePref() {
    var v = null;
    try { v = localStorage.getItem(THEME_KEY); } catch (e) { /* เบราว์เซอร์ปิดที่เก็บข้อมูล */ }
    return THEME_META[v] ? v : 'system';
  }

  function saveThemePref(value) {
    try {
      if (value === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, value);
    } catch (e) { /* บันทึกไม่ได้ก็ยังใช้ได้ในรอบนี้ */ }
  }

  function systemIsDark() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function applyTheme() {
    var pref = themePref();
    var effective = pref === 'system' ? (systemIsDark() ? 'dark' : 'light') : pref;
    document.documentElement.setAttribute('data-theme', effective);

    var btn = U.qs('#btnTheme');
    var icon = U.qs('#themeIcon');
    if (!btn || !icon) return;
    var next = THEME_ORDER[(THEME_ORDER.indexOf(pref) + 1) % THEME_ORDER.length];
    icon.textContent = THEME_META[pref].icon;
    var showing = pref === 'system' ? ' (ตอนนี้แสดงแบบ' + THEME_META[effective].label + ')' : '';
    var text = 'ธีม: ' + THEME_META[pref].label + showing +
      ' · กดเพื่อเปลี่ยนเป็น ' + THEME_META[next].label;
    btn.title = text;
    btn.setAttribute('aria-label', text);
  }

  function cycleTheme() {
    var next = THEME_ORDER[(THEME_ORDER.indexOf(themePref()) + 1) % THEME_ORDER.length];
    saveThemePref(next);
    applyTheme();
    U.toast('เปลี่ยนธีมเป็น' + THEME_META[next].label +
      (next === 'system' ? ' ระบบจะเปลี่ยนตามการตั้งค่าของเครื่องให้เอง' : ''), 'info', 2600);
  }

  function watchSystemTheme() {
    if (typeof matchMedia !== 'function') return;
    var mq = matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () { if (themePref() === 'system') applyTheme(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  /* ---------- ขนาดหน้าการทำงาน: เล็ก · กลาง · ใหญ่ ---------- */
  var UI_SIZE_KEY = 'schooltable.uiSize';
  var UI_SIZE_META = {
    small: { label: 'เล็ก' },
    medium: { label: 'กลาง' },
    large: { label: 'ใหญ่' }
  };

  function uiSizePref() {
    var value = 'medium';
    try { value = localStorage.getItem(UI_SIZE_KEY) || 'medium'; } catch (e) { /* ใช้ค่ากลาง */ }
    return UI_SIZE_META[value] ? value : 'medium';
  }

  function applyUiSize(value, announce) {
    if (!UI_SIZE_META[value]) value = 'medium';
    document.documentElement.setAttribute('data-ui-size', value);
    U.qsa('.ui-scale-btn').forEach(function (btn) {
      var active = btn.dataset.uiSize === value;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    try { localStorage.setItem(UI_SIZE_KEY, value); } catch (e) { /* ยังใช้ค่าในรอบนี้ได้ */ }
    if (announce) U.toast('ปรับขนาดหน้าการทำงานเป็น “' + UI_SIZE_META[value].label + '” แล้ว', 'info', 2200);
  }

  function boot() {
    var loaded = store.load();
    if (!loaded) {
      store.replaceState(global.ST.mockdata.build());
    }
    M.syncAssignments(state());
    store.save();

    applyTheme();
    applyUiSize(uiSizePref(), false);
    watchSystemTheme();
    try { document.body.classList.toggle('sidebar-collapsed', localStorage.getItem('schooltable.sidebarCollapsed') === 'true'); } catch (e) { }
    U.qs('#btnMenu').innerHTML = global.ST.ux.icon('menu');
    U.qs('#btnMenu').setAttribute('aria-label', window.innerWidth <= 1023 ? 'เปิดเมนู' : document.body.classList.contains('sidebar-collapsed') ? 'ขยายเมนู' : 'ยุบเมนู');
    U.qs('#btnMenu').setAttribute('aria-expanded', String(window.innerWidth > 1023 && !document.body.classList.contains('sidebar-collapsed')));
    var iconPending = false;
    new MutationObserver(function (mutations) {
      if (iconPending || !mutations.some(function (m) { return m.type === 'characterData' || m.addedNodes.length; })) return;
      iconPending = true;
      queueMicrotask(function () { iconPending = false; global.ST.ux.decorate(document.body); });
    }).observe(document.body, {childList:true, subtree:true, characterData:true});

    U.on(document, 'click', '.nav-item', function (ev, btn) { go(btn.dataset.page); });
    U.qs('#btnMenu').addEventListener('click', function () {
      if (window.matchMedia('(max-width: 1023px)').matches) {
        var open = U.qs('#sidebar').classList.toggle('is-open');
        U.qs('#btnMenu').setAttribute('aria-expanded', String(open));
      } else {
        var collapsed = document.body.classList.toggle('sidebar-collapsed');
        U.qs('#btnMenu').setAttribute('aria-expanded', String(!collapsed));
        U.qs('#btnMenu').setAttribute('aria-label', collapsed ? 'ขยายเมนู' : 'ยุบเมนู');
        try { localStorage.setItem('schooltable.sidebarCollapsed', String(collapsed)); } catch (e) { }
      }
    });
    U.qs('#btnTheme').addEventListener('click', cycleTheme);
    U.on(document, 'click', '.ui-scale-btn', function (ev, btn) {
      applyUiSize(btn.dataset.uiSize, true);
    });
    U.qs('#btnTopPrint').addEventListener('click', function () { go('print'); });
    U.qs('#btnTopBackup').addEventListener('click', function () {
      store.exportBackup();
      U.toast('ส่งออกไฟล์สำรองข้อมูลแล้ว เก็บไฟล์นี้ไว้เพื่อกู้คืนภายหลังได้', 'success');
    });

    go('overview');
  }

  global.ST.pages = global.ST.pages || {};
  global.ST.app = {
    go: go, refresh: refresh, saveAndRefresh: saveAndRefresh,
    state: state, boot: boot, current: function () { return current; }
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
