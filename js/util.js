/* ============================================================
   SchoolTable — util.js
   เครื่องมือพื้นฐานที่ทุกส่วนของระบบเรียกใช้ร่วมกัน
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- ค่าคงที่เกี่ยวกับวัน ---------- */
  var DAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  var DAY_NAMES = {
    MON: 'จันทร์', TUE: 'อังคาร', WED: 'พุธ', THU: 'พฤหัสบดี',
    FRI: 'ศุกร์', SAT: 'เสาร์', SUN: 'อาทิตย์'
  };
  var DAY_SHORT = { MON: 'จ', TUE: 'อ', WED: 'พ', THU: 'พฤ', FRI: 'ศ', SAT: 'ส', SUN: 'อา' };

  /* ---------- รหัสอ้างอิงภายใน ---------- */
  var seq = 0;
  function uid(prefix) {
    seq += 1;
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + seq.toString(36);
  }

  /* ---------- ข้อความ ---------- */
  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function num(value) {
    var n = Number(value);
    return isFinite(n) ? n : 0;
  }

  function fmtNum(value) {
    return num(value).toLocaleString('th-TH');
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function minutesToTime(mins) {
    var m = ((mins % 1440) + 1440) % 1440;
    return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
  }

  function timeToMinutes(text) {
    var parts = String(text || '').split(':');
    return num(parts[0]) * 60 + num(parts[1]);
  }

  function thaiDate(d) {
    var date = d ? new Date(d) : new Date();
    var months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    return date.getDate() + ' ' + months[date.getMonth()] + ' ' + (date.getFullYear() + 543);
  }

  function thaiDateTime(d) {
    var date = d ? new Date(d) : new Date();
    return thaiDate(date) + ' เวลา ' + pad2(date.getHours()) + '.' + pad2(date.getMinutes()) + ' น.';
  }

  /* ย่อชื่อให้สั้นลงสำหรับช่องตารางที่แคบ */
  function abbreviate(name, maxLen) {
    var text = String(name || '').trim();
    var limit = maxLen || 10;
    if (text.length <= limit) return text;
    return text.slice(0, limit - 1) + '…';
  }

  function teacherShort(fullName) {
    var text = String(fullName || '').trim();
    var parts = text.split(/\s+/);
    if (parts.length >= 2) return parts[0] + ' ' + parts[1].charAt(0) + '.';
    return abbreviate(text, 12);
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function byId(list, id) {
    if (!list) return null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function indexById(list) {
    var map = {};
    (list || []).forEach(function (item) { map[item.id] = item; });
    return map;
  }

  function groupBy(list, keyFn) {
    var map = {};
    (list || []).forEach(function (item) {
      var k = keyFn(item);
      if (!map[k]) map[k] = [];
      map[k].push(item);
    });
    return map;
  }

  function sortThai(list, keyFn) {
    return list.slice().sort(function (a, b) {
      return String(keyFn(a)).localeCompare(String(keyFn(b)), 'th', { numeric: true });
    });
  }

  /* ---------- ตัวสุ่มแบบกำหนดเมล็ดได้ (ให้ผลซ้ำเดิมได้) ---------- */
  function makeRandom(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  function shuffle(list, rnd) {
    var arr = list.slice();
    var random = rnd || Math.random;
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  /* ---------- DOM ---------- */
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function elFromHTML(html) {
    var wrap = document.createElement('div');
    wrap.innerHTML = String(html).trim();
    return wrap.firstElementChild;
  }

  function on(root, eventName, selector, handler) {
    root.addEventListener(eventName, function (ev) {
      var target = ev.target.closest(selector);
      if (target && root.contains(target)) handler(ev, target);
    });
  }

  /* ---------- ข้อความแจ้งผลชั่วคราว ---------- */
  function toast(message, kind, timeout) {
    var host = qs('#toastHost');
    if (!host) return;
    var icons = { success: '✓', warning: '!', danger: '✕', info: 'i' };
    var type = kind || 'info';
    var node = elFromHTML(
      '<div class="toast toast--' + type + '" role="status">' +
      '<span class="toast__icon" aria-hidden="true">' + icons[type] + '</span>' +
      '<span class="toast__text">' + esc(message) + '</span>' +
      '<button type="button" class="toast__close" aria-label="ปิดข้อความ">✕</button>' +
      '</div>'
    );
    node.querySelector('.toast__close').addEventListener('click', function () { node.remove(); });
    host.appendChild(node);
    setTimeout(function () {
      node.classList.add('toast--out');
      setTimeout(function () { node.remove(); }, 300);
    }, timeout || 5200);
  }

  /* ---------- หน้าต่างซ้อน ---------- */
  var modalStack = [];

  function closeTopModal() {
    var top = modalStack.pop();
    if (top) {
      top.overlay.remove();
      if (top.onClose) top.onClose();
    }
    if (!modalStack.length) document.body.classList.remove('has-modal');
  }

  function openModal(options) {
    var opts = options || {};
    var overlay = elFromHTML(
      '<div class="modal-overlay" role="dialog" aria-modal="true">' +
      '<div class="modal modal--' + (opts.size || 'md') + '">' +
      '<div class="modal__head">' +
      '<h2 class="modal__title">' + esc(opts.title || '') + '</h2>' +
      '<button type="button" class="modal__close" aria-label="ปิดหน้าต่าง">✕</button>' +
      '</div>' +
      '<div class="modal__body"></div>' +
      '<div class="modal__foot"></div>' +
      '</div></div>'
    );
    var body = overlay.querySelector('.modal__body');
    if (typeof opts.content === 'string') body.innerHTML = opts.content;
    else if (opts.content) body.appendChild(opts.content);

    var foot = overlay.querySelector('.modal__foot');
    (opts.buttons || []).forEach(function (btn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + (btn.className || 'btn--ghost');
      b.textContent = btn.label;
      b.addEventListener('click', function () {
        if (btn.onClick) {
          var keepOpen = btn.onClick(body, overlay);
          if (keepOpen === true) return;
        }
        closeTopModal();
      });
      foot.appendChild(b);
    });
    if (!foot.children.length) foot.remove();

    overlay.querySelector('.modal__close').addEventListener('click', closeTopModal);
    overlay.addEventListener('mousedown', function (ev) {
      if (ev.target === overlay && opts.dismissible !== false) closeTopModal();
    });

    document.body.appendChild(overlay);
    document.body.classList.add('has-modal');
    modalStack.push({ overlay: overlay, onClose: opts.onClose });

    /* โฟกัสช่องแรกให้พิมพ์ได้ทันที แต่ห้ามแย่งโฟกัสถ้าผู้ใช้เริ่มพิมพ์ในช่องอื่นไปก่อนแล้ว
       มิฉะนั้นตัวอักษรที่กำลังพิมพ์จะเด้งไปลงช่องแรกแทน */
    var focusTarget = overlay.querySelector('input, select, textarea, button.btn');
    if (focusTarget && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () {
        var active = document.activeElement;
        if (active && active !== document.body && overlay.contains(active)) return;
        focusTarget.focus();
      });
    } else if (focusTarget) {
      focusTarget.focus();
    }
    return { overlay: overlay, body: body, close: closeTopModal };
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && modalStack.length) closeTopModal();
    });
  }

  /* หน้าต่างยืนยันก่อนทำสิ่งที่ย้อนกลับไม่ได้ */
  function confirmDialog(options) {
    var opts = options || {};
    return new Promise(function (resolve) {
      var settled = false;
      function finish(value) { if (!settled) { settled = true; resolve(value); } }
      openModal({
        title: opts.title || 'ยืนยันการทำรายการ',
        size: opts.size || 'sm',
        content: '<div class="dialog-body">' +
          '<p class="dialog-lead">' + esc(opts.message || '') + '</p>' +
          (opts.detail ? '<div class="dialog-detail">' + opts.detail + '</div>' : '') +
          (opts.hint ? '<p class="dialog-hint">' + esc(opts.hint) + '</p>' : '') +
          '</div>',
        buttons: [
          { label: opts.cancelText || 'ยกเลิก', className: 'btn--ghost', onClick: function () { finish(false); } },
          {
            label: opts.confirmText || 'ยืนยัน',
            className: opts.danger ? 'btn--danger' : 'btn--primary',
            onClick: function () { finish(true); }
          }
        ],
        onClose: function () { finish(false); }
      });
    });
  }

  /* หน้าต่างแจ้งปัญหา พร้อมสาเหตุและวิธีแก้ */
  function explainDialog(options) {
    var opts = options || {};
    var buttons = [];
    if (opts.actionLabel) {
      buttons.push({
        label: opts.actionLabel, className: 'btn--primary',
        onClick: function () { if (opts.onAction) opts.onAction(); }
      });
    }
    buttons.push({ label: opts.closeText || 'รับทราบ', className: buttons.length ? 'btn--ghost' : 'btn--primary' });
    openModal({
      title: opts.title || 'ทำรายการนี้ไม่ได้',
      size: opts.size || 'sm',
      content: '<div class="dialog-body">' +
        '<div class="dialog-block"><div class="dialog-block__label">สาเหตุ</div>' +
        '<p class="dialog-block__text">' + esc(opts.cause || '') + '</p></div>' +
        (opts.fix ? '<div class="dialog-block dialog-block--fix"><div class="dialog-block__label">วิธีแก้</div>' +
          '<p class="dialog-block__text">' + esc(opts.fix) + '</p></div>' : '') +
        (opts.extra || '') +
        '</div>',
      buttons: buttons
    });
  }

  /* ---------- ไฟล์ ---------- */
  function downloadBlob(filename, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 400);
  }

  function downloadText(filename, text, mime) {
    /* ใส่ BOM เพื่อให้ Excel อ่านภาษาไทยได้ถูกต้อง */
    var blob = new Blob(['﻿' + text], { type: (mime || 'text/csv') + ';charset=utf-8' });
    downloadBlob(filename, blob);
  }

  function readFileText(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(new Error('อ่านไฟล์ไม่สำเร็จ')); };
      reader.readAsText(file, 'utf-8');
    });
  }

  function readFileBuffer(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error('อ่านไฟล์ไม่สำเร็จ')); };
      reader.readAsArrayBuffer(file);
    });
  }

  function nextFrame() {
    return new Promise(function (resolve) {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { resolve(); });
      else setTimeout(resolve, 0);
    });
  }

  /* ---------- ตัวบ่งชี้สถานะการบันทึก ---------- */
  function createSaveIndicator(container) {
    var statusEl = null;
    var hideTimer = null;

    function createStatusEl(state, message) {
      if (statusEl) statusEl.remove();
      var icons = { saving: '💾', success: '✔', error: '⚠' };
      statusEl = elFromHTML(
        '<div class="save-status save-status--' + state + '" role="status" aria-live="polite">' +
        '<span aria-hidden="true">' + icons[state] + '</span>' +
        '<span class="save-status__text">' + esc(message || '') + '</span>' +
        '</div>'
      );
      if (container && container.firstChild) {
        container.insertBefore(statusEl, container.firstChild);
      } else if (container) {
        container.appendChild(statusEl);
      }
      return statusEl;
    }

    return {
      show: function (state, message) {
        if (hideTimer) clearTimeout(hideTimer);
        createStatusEl(state, message || '');
      },
      success: function (message) {
        var el = createStatusEl('success', message || 'บันทึกแล้ว');
        hideTimer = setTimeout(function () {
          if (el && el.parentNode) {
            el.classList.add('save-status--fade-out');
            setTimeout(function () { el.remove(); }, 300);
          }
        }, 3000);
      },
      error: function (message) {
        createStatusEl('error', message || 'บันทึกไม่สำเร็จ');
      },
      clear: function () {
        if (statusEl) statusEl.remove();
        if (hideTimer) clearTimeout(hideTimer);
      }
    };
  }

  global.ST = global.ST || {};
  global.ST.util = {
    DAY_KEYS: DAY_KEYS, DAY_NAMES: DAY_NAMES, DAY_SHORT: DAY_SHORT,
    uid: uid, esc: esc, num: num, fmtNum: fmtNum, pad2: pad2,
    minutesToTime: minutesToTime, timeToMinutes: timeToMinutes,
    thaiDate: thaiDate, thaiDateTime: thaiDateTime,
    abbreviate: abbreviate, teacherShort: teacherShort,
    deepClone: deepClone, byId: byId, indexById: indexById, groupBy: groupBy, sortThai: sortThai,
    makeRandom: makeRandom, shuffle: shuffle,
    qs: qs, qsa: qsa, elFromHTML: elFromHTML, on: on,
    toast: toast, openModal: openModal, closeModal: closeTopModal,
    confirmDialog: confirmDialog, explainDialog: explainDialog,
    downloadBlob: downloadBlob, downloadText: downloadText,
    readFileText: readFileText, readFileBuffer: readFileBuffer,
    nextFrame: nextFrame, createSaveIndicator: createSaveIndicator
  };
})(typeof window !== 'undefined' ? window : globalThis);
