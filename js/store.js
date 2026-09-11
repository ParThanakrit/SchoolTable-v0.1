/* ============================================================
   SchoolTable — store.js
   ที่เก็บข้อมูลทั้งระบบ และการบันทึกลงเครื่องผู้ใช้
   ============================================================ */
(function (global) {
  'use strict';

  var U = global.ST.util;
  var STORAGE_KEY = 'schooltable.data.v2';
  var OLD_STORAGE_KEY = 'schooltable.data.v1';
  var MAX_TIMETABLE_HISTORY = 10;

  /* ---------- ผังคาบของหนึ่งวัน ----------
     breaks รับได้ 2 แบบ
       • object แบบใหม่: { periodNo: { label, minutes } } → ตั้งได้หลายคาบพัก ตั้งชื่อ/นาทีเอง
       • number แบบเดิม: lunchNo (คาบพักเดียว) เพื่อความเข้ากันได้กับข้อมูล/โค้ดเก่า */
  function buildDayPeriods(count, breaks, startMinutes, lengthMinutes, legacyBreakMinutes) {
    var teachLen = lengthMinutes || 50;
    if (typeof breaks === 'number' || breaks == null) {
      var lunchNo = breaks;
      breaks = {};
      if (lunchNo) breaks[lunchNo] = { label: 'พักกลางวัน', minutes: legacyBreakMinutes || teachLen };
    }
    var periods = [];
    var cursor = startMinutes;
    for (var i = 1; i <= count; i++) {
      var br = breaks[i];
      var len = br ? (U.num(br.minutes) || teachLen) : teachLen;
      periods.push({
        no: i,
        startTime: U.minutesToTime(cursor),
        endTime: U.minutesToTime(cursor + len),
        isBreak: !!br,
        label: br ? (br.label || 'พัก') : ''
      });
      cursor += len;
    }
    return periods;
  }

  /* ผังคาบเริ่มต้นของทุกวันเรียน */
  function buildDayPlans(days, count, lunchNo, startMinutes) {
    var plans = {};
    days.forEach(function (d) {
      plans[d] = { periods: buildDayPeriods(count, lunchNo, startMinutes, 50, 50) };
    });
    return plans;
  }

  function defaultConditions() {
    return {
      /* กฎรอง — เปิดปิดและกำหนดความสำคัญได้เอง */
      rules: {
        S1: { enabled: true, weight: 'high' },     /* วิชาหลักอยู่ช่วงเช้า */
        S2: { enabled: true, weight: 'medium' },   /* คาบติดกันเดินหากันใกล้ */
        S3: { enabled: true, weight: 'low' },      /* คาบคู่ติดกัน */
        S4: { enabled: true, weight: 'low' }       /* ภาระงานครูสมดุล */
      },
      /* ไม่ควรเรียนวิชาเดียวกันซ้ำหลายคาบในวันเดียว */
      avoidSameSubjectTwiceADay: true
    };
  }

  function emptyState() {
    var days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    return {
      meta: { version: 2, createdAt: new Date().toISOString(), sampleLoaded: false },
      school: {
        id: 'school', name: '', logoData: '', directorName: '',
        academicYear: 2569, semester: 1
      },
      periodConfig: {
        days: days,
        dayPlans: buildDayPlans(days, 9, 5, 8 * 60 + 30),
        morningEndsAtPeriod: 4
      },
      conditions: defaultConditions(),
      buildings: [],
      roomTypes: [],
      rooms: [],
      subjectGroups: [],
      subjects: [],
      teachers: [],
      gradeLevels: [],
      curricula: [],
      curriculumItems: [],
      classSections: [],
      assignments: [],
      lockedSlots: [],
      timetables: [],
      activeTimetableId: null
    };
  }

  var state = emptyState();
  var listeners = [];
  var storageWarned = false;

  function subscribe(fn) { listeners.push(fn); }
  function notify(reason) {
    listeners.forEach(function (fn) {
      try { fn(reason); } catch (e) { /* หน้าจอส่วนนั้นไม่พร้อม ไม่ทำให้ทั้งระบบล้ม */ }
    });
  }

  function hasStorage() {
    try {
      return typeof localStorage !== 'undefined' && localStorage !== null;
    } catch (e) { return false; }
  }

  function trimHistory() {
    var archived = state.timetables.filter(function (t) { return t.status === 'ARCHIVED'; });
    if (archived.length <= MAX_TIMETABLE_HISTORY) return false;
    archived.sort(function (a, b) {
      return new Date(a.generatedAt || 0) - new Date(b.generatedAt || 0);
    });
    var removeCount = archived.length - MAX_TIMETABLE_HISTORY;
    var removeIds = {};
    for (var i = 0; i < removeCount; i++) removeIds[archived[i].id] = true;
    state.timetables = state.timetables.filter(function (t) { return !removeIds[t.id]; });
    return true;
  }

  function save() {
    if (!hasStorage()) return true;
    try {
      trimHistory();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageWarned = false;
      return true;
    } catch (err) {
      if (!storageWarned) {
        storageWarned = true;
        U.explainDialog({
          title: 'บันทึกข้อมูลลงเครื่องไม่สำเร็จ',
          cause: 'เนื้อที่เก็บข้อมูลของเบราว์เซอร์เต็มแล้ว ข้อมูลที่เพิ่งแก้ไขจึงยังไม่ถูกบันทึกลงเครื่อง',
          fix: 'ให้กดส่งออกไฟล์สำรองข้อมูลเก็บไว้ก่อน แล้วไปที่หน้าประวัติตารางเพื่อลบตารางฉบับร่างเก่าที่ไม่ใช้แล้ว จากนั้นแก้ไขข้อมูลอีกครั้ง'
        });
      }
      return false;
    }
  }

  function load() {
    if (!hasStorage()) return false;
    var raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
    } catch (e) { return false; }
    if (!raw) return false;
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.periodConfig) throw new Error('bad');
      state = mergeDefaults(parsed);
      /* บันทึกโครงสร้างที่แปลงแล้วทันที เพื่อไม่ต้องแยกรายวิชาซ้ำทุกครั้งที่เปิดหน้าเว็บ */
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (saveError) { /* ยังใช้งานข้อมูลในหน่วยความจำต่อได้ */ }
      return true;
    } catch (err) {
      U.explainDialog({
        title: 'ข้อมูลที่เก็บไว้ในเครื่องเสียหาย',
        cause: 'ระบบอ่านข้อมูลเดิมที่บันทึกไว้ในเครื่องไม่ได้ ข้อมูลอาจถูกแก้ไขจากภายนอกหรือบันทึกไม่สมบูรณ์',
        fix: 'ให้เลือกกู้ข้อมูลจากไฟล์สำรองที่เคยส่งออกไว้ ที่หน้าตั้งค่าโรงเรียน หรือเริ่มใหม่ด้วยข้อมูลโรงเรียนตัวอย่าง'
      });
      return false;
    }
  }

  /* เติมค่าที่ขาด และแปลงข้อมูลรุ่นเก่าให้เข้ากับโครงสร้างใหม่ */
  function mergeDefaults(data) {
    var base = emptyState();
    Object.keys(base).forEach(function (key) {
      if (data[key] === undefined || data[key] === null) data[key] = base[key];
    });

    /* ทุกโรงเรียนใช้ชุดระดับชั้นมาตรฐานเดียวกัน เติมระดับที่ขาดให้ข้อมูลเดิมอัตโนมัติ */
    var standardGrades = ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];
    standardGrades.forEach(function (name, index) {
      var existing = data.gradeLevels.find(function (g) { return g.name === name; });
      if (existing) {
        existing.order = index + 1;
      } else {
        data.gradeLevels.push({ id: U.uid('gl'), name: name, order: index + 1 });
      }
    });
    data.gradeLevels.filter(function (g) { return standardGrades.indexOf(g.name) === -1; })
      .sort(function (a, b) { return U.num(a.order) - U.num(b.order); })
      .forEach(function (g, index) { g.order = standardGrades.length + index + 1; });

    /* ผังคาบรุ่นเก่าใช้ periods ชุดเดียวทุกวัน → แปลงเป็นผังรายวัน */
    var cfg = data.periodConfig;
    if (!cfg.dayPlans || !Object.keys(cfg.dayPlans).length) {
      var source = Array.isArray(cfg.periods) && cfg.periods.length
        ? cfg.periods : base.periodConfig.dayPlans.MON.periods;
      cfg.dayPlans = {};
      (cfg.days || base.periodConfig.days).forEach(function (d) {
        cfg.dayPlans[d] = { periods: U.deepClone(source) };
      });
    }
    (cfg.days || []).forEach(function (d) {
      if (!cfg.dayPlans[d]) cfg.dayPlans[d] = { periods: U.deepClone(base.periodConfig.dayPlans.MON.periods) };
    });
    delete cfg.periods;
    delete cfg.periodsPerDay;

    if (!data.conditions || !data.conditions.rules) data.conditions = base.conditions;

    /* หลักสูตรรุ่นเก่าผูกกับระดับชั้น → แปลงเป็นชุดหลักสูตรหนึ่งชุดต่อระดับชั้น */
    if (!Array.isArray(data.curricula)) data.curricula = [];
    var needsUpgrade = data.curriculumItems.some(function (ci) { return !!ci.gradeLevelId; });
    if (needsUpgrade) {
      var byGrade = {};
      data.gradeLevels.forEach(function (g) {
        var rec = { id: U.uid('cu'), name: 'หลักสูตร ' + g.name, gradeLevelId: g.id, note: '' };
        byGrade[g.id] = rec;
        data.curricula.push(rec);
      });
      data.curriculumItems.forEach(function (ci) {
        if (ci.gradeLevelId && byGrade[ci.gradeLevelId]) ci.curriculumId = byGrade[ci.gradeLevelId].id;
        delete ci.gradeLevelId;
      });
      data.classSections.forEach(function (s) {
        if (!s.curriculumId && byGrade[s.gradeLevelId]) s.curriculumId = byGrade[s.gradeLevelId].id;
      });
    }
    delete data.curriculumOverrides;

    /* รายวิชาหนึ่งรายการต้องอยู่เพียงหนึ่งระดับชั้น
       ข้อมูลรุ่นเดิมที่ใช้วิชาเดียวร่วมหลายชั้นจะถูกแยกเป็นคนละรายการ และย้ายการอ้างอิงให้ตรงชั้น */
    var validGradeIds = {};
    var gradeOrder = {};
    data.gradeLevels.forEach(function (g) {
      validGradeIds[g.id] = true;
      gradeOrder[g.id] = U.num(g.order);
    });
    var curriculumGrade = {};
    data.curricula.forEach(function (c) { curriculumGrade[c.id] = c.gradeLevelId; });
    var gradesBySubject = {};
    data.curriculumItems.forEach(function (ci) {
      var gradeId = curriculumGrade[ci.curriculumId];
      if (!gradeId || !validGradeIds[gradeId]) return;
      if (!gradesBySubject[ci.subjectId]) gradesBySubject[ci.subjectId] = [];
      if (gradesBySubject[ci.subjectId].indexOf(gradeId) === -1) gradesBySubject[ci.subjectId].push(gradeId);
    });
    var subjectGradeMap = {};
    var migratedSubjects = [];
    data.subjects.slice().forEach(function (s) {
      var originalId = s.id;
      var ids = Array.isArray(s.gradeLevelIds) ? s.gradeLevelIds.slice() : [];
      if (s.gradeLevelId) ids.push(s.gradeLevelId);
      (gradesBySubject[s.id] || []).forEach(function (id) { ids.push(id); });
      var seen = {};
      ids = ids.filter(function (id) {
        if (!validGradeIds[id] || seen[id]) return false;
        seen[id] = true;
        return true;
      }).sort(function (a, b) { return gradeOrder[a] - gradeOrder[b]; });

      if (!ids.length) {
        s.gradeLevelId = '';
        delete s.gradeLevelIds;
        migratedSubjects.push(s);
        subjectGradeMap[originalId] = {};
        return;
      }

      subjectGradeMap[originalId] = {};
      ids.forEach(function (gradeId, index) {
        var target = index === 0 ? s : U.deepClone(s);
        if (index > 0) target.id = U.uid('sj');
        target.gradeLevelId = gradeId;
        delete target.gradeLevelIds;
        subjectGradeMap[originalId][gradeId] = target.id;
        migratedSubjects.push(target);
      });
    });
    data.subjects = migratedSubjects;

    data.curriculumItems.forEach(function (ci) {
      var map = subjectGradeMap[ci.subjectId];
      var gradeId = curriculumGrade[ci.curriculumId];
      if (map && map[gradeId]) ci.subjectId = map[gradeId];
    });

    var sectionGrade = {};
    data.classSections.forEach(function (section) { sectionGrade[section.id] = section.gradeLevelId; });
    data.assignments.forEach(function (assignment) {
      var map = subjectGradeMap[assignment.subjectId];
      var gradeId = sectionGrade[assignment.classSectionId];
      if (map && map[gradeId]) assignment.subjectId = map[gradeId];
    });
    var assignmentById = {};
    data.assignments.forEach(function (assignment) { assignmentById[assignment.id] = assignment; });
    data.lockedSlots.forEach(function (lock) {
      if (lock.kind !== 'SUBJECT') return;
      var assignment = assignmentById[lock.assignmentId];
      if (assignment) lock.subjectId = assignment.subjectId;
    });

    data.rooms.forEach(function (r) { if (r.floor === undefined) r.floor = 1; });
    data.lockedSlots.forEach(function (l) { if (!l.kind) l.kind = 'BLOCK'; });

    /* อัปเกรดสีกลุ่มสาระชุดเดิมให้เป็นชุดสีใหม่ที่สดใสขึ้น
       แมปเฉพาะค่าเริ่มต้นชุดเก่าเท่านั้น ถ้าผู้ใช้ตั้งสีเองไว้จะไม่ถูกเปลี่ยน */
    var GROUP_COLOR_UPGRADE = {
      '#b45309': '#f43f5e', '#1d4ed8': '#3b82f6', '#059669': '#10b981',
      '#7c3aed': '#a855f7', '#dc2626': '#f97316', '#db2777': '#ec4899',
      '#0891b2': '#06b6d4', '#4338ca': '#6366f1', '#6b7280': '#eab308'
    };
    (data.subjectGroups || []).forEach(function (g) {
      var next = GROUP_COLOR_UPGRADE[String(g.color || '').toLowerCase()];
      if (next) g.color = next;
    });

    data.timetables.forEach(function (t) {
      if (!Array.isArray(t.entries)) t.entries = [];
      if (!Array.isArray(t.issues)) t.issues = [];
      if (!t.stats) t.stats = { totalRequired: 0, placed: 0, unplaced: 0, softViolations: 0 };
    });
    return data;
  }

  function replaceState(next) {
    state = mergeDefaults(next);
    save();
    notify('replace');
  }

  function resetAll() {
    state = emptyState();
    save();
    notify('reset');
  }

  function getState() { return state; }

  /* ---------- ไฟล์สำรองข้อมูล ---------- */
  function exportBackup() {
    var payload = {
      fileType: 'SchoolTable Backup',
      version: 2,
      exportedAt: new Date().toISOString(),
      data: state
    };
    var name = 'สำรองข้อมูล-schooltable-' + new Date().toISOString().slice(0, 10) + '.json';
    U.downloadBlob(name, new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  }

  function importBackup(text) {
    var parsed;
    try { parsed = JSON.parse(text); } catch (e) {
      return { ok: false, message: 'ไฟล์นี้ไม่ใช่ไฟล์สำรองข้อมูลของระบบ เพราะอ่านเนื้อหาไม่ได้' };
    }
    var data = parsed && parsed.data ? parsed.data : parsed;
    if (!data || !data.periodConfig || !Array.isArray(data.teachers)) {
      return { ok: false, message: 'ไฟล์นี้ไม่ใช่ไฟล์สำรองข้อมูลของระบบ เพราะไม่พบข้อมูลตั้งค่าคาบเรียนและรายชื่อครู' };
    }
    replaceState(data);
    return { ok: true };
  }

  global.ST.store = {
    STORAGE_KEY: STORAGE_KEY,
    MAX_TIMETABLE_HISTORY: MAX_TIMETABLE_HISTORY,
    buildDayPeriods: buildDayPeriods,
    buildDayPlans: buildDayPlans,
    defaultConditions: defaultConditions,
    emptyState: emptyState,
    getState: getState,
    save: save,
    load: load,
    notify: notify,
    subscribe: subscribe,
    replaceState: replaceState,
    resetAll: resetAll,
    exportBackup: exportBackup,
    importBackup: importBackup
  };
})(typeof window !== 'undefined' ? window : globalThis);
