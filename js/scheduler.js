/* ============================================================
   SchoolTable — scheduler.js
   เครื่องมือจัดตารางอัตโนมัติ
   บังคับกฎ H1–H9 · ให้คะแนนกฎรอง S1–S4 ตามเงื่อนไขที่ผู้ใช้ตั้ง · อธิบายเหตุผลตาม R1–R7
   ============================================================ */
(function (global) {
  'use strict';

  var U = global.ST.util;
  var M = global.ST.model;

  var SOFT_LABEL = {
    S1: 'วิชาหลักไม่ได้อยู่ช่วงเช้า',
    S2: 'คาบติดกันอยู่ไกลกัน ต้องเดินข้ามอาคารหรือข้ามชั้น',
    S3: 'คาบคู่ถูกแยกออกจากกัน',
    S4: 'ภาระงานครูกระจุกในวันเดียว'
  };

  var WEIGHT_VALUE = { high: 3, medium: 2, low: 1 };

  var REASON_TEXT = {
    R1: 'ครูไม่มีคาบว่างเหลือ',
    R2: 'ครูเต็มโควตาภาระงาน',
    R3: 'ชั้นเรียนไม่มีคาบว่างเหลือ',
    R4: 'ไม่มีห้องประเภทที่ต้องการว่าง',
    R5: 'หาคาบคู่ที่ติดกันไม่ได้',
    R6: 'คาบที่เหลือถูกล็อกไว้',
    R7: 'จัดวิชาเลือกพร้อมกันทั้งระดับชั้นไม่ได้'
  };

  /* ============ บริบทการจัดตาราง ============ */
  function buildContext(state) {
    var conditions = state.conditions || global.ST.store.defaultConditions();
    var ctx = {
      state: state,
      conditions: conditions,
      days: state.periodConfig.days.slice(),
      periodNosByDay: {},
      pairsByDay: {},
      slotSet: {},
      morningEnd: U.num(state.periodConfig.morningEndsAtPeriod),
      teacherById: U.indexById(state.teachers),
      roomById: U.indexById(state.rooms),
      subjectById: U.indexById(state.subjects),
      sectionById: U.indexById(state.classSections),
      assignmentById: U.indexById(state.assignments),
      locks: M.buildLockMaps(state),
      roomsByType: {},
      homeRoomIds: {},
      teacherBusy: {},
      sectionBusy: {},
      roomBusy: {},
      teacherDay: {},
      teacherWeek: {},
      sectionSubjectDay: {}
    };
    ctx.days.forEach(function (d) {
      ctx.periodNosByDay[d] = M.teachingPeriodNos(state, d);
      ctx.pairsByDay[d] = M.adjacentPairs(state, d);
      ctx.periodNosByDay[d].forEach(function (p) { ctx.slotSet[d + '#' + p] = true; });
    });
    state.rooms.forEach(function (r) {
      if (!ctx.roomsByType[r.roomTypeId]) ctx.roomsByType[r.roomTypeId] = [];
      ctx.roomsByType[r.roomTypeId].push(r);
      ctx.roomBusy[r.id] = {};
    });
    state.teachers.forEach(function (t) {
      ctx.teacherBusy[t.id] = {};
      ctx.teacherDay[t.id] = {};
      ctx.teacherWeek[t.id] = 0;
    });
    state.classSections.forEach(function (s) {
      ctx.sectionBusy[s.id] = {};
      ctx.sectionSubjectDay[s.id] = {};
      if (s.homeRoomId) ctx.homeRoomIds[s.homeRoomId] = true;
    });
    return ctx;
  }

  function weightOf(ctx, code) {
    var rule = ctx.conditions.rules && ctx.conditions.rules[code];
    if (!rule || !rule.enabled) return 0;
    return WEIGHT_VALUE[rule.weight] || 1;
  }

  function key(day, periodNo) { return day + '#' + periodNo; }

  function teachersOf(assignment) {
    var list = [];
    if (assignment.teacherId) list.push(assignment.teacherId);
    if (assignment.coTeacherId) list.push(assignment.coTeacherId);
    return list;
  }

  function occupy(ctx, entry) {
    var a = ctx.assignmentById[entry.assignmentId];
    if (!a) return;
    var k = key(entry.day, entry.periodNo);
    ctx.sectionBusy[a.classSectionId][k] = entry;
    if (entry.roomId && ctx.roomBusy[entry.roomId]) ctx.roomBusy[entry.roomId][k] = entry;
    teachersOf(a).forEach(function (tid) {
      if (!ctx.teacherBusy[tid]) return;
      ctx.teacherBusy[tid][k] = entry;
      ctx.teacherDay[tid][entry.day] = (ctx.teacherDay[tid][entry.day] || 0) + 1;
      ctx.teacherWeek[tid] += 1;
    });
    var sd = ctx.sectionSubjectDay[a.classSectionId];
    var sdk = a.subjectId + '#' + entry.day;
    sd[sdk] = (sd[sdk] || 0) + 1;
  }

  function release(ctx, entry) {
    var a = ctx.assignmentById[entry.assignmentId];
    if (!a) return;
    var k = key(entry.day, entry.periodNo);
    delete ctx.sectionBusy[a.classSectionId][k];
    if (entry.roomId && ctx.roomBusy[entry.roomId]) delete ctx.roomBusy[entry.roomId][k];
    teachersOf(a).forEach(function (tid) {
      if (!ctx.teacherBusy[tid]) return;
      delete ctx.teacherBusy[tid][k];
      ctx.teacherDay[tid][entry.day] = Math.max(0, (ctx.teacherDay[tid][entry.day] || 0) - 1);
      ctx.teacherWeek[tid] = Math.max(0, ctx.teacherWeek[tid] - 1);
    });
    var sd = ctx.sectionSubjectDay[a.classSectionId];
    var sdk = a.subjectId + '#' + entry.day;
    sd[sdk] = Math.max(0, (sd[sdk] || 0) - 1);
  }

  /* ============ ตรวจกฎห้ามผิดเด็ดขาดสำหรับ 1 ช่อง ============ */
  function checkSlot(ctx, assignment, day, periodNo, extraLoad, ignoreEntryIds) {
    var k = key(day, periodNo);
    if (!ctx.slotSet[k]) {
      return { code: 'R3', text: 'วัน' + U.DAY_NAMES[day] + ' ไม่มีคาบ ' + periodNo + ' หรือคาบนี้เป็นคาบพัก' };
    }
    var section = ctx.sectionById[assignment.classSectionId];
    if (!section) return { code: 'R3', text: 'ไม่พบชั้นเรียนของรายการนี้' };

    /* H7 — คาบที่ล็อกไว้ */
    if (ctx.locks.section[section.id] && ctx.locks.section[section.id][k]) {
      return { code: 'R6', text: 'คาบนี้ถูกล็อกไว้ (' + ctx.locks.section[section.id][k].label + ')' };
    }
    /* H2 — ชั้นเรียนซ้อนเวลา */
    var busySection = ctx.sectionBusy[section.id][k];
    if (busySection && !(ignoreEntryIds && ignoreEntryIds[busySection.id])) {
      var bsA = ctx.assignmentById[busySection.assignmentId];
      var bsSub = bsA ? ctx.subjectById[bsA.subjectId] : null;
      return {
        code: 'R3',
        text: 'ชั้น ' + section.name + ' เรียนวิชา' + (bsSub ? bsSub.name : 'อื่น') + ' อยู่แล้วในคาบนี้'
      };
    }

    var tids = teachersOf(assignment);
    for (var i = 0; i < tids.length; i++) {
      var t = ctx.teacherById[tids[i]];
      if (!t) continue;
      /* H5 — วันที่ครูมาสอน */
      if ((t.availableDays || []).indexOf(day) === -1) {
        return { code: 'R1', text: 'ครู' + t.name + ' ไม่ได้มาสอนวัน' + U.DAY_NAMES[day] };
      }
      var unavailable = (t.unavailableSlots || []).some(function (s) {
        return s.day === day && U.num(s.periodNo) === periodNo;
      });
      if (unavailable) {
        return { code: 'R1', text: 'ครู' + t.name + ' แจ้งว่าไม่สะดวกสอนวัน' + U.DAY_NAMES[day] + ' คาบ ' + periodNo };
      }
      if (ctx.locks.teacher[t.id] && ctx.locks.teacher[t.id][k]) {
        return { code: 'R6', text: 'ครู' + t.name + ' ถูกล็อกไว้ในคาบนี้ (' + ctx.locks.teacher[t.id][k].label + ')' };
      }
      /* H1 — ครูซ้อนเวลา */
      var busyT = ctx.teacherBusy[t.id][k];
      if (busyT && !(ignoreEntryIds && ignoreEntryIds[busyT.id])) {
        var btA = ctx.assignmentById[busyT.assignmentId];
        var btSec = btA ? ctx.sectionById[btA.classSectionId] : null;
        return {
          code: 'R1',
          text: 'ครู' + t.name + ' สอน ' + (btSec ? btSec.name : 'ห้องอื่น') + ' อยู่แล้วในวัน' +
            U.DAY_NAMES[day] + ' คาบ ' + periodNo
        };
      }
      /* H6 — โควตาภาระงาน */
      var dayCount = ctx.teacherDay[t.id][day] || 0;
      if (dayCount + extraLoad > U.num(t.maxPeriodsPerDay)) {
        return {
          code: 'R2',
          text: 'ครู' + t.name + ' ถึงโควตาสูงสุด ' + t.maxPeriodsPerDay + ' คาบต่อวันแล้วในวัน' + U.DAY_NAMES[day]
        };
      }
      if (ctx.teacherWeek[t.id] + extraLoad > U.num(t.maxPeriodsPerWeek)) {
        return {
          code: 'R2',
          text: 'ครู' + t.name + ' ถึงโควตาสูงสุด ' + t.maxPeriodsPerWeek + ' คาบต่อสัปดาห์แล้ว'
        };
      }
    }
    return null;
  }

  /* หาห้องที่ว่างและตรงประเภท (H3, H9) */
  function findRoom(ctx, assignment, day, periodList, usedInThisStep, ignoreEntryIds) {
    var subject = ctx.subjectById[assignment.subjectId];
    var section = ctx.sectionById[assignment.classSectionId];
    var candidates;
    if (assignment.roomId && ctx.roomById[assignment.roomId]) {
      candidates = [ctx.roomById[assignment.roomId]];
    } else {
      candidates = ctx.state.rooms.slice();   /* ไม่มีประเภทห้องแล้ว: ใช้ห้องใดก็ได้ที่ว่าง */
    }
    var free = [];
    for (var i = 0; i < candidates.length; i++) {
      var room = candidates[i];
      var ok = true;
      for (var j = 0; j < periodList.length; j++) {
        var k = key(day, periodList[j]);
        var busy = ctx.roomBusy[room.id][k];
        if (busy && !(ignoreEntryIds && ignoreEntryIds[busy.id])) { ok = false; break; }
        if (ctx.locks.room[room.id] && ctx.locks.room[room.id][k]) { ok = false; break; }
        if (usedInThisStep && usedInThisStep[room.id + '#' + k]) { ok = false; break; }
      }
      if (ok) free.push(room);
    }
    if (!free.length) return null;
    var homeRoom = section && section.homeRoomId ? ctx.roomById[section.homeRoomId] : null;
    var ownHome = section ? section.homeRoomId : null;
    if (free.length > 1) {
      free.sort(function (a, b) {
        /* กันวิชาที่ไม่ได้ระบุห้องไม่ให้ไปยึด "ห้องประจำ" ของห้องเรียนอื่น
           (ใช้ห้องส่วนกลาง/ห้องพิเศษก่อน) แล้วจึงเลือกห้องที่เดินใกล้ห้องประจำที่สุด (S2) */
        var ah = (ctx.homeRoomIds[a.id] && a.id !== ownHome) ? 1 : 0;
        var bh = (ctx.homeRoomIds[b.id] && b.id !== ownHome) ? 1 : 0;
        if (ah !== bh) return ah - bh;
        if (homeRoom) return M.walkDistance(ctx.state, homeRoom, a) - M.walkDistance(ctx.state, homeRoom, b);
        return 0;
      });
    }
    return free[0];
  }

  /* ============ คะแนนกฎรองตามเงื่อนไขที่ผู้ใช้ตั้ง ============ */
  function softScore(ctx, assignment, day, periodList, room) {
    var subject = ctx.subjectById[assignment.subjectId];
    var section = ctx.sectionById[assignment.classSectionId];
    var wS1 = weightOf(ctx, 'S1');
    var wS2 = weightOf(ctx, 'S2');
    var wS4 = weightOf(ctx, 'S4');
    var score = 0;

    periodList.forEach(function (p) {
      /* S1 — วิชาหลักควรอยู่ช่วงเช้า */
      if (wS1 && subject.isCore && p > ctx.morningEnd) score += (20 + (p - ctx.morningEnd)) * wS1;
      if (wS1 && !subject.isCore && p <= ctx.morningEnd) score += 2 * wS1;
      /* S2 — คาบติดกันควรเดินหากันใกล้ */
      if (wS2 && room) {
        [-1, 1].forEach(function (delta) {
          var neighbor = ctx.sectionBusy[section.id][key(day, p + delta)];
          if (!neighbor || !neighbor.roomId) return;
          var nRoom = ctx.roomById[neighbor.roomId];
          score += M.walkDistance(ctx.state, nRoom, room) * 5 * wS2;
        });
      }
    });

    /* S4 — ภาระงานครูควรกระจาย */
    if (wS4) {
      teachersOf(assignment).forEach(function (tid) {
        var count = ctx.teacherDay[tid] ? (ctx.teacherDay[tid][day] || 0) : 0;
        score += count * count * 0.4 * wS4;
      });
    }

    /* คุณภาพ: ไม่ควรเรียนวิชาเดียวกันซ้ำหลายคาบในวันเดียว */
    if (ctx.conditions.avoidSameSubjectTwiceADay) {
      var sdk = assignment.subjectId + '#' + day;
      score += (ctx.sectionSubjectDay[section.id][sdk] || 0) * 30;
    }
    return score;
  }

  /* ============ สร้างหน่วยที่ต้องจัด ============ */
  function buildUnits(ctx, preplacedCount) {
    var units = [];
    var electiveGroups = {};

    ctx.state.assignments.forEach(function (a) {
      var subject = ctx.subjectById[a.subjectId];
      var section = ctx.sectionById[a.classSectionId];
      if (!subject || !section || !a.teacherId) return;
      var remaining = U.num(a.periodsPerWeek) - (preplacedCount[a.id] || 0);
      if (remaining <= 0) return;

      if (subject.isElective) {
        var gkey = section.gradeLevelId + '|' + a.subjectId;
        if (!electiveGroups[gkey]) {
          electiveGroups[gkey] = {
            kind: 'elective', gradeLevelId: section.gradeLevelId,
            subjectId: a.subjectId, members: [], periods: remaining
          };
        }
        electiveGroups[gkey].members.push(a);
        electiveGroups[gkey].periods = Math.max(electiveGroups[gkey].periods, remaining);
        return;
      }

      var doubles = 0, singles = remaining;
      if (subject.doubleMode === 'STRICT' || subject.doubleMode === 'PREFERRED') {
        doubles = Math.floor(remaining / 2);
        singles = remaining % 2;
      }
      for (var d = 0; d < doubles; d++) {
        units.push({
          kind: 'double', assignment: a, size: 2,
          strict: subject.doubleMode === 'STRICT', subject: subject, section: section
        });
      }
      for (var s = 0; s < singles; s++) {
        units.push({ kind: 'single', assignment: a, size: 1, strict: false, subject: subject, section: section });
      }
    });

    Object.keys(electiveGroups).forEach(function (k) {
      var grp = electiveGroups[k];
      for (var i = 0; i < grp.periods; i++) {
        units.push({
          kind: 'elective', members: grp.members, size: 1,
          subject: ctx.subjectById[grp.subjectId], gradeLevelId: grp.gradeLevelId
        });
      }
    });

    units.forEach(function (u) {
      var score = 0;
      if (u.kind === 'elective') score += 10000 + u.members.length * 10;
      if (u.size === 2) score += 400;
      if (u.strict) score += 200;
      var subject = u.subject;
      if (subject.isCore) score += 60;
      if (u.assignment) {
        teachersOf(u.assignment).forEach(function (tid) {
          var t = ctx.teacherById[tid];
          if (t) score += (ctx.days.length - (t.availableDays || []).length) * 40;
        });
        if (u.assignment.coTeacherId) score += 80;
      }
      u.difficulty = score;
    });
    units.sort(function (a, b) { return b.difficulty - a.difficulty; });
    return units;
  }

  function isGeneralType(ctx, roomTypeId) {
    var rt = U.byId(ctx.state.roomTypes, roomTypeId);
    return !!(rt && rt.isGeneral);
  }

  /* ============ วางหน่วยลงตาราง ============ */
  function tryPlaceUnit(ctx, unit, entries, rnd) {
    var candidates = [];
    var failures = {};
    var failTexts = {};
    function noteFail(code, text) {
      failures[code] = (failures[code] || 0) + 1;
      if (text && !failTexts[code]) failTexts[code] = text;
    }

    if (unit.kind === 'elective') {
      ctx.days.forEach(function (day) {
        ctx.periodNosByDay[day].forEach(function (p) {
          var used = {};
          var placements = [];
          var ok = true;
          for (var i = 0; i < unit.members.length; i++) {
            var a = unit.members[i];
            var bad = checkSlot(ctx, a, day, p, 1, null);
            if (bad) { noteFail(bad.code, bad.text); ok = false; break; }
            var room = findRoom(ctx, a, day, [p], used, null);
            if (!room) { noteFail('R4', roomShortage(ctx, a)); ok = false; break; }
            used[room.id + '#' + key(day, p)] = true;
            placements.push({ assignment: a, room: room });
          }
          if (!ok) { noteFail('R7', 'ไม่มีคาบใดที่ทุกห้องในระดับชั้นนี้ว่างพร้อมกัน'); return; }
          var score = 0;
          placements.forEach(function (pl) { score += softScore(ctx, pl.assignment, day, [p], pl.room); });
          candidates.push({ day: day, periods: [p], placements: placements, score: score });
        });
      });
    } else if (unit.size === 2) {
      ctx.days.forEach(function (day) {
        ctx.pairsByDay[day].forEach(function (pair) {
          var a = unit.assignment;
          var bad1 = checkSlot(ctx, a, day, pair[0], 2, null);
          if (bad1) { noteFail(bad1.code, bad1.text); return; }
          var bad2 = checkSlot(ctx, a, day, pair[1], 2, null);
          if (bad2) { noteFail(bad2.code, bad2.text); return; }
          var room = findRoom(ctx, a, day, pair, null, null);
          if (!room) { noteFail('R4', roomShortage(ctx, a)); return; }
          candidates.push({
            day: day, periods: pair.slice(),
            placements: [{ assignment: a, room: room }],
            score: softScore(ctx, a, day, pair, room)
          });
        });
      });
      if (!candidates.length) noteFail('R5', 'ต้องการคาบคู่ติดกัน แต่ไม่มีช่วงเวลาที่ว่างติดกัน 2 คาบ');
    } else {
      ctx.days.forEach(function (day) {
        ctx.periodNosByDay[day].forEach(function (p) {
          var a = unit.assignment;
          var bad = checkSlot(ctx, a, day, p, 1, null);
          if (bad) { noteFail(bad.code, bad.text); return; }
          var room = findRoom(ctx, a, day, [p], null, null);
          if (!room) { noteFail('R4', roomShortage(ctx, a)); return; }
          candidates.push({
            day: day, periods: [p],
            placements: [{ assignment: a, room: room }],
            score: softScore(ctx, a, day, [p], room)
          });
        });
      });
    }

    if (!candidates.length) return { ok: false, failures: failures, failTexts: failTexts };

    candidates.sort(function (x, y) { return x.score - y.score; });
    var top = candidates.filter(function (c) { return c.score <= candidates[0].score + 1; });
    var chosen = top[Math.floor(rnd() * top.length)] || candidates[0];

    var pairGroupId = unit.size === 2 ? U.uid('pg') : '';
    chosen.placements.forEach(function (pl) {
      chosen.periods.forEach(function (p) {
        var entry = {
          id: U.uid('en'), assignmentId: pl.assignment.id, day: chosen.day, periodNo: p,
          roomId: pl.room.id, isLocked: false, isManual: false, pairGroupId: pairGroupId
        };
        entries.push(entry);
        occupy(ctx, entry);
      });
    });
    return { ok: true };
  }

  function roomShortage(ctx, assignment) {
    var subject = ctx.subjectById[assignment.subjectId];
    if (assignment.roomId && ctx.roomById[assignment.roomId]) {
      return 'ห้อง ' + ctx.roomById[assignment.roomId].name + ' ถูกใช้อยู่แล้วในคาบที่เหลือ';
    }
    return 'ไม่มีห้องว่างในคาบที่เหลือ';
  }

  /* ============ ขั้นซ่อม: ขยับคาบที่ขวางอยู่เพื่อให้คาบที่ค้างลงได้ ============ */
  function movableEntry(ctx, entry) {
    if (!entry) return false;
    if (entry.isLocked || entry.isManual || entry.pairGroupId) return false;
    var a = ctx.assignmentById[entry.assignmentId];
    if (!a) return false;
    var subject = ctx.subjectById[a.subjectId];
    return !!(subject && !subject.isElective);
  }

  function collectBlockers(ctx, assignment, day, periods) {
    var section = ctx.sectionById[assignment.classSectionId];
    var found = {};
    var list = [];
    function add(entry) { if (entry && !found[entry.id]) { found[entry.id] = true; list.push(entry); } }
    periods.forEach(function (p) {
      var k = key(day, p);
      add(ctx.sectionBusy[section.id][k]);
      teachersOf(assignment).forEach(function (tid) {
        if (ctx.teacherBusy[tid]) add(ctx.teacherBusy[tid][k]);
      });
      if (assignment.roomId && ctx.roomBusy[assignment.roomId]) add(ctx.roomBusy[assignment.roomId][k]);
    });
    return list;
  }

  function relocateEntry(ctx, entry, rnd) {
    var a = ctx.assignmentById[entry.assignmentId];
    if (!a) return false;
    var best = null, bestScore = Infinity;
    for (var d = 0; d < ctx.days.length; d++) {
      var day = ctx.days[d];
      var nos = ctx.periodNosByDay[day];
      for (var i = 0; i < nos.length; i++) {
        var p = nos[i];
        if (checkSlot(ctx, a, day, p, 1, null)) continue;
        var room = findRoom(ctx, a, day, [p], null, null);
        if (!room) continue;
        var sc = softScore(ctx, a, day, [p], room) + rnd() * 2;
        if (sc < bestScore) { bestScore = sc; best = { day: day, periodNo: p, roomId: room.id }; }
      }
    }
    if (!best) return false;
    entry.day = best.day;
    entry.periodNo = best.periodNo;
    entry.roomId = best.roomId;
    occupy(ctx, entry);
    return true;
  }

  function tryRepairUnit(ctx, unit, entries, rnd) {
    if (unit.kind === 'elective' || !unit.assignment) return false;
    var a = unit.assignment;
    var slots = [];
    ctx.days.forEach(function (d) {
      if (unit.size === 2) {
        ctx.pairsByDay[d].forEach(function (pr) { slots.push({ day: d, periods: pr.slice() }); });
      } else {
        ctx.periodNosByDay[d].forEach(function (p) { slots.push({ day: d, periods: [p] }); });
      }
    });
    slots = U.shuffle(slots, rnd);

    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var blockers = collectBlockers(ctx, a, slot.day, slot.periods);
      if (!blockers.length || blockers.length > 3) continue;
      var movable = true;
      for (var b = 0; b < blockers.length; b++) {
        if (!movableEntry(ctx, blockers[b])) { movable = false; break; }
      }
      if (!movable) continue;

      var origin = blockers.map(function (e) {
        return { entry: e, day: e.day, periodNo: e.periodNo, roomId: e.roomId, occupied: false };
      });
      blockers.forEach(function (e) { release(ctx, e); });

      var bad = null;
      for (var pi = 0; pi < slot.periods.length && !bad; pi++) {
        bad = checkSlot(ctx, a, slot.day, slot.periods[pi], unit.size, null);
      }
      var room = bad ? null : findRoom(ctx, a, slot.day, slot.periods, null, null);
      if (bad || !room) { restore(origin, ctx); continue; }

      var created = [];
      var pairGroupId = unit.size === 2 ? U.uid('pg') : '';
      slot.periods.forEach(function (p) {
        var entry = {
          id: U.uid('en'), assignmentId: a.id, day: slot.day, periodNo: p,
          roomId: room.id, isLocked: false, isManual: false, pairGroupId: pairGroupId
        };
        entries.push(entry);
        occupy(ctx, entry);
        created.push(entry);
      });

      var allMoved = true;
      for (var m = 0; m < origin.length; m++) {
        if (relocateEntry(ctx, origin[m].entry, rnd)) origin[m].occupied = true;
        else { allMoved = false; break; }
      }
      if (allMoved) return true;

      created.forEach(function (e) {
        release(ctx, e);
        var idx = entries.indexOf(e);
        if (idx >= 0) entries.splice(idx, 1);
      });
      restore(origin, ctx);
    }
    return false;
  }

  function restore(origin, ctx) {
    origin.forEach(function (o) {
      if (o.occupied) { release(ctx, o.entry); o.occupied = false; }
      o.entry.day = o.day;
      o.entry.periodNo = o.periodNo;
      o.entry.roomId = o.roomId;
      occupy(ctx, o.entry);
    });
  }

  /* ============ สาเหตุที่จัดไม่ลง ============ */
  function reasonFromFailures(unit, failures) {
    var order = ['R2', 'R1', 'R4', 'R6', 'R3', 'R5', 'R7'];
    if (unit.kind === 'elective') order = ['R7', 'R4', 'R2', 'R1', 'R3', 'R6', 'R5'];
    if (unit.size === 2) order = ['R5', 'R4', 'R2', 'R1', 'R6', 'R3', 'R7'];
    var best = null, bestCount = -1;
    Object.keys(failures).forEach(function (code) {
      var weight = failures[code] * 10 + (order.length - order.indexOf(code));
      if (weight > bestCount) { bestCount = weight; best = code; }
    });
    return best || 'R3';
  }

  function suggestionFor(code, unit, ctx) {
    var subject = unit.subject;
    switch (code) {
      case 'R1': return 'ให้เปลี่ยนครูผู้สอนของรายการนี้ เพิ่มวันที่ครูมาสอน หรือลดคาบอื่นของครูคนนี้ลง';
      case 'R2': return 'ให้เพิ่มโควตาคาบต่อวันหรือต่อสัปดาห์ของครูคนนี้ในหน้าครู หรือย้ายบางวิชาไปให้ครูคนอื่นสอน';
      case 'R3': return 'ให้เพิ่มจำนวนคาบของวันใดวันหนึ่งในหน้าตั้งค่าโรงเรียน หรือลดจำนวนคาบของวิชาอื่นในหลักสูตรของห้องนี้';
      case 'R4': return 'ให้เพิ่มห้องในหน้าอาคารและห้อง ลดจำนวนคาบของวิชานี้ หรือเลือกห้องอื่นให้วิชานี้ในหน้าจัดครูผู้สอน';
      case 'R5': return 'ให้เปลี่ยนวิชานี้เป็นคาบคู่แบบแยกได้ ลดจำนวนคาบลง หรือเพิ่มจำนวนคาบต่อวันให้มีช่วงติดกันมากขึ้น';
      case 'R6': return 'ให้ไปที่หน้าเงื่อนไขและล็อกคาบ แล้วปลดล็อกบางคาบเพื่อคืนช่องว่างให้ระบบจัด';
      case 'R7': return 'ให้ลดจำนวนห้องเรียนในระดับชั้นนี้ที่เรียนวิชาเลือกพร้อมกัน เพิ่มครูผู้สอนวิชาเลือก หรือเพิ่มจำนวนคาบต่อวัน';
      default: return 'ให้ตรวจข้อมูลต้นทางของรายการนี้อีกครั้ง';
    }
  }

  function roomTypeName(ctx, roomTypeId) {
    var rt = U.byId(ctx.state.roomTypes, roomTypeId);
    return rt ? rt.name : 'ที่ต้องใช้';
  }

  /* ============ ตรวจกฎรองหลังจัดเสร็จ ============ */
  function collectSoftIssues(state, entries) {
    var ctx = buildContext(state);
    var issues = [];
    var subjectById = ctx.subjectById;
    var assignmentById = ctx.assignmentById;

    if (weightOf(ctx, 'S1')) {
      entries.forEach(function (e) {
        var a = assignmentById[e.assignmentId];
        if (!a) return;
        var subject = subjectById[a.subjectId];
        var section = ctx.sectionById[a.classSectionId];
        if (!subject || !section || !subject.isCore) return;
        if (e.periodNo > ctx.morningEnd) {
          issues.push({
            id: U.uid('is'), type: 'SOFT_VIOLATION', severity: 'MEDIUM',
            assignmentId: a.id, ruleCode: 'S1', entryId: e.id,
            message: section.name + ' ' + subject.name + ' วัน' + U.DAY_NAMES[e.day] + ' คาบ ' + e.periodNo,
            suggestion: 'ลากย้ายคาบนี้ไปช่วงเช้า หากมีช่องว่างที่ไม่ชนกับวิชาอื่น'
          });
        }
      });
    }

    if (weightOf(ctx, 'S2')) {
      var bySection = {};
      entries.forEach(function (e) {
        var a = assignmentById[e.assignmentId];
        if (!a) return;
        if (!bySection[a.classSectionId]) bySection[a.classSectionId] = {};
        bySection[a.classSectionId][key(e.day, e.periodNo)] = e;
      });
      Object.keys(bySection).forEach(function (sectionId) {
        var section = ctx.sectionById[sectionId];
        ctx.days.forEach(function (day) {
          var nos = ctx.periodNosByDay[day];
          for (var i = 0; i < nos.length - 1; i++) {
            var p1 = nos[i], p2 = nos[i + 1];
            if (p2 !== p1 + 1) continue;
            var e1 = bySection[sectionId][key(day, p1)];
            var e2 = bySection[sectionId][key(day, p2)];
            if (!e1 || !e2) continue;
            var r1 = ctx.roomById[e1.roomId], r2 = ctx.roomById[e2.roomId];
            var dist = M.walkDistance(state, r1, r2);
            if (dist <= 0) continue;
            issues.push({
              id: U.uid('is'), type: 'SOFT_VIOLATION', severity: dist >= 3 ? 'MEDIUM' : 'LOW',
              ruleCode: 'S2', entryId: e2.id, assignmentId: e2.assignmentId,
              message: section.name + ' วัน' + U.DAY_NAMES[day] + ' คาบ ' + p1 + ' → ' + p2 + ' ' +
                M.walkText(state, r1, r2),
              suggestion: 'สลับคาบให้วิชาที่ใช้ห้องพิเศษอยู่ติดกัน หรือย้ายไปคาบแรกของช่วงเช้าหรือช่วงบ่าย'
            });
          }
        });
      });
    }

    if (weightOf(ctx, 'S3')) {
      var byAssignment = {};
      entries.forEach(function (e) {
        if (!byAssignment[e.assignmentId]) byAssignment[e.assignmentId] = [];
        byAssignment[e.assignmentId].push(e);
      });
      Object.keys(byAssignment).forEach(function (aid) {
        var a = assignmentById[aid];
        if (!a) return;
        var subject = subjectById[a.subjectId];
        if (!subject || subject.doubleMode !== 'PREFERRED') return;
        var list = byAssignment[aid];
        var paired = list.filter(function (e) { return e.pairGroupId; }).length;
        if (paired < Math.floor(list.length / 2) * 2) {
          var section = ctx.sectionById[a.classSectionId];
          issues.push({
            id: U.uid('is'), type: 'SOFT_VIOLATION', severity: 'LOW',
            ruleCode: 'S3', assignmentId: a.id,
            message: (section ? section.name : '-') + ' ' + subject.name + ' ถูกจัดเป็นคาบเดี่ยวแทนคาบคู่',
            suggestion: 'ลากคาบทั้งสองให้มาอยู่ติดกันในวันเดียวกัน หากมีช่องว่างเหลือ'
          });
        }
      });
    }

    if (weightOf(ctx, 'S4')) {
      var dayCount = {};
      entries.forEach(function (e) {
        var a = assignmentById[e.assignmentId];
        if (!a) return;
        teachersOf(a).forEach(function (tid) {
          if (!dayCount[tid]) dayCount[tid] = {};
          dayCount[tid][e.day] = (dayCount[tid][e.day] || 0) + 1;
        });
      });
      Object.keys(dayCount).forEach(function (tid) {
        var t = ctx.teacherById[tid];
        if (!t) return;
        var counts = (t.availableDays || ctx.days).map(function (d) { return dayCount[tid][d] || 0; });
        if (!counts.length) return;
        var max = Math.max.apply(null, counts);
        var min = Math.min.apply(null, counts);
        if (max - min >= 4) {
          issues.push({
            id: U.uid('is'), type: 'SOFT_VIOLATION', severity: 'LOW', ruleCode: 'S4',
            message: 'ครู' + t.name + ' มีคาบมากที่สุด ' + max + ' คาบในวันเดียว แต่บางวันมีเพียง ' + min + ' คาบ',
            suggestion: 'ลากบางคาบของครูคนนี้ไปวันที่มีคาบน้อยกว่า'
          });
        }
      });
    }

    return issues;
  }

  /* ============ ฟังก์ชันหลัก: จัดตารางอัตโนมัติ ============ */
  /* ---- คะแนนรวมของกฎรอง (ยิ่งน้อยยิ่งดี) ใช้เทียบผลแต่ละรอบ ---- */
  function softObjective(state, entries) {
    var conditions = state.conditions || global.ST.store.defaultConditions();
    function w(code) {
      var r = conditions.rules && conditions.rules[code];
      return (r && r.enabled) ? (WEIGHT_VALUE[r.weight] || 1) : 0;
    }
    var sevW = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    var total = 0;
    collectSoftIssues(state, entries).forEach(function (i) {
      if (i.type !== 'SOFT_VIOLATION') return;
      total += (w(i.ruleCode) || 1) * (sevW[i.severity] || 1);
    });
    return total;
  }

  /* ---- สร้างตารางหนึ่งชุดจากต้นจนจบด้วยเมล็ดสุ่มที่กำหนด (ทำงานแบบซิงโครนัส) ---- */
  function constructAttempt(state, opts, seed) {
    var rnd = U.makeRandom(seed);
    var ctx = buildContext(state);
    var entries = [];
    var preplacedCount = {};
    var pinProblems = [];

    /* ขั้นที่ 0 : วางคาบที่ผู้ใช้ปักหมุดวิชาไว้ก่อน (ห้ามขยับ) */
    M.pinnedLocks(state).forEach(function (lock) {
      var a = ctx.assignmentById[lock.assignmentId];
      if (!a || !a.teacherId) return;
      var bad = checkSlot(ctx, a, lock.day, lock.periodNo, 1, null);
      var room = bad ? null : findRoom(ctx, a, lock.day, [lock.periodNo], null, null);
      if (bad || !room) {
        pinProblems.push({ lock: lock, assignment: a, reason: bad ? bad.text : roomShortage(ctx, a) });
        return;
      }
      var entry = {
        id: U.uid('en'), assignmentId: a.id, day: lock.day, periodNo: lock.periodNo,
        roomId: room.id, isLocked: true, isManual: false, pairGroupId: '', lockId: lock.id
      };
      entries.push(entry);
      occupy(ctx, entry);
      preplacedCount[a.id] = (preplacedCount[a.id] || 0) + 1;
    });

    /* คงคาบที่ผู้ใช้ล็อกหรือปรับเองไว้ (ถ้าเลือกไว้) */
    if (opts.preserveEntries && opts.preserveEntries.length) {
      opts.preserveEntries.forEach(function (e) {
        if (e.lockId) return;                       /* คาบปักหมุดวางไปแล้วในขั้นที่ 0 */
        var a = ctx.assignmentById[e.assignmentId];
        if (!a) return;
        if ((preplacedCount[a.id] || 0) >= U.num(a.periodsPerWeek)) return;
        if (checkSlot(ctx, a, e.day, e.periodNo, 1, null)) return;
        var copy = {
          id: U.uid('en'), assignmentId: e.assignmentId, day: e.day, periodNo: e.periodNo,
          roomId: e.roomId, isLocked: !!e.isLocked, isManual: !!e.isManual,
          pairGroupId: e.pairGroupId || ''
        };
        entries.push(copy);
        occupy(ctx, copy);
        preplacedCount[a.id] = (preplacedCount[a.id] || 0) + 1;
      });
    }

    var units = buildUnits(ctx, preplacedCount);
    var unplaced = [];
    units.forEach(function (unit) {
      var res = tryPlaceUnit(ctx, unit, entries, rnd);
      if (!res.ok) unplaced.push({ unit: unit, failures: res.failures, failTexts: res.failTexts });
    });

    /* ขั้นซ่อม : ขยับคาบที่ขวางอยู่เพื่อให้คาบที่ค้างลงได้ */
    if (unplaced.length) {
      var remaining = [];
      unplaced.forEach(function (item) {
        if (!tryRepairUnit(ctx, item.unit, entries, rnd)) remaining.push(item);
      });
      unplaced = remaining;
    }

    return { ctx: ctx, entries: entries, unplaced: unplaced, pinProblems: pinProblems };
  }

  /* ---- แปลงผลที่ดีที่สุดเป็นรายงานปัญหา ---- */
  function buildIssues(ctx, unplaced, pinProblems, entries, state) {
    var issues = [];
    var grouped = {};
    unplaced.forEach(function (item) {
      var unit = item.unit;
      if (unit.kind === 'elective') {
        unit.members.forEach(function (a) {
          pushUnplaced(grouped, a, unit, item.failures, unit.size, item.failTexts);
        });
      } else {
        pushUnplaced(grouped, unit.assignment, unit, item.failures, unit.size, item.failTexts);
      }
    });
    Object.keys(grouped).forEach(function (aid) {
      var g = grouped[aid];
      var code = reasonFromFailures(g.unit, g.failures);
      var section = ctx.sectionById[g.assignment.classSectionId];
      var subject = ctx.subjectById[g.assignment.subjectId];
      var teacher = ctx.teacherById[g.assignment.teacherId];
      issues.push({
        id: U.uid('is'), type: 'UNPLACED', severity: 'HIGH',
        assignmentId: g.assignment.id, ruleCode: 'H0', reasonCode: code,
        remainingPeriods: g.count,
        message: g.texts[code] || REASON_TEXT[code],
        suggestion: suggestionFor(code, g.unit, ctx),
        context: {
          sectionName: section ? section.name : '-',
          subjectName: subject ? subject.name : '-',
          teacherName: teacher ? teacher.name : '-'
        }
      });
    });

    pinProblems.forEach(function (p) {
      var section = ctx.sectionById[p.assignment.classSectionId];
      var subject = ctx.subjectById[p.assignment.subjectId];
      issues.push({
        id: U.uid('is'), type: 'UNPLACED', severity: 'HIGH',
        assignmentId: p.assignment.id, ruleCode: 'H7', reasonCode: 'R6',
        remainingPeriods: 1,
        message: 'คาบที่ปักหมุดไว้วัน' + U.DAY_NAMES[p.lock.day] + ' คาบ ' + p.lock.periodNo +
          ' วางไม่ได้ เพราะ' + p.reason,
        suggestion: 'ให้ไปที่หน้าเงื่อนไขและล็อกคาบ แล้วย้ายหมุดของวิชานี้ไปช่องอื่นที่ว่าง',
        context: {
          sectionName: section ? section.name : '-',
          subjectName: subject ? subject.name : '-',
          teacherName: (ctx.teacherById[p.assignment.teacherId] || {}).name || '-'
        }
      });
    });

    return issues.concat(collectSoftIssues(state, entries));
  }

  /* ============================================================
     ฟังก์ชันหลัก: จัดตารางอัตโนมัติ
     จัดหลายรอบด้วยเมล็ดสุ่มต่างกัน เก็บผลที่ดีที่สุด (คาบค้างน้อยสุดก่อน
     แล้วจึงกฎรองน้อยสุด) จากนั้นปรับให้ดีขึ้นอีกขั้นก่อนส่งผล
     ============================================================ */
  function generate(state, options) {
    var opts = options || {};
    var onProgress = opts.onProgress || function () { };
    var shouldStop = opts.shouldStop || function () { return false; };
    var startTime = Date.now();
    var baseSeed = (opts.seed || (Date.now() % 100000) + 7) >>> 0;

    var maxAttempts = opts.restarts != null ? Math.max(1, opts.restarts) : 6;
    var timeBudget = opts.timeBudgetMs != null ? opts.timeBudgetMs : 6000;
    var doOptimize = opts.optimize !== false;

    var totalRequired = state.assignments.reduce(function (sum, a) {
      return sum + (a.teacherId ? U.num(a.periodsPerWeek) : 0);
    }, 0);

    return new Promise(function (resolve) {
      var best = null, bestUnplaced = Infinity, bestSoft = Infinity;
      var attemptNo = 0;
      var stopped = false;

      function finalize() {
        if (!best) {
          resolve({
            stopped: stopped, entries: [], issues: [],
            stats: { totalRequired: totalRequired, placed: 0, unplaced: totalRequired, softViolations: 0 },
            elapsedMs: Date.now() - startTime
          });
          return;
        }
        var issues = buildIssues(best.ctx, best.unplaced, best.pinProblems, best.entries, state);
        resolve({
          stopped: stopped,
          entries: best.entries,
          issues: issues,
          attempts: attemptNo,
          stats: {
            totalRequired: totalRequired,
            placed: best.entries.length,
            unplaced: Math.max(0, totalRequired - best.entries.length),
            softViolations: issues.filter(function (i) { return i.type === 'SOFT_VIOLATION'; }).length
          },
          elapsedMs: Date.now() - startTime
        });
      }

      function runOptimize() {
        if (shouldStop()) { stopped = true; finalize(); return; }
        if (doOptimize && best && best.entries.length) {
          onProgress({
            done: maxAttempts, total: maxAttempts, percent: 92,
            message: 'กำลังปรับตารางให้ดีขึ้น ลดคาบที่ต้องเดินไกลและวิชาหลักที่ตกช่วงบ่าย'
          });
          var optRes = optimizeEntries(state, best.entries, {
            timeBudgetMs: opts.optimizeMs != null ? opts.optimizeMs : 1800,
            seed: baseSeed + 101
          });
          best.entries = optRes.entries;
        }
        onProgress({ done: maxAttempts, total: maxAttempts, percent: 100, message: 'จัดตารางเสร็จแล้ว' });
        finalize();
      }

      function loop() {
        if (shouldStop()) { stopped = true; finalize(); return; }
        var res = constructAttempt(state, opts, baseSeed + attemptNo * 7919 + 1);
        attemptNo++;
        var unplacedPeriods = Math.max(0, totalRequired - res.entries.length);
        var soft = softObjective(state, res.entries);
        var better = !best || unplacedPeriods < bestUnplaced ||
          (unplacedPeriods === bestUnplaced && soft < bestSoft);
        if (better) { best = res; bestUnplaced = unplacedPeriods; bestSoft = soft; }

        onProgress({
          done: attemptNo, total: maxAttempts,
          percent: Math.min(88, Math.round((attemptNo / maxAttempts) * 88)),
          message: 'จัดตารางรอบที่ ' + U.fmtNum(attemptNo) + ' จาก ' + U.fmtNum(maxAttempts) +
            ' · ผลดีที่สุดตอนนี้: ค้าง ' + U.fmtNum(bestUnplaced) + ' คาบ'
        });

        var timeUp = (Date.now() - startTime) > timeBudget;
        var perfect = bestUnplaced === 0 && bestSoft === 0;
        if (attemptNo < maxAttempts && !timeUp && !perfect) U.nextFrame().then(loop);
        else U.nextFrame().then(runOptimize);
      }

      onProgress({ done: 0, total: maxAttempts, percent: 0, message: 'กำลังเตรียมข้อมูลและตรวจเงื่อนไข' });
      U.nextFrame().then(loop);
    });
  }

  /* ============================================================
     ปรับตารางให้ดีขึ้น (local search)
     ย้ายเฉพาะคาบเดี่ยวที่ระบบจัดเอง (ไม่แตะคาบล็อก ปักหมุด คาบคู่
     วิชาเลือกเสรี หรือคาบที่ผู้ใช้ลากปรับเอง) ไปช่องที่คะแนนกฎรองต่ำกว่า
     โดยไม่ทำให้เกิดการชนกฎห้ามผิด และไม่ทำให้มีคาบค้างเพิ่ม
     ============================================================ */
  function movableForOptimize(ctx, entry) {
    if (!entry) return false;
    if (entry.isLocked || entry.isManual || entry.lockId || entry.pairGroupId) return false;
    var a = ctx.assignmentById[entry.assignmentId];
    if (!a) return false;
    var subject = ctx.subjectById[a.subjectId];
    return !!(subject && !subject.isElective);
  }

  function optimizeEntries(state, baseEntries, options) {
    var opts = options || {};
    var deadline = Date.now() + (opts.timeBudgetMs != null ? opts.timeBudgetMs : 1500);
    var maxSweeps = opts.maxSweeps != null ? opts.maxSweeps : 12;
    var rnd = U.makeRandom((opts.seed || 20260904) >>> 0);

    var ctx = buildContext(state);
    var entries = baseEntries.map(function (e) {
      return {
        id: e.id, assignmentId: e.assignmentId, day: e.day, periodNo: e.periodNo,
        roomId: e.roomId, isLocked: !!e.isLocked, isManual: !!e.isManual,
        pairGroupId: e.pairGroupId || '', lockId: e.lockId || undefined
      };
    });
    entries.forEach(function (e) { occupy(ctx, e); });

    var movers = entries.filter(function (e) { return movableForOptimize(ctx, e); });
    var before = softObjective(state, baseEntries);
    var moved = 0, swapped = 0, sweeps = 0;

    /* ---- ย้ายคาบไปช่องว่างที่คะแนนต่ำกว่า ---- */
    function relocatePass(order) {
      var improved = 0;
      for (var i = 0; i < order.length; i++) {
        if ((i & 31) === 0 && Date.now() > deadline) break;
        var e = order[i];
        var a = ctx.assignmentById[e.assignmentId];
        if (!a) continue;
        release(ctx, e);
        var curRoom = ctx.roomById[e.roomId];
        var curCost = curRoom ? softScore(ctx, a, e.day, [e.periodNo], curRoom) : Infinity;
        var best = { day: e.day, periodNo: e.periodNo, roomId: e.roomId, cost: curCost };
        for (var d = 0; d < ctx.days.length; d++) {
          var day = ctx.days[d];
          var nos = ctx.periodNosByDay[day];
          for (var n = 0; n < nos.length; n++) {
            var p = nos[n];
            if (day === e.day && p === e.periodNo) continue;
            if (checkSlot(ctx, a, day, p, 1, null)) continue;
            var room = findRoom(ctx, a, day, [p], null, null);
            if (!room) continue;
            var cost = softScore(ctx, a, day, [p], room);
            if (cost < best.cost - 1e-9) { best = { day: day, periodNo: p, roomId: room.id, cost: cost }; }
          }
        }
        e.day = best.day; e.periodNo = best.periodNo; e.roomId = best.roomId;
        occupy(ctx, e);
        if (best.cost < curCost - 1e-9) improved++;
      }
      return improved;
    }

    /* ---- สลับสองคาบเข้าหากันเมื่อคะแนนรวมลดลง (ช่วยเมื่อกริดเต็มไม่มีช่องว่าง) ---- */
    function swapPass(order) {
      var improved = 0;
      var TRIES = 10;
      for (var i = 0; i < order.length; i++) {
        if ((i & 15) === 0 && Date.now() > deadline) break;
        var e = order[i];
        var aE = ctx.assignmentById[e.assignmentId];
        if (!aE) continue;
        release(ctx, e);
        var roomEHere = ctx.roomById[e.roomId];
        var eCostHere = roomEHere ? softScore(ctx, aE, e.day, [e.periodNo], roomEHere) : 0;
        var eDay = e.day, eP = e.periodNo, eRoom = e.roomId;
        var didSwap = false;
        for (var t = 0; t < TRIES && !didSwap; t++) {
          var f = order[Math.floor(rnd() * order.length)];
          if (!f || f === e) continue;
          if (f.day === eDay && f.periodNo === eP) continue;
          var aF = ctx.assignmentById[f.assignmentId];
          if (!aF) continue;
          release(ctx, f);
          var roomFHere = ctx.roomById[f.roomId];
          var fCostHere = roomFHere ? softScore(ctx, aF, f.day, [f.periodNo], roomFHere) : 0;
          var oldCost = eCostHere + fCostHere;
          var fDay = f.day, fP = f.periodNo;
          var okE = !checkSlot(ctx, aE, fDay, fP, 1, null);
          var roomE = okE ? findRoom(ctx, aE, fDay, [fP], null, null) : null;
          var okF = !checkSlot(ctx, aF, eDay, eP, 1, null);
          var roomF = okF ? findRoom(ctx, aF, eDay, [eP], null, null) : null;
          if (roomE && roomF) {
            var newCost = softScore(ctx, aE, fDay, [fP], roomE) + softScore(ctx, aF, eDay, [eP], roomF);
            if (newCost < oldCost - 1e-9) {
              e.day = fDay; e.periodNo = fP; e.roomId = roomE.id;
              f.day = eDay; f.periodNo = eP; f.roomId = roomF.id;
              occupy(ctx, e); occupy(ctx, f);
              improved++; didSwap = true;
              break;
            }
          }
          occupy(ctx, f);            /* คืน f กลับที่เดิม */
        }
        if (!didSwap) { e.day = eDay; e.periodNo = eP; e.roomId = eRoom; occupy(ctx, e); }
      }
      return improved;
    }

    while (sweeps < maxSweeps && Date.now() < deadline) {
      sweeps++;
      var order = U.shuffle(movers, rnd);
      var r = relocatePass(order);
      var s = (Date.now() < deadline) ? swapPass(U.shuffle(movers, rnd)) : 0;
      moved += r; swapped += s;
      if (r + s === 0) break;
    }

    return {
      entries: entries, sweeps: sweeps, moved: moved, swapped: swapped,
      before: before, after: softObjective(state, entries)
    };
  }

  function pushUnplaced(grouped, assignment, unit, failures, size, texts) {
    if (!assignment) return;
    if (!grouped[assignment.id]) {
      grouped[assignment.id] = { assignment: assignment, unit: unit, failures: {}, count: 0, texts: {} };
    }
    var g = grouped[assignment.id];
    g.count += size;
    Object.keys(failures).forEach(function (code) {
      g.failures[code] = (g.failures[code] || 0) + failures[code];
    });
    Object.keys(texts || {}).forEach(function (code) {
      if (!g.texts[code]) g.texts[code] = texts[code];
    });
  }

  /* ============ ตรวจก่อนลากวาง ============ */
  function prepareMove(state, timetable, movingEntries) {
    var ctx = buildContext(state);
    timetable.entries.forEach(function (e) { occupy(ctx, e); });
    movingEntries.forEach(function (e) { release(ctx, e); });
    var ignore = {};
    movingEntries.forEach(function (e) { ignore[e.id] = true; });
    return { ctx: ctx, ignore: ignore, moving: movingEntries };
  }

  function checkMoveTarget(prep, targetDay, targetStartPeriod) {
    var ctx = prep.ctx;
    var movingEntries = prep.moving;
    var periodNos = ctx.periodNosByDay[targetDay] || [];
    var startIndex = periodNos.indexOf(targetStartPeriod);
    if (startIndex === -1) {
      return {
        ok: false,
        cause: 'วัน' + U.DAY_NAMES[targetDay] + ' ไม่มีคาบ ' + targetStartPeriod + ' หรือคาบนี้เป็นคาบพัก',
        fix: 'ให้เลือกช่องที่เป็นคาบเรียนของวันนั้น หรือแก้ผังคาบในหน้าตั้งค่าโรงเรียน'
      };
    }
    var targets = [];
    for (var i = 0; i < movingEntries.length; i++) {
      var p = periodNos[startIndex + i];
      if (p === undefined || (i > 0 && p !== targets[i - 1] + 1)) {
        return {
          ok: false,
          cause: 'คาบคู่ต้องอยู่ติดกันในวันเดียวกันและห้ามคร่อมคาบพักกลางวัน แต่ช่องปลายทางไม่มีคาบว่างติดกันพอ',
          fix: 'ให้ลากไปวางที่ช่องซึ่งมีคาบติดกัน 2 คาบในวันเดียวกัน และไม่คร่อมคาบพัก'
        };
      }
      targets.push(p);
    }

    var assignment = ctx.assignmentById[movingEntries[0].assignmentId];
    if (!assignment) {
      return { ok: false, cause: 'ไม่พบข้อมูลการมอบหมายสอนของคาบนี้', fix: 'ให้กลับไปตรวจที่หน้าจัดครูผู้สอน' };
    }
    if (movingEntries.some(function (e) { return e.lockId; })) {
      return {
        ok: false,
        cause: 'คาบนี้ถูกปักหมุดไว้ในหน้าเงื่อนไขและล็อกคาบ จึงย้ายจากตารางโดยตรงไม่ได้',
        fix: 'ให้ไปที่หน้าเงื่อนไขและล็อกคาบ แล้วย้ายหมุดของวิชานี้ไปช่องที่ต้องการ'
      };
    }
    var subject = ctx.subjectById[assignment.subjectId];
    if (subject && subject.isElective) {
      return {
        ok: false,
        cause: 'วิชาเลือกเสรีต้องเรียนพร้อมกันทั้งระดับชั้น การย้ายเพียงห้องเดียวจะทำให้นักเรียนเข้าห้องที่เลือกไม่ได้',
        fix: 'ให้กดจัดตารางอัตโนมัติใหม่ หรือปรับจำนวนคาบของวิชาเลือกในหลักสูตรแทน'
      };
    }

    for (var j = 0; j < targets.length; j++) {
      var bad = checkSlot(ctx, assignment, targetDay, targets[j], movingEntries.length, prep.ignore);
      if (bad) return { ok: false, cause: bad.text, fix: fixTextFor(bad.code) };
    }
    var room = findRoom(ctx, assignment, targetDay, targets, null, prep.ignore);
    if (!room) {
      return {
        ok: false,
        cause: 'ไม่มีห้องว่างในช่องที่ลากไปวาง',
        fix: 'ให้เลือกช่องอื่นที่ห้องว่าง หรือเพิ่มห้องในหน้าอาคารและห้อง'
      };
    }

    var warnings = [];
    targets.forEach(function (p) {
      if (weightOf(ctx, 'S1') && subject.isCore && p > ctx.morningEnd) {
        warnings.push('วิชา' + subject.name + ' เป็นวิชาหลัก การย้ายไปคาบ ' + p +
          ' จะทำให้ตกไปอยู่ช่วงบ่าย ซึ่งขัดกับเงื่อนไขวิชาหลักควรอยู่ช่วงเช้า');
      }
      if (weightOf(ctx, 'S2')) {
        [-1, 1].forEach(function (delta) {
          var neighbor = ctx.sectionBusy[assignment.classSectionId][key(targetDay, p + delta)];
          if (!neighbor || !neighbor.roomId) return;
          var nRoom = ctx.roomById[neighbor.roomId];
          if (M.walkDistance(ctx.state, nRoom, room) > 0) {
            warnings.push('คาบที่ติดกันจะ' + M.walkText(ctx.state, nRoom, room));
          }
        });
      }
    });

    return { ok: true, targets: targets, roomId: room.id, warnings: warnings };
  }

  function validateMove(state, timetable, movingEntries, targetDay, targetStartPeriod) {
    return checkMoveTarget(prepareMove(state, timetable, movingEntries), targetDay, targetStartPeriod);
  }

  function fixTextFor(code) {
    switch (code) {
      case 'R1': return 'ให้เลือกช่องอื่นที่ครูว่าง หรือกลับไปแก้วันที่ครูมาสอนในหน้าครู';
      case 'R2': return 'ให้เลือกช่องในวันที่ครูยังมีคาบเหลือ หรือเพิ่มโควตาของครูคนนี้ในหน้าครู';
      case 'R3': return 'ให้ย้ายวิชาที่อยู่ในช่องนั้นออกก่อน แล้วจึงลากคาบนี้เข้าไปแทน';
      case 'R4': return 'ให้เลือกช่องอื่นที่ห้องว่าง หรือเพิ่มห้องในหน้าอาคารและห้อง';
      case 'R6': return 'ให้ไปที่หน้าเงื่อนไขและล็อกคาบเพื่อปลดล็อกก่อน แล้วจึงลากใหม่';
      default: return 'ให้เลือกช่องอื่นที่ว่างและไม่ขัดกับเงื่อนไข';
    }
  }

  /* ============ ตรวจผลลัพธ์ทั้งตาราง (ใช้ตรวจรับงาน) ============ */
  function auditHardRules(state, entries) {
    var ctx = buildContext(state);
    var violations = [];
    var seenTeacher = {}, seenSection = {}, seenRoom = {};

    entries.forEach(function (e) {
      var a = ctx.assignmentById[e.assignmentId];
      if (!a) { violations.push({ rule: 'DATA', message: 'พบคาบที่ไม่มีการมอบหมายสอนรองรับ' }); return; }
      var k = key(e.day, e.periodNo);
      if (!ctx.slotSet[k]) {
        violations.push({ rule: 'SLOT', message: 'มีวิชาถูกจัดลงคาบพักหรือคาบที่วันนั้นไม่มี' });
      }
      var sk = a.classSectionId + '#' + k;
      if (seenSection[sk]) violations.push({ rule: 'H2', message: 'ชั้นเรียนซ้อนเวลา' });
      seenSection[sk] = true;
      var rk = e.roomId + '#' + k;
      if (seenRoom[rk]) violations.push({ rule: 'H3', message: 'ห้องสถานที่ซ้อนเวลา' });
      seenRoom[rk] = true;
      teachersOf(a).forEach(function (tid) {
        var tk = tid + '#' + k;
        if (seenTeacher[tk]) violations.push({ rule: 'H1', message: 'ครูซ้อนเวลา' });
        seenTeacher[tk] = true;
        var t = ctx.teacherById[tid];
        if (t && (t.availableDays || []).indexOf(e.day) === -1) {
          violations.push({ rule: 'H5', message: 'ครูถูกจัดในวันที่ไม่ได้มาสอน' });
        }
      });
      if (ctx.locks.section[a.classSectionId] && ctx.locks.section[a.classSectionId][k]) {
        violations.push({ rule: 'H7', message: 'มีวิชาถูกจัดทับคาบที่ล็อกไว้' });
      }
    });

    /* H7 — คาบที่ปักหมุดวิชาไว้ต้องอยู่ตรงตำแหน่งที่ปักไว้ */
    M.pinnedLocks(state).forEach(function (lock) {
      var found = entries.filter(function (e) {
        return e.assignmentId === lock.assignmentId && e.day === lock.day && e.periodNo === lock.periodNo;
      }).length;
      if (!found) violations.push({ rule: 'H7', message: 'คาบที่ปักหมุดไว้ไม่อยู่ตำแหน่งเดิม' });
    });

    /* H6 */
    var dayCount = {}, weekCount = {};
    entries.forEach(function (e) {
      var a = ctx.assignmentById[e.assignmentId];
      if (!a) return;
      teachersOf(a).forEach(function (tid) {
        if (!dayCount[tid]) dayCount[tid] = {};
        dayCount[tid][e.day] = (dayCount[tid][e.day] || 0) + 1;
        weekCount[tid] = (weekCount[tid] || 0) + 1;
      });
    });
    Object.keys(weekCount).forEach(function (tid) {
      var t = ctx.teacherById[tid];
      if (!t) return;
      if (weekCount[tid] > U.num(t.maxPeriodsPerWeek)) {
        violations.push({ rule: 'H6', message: 'ครู ' + t.name + ' เกินโควตาต่อสัปดาห์' });
      }
      Object.keys(dayCount[tid]).forEach(function (d) {
        if (dayCount[tid][d] > U.num(t.maxPeriodsPerDay)) {
          violations.push({ rule: 'H6', message: 'ครู ' + t.name + ' เกินโควตาต่อวัน' });
        }
      });
    });

    /* H4 — วิชาเลือกเสรีต้องพร้อมกันทั้งระดับชั้น */
    var electiveSlots = {};
    entries.forEach(function (e) {
      var a = ctx.assignmentById[e.assignmentId];
      if (!a) return;
      var subject = ctx.subjectById[a.subjectId];
      var section = ctx.sectionById[a.classSectionId];
      if (!subject || !subject.isElective || !section) return;
      var gk = section.gradeLevelId + '|' + subject.id;
      if (!electiveSlots[gk]) electiveSlots[gk] = {};
      if (!electiveSlots[gk][section.id]) electiveSlots[gk][section.id] = [];
      electiveSlots[gk][section.id].push(key(e.day, e.periodNo));
    });
    Object.keys(electiveSlots).forEach(function (gk) {
      var perSection = electiveSlots[gk];
      var sectionIds = Object.keys(perSection);
      if (!sectionIds.length) return;
      var reference = perSection[sectionIds[0]].slice().sort().join(',');
      sectionIds.forEach(function (sid) {
        if (perSection[sid].slice().sort().join(',') !== reference) {
          violations.push({ rule: 'H4', message: 'วิชาเลือกเสรีไม่ได้อยู่คาบเดียวกันทั้งระดับชั้น' });
        }
      });
    });

    /* H8 — คาบคู่ */
    var pairGroups = {};
    entries.forEach(function (e) {
      if (!e.pairGroupId) return;
      if (!pairGroups[e.pairGroupId]) pairGroups[e.pairGroupId] = [];
      pairGroups[e.pairGroupId].push(e);
    });
    Object.keys(pairGroups).forEach(function (pg) {
      var list = pairGroups[pg];
      if (list.length !== 2) { violations.push({ rule: 'H8', message: 'คาบคู่ไม่ครบ 2 คาบ' }); return; }
      if (list[0].day !== list[1].day || Math.abs(list[0].periodNo - list[1].periodNo) !== 1) {
        violations.push({ rule: 'H8', message: 'คาบคู่ไม่ได้อยู่ติดกันในวันเดียวกัน' });
      }
      var lo = Math.min(list[0].periodNo, list[1].periodNo);
      var hi = Math.max(list[0].periodNo, list[1].periodNo);
      var pLo = M.periodByNo(state, list[0].day, lo);
      var pHi = M.periodByNo(state, list[0].day, hi);
      if (!pLo || !pHi || pLo.isBreak || pHi.isBreak) {
        violations.push({ rule: 'H8', message: 'คาบคู่คร่อมคาบพัก' });
      }
    });

    var strictCount = {};
    entries.forEach(function (e) {
      var a = ctx.assignmentById[e.assignmentId];
      if (!a) return;
      var subject = ctx.subjectById[a.subjectId];
      if (!subject || subject.doubleMode !== 'STRICT') return;
      if (!strictCount[a.id]) strictCount[a.id] = { total: 0, paired: 0, pinned: 0 };
      strictCount[a.id].total++;
      if (e.pairGroupId) strictCount[a.id].paired++;
      if (e.lockId) strictCount[a.id].pinned++;
    });
    Object.keys(strictCount).forEach(function (aid) {
      var c = strictCount[aid];
      if (c.total - c.paired - c.pinned > 1) {
        violations.push({ rule: 'H8', message: 'วิชาคาบคู่ห้ามแยกมีคาบเดี่ยวเหลือมากกว่า 1 คาบ' });
      }
    });

    return violations;
  }

  global.ST.scheduler = {
    buildContext: buildContext,
    generate: generate,
    optimize: optimizeEntries,
    softObjective: softObjective,
    validateMove: validateMove,
    prepareMove: prepareMove,
    checkMoveTarget: checkMoveTarget,
    collectSoftIssues: collectSoftIssues,
    auditHardRules: auditHardRules,
    teachersOf: teachersOf,
    occupy: occupy,
    release: release,
    weightOf: weightOf,
    SOFT_LABEL: SOFT_LABEL,
    REASON_TEXT: REASON_TEXT,
    WEIGHT_VALUE: WEIGHT_VALUE
  };
})(typeof window !== 'undefined' ? window : globalThis);
