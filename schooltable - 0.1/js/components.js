/* ============================================================
   SchoolTable — components.js   ส่วนประกอบหน้าจอที่ใช้ซ้ำ
   ============================================================ */
(function (global) {
  'use strict';

  var U = global.ST.util;
  var M = global.ST.model;

  /* ---------- หัวข้อหน้า ---------- */
  function pageHeader(container, opts) {
    var node = U.elFromHTML(
      '<div class="page-header">' +
      '<div class="page-header__text">' +
      '<h1>' + U.esc(opts.title) + '</h1>' +
      (opts.desc ? '<div class="page-header__desc">' + U.esc(opts.desc) + '</div>' : '') +
      '</div>' +
      '<div class="page-header__actions no-print"></div>' +
      '</div>'
    );
    var actionHost = node.querySelector('.page-header__actions');
    (opts.actions || []).forEach(function (a) {
      if (!a) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn ' + (a.className || '');
      btn.textContent = a.label;
      if (a.disabled) { btn.disabled = true; btn.title = a.disabledReason || ''; }
      btn.addEventListener('click', a.onClick);
      actionHost.appendChild(btn);
    });
    container.appendChild(node);
    return node;
  }

  /* ---------- สถานะยังไม่มีข้อมูล ---------- */
  function emptyState(opts) {
    var node = U.elFromHTML(
      '<div class="empty">' +
      '<div class="empty__icon">' + (opts.icon || '📋') + '</div>' +
      '<div class="empty__title">' + U.esc(opts.title) + '</div>' +
      '<div class="empty__desc">' + U.esc(opts.desc || '') + '</div>' +
      '<div class="empty__actions"></div>' +
      '</div>'
    );
    var host = node.querySelector('.empty__actions');
    (opts.actions || []).forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + (a.className || 'btn--primary');
      b.textContent = a.label;
      b.addEventListener('click', a.onClick);
      host.appendChild(b);
    });
    return node;
  }

  /* ---------- ป้ายสถานะตาราง ---------- */
  function statusBadge(status) {
    if (status === 'PUBLISHED') return '<span class="badge badge--success">✔ ประกาศใช้แล้ว</span>';
    if (status === 'ARCHIVED') return '<span class="badge badge--muted">🗄 ประวัติ</span>';
    return '<span class="badge badge--warning">✎ ฉบับร่าง</span>';
  }

  /* ---------- ฟอร์มในหน้าต่างซ้อน ---------- */
  /* fields: [{name,label,type,options,hint,required,min,max,rows,width}]
     type "checks" ใช้เมื่อต้องเลือกได้หลายค่า เช่น ระดับชั้นของรายวิชา */
  function formModal(opts) {
    var values = U.deepClone(opts.values || {});
    var form = document.createElement('div');
    form.className = 'form-grid' + (opts.formClass ? ' ' + opts.formClass : '');

    opts.fields.forEach(function (f) {
      if (f.type === 'section') {
        form.appendChild(U.elFromHTML('<div class="form-section-title' + (f.className ? ' ' + f.className : '') + '">' +
          (f.icon ? '<span class="form-section-title__icon" aria-hidden="true">' + U.esc(f.icon) + '</span>' : '') +
          '<div><b>' + U.esc(f.label) + '</b>' + (f.hint ? '<span>' + U.esc(f.hint) + '</span>' : '') + '</div></div>'));
        return;
      }
      if (f.type === 'note') {
        form.appendChild(U.elFromHTML('<div class="field small muted">' + f.label + '</div>'));
        return;
      }
      var wrap = document.createElement('div');
      wrap.className = 'field' + (f.required ? ' field--required' : '') + (f.className ? ' ' + f.className : '');
      wrap.dataset.name = f.name;
      var id = 'f_' + f.name;
      var labelHtml = '<label class="field__label' + (f.required ? ' field__label--required' : '') + '" for="' + id + '">' + U.esc(f.label) +
        (f.required ? ' <span class="required-mark">*</span>' : '') + '</label>';
      var control = '';
      var val = values[f.name];

      if (f.type === 'select') {
        control = '<select class="select" id="' + id + '">' +
          (f.options || []).map(function (o) {
            return '<option value="' + U.esc(o.value) + '"' +
              (String(o.value) === String(val === undefined ? '' : val) ? ' selected' : '') + '>' +
              U.esc(o.label) + '</option>';
          }).join('') + '</select>';
      } else if (f.type === 'checks') {
        var checked = Array.isArray(val) ? val.map(String) : [];
        control = '<div class="checkset" id="' + id + '">' +
          (f.options || []).map(function (o) {
            var value = String(o.value);
            return '<label class="checkset__item"><input type="checkbox" value="' + U.esc(value) + '"' +
              (checked.indexOf(value) !== -1 ? ' checked' : '') + '><span>' + U.esc(o.label) + '</span></label>';
          }).join('') + '</div>';
      } else if (f.type === 'checkbox') {
        control = '<div class="checkline"><input type="checkbox" id="' + id + '"' + (val ? ' checked' : '') +
          '><label for="' + id + '">' + U.esc(f.checkLabel || f.label) + '</label></div>';
        labelHtml = '';
      } else if (f.type === 'textarea') {
        control = '<textarea class="textarea" id="' + id + '" rows="' + (f.rows || 3) + '">' + U.esc(val || '') + '</textarea>';
      } else if (f.type === 'days') {
        var selected = Array.isArray(val) ? val : [];
        control = '<div class="chipset" id="' + id + '">' +
          (f.dayOptions || U.DAY_KEYS.slice(0, 5)).map(function (d) {
            return '<label class="chip' + (selected.indexOf(d) !== -1 ? ' is-on' : '') + '" data-day="' + d + '">' +
              '<input type="checkbox"' + (selected.indexOf(d) !== -1 ? ' checked' : '') + '>' + U.DAY_NAMES[d] + '</label>';
          }).join('') + '</div>';
      } else if (f.type === 'color') {
        control = '<input type="color" class="input" id="' + id + '" value="' + U.esc(val || '#5b50ef') + '" style="height:38px">';
      } else if (f.type === 'number') {
        control = '<input type="number" class="input" id="' + id + '" value="' + U.esc(val === undefined ? '' : val) + '"' +
          (f.min !== undefined ? ' min="' + f.min + '"' : '') + (f.max !== undefined ? ' max="' + f.max + '"' : '') + '>';
      } else if (f.type === 'time') {
        control = '<input type="time" class="input" id="' + id + '" value="' + U.esc(val || '') + '">';
      } else {
        control = '<input type="text" class="input" id="' + id + '" value="' + U.esc(val === undefined ? '' : val) + '">';
      }
      if (f.suffix) control = '<div class="input-affix">' + control + '<span>' + U.esc(f.suffix) + '</span></div>';
      wrap.innerHTML = labelHtml + control + (f.hint ? '<div class="field__hint">' + U.esc(f.hint) + '</div>' : '');
      form.appendChild(wrap);
    });

    U.on(form, 'change', '.chip', function (ev, chip) {
      chip.classList.toggle('is-on', chip.querySelector('input').checked);
    });

    function clearFieldError(target) {
      var wrap = target.closest && target.closest('.field');
      if (!wrap) return;
      var invalid = wrap.querySelector('.input--invalid');
      if (invalid) invalid.classList.remove('input--invalid');
      var error = wrap.querySelector('.field__error');
      if (error) error.remove();
    }
    form.addEventListener('input', function (ev) { clearFieldError(ev.target); });
    form.addEventListener('change', function (ev) { clearFieldError(ev.target); });

    function readValues() {
      var out = U.deepClone(values);
      opts.fields.forEach(function (f) {
        if (f.type === 'note' || f.type === 'section') return;
        var el = form.querySelector('#f_' + f.name);
        if (!el) return;
        if (f.type === 'checkbox') out[f.name] = el.checked;
        else if (f.type === 'checks') {
          out[f.name] = U.qsa('input[type="checkbox"]', el).filter(function (input) {
            return input.checked;
          }).map(function (input) { return input.value; });
        }
        else if (f.type === 'days') {
          out[f.name] = U.qsa('.chip', el).filter(function (c) {
            return c.querySelector('input').checked;
          }).map(function (c) { return c.dataset.day; });
        } else if (f.type === 'number') out[f.name] = el.value === '' ? '' : Number(el.value);
        else out[f.name] = el.value;
      });
      return out;
    }

    function showErrors(errors) {
      U.qsa('.field__error', form).forEach(function (e) { e.remove(); });
      U.qsa('.input--invalid', form).forEach(function (e) { e.classList.remove('input--invalid'); });
      Object.keys(errors || {}).forEach(function (name) {
        var wrap = form.querySelector('.field[data-name="' + name + '"]');
        if (!wrap) return;
        var input = wrap.querySelector('.input, .select, .textarea, .checkset');
        if (input) input.classList.add('input--invalid');
        wrap.appendChild(U.elFromHTML('<div class="field__error">' + U.esc(errors[name]) + '</div>'));
      });
    }

    U.openModal({
      title: opts.title,
      size: opts.size || 'md',
      content: form,
      buttons: [
        { label: 'ยกเลิก', className: 'btn--ghost' },
        {
          label: opts.submitLabel || 'บันทึก',
          className: 'btn--primary',
          onClick: function () {
            var result = opts.onSubmit(readValues());
            if (result && result.ok === false) {
              showErrors(result.errors);
              if (result.message) U.toast(result.message, 'danger');
              return true; /* คงหน้าต่างไว้ให้แก้ */
            }
            return false;
          }
        }
      ]
    });
  }

  /* ---------- ยืนยันการลบพร้อมตรวจการอ้างอิง (กฎ D5) ---------- */
  function deleteWithGuard(opts) {
    var refs = opts.references || [];
    if (refs.length) {
      U.explainDialog({
        title: 'ลบ' + opts.what + 'นี้ไม่ได้',
        cause: opts.what + ' "' + opts.name + '" ถูกใช้อยู่ในระบบ ' + refs.length + ' แห่ง จึงลบไม่ได้ เพราะจะทำให้ข้อมูลส่วนอื่นเสียหาย',
        fix: opts.fix || 'ให้ไปแก้หรือลบรายการที่อ้างถึงก่อน แล้วจึงกลับมาลบอีกครั้ง',
        extra: '<div class="dialog-detail"><b>ถูกใช้อยู่ที่</b><ul class="list-plain">' +
          refs.slice(0, 12).map(function (r) { return '<li>' + U.esc(r) + '</li>'; }).join('') +
          (refs.length > 12 ? '<li>และอีก ' + (refs.length - 12) + ' รายการ</li>' : '') +
          '</ul></div>'
      });
      return Promise.resolve(false);
    }
    return U.confirmDialog({
      title: 'ยืนยันการลบ',
      message: 'ต้องการลบ' + opts.what + ' "' + opts.name + '" ใช่หรือไม่',
      hint: 'เมื่อลบแล้วจะกู้คืนไม่ได้ หากยังไม่แน่ใจให้กดส่งออกไฟล์สำรองข้อมูลก่อน',
      confirmText: 'ลบ', danger: true
    });
  }

  /* ---------- ผังสัปดาห์สำหรับเลือกช่อง ---------- */
  /* onToggle(day, periodNo, isOn) ; selected = {'MON#3': true} */
  function weekPicker(state, options) {
    var opts = options || {};
    var days = state.periodConfig.days;
    var nos = M.allPeriodNos(state);   /* แต่ละวันมีจำนวนคาบไม่เท่ากันได้ จึงกางคอลัมน์ตามวันที่ยาวที่สุด */
    var html = '<div class="table-wrap"><table class="weekpicker"><thead><tr><th>วัน</th>';
    nos.forEach(function (no) {
      html += '<th>คาบ ' + no + '</th>';
    });
    html += '</tr></thead><tbody>';
    days.forEach(function (d) {
      html += '<tr><th>' + U.DAY_NAMES[d] + '</th>';
      nos.forEach(function (no) {
        var p = M.periodByNo(state, d, no);
        if (!p) {
          html += '<td><div class="wp-cell is-break" title="วัน' + U.DAY_NAMES[d] +
            'ไม่มีคาบ ' + no + '">—</div></td>';
          return;
        }
        if (p.isBreak) {
          html += '<td><div class="wp-cell is-break">' + U.esc(p.label || 'พัก') + '</div></td>';
          return;
        }
        var k = d + '#' + no;
        var on = opts.selected && opts.selected[k];
        var label = on ? (opts.labelFor ? opts.labelFor(d, no) : '●') : '';
        html += '<td><button type="button" class="wp-cell' + (on ? ' is-on' : '') +
          '" data-day="' + d + '" data-period="' + no + '" title="' + U.esc(p.startTime + '–' + p.endTime) +
          '">' + U.esc(label) + '</button></td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    var node = U.elFromHTML(html);
    if (opts.onToggle) {
      U.on(node, 'click', '.wp-cell:not(.is-break)', function (ev, btn) {
        opts.onToggle(btn.dataset.day, Number(btn.dataset.period), !btn.classList.contains('is-on'));
      });
    }
    return node;
  }

  /* ---------- แถบภาระงานครู ---------- */
  function workloadBar(current, quota) {
    var pct = quota > 0 ? Math.min(100, Math.round((current / quota) * 100)) : 0;
    var cls = current > quota ? 'bar__fill--over' : (pct >= 90 ? 'bar__fill--warn' : '');
    return '<div class="workload">' +
      '<div class="bar"><div class="bar__fill ' + cls + '" style="width:' + pct + '%"></div></div>' +
      '<span class="workload__text' + (current > quota ? ' text-danger' : '') + '">' +
      current + '/' + quota + ' คาบ' + (current > quota ? ' ⚠ เกินโควตา' : '') + '</span></div>';
  }

  function dayChips(availableDays, allDays) {
    return '<span class="daychips">' + allDays.map(function (d) {
      var on = (availableDays || []).indexOf(d) !== -1;
      return '<span class="daychip' + (on ? '' : ' daychip--off') + '" title="' + U.DAY_NAMES[d] +
        (on ? ' (มาสอน)' : ' (ไม่มาสอน)') + '">' + U.DAY_SHORT[d] + '</span>';
    }).join('') + '</span>';
  }

  /* ---------- ตารางรายการพร้อมค้นหา ---------- */
  /* opts: {columns:[{key,label,className,render(row)}], rows, search(row, term), emptyNode, tools} */
  function dataTable(opts) {
    var wrap = document.createElement('div');
    var toolbar = document.createElement('div');
    toolbar.className = 'table-tools no-print';
    var searchInput = U.elFromHTML('<input type="search" class="input" placeholder="' +
      U.esc(opts.searchPlaceholder || 'ค้นหา…') + '" aria-label="ค้นหา">');
    if (opts.search !== false) toolbar.appendChild(searchInput);
    (opts.tools || []).forEach(function (t) { toolbar.appendChild(t); });
    wrap.appendChild(toolbar);

    var body = document.createElement('div');
    wrap.appendChild(body);

    function render() {
      var term = searchInput.value.trim().toLowerCase();
      var rows = opts.rows;
      if (term && opts.filter) rows = rows.filter(function (r) { return opts.filter(r, term); });
      if (opts.extraFilter) rows = rows.filter(opts.extraFilter);
      body.innerHTML = '';
      if (!rows.length) {
        body.appendChild(emptyState(term ? {
          icon: '🔍', title: 'ไม่พบรายการที่ตรงกับคำค้น',
          desc: 'ลองใช้คำค้นอื่น หรือกดล้างตัวกรองเพื่อดูรายการทั้งหมด',
          actions: [{ label: 'ล้างตัวกรอง', onClick: function () { searchInput.value = ''; render(); } }]
        } : (opts.empty || { icon: '📋', title: 'ยังไม่มีข้อมูล', desc: '' })));
        return;
      }
      var html = '<div class="table-wrap"><table class="data"><thead><tr>' +
        opts.columns.map(function (c) {
          return '<th class="' + (c.className || '') + '">' + U.esc(c.label) + '</th>';
        }).join('') + '</tr></thead><tbody>';
      rows.forEach(function (row, i) {
        html += '<tr data-index="' + i + '">' + opts.columns.map(function (c) {
          return '<td class="' + (c.className || '') + '">' + c.render(row, i) + '</td>';
        }).join('') + '</tr>';
      });
      html += '</tbody></table></div>';
      body.innerHTML = html;
      /* ผูกตัวจัดการเหตุการณ์แบบมอบหมายเพียงครั้งเดียว ป้องกันการทำงานซ้ำเมื่อวาดใหม่ */
      if (opts.onRendered && !body.dataset.bound) {
        body.dataset.bound = '1';
        opts.onRendered(body, rows);
      }
    }

    searchInput.addEventListener('input', render);
    render();
    wrap.refresh = render;
    return wrap;
  }

  global.ST.ui = {
    pageHeader: pageHeader,
    emptyState: emptyState,
    statusBadge: statusBadge,
    formModal: formModal,
    deleteWithGuard: deleteWithGuard,
    weekPicker: weekPicker,
    workloadBar: workloadBar,
    dayChips: dayChips,
    dataTable: dataTable
  };
})(typeof window !== 'undefined' ? window : globalThis);
