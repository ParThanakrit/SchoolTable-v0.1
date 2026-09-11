/* ============================================================
   SchoolTable — mockdata.js
   ข้อมูลโรงเรียนตัวอย่าง (สมมติทั้งหมด) ที่กดจัดตารางได้ทันที
   ============================================================ */
(function (global) {
  'use strict';

  var U = global.ST.util;
  var store = global.ST.store;

  var FIRST_NAMES = [
    'สมชาย', 'สมหญิง', 'ประเสริฐ', 'วิไลวรรณ', 'อนุชา', 'กมลชนก', 'ธนากร', 'สุภาพร',
    'ณัฐพงษ์', 'ปิยะนุช', 'จิรายุ', 'อรทัย', 'ศิริชัย', 'เบญจวรรณ', 'ธีระพงศ์', 'พรทิพย์',
    'วรากร', 'ชุติมา', 'ภาณุพงศ์', 'นฤมล', 'สุรศักดิ์', 'ดวงพร', 'อดิศักดิ์', 'ยุพิน',
    'ชัยวัฒน์', 'ทัศนีย์', 'พิเชษฐ์', 'สุนิสา', 'รัชพล', 'มัลลิกา', 'กิตติศักดิ์', 'อารีย์',
    'นพดล', 'จันทิมา', 'เอกชัย', 'ปราณี', 'ทวีศักดิ์', 'ศศิธร', 'มานพ', 'รุ่งนภา',
    'สุทธิพงษ์', 'กาญจนา', 'ไพโรจน์', 'สมฤดี', 'วีระชัย', 'นงลักษณ์', 'ปกรณ์', 'ขวัญใจ',
    'อภิสิทธิ์', 'พัชรี', 'ธนพล', 'สายฝน', 'จักรพงษ์', 'วารุณี', 'ณรงค์ฤทธิ์', 'ลัดดาวัลย์',
    'ศุภชัย', 'เพ็ญศรี', 'บรรจง', 'อุไรวรรณ'
  ];

  var LAST_NAMES = [
    'ใจดี', 'ศรีสุข', 'ทองคำ', 'บุญมี', 'แก้วมณี', 'พรมมา', 'สุขสันต์', 'วงศ์ไทย',
    'เรืองรอง', 'มั่นคง', 'พูนทรัพย์', 'จันทร์เพ็ญ', 'ดาวเรือง', 'ภูผา', 'สายทอง', 'นาคสุข',
    'ปัญญาดี', 'เกษมสุข', 'ไพศาล', 'อารมณ์ดี', 'ธนบดี', 'ชัยมงคล', 'รักเรียน', 'สมบูรณ์',
    'เพชรรัตน์', 'กล้าหาญ', 'วิริยะ', 'อุดมทรัพย์', 'ศรีวิไล', 'บุญเรือง', 'แสงทอง', 'พงษ์พันธ์',
    'ยิ่งยง', 'ถาวรกุล', 'สินสมบัติ', 'เจริญพร', 'ไชยศรี', 'มณีวงศ์', 'ขจรเดช', 'พัฒนกิจ'
  ];

  var GROUPS = [
    { key: 'thai', name: 'ภาษาไทย', color: '#f43f5e', teachers: 10 },
    { key: 'math', name: 'คณิตศาสตร์', color: '#3b82f6', teachers: 20 },
    { key: 'sci', name: 'วิทยาศาสตร์และเทคโนโลยี', color: '#10b981', teachers: 36 },
    { key: 'social', name: 'สังคมศึกษา ศาสนาและวัฒนธรรม', color: '#a855f7', teachers: 12 },
    { key: 'health', name: 'สุขศึกษาและพลศึกษา', color: '#f97316', teachers: 6 },
    { key: 'art', name: 'ศิลปะ', color: '#ec4899', teachers: 6 },
    { key: 'work', name: 'การงานอาชีพ', color: '#06b6d4', teachers: 4 },
    { key: 'foreign', name: 'ภาษาต่างประเทศ', color: '#6366f1', teachers: 20 },
    { key: 'activity', name: 'กิจกรรมพัฒนาผู้เรียน', color: '#eab308', teachers: 6 }
  ];

  var ROOM_TYPES = [
    { key: 'general', name: 'ห้องเรียนทั่วไป', isGeneral: true },
    { key: 'scilab', name: 'ห้องปฏิบัติการวิทยาศาสตร์', isGeneral: false },
    { key: 'computer', name: 'ห้องคอมพิวเตอร์', isGeneral: false },
    { key: 'pe', name: 'ห้องพลศึกษา', isGeneral: false },
    { key: 'music', name: 'ห้องดนตรี', isGeneral: false },
    { key: 'art', name: 'ห้องศิลปะ', isGeneral: false }
  ];

  /* รหัสวิชาตามระดับชั้น: ม.1-3 ใช้ 21/22/23, ม.4-6 ใช้ 31/32/33 */
  function codeBase(gradeNo) {
    return gradeNo <= 3 ? ('2' + gradeNo) : ('3' + (gradeNo - 3));
  }

  /* วิชาเฉพาะระดับชั้น ม.1–ม.3 */
  function lowerGradeSubjects(gradeNo) {
    var c = codeBase(gradeNo);
    return [
      { key: 'thai' + gradeNo, code: 'ท' + c + '101', name: 'ภาษาไทย ' + gradeNo, group: 'thai', periods: 3, core: true },
      { key: 'math' + gradeNo, code: 'ค' + c + '101', name: 'คณิตศาสตร์พื้นฐาน ' + gradeNo, group: 'math', periods: 4, core: true },
      { key: 'mathx' + gradeNo, code: 'ค' + c + '201', name: 'คณิตศาสตร์เพิ่มเติม ' + gradeNo, group: 'math', periods: 2 },
      { key: 'sci' + gradeNo, code: 'ว' + c + '101', name: 'วิทยาศาสตร์ ' + gradeNo, group: 'sci', periods: 3, core: true },
      { key: 'scilab' + gradeNo, code: 'ว' + c + '281', name: 'ปฏิบัติการวิทยาศาสตร์ ' + gradeNo, group: 'sci', periods: 2, double: 'STRICT', room: 'scilab' },
      { key: 'comp' + gradeNo, code: 'ว' + c + '104', name: 'วิทยาการคำนวณ ' + gradeNo, group: 'sci', periods: 2, double: 'PREFERRED', room: 'computer' },
      { key: 'social' + gradeNo, code: 'ส' + c + '101', name: 'สังคมศึกษา ' + gradeNo, group: 'social', periods: 3 },
      { key: 'hist' + gradeNo, code: 'ส' + c + '102', name: 'ประวัติศาสตร์ ' + gradeNo, group: 'social', periods: 1 },
      { key: 'eng' + gradeNo, code: 'อ' + c + '101', name: 'ภาษาอังกฤษ ' + gradeNo, group: 'foreign', periods: 3, core: true },
      { key: 'engc' + gradeNo, code: 'อ' + c + '201', name: 'ภาษาอังกฤษเพื่อการสื่อสาร ' + gradeNo, group: 'foreign', periods: 1 }
    ];
  }

  var LOWER_SHARED = [
    { key: 'healthL', code: 'พ20101', name: 'สุขศึกษา', group: 'health', periods: 1 },
    { key: 'peL', code: 'พ20102', name: 'พลศึกษา', group: 'health', periods: 1, room: 'pe' },
    { key: 'artL', code: 'ศ20101', name: 'ทัศนศิลป์', group: 'art', periods: 1, room: 'art' },
    { key: 'musicL', code: 'ศ20102', name: 'ดนตรี-นาฏศิลป์', group: 'art', periods: 1, room: 'music' },
    { key: 'workL', code: 'ง20101', name: 'การงานอาชีพ', group: 'work', periods: 1 },
    { key: 'chineseL', code: 'จ20101', name: 'ภาษาจีนพื้นฐาน', group: 'foreign', periods: 1 },
    { key: 'guideL', code: 'ก20101', name: 'แนะแนว', group: 'activity', periods: 1, activity: true },
    { key: 'clubL', code: 'ก20102', name: 'กิจกรรมพัฒนาผู้เรียน', group: 'activity', periods: 1, activity: true }
  ];

  var LAB_NAMES = { 4: 'ปฏิบัติการฟิสิกส์', 5: 'ปฏิบัติการเคมี', 6: 'ปฏิบัติการชีววิทยา' };

  /* วิชาเฉพาะระดับชั้น ม.4–ม.6 */
  function upperGradeSubjects(gradeNo) {
    var c = codeBase(gradeNo);
    return [
      { key: 'thai' + gradeNo, code: 'ท' + c + '101', name: 'ภาษาไทย ' + gradeNo, group: 'thai', periods: 2, core: true },
      { key: 'math' + gradeNo, code: 'ค' + c + '101', name: 'คณิตศาสตร์พื้นฐาน ' + gradeNo, group: 'math', periods: 2, core: true },
      { key: 'mathx' + gradeNo, code: 'ค' + c + '201', name: 'คณิตศาสตร์เพิ่มเติม ' + gradeNo, group: 'math', periods: 3, core: true },
      { key: 'phys' + gradeNo, code: 'ว' + c + '201', name: 'ฟิสิกส์ ' + gradeNo, group: 'sci', periods: 3, core: true },
      { key: 'chem' + gradeNo, code: 'ว' + c + '221', name: 'เคมี ' + gradeNo, group: 'sci', periods: 3 },
      { key: 'bio' + gradeNo, code: 'ว' + c + '241', name: 'ชีววิทยา ' + gradeNo, group: 'sci', periods: 3 },
      { key: 'scilab' + gradeNo, code: 'ว' + c + '281', name: LAB_NAMES[gradeNo], group: 'sci', periods: 2, double: 'STRICT', room: 'scilab' },
      { key: 'comp' + gradeNo, code: 'ว' + c + '104', name: 'วิทยาการคำนวณ ' + gradeNo, group: 'sci', periods: 2, double: 'PREFERRED', room: 'computer' },
      { key: 'social' + gradeNo, code: 'ส' + c + '101', name: 'สังคมศึกษา ' + gradeNo, group: 'social', periods: 2 },
      { key: 'eng' + gradeNo, code: 'อ' + c + '101', name: 'ภาษาอังกฤษ ' + gradeNo, group: 'foreign', periods: 3, core: true }
    ];
  }

  var UPPER_SHARED = [
    { key: 'engxU', code: 'อ30201', name: 'ภาษาอังกฤษเพิ่มเติม', group: 'foreign', periods: 1 },
    { key: 'peU', code: 'พ30101', name: 'สุขศึกษาและพลศึกษา', group: 'health', periods: 1, room: 'pe' },
    { key: 'artU', code: 'ศ30101', name: 'ศิลปะ', group: 'art', periods: 1, room: 'art' },
    { key: 'workU', code: 'ง30101', name: 'การงานอาชีพ', group: 'work', periods: 1 },
    { key: 'guideU', code: 'ก30101', name: 'แนะแนว', group: 'activity', periods: 1, activity: true },
    { key: 'electiveU', code: 'ก30201', name: 'วิชาเลือกเสรี', group: 'activity', periods: 2, elective: true }
  ];

  function build() {
    var rnd = U.makeRandom(20690831);
    var state = store.emptyState();
    var now = new Date().toISOString();
    function stamp(obj) { obj.createdAt = now; obj.updatedAt = now; return obj; }

    /* ---------- โรงเรียน ---------- */
    state.school = stamp({
      id: 'school',
      name: 'โรงเรียนสมมติวิทยาคม',
      logoData: sampleLogo(),
      directorName: 'นายวิชัย ปัญญาเลิศ',
      academicYear: 2569,
      semester: 1
    });

    /* ---------- ผังคาบรายวัน (วันศุกร์เลิกเร็วกว่าวันอื่น) ---------- */
    var days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    var dayPlans = {};
    days.forEach(function (d) {
      var count = d === 'FRI' ? 8 : 9;
      dayPlans[d] = { periods: store.buildDayPeriods(count, 5, 8 * 60 + 30, 50, 50) };
    });
    state.periodConfig = { days: days, dayPlans: dayPlans, morningEndsAtPeriod: 4 };

    /* ---------- เงื่อนไขการจัด ---------- */
    state.conditions = store.defaultConditions();

    /* ---------- อาคาร ---------- */
    var buildingDefs = [
      { key: 'b1', name: 'อาคาร 1 เฉลิมพระเกียรติ' },
      { key: 'b2', name: 'อาคาร 2 ศรีสมมติ' },
      { key: 'b3', name: 'อาคาร 3 ราชพฤกษ์' },
      { key: 'b4', name: 'อาคารวิทยาศาสตร์' },
      { key: 'b5', name: 'อาคารกิจกรรมและพลศึกษา' }
    ];
    var buildingId = {};
    buildingDefs.forEach(function (b, i) {
      var rec = stamp({ id: U.uid('bd'), name: b.name, order: i + 1 });
      buildingId[b.key] = rec.id;
      state.buildings.push(rec);
    });

    /* ---------- ประเภทห้อง ---------- */
    var roomTypeId = {};
    ROOM_TYPES.forEach(function (rt) {
      var rec = stamp({ id: U.uid('rt'), name: rt.name, isGeneral: rt.isGeneral });
      roomTypeId[rt.key] = rec.id;
      state.roomTypes.push(rec);
    });

    /* ---------- ระดับชั้น ---------- */
    var gradeId = {};
    var gradeNoById = {};
    for (var p = 1; p <= 6; p++) {
      state.gradeLevels.push(stamp({ id: U.uid('gl'), name: 'ป.' + p, order: p }));
    }
    for (var g = 1; g <= 6; g++) {
      var grec = stamp({ id: U.uid('gl'), name: 'ม.' + g, order: g + 6 });
      gradeId[g] = grec.id;
      gradeNoById[grec.id] = g;
      state.gradeLevels.push(grec);
    }

    /* ห้องเรียนประจำ 60 ห้อง — แต่ละระดับชั้นใช้ 2 ชั้นของอาคารเดียวกัน ชั้นละ 5 ห้อง */
    var homeRoomPlan = [
      { grade: 1, building: 'b1', floors: [{ floor: 1, base: 111 }, { floor: 2, base: 121 }] },
      { grade: 2, building: 'b1', floors: [{ floor: 3, base: 131 }, { floor: 4, base: 141 }] },
      { grade: 3, building: 'b2', floors: [{ floor: 1, base: 211 }, { floor: 2, base: 221 }] },
      { grade: 4, building: 'b2', floors: [{ floor: 3, base: 231 }, { floor: 4, base: 241 }] },
      { grade: 5, building: 'b3', floors: [{ floor: 1, base: 311 }, { floor: 2, base: 321 }] },
      { grade: 6, building: 'b3', floors: [{ floor: 3, base: 331 }, { floor: 4, base: 341 }] }
    ];
    var homeRoomOf = {};
    homeRoomPlan.forEach(function (plan) {
      var seq = 0;
      plan.floors.forEach(function (fl) {
        for (var i = 0; i < 5; i++) {
          seq++;
          var room = stamp({
            id: U.uid('rm'),
            name: String(fl.base + i),
            buildingId: buildingId[plan.building],
            floor: fl.floor,
            roomTypeId: roomTypeId.general,
            capacity: 45
          });
          state.rooms.push(room);
          homeRoomOf['ม.' + plan.grade + '/' + seq] = room.id;
        }
      });
    });

    /* ห้องพิเศษ 18 ห้อง */
    var specialPlan = [
      { type: 'scilab', building: 'b4', floor: 1, prefix: 'ปฏิบัติการวิทย์ ', count: 5, capacity: 40 },
      { type: 'computer', building: 'b4', floor: 2, prefix: 'คอมพิวเตอร์ ', count: 5, capacity: 40 },
      { type: 'pe', building: 'b5', floor: 1, prefix: 'พลศึกษา ', count: 3, capacity: 60 },
      { type: 'art', building: 'b5', floor: 1, prefix: 'ศิลปะ ', count: 3, capacity: 40 },
      { type: 'music', building: 'b5', floor: 2, prefix: 'ดนตรี ', count: 2, capacity: 40 }
    ];
    specialPlan.forEach(function (plan) {
      for (var i = 1; i <= plan.count; i++) {
        state.rooms.push(stamp({
          id: U.uid('rm'),
          name: plan.prefix + i,
          buildingId: buildingId[plan.building],
          floor: plan.floor,
          roomTypeId: roomTypeId[plan.type],
          capacity: plan.capacity
        }));
      }
    });

    /* ---------- กลุ่มสาระ ---------- */
    var groupId = {};
    GROUPS.forEach(function (grp) {
      var rec = stamp({ id: U.uid('sg'), name: grp.name, color: grp.color });
      groupId[grp.key] = rec.id;
      state.subjectGroups.push(rec);
    });

    /* ---------- รายวิชา ---------- */
    var subjectId = {};
    function addSubject(def) {
      var rec = stamp({
        id: U.uid('sj'),
        code: def.code,
        name: def.name,
        shortName: def.short || U.abbreviate(def.name, 10),
        subjectGroupId: groupId[def.group],
        gradeLevelId: gradeId[def.gradeNo] || '',
        isCore: !!def.core,
        doubleMode: def.double || 'NONE',
        isElective: !!def.elective,
        isActivity: !!def.activity,
        requiredRoomTypeId: roomTypeId[def.room || 'general'],
        color: GROUPS.filter(function (x) { return x.key === def.group; })[0].color
      });
      subjectId[def.key + '|' + def.gradeNo] = rec.id;
      state.subjects.push(rec);
      return rec;
    }

    var lowerGradeDefs = {};
    [1, 2, 3].forEach(function (gn) {
      lowerGradeDefs[gn] = lowerGradeSubjects(gn);
      lowerGradeDefs[gn].forEach(function (def) { def.gradeNo = gn; });
      lowerGradeDefs[gn].forEach(addSubject);
    });
    [1, 2, 3].forEach(function (gn) {
      LOWER_SHARED.forEach(function (def) {
        var copy = U.deepClone(def);
        copy.gradeNo = gn;
        addSubject(copy);
      });
    });
    var upperGradeDefs = {};
    [4, 5, 6].forEach(function (gn) {
      upperGradeDefs[gn] = upperGradeSubjects(gn);
      upperGradeDefs[gn].forEach(function (def) { def.gradeNo = gn; });
      upperGradeDefs[gn].forEach(addSubject);
    });
    [4, 5, 6].forEach(function (gn) {
      UPPER_SHARED.forEach(function (def) {
        var copy = U.deepClone(def);
        copy.gradeNo = gn;
        addSubject(copy);
      });
    });

    /* ---------- ครู ---------- */
    var usedNames = {};
    var nameIndex = 0;
    function nextName() {
      var attempts = 0;
      while (attempts < 5000) {
        var f = FIRST_NAMES[nameIndex % FIRST_NAMES.length];
        var l = LAST_NAMES[Math.floor(nameIndex / FIRST_NAMES.length + nameIndex * 7) % LAST_NAMES.length];
        nameIndex++;
        attempts++;
        var full = f + ' ' + l;
        if (!usedNames[full]) { usedNames[full] = true; return full; }
      }
      nameIndex++;
      return 'ครูสมมติ ' + nameIndex;
    }

    var allDays = days.slice();
    var teachersByGroup = {};
    /* ครูที่มาสอนไม่ครบสัปดาห์ 4 คน (ทดสอบกฎ H5) */
    var partTimePlan = [
      { group: 'art', days: ['MON', 'WED', 'FRI'] },
      { group: 'work', days: ['TUE', 'THU', 'FRI'] },
      { group: 'foreign', days: ['MON', 'TUE', 'THU'] },
      { group: 'activity', days: ['WED', 'THU', 'FRI'] }
    ];
    var partTimeUsed = {};

    GROUPS.forEach(function (grp) {
      teachersByGroup[grp.key] = [];
      for (var i = 0; i < grp.teachers; i++) {
        var tdays = allDays.slice();
        var maxDay = 6;
        var maxWeek = 25;
        var pt = partTimePlan.filter(function (p) { return p.group === grp.key; })[0];
        if (pt && i === 0 && !partTimeUsed[grp.key]) {
          partTimeUsed[grp.key] = true;
          tdays = pt.days.slice();
          maxDay = 6;
          maxWeek = 16;
        }
        var name = nextName();
        var rec = stamp({
          id: U.uid('tc'),
          name: name,
          shortName: U.teacherShort(name),
          subjectGroupId: groupId[grp.key],
          availableDays: tdays,
          maxPeriodsPerDay: maxDay,
          maxPeriodsPerWeek: maxWeek,
          unavailableSlots: []
        });
        state.teachers.push(rec);
        teachersByGroup[grp.key].push(rec);
      }
    });

    /* คาบที่ไม่สะดวกสอนของครูบางคน (ยังมีเวลาว่างเหลือมาก) */
    var busyPicks = [3, 11, 24, 37, 48, 59, 71, 88, 96, 104];
    busyPicks.forEach(function (idx, k) {
      var t = state.teachers[idx];
      if (!t) return;
      var day = allDays[(k + 1) % 5];
      if (t.availableDays.indexOf(day) === -1) day = t.availableDays[0];
      t.unavailableSlots = [{ day: day, periodNo: 8 }];
    });

    /* ---------- ชั้นเรียน ---------- */
    var sectionByName = {};
    for (var gn = 1; gn <= 6; gn++) {
      for (var s = 1; s <= 10; s++) {
        var sectionName = 'ม.' + gn + '/' + s;
        var note = '';
        if (s === 1 && gn <= 3) note = 'ห้องเรียนพิเศษภาษาอังกฤษ (EP)';
        if (s === 1 && gn >= 4) note = 'ห้องเรียนพิเศษวิทย์-คณิต';
        var srec = stamp({
          id: U.uid('cs'),
          name: sectionName,
          gradeLevelId: gradeId[gn],
          studentCount: 30 + Math.floor(rnd() * 12),
          homeRoomId: homeRoomOf[sectionName],
          curriculumId: '',
          note: note
        });
        state.classSections.push(srec);
        sectionByName[sectionName] = srec;
      }
    }

    /* ---------- หลักสูตร (12 ชุด: ชุดทั่วไปและชุดห้องเรียนพิเศษของแต่ละระดับชั้น) ---------- */
    function baseItems(gradeNo) {
      var list = [];
      var own = gradeNo <= 3 ? lowerGradeDefs[gradeNo] : upperGradeDefs[gradeNo];
      var shared = gradeNo <= 3 ? LOWER_SHARED : UPPER_SHARED;
      own.forEach(function (d) { list.push({ key: d.key, periods: d.periods }); });
      shared.forEach(function (d) { list.push({ key: d.key, periods: d.periods }); });
      return list;
    }
    function applyChanges(list, changes) {
      Object.keys(changes || {}).forEach(function (key) {
        var hit = list.filter(function (x) { return x.key === key; })[0];
        if (hit) hit.periods = changes[key];
      });
      return list.filter(function (x) { return x.periods > 0; });
    }
    /* สร้างชุดหลักสูตรหนึ่งชุด แล้วผูกกับชั้นเรียนที่เลือกใช้ */
    function addCurriculum(name, gradeNo, note, items, sectionNames) {
      var cur = stamp({
        id: U.uid('cu'), name: name, gradeLevelId: gradeId[gradeNo], note: note
      });
      state.curricula.push(cur);
      items.forEach(function (it) {
        state.curriculumItems.push(stamp({
          id: U.uid('ci'),
          curriculumId: cur.id,
          subjectId: subjectId[it.key + '|' + gradeNo],
          periodsPerWeek: it.periods
        }));
      });
      sectionNames.forEach(function (nm) {
        if (sectionByName[nm]) sectionByName[nm].curriculumId = cur.id;
      });
      return cur;
    }
    function sectionRange(gradeNo, from, to) {
      var names = [];
      for (var i = from; i <= to; i++) names.push('ม.' + gradeNo + '/' + i);
      return names;
    }

    /* ม.1–ม.3 : ชุดทั่วไป และชุดห้องเรียนพิเศษภาษาอังกฤษ */
    [1, 2, 3].forEach(function (gradeNo) {
      addCurriculum('หลักสูตร ม.' + gradeNo + ' ทั่วไป', gradeNo,
        'หลักสูตรแกนกลางของระดับชั้น ม.' + gradeNo,
        applyChanges(baseItems(gradeNo), {}),
        sectionRange(gradeNo, 2, 10));
      var ep = { chineseL: 0, workL: 0 };
      ep['engc' + gradeNo] = 3;
      addCurriculum('หลักสูตร ม.' + gradeNo + ' ห้องเรียนพิเศษ EP', gradeNo,
        'เพิ่มภาษาอังกฤษเพื่อการสื่อสาร งดภาษาจีนและการงานอาชีพ',
        applyChanges(baseItems(gradeNo), ep),
        ['ม.' + gradeNo + '/1']);
    });

    /* ม.4–ม.6 : ชุดทั่วไป และชุดห้องเรียนพิเศษวิทย์-คณิต
       ม.6 ลดสังคมศึกษาลง 1 คาบ เพราะมีคาบแนะแนวเตรียมสอบที่ล็อกไว้ทั้งระดับชั้น */
    [4, 5, 6].forEach(function (gradeNo) {
      var trim = {};
      if (gradeNo === 6) trim['social' + gradeNo] = 1;
      var general = {};
      Object.keys(trim).forEach(function (k) { general[k] = trim[k]; });
      addCurriculum('หลักสูตร ม.' + gradeNo + ' ทั่วไป', gradeNo,
        'หลักสูตรแกนกลางของระดับชั้น ม.' + gradeNo,
        applyChanges(baseItems(gradeNo), general),
        sectionRange(gradeNo, 2, 10));

      var special = { workU: 0 };
      special['mathx' + gradeNo] = 4;
      Object.keys(trim).forEach(function (k) { special[k] = trim[k]; });
      addCurriculum('หลักสูตร ม.' + gradeNo + ' ห้องเรียนพิเศษวิทย์-คณิต', gradeNo,
        'เพิ่มคณิตศาสตร์เพิ่มเติม 1 คาบ งดการงานอาชีพ',
        applyChanges(baseItems(gradeNo), special),
        ['ม.' + gradeNo + '/1']);
    });

    /* ---------- คาบล็อกแบบกันช่อง 5 รายการ ---------- */
    state.lockedSlots.push(stamp({
      id: U.uid('lk'), kind: 'BLOCK', assignmentId: '',
      scope: 'SCHOOL', targetId: '', day: 'MON', periodNo: 1,
      subjectId: '', teacherId: '', roomId: '',
      label: 'กิจกรรมหน้าเสาธงและโฮมรูม', reason: 'กิจกรรมประจำสัปดาห์ของทั้งโรงเรียน'
    }));
    state.lockedSlots.push(stamp({
      id: U.uid('lk'), kind: 'BLOCK', assignmentId: '',
      scope: 'SCHOOL', targetId: '', day: 'WED', periodNo: 9,
      subjectId: '', teacherId: '', roomId: '',
      label: 'ประชุมครูประจำสัปดาห์', reason: 'ครูทุกคนต้องเข้าประชุม จึงไม่จัดคาบสอน'
    }));
    state.lockedSlots.push(stamp({
      id: U.uid('lk'), kind: 'BLOCK', assignmentId: '',
      scope: 'SCHOOL', targetId: '', day: 'THU', periodNo: 9,
      subjectId: '', teacherId: '', roomId: '',
      label: 'กิจกรรมชุมนุม', reason: 'นักเรียนแยกไปตามชุมนุมที่เลือกไว้'
    }));
    state.lockedSlots.push(stamp({
      id: U.uid('lk'), kind: 'BLOCK', assignmentId: '',
      scope: 'GRADE', targetId: gradeId[6], day: 'TUE', periodNo: 9,
      subjectId: '', teacherId: '', roomId: '',
      label: 'แนะแนวเตรียมสอบเข้ามหาวิทยาลัย', reason: 'กิจกรรมเฉพาะระดับชั้น ม.6'
    }));
    state.lockedSlots.push(stamp({
      id: U.uid('lk'), kind: 'BLOCK', assignmentId: '',
      scope: 'TEACHER', targetId: state.teachers[0].id, day: 'FRI', periodNo: 8,
      subjectId: '', teacherId: '', roomId: '',
      label: 'ประชุมหัวหน้ากลุ่มสาระ', reason: 'ครูคนนี้ติดประชุมทุกวันศุกร์คาบ 8'
    }));

    /* ---------- การมอบหมายสอน ---------- */
    var M = global.ST.model;
    M.syncAssignments(state);

    var loadByTeacher = {};
    state.teachers.forEach(function (t) { loadByTeacher[t.id] = 0; });
    function capacityOf(t) {
      return Math.min(U.num(t.maxPeriodsPerWeek), t.availableDays.length * U.num(t.maxPeriodsPerDay));
    }
    /* เลือกครูที่ยังมีที่ว่างมากที่สุดในกลุ่มสาระนั้น */
    function pickTeacher(groupKey, periods, excludeId) {
      var pool = teachersByGroup[groupKey] || [];
      var best = null, bestRatio = 2;
      for (var i = 0; i < pool.length; i++) {
        var t = pool[i];
        if (t.id === excludeId) continue;
        var cap = capacityOf(t);
        if (loadByTeacher[t.id] + periods > cap) continue;
        var ratio = (loadByTeacher[t.id] + periods) / cap;
        if (ratio < bestRatio) { bestRatio = ratio; best = t; }
      }
      if (!best) {
        /* ถ้ากลุ่มสาระเต็ม ให้หาครูคนใดก็ได้ที่ยังว่างพอ */
        for (var j = 0; j < state.teachers.length; j++) {
          var t2 = state.teachers[j];
          if (t2.id === excludeId) continue;
          if (loadByTeacher[t2.id] + periods <= capacityOf(t2)) { best = t2; break; }
        }
      }
      return best;
    }

    var subjectById = U.indexById(state.subjects);
    var groupKeyByGroupId = {};
    GROUPS.forEach(function (grp) { groupKeyByGroupId[groupId[grp.key]] = grp.key; });

    /* เรียงงานให้วิชาที่มีคาบมากได้เลือกครูก่อน */
    var orderedAssignments = state.assignments.slice().sort(function (a, b) {
      return b.periodsPerWeek - a.periodsPerWeek;
    });

    var electiveTeacherPool = [];
    state.teachers.forEach(function (t, i) { if (i % 4 === 1) electiveTeacherPool.push(t); });
    var electiveCursor = {};

    orderedAssignments.forEach(function (a) {
      var subject = subjectById[a.subjectId];
      var section = U.byId(state.classSections, a.classSectionId);
      var teacher;
      if (subject.isElective) {
        /* วิชาเลือกเสรี: ทุกห้องในระดับชั้นเรียนพร้อมกัน จึงต้องใช้ครูคนละคน */
        var gradeKey = section.gradeLevelId;
        if (electiveCursor[gradeKey] === undefined) electiveCursor[gradeKey] = 0;
        var offset = (Object.keys(electiveCursor).indexOf(gradeKey) * 10);
        teacher = electiveTeacherPool[(offset + electiveCursor[gradeKey]) % electiveTeacherPool.length];
        electiveCursor[gradeKey]++;
      } else {
        teacher = pickTeacher(groupKeyByGroupId[subject.subjectGroupId], a.periodsPerWeek);
      }
      if (!teacher) teacher = state.teachers[0];
      a.teacherId = teacher.id;
      loadByTeacher[teacher.id] += a.periodsPerWeek;

      /* ห้องที่ใช้: วิชาทั่วไปใช้ห้องประจำของชั้นเรียน วิชาที่ต้องใช้ห้องพิเศษให้ระบบเลือกเอง */
      if (subject.requiredRoomTypeId === roomTypeId.general) a.roomId = section.homeRoomId;
      else a.roomId = '';
    });

    /* ครูสอนร่วม 2 คน 6 รายการ (ทดสอบกฎ D4) */
    var labAssignments = state.assignments.filter(function (a) {
      var subj = subjectById[a.subjectId];
      return subj.doubleMode === 'STRICT';
    });
    var coCount = 0;
    for (var li = 0; li < labAssignments.length && coCount < 6; li += 9) {
      var a2 = labAssignments[li];
      var subj2 = subjectById[a2.subjectId];
      var co = pickTeacher(groupKeyByGroupId[subj2.subjectGroupId], a2.periodsPerWeek, a2.teacherId);
      if (co && co.id !== a2.teacherId) {
        a2.coTeacherId = co.id;
        loadByTeacher[co.id] += a2.periodsPerWeek;
        coCount++;
      }
    }

    /* ---------- คาบล็อกแบบปักหมุดวิชาที่จัดไว้ 3 รายการ ---------- */
    function pinSubject(sectionName, subjectKey, day, periodNo, reason) {
      var section = sectionByName[sectionName];
      if (!section) return;
      var gradeNo = gradeNoById[section.gradeLevelId];
      var a = state.assignments.filter(function (x) {
        return x.classSectionId === section.id && x.subjectId === subjectId[subjectKey + '|' + gradeNo];
      })[0];
      if (!a) return;
      var subject = subjectById[a.subjectId];
      state.lockedSlots.push(stamp({
        id: U.uid('lk'), kind: 'SUBJECT', assignmentId: a.id,
        scope: 'SECTION', targetId: section.id, day: day, periodNo: periodNo,
        subjectId: a.subjectId, teacherId: a.teacherId, roomId: a.roomId || '',
        label: section.name + ' · ' + subject.name, reason: reason
      }));
    }
    pinSubject('ม.1/1', 'guideL', 'MON', 2, 'ครูที่ปรึกษาพบนักเรียนต้นสัปดาห์');
    pinSubject('ม.3/1', 'clubL', 'TUE', 2, 'กิจกรรมพัฒนาผู้เรียนของห้องเรียนพิเศษ ตรึงไว้ที่คาบนี้');
    pinSubject('ม.5/2', 'guideU', 'WED', 2, 'นัดหมายแนะแนวประจำห้อง');

    state.meta.sampleLoaded = true;
    state.meta.createdAt = now;
    return state;
  }

  /* ตราโรงเรียนสมมติแบบฝังในข้อมูล */
  function sampleLogo() {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">' +
      '<circle cx="60" cy="60" r="56" fill="#ffffff" stroke="#1e3a8a" stroke-width="4"/>' +
      '<circle cx="60" cy="60" r="46" fill="none" stroke="#5b50ef" stroke-width="2"/>' +
      '<path d="M60 28 L86 44 L60 60 L34 44 Z" fill="#5b50ef"/>' +
      '<path d="M42 52 v16 c0 8 8 14 18 14 s18-6 18-14 v-16" fill="none" stroke="#1e3a8a" stroke-width="4"/>' +
      '<text x="60" y="104" font-size="13" text-anchor="middle" fill="#1e3a8a" font-family="sans-serif">SAMMOT</text>' +
      '</svg>';
    return 'data:image/svg+xml;base64,' + toBase64(svg);
  }

  function toBase64(text) {
    if (typeof btoa === 'function') {
      return btoa(unescape(encodeURIComponent(text)));
    }
    return Buffer.from(text, 'utf8').toString('base64');
  }

  global.ST.mockdata = { build: build };
})(typeof window !== 'undefined' ? window : globalThis);
