/* หน้า P15 — นำเข้าข้อมูลจากไฟล์ Excel หรือ CSV */
(function (global) {
  'use strict';
  var U = global.ST.util, M = global.ST.model, UI = global.ST.ui, X = global.ST.xlsx;
  global.ST.pages = global.ST.pages || {};

  var state = { kind: 'teachers', rows: null, parsed: null, autoCreate: true, onDuplicate: 'update' };

  var DAY_FROM_THAI = {
    'จ': 'MON', 'อ': 'TUE', 'พ': 'WED', 'พฤ': 'THU', 'ศ': 'FRI', 'ส': 'SAT', 'อา': 'SUN',
    'จันทร์': 'MON', 'อังคาร': 'TUE', 'พุธ': 'WED', 'พฤหัสบดี': 'THU', 'ศุกร์': 'FRI',
    'เสาร์': 'SAT', 'อาทิตย์': 'SUN'
  };

  var KINDS = {
    teachers: {
      label: 'ครู',
      headers: ['ชื่อ-นามสกุล', 'ชื่อย่อ', 'กลุ่มสาระ', 'วันที่มาสอน', 'คาบสูงสุดต่อวัน', 'คาบสูงสุดต่อสัปดาห์'],
      sample: [
        ['สมชาย ใจดี', 'สมชาย ใ.', 'คณิตศาสตร์', 'จ,อ,พ,พฤ,ศ', '6', '25'],
        ['มาลี ศรีสุข', 'มาลี ศ.', 'ภาษาไทย', 'จ,พ,ศ', '5', '16']
      ],
      hint: 'ช่องวันที่มาสอนให้ใส่ตัวย่อคั่นด้วยจุลภาค เช่น จ,อ,พ,พฤ,ศ'
    },
    subjects: {
      label: 'รายวิชา',
      headers: ['รหัสวิชา', 'ชื่อวิชา', 'ชื่อย่อ', 'กลุ่มสาระ', 'วิชาหลัก', 'คาบคู่', 'วิชาเลือกเสรี', 'คาบพิเศษ'],
      sample: [
        ['ค21101', 'คณิตศาสตร์พื้นฐาน 1', 'คณิต 1', 'คณิตศาสตร์', 'ใช่', 'ไม่ใช่', 'ไม่ใช่', 'ไม่ใช่'],
        ['ว21281', 'ปฏิบัติการวิทยาศาสตร์ 1', 'ปฏิบัติวิทย์', 'วิทยาศาสตร์และเทคโนโลยี', 'ไม่ใช่', 'ห้ามแยก', 'ไม่ใช่', 'ไม่ใช่']
      ],
      hint: 'ช่องคาบคู่ให้ใส่ ไม่ใช่ / ห้ามแยก / แยกได้ · ช่องใช่-ไม่ใช่ ให้ใส่คำว่า ใช่ หรือ ไม่ใช่'
    },
    rooms: {
      label: 'ห้องสถานที่',
      headers: ['ชื่อห้อง', 'อาคาร', 'ชั้น', 'ความจุ'],
      sample: [
        ['141', 'อาคาร 1', '4', '45'],
        ['ปฏิบัติการวิทย์ 1', 'อาคารวิทยาศาสตร์', '1', '40']
      ],
      hint: 'ชื่อห้องต้องไม่ซ้ำกันภายในอาคารเดียวกัน · ช่องชั้นใส่เป็นตัวเลข ใช้คำนวณระยะเดินระหว่างคาบ'
    },
    sections: {
      label: 'ชั้นเรียน',
      headers: ['ชื่อชั้นเรียน', 'ระดับชั้น', 'จำนวนนักเรียน', 'ห้องประจำ', 'หลักสูตรที่ใช้', 'หมายเหตุ'],
      sample: [
        ['ม.1/1', 'ม.1', '38', '141', 'หลักสูตร ม.1 ห้องเรียนพิเศษ EP', 'ห้องเรียนพิเศษ'],
        ['ม.1/2', 'ม.1', '36', '142', 'หลักสูตร ม.1 ทั่วไป', '']
      ],
      hint: 'ชื่อชั้นเรียนต้องไม่ซ้ำ · ห้องประจำให้ใส่ชื่อห้องที่มีอยู่แล้ว · ' +
        'ช่องหลักสูตรใส่ชื่อชุดหลักสูตร ถ้าเว้นว่างไว้ต้องไปเลือกให้ทีหลังที่หน้าชั้นเรียน'
    },
    curriculum: {
      label: 'หลักสูตร',
      headers: ['ชื่อหลักสูตร', 'ระดับชั้น', 'รหัสวิชา', 'คาบต่อสัปดาห์'],
      sample: [
        ['หลักสูตร ม.1 ทั่วไป', 'ม.1', 'ค21101', '4'],
        ['หลักสูตร ม.1 ทั่วไป', 'ม.1', 'ท21101', '3']
      ],
      hint: 'หนึ่งแถวคือหนึ่งวิชาในหนึ่งชุดหลักสูตร · ถ้ายังไม่มีชุดหลักสูตรชื่อนี้ ระบบจะสร้างให้ใหม่'
    },
    assignments: {
      label: 'การจัดครูผู้สอน',
      headers: ['ชั้นเรียน', 'รหัสวิชา', 'ครูผู้สอน', 'ครูผู้สอนร่วม', 'ห้องที่ใช้'],
      sample: [
        ['ม.1/1', 'ค21101', 'สมชาย ใจดี', '', ''],
        ['ม.1/1', 'ว21281', 'มาลี ศรีสุข', 'สมชาย ใจดี', 'ปฏิบัติการวิทย์ 1']
      ],
      hint: 'ต้องมีชั้นเรียน วิชา และครูอยู่ในระบบก่อน · เว้นช่องห้องไว้เพื่อให้ระบบเลือกห้องให้เอง'
    }
  };

  global.ST.pages['import'] = {
    render: function (root, params) {
      var app = global.ST.app;
      var st = app.state();
      if (params && params.kind && KINDS[params.kind]) {
        state.kind = params.kind;
        state.rows = null;
        state.parsed = null;
      }
      var kind = KINDS[state.kind];

      UI.pageHeader(root, {
        title: 'นำเข้าข้อมูล',
        desc: 'นำเข้าข้อมูลตั้งต้นจากไฟล์ Excel (.xlsx) หรือ CSV ที่โรงเรียนมีอยู่แล้ว'
      });

      /* ขั้นที่ 1 */
      var step1 = U.elFromHTML('<div class="card"><div class="card__title">ขั้นที่ 1 · เลือกประเภทข้อมูล</div>' +
        '<div class="chipset" id="kindChips">' + Object.keys(KINDS).map(function (k) {
          return '<label class="chip' + (state.kind === k ? ' is-on' : '') + '" data-kind="' + k + '">' +
            U.esc(KINDS[k].label) + '</label>';
        }).join('') + '</div></div>');
      root.appendChild(step1);
      U.on(step1, 'click', '.chip', function (ev, chip) {
        state.kind = chip.dataset.kind;
        state.rows = null; state.parsed = null;
        app.refresh();
      });

      /* ขั้นที่ 2 */
      var step2 = U.elFromHTML('<div class="card"><div class="card__title">ขั้นที่ 2 · ดาวน์โหลดไฟล์ตัวอย่างแล้วกรอกข้อมูล</div>' +
        '<div class="card__desc">' + U.esc(kind.hint) + '</div>' +
        '<div class="table-wrap mb-8"><table class="data"><thead><tr>' +
        kind.headers.map(function (h) { return '<th>' + U.esc(h) + '</th>'; }).join('') +
        '</tr></thead><tbody>' + kind.sample.map(function (r) {
          return '<tr>' + r.map(function (c) { return '<td>' + U.esc(c) + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>' +
        '<button type="button" class="btn btn--primary" id="btnTemplate">⬇ ดาวน์โหลดไฟล์ตัวอย่าง (.csv)</button></div>');
      root.appendChild(step2);
      step2.querySelector('#btnTemplate').addEventListener('click', function () {
        var rows = [kind.headers].concat(kind.sample);
        U.downloadText('ตัวอย่างนำเข้า-' + kind.label + '.csv', X.toCsv(rows));
        U.toast('ดาวน์โหลดไฟล์ตัวอย่างแล้ว เปิดด้วย Excel กรอกข้อมูลแล้วอัปโหลดกลับ', 'success');
      });

      /* ขั้นที่ 3 */
      var step3 = U.elFromHTML('<div class="card"><div class="card__title">ขั้นที่ 3 · อัปโหลดไฟล์กลับเข้าระบบ</div>' +
        '<div class="flex gap-8 items-center flex-wrap">' +
        '<input type="file" class="input" id="impFile" accept=".csv,.xlsx" style="max-width:340px">' +
        '<label class="chip' + (state.autoCreate ? ' is-on' : '') + '" id="autoChip"><input type="checkbox"' +
        (state.autoCreate ? ' checked' : '') + '>สร้างข้อมูลอ้างอิงที่ยังไม่มีให้อัตโนมัติ</label>' +
        '<select class="select" id="dupMode" style="max-width:260px">' +
        '<option value="update"' + (state.onDuplicate === 'update' ? ' selected' : '') + '>ข้อมูลซ้ำ: เขียนทับของเดิม</option>' +
        '<option value="skip"' + (state.onDuplicate === 'skip' ? ' selected' : '') + '>ข้อมูลซ้ำ: ข้ามไป</option>' +
        '</select></div>' +
        '<div class="progress mt-16" id="impProgress" style="display:none"><div class="progress__fill" id="impFill"></div></div>' +
        '<div class="progress__text" id="impText"></div></div>');
      root.appendChild(step3);
      step3.querySelector('#autoChip').addEventListener('change', function (ev) {
        state.autoCreate = ev.target.checked;
        step3.querySelector('#autoChip').classList.toggle('is-on', state.autoCreate);
      });
      step3.querySelector('#dupMode').addEventListener('change', function (ev) {
        state.onDuplicate = ev.target.value;
      });

      var resultHost = document.createElement('div');
      root.appendChild(resultHost);

      if (state.lastSummary) {
        var sm = state.lastSummary;
        resultHost.appendChild(U.elFromHTML('<div class="result-card result-card--success">' +
          '<div class="result-card__title">นำเข้าข้อมูลเรียบร้อยแล้ว</div>' +
          '<div class="result-card__line">เพิ่มใหม่ ' + U.fmtNum(sm.added) + ' รายการ · ' +
          'แก้ไขของเดิม ' + U.fmtNum(sm.updated) + ' รายการ · ' +
          'ข้าม ' + U.fmtNum(sm.skipped + (sm.badRows || 0)) + ' รายการ</div>' +
          (sm.created.length ? '<div class="result-card__line">สร้างข้อมูลอ้างอิงให้อัตโนมัติ: ' +
            U.esc(sm.created.join(', ')) + '</div>' : '') + '</div>'));
        state.lastSummary = null;
      }

      step3.querySelector('#impFile').addEventListener('change', function (ev) {
        var file = ev.target.files && ev.target.files[0];
        if (!file) return;
        var isXlsx = /\.xlsx$/i.test(file.name);
        step3.querySelector('#impProgress').style.display = '';
        step3.querySelector('#impFill').style.width = '30%';
        step3.querySelector('#impText').textContent = 'กำลังอ่านไฟล์ ' + file.name;

        var reader = isXlsx ? U.readFileBuffer(file) : U.readFileText(file);
        reader.then(function (content) {
          var rows;
          try {
            rows = isXlsx ? X.parseXlsx(content) : X.parseCsv(content);
          } catch (err) {
            step3.querySelector('#impProgress').style.display = 'none';
            step3.querySelector('#impText').textContent = '';
            U.explainDialog({
              title: 'อ่านไฟล์ไม่สำเร็จ',
              cause: 'ระบบเปิดไฟล์นี้ไม่ได้ (' + (err && err.message ? err.message : 'รูปแบบไฟล์ไม่ถูกต้อง') + ')',
              fix: 'ให้บันทึกไฟล์เป็นนามสกุล .xlsx หรือ .csv แล้วลองใหม่ หรือกดดาวน์โหลดไฟล์ตัวอย่างแล้วกรอกลงในไฟล์นั้น'
            });
            return;
          }
          step3.querySelector('#impFill').style.width = '100%';
          step3.querySelector('#impText').textContent = 'อ่านไฟล์แล้ว ' + U.fmtNum(rows.length) + ' แถว';
          validateAndShow(rows);
        });
        ev.target.value = '';
      });

      function validateAndShow(rows) {
        resultHost.innerHTML = '';
        if (!rows.length) {
          U.explainDialog({
            title: 'ไฟล์นี้ไม่มีข้อมูล',
            cause: 'ไฟล์ที่อัปโหลดไม่มีแถวข้อมูลเลย',
            fix: 'ให้กรอกข้อมูลลงในไฟล์ตัวอย่างอย่างน้อย 1 แถว แล้วอัปโหลดใหม่'
          });
          return;
        }
        var header = rows[0].map(function (c) { return String(c).trim(); });
        var expected = kind.headers;
        var ok = expected.every(function (h, i) { return header[i] === h; });
        if (!ok) {
          U.explainDialog({
            title: 'หัวคอลัมน์ในไฟล์ไม่ตรงกับที่ระบบต้องการ',
            cause: 'ระบบคาดหวังหัวคอลัมน์ตามลำดับนี้: ' + expected.join(' | ') +
              ' แต่ในไฟล์พบ: ' + (header.join(' | ') || 'ไม่พบหัวคอลัมน์'),
            fix: 'ให้กดดาวน์โหลดไฟล์ตัวอย่าง แล้วกรอกข้อมูลลงในไฟล์นั้นโดยไม่แก้แถวหัวคอลัมน์'
          });
          return;
        }

        var dataRows = rows.slice(1);
        var checked = dataRows.map(function (r, i) {
          return validateRow(st, state.kind, r, i + 2, state.autoCreate);
        });
        state.parsed = checked;
        renderPreview(checked);
      }

      function renderPreview(checked) {
        var okRows = checked.filter(function (c) { return c.ok; });
        var badRows = checked.filter(function (c) { return !c.ok; });

        var card = U.elFromHTML('<div class="card"><div class="card__title">ขั้นที่ 4 · ตรวจสอบก่อนบันทึกจริง</div>' +
          '<div class="card__desc">อ่านได้ ' + U.fmtNum(checked.length) + ' แถว · ถูกต้อง ' +
          U.fmtNum(okRows.length) + ' แถว · มีปัญหา ' + U.fmtNum(badRows.length) + ' แถว</div>' +
          '<div class="table-wrap"><table class="data"><thead><tr><th class="num">แถวที่</th>' +
          kind.headers.map(function (h) { return '<th>' + U.esc(h) + '</th>'; }).join('') +
          '<th>ผลการตรวจ</th></tr></thead><tbody>' +
          checked.slice(0, 200).map(function (c) {
            return '<tr' + (c.ok ? '' : ' style="background:#fef2f2"') + '>' +
              '<td class="num">' + c.line + '</td>' +
              kind.headers.map(function (h, i) { return '<td>' + U.esc(c.raw[i] || '') + '</td>'; }).join('') +
              '<td>' + (c.ok ? '<span class="badge badge--success">ถูกต้อง</span>'
                : '<span class="badge badge--danger">' + U.esc(c.error) + '</span>') + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
          (checked.length > 200 ? '<div class="small muted mt-8">แสดง 200 แถวแรก</div>' : '') +
          '<div class="flex gap-8 mt-16"><button type="button" class="btn btn--primary" id="btnCommit">' +
          'ยืนยันนำเข้า ' + U.fmtNum(okRows.length) + ' แถวที่ถูกต้อง</button>' +
          '<button type="button" class="btn" id="btnCancelImport">ยกเลิก</button></div></div>');
        resultHost.appendChild(card);

        card.querySelector('#btnCancelImport').addEventListener('click', function () {
          resultHost.innerHTML = '';
          state.parsed = null;
        });
        card.querySelector('#btnCommit').addEventListener('click', function () {
          if (!okRows.length) {
            U.explainDialog({
              title: 'ไม่มีแถวที่นำเข้าได้',
              cause: 'ทุกแถวในไฟล์มีปัญหา จึงไม่มีข้อมูลที่บันทึกได้',
              fix: 'ให้แก้ไขแถวที่ระบบแจ้งไว้ในคอลัมน์ผลการตรวจ แล้วอัปโหลดไฟล์ใหม่'
            });
            return;
          }
          var ask = state.onDuplicate === 'update'
            ? U.confirmDialog({
              title: 'ยืนยันการนำเข้า',
              message: 'จะบันทึกข้อมูล ' + okRows.length + ' แถวเข้าสู่ระบบ',
              detail: '<b>ผลที่จะเกิดขึ้น</b><br>รายการที่ชื่อซ้ำกับของเดิมจะถูกเขียนทับด้วยข้อมูลจากไฟล์',
              confirmText: 'นำเข้าข้อมูล'
            })
            : Promise.resolve(true);
          ask.then(function (go) {
            if (!go) return;
            var summary = applyRows(st, state.kind, okRows, state.onDuplicate);
            M.syncAssignments(st);
            global.ST.store.save();
            summary.badRows = badRows.length;
            state.lastSummary = summary;
            state.rows = null; state.parsed = null;
            app.refresh();
            U.toast('นำเข้าข้อมูลเรียบร้อยแล้ว', 'success');
          });
        });
      }
    }
  };

  /* ---------- ตรวจแต่ละแถว ---------- */
  function findByName(list, name) {
    var n = String(name || '').trim();
    for (var i = 0; i < list.length; i++) if (String(list[i].name).trim() === n) return list[i];
    return null;
  }

  function parseBool(text) {
    var s = String(text || '').trim();
    return s === 'ใช่' || s === 'true' || s === '1' || s === 'y';
  }

  function validateRow(st, kind, raw, line, autoCreate) {
    var out = { raw: raw, line: line, ok: true, error: '', data: {} };
    function fail(msg) { out.ok = false; out.error = msg; return out; }
    var v = function (i) { return String(raw[i] === undefined ? '' : raw[i]).trim(); };

    if (kind === 'teachers') {
      if (!v(0)) return fail('ไม่ได้กรอกชื่อ-นามสกุล ซึ่งเป็นช่องบังคับ');
      var group = v(2) ? findByName(st.subjectGroups, v(2)) : null;
      if (v(2) && !group && !autoCreate) return fail('ไม่พบกลุ่มสาระ "' + v(2) + '" ในระบบ');
      var days = [];
      String(v(3) || '').split(/[,\s]+/).forEach(function (d) {
        var k = DAY_FROM_THAI[d.trim()];
        if (k) days.push(k);
      });
      if (v(3) && !days.length) return fail('วันที่มาสอนอ่านไม่ออก ให้ใส่ตัวย่อ เช่น จ,อ,พ,พฤ,ศ');
      out.data = {
        name: v(0), shortName: v(1), groupName: v(2),
        availableDays: days.length ? days : st.periodConfig.days.slice(),
        maxPeriodsPerDay: v(4) ? U.num(v(4)) : 6,
        maxPeriodsPerWeek: v(5) ? U.num(v(5)) : 25
      };
      if (out.data.maxPeriodsPerDay < 1) return fail('คาบสูงสุดต่อวันต้องมากกว่า 0');
      if (out.data.maxPeriodsPerWeek < 1) return fail('คาบสูงสุดต่อสัปดาห์ต้องมากกว่า 0');
      return out;
    }

    if (kind === 'subjects') {
      if (!v(0)) return fail('ไม่ได้กรอกรหัสวิชา');
      if (!v(1)) return fail('ไม่ได้กรอกชื่อวิชา');
      if (!v(3)) return fail('ไม่ได้กรอกกลุ่มสาระ');
      if (!findByName(st.subjectGroups, v(3)) && !autoCreate) return fail('ไม่พบกลุ่มสาระ "' + v(3) + '" ในระบบ');
      var dm = v(5);
      var doubleMode = dm === 'ห้ามแยก' ? 'STRICT' : (dm === 'แยกได้' ? 'PREFERRED' : 'NONE');
      if (dm && ['ไม่ใช่', 'ห้ามแยก', 'แยกได้'].indexOf(dm) === -1) {
        return fail('ช่องคาบคู่ต้องเป็น ไม่ใช่ / ห้ามแยก / แยกได้ เท่านั้น');
      }
      out.data = {
        code: v(0), name: v(1), shortName: v(2), groupName: v(3),
        isCore: parseBool(v(4)), doubleMode: doubleMode,
        isElective: parseBool(v(6)), isActivity: parseBool(v(7))
      };
      return out;
    }

    if (kind === 'rooms') {
      if (!v(0)) return fail('ไม่ได้กรอกชื่อห้อง');
      if (!v(1)) return fail('ไม่ได้กรอกอาคาร');
      if (!findByName(st.buildings, v(1)) && !autoCreate) return fail('ไม่พบอาคาร "' + v(1) + '" ในระบบ');
      var floorNo = U.num(v(2)) || 1;
      if (floorNo < 1) return fail('ช่องชั้นต้องเป็นตัวเลขตั้งแต่ 1 ขึ้นไป');
      out.data = {
        name: v(0), buildingName: v(1), floor: floorNo,
        capacity: U.num(v(3)) || 40
      };
      return out;
    }

    if (kind === 'sections') {
      if (!v(0)) return fail('ไม่ได้กรอกชื่อชั้นเรียน');
      if (!v(1)) return fail('ไม่ได้กรอกระดับชั้น');
      if (!findByName(st.gradeLevels, v(1)) && !autoCreate) return fail('ไม่พบระดับชั้น "' + v(1) + '" ในระบบ');
      if (v(3) && !findByName(st.rooms, v(3))) return fail('ไม่พบห้องประจำ "' + v(3) + '" ในระบบ');
      if (v(4) && !findByName(st.curricula, v(4))) {
        return fail('ไม่พบหลักสูตรชื่อ "' + v(4) + '" ในระบบ ให้นำเข้าหลักสูตรก่อน หรือเว้นช่องนี้ว่างไว้');
      }
      out.data = {
        name: v(0), gradeName: v(1), studentCount: U.num(v(2)) || 0,
        homeRoomName: v(3), curriculumName: v(4), note: v(5)
      };
      return out;
    }

    if (kind === 'curriculum') {
      if (!v(0)) return fail('ไม่ได้กรอกชื่อหลักสูตร');
      if (!v(1)) return fail('ไม่ได้กรอกระดับชั้น');
      if (!v(2)) return fail('ไม่ได้กรอกรหัสวิชา');
      var grade = findByName(st.gradeLevels, v(1));
      if (!grade && !autoCreate) return fail('ไม่พบระดับชั้น "' + v(1) + '" ในระบบ');
      if (!findByName(st.curricula, v(0)) && !autoCreate) {
        return fail('ไม่พบหลักสูตรชื่อ "' + v(0) + '" ในระบบ');
      }
      var subject = st.subjects.filter(function (s) { return s.code === v(2); })[0];
      if (!subject) return fail('ไม่พบวิชารหัส "' + v(2) + '" ในระบบ ให้นำเข้ารายวิชาก่อน');
      var periods = U.num(v(3));
      if (periods < 1) return fail('คาบต่อสัปดาห์ต้องมากกว่า 0');
      out.data = {
        curriculumName: v(0), gradeName: v(1), subjectCode: v(2), periodsPerWeek: periods
      };
      return out;
    }

    if (kind === 'assignments') {
      if (!v(0)) return fail('ไม่ได้กรอกชั้นเรียน');
      if (!v(1)) return fail('ไม่ได้กรอกรหัสวิชา');
      if (!v(2)) return fail('ไม่ได้กรอกครูผู้สอน');
      var section = findByName(st.classSections, v(0));
      if (!section) return fail('ไม่พบชั้นเรียน "' + v(0) + '" ในระบบ');
      var subj = st.subjects.filter(function (s) { return s.code === v(1); })[0];
      if (!subj) return fail('ไม่พบวิชารหัส "' + v(1) + '" ในระบบ');
      var teacher = findByName(st.teachers, v(2));
      if (!teacher) return fail('ไม่พบครู "' + v(2) + '" ในระบบ');
      var co = v(3) ? findByName(st.teachers, v(3)) : null;
      if (v(3) && !co) return fail('ไม่พบครูผู้สอนร่วม "' + v(3) + '" ในระบบ');
      if (co && co.id === teacher.id) return fail('ครูผู้สอนร่วมเป็นคนเดียวกับครูผู้สอนหลัก');
      var room = v(4) ? findByName(st.rooms, v(4)) : null;
      if (v(4) && !room) return fail('ไม่พบห้อง "' + v(4) + '" ในระบบ');
      var assignment = st.assignments.filter(function (a) {
        return a.classSectionId === section.id && a.subjectId === subj.id;
      })[0];
      if (!assignment) return fail('หลักสูตรของชั้นเรียนนี้ไม่มีวิชานี้ ให้แก้หลักสูตรก่อน');
      out.data = {
        assignmentId: assignment.id, teacherId: teacher.id,
        coTeacherId: co ? co.id : '', roomId: room ? room.id : ''
      };
      return out;
    }

    return fail('ไม่รู้จักประเภทข้อมูลนี้');
  }

  /* ---------- บันทึกลงระบบ ---------- */
  function applyRows(st, kind, rows, onDuplicate) {
    var summary = { added: 0, updated: 0, skipped: 0, created: [] };
    var now = new Date().toISOString();

    function ensureGroup(name) {
      if (!name) return '';
      var g = findByName(st.subjectGroups, name);
      if (g) return g.id;
      g = { id: U.uid('sg'), name: name, color: '#5b50ef' };
      st.subjectGroups.push(g);
      summary.created.push('กลุ่มสาระ ' + name);
      return g.id;
    }
    function ensureRoomType(name) {
      var rt = findByName(st.roomTypes, name);
      if (rt) return rt.id;
      rt = { id: U.uid('rt'), name: name, isGeneral: !st.roomTypes.length };
      st.roomTypes.push(rt);
      summary.created.push('ประเภทห้อง ' + name);
      return rt.id;
    }
    function ensureBuilding(name) {
      var b = findByName(st.buildings, name);
      if (b) return b.id;
      b = { id: U.uid('bd'), name: name, order: st.buildings.length + 1 };
      st.buildings.push(b);
      summary.created.push('อาคาร ' + name);
      return b.id;
    }
    function ensureGrade(name) {
      var g = findByName(st.gradeLevels, name);
      if (g) return g.id;
      var match = String(name).trim().match(/^(ป|ม)\.(\d)$/);
      var levelNo = match ? Number(match[2]) : 0;
      var standardOrder = match && levelNo >= 1 && levelNo <= 6
        ? (match[1] === 'ป' ? levelNo : levelNo + 6)
        : st.gradeLevels.length + 13;
      g = { id: U.uid('gl'), name: name, order: standardOrder };
      st.gradeLevels.push(g);
      summary.created.push('ระดับชั้น ' + name);
      return g.id;
    }

    rows.forEach(function (row) {
      var d = row.data;
      if (kind === 'teachers') {
        var existing = findByName(st.teachers, d.name);
        if (existing && onDuplicate === 'skip') { summary.skipped++; return; }
        var target = existing || { id: U.uid('tc'), createdAt: now };
        target.name = d.name;
        target.shortName = d.shortName || U.teacherShort(d.name);
        target.subjectGroupId = ensureGroup(d.groupName);
        target.availableDays = d.availableDays;
        target.maxPeriodsPerDay = d.maxPeriodsPerDay;
        target.maxPeriodsPerWeek = d.maxPeriodsPerWeek;
        target.unavailableSlots = target.unavailableSlots || [];
        target.updatedAt = now;
        if (existing) summary.updated++; else { st.teachers.push(target); summary.added++; }
        return;
      }
      if (kind === 'subjects') {
        var ex = st.subjects.filter(function (s) { return s.code === d.code; })[0];
        if (ex && onDuplicate === 'skip') { summary.skipped++; return; }
        var t = ex || { id: U.uid('sj'), createdAt: now };
        t.code = d.code; t.name = d.name;
        t.shortName = d.shortName || U.abbreviate(d.name, 10);
        t.subjectGroupId = ensureGroup(d.groupName);
        t.isCore = d.isCore; t.doubleMode = d.doubleMode;
        t.isElective = d.isElective; t.isActivity = d.isActivity;
        t.updatedAt = now;
        if (ex) summary.updated++; else { st.subjects.push(t); summary.added++; }
        return;
      }
      if (kind === 'rooms') {
        var bId = ensureBuilding(d.buildingName);
        var exr = st.rooms.filter(function (r) { return r.name === d.name && r.buildingId === bId; })[0];
        if (exr && onDuplicate === 'skip') { summary.skipped++; return; }
        var tr = exr || { id: U.uid('rm'), createdAt: now };
        tr.name = d.name; tr.buildingId = bId;
        tr.floor = Math.max(1, U.num(d.floor) || 1);
        tr.capacity = d.capacity; tr.updatedAt = now;
        if (exr) summary.updated++; else { st.rooms.push(tr); summary.added++; }
        return;
      }
      if (kind === 'sections') {
        var exs = findByName(st.classSections, d.name);
        if (exs && onDuplicate === 'skip') { summary.skipped++; return; }
        var ts = exs || { id: U.uid('cs'), createdAt: now };
        ts.name = d.name;
        ts.gradeLevelId = ensureGrade(d.gradeName);
        ts.studentCount = d.studentCount;
        var hr = d.homeRoomName ? findByName(st.rooms, d.homeRoomName) : null;
        ts.homeRoomId = hr ? hr.id : '';
        var cu = d.curriculumName ? findByName(st.curricula, d.curriculumName) : null;
        if (cu) ts.curriculumId = cu.id;
        else if (ts.curriculumId === undefined) ts.curriculumId = '';
        ts.note = d.note; ts.updatedAt = now;
        if (exs) summary.updated++; else { st.classSections.push(ts); summary.added++; }
        return;
      }
      if (kind === 'curriculum') {
        var gId = ensureGrade(d.gradeName);
        var cur = findByName(st.curricula, d.curriculumName);
        if (!cur) {
          cur = {
            id: U.uid('cu'), name: d.curriculumName, gradeLevelId: gId, note: '',
            createdAt: now, updatedAt: now
          };
          st.curricula.push(cur);
        }
        var subj = st.subjects.filter(function (s) { return s.code === d.subjectCode; })[0];
        var exc = st.curriculumItems.filter(function (c) {
          return c.curriculumId === cur.id && c.subjectId === subj.id;
        })[0];
        if (exc && onDuplicate === 'skip') { summary.skipped++; return; }
        if (exc) { exc.periodsPerWeek = d.periodsPerWeek; summary.updated++; }
        else {
          st.curriculumItems.push({
            id: U.uid('ci'), curriculumId: cur.id, subjectId: subj.id,
            periodsPerWeek: d.periodsPerWeek, createdAt: now, updatedAt: now
          });
          summary.added++;
        }
        return;
      }
      if (kind === 'assignments') {
        var a = U.byId(st.assignments, d.assignmentId);
        if (!a) { summary.skipped++; return; }
        if (a.teacherId && onDuplicate === 'skip') { summary.skipped++; return; }
        if (a.teacherId) summary.updated++; else summary.added++;
        a.teacherId = d.teacherId;
        a.coTeacherId = d.coTeacherId;
        a.roomId = d.roomId;
        a.updatedAt = now;
      }
    });
    return summary;
  }

  global.ST.importer = { validateRow: validateRow, applyRows: applyRows, KINDS: KINDS };
})(typeof window !== 'undefined' ? window : globalThis);
