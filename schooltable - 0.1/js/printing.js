/* ============================================================
   SchoolTable — printing.js   สร้างเอกสารสำหรับพิมพ์ลงกระดาษ A4
   ============================================================ */
(function (global) {
  'use strict';

  var U = global.ST.util, M = global.ST.model;

  function defaults(opts) {
    var o = opts || {};
    return {
      showTeacher: o.showTeacher !== false,
      showRoom: o.showRoom !== false,
      showTime: o.showTime !== false,
      showSignature: o.showSignature !== false
    };
  }

  function header(st, docTitle, isDraft) {
    var logo = st.school.logoData
      ? '<div class="print-head__logo"><img src="' + U.esc(st.school.logoData) + '" alt="ตราโรงเรียน"></div>'
      : '<div class="print-head__logo print-head__logo--empty">พื้นที่<br>ตราโรงเรียน</div>';
    return logo +
      '<div class="print-head__text">' +
      '<div class="print-head__school">' + U.esc(st.school.name || 'โรงเรียน') + '</div>' +
      '<div class="print-head__doc">' + U.esc(docTitle) + '</div>' +
      '<div class="print-head__term">ภาคเรียนที่ ' + U.esc(st.school.semester) +
      ' ปีการศึกษา ' + U.esc(st.school.academicYear) + '</div>' +
      (isDraft ? '<div class="print-draft-tag">ฉบับร่าง — ยังไม่ประกาศใช้</div>' : '') +
      '</div><div class="print-head__side"></div>';
  }

  function footer(st, o) {
    var sign = o.showSignature
      ? '<div class="print-foot__sign">' +
      '<div class="print-foot__sign-line"></div>' +
      '( ' + U.esc(st.school.directorName || '.....................................') + ' )<br>' +
      'ผู้อำนวยการ' + U.esc(st.school.name || 'โรงเรียน') +
      '</div>'
      : '';
    return '<div class="print-foot">' +
      '<div class="print-foot__left">พิมพ์เมื่อ ' + U.esc(U.thaiDateTime()) + '</div>' + sign + '</div>';
  }

  function page(st, docTitle, subtitle, isDraft, inner, o) {
    return '<section class="print-page">' +
      (isDraft ? '<div class="print-draft">ฉบับร่าง</div>' : '') +
      '<div class="print-head">' + header(st, docTitle, isDraft) + '</div>' +
      (subtitle ? '<div class="print-subject">' + U.esc(subtitle) + '</div>' : '') +
      inner + footer(st, o) + '</section>';
  }

  /* ตารางสัปดาห์ 1 ใบ (แถวคือวัน คอลัมน์คือคาบ — แต่ละวันมีจำนวนคาบไม่เท่ากันได้) */
  function weekTable(st, cells, o) {
    var days = st.periodConfig.days;
    var nos = M.allPeriodNos(st);
    var html = '<table class="print-table"><thead><tr><th style="width:70px">วัน / คาบ</th>';
    nos.forEach(function (no) {
      var sample = null;
      for (var i = 0; i < days.length && !sample; i++) sample = M.periodByNo(st, days[i], no);
      html += '<th>คาบ ' + no +
        (o.showTime && sample ? '<br><span style="font-weight:400">' +
          U.esc(sample.startTime) + '–' + U.esc(sample.endTime) + '</span>' : '') + '</th>';
    });
    html += '</tr></thead><tbody>';
    days.forEach(function (d) {
      html += '<tr><td class="daycell">' + U.DAY_NAMES[d] + '</td>';
      nos.forEach(function (no) {
        var p = M.periodByNo(st, d, no);
        if (!p) { html += '<td class="slot-none">—</td>'; return; }
        if (p.isBreak) {
          html += '<td class="slot-break">' + U.esc(p.label || 'พัก') + '</td>';
          return;
        }
        var content = cells[d + '#' + no];
        html += '<td class="slot">' + (content || '<div class="pt-empty">—</div>') + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  function lookups(st) {
    return {
      assignmentById: U.indexById(st.assignments),
      subjectById: U.indexById(st.subjects),
      teacherById: U.indexById(st.teachers),
      roomById: U.indexById(st.rooms),
      sectionById: U.indexById(st.classSections)
    };
  }

  function lockCells(st, matchFn) {
    var cells = {};
    st.lockedSlots.forEach(function (l) {
      if (!matchFn(l)) return;
      cells[l.day + '#' + l.periodNo] = '<div class="pt-lock">◆ ' + U.esc(l.label) + '</div>';
    });
    return cells;
  }

  /* ---------- ตารางเรียนรายชั้นเรียน ---------- */
  function classPage(st, tt, section, o) {
    var L = lookups(st);
    var cells = lockCells(st, function (l) { return M.lockAppliesToSection(st, l, section); });
    tt.entries.forEach(function (e) {
      var a = L.assignmentById[e.assignmentId];
      if (!a || a.classSectionId !== section.id) return;
      var subject = L.subjectById[a.subjectId];
      var teacher = L.teacherById[a.teacherId];
      var co = a.coTeacherId ? L.teacherById[a.coTeacherId] : null;
      var room = L.roomById[e.roomId];
      cells[e.day + '#' + e.periodNo] =
        '<div class="pt-subject">' + U.esc(subject ? subject.name : '-') + '</div>' +
        (o.showTeacher ? '<div class="pt-line">' + U.esc(teacher ? teacher.name : '-') +
          (co ? ' / ' + U.esc(co.name) : '') + '</div>' : '') +
        (o.showRoom ? '<div class="pt-line">ห้อง ' + U.esc(room ? room.name : '-') + '</div>' : '');
    });
    var grade = U.byId(st.gradeLevels, section.gradeLevelId);
    return page(st, 'ตารางเรียน', 'ชั้น ' + section.name + (grade ? ' (' + grade.name + ')' : '') +
      ' · จำนวนนักเรียน ' + U.fmtNum(section.studentCount) + ' คน',
      tt.status === 'DRAFT', weekTable(st, cells, o), o);
  }

  /* ---------- ตารางสอนรายครู ---------- */
  function teacherPage(st, tt, teacher, o) {
    var L = lookups(st);
    var cells = lockCells(st, function (l) {
      return (l.scope === 'TEACHER' && l.targetId === teacher.id) || l.teacherId === teacher.id;
    });
    var count = 0;
    tt.entries.forEach(function (e) {
      var a = L.assignmentById[e.assignmentId];
      if (!a) return;
      if (a.teacherId !== teacher.id && a.coTeacherId !== teacher.id) return;
      count++;
      var subject = L.subjectById[a.subjectId];
      var section = L.sectionById[a.classSectionId];
      var room = L.roomById[e.roomId];
      cells[e.day + '#' + e.periodNo] =
        '<div class="pt-subject">' + U.esc(subject ? subject.name : '-') + '</div>' +
        '<div class="pt-line">' + U.esc(section ? section.name : '-') + '</div>' +
        (o.showRoom ? '<div class="pt-line">ห้อง ' + U.esc(room ? room.name : '-') + '</div>' : '');
    });
    var group = U.byId(st.subjectGroups, teacher.subjectGroupId);
    return page(st, 'ตารางสอน', 'ครู' + teacher.name +
      (group ? ' · กลุ่มสาระ' + group.name : '') + ' · รวม ' + count + ' คาบต่อสัปดาห์',
      tt.status === 'DRAFT', weekTable(st, cells, o), o);
  }

  /* ---------- ตารางรวมทั้งโรงเรียน (แบ่งหน้าตามวัน) ---------- */
  function schoolPages(st, tt, o) {
    var L = lookups(st);
    var sections = U.sortThai(st.classSections, function (s) { return s.name; });
    var byKey = {};
    tt.entries.forEach(function (e) {
      var a = L.assignmentById[e.assignmentId];
      if (!a) return;
      byKey[a.classSectionId + '#' + e.day + '#' + e.periodNo] = e;
    });

    var pages = '';
    st.periodConfig.days.forEach(function (d) {
      var periods = M.periodsOfDay(st, d);   /* จำนวนคาบของแต่ละวันไม่เท่ากันได้ */
      /* แบ่งหน้าเมื่อชั้นเรียนมากเกินหนึ่งหน้า */
      var chunkSize = 10;
      for (var start = 0; start < sections.length; start += chunkSize) {
        var chunk = sections.slice(start, start + chunkSize);
        var html = '<table class="print-table print-table--wide"><thead><tr><th class="rowhead">ชั้นเรียน</th>';
        periods.forEach(function (p) {
          html += '<th>' + (p.isBreak ? U.esc(p.label || 'พัก') : 'คาบ ' + p.no) +
            (o.showTime ? '<br><span style="font-weight:400">' + U.esc(p.startTime) + '</span>' : '') + '</th>';
        });
        html += '</tr></thead><tbody>';
        chunk.forEach(function (sec) {
          html += '<tr><td class="rowhead">' + U.esc(sec.name) + '</td>';
          periods.forEach(function (p) {
            if (p.isBreak) { html += '<td class="slot-break">พัก</td>'; return; }
            var e = byKey[sec.id + '#' + d + '#' + p.no];
            if (!e) {
              var lock = st.lockedSlots.filter(function (l) {
                return l.day === d && l.periodNo === p.no && M.lockAppliesToSection(st, l, sec);
              })[0];
              html += '<td>' + (lock ? '<div class="pt-lock">◆ ' + U.esc(U.abbreviate(lock.label, 12)) + '</div>'
                : '<div class="pt-empty">—</div>') + '</td>';
              return;
            }
            var a = L.assignmentById[e.assignmentId];
            var subject = L.subjectById[a.subjectId];
            var teacher = L.teacherById[a.teacherId];
            var room = L.roomById[e.roomId];
            html += '<td><div class="pt-subject">' + U.esc(subject ? (subject.shortName || subject.name) : '-') + '</div>' +
              (o.showTeacher ? '<div class="pt-line">' + U.esc(teacher ? (teacher.shortName || teacher.name) : '-') + '</div>' : '') +
              (o.showRoom ? '<div class="pt-line">' + U.esc(room ? room.name : '-') + '</div>' : '') + '</td>';
          });
          html += '</tr>';
        });
        html += '</tbody></table>' +
          '<div class="print-note">◆ คือคาบที่ล็อกไว้ · — คือคาบว่าง</div>';
        var part = sections.length > chunkSize
          ? ' (หน้า ' + (Math.floor(start / chunkSize) + 1) + ' จาก ' + Math.ceil(sections.length / chunkSize) + ')'
          : '';
        pages += page(st, 'ตารางเรียนรวมทั้งโรงเรียน',
          'วัน' + U.DAY_NAMES[d] + part, tt.status === 'DRAFT', html, o);
      }
    });
    return pages;
  }

  /* ---------- รายงานปัญหา ---------- */
  function issueReportHtml(st, tt) {
    var o = defaults({ showSignature: false });
    var unplaced = tt.issues.filter(function (i) { return i.type === 'UNPLACED'; });
    var soft = tt.issues.filter(function (i) { return i.type === 'SOFT_VIOLATION'; });
    var pct = tt.stats.totalRequired
      ? Math.round((tt.stats.placed / tt.stats.totalRequired) * 1000) / 10 : 100;

    var html = '<table class="print-table"><tbody>' +
      '<tr><td style="width:220px"><b>ความสมบูรณ์ของตาราง</b></td><td>' + pct + '%</td></tr>' +
      '<tr><td><b>คาบที่ต้องจัดทั้งหมด</b></td><td>' + U.fmtNum(tt.stats.totalRequired) + ' คาบ</td></tr>' +
      '<tr><td><b>จัดได้</b></td><td>' + U.fmtNum(tt.stats.placed) + ' คาบ</td></tr>' +
      '<tr><td><b>ค้าง</b></td><td>' + U.fmtNum(tt.stats.unplaced) + ' คาบ</td></tr>' +
      '<tr><td><b>ข้อเสนอปรับตาราง</b></td><td>' + U.fmtNum(soft.length) + ' จุด</td></tr>' +
      '</tbody></table>';

    html += '<div class="print-subject" style="margin-top:10px">ส่วนที่ 1 คาบที่จัดไม่ลง</div>';
    if (!unplaced.length) {
      html += '<p>ไม่มีคาบที่จัดไม่ลง ระบบจัดได้ครบทุกคาบ</p>';
    } else {
      html += '<table class="print-table"><thead><tr><th style="width:70px">ชั้นเรียน</th><th style="width:110px">วิชา</th>' +
        '<th style="width:90px">ครู</th><th style="width:44px">คาบค้าง</th><th>สาเหตุ</th><th>ข้อเสนอแนะ</th></tr></thead><tbody>' +
        unplaced.map(function (i) {
          var c = i.context || {};
          return '<tr><td>' + U.esc(c.sectionName) + '</td><td>' + U.esc(c.subjectName) + '</td>' +
            '<td>' + U.esc(c.teacherName) + '</td><td style="text-align:center">' + U.fmtNum(i.remainingPeriods) + '</td>' +
            '<td>' + U.esc(i.message) + '</td><td>' + U.esc(i.suggestion) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }

    html += '<div class="print-subject" style="margin-top:10px">ส่วนที่ 2 ข้อเสนอปรับตาราง</div>';
    if (!soft.length) {
      html += '<p>ไม่มีข้อเสนอปรับตาราง</p>';
    } else {
      html += '<table class="print-table"><thead><tr><th style="width:150px">ประเภท</th><th>รายละเอียด</th>' +
        '<th style="width:60px">ระดับ</th></tr></thead><tbody>' +
        soft.map(function (i) {
          var sev = i.severity === 'HIGH' ? 'สูง' : (i.severity === 'MEDIUM' ? 'ปานกลาง' : 'ต่ำ');
          return '<tr><td>' + U.esc(global.ST.scheduler.SOFT_LABEL[i.ruleCode] || i.ruleCode) + '</td>' +
            '<td>' + U.esc(i.message) + '</td><td style="text-align:center">' + sev + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    return page(st, 'รายงานปัญหาการจัดตารางสอน', 'ตาราง ' + tt.name + ' · สถานะ ' + M.statusLabel(tt.status),
      tt.status === 'DRAFT', html, o);
  }

  /* ---------- สร้างเอกสารตามตัวเลือก ---------- */
  function buildDocument(st, tt, config) {
    var o = defaults(config);
    var html = '';
    if (config.format === 'class') {
      var sections = config.ids && config.ids.length
        ? config.ids.map(function (id) { return U.byId(st.classSections, id); }).filter(Boolean)
        : U.sortThai(st.classSections, function (s) { return s.name; });
      sections.forEach(function (sec) { html += classPage(st, tt, sec, o); });
    } else if (config.format === 'teacher') {
      var teachers = config.ids && config.ids.length
        ? config.ids.map(function (id) { return U.byId(st.teachers, id); }).filter(Boolean)
        : U.sortThai(st.teachers, function (t) { return t.name; });
      teachers.forEach(function (t) { html += teacherPage(st, tt, t, o); });
    } else {
      html += schoolPages(st, tt, o);
    }
    return html || '<section class="print-page"><p>ไม่มีรายการให้พิมพ์</p></section>';
  }

  /* แสดงตัวอย่างบนหน้าจอ พร้อมเตรียมเอกสารจริงไว้ให้เครื่องพิมพ์ */
  function showPreview(html, previewHost) {
    document.getElementById('printRoot').innerHTML = html;
    if (previewHost) {
      previewHost.className = 'print-preview-box';
      previewHost.innerHTML = html;
    }
    return previewHost;
  }

  function clearPreview() {
    var root = document.getElementById('printRoot');
    if (root) root.innerHTML = '';
  }

  function doPrint(html) {
    document.getElementById('printRoot').innerHTML = html;
    setTimeout(function () { window.print(); }, 80);
  }

  function printIssueReport(st, tt) {
    doPrint(issueReportHtml(st, tt));
  }

  global.ST.printing = {
    buildDocument: buildDocument,
    classPage: classPage,
    teacherPage: teacherPage,
    schoolPages: schoolPages,
    issueReportHtml: issueReportHtml,
    printIssueReport: printIssueReport,
    showPreview: showPreview,
    clearPreview: clearPreview,
    doPrint: doPrint,
    defaults: defaults
  };
})(typeof window !== 'undefined' ? window : globalThis);
