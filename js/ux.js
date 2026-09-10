/* Shared presentation helpers. Data changes still use the existing page handlers. */
(function (global) {
  'use strict';
  var U = global.ST.util, M = global.ST.model;
  var paths = {
    home: 'M3 10 12 3l9 7M5 9v12h14V9M9 21v-7h6v7',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    person: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-3a8 5 0 0 1 16 0v3',
    book: 'M12 5v16M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-6-2-10 1',
    building: 'M4 21V3h16v18M2 21h20M8 7h2M14 7h2M8 11h2M14 11h2M10 21v-6h4v6',
    settings: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',
    lock: 'M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4M12 14v3',
    calendar: 'M4 5h16v16H4zM8 2v6M16 2v6M4 10h16M8 14h2M14 14h2M8 18h2',
    spark: 'm12 2-3 7-7 3 7 3 3 7 3-7 7-3-7-3z',
    print: 'M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6zM17 11h1',
    download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
    upload: 'M12 15V3M8 7l4-4 4 4M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4',
    history: 'M3 10a9 9 0 1 1 2 8M3 4v6h6M12 7v6l4 2',
    warning: 'm12 3 10 18H2zM12 9v5M12 17v1',
    check: 'm4 12 5 5L20 6',
    close: 'm5 5 14 14M19 5 5 19',
    menu: 'M3 5h18v14H3zM9 5v14',
    theme: 'M12 3a9 9 0 1 0 0 18V3',
    edit: 'm4 16 12-12 4 4L8 20H4zM14 6l4 4',
    undo: 'm8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12',
    redo: 'm16 4 5 5-5 5M21 9H10a6 6 0 0 0 0 12',
    users: 'M16 20v-1.6a4.4 4.4 0 0 0-4.4-4.4H6.4A4.4 4.4 0 0 0 2 18.4V20M9 11.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5M16.5 4.3a3.75 3.75 0 0 1 0 7.4M22 20v-1.6a4.4 4.4 0 0 0-3.3-4.26',
    layers: 'M12 3 2.5 8 12 13l9.5-5zM2.5 12 12 17l9.5-5M2.5 16 12 21l9.5-5',
    clipboard: 'M8 5H7a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1M9 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1H9zM8.5 13l2 2 4-4',
    sliders: 'M3 7h11M20 7h1M18 7a2 2 0 1 1-4 0 2 2 0 1 1 4 0M3 12h3M10 12h11M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0M3 17h7M15 17h6M13 17a2 2 0 1 1-4 0 2 2 0 1 1 4 0',
    save: 'M5 4h11l3 3v11.5a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18.5V5.5A1.5 1.5 0 0 1 5.5 4zM8 4v4.5h7V4M7.5 20v-5.5h9V20'
  };
  function icon(name) {
    return '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (paths[name] || paths.grid) + '"></path></svg>';
  }
  var symbols = { '🏠':'home', '📅':'calendar', '🧑‍🏫':'person', '👩‍🏫':'person', '📚':'book', '📘':'book', '🏫':'building', '🏢':'building', '🎛':'settings', '⚙':'settings', '🔒':'lock', '⚡':'spark', '✨':'spark', '🖨':'print', '💾':'save', '📥':'download', '📤':'upload', '⬇':'download', '🗂':'history', '🗄':'history', '📋':'grid', '📊':'grid', '⚠':'warning', '❌':'close', '✅':'check', '✔':'check', '✎':'edit', '↶':'undo', '↷':'redo', '🌓':'theme', '☀️':'theme', '🌙':'theme' };
  function decorate(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [], n;
    while ((n = walker.nextNode())) {
      if (n.parentElement && !n.parentElement.closest('svg, option, textarea, script, .print-page, #printRoot') && Object.keys(symbols).some(function (s) { return n.data.indexOf(s) !== -1; })) nodes.push(n);
    }
    nodes.forEach(function (node) {
      var text = node.data, frag = document.createDocumentFragment();
      while (text) {
        var at = text.length, found = '';
        Object.keys(symbols).forEach(function (s) { var i = text.indexOf(s); if (i >= 0 && i < at) { at = i; found = s; } });
        if (!found) { frag.appendChild(document.createTextNode(text)); break; }
        if (at) frag.appendChild(document.createTextNode(text.slice(0, at)));
        frag.appendChild(U.elFromHTML(icon(symbols[found])));
        text = text.slice(at + found.length).replace(/^\uFE0F/, '');
      }
      node.replaceWith(frag);
    });
  }

  function teacherPicker(select, state, assignment, subject, fieldLabel) {
    select.hidden = true;
    var trigger = document.createElement('button');
    trigger.type = 'button'; trigger.className = 'teacher-picker';
    trigger.setAttribute('aria-haspopup', 'dialog');
    select.after(trigger);
    function refresh() {
      var t = U.byId(state.teachers, select.value), load = M.teacherAssignedLoad(state);
      trigger.innerHTML = '<span>' + U.esc(t ? t.name : 'เลือกครูผู้สอน') + '</span><span class="teacher-picker__meta">' +
        (t ? U.esc((U.byId(state.subjectGroups, t.subjectGroupId) || {}).name || '') + ' · ' + (load[t.id] || 0) + '/' + t.maxPeriodsPerWeek + ' คาบ' : 'ค้นหาชื่อหรือกลุ่มสาระ') + '</span>';
      trigger.setAttribute('aria-label', fieldLabel + ' วิชา' + subject.name + ': ' + (t ? t.name : 'ยังไม่ได้เลือก'));
      var details = select.closest('details');
      if (details) details.querySelector('summary').textContent = t ? 'ครูร่วม: ' + t.name : '+ ครูร่วม';
    }
    trigger.addEventListener('click', function () {
      var body = U.elFromHTML('<div><label class="field__label" for="teacherPickerSearch">ค้นหาชื่อครูหรือกลุ่มสาระ</label><input class="input" id="teacherPickerSearch" type="search" autocomplete="off" placeholder="พิมพ์ชื่อหรือกลุ่มสาระ…"><div class="small muted mt-8">แสดงคาบที่ได้รับมอบหมาย / คาบสูงสุดต่อสัปดาห์</div><div class="teacher-results" role="group" aria-label="รายชื่อครู"></div></div>');
      var search = body.querySelector('input'), results = body.querySelector('.teacher-results');
      var modal = U.openModal({title: fieldLabel + ' · ' + subject.name, content: body, buttons: [{label:'ยกเลิก'}]});
      function paint() {
        var term = search.value.trim().toLowerCase(), load = M.teacherAssignedLoad(state);
        var teachers = U.sortThai(state.teachers, function (t) { return t.name; }).filter(function (t) {
          return (t.name + ' ' + ((U.byId(state.subjectGroups, t.subjectGroupId) || {}).name || '')).toLowerCase().indexOf(term) !== -1;
        }).sort(function (a,b) { return Number(b.subjectGroupId === subject.subjectGroupId) - Number(a.subjectGroupId === subject.subjectGroupId); });
        results.innerHTML = '<button type="button" class="teacher-option" data-value="">เว้นว่าง / ยกเลิกการเลือกครู</button>' + teachers.map(function (t) {
          var group = U.byId(state.subjectGroups, t.subjectGroupId), other = select.dataset.f === 'coTeacherId' ? assignment.teacherId : '';
          return '<button type="button" class="teacher-option" data-value="' + U.esc(t.id) + '"' + (t.id === other ? ' disabled' : '') + '><span><b>' + U.esc(t.name) + '</b><span class="teacher-picker__meta">' + U.esc(group ? group.name : '') + (t.id === other ? ' · เป็นครูหลักแล้ว' : '') + '</span></span><span class="badge ' + ((load[t.id] || 0) > t.maxPeriodsPerWeek ? 'badge--danger' : 'badge--muted') + '">' + (load[t.id] || 0) + '/' + t.maxPeriodsPerWeek + ' คาบ</span></button>';
        }).join('') + (!teachers.length ? '<p class="muted">ไม่พบครูที่ตรงกับคำค้น</p>' : '');
      }
      U.on(results, 'click', 'button[data-value]', function (ev, btn) {
        select.value = btn.dataset.value;
        modal.close();
        select.dispatchEvent(new Event('change', {bubbles:true}));
        refresh();
        trigger.focus();
      });
      search.addEventListener('input', paint); paint(); search.focus();
    });
    select._refreshPicker = refresh;
    refresh();
  }
  function publishTimetable(st, tt) {
    var app = global.ST.app;
    if (!tt || tt.status !== 'DRAFT') return;
    var current = st.timetables.filter(function (t) { return t.status === 'PUBLISHED' && t.academicYear === tt.academicYear && t.semester === tt.semester; })[0];
    var detail = 'ตารางนี้จะเป็นฉบับใช้งาน หากต้องการแก้ไขภายหลัง ให้สร้างร่างใหม่';
    if (current) detail += '<br>ฉบับเดิม ' + U.esc(current.name) + ' จะถูกเก็บในประวัติ';
    if (tt.stats.unplaced) detail += '<br><strong class="text-danger">ยังมีคาบค้าง ' + U.fmtNum(tt.stats.unplaced) + ' คาบ</strong>';
    U.confirmDialog({title:'ประกาศใช้ตาราง', message:'ประกาศใช้ “' + tt.name + '” ภาคเรียนที่ ' + tt.semester + '/' + tt.academicYear + ' ใช่หรือไม่', detail:detail, confirmText:'ประกาศใช้', danger:tt.stats.unplaced > 0}).then(function (ok) {
      if (!ok) return;
      if (current) current.status = 'ARCHIVED';
      tt.status = 'PUBLISHED'; tt.publishedAt = new Date().toISOString(); st.activeTimetableId = tt.id;
      app.saveAndRefresh('ประกาศใช้ตารางแล้ว สามารถพิมพ์ฉบับใช้งานได้');
    });
  }
  global.ST.ux = { icon: icon, decorate: decorate, teacherPicker: teacherPicker, publishTimetable: publishTimetable };
})(window);
