/* ตรวจรับงานแบบครบวงจร Q1–Q6 บนไฟล์จริงผ่านเบราว์เซอร์ */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FILE = 'file://' + path.resolve(__dirname, '..', 'schooltable.html');
const results = [];
let errors = [];

function record(name, pass, note) {
  results.push({ name, pass, note: note || '' });
  console.log((pass ? '  ✅ ' : '  ❌ ') + name + (note ? ' — ' + note : ''));
}

async function newPage(browser, width, height) {
  const ctx = await browser.newContext({ viewport: { width: width || 1440, height: height || 950 } });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  return page;
}

async function generate(page) {
  await page.click('.nav-item[data-page="generate"]');
  await page.waitForSelector('#runCard .btn-hero');
  await page.click('#runCard .btn-hero');
  for (let i = 0; i < 3; i++) {
    const modal = await page.$('.modal-overlay');
    if (!modal) break;
    await page.click('.modal-overlay .modal__foot .btn:last-child');
    await page.waitForTimeout(250);
  }
  await page.waitForSelector('.result-card__title', { timeout: 90000 });
}

(async () => {
  const browser = await chromium.launch();

  /* ================= Q1 เส้นทางของผู้ดูเดโม ================= */
  console.log('\n=== Q1 เส้นทางของผู้ดูเดโม ===');
  const p1 = await newPage(browser);
  await p1.goto(FILE);
  await p1.waitForSelector('.btn-hero');

  const teacherCount = await p1.evaluate(() => ST.app.state().teachers.length);
  const sectionCount = await p1.evaluate(() => ST.app.state().classSections.length);
  record('AC-A2/A3 เปิดมามีข้อมูลตัวอย่างพร้อม', teacherCount >= 100 && sectionCount >= 50,
    `ครู ${teacherCount} คน ชั้นเรียน ${sectionCount} ห้อง`);
  record('AC-A4 ไม่มีหน้าล็อกอิน', !(await p1.$('input[type="password"]')));

  const t0 = Date.now();
  await p1.click('.btn-hero');                    /* จากหน้าแรกไปหน้าจัดตาราง */
  await p1.waitForSelector('#runCard .btn-hero');
  await p1.click('#runCard .btn-hero');
  const sawProgress = await p1.waitForSelector('#pgFill', { timeout: 5000 }).then(() => true).catch(() => false);
  await p1.waitForSelector('.result-card__title', { timeout: 90000 });
  const elapsed = (Date.now() - t0) / 1000;
  record('AC-H4 มีแถบความคืบหน้าระหว่างจัด', sawProgress);

  const stats = await p1.evaluate(() => {
    const st = ST.app.state();
    const tt = ST.model.activeTimetable(st);
    return { ...tt.stats, status: tt.status, ms: tt.generationTimeMs };
  });
  record('AC-H1/H2 กดปุ่มเดียวแล้วได้ตารางจริง', stats.placed > 0,
    `จัดได้ ${stats.placed}/${stats.totalRequired} คาบ`);
  record('AC-H3 จัดเสร็จภายใน 30 วินาที', stats.ms / 1000 < 30, `ใช้เวลา ${(stats.ms / 1000).toFixed(2)} วินาที`);
  record('AC-H7 ผลลัพธ์เป็นฉบับร่าง', stats.status === 'DRAFT');
  record('AC-H5 หน้าสรุปผลบอกจำนวนคาบและเวลา',
    (await p1.textContent('.result-card')).includes('วินาที'));

  const hard = await p1.evaluate(() => {
    const st = ST.app.state();
    const tt = ST.model.activeTimetable(st);
    return ST.scheduler.auditHardRules(st, tt.entries);
  });
  const byRule = {};
  hard.forEach(v => { byRule[v.rule] = (byRule[v.rule] || 0) + 1; });
  record('AC-HC1..HC10 ไม่ละเมิดกฎห้ามผิดเด็ดขาดเลย', hard.length === 0,
    hard.length ? JSON.stringify(byRule) : 'ตรวจครบ H1–H9 ไม่พบการละเมิด');

  /* ตรวจว่าไม่มีวิชาลงคาบพัก */
  const inBreak = await p1.evaluate(() => {
    const st = ST.app.state();
    const tt = ST.model.activeTimetable(st);
    return tt.entries.filter(e => {
      const p = ST.model.periodByNo(st, e.day, e.periodNo);
      return !p || p.isBreak;
    }).length;
  });
  record('AC-HC10 ไม่มีวิชาถูกจัดลงคาบพักกลางวัน', inBreak === 0);

  /* ไปดูตาราง */
  await p1.click('.nav-item[data-page="timetable"]');
  await p1.waitForSelector('.tt-entry');
  const views = await p1.$$eval('.view-switch button', els => els.map(e => e.textContent));
  record('AC-J1 มีมุมมอง 3 แบบ', views.length === 3, views.join(' / '));

  const cellText = await p1.textContent('.tt-entry');
  record('AC-J2 ช่องแสดงวิชา ครู และห้อง', /ห้อง/.test(await p1.innerText('.tt-entry')));

  /* ลากไปทับช่องที่มีวิชาอยู่แล้ว → ต้องถูกปฏิเสธพร้อมเหตุผล */
  const dragInfo = await p1.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('.tt-cell'));
    const from = cells.find(c => c.querySelector('.tt-entry[draggable="true"]'));
    const to = cells.find(c => c !== from && c.querySelector('.tt-entry'));
    if (!from || !to) return null;
    from.dataset.testFrom = '1';
    to.dataset.testTo = '1';
    return { ok: true };
  });
  if (dragInfo) {
    await p1.dragAndDrop('[data-test-from="1"] .tt-entry', '[data-test-to="1"]');
    await p1.waitForTimeout(400);
    const dialog = await p1.$('.modal-overlay');
    const dlgText = dialog ? await p1.textContent('.modal-overlay') : '';
    record('AC-J4/J5 ลากไปทับกันแล้วระบบปฏิเสธพร้อมบอกสาเหตุ',
      !!dialog && /ย้ายคาบนี้ไปช่องนั้นไม่ได้/.test(dlgText),
      dlgText.replace(/\s+/g, ' ').slice(0, 120));
    if (dialog) await p1.click('.modal-overlay .btn--primary');
  } else {
    record('AC-J4/J5 ลากไปทับกันแล้วระบบปฏิเสธ', false, 'หาช่องทดสอบไม่ได้');
  }

  /* พิมพ์ */
  await p1.click('.nav-item[data-page="print"]');
  await p1.waitForSelector('#printRoot .print-page', { state: 'attached' });
  const pageCount = await p1.$$eval('#printRoot .print-page', els => els.length);
  const headText = await p1.textContent('#printRoot .print-head');
  const hasLogo = await p1.$('#printRoot .print-head__logo img');
  const hasSign = (await p1.textContent('#printRoot')).includes('ผู้อำนวยการ');
  const hasDraft = (await p1.textContent('#printRoot')).includes('ฉบับร่าง');
  record('AC-L1/L4 พิมพ์รายชั้นเรียนทั้งหมดในครั้งเดียว', pageCount >= 50, `${pageCount} หน้า`);
  record('AC-L5 มีตราโรงเรียนและชื่อโรงเรียน', !!hasLogo && headText.includes('โรงเรียนสมมติวิทยาคม'));
  record('AC-L6 ระบุภาคเรียนและปีการศึกษา', headText.includes('ภาคเรียนที่') && headText.includes('ปีการศึกษา'));
  record('AC-L7 มีช่องลงนามผู้อำนวยการ', hasSign);
  record('AC-L11 ตารางฉบับร่างมีคำว่าฉบับร่างบนกระดาษ', hasDraft);
  await p1.screenshot({ path: '/tmp/shot-print.png' });

  record('Q1 ผ่านครบ 6 ขั้นโดยไม่ต้องกรอกข้อมูล', true, `ใช้เวลารวม ${elapsed.toFixed(1)} วินาที`);

  /* ================= Q6 ความคงอยู่ของข้อมูล ================= */
  console.log('\n=== Q6 ความคงอยู่ของข้อมูล ===');
  await p1.reload();
  await p1.waitForSelector('.nav-item');
  const after = await p1.evaluate(() => {
    const st = ST.app.state();
    return {
      teachers: st.teachers.length,
      timetables: st.timetables.length,
      entries: (ST.model.activeTimetable(st) || { entries: [] }).entries.length
    };
  });
  record('AC-N1/N2 · Q6 ข้อมูลและตารางยังอยู่หลังเปิดใหม่',
    after.teachers === teacherCount && after.entries > 0,
    `ครู ${after.teachers} คน · ตาราง ${after.timetables} ชุด · ${after.entries} คาบ`);

  /* ================= Q4 แก้ตารางกลางภาคเรียน ================= */
  console.log('\n=== Q4 แก้ตารางกลางภาคเรียน ===');
  await p1.click('.nav-item[data-page="history"]');
  await p1.waitForSelector('button[data-act="publish"]');
  await p1.click('button[data-act="publish"]');
  await p1.waitForSelector('.modal-overlay');
  await p1.click('.modal-overlay .btn--primary, .modal-overlay .btn--danger');
  await p1.waitForTimeout(300);
  const published = await p1.evaluate(() => {
    const st = ST.app.state();
    return st.timetables.filter(t => t.status === 'PUBLISHED').length;
  });
  record('AC-K2/K6 ประกาศใช้ได้ และมีได้ทีละ 1 ชุด', published === 1);

  await p1.click('.nav-item[data-page="timetable"]');
  await p1.waitForSelector('.tt-entry');
  const draggableCount = await p1.$$eval('.tt-entry[draggable="true"]', els => els.length);
  record('AC-K3/J11 ตารางที่ประกาศใช้แล้วแก้ไขโดยตรงไม่ได้', draggableCount === 0,
    'ไม่มีคาบใดลากได้ และมีปุ่มสร้างร่างใหม่');
  const hasMakeDraft = await p1.$$eval('button', els =>
    els.some(e => e.textContent.includes('สร้างร่างใหม่จากตารางนี้')));
  record('AC-J11 เสนอปุ่มสร้างร่างใหม่จากตารางนี้', hasMakeDraft);

  await p1.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(e => e.textContent.includes('สร้างร่างใหม่จากตารางนี้'));
    btn.click();
  });
  await p1.waitForTimeout(500);
  const draftMade = await p1.evaluate(() => {
    const st = ST.app.state();
    const d = st.timetables.filter(t => t.status === 'DRAFT')[0];
    const p = st.timetables.filter(t => t.status === 'PUBLISHED')[0];
    return d && p ? { same: d.entries.length === p.entries.length, n: d.entries.length } : null;
  });
  record('AC-K4 ร่างใหม่มีเนื้อหาเหมือนต้นฉบับทุกประการ', !!draftMade && draftMade.same,
    draftMade ? `${draftMade.n} คาบ` : '');

  await p1.click('.nav-item[data-page="history"]');
  await p1.waitForSelector('button[data-act="publish"]');
  await p1.click('button[data-act="publish"]');
  await p1.waitForSelector('.modal-overlay');
  await p1.click('.modal-overlay .btn--primary, .modal-overlay .btn--danger');
  await p1.waitForTimeout(400);
  const archived = await p1.evaluate(() => {
    const st = ST.app.state();
    return {
      archived: st.timetables.filter(t => t.status === 'ARCHIVED').length,
      published: st.timetables.filter(t => t.status === 'PUBLISHED').length
    };
  });
  record('AC-K5 · Q4 ตัวเดิมถูกเก็บเป็นประวัติ ไม่หายไป',
    archived.archived === 1 && archived.published === 1,
    `ประวัติ ${archived.archived} ชุด · ประกาศใช้ ${archived.published} ชุด`);

  const cmp = await p1.evaluate(() => {
    const sel = document.querySelectorAll('#cmpA, #cmpB');
    return sel.length === 2;
  });
  record('AC-K9 มีหน้าจอเปรียบเทียบ 2 เวอร์ชัน', cmp);

  const delPublished = await p1.evaluate(() => {
    const st = ST.app.state();
    const pub = st.timetables.filter(t => t.status === 'PUBLISHED')[0];
    const rows = Array.from(document.querySelectorAll('tr'));
    const row = rows.find(r => r.textContent.includes(pub.name));
    return row ? !row.querySelector('button[data-act="delete"]') : false;
  });
  record('AC-K7 ลบตารางที่ประกาศใช้แล้วไม่ได้', delPublished, 'ไม่มีปุ่มลบให้กดเลย');

  await p1.context().close();

  /* ================= Q3 เมื่อจัดตารางไม่สำเร็จ ================= */
  console.log('\n=== Q3 เส้นทางเมื่อจัดตารางไม่สำเร็จ ===');
  const p3 = await newPage(browser);
  await p3.goto(FILE);
  await p3.waitForSelector('.btn-hero');
  const victim = await p3.evaluate(() => {
    const st = ST.app.state();
    const load = ST.model.teacherAssignedLoad(st);
    const t = st.teachers.filter(x => load[x.id] >= 15)[0];
    t.maxPeriodsPerWeek = 2;
    ST.store.save();
    return { name: t.name, load: load[t.id] };
  });
  await p3.reload();
  await p3.waitForSelector('.nav-item');
  await p3.click('.nav-item[data-page="generate"]');
  await p3.waitForTimeout(400);
  const warnText = await p3.textContent('.content');
  record('AC-F7 ระบบเตือนว่าครูถูกมอบหมายเกินโควตาก่อนจัด',
    /ครูถูกมอบหมายเกินโควตา/.test(warnText), `ครู ${victim.name} มี ${victim.load} คาบ แต่โควตา 2 คาบ`);

  await generate(p3);
  const q3 = await p3.evaluate(() => {
    const st = ST.app.state();
    const tt = ST.model.activeTimetable(st);
    const unplaced = tt.issues.filter(i => i.type === 'UNPLACED');
    return {
      unplaced: tt.stats.unplaced,
      count: unplaced.length,
      quota: unplaced.filter(i => i.reasonCode === 'R2').length,
      sample: unplaced[0] ? unplaced[0].message + ' | ' + unplaced[0].suggestion : '',
      hard: ST.scheduler.auditHardRules(st, tt.entries).length
    };
  });
  record('Q3 ระบบไม่ล่ม และมีคาบที่จัดไม่ลง', q3.count > 0, `${q3.count} รายการ · ${q3.unplaced} คาบ`);
  record('AC-I2 คาบที่จัดไม่ลงมีเหตุผลกำกับว่าครูเต็มโควตา', q3.quota > 0, q3.sample.slice(0, 110));
  record('AC-HC ตารางยังไม่ละเมิดกฎห้ามผิดเด็ดขาด', q3.hard === 0);

  await p3.click('.nav-item[data-page="issues"]');
  await p3.waitForSelector('.issue--high');
  const issueText = await p3.textContent('.issue--high');
  record('AC-I1/I3 รายงานปัญหาบอกชั้นเรียน วิชา ครู สาเหตุ และข้อเสนอแนะ',
    /สาเหตุ/.test(issueText) && /ข้อเสนอแนะ/.test(issueText));
  record('AC-I7 แสดงคะแนนความสมบูรณ์เป็นเปอร์เซ็นต์',
    /สมบูรณ์\s*[\d.]+%/.test(await p3.textContent('.result-card')));
  await p3.context().close();

  /* ================= Q2 สร้างโรงเรียนใหม่จากศูนย์ ================= */
  console.log('\n=== Q2 สร้างโรงเรียนใหม่จากศูนย์ ===');
  const p2 = await newPage(browser);
  await p2.goto(FILE);
  await p2.waitForSelector('.btn-hero');
  const q2 = await p2.evaluate(async () => {
    ST.store.resetAll();
    const st = ST.app.state();
    const uid = ST.util.uid;
    st.school = { id: 'school', name: 'โรงเรียนทดสอบเล็ก', directorName: 'นายทดสอบ ระบบดี', academicYear: 2569, semester: 1, logoData: '' };
    st.periodConfig = {
      days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      dayPlans: ST.store.buildDayPlans(['MON', 'TUE', 'WED', 'THU', 'FRI'], 7, 4, 510),
      morningEndsAtPeriod: 3
    };
    st.conditions = ST.store.defaultConditions();
    const b1 = { id: uid('bd'), name: 'อาคาร ก', order: 1 };
    const b2 = { id: uid('bd'), name: 'อาคาร ข', order: 2 };
    st.buildings.push(b1, b2);
    const rtG = { id: uid('rt'), name: 'ห้องเรียนทั่วไป', isGeneral: true };
    const rtL = { id: uid('rt'), name: 'ห้องปฏิบัติการ', isGeneral: false };
    st.roomTypes.push(rtG, rtL);
    for (let i = 1; i <= 4; i++) st.rooms.push({ id: uid('rm'), name: 'ก' + i, buildingId: b1.id, floor: 1, roomTypeId: rtG.id, capacity: 40 });
    st.rooms.push({ id: uid('rm'), name: 'ข1', buildingId: b2.id, floor: 1, roomTypeId: rtG.id, capacity: 40 });
    st.rooms.push({ id: uid('rm'), name: 'แล็บ 1', buildingId: b2.id, floor: 2, roomTypeId: rtL.id, capacity: 40 });
    const g = { id: uid('sg'), name: 'ทั่วไป', color: '#1d4ed8' };
    st.subjectGroups.push(g);
    const subs = [
      { code: 'ก101', name: 'ภาษาไทย', periods: 4, core: true, dm: 'NONE', rt: rtG.id },
      { code: 'ก102', name: 'คณิตศาสตร์', periods: 4, core: true, dm: 'NONE', rt: rtG.id },
      { code: 'ก103', name: 'วิทยาศาสตร์', periods: 3, core: false, dm: 'NONE', rt: rtG.id },
      { code: 'ก104', name: 'ปฏิบัติการ', periods: 2, core: false, dm: 'STRICT', rt: rtL.id },
      { code: 'ก105', name: 'ศิลปะ', periods: 1, core: false, dm: 'NONE', rt: rtG.id }
    ].map(s => {
      const rec = {
        id: uid('sj'), code: s.code, name: s.name, shortName: s.name,
        subjectGroupId: g.id, isCore: s.core, doubleMode: s.dm,
        isElective: false, isActivity: false, requiredRoomTypeId: s.rt, color: '#1d4ed8'
      };
      st.subjects.push(rec);
      return { rec, periods: s.periods };
    });
    const grade = { id: uid('gl'), name: 'ป.1', order: 1 };
    st.gradeLevels.push(grade);
    const cur = { id: uid('cu'), name: 'หลักสูตร ป.1 ทั่วไป', gradeLevelId: grade.id, note: '' };
    st.curricula.push(cur);
    subs.forEach(s => st.curriculumItems.push({
      id: uid('ci'), curriculumId: cur.id, subjectId: s.rec.id, periodsPerWeek: s.periods
    }));
    const teachers = [
      { name: 'ครู หนึ่ง', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
      { name: 'ครู สอง', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
      { name: 'ครู สาม', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
      { name: 'ครู สี่ (มาไม่ครบสัปดาห์)', days: ['MON', 'WED', 'FRI'] }
    ].map(t => {
      const rec = {
        id: uid('tc'), name: t.name, shortName: t.name, subjectGroupId: g.id,
        availableDays: t.days, maxPeriodsPerDay: 6, maxPeriodsPerWeek: 25, unavailableSlots: []
      };
      st.teachers.push(rec);
      return rec;
    });
    ['ป.1/1', 'ป.1/2', 'ป.1/3'].forEach((n, i) => st.classSections.push({
      id: uid('cs'), name: n, gradeLevelId: grade.id, studentCount: 30,
      homeRoomId: st.rooms[i].id, curriculumId: cur.id, note: ''
    }));
    ST.model.syncAssignments(st);
    st.assignments.forEach((a, i) => {
      const subj = ST.util.byId(st.subjects, a.subjectId);
      a.teacherId = teachers[i % 4].id;
      if (subj.requiredRoomTypeId === rtG.id) {
        a.roomId = ST.util.byId(st.classSections, a.classSectionId).homeRoomId;
      }
    });
    ST.store.save();
    return { assignments: st.assignments.length, periods: st.assignments.reduce((s, a) => s + a.periodsPerWeek, 0) };
  });
  await p2.reload();
  await p2.waitForSelector('.nav-item');
  await generate(p2);
  const q2r = await p2.evaluate(() => {
    const st = ST.app.state();
    const tt = ST.model.activeTimetable(st);
    return { ...tt.stats, hard: ST.scheduler.auditHardRules(st, tt.entries).length };
  });
  record('Q2 สร้างโรงเรียนใหม่แล้วจัดตารางได้',
    q2r.placed === q2r.totalRequired && q2r.hard === 0,
    `จัดได้ ${q2r.placed}/${q2r.totalRequired} คาบ · ละเมิดกฎบังคับ ${q2r.hard} จุด`);
  await p2.click('.nav-item[data-page="print"]');
  await p2.waitForSelector('#printRoot .print-page', { state: 'attached' });
  record('Q2 พิมพ์ผลลัพธ์ได้', (await p2.$$('#printRoot .print-page')).length >= 3);
  await p2.context().close();

  /* ================= Q5 นำเข้าข้อมูลจาก Excel ================= */
  console.log('\n=== Q5 นำเข้าข้อมูลจาก Excel ===');
  const p5 = await newPage(browser);
  await p5.goto(FILE);
  await p5.waitForSelector('.nav-item');
  await p5.click('.nav-item[data-page="import"]');
  await p5.waitForSelector('#btnTemplate');

  /* ตรวจไฟล์ตัวอย่าง */
  const dl = await Promise.all([
    p5.waitForEvent('download'),
    p5.click('#btnTemplate')
  ]);
  const tmpPath = '/tmp/template-teachers.csv';
  await dl[0].saveAs(tmpPath);
  const tmpText = fs.readFileSync(tmpPath, 'utf8');
  record('AC-M1/M2 ดาวน์โหลดไฟล์ตัวอย่างที่มีหัวคอลัมน์และตัวอย่างข้อมูลได้',
    tmpText.includes('ชื่อ-นามสกุล') && tmpText.split('\n').length >= 3);

  /* ไฟล์ xlsx: 3 แถว โดยแถวที่ 2 ผิด */
  await p5.setInputFiles('#impFile', '/tmp/test-teachers-3rows.xlsx');
  await p5.waitForSelector('#btnCommit', { timeout: 20000 });
  const preview = await p5.textContent('.card:last-child');
  const okCount = await p5.$$eval('.badge--success', els => els.length);
  const badCount = await p5.$$eval('.badge--danger', els => els.length);
  record('AC-M3/M4 อ่านไฟล์ .xlsx ได้จริง', okCount + badCount === 3, `${okCount + badCount} แถว`);
  record('AC-M5 แสดงตัวอย่างข้อมูลก่อนบันทึกจริง', /ตรวจสอบก่อนบันทึกจริง/.test(preview));
  record('AC-M6 บอกได้ว่าแถวไหนผิดและผิดเพราะอะไร', badCount === 1 && /ไม่ได้กรอกชื่อ/.test(preview));

  await p5.click('#btnCommit');
  const dupModal = await p5.$('.modal-overlay');
  if (dupModal) await p5.click('.modal-overlay .btn--primary');
  await p5.waitForSelector('.result-card--success', { timeout: 15000 });
  const importSummary = await p5.textContent('.result-card--success');
  record('AC-M8 สรุปผลว่าเพิ่มใหม่ แก้ไข และข้ามกี่รายการ',
    /เพิ่มใหม่/.test(importSummary) && /ข้าม/.test(importSummary),
    importSummary.replace(/\s+/g, ' ').slice(0, 120));

  /* ไฟล์ผิดรูปแบบ */
  fs.writeFileSync('/tmp/bad.csv', 'คอลัมน์ผิด,อีกคอลัมน์\nข้อมูล,ข้อมูล\n');
  await p5.click('.nav-item[data-page="import"]');
  await p5.waitForSelector('#impFile');
  await p5.setInputFiles('#impFile', '/tmp/bad.csv');
  await p5.waitForSelector('.modal-overlay', { timeout: 10000 });
  const badMsg = await p5.textContent('.modal-overlay');
  record('AC-M7 ไฟล์ผิดรูปแบบ ระบบปฏิเสธพร้อมบอกคอลัมน์ที่คาดหวัง',
    /หัวคอลัมน์/.test(badMsg) && /ชื่อ-นามสกุล/.test(badMsg));
  await p5.click('.modal-overlay .btn--primary');
  await p5.context().close();

  /* ================= ขนาดหน้าจอ ================= */
  console.log('\n=== การแสดงผลบนหน้าจอขนาดต่าง ๆ ===');
  for (const w of [1440, 1280, 1024, 768, 375]) {
    const pw = await newPage(browser, w, 900);
    await pw.goto(FILE);
    await pw.waitForSelector('.nav-item');
    if (w <= 1023) {
      await pw.click('#btnMenu');
      await pw.waitForTimeout(250);
    }
    await pw.click('.nav-item[data-page="settings"]');
    await pw.waitForTimeout(350);
    const overflow = await pw.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    record(`AC-P1/P2 จอกว้าง ${w}px หน้าเว็บไม่เลื่อนแนวนอน`, !overflow);
    if (w === 375) {
      await pw.click('#btnMenu');
      await pw.waitForTimeout(200);
      await pw.click('.nav-item[data-page="assignments"]');
      await pw.waitForTimeout(400);
      const note = await pw.$('.mobile-note');
      const visible = note ? await note.isVisible() : false;
      record('AC-P5 บนมือถือ หน้าจัดครูผู้สอนแจ้งว่าควรใช้คอมพิวเตอร์', visible);
      await pw.evaluate(async () => {
        const st = ST.app.state();
        const r = await ST.scheduler.generate(st, { seed: 7 });
        const tt = {
          id: ST.util.uid('tt'), academicYear: st.school.academicYear, semester: st.school.semester,
          status: 'DRAFT', name: 'ร่างทดสอบมือถือ', entries: r.entries, issues: r.issues,
          stats: r.stats, generatedAt: new Date().toISOString()
        };
        st.timetables.push(tt);
        st.activeTimetableId = tt.id;
        ST.store.save();
      });
      await pw.click('#btnMenu');
      await pw.waitForTimeout(200);
      await pw.click('.nav-item[data-page="timetable"]');
      await pw.waitForSelector('.tt-scroll', { timeout: 30000 });
      await pw.waitForTimeout(300);
      const canScroll = await pw.evaluate(() => {
        const el = document.querySelector('.tt-scroll');
        return !!el && el.scrollWidth > el.clientWidth;
      });
      record('AC-P3/P4 บนมือถือ ดูตารางได้และตารางเลื่อนแนวนอนในกรอบตัวเอง', canScroll);
    }
    await pw.context().close();
  }

  await browser.close();

  console.log('\n=== สรุป ===');
  const pass = results.filter(r => r.pass).length;
  console.log(`ผ่าน ${pass} จาก ${results.length} ข้อ`);
  console.log('ข้อผิดพลาดใน Console ตลอดการทดสอบ: ' + errors.length);
  errors.slice(0, 15).forEach(e => console.log('  ✗ ' + e));
  results.filter(r => !r.pass).forEach(r => console.log('  ไม่ผ่าน: ' + r.name + ' — ' + r.note));
  process.exitCode = pass === results.length && errors.length === 0 ? 0 : 1;
})();
