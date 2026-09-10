/* ============================================================
   SchoolTable — model.js
   ข้อมูลที่คำนวณต่อจากข้อมูลดิบ และการตรวจความถูกต้อง
   ============================================================ */
(function (global) {
  'use strict';

  var U = global.ST.util;

  /* ---------- ผังคาบ (แต่ละวันมีจำนวนคาบไม่เท่ากันได้) ---------- */
  function periodsOfDay(state, day) {
    var plan = state.periodConfig.dayPlans[day];
    return plan && Array.isArray(plan.periods) ? plan.periods : [];
  }

  function teachingPeriods(state, day) {
    return periodsOfDay(state, day).filter(function (p) { return !p.isBreak; });
  }

  function teachingPeriodNos(state, day) {
    return teachingPeriods(state, day).map(function (p) { return p.no; });
  }

  /* จำนวนคาบมากที่สุดในบรรดาวันเรียนทั้งหมด ใช้กำหนดจำนวนคอลัมน์ของตาราง */
  function maxPeriodNo(state) {
    var max = 0;
    state.periodConfig.days.forEach(function (d) {
      periodsOfDay(state, d).forEach(function (p) { if (p.no > max) max = p.no; });
    });
    return max;
  }

  function allPeriodNos(state) {
    var nos = [];
    for (var i = 1; i <= maxPeriodNo(state); i++) nos.push(i);
    return nos;
  }

  function periodByNo(state, day, no) {
    return periodsOfDay(state, day).filter(function (p) { return p.no === no; })[0] || null;
  }

  function slotsPerWeek(state) {
    return state.periodConfig.days.reduce(function (sum, d) {
      return sum + teachingPeriodNos(state, d).length;
    }, 0);
  }

  /* คาบที่ติดกันจริงในวันนั้น (ข้ามคาบพัก = ไม่ติดกัน) */
  function adjacentPairs(state, day) {
    var nos = teachingPeriodNos(state, day);
    var pairs = [];
    for (var i = 0; i < nos.length - 1; i++) {
      if (nos[i + 1] === nos[i] + 1) pairs.push([nos[i], nos[i + 1]]);
    }
    return pairs;
  }

  function timeLabel(state, day, no) {
    var p = periodByNo(state, day, no);
    return p ? p.startTime + '–' + p.endTime : '';
  }

  /* ---------- หลักสูตร (ชุดหลักสูตรที่เลือกห้องเองได้) ---------- */
  function curriculumItemsOf(state, curriculumId) {
    return state.curriculumItems.filter(function (ci) { return ci.curriculumId === curriculumId; });
  }

  function sectionsOfCurriculum(state, curriculumId) {
    return state.classSections.filter(function (s) { return s.curriculumId === curriculumId; });
  }

  function curriculumTotal(state, curriculumId) {
    return curriculumItemsOf(state, curriculumId).reduce(function (sum, ci) {
      return sum + U.num(ci.periodsPerWeek);
    }, 0);
  }

  function effectiveCurriculum(state, sectionId) {
    var section = U.byId(state.classSections, sectionId);
    if (!section || !section.curriculumId) return [];
    return curriculumItemsOf(state, section.curriculumId)
      .filter(function (ci) { return U.num(ci.periodsPerWeek) > 0; })
      .map(function (ci) {
        return { subjectId: ci.subjectId, periodsPerWeek: U.num(ci.periodsPerWeek) };
      });
  }

  function sectionWeeklyTotal(state, sectionId) {
    return effectiveCurriculum(state, sectionId).reduce(function (sum, item) {
      return sum + item.periodsPerWeek;
    }, 0);
  }

  /* ---------- การมอบหมายสอน ---------- */
  function syncAssignments(state) {
    var wanted = {};
    state.classSections.forEach(function (section) {
      effectiveCurriculum(state, section.id).forEach(function (item) {
        wanted[section.id + '|' + item.subjectId] = item.periodsPerWeek;
      });
    });
    var seen = {};
    var kept = [];
    state.assignments.forEach(function (a) {
      var key = a.classSectionId + '|' + a.subjectId;
      if (wanted[key] === undefined || seen[key]) return;
      seen[key] = true;
      a.periodsPerWeek = wanted[key];
      kept.push(a);
    });
    Object.keys(wanted).forEach(function (key) {
      if (seen[key]) return;
      var parts = key.split('|');
      kept.push({
        id: U.uid('as'),
        classSectionId: parts[0],
        subjectId: parts[1],
        periodsPerWeek: wanted[key],
        teacherId: '',
        coTeacherId: '',
        roomId: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
    state.assignments = kept;

    /* คาบล็อกที่อ้างถึงการมอบหมายที่หายไป ต้องถูกลบตาม */
    var validIds = {};
    kept.forEach(function (a) { validIds[a.id] = true; });
    state.lockedSlots = state.lockedSlots.filter(function (l) {
      return l.kind !== 'SUBJECT' || validIds[l.assignmentId];
    });
    return state.assignments;
  }

  function assignmentsOfSection(state, sectionId) {
    return state.assignments.filter(function (a) { return a.classSectionId === sectionId; });
  }

  function assignedCount(state) {
    return state.assignments.filter(function (a) { return !!a.teacherId; }).length;
  }

  function teacherAssignedLoad(state) {
    var load = {};
    state.teachers.forEach(function (t) { load[t.id] = 0; });
    state.assignments.forEach(function (a) {
      var n = U.num(a.periodsPerWeek);
      if (a.teacherId && load[a.teacherId] !== undefined) load[a.teacherId] += n;
      if (a.coTeacherId && load[a.coTeacherId] !== undefined) load[a.coTeacherId] += n;
    });
    return load;
  }

  /* ---------- คาบล็อก ---------- */
  function lockAppliesToSection(state, lock, section) {
    if (lock.kind === 'SUBJECT') {
      var a = U.byId(state.assignments, lock.assignmentId);
      return !!a && a.classSectionId === section.id;
    }
    if (lock.scope === 'SCHOOL') return true;
    if (lock.scope === 'GRADE') return section.gradeLevelId === lock.targetId;
    if (lock.scope === 'SECTION') return section.id === lock.targetId;
    return false;
  }

  /* แผนที่ช่องที่ถูกกันไว้ ใช้ตอนจัดตาราง — นับเฉพาะคาบล็อกแบบกันช่อง (BLOCK) */
  function buildLockMaps(state) {
    var sectionLocks = {};
    var teacherLocks = {};
    var roomLocks = {};
    state.classSections.forEach(function (s) { sectionLocks[s.id] = {}; });
    state.teachers.forEach(function (t) { teacherLocks[t.id] = {}; });
    state.rooms.forEach(function (r) { roomLocks[r.id] = {}; });

    state.lockedSlots.forEach(function (lock) {
      if (lock.kind === 'SUBJECT') return;
      var key = lock.day + '#' + lock.periodNo;
      if (lock.scope === 'TEACHER') {
        if (lock.targetId && teacherLocks[lock.targetId]) teacherLocks[lock.targetId][key] = lock;
      } else {
        state.classSections.forEach(function (section) {
          if (lockAppliesToSection(state, lock, section)) sectionLocks[section.id][key] = lock;
        });
      }
      if (lock.teacherId && teacherLocks[lock.teacherId]) teacherLocks[lock.teacherId][key] = lock;
      if (lock.roomId && roomLocks[lock.roomId]) roomLocks[lock.roomId][key] = lock;
    });
    return { section: sectionLocks, teacher: teacherLocks, room: roomLocks };
  }

  function pinnedLocks(state) {
    return state.lockedSlots.filter(function (l) { return l.kind === 'SUBJECT'; });
  }

  function locksOfSection(state, sectionId) {
    var section = U.byId(state.classSections, sectionId);
    if (!section) return [];
    return state.lockedSlots.filter(function (l) { return lockAppliesToSection(state, l, section); });
  }

  /* ---------- ความพร้อมของข้อมูล ---------- */
  function readiness(state) {
    var steps = [];
    var hasTeachingSlot = state.periodConfig.days.some(function (d) {
      return teachingPeriodNos(state, d).length > 0;
    });

    steps.push({
      key: 'setup', label: 'ตั้งค่าโรงเรียนและคาบเรียน', page: 'settings',
      done: !!(state.school.name && state.school.directorName && hasTeachingSlot),
      missing: !state.school.name ? 'ยังไม่ได้กรอกชื่อโรงเรียน'
        : (!state.school.directorName ? 'ยังไม่ได้กรอกชื่อผู้อำนวยการ'
          : (!hasTeachingSlot ? 'ยังไม่มีคาบสำหรับสอนเลย ทุกคาบถูกตั้งเป็นคาบพัก' : ''))
    });
    steps.push({
      key: 'rooms', label: 'บันทึกอาคารและห้อง', page: 'rooms',
      done: state.buildings.length > 0 && state.rooms.length > 0,
      missing: state.rooms.length ? '' : 'ยังไม่มีห้องสถานที่ในระบบ'
    });
    steps.push({
      key: 'subjects', label: 'บันทึกรายวิชา', page: 'subjects',
      done: state.subjects.length > 0,
      missing: state.subjects.length ? '' : 'ยังไม่มีรายวิชาในระบบ'
    });
    steps.push({
      key: 'teachers', label: 'บันทึกครู', page: 'teachers',
      done: state.teachers.length > 0,
      missing: state.teachers.length ? '' : 'ยังไม่มีรายชื่อครูในระบบ'
    });
    steps.push({
      key: 'sections', label: 'สร้างชั้นเรียน', page: 'sections',
      done: state.classSections.length > 0,
      missing: state.classSections.length ? '' : 'ยังไม่มีชั้นเรียนในระบบ'
    });

    var withCurriculum = state.classSections.filter(function (s) {
      return s.curriculumId && curriculumItemsOf(state, s.curriculumId).length;
    }).length;
    steps.push({
      key: 'curriculum', label: 'สร้างหลักสูตรและเลือกห้องที่ใช้', page: 'curriculum',
      done: state.classSections.length > 0 && withCurriculum === state.classSections.length,
      detail: state.curricula.length
        ? ('มีหลักสูตร ' + U.fmtNum(state.curricula.length) + ' ชุด · ใช้ครบ ' +
          U.fmtNum(withCurriculum) + ' จาก ' + U.fmtNum(state.classSections.length) + ' ห้อง') : '',
      missing: !state.curricula.length ? 'ยังไม่มีหลักสูตรในระบบ'
        : (withCurriculum < state.classSections.length
          ? ('ยังมี ' + U.fmtNum(state.classSections.length - withCurriculum) + ' ห้องที่ยังไม่ได้เลือกหลักสูตร') : '')
    });

    var total = state.assignments.length;
    var done = assignedCount(state);
    steps.push({
      key: 'assignments', label: 'จัดครูผู้สอน', page: 'assignments',
      done: total > 0 && done === total,
      detail: total ? ('จัดครูแล้ว ' + U.fmtNum(done) + ' จาก ' + U.fmtNum(total) + ' รายการ') : '',
      missing: total === 0 ? 'ยังไม่มีรายการที่ต้องจัดครู เพราะยังไม่มีหลักสูตรหรือชั้นเรียน'
        : (done < total ? ('ยังไม่ได้เลือกครูผู้สอนอีก ' + U.fmtNum(total - done) + ' รายการ') : '')
    });

    return steps;
  }

  function preflightDetail(state) {
    var problems = [];
    var warnings = [];
    readiness(state).forEach(function (step) {
      if (!step.done) problems.push({ page: step.page, title: step.label, message: step.missing || 'ยังทำขั้นตอนนี้ไม่เสร็จ' });
    });

    var mismatch = 0;
    state.classSections.forEach(function (section) {
      effectiveCurriculum(state, section.id).forEach(function (item) {
        var a = state.assignments.filter(function (x) {
          return x.classSectionId === section.id && x.subjectId === item.subjectId;
        })[0];
        if (!a || U.num(a.periodsPerWeek) !== item.periodsPerWeek) mismatch++;
      });
    });
    if (mismatch > 0) {
      problems.push({
        page: 'assignments', title: 'จำนวนคาบไม่ตรงกับหลักสูตร',
        message: 'มี ' + U.fmtNum(mismatch) + ' รายการที่จำนวนคาบต่อสัปดาห์ไม่ตรงกับหลักสูตร กดปุ่มปรับให้ตรงกับหลักสูตรในหน้าจัดครูผู้สอน'
      });
    }

    var perWeek = slotsPerWeek(state);
    var overloadSections = state.classSections.filter(function (s) {
      return sectionWeeklyTotal(state, s.id) > perWeek;
    });
    if (overloadSections.length) {
      problems.push({
        page: 'curriculum', title: 'หลักสูตรมีคาบมากกว่าช่องที่มีจริง',
        message: 'ชั้นเรียน ' + U.fmtNum(overloadSections.length) + ' ห้องมีคาบตามหลักสูตรมากกว่า ' +
          perWeek + ' ช่องต่อสัปดาห์ที่มีอยู่ ให้ลดจำนวนคาบในหลักสูตรหรือเพิ่มจำนวนคาบต่อวัน'
      });
    }

    var load = teacherAssignedLoad(state);
    var over = state.teachers.filter(function (t) { return load[t.id] > U.num(t.maxPeriodsPerWeek); });
    if (over.length) {
      warnings.push({
        page: 'teachers', title: 'ครูถูกมอบหมายเกินโควตา',
        message: 'ครู ' + U.fmtNum(over.length) + ' คนถูกมอบหมายเกินโควตาคาบต่อสัปดาห์ เช่น ' +
          over.slice(0, 3).map(function (t) {
            return t.name + ' (' + load[t.id] + '/' + t.maxPeriodsPerWeek + ' คาบ)';
          }).join(', ') + ' ให้เพิ่มโควตาหรือเปลี่ยนครูผู้สอนบางรายการ ไม่เช่นนั้นคาบส่วนเกินจะจัดไม่ลง'
      });
    }

    var perDayShort = state.teachers.filter(function (t) {
      var capacity = (t.availableDays || []).reduce(function (sum, d) {
        return sum + Math.min(U.num(t.maxPeriodsPerDay), teachingPeriodNos(state, d).length);
      }, 0);
      return load[t.id] > capacity;
    });
    if (perDayShort.length) {
      warnings.push({
        page: 'teachers', title: 'วันที่ครูมาสอนไม่พอกับคาบที่ต้องสอน',
        message: 'ครู ' + U.fmtNum(perDayShort.length) + ' คนมีวันมาสอนและโควตาต่อวันไม่พอกับคาบที่ถูกมอบหมาย เช่น ' +
          perDayShort.slice(0, 3).map(function (t) { return t.name; }).join(', ') +
          ' ให้เพิ่มวันที่มาสอน เพิ่มคาบสูงสุดต่อวัน หรือลดคาบที่มอบหมาย'
      });
    }

    return { blockers: problems, warnings: warnings };
  }

  function preflight(state) {
    return preflightDetail(state).blockers;
  }

  /* ---------- การอ้างอิงข้อมูล (กฎ D5) ---------- */
  function referencesOfTeacher(state, teacherId) {
    var refs = [];
    state.assignments.forEach(function (a) {
      if (a.teacherId === teacherId || a.coTeacherId === teacherId) {
        var s = U.byId(state.classSections, a.classSectionId);
        var sub = U.byId(state.subjects, a.subjectId);
        refs.push((s ? s.name : '-') + ' วิชา' + (sub ? sub.name : '-'));
      }
    });
    state.lockedSlots.forEach(function (l) {
      if (l.teacherId === teacherId || (l.scope === 'TEACHER' && l.targetId === teacherId)) {
        refs.push('คาบล็อก ' + (l.label || ''));
      }
    });
    return refs;
  }

  function referencesOfRoom(state, roomId) {
    var refs = [];
    state.assignments.forEach(function (a) {
      if (a.roomId === roomId) {
        var s = U.byId(state.classSections, a.classSectionId);
        var sub = U.byId(state.subjects, a.subjectId);
        refs.push('การจัดครูผู้สอน ' + (s ? s.name : '-') + ' วิชา' + (sub ? sub.name : '-'));
      }
    });
    state.classSections.forEach(function (s) {
      if (s.homeRoomId === roomId) refs.push('ห้องประจำของ ' + s.name);
    });
    state.timetables.forEach(function (t) {
      var used = t.entries.filter(function (e) { return e.roomId === roomId; }).length;
      if (used) refs.push('ตาราง "' + t.name + '" ใช้อยู่ ' + used + ' คาบ');
    });
    return refs;
  }

  function referencesOfSubject(state, subjectId) {
    var refs = [];
    state.curriculumItems.forEach(function (i) {
      if (i.subjectId === subjectId) {
        var c = U.byId(state.curricula, i.curriculumId);
        refs.push('หลักสูตร ' + (c ? c.name : '-'));
      }
    });
    state.assignments.forEach(function (a) {
      if (a.subjectId === subjectId) {
        var s = U.byId(state.classSections, a.classSectionId);
        refs.push('การจัดครูผู้สอนของ ' + (s ? s.name : '-'));
      }
    });
    return refs;
  }

  function referencesOfSection(state, sectionId) {
    var refs = [];
    state.assignments.forEach(function (a) {
      if (a.classSectionId === sectionId && a.teacherId) refs.push('การจัดครูผู้สอน');
    });
    state.timetables.forEach(function (t) {
      var count = t.entries.filter(function (e) {
        var a = U.byId(state.assignments, e.assignmentId);
        return a && a.classSectionId === sectionId;
      }).length;
      if (count) refs.push('ตาราง "' + t.name + '" ใช้อยู่ ' + count + ' คาบ');
    });
    return refs;
  }

  function referencesOfBuilding(state, buildingId) {
    return state.rooms.filter(function (r) { return r.buildingId === buildingId; })
      .map(function (r) { return 'ห้อง ' + r.name; });
  }

  function referencesOfRoomType(state, roomTypeId) {
    var refs = [];
    state.rooms.forEach(function (r) { if (r.roomTypeId === roomTypeId) refs.push('ห้อง ' + r.name); });
    state.subjects.forEach(function (s) {
      if (s.requiredRoomTypeId === roomTypeId) refs.push('วิชา ' + s.name);
    });
    return refs;
  }

  function referencesOfCurriculum(state, curriculumId) {
    return sectionsOfCurriculum(state, curriculumId).map(function (s) { return 'ชั้นเรียน ' + s.name; });
  }

  /* ---------- ระยะเดินระหว่างห้อง (อาคาร + ชั้น) ---------- */
  function walkDistance(state, roomA, roomB) {
    if (!roomA || !roomB) return 0;
    if (roomA.id === roomB.id) return 0;
    if (roomA.buildingId !== roomB.buildingId) return 3;          /* คนละอาคาร = ไกลที่สุด */
    var diff = Math.abs(U.num(roomA.floor) - U.num(roomB.floor));
    if (diff === 0) return 0;                                      /* อาคารเดียวกัน ชั้นเดียวกัน */
    return diff === 1 ? 1 : 2;                                     /* ต่างชั้น */
  }

  function walkText(state, roomA, roomB) {
    var d = walkDistance(state, roomA, roomB);
    if (d === 0) return 'อยู่ใกล้กัน';
    if (d >= 3) {
      var b1 = U.byId(state.buildings, roomA.buildingId);
      var b2 = U.byId(state.buildings, roomB.buildingId);
      return 'ต้องเดินข้ามอาคารจาก' + (b1 ? b1.name : '-') + ' ไป' + (b2 ? b2.name : '-');
    }
    return 'ต้องเดินข้ามชั้น จากชั้น ' + U.num(roomA.floor) + ' ไปชั้น ' + U.num(roomB.floor);
  }

  /* ---------- ตาราง ---------- */
  function activeTimetable(state) {
    if (!state.activeTimetableId) return null;
    return U.byId(state.timetables, state.activeTimetableId);
  }

  function currentSemesterTimetables(state) {
    return state.timetables.filter(function (t) {
      return t.academicYear === state.school.academicYear && t.semester === state.school.semester;
    });
  }

  function statusLabel(status) {
    if (status === 'PUBLISHED') return 'ประกาศใช้แล้ว';
    if (status === 'ARCHIVED') return 'ประวัติ';
    return 'ฉบับร่าง';
  }

  global.ST.model = {
    periodsOfDay: periodsOfDay,
    teachingPeriods: teachingPeriods,
    teachingPeriodNos: teachingPeriodNos,
    maxPeriodNo: maxPeriodNo,
    allPeriodNos: allPeriodNos,
    periodByNo: periodByNo,
    slotsPerWeek: slotsPerWeek,
    adjacentPairs: adjacentPairs,
    timeLabel: timeLabel,
    curriculumItemsOf: curriculumItemsOf,
    sectionsOfCurriculum: sectionsOfCurriculum,
    curriculumTotal: curriculumTotal,
    effectiveCurriculum: effectiveCurriculum,
    sectionWeeklyTotal: sectionWeeklyTotal,
    syncAssignments: syncAssignments,
    assignmentsOfSection: assignmentsOfSection,
    assignedCount: assignedCount,
    teacherAssignedLoad: teacherAssignedLoad,
    lockAppliesToSection: lockAppliesToSection,
    buildLockMaps: buildLockMaps,
    pinnedLocks: pinnedLocks,
    locksOfSection: locksOfSection,
    readiness: readiness,
    preflight: preflight,
    preflightDetail: preflightDetail,
    referencesOfTeacher: referencesOfTeacher,
    referencesOfRoom: referencesOfRoom,
    referencesOfSubject: referencesOfSubject,
    referencesOfSection: referencesOfSection,
    referencesOfBuilding: referencesOfBuilding,
    referencesOfRoomType: referencesOfRoomType,
    referencesOfCurriculum: referencesOfCurriculum,
    walkDistance: walkDistance,
    walkText: walkText,
    activeTimetable: activeTimetable,
    currentSemesterTimetables: currentSemesterTimetables,
    statusLabel: statusLabel
  };
})(typeof window !== 'undefined' ? window : globalThis);
