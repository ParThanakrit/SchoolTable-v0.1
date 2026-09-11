/* ทดสอบเครื่องมือจัดตารางด้วย Node — ตรวจกฎ H1–H9 กับข้อมูลโรงเรียนตัวอย่าง */
'use strict';
require('../js/util.js');
require('../js/store.js');
require('../js/model.js');
require('../js/mockdata.js');
require('../js/scheduler.js');

var ST = globalThis.ST;
var U = ST.util;

function line(t) { console.log(t); }

var state = ST.mockdata.build();

line('=== ข้อมูลโรงเรียนตัวอย่าง ===');
line('ครู                ' + state.teachers.length + ' คน');
line('ชั้นเรียน           ' + state.classSections.length + ' ห้อง');
line('ห้องสถานที่         ' + state.rooms.length + ' ห้อง');
line('อาคาร              ' + state.buildings.length + ' อาคาร');
line('รายวิชา            ' + state.subjects.length + ' วิชา');
line('กลุ่มสาระ           ' + state.subjectGroups.length + ' กลุ่ม');
line('การมอบหมายสอน      ' + state.assignments.length + ' รายการ');
line('คาบล็อก            ' + state.lockedSlots.length + ' รายการ');
line('ช่องต่อสัปดาห์       ' + ST.model.slotsPerWeek(state) + ' ช่อง');

var totalPeriods = state.assignments.reduce(function (s, a) { return s + a.periodsPerWeek; }, 0);
line('คาบที่ต้องจัดทั้งหมด  ' + totalPeriods + ' คาบ');

var withCo = state.assignments.filter(function (a) { return a.coTeacherId; }).length;
var partTime = state.teachers.filter(function (t) { return t.availableDays.length < 5; }).length;
var strictSubjects = state.subjects.filter(function (s) { return s.doubleMode === 'STRICT'; }).length;
var electiveSubjects = state.subjects.filter(function (s) { return s.isElective; }).length;
var labSubjects = state.subjects.filter(function (s) {
  var rt = U.byId(state.roomTypes, s.requiredRoomTypeId);
  return rt && !rt.isGeneral;
}).length;
line('สอนร่วม 2 คน        ' + withCo + ' รายการ (ต้อง >= 5)');
line('ครูมาไม่ครบสัปดาห์   ' + partTime + ' คน (ต้อง >= 3)');
line('วิชาคาบคู่ห้ามแยก    ' + strictSubjects + ' วิชา (ต้อง >= 5)');
line('วิชาเลือกเสรี        ' + electiveSubjects + ' วิชา (ต้อง >= 1)');
line('วิชาที่ใช้ห้องพิเศษ    ' + labSubjects + ' วิชา (ต้อง >= 8)');

var pre = ST.model.preflight(state);
line('\nผลตรวจความพร้อมก่อนจัด: ' + (pre.length ? 'ไม่ผ่าน' : 'ผ่าน'));
pre.forEach(function (p) { line('  - ' + p.title + ': ' + p.message); });

var t0 = Date.now();
ST.scheduler.generate(state, { seed: 12345 }).then(function (result) {
  var elapsed = Date.now() - t0;
  line('\n=== ผลการจัดตาราง ===');
  line('จัดได้      ' + result.stats.placed + ' / ' + result.stats.totalRequired + ' คาบ');
  line('คาบค้าง     ' + result.stats.unplaced + ' คาบ');
  line('ละเมิดกฎรอง ' + result.stats.softViolations + ' จุด');
  line('เวลาที่ใช้   ' + (result.elapsedMs / 1000).toFixed(2) + ' วินาที (รวม overhead ' + (elapsed / 1000).toFixed(2) + ')');

  var soft = {};
  result.issues.forEach(function (i) {
    if (i.type !== 'SOFT_VIOLATION') return;
    soft[i.ruleCode] = (soft[i.ruleCode] || 0) + 1;
  });
  line('  แยกตามกฎรอง: ' + JSON.stringify(soft));

  var unplacedIssues = result.issues.filter(function (i) { return i.type === 'UNPLACED'; });
  line('\nรายการที่จัดไม่ลง ' + unplacedIssues.length + ' รายการ');
  unplacedIssues.slice(0, 12).forEach(function (i) {
    line('  - ' + i.context.sectionName + ' ' + i.context.subjectName +
      ' (' + i.remainingPeriods + ' คาบ) : ' + i.message + ' | ' + i.suggestion);
  });

  var violations = ST.scheduler.auditHardRules(state, result.entries);
  line('\n=== ตรวจกฎห้ามผิดเด็ดขาด ===');
  if (!violations.length) {
    line('ไม่พบการละเมิด H1–H9 แม้แต่จุดเดียว');
  } else {
    var byRule = {};
    violations.forEach(function (v) { byRule[v.rule] = (byRule[v.rule] || 0) + 1; });
    line('พบการละเมิด: ' + JSON.stringify(byRule));
    violations.slice(0, 10).forEach(function (v) { line('  * ' + v.rule + ' — ' + v.message); });
  }

  /* ตรวจว่าวิชาหลักส่วนใหญ่อยู่ช่วงเช้า */
  var coreTotal = 0, coreMorning = 0;
  var aById = U.indexById(state.assignments);
  var sById = U.indexById(state.subjects);
  result.entries.forEach(function (e) {
    var a = aById[e.assignmentId];
    if (!a) return;
    var s = sById[a.subjectId];
    if (!s || !s.isCore) return;
    coreTotal++;
    if (e.periodNo <= state.periodConfig.morningEndsAtPeriod) coreMorning++;
  });
  line('\nวิชาหลักอยู่ช่วงเช้า ' + coreMorning + ' / ' + coreTotal +
    ' คาบ (' + Math.round((coreMorning / coreTotal) * 100) + '%)');

  process.exitCode = violations.length ? 1 : 0;
});
