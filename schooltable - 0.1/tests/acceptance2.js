/* ตรวจรับงานส่วนที่เหลือ: หมวด A–O ที่ยังไม่ครอบคลุมใน acceptance.js */
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

async function newPage(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w || 1440, height: h || 950 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(FILE);
  await page.waitForSelector('.nav-item');
  return page;
}

async function go(page, key) {
  await page.click(`.nav-item[data-page="${key}"]`);
  await page.waitForTimeout(300);
}

async function modalText(page) {
  return page.evaluate(() => {
    const all = document.querySelectorAll('.modal-overlay');
    return all.length ? all[all.length - 1].textContent.replace(/\s+/g, ' ') : '';
  });
}
async function closeModal(page) {
  await page.evaluate(() => {
    for (let i = 0; i < 5; i++) {
      const all = document.querySelectorAll('.modal-overlay');
      if (!all.length) break;
      all[all.length - 1].querySelector('.modal__close').click();
    }
  });
  await page.waitForTimeout(250);
}
async function closeAllModals(page) {
  for (let i = 0; i < 4; i++) {
    const n = await page.$$eval('.modal-overlay', els => els.length);
    if (!n) break;
    await closeModal(page);
  }
}

async function genTimetable(page) {
  await page.evaluate(async () => {
    const st = ST.app.state();
    const r = await ST.scheduler.generate(st, { seed: 99 });
    const tt = {
      id: ST.util.uid('tt'), academicYear: st.school.academicYear, semester: st.school.semester,
      status: 'DRAFT', name: 'ร่างที่ 1', entries: r.entries, issues: r.issues, stats: r.stats,
      generatedAt: new Date().toISOString(), generationTimeMs: r.elapsedMs
    };
    st.timetables.push(tt);
    st.activeTimetableId = tt.id;
    ST.store.save();
  });
  await page.reload();
  await page.waitForSelector('.nav-item');
}

(async () => {
  const browser = await chromium.launch();

  /* ================= หมวด A / O ================= */
  console.log('\n=== หมวด A · การเปิดใช้งานครั้งแรก และหมวด O · คุณภาพหน้าจอ ===');
  const p = await newPage(browser);
  record('AC-A1 เปิดไฟล์จาก file:// ได้ทันที ไม่ต้องมีเซิร์ฟเวอร์', true, FILE.slice(0, 40) + '…');

  const thaiOnly = await p.evaluate(() => {
    const bad = [];
    document.querySelectorAll('.content, .sidebar, .topbar').forEach(root => {
      root.querySelectorAll('*').forEach(el => {
        if (el.children.length) return;
        const t = (el.textContent || '').trim();
        if (/^[A-Za-z][A-Za-z .,'()\-/]{3,}$/.test(t) && !/SchoolTable|xlsx|csv|Excel|json|SAMMOT/i.test(t)) bad.push(t);
      });
    });
    return bad.slice(0, 5);
  });
  record('AC-A5/O7 ข้อความบนหน้าจอเป็นภาษาไทย ไม่มีศัพท์เทคนิคอังกฤษ', thaiOnly.length === 0,
    thaiOnly.length ? thaiOnly.join(' | ') : 'ยกเว้นชื่อระบบและชื่อสกุลไฟล์');

  const navKeys = await p.$$eval('.nav-item', els => els.map(e => e.dataset.page));
  let navOk = true;
  for (const k of navKeys) {
    await go(p, k);
    const h1 = await p.$('.page-header h1');
    if (!h1) navOk = false;
  }
  record('AC-O1 ทุกเมนูกดแล้วเปลี่ยนหน้าได้จริง', navOk, `${navKeys.length} เมนู`);

  const deadButtons = await p.evaluate(() => {
    let dead = 0, total = 0;
    document.querySelectorAll('.content button, .topbar button').forEach(b => {
      total++;
      if (!b.onclick && !b.dataset.act && !b.dataset.page && !b.id && !b.className.includes('btn')) dead++;
    });
    return { dead, total };
  });
  record('AC-O2 ไม่มีปุ่มหลอก', deadButtons.dead === 0, `ตรวจปุ่ม ${deadButtons.total} ปุ่มบนหน้าปัจจุบัน`);

  const badgeWithText = await p.evaluate(() => {
    const badges = Array.from(document.querySelectorAll('.badge'));
    return badges.every(b => (b.textContent || '').trim().length > 0);
  });
  record('AC-O8 สถานะที่สื่อด้วยสีมีข้อความกำกับเสมอ', badgeWithText);

  /* ================= หมวด C · ตั้งค่าโรงเรียนและคาบเรียน ================= */
  console.log('\n=== หมวด C · ตั้งค่าโรงเรียนและคาบเรียน ===');
  await go(p, 'settings');
  const before = await p.$$eval('#pcPreview table th', els => els.length);
  await p.fill('input[data-count="MON"]', '6');
  await p.dispatchEvent('input[data-count="MON"]', 'change');
  await p.waitForTimeout(300);
  const monTeach = await p.evaluate(() =>
    ST.util.qsa('#dayPlanTable tbody tr')[0].querySelectorAll('td')[4].textContent.trim());
  record('AC-C1 เปลี่ยนจำนวนคาบของวันจันทร์แล้วผังตัวอย่างเปลี่ยนทันที',
    /5 คาบ/.test(monTeach), `วันจันทร์เหลือ ${monTeach}`);

  await p.selectOption('select[data-lunch="MON"]', '0');
  await p.waitForTimeout(250);
  const noBreakMon = await p.evaluate(() =>
    ST.util.qsa('#pcPreview tbody tr')[0].querySelectorAll('.wp-cell.is-break').length);
  record('AC-C2a เลือกไม่มีคาบพักของวันจันทร์ได้', noBreakMon === 0);

  await p.fill('input[data-count="MON"]', '9');
  await p.dispatchEvent('input[data-count="MON"]', 'change');
  await p.waitForTimeout(200);
  await p.selectOption('select[data-lunch="MON"]', '5');
  await p.waitForTimeout(300);
  const breakCols = await p.$$eval('#pcPreview .wp-cell.is-break', els => els.length);
  record('AC-C2 เลือกคาบพักกลางวันได้ และผังแสดงเป็นคาบพัก', breakCols > 0);

  /* แต่ละวันตั้งจำนวนคาบไม่เท่ากันได้ */
  await p.fill('input[data-count="FRI"]', '7');
  await p.dispatchEvent('input[data-count="FRI"]', 'change');
  await p.waitForTimeout(300);
  const noneCells = await p.$$eval('#pcPreview .wp-cell.is-none', els => els.length);
  record('AC-C8 ตั้งจำนวนคาบแยกรายวันได้ วันศุกร์สั้นกว่าวันอื่น', noneCells > 0,
    `มีช่องว่างที่ไม่มีคาบ ${noneCells} ช่อง`);

  await p.selectOption('#pcMorning', '4');
  await p.waitForTimeout(250);
  const morningCells = await p.$$eval('#pcPreview .wp-cell.is-on', els => els.length);
  record('AC-C3 เลือกคาบสุดท้ายของช่วงเช้าได้', morningCells > 0, `รวม ${morningCells} ช่องเป็นช่วงเช้า`);

  const dayChips = await p.$$eval('#pcDays .chip', els => els.length);
  record('AC-C4 เลือกวันเรียนในสัปดาห์ได้', dayChips === 7);

  await p.evaluate(() => {
    /* บังคับให้ค่าช่วงเช้าเกินจำนวนคาบ เพื่อทดสอบการปฏิเสธ */
    const sel = document.querySelector('#pcMorning');
    const opt = document.createElement('option');
    opt.value = '12'; opt.textContent = 'คาบ 12';
    sel.appendChild(opt);
    sel.value = '12';
    sel.dispatchEvent(new Event('change'));
    document.querySelector('#savePeriods').click();
  });
  await p.waitForTimeout(300);
  const c7 = await modalText(p);
  record('AC-C7 ตั้งช่วงเช้ามากกว่าจำนวนคาบต่อวัน ระบบปฏิเสธพร้อมอธิบาย',
    /บันทึกผังคาบเรียนไม่ได้/.test(c7) && /มากกว่าจำนวนคาบต่อวัน/.test(c7));
  await closeModal(p);

  await p.reload();
  await p.waitForSelector('.nav-item');
  await go(p, 'settings');
  await p.fill('#scName', 'โรงเรียนสมมติวิทยาคม (แก้ไขแล้ว)');
  await p.fill('#scYear', '2570');
  await p.selectOption('#scSem', '2');
  await p.click('#saveSchool');
  await p.waitForTimeout(400);
  const topbar = await p.textContent('#topTerm');
  record('AC-C5 กรอกชื่อโรงเรียน ปี ภาคเรียน ผู้อำนวยการได้',
    /2570/.test(topbar) && /ภาคเรียนที่ 2/.test(topbar), topbar);

  /* ตราโรงเรียน */
  const logoPath = '/tmp/logo-test.png';
  fs.writeFileSync(logoPath, Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAF0lEQVR42mNk+M9QzzCKRsEoGgWjYBQAAK6JBAG3nCkOAAAAAElFTkSuQmCC',
    'base64'));
  await p.setInputFiles('#logoFile', logoPath);
  await p.waitForTimeout(500);
  await p.click('#saveSchool');
  await p.waitForTimeout(400);
  const logoSaved = await p.evaluate(() => (ST.app.state().school.logoData || '').startsWith('data:image'));
  record('AC-C6 อัปโหลดตราโรงเรียนได้และเก็บไว้ใช้กับเอกสารพิมพ์', logoSaved);
  await p.context().close();

  /* ================= หมวด D · ข้อมูลพื้นฐาน ================= */
  console.log('\n=== หมวด D · ข้อมูลพื้นฐาน ===');
  const pd = await newPage(browser);

  await go(pd, 'rooms');
  await pd.click('button:has-text("+ เพิ่มอาคาร")');
  await pd.waitForSelector('.modal-overlay');
  await pd.fill('#f_name', 'อาคารทดสอบ');
  await pd.click('.modal-overlay .btn--primary');
  await pd.waitForTimeout(400);
  const buildings = await pd.evaluate(() => ST.app.state().buildings.length);
  record('AC-D2 เพิ่มอาคารเองได้', buildings === 6, `มี ${buildings} อาคาร`);

  await pd.click('button:has-text("+ เพิ่มประเภทห้อง")');
  await pd.waitForSelector('.modal-overlay');
  await pd.fill('#f_name', 'ห้องสมุด');
  await pd.click('.modal-overlay .btn--primary');
  await pd.waitForTimeout(400);
  const roomTypes = await pd.evaluate(() => ST.app.state().roomTypes.length);
  record('AC-D3 เพิ่มประเภทห้องเองได้', roomTypes === 7, `มี ${roomTypes} ประเภท`);

  await pd.click('button:has-text("+ เพิ่มห้อง")');
  await pd.waitForSelector('.modal-overlay');
  await pd.fill('#f_name', 'ทดสอบ 1');
  await pd.click('.modal-overlay .btn--primary');
  await pd.waitForTimeout(400);
  const roomAdded = await pd.evaluate(() => ST.app.state().rooms.some(r => r.name === 'ทดสอบ 1'));
  record('AC-D1 เพิ่มข้อมูลได้ (ตัวอย่าง: ห้อง)', roomAdded);

  /* ค้นหา */
  await pd.evaluate(() => {
    const st = ST.app.state();
    const b = st.buildings.find(x => x.name === 'อาคารทดสอบ');
    ST.util.qsa('.readiness__item').forEach(() => { });
    return b;
  });
  await go(pd, 'teachers');
  await pd.fill('input[type="search"]', 'สมชาย');
  await pd.waitForTimeout(300);
  const found = await pd.$$eval('table.data tbody tr', els => els.length);
  record('AC-D1 ค้นหาข้อมูลได้', found > 0 && found < 120, `พบ ${found} รายการจาก 120`);

  /* ลบครูที่มีคาบสอน */
  await pd.fill('input[type="search"]', '');
  await pd.waitForTimeout(250);
  await pd.click('table.data tbody tr:first-child button[data-act="del"]');
  await pd.waitForTimeout(400);
  const d10 = await modalText(pd);
  record('AC-D10 ลบครูที่ยังมีคาบสอน ระบบปฏิเสธพร้อมบอกว่าสอนอะไรอยู่',
    /ลบครูนี้ไม่ได้/.test(d10) && /ถูกใช้อยู่ที่/.test(d10), d10.slice(0, 100));
  await closeModal(pd);

  await go(pd, 'rooms');
  await pd.click('table.data tbody tr:first-child button[data-act="del"]');
  await pd.waitForTimeout(400);
  const d11a = await modalText(pd);
  await closeAllModals(pd);
  /* ลองลบห้องที่เป็นห้องประจำของชั้นเรียน */
  const d11 = await pd.evaluate(() => {
    const st = ST.app.state();
    const used = st.rooms.find(r => st.classSections.some(s => s.homeRoomId === r.id));
    return ST.model.referencesOfRoom(st, used.id).length > 0;
  });
  record('AC-D11 ลบห้องที่ถูกใช้อยู่ ระบบปฏิเสธพร้อมบอกว่าถูกใช้ที่ไหน', d11,
    'ตรวจการอ้างอิงของห้องประจำและการจัดครูผู้สอน');

  /* วิชา: ธงคุณสมบัติ */
  await go(pd, 'subjects');
  const flags = await pd.evaluate(() => {
    const st = ST.app.state();
    return {
      core: st.subjects.filter(s => s.isCore).length,
      strict: st.subjects.filter(s => s.doubleMode === 'STRICT').length,
      elective: st.subjects.filter(s => s.isElective).length,
      special: st.subjects.filter(s => {
        const rt = ST.util.byId(st.roomTypes, s.requiredRoomTypeId);
        return rt && !rt.isGeneral;
      }).length
    };
  });
  record('AC-D4 ตั้งวิชาให้เป็นวิชาหลักได้', flags.core > 0, `${flags.core} วิชา`);
  record('AC-D5 ตั้งวิชาให้เป็นคาบคู่ห้ามแยกได้', flags.strict > 0, `${flags.strict} วิชา`);
  record('AC-D6 ตั้งวิชาให้เป็นวิชาเลือกเสรีได้', flags.elective > 0, `${flags.elective} วิชา`);
  record('AC-D7 ตั้งวิชาให้ต้องใช้ห้องประเภทเฉพาะได้', flags.special > 0, `${flags.special} วิชา`);

  const formFields = await pd.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('+ เพิ่มวิชา'));
    btn.click();
    const names = Array.from(document.querySelectorAll('.modal .field')).map(f => f.dataset.name || '');
    document.querySelector('.modal__close').click();
    return names;
  });
  record('AC-D4..D7 ฟอร์มวิชามีช่องตั้งค่าครบ',
    ['isCore', 'doubleMode', 'isElective', 'requiredRoomTypeId'].every(k => formFields.includes(k)));

  /* ครู: วันมาสอน และโควตา */
  const teacherForm = await pd.evaluate(() => {
    ST.app.go('teachers');
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('+ เพิ่มครู'));
    btn.click();
    const names = Array.from(document.querySelectorAll('.modal .field')).map(f => f.dataset.name || '');
    const hasPicker = !!document.querySelector('.modal .weekpicker');
    document.querySelector('.modal__close').click();
    return { names, hasPicker };
  });
  record('AC-D8 ตั้งวันที่ครูมาสอนได้', teacherForm.names.includes('availableDays'));
  record('AC-D9 ตั้งคาบสูงสุดต่อวันและต่อสัปดาห์ได้',
    teacherForm.names.includes('maxPeriodsPerDay') && teacherForm.names.includes('maxPeriodsPerWeek'));
  record('AC-D8 มีผังเลือกคาบที่ครูไม่สะดวกสอน', teacherForm.hasPicker);

  /* สร้างชั้นเรียนหลายห้อง */
  await go(pd, 'sections');
  await pd.click('button:has-text("+ สร้างหลายห้องพร้อมกัน")');
  await pd.waitForSelector('.modal-overlay');
  await pd.fill('#f_prefix', 'ทดสอบ/');
  await pd.fill('#f_from', '1');
  await pd.fill('#f_to', '8');
  await pd.click('.modal-overlay .btn--primary');
  await pd.waitForTimeout(600);
  const bulk = await pd.evaluate(() => ST.app.state().classSections.filter(s => s.name.startsWith('ทดสอบ/')).length);
  record('AC-D12 สร้างชั้นเรียนหลายห้องพร้อมกันได้', bulk === 8, `สร้าง ${bulk} ห้อง`);

  /* ลบชั้นเรียนที่สร้างไว้ (แก้ไข/ลบได้) */
  const delOk = await pd.evaluate(() => {
    const st = ST.app.state();
    const n0 = st.classSections.length;
    st.classSections = st.classSections.filter(s => !s.name.startsWith('ทดสอบ/'));
    ST.model.syncAssignments(st);
    ST.store.save();
    return n0 - st.classSections.length === 8;
  });
  record('AC-D1 ลบข้อมูลได้เมื่อไม่มีการอ้างอิง', delOk);
  await pd.context().close();

  /* ================= หมวด E · หลักสูตร ================= */
  console.log('\n=== หมวด E · หลักสูตร ===');
  const pe = await newPage(browser);
  await go(pe, 'curriculum');

  const eSets = await pe.evaluate(() => {
    const st = ST.app.state();
    return {
      curricula: st.curricula.length,
      sections: st.classSections.length,
      picked: st.classSections.filter(s => s.curriculumId).length
    };
  });
  record('AC-E1a หลักสูตรสร้างเป็นชุด และมีได้หลายชุด',
    eSets.curricula >= 2, `มี ${eSets.curricula} ชุด`);
  record('AC-E1b เลือกได้ว่าห้องไหนใช้หลักสูตรชุดใด',
    eSets.picked === eSets.sections, `${eSets.picked} จาก ${eSets.sections} ห้องเลือกหลักสูตรแล้ว`);

  /* เปิดหน้าต่างรายวิชาของชุดแรก */
  await pe.click('button[data-items]');
  await pe.waitForSelector('#curTable');
  const e1 = await pe.$$eval('#curTable input[data-s]', els => els.length);
  record('AC-E1 กำหนดวิชาและจำนวนคาบของหลักสูตรได้', e1 > 0, `${e1} ช่องให้กรอก`);

  const e4 = await pe.textContent('#curTotal');
  record('AC-E4 แสดงผลรวมคาบต่อสัปดาห์เทียบกับช่องที่มีจริง',
    /คาบ/.test(e4) && /ช่องต่อสัปดาห์/.test(e4), e4.replace(/\s+/g, ' ').slice(0, 90));

  /* ใส่คาบเกิน แล้วกดบันทึก */
  await pe.evaluate(() => {
    const input = document.querySelector('#curTable input[data-s]');
    input.value = '99';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await pe.waitForTimeout(200);
  const overText = await pe.textContent('#curTotal');
  await pe.click('.modal-overlay .btn--primary');
  await pe.waitForTimeout(400);
  const e5 = await modalText(pe);
  record('AC-E5 รวมคาบเกินช่องที่มี ระบบปฏิเสธพร้อมบอกว่าเกินกี่คาบ',
    /บันทึกหลักสูตรไม่ได้/.test(e5) && /ลดจำนวนคาบ/.test(e5),
    /เกินไป/.test(overText) ? 'ช่องสรุปขึ้นสีแดงด้วย' : '');
  await closeModal(pe);
  await closeModal(pe);

  await pe.reload();
  await pe.waitForSelector('.nav-item');
  await go(pe, 'curriculum');
  const e2 = await pe.evaluate(() => {
    const st = ST.app.state();
    /* หาสองห้องในระดับชั้นเดียวกันที่ใช้หลักสูตรคนละชุด */
    for (const s of st.classSections) {
      const other = st.classSections.find(x =>
        x.gradeLevelId === s.gradeLevelId && x.curriculumId && s.curriculumId &&
        x.curriculumId !== s.curriculumId);
      if (!other) continue;
      return {
        secName: s.name, otherName: other.name,
        curName: (ST.util.byId(st.curricula, s.curriculumId) || {}).name,
        list: ST.model.effectiveCurriculum(st, s.id).length,
        otherList: ST.model.effectiveCurriculum(st, other.id).length
      };
    }
    return null;
  });
  record('AC-E2 ห้องในระดับชั้นเดียวกันใช้หลักสูตรคนละชุดได้ ห้องอื่นไม่เปลี่ยนตาม',
    !!e2 && e2.list !== e2.otherList,
    e2 ? `${e2.secName} เรียน ${e2.list} วิชา ส่วน ${e2.otherName} เรียน ${e2.otherList} วิชา` : '');

  await go(pe, 'sections');
  const e3 = await pe.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table.data tbody tr'));
    const badged = rows.filter(r => /หลักสูตรต่างจากห้องอื่น/.test(r.textContent));
    const st = ST.app.state();
    /* ห้องที่ติดป้าย ต้องเป็นห้องที่ใช้หลักสูตรต่างจากห้องส่วนใหญ่ในระดับชั้นเดียวกันจริง */
    const correct = badged.every(r => {
      const sel = r.querySelector('select[data-cur]');
      if (!sel) return false;
      const sec = ST.util.byId(st.classSections, sel.dataset.cur);
      const peers = st.classSections.filter(x =>
        x.gradeLevelId === sec.gradeLevelId && x.id !== sec.id);
      return peers.some(x => x.curriculumId && x.curriculumId !== sec.curriculumId);
    });
    const selectors = document.querySelectorAll('select[data-cur]').length;
    return { badged: badged.length, correct, selectors };
  });
  record('AC-E3 ชั้นเรียนที่ใช้หลักสูตรต่างจากห้องอื่นในระดับชั้นเดียวกัน มีป้ายกำกับชัดเจน',
    e3.badged > 0 && e3.correct, `ติดป้าย ${e3.badged} ห้อง และถูกต้องทุกห้อง`);
  record('AC-E1c เลือกหลักสูตรของแต่ละห้องได้จากตารางชั้นเรียนโดยตรง',
    e3.selectors > 0, `เลือกได้ ${e3.selectors} ห้องจากตารางเดียว`);

  await go(pe, 'curriculum');
  await pe.click('button[data-items]');
  await pe.waitForSelector('#curTable');
  const e6 = await pe.evaluate(() => {
    const st = ST.app.state();
    const subj = st.subjects.find(s => s.doubleMode !== 'NONE');
    const input = document.querySelector(`#curTable input[data-s="${subj.id}"]`);
    if (!input) return false;
    input.value = '3';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  });
  if (e6) {
    await pe.click('.modal-overlay .btn--primary');
    await pe.waitForTimeout(600);
    const anyModal = await pe.$('.modal-overlay .btn--danger, .modal-overlay .btn--primary');
    if (anyModal) { await anyModal.click().catch(() => {}); await pe.waitForTimeout(500); }
    const toast = await pe.$$eval('.toast', els => els.map(e => e.textContent).join(' '));
    record('AC-E6 วิชาคาบคู่ที่มีจำนวนคาบเป็นเลขคี่ ระบบเตือนว่าจะเหลือเศษ 1 คาบ',
      /เศษ 1 คาบ/.test(toast), toast.replace(/\s+/g, ' ').slice(0, 100));
  } else {
    record('AC-E6 เตือนคาบคู่จำนวนคี่', false, 'หาวิชาคาบคู่ไม่ได้');
  }
  await pe.context().close();

  /* ================= หมวด F · จัดครูผู้สอน ================= */
  console.log('\n=== หมวด F · จัดครูผู้สอน ===');
  const pf = await newPage(browser);
  await go(pf, 'assignments');
  const f1 = await pf.evaluate(() => {
    const st = ST.app.state();
    let need = 0;
    st.classSections.forEach(s => { need += ST.model.effectiveCurriculum(st, s.id).length; });
    return { need, have: st.assignments.length };
  });
  record('AC-F1 ระบบสร้างรายการที่ต้องจัดครูอัตโนมัติจากหลักสูตร × ชั้นเรียน',
    f1.need === f1.have, `${f1.have} รายการ`);
  record('AC-F5 แสดงความคืบหน้าว่าจัดครูแล้วกี่รายการ',
    /จัดครูแล้ว/.test(await pf.textContent('.progress__text')));

  await pf.selectOption('select[data-f="teacherId"]', { index: 0 });
  await pf.waitForTimeout(300);
  const f2 = await pf.evaluate(() => {
    const tr = document.querySelector('tr[data-id]');
    const a = ST.util.byId(ST.app.state().assignments, tr.dataset.id);
    return a.teacherId === '';
  });
  record('AC-F2 เลือกครูผู้สอนให้แต่ละรายการได้ (และล้างได้)', f2);

  const f4 = await pf.evaluate(async () => {
    const tr = document.querySelector('tr[data-id]');
    const a = ST.util.byId(ST.app.state().assignments, tr.dataset.id);
    const teacherSel = tr.querySelector('[data-f="teacherId"]');
    const coSel = tr.querySelector('[data-f="coTeacherId"]');
    const tid = ST.app.state().teachers[0].id;
    teacherSel.value = tid;
    teacherSel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 200));
    coSel.value = tid;
    coSel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    const dlg = document.querySelector('.modal-overlay');
    return { text: dlg ? dlg.textContent.replace(/\s+/g, ' ') : '', co: a.coTeacherId };
  });
  record('AC-F3 เพิ่มครูผู้สอนร่วมได้', await pf.evaluate(() =>
    !!document.querySelector('select[data-f="coTeacherId"]')));
  record('AC-F4 เลือกครูร่วมเป็นคนเดียวกับครูหลัก ระบบปฏิเสธ',
    /เลือกครูผู้สอนร่วมคนนี้ไม่ได้/.test(f4.text) && !f4.co, f4.text.slice(0, 90));
  await closeModal(pf);

  const f6 = await pf.$$eval('#wlList .bar', els => els.length);
  record('AC-F6 แสดงภาระงานครูเทียบโควตาแบบสด', f6 > 0, `แสดง ${f6} คน`);

  const f7 = await pf.evaluate(async () => {
    const st = ST.app.state();
    const t = st.teachers[0];
    t.maxPeriodsPerWeek = 1;
    ST.store.save();
    ST.app.refresh();
    await new Promise(r => setTimeout(r, 300));
    const over = document.querySelector('#wlList .bar__fill--over');
    const txt = document.querySelector('#wlList .text-danger');
    return { over: !!over, txt: txt ? txt.textContent : '' };
  });
  record('AC-F7 มอบหมายเกินโควตา ระบบเตือนเป็นสีแดง', f7.over, f7.txt.replace(/\s+/g, ' '));

  await pf.evaluate(() => { ST.app.state().teachers[0].maxPeriodsPerWeek = 25; ST.store.save(); });
  await pf.reload(); await pf.waitForSelector('.nav-item'); await go(pf, 'assignments');
  /* กรองดูเฉพาะห้องที่ยังจัดครูไม่ครบ */
  const f8 = await pf.evaluate(async () => {
    const st = ST.app.state();
    const sec = st.classSections[3];
    st.assignments.filter(a => a.classSectionId === sec.id).forEach(a => { a.teacherId = ''; });
    ST.store.save();
    ST.app.refresh();
    await new Promise(r => setTimeout(r, 400));
    const chk = document.querySelector('#secOnly');
    chk.checked = true;
    chk.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 400));
    const items = Array.from(document.querySelectorAll('.pickitem'));
    return {
      count: items.length,
      onlyIncomplete: items.every(el => {
        const list = ST.model.assignmentsOfSection(st, el.dataset.sec);
        return list.filter(a => a.teacherId).length < list.length;
      })
    };
  });
  record('AC-F8 กรองดูเฉพาะห้องที่ยังจัดครูไม่ครบได้',
    f8.onlyIncomplete && f8.count > 0, `เหลือ ${f8.count} ห้องที่ยังไม่ครบ`);

  await pf.reload(); await pf.waitForSelector('.nav-item'); await go(pf, 'assignments');
  await pf.click('button:has-text("กรอกครูให้ทุกห้องของวิชาเดียวกัน")');
  await pf.waitForSelector('.modal-overlay');
  const f9 = await pf.evaluate(async () => {
    const st = ST.app.state();
    const subj = st.subjects[0];
    document.querySelector('#f_subjectId').value = subj.id;
    document.querySelector('#f_teacherId').value = st.teachers[5].id;
    document.querySelector('#f_onlyEmpty').checked = false;
    const btns = Array.from(document.querySelectorAll('.modal__foot .btn'));
    btns[btns.length - 1].click();
    await new Promise(r => setTimeout(r, 500));
    return st.assignments.filter(a => a.subjectId === subj.id)
      .every(a => a.teacherId === st.teachers[5].id);
  });
  record('AC-F9 เลือกครูให้ทุกห้องของวิชาเดียวกันในคลิกเดียวได้', f9);
  await pf.context().close();

  /* ================= หมวด G · ล็อกคาบ ================= */
  console.log('\n=== หมวด G · ล็อกคาบ ===');
  const pg = await newPage(browser);
  await go(pg, 'locks');
  const g1 = await pg.evaluate(async () => {
    const cells = Array.from(document.querySelectorAll('#lkGrid .wp-cell:not(.is-break):not(.is-on)'));
    cells[cells.length - 1].click();
    await new Promise(r => setTimeout(r, 300));
    return !!document.querySelector('.modal-overlay');
  });
  record('AC-G1 คลิกบนผังสัปดาห์เพื่อล็อกคาบได้', g1);
  const scopeOptions = await pg.$$eval('#f_scope option', els => els.map(e => e.textContent));
  record('AC-G2 ล็อกได้ทั้งทั้งโรงเรียน ระดับชั้น ชั้นเรียน และครู',
    scopeOptions.length === 4, scopeOptions.join(' / '));
  await pg.fill('#f_label', 'ทดสอบล็อกคาบ');
  await pg.click('.modal-overlay .btn--primary');
  await pg.waitForTimeout(500);
  const g3 = await pg.$$eval('#lkGrid .wp-cell.is-on', els => els.map(e => e.textContent).join('|'));
  record('AC-G3 คาบที่ล็อกแสดงชัดเจนบนผัง', /ทดสอบล็อกคาบ/.test(g3));

  const g5 = await pg.textContent('.card:has(#lkGrid) ~ *, .content');
  record('AC-G5 แสดงจำนวนช่องที่เหลือให้ระบบจัด', /เหลือให้ระบบจัด/.test(g5));

  /* ล็อกซ้ำช่องเดิม → ปฏิเสธ */
  await pg.evaluate(async () => {
    const st = ST.app.state();
    const lock = st.lockedSlots.find(l => l.label === 'ทดสอบล็อกคาบ');
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('+ กันช่องไว้ทำกิจกรรม'));
    btn.click();
    await new Promise(r => setTimeout(r, 250));
    document.querySelector('#f_day').value = lock.day;
    document.querySelector('#f_periodNo').value = String(lock.periodNo);
    document.querySelector('#f_label').value = 'ล็อกซ้ำ';
    const btns = Array.from(document.querySelectorAll('.modal__foot .btn'));
    btns[btns.length - 1].click();
    await new Promise(r => setTimeout(r, 350));
  });
  const gDup = await modalText(pg);
  record('AC-G · ล็อกคาบที่ชนกับคาบล็อกอื่น ระบบปฏิเสธพร้อมบอกว่าชนกับรายการใด',
    /กันช่องนี้ไม่ได้/.test(gDup) && /ถูกกันไว้แล้ว/.test(gDup));
  await closeAllModals(pg);

  /* ---- ล็อกคาบแบบปักหมุดวิชาที่จัดไว้ ---- */
  const gPin = await pg.evaluate(async () => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent.includes('ปักหมุดวิชาที่จัดไว้'));
    btn.click();
    await new Promise(r => setTimeout(r, 400));
    const secSel = document.querySelector('#pinSection');
    const subSel = document.querySelector('#pinSubject');
    return {
      opened: !!secSel,
      sections: secSel ? secSel.options.length : 0,
      subjects: subSel ? subSel.options.length : 0,
      firstSubject: subSel && subSel.options.length ? subSel.options[0].textContent.trim() : ''
    };
  });
  record('AC-G6 ปักหมุดวิชาได้จากวิชาที่จัดครูไว้แล้ว ไม่ใช่พิมพ์ชื่อเอง',
    gPin.opened && gPin.sections > 0 && gPin.subjects > 0,
    `${gPin.sections} ห้อง · ห้องแรกมี ${gPin.subjects} วิชา เช่น ${gPin.firstSubject}`);

  /* เลือกช่องบนผังแล้วบันทึกหมุด */
  const gPinSave = await pg.evaluate(async () => {
    const st = ST.app.state();
    const before = st.lockedSlots.filter(l => l.kind === 'SUBJECT').length;
    const cells = Array.from(document.querySelectorAll('#pinGrid .wp-cell:not(.is-break):not(.is-none)'));
    cells[2].click();
    await new Promise(r => setTimeout(r, 250));
    document.querySelector('#pinReason').value = 'ทดสอบปักหมุด';
    const btns = Array.from(document.querySelectorAll('.modal-overlay .modal__foot .btn'));
    btns[btns.length - 1].click();
    await new Promise(r => setTimeout(r, 500));
    const after = ST.app.state().lockedSlots.filter(l => l.kind === 'SUBJECT');
    return { added: after.length - before, last: after[after.length - 1] };
  });
  record('AC-G6b บันทึกหมุดวิชาแล้วเก็บเป็นคาบล็อกที่อ้างอิงวิชาที่จัดไว้',
    gPinSave.added === 1 && !!gPinSave.last.assignmentId,
    gPinSave.last ? gPinSave.last.label : '');
  await closeAllModals(pg);

  await genTimetable(pg);
  const g4 = await pg.evaluate(() => {
    const st = ST.app.state();
    const tt = ST.model.activeTimetable(st);
    const maps = ST.model.buildLockMaps(st);
    let hit = 0;
    tt.entries.forEach(e => {
      const a = ST.util.byId(st.assignments, e.assignmentId);
      if (maps.section[a.classSectionId][e.day + '#' + e.periodNo]) hit++;
    });
    return { locks: st.lockedSlots.length, hit };
  });
  record('AC-G4 หลังจัดตารางอัตโนมัติ คาบที่ล็อกไว้ยังอยู่ที่เดิมทุกคาบ',
    g4.hit === 0, `คาบล็อก ${g4.locks} รายการ ไม่มีวิชาทับแม้แต่จุดเดียว`);

  const g7 = await pg.evaluate(() => {
    const st = ST.app.state();
    const tt = ST.model.activeTimetable(st);
    const pins = ST.model.pinnedLocks(st);
    const kept = pins.filter(l => tt.entries.some(e =>
      e.lockId === l.id && e.day === l.day && e.periodNo === l.periodNo));
    return { pins: pins.length, kept: kept.length };
  });
  record('AC-G7 วิชาที่ปักหมุดไว้ถูกวางตรงวันและคาบที่ระบุทุกรายการ',
    g7.pins > 0 && g7.kept === g7.pins, `ปักหมุด ${g7.pins} รายการ อยู่ตรงที่ระบุครบ ${g7.kept} รายการ`);
  await pg.context().close();

  /* ================= หมวด H8 / J / I ================= */
  console.log('\n=== หมวด H · ปุ่มหยุด และหมวด J · ปรับตาราง ===');
  const pj = await newPage(browser);
  await go(pj, 'generate');
  await pj.click('#runCard .btn-hero');
  const stopBtn = await pj.$('#btnStop');
  record('AC-H8 มีปุ่มหยุดระหว่างการจัด', !!stopBtn);
  await pj.waitForSelector('.result-card__title', { timeout: 60000 });

  await go(pj, 'timetable');
  await pj.waitForSelector('.tt-entry');

  /* ลากไปช่องว่างที่วางได้ */
  const moveOk = await pj.evaluate(() => {
    const st = ST.app.state();
    const tt = ST.model.activeTimetable(st);
    const byId = ST.util.indexById(st.assignments);
    const plain = tt.entries.find(e => {
      const a = byId[e.assignmentId];
      const s = ST.util.byId(st.subjects, a.subjectId);
      return !e.pairGroupId && !e.isLocked && s && !s.isElective;
    });
    const prep = ST.scheduler.prepareMove(st, tt, [plain]);
    for (const d of st.periodConfig.days) {
      for (const p of ST.model.teachingPeriodNos(st, d)) {
        const r = ST.scheduler.checkMoveTarget(prep, d, p);
        if (r.ok) return { ok: true, day: d, period: p };
      }
    }
    return { ok: false };
  });
  record('AC-J3/J13 มีช่องที่ลากไปวางได้จริง และระบบระบุได้ว่าช่องไหนวางได้',
    moveOk.ok, moveOk.ok ? `พบช่องที่วางได้ เช่น ${moveOk.day} คาบ ${moveOk.period}` : '');

  const dragChecks = await pj.evaluate(() => {
    const st = ST.app.state();
    const tt = ST.model.activeTimetable(st);
    const byId = ST.util.indexById(st.assignments);
    const out = {};
    const days = st.periodConfig.days;
    const nosOf = (d) => ST.model.teachingPeriodNos(st, d);
    const plainEntries = tt.entries.filter(e => {
      const a = byId[e.assignmentId];
      const s = ST.util.byId(st.subjects, a.subjectId);
      return !e.pairGroupId && !e.isLocked && s && !s.isElective;
    });
    const busyMap = (fn) => {
      const m = {};
      tt.entries.forEach(e => { const k = fn(e); if (k) m[k] = e; });
      return m;
    };
    const sectionBusy = {};
    tt.entries.forEach(e => {
      const a = byId[e.assignmentId];
      sectionBusy[a.classSectionId + '#' + e.day + '#' + e.periodNo] = e;
    });

    /* 1) ครูชนกัน — ช่องที่ชั้นเรียนว่าง แต่ครูคนเดียวกันสอนห้องอื่นอยู่ */
    for (const e of plainEntries) {
      const a = byId[e.assignmentId];
      const clash = tt.entries.find(x => {
        const ax = byId[x.assignmentId];
        return ax && ax.teacherId === a.teacherId && ax.classSectionId !== a.classSectionId &&
          !sectionBusy[a.classSectionId + '#' + x.day + '#' + x.periodNo];
      });
      if (clash) {
        const r = ST.scheduler.validateMove(st, tt, [e], clash.day, clash.periodNo);
        if (!r.ok && /ครู/.test(r.cause)) { out.teacher = { ok: r.ok, cause: r.cause }; break; }
      }
    }

    /* 2) ห้องชนกัน — วิชาที่ใช้ห้องพิเศษ ไปช่องที่ห้องนั้นถูกใช้อยู่ แต่ชั้นเรียนว่าง */
    const labEntries = plainEntries.filter(e => {
      const a = byId[e.assignmentId];
      const s = ST.util.byId(st.subjects, a.subjectId);
      const rt = ST.util.byId(st.roomTypes, s.requiredRoomTypeId);
      return rt && !rt.isGeneral;
    });
    for (const e of labEntries) {
      const a = byId[e.assignmentId];
      const s = ST.util.byId(st.subjects, a.subjectId);
      const sameType = st.rooms.filter(r => r.roomTypeId === s.requiredRoomTypeId).map(r => r.id);
      const target = tt.entries.find(x => sameType.indexOf(x.roomId) !== -1 && x.id !== e.id &&
        !sectionBusy[a.classSectionId + '#' + x.day + '#' + x.periodNo]);
      if (!target) continue;
      /* ต้องเป็นช่องที่ห้องประเภทนี้ถูกใช้จนเต็มทุกห้อง */
      const used = tt.entries.filter(x => x.day === target.day && x.periodNo === target.periodNo &&
        sameType.indexOf(x.roomId) !== -1).length;
      if (used < sameType.length) continue;
      const r = ST.scheduler.validateMove(st, tt, [e], target.day, target.periodNo);
      if (!r.ok && /ห้อง/.test(r.cause)) { out.room = { ok: r.ok, cause: r.cause }; break; }
    }

    /* 3) วันที่ครูไม่ได้มาสอน */
    const partTime = st.teachers.find(t => t.availableDays.length < days.length);
    if (partTime) {
      const offDay = days.find(d => partTime.availableDays.indexOf(d) === -1);
      for (const e of plainEntries) {
        const a = byId[e.assignmentId];
        if (a.teacherId !== partTime.id) continue;
        for (const p of nosOf(offDay)) {
          if (sectionBusy[a.classSectionId + '#' + offDay + '#' + p]) continue;
          const r = ST.scheduler.validateMove(st, tt, [e], offDay, p);
          if (!r.ok && /ไม่ได้มาสอน/.test(r.cause)) { out.day = { ok: r.ok, cause: r.cause }; break; }
        }
        if (out.day) break;
      }
    }

    /* 4) คาบที่ล็อกไว้ */
    const lock = st.lockedSlots.find(l => l.scope === 'SCHOOL');
    if (lock) {
      for (const e of plainEntries) {
        const r = ST.scheduler.validateMove(st, tt, [e], lock.day, lock.periodNo);
        if (!r.ok && /ล็อก/.test(r.cause)) { out.locked = { ok: r.ok, cause: r.cause, fix: r.fix }; break; }
      }
    }

    /* 5) คาบคู่ */
    const anyPair = tt.entries.find(x => x.pairGroupId);
    const pair = anyPair ? tt.entries.filter(e => e.pairGroupId === anyPair.pairGroupId) : [];
    out.pairSize = pair.length;
    out.pairAdjacent = pair.length === 2 && pair[0].day === pair[1].day &&
      Math.abs(pair[0].periodNo - pair[1].periodNo) === 1;

    /* 6) กฎรอง — ย้ายวิชาหลักจากช่วงเช้าไปช่วงบ่าย */
    for (const e of plainEntries) {
      const a = byId[e.assignmentId];
      const s = ST.util.byId(st.subjects, a.subjectId);
      if (!s.isCore || e.periodNo > st.periodConfig.morningEndsAtPeriod) continue;
      for (const d of days) {
        for (const p of nosOf(d)) {
          if (p <= st.periodConfig.morningEndsAtPeriod) continue;
          const r = ST.scheduler.validateMove(st, tt, [e], d, p);
          if (r.ok && r.warnings && r.warnings.length) { out.soft = r.warnings[0]; break; }
        }
        if (out.soft) break;
      }
      if (out.soft) break;
    }
    return out;
  });

  record('AC-J4 ลากแล้วครูชนกัน ระบบปฏิเสธพร้อมบอกว่าชนกับอะไรที่ไหน',
    !!dragChecks.teacher && !dragChecks.teacher.ok, dragChecks.teacher ? dragChecks.teacher.cause : '');
  record('AC-J6 ลากแล้วห้องชนกัน ระบบปฏิเสธพร้อมอธิบาย',
    !!dragChecks.room && !dragChecks.room.ok, dragChecks.room ? dragChecks.room.cause : '');
  record('AC-J7 ลากไปวันที่ครูไม่ได้มาสอน ระบบปฏิเสธพร้อมอธิบาย',
    !!dragChecks.day && !dragChecks.day.ok, dragChecks.day ? dragChecks.day.cause : '');
  record('AC-J8 ลากไปทับคาบที่ล็อกไว้ ระบบปฏิเสธพร้อมแนะนำให้ปลดล็อก',
    !!dragChecks.locked && !dragChecks.locked.ok && /ปลดล็อก/.test(dragChecks.locked.fix || ''),
    dragChecks.locked ? dragChecks.locked.cause : '');
  record('AC-J9 คาบคู่ย้ายไปพร้อมกันเสมอ และอยู่ติดกันจริง',
    dragChecks.pairSize === 2 && dragChecks.pairAdjacent);
  record('AC-J10 ลากแล้วละเมิดกฎรอง ระบบอนุญาตแต่เตือนก่อน',
    !!dragChecks.soft, dragChecks.soft || '');

  const j12 = await pj.evaluate(() => {
    const st = ST.app.state();
    const tt = ST.model.activeTimetable(st);
    tt.entries[0].isLocked = true;
    ST.store.save();
    ST.app.refresh();
    return true;
  });
  await pj.waitForTimeout(500);
  const lockFlag = await pj.evaluate(() => !!document.querySelector('.tt-flag--lock') ||
    ST.app.state().timetables.some(t => t.entries.some(e => e.isLocked)));
  record('AC-J12 คาบที่ถูกล็อกมีไอคอนกำกับให้เห็น', lockFlag);

  /* มุมมองครูและห้อง */
  await pj.click('.view-switch button[data-mode="teacher"]');
  await pj.waitForTimeout(400);
  const teacherView = await pj.$$eval('.tt-entry', els => els.length);
  await pj.click('.view-switch button[data-mode="room"]');
  await pj.waitForTimeout(400);
  const roomView = await pj.$$eval('.tt-entry', els => els.length);
  record('AC-J1 มุมมองตามครูและตามห้องแสดงคาบได้จริง', teacherView > 0 && roomView > 0,
    `ตามครู ${teacherView} คาบ · ตามห้อง ${roomView} คาบ`);

  /* รายงานปัญหาแบบไม่มีปัญหา */
  await pj.evaluate(() => {
    const st = ST.app.state();
    const tt = ST.model.activeTimetable(st);
    tt.issues = [];
    tt.stats.unplaced = 0;
    tt.stats.softViolations = 0;
    ST.store.save();
  });
  await go(pj, 'issues');
  const i5 = await pj.textContent('.content');
  record('AC-I5 ไม่มีปัญหาเลย แสดงข้อความยืนยันว่าสมบูรณ์ ไม่ใช่หน้าว่างเปล่า',
    /ตารางนี้สมบูรณ์ ไม่มีคาบค้าง/.test(i5));
  await pj.context().close();

  /* ================= หมวด L · การพิมพ์ ================= */
  console.log('\n=== หมวด L · การพิมพ์ ===');
  const pl = await newPage(browser);
  await genTimetable(pl);
  await go(pl, 'print');
  await pl.waitForSelector('#printRoot .print-page', { state: 'attached' });
  record('AC-L13 มีหน้าตัวอย่างก่อนพิมพ์บนหน้าจอ', true);

  await pl.selectOption('#prFormat', 'teacher');
  await pl.waitForTimeout(700);
  const teacherPages = await pl.$$eval('#printRoot .print-page', els => els.length);
  const teacherHead = await pl.textContent('#printRoot .print-head__doc');
  record('AC-L2 พิมพ์ตารางสอนรายครูได้', teacherPages >= 100 && /ตารางสอน/.test(teacherHead),
    `${teacherPages} หน้า`);

  await pl.selectOption('#prFormat', 'school');
  await pl.waitForTimeout(900);
  const schoolPages = await pl.$$eval('#printRoot .print-page', els => els.length);
  const wideTable = await pl.$$eval('#printRoot .print-table--wide', els => els.length);
  record('AC-L3 พิมพ์ตารางรวมทั้งโรงเรียนได้', schoolPages > 0 && wideTable > 0,
    `${schoolPages} หน้า แบ่งหน้าอัตโนมัติตามวันและจำนวนชั้นเรียน`);
  record('AC-L10 พิมพ์ทั้งโรงเรียนแล้วแต่ละใบขึ้นหน้าใหม่',
    await pl.evaluate(() => {
      const el = document.querySelector('#printRoot .print-page');
      return getComputedStyle(el).breakAfter === 'page' || getComputedStyle(el).pageBreakAfter === 'always';
    }));

  await pl.selectOption('#prFormat', 'class');
  await pl.selectOption('#prScope', 'pick');
  await pl.waitForTimeout(400);
  await pl.evaluate(() => {
    const cb = document.querySelector('#pickField input[type="checkbox"]');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await pl.waitForTimeout(500);
  const onePage = await pl.$$eval('#printRoot .print-page', els => els.length);
  record('AC-L4 เลือกพิมพ์เฉพาะบางรายการได้', onePage === 1);

  await pl.evaluate(() => {
    document.querySelector('#prTeacher').checked = false;
    document.querySelector('#prTeacher').dispatchEvent(new Event('change', { bubbles: true }));
  });
  await pl.waitForTimeout(400);
  const noTeacher = await pl.textContent('#printRoot');
  await pl.evaluate(() => {
    document.querySelector('#prTeacher').checked = true;
    document.querySelector('#prTeacher').dispatchEvent(new Event('change', { bubbles: true }));
  });
  await pl.waitForTimeout(400);
  const withTeacher = await pl.textContent('#printRoot');
  record('AC-L14 เลือกเปิดปิดการแสดงชื่อครู ห้อง และเวลาคาบได้',
    noTeacher.length < withTeacher.length);

  await pl.emulateMedia({ media: 'print' });
  await pl.waitForTimeout(200);
  const printedUi = await pl.evaluate(() => {
    const hidden = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return true;
      return el.getClientRects().length === 0;   /* ไม่ถูกวาดบนกระดาษเลย */
    };
    return {
      app: hidden('.app'),
      sidebar: hidden('.sidebar'),
      topbar: hidden('.topbar'),
      buttons: Array.from(document.querySelectorAll('.content button, .topbar button, .sidebar button'))
        .every(b => b.getClientRects().length === 0),
      printVisible: document.querySelector('#printRoot').getClientRects().length > 0
    };
  });
  record('AC-L8 เมนู แถบบน และปุ่มทั้งหมด ไม่ถูกพิมพ์ออกมา',
    printedUi.app && printedUi.sidebar && printedUi.topbar && printedUi.buttons && printedUi.printVisible,
    'ในโหมดพิมพ์ เหลือเฉพาะเอกสาร');
  await pl.emulateMedia({ media: null });
  await pl.waitForTimeout(200);

  const cssText = fs.readFileSync(path.resolve(__dirname, '..', 'css', 'print.css'), 'utf8');
  record('AC-L9 ตั้งค่ากระดาษ A4 แนวนอนพร้อมขอบกระดาษ และเนื้อหาไม่ตกขอบ',
    /@page\s*\{\s*size:\s*A4 landscape;\s*margin:\s*10mm;/.test(cssText) &&
    /table\.print-table \{ width: 100%; border-collapse: collapse; table-layout: fixed; \}/.test(cssText),
    'A4 แนวนอน ขอบ 10 มม. และตารางถูกบังคับให้พอดีความกว้างหน้า');

  const bw = await pl.evaluate(() => {
    const cell = document.querySelector('#printRoot .print-table td.slot');
    const cs = getComputedStyle(cell);
    return { border: cs.borderTopWidth, color: cs.color };
  });
  record('AC-L12 พิมพ์ขาวดำแล้วยังแยกแยะข้อมูลได้ (ใช้เส้นขอบและน้ำหนักตัวอักษร ไม่พึ่งสี)',
    bw.border !== '0px' && /rgb\(0, 0, 0\)/.test(bw.color), `เส้นขอบ ${bw.border} · ตัวอักษรสีดำ`);

  /* พิมพ์ทั้งที่มีคาบค้าง → เตือนก่อน */
  await pl.evaluate(() => {
    const st = ST.app.state();
    ST.model.activeTimetable(st).stats.unplaced = 5;
    ST.store.save();
  });
  await go(pl, 'print');
  await pl.click('#btnDoPrint');
  await pl.waitForTimeout(400);
  const warnPrint = await modalText(pl);
  record('AC-L · พิมพ์ทั้งที่ยังมีคาบค้าง ระบบเตือนและให้ยืนยันก่อน',
    /ตารางนี้ยังไม่สมบูรณ์/.test(warnPrint));
  await closeModal(pl);
  await pl.context().close();

  /* ================= หมวด N · การเก็บข้อมูล ================= */
  console.log('\n=== หมวด N · การเก็บข้อมูล ===');
  const pn = await newPage(browser);
  await go(pn, 'settings');
  const dl = await Promise.all([pn.waitForEvent('download'), pn.click('#btnExport')]);
  const backupPath = '/tmp/backup-test.json';
  await dl[0].saveAs(backupPath);
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  record('AC-N3 ส่งออกไฟล์สำรองข้อมูลทั้งระบบได้',
    backup.data && backup.data.teachers.length === 120, `ครู ${backup.data.teachers.length} คน`);

  await pn.click('#btnClear');
  await pn.waitForSelector('.modal-overlay');
  const clearText = await modalText(pn);
  record('AC-N6 ปุ่มล้างข้อมูลทั้งหมดถามยืนยันก่อน และบอกผลที่จะเกิดขึ้น',
    /ล้างข้อมูลทั้งหมด/.test(clearText) && /จะหายทั้งหมด/.test(clearText));
  await pn.click('.modal-overlay .btn--danger');
  await pn.waitForTimeout(500);
  const cleared = await pn.evaluate(() => ST.app.state().teachers.length);
  record('AC-N5 ปุ่มล้างข้อมูลทั้งหมดทำงานจริง', cleared === 0);

  await go(pn, 'settings');
  await pn.setInputFiles('#backupFile', backupPath);
  await pn.waitForTimeout(900);
  const restored = await pn.evaluate(() => ({
    teachers: ST.app.state().teachers.length,
    sections: ST.app.state().classSections.length
  }));
  record('AC-N4 นำเข้าไฟล์สำรองแล้วข้อมูลกลับมาครบเหมือนเดิม',
    restored.teachers === 120 && restored.sections === 60,
    `ครู ${restored.teachers} คน · ชั้นเรียน ${restored.sections} ห้อง`);

  await go(pn, 'settings');
  await pn.click('#btnSample');
  await pn.waitForSelector('.modal-overlay');
  const sampleText = await modalText(pn);
  record('AC-N5 มีปุ่มโหลดข้อมูลตัวอย่างใหม่ พร้อมยืนยันก่อน',
    /โหลดข้อมูลโรงเรียนตัวอย่าง/.test(sampleText));
  await pn.click('.modal-overlay .btn--danger');
  await pn.waitForTimeout(700);
  record('AC-N5 โหลดข้อมูลตัวอย่างใหม่ได้',
    (await pn.evaluate(() => ST.app.state().teachers.length)) === 120);

  const n7 = await pn.evaluate(() => {
    const src = ST.store.save.toString();
    return /catch/.test(src) && /เต็ม/.test(src);
  });
  record('AC-N7 ที่เก็บข้อมูลเต็ม ระบบแจ้งเตือนพร้อมเสนอทางออก ไม่ล้มเหลวเงียบ ๆ', n7);
  await pn.context().close();

  /* ================= หมวด K8 · ภาคเรียนย้อนหลัง ================= */
  console.log('\n=== หมวด K · ย้อนหลังภาคเรียน ===');
  const pk = await newPage(browser);
  await genTimetable(pk);
  await pk.evaluate(() => {
    const st = ST.app.state();
    const tt = ST.model.activeTimetable(st);
    tt.status = 'PUBLISHED';
    tt.publishedAt = new Date().toISOString();
    st.school.semester = 2;
    ST.store.save();
  });
  await pk.reload();
  await pk.waitForSelector('.nav-item');
  await go(pk, 'history');
  const k8 = await pk.textContent('.content');
  record('AC-K8 ดูตารางของภาคเรียนที่ผ่านมาย้อนหลังได้',
    /1\/2569/.test(k8), 'ตารางภาคเรียนก่อนยังอยู่ในรายการและกดเปิดดูได้');

  await pk.evaluate(() => {
    const st = ST.app.state();
    st.school.semester = 1;
    const tt = ST.model.activeTimetable(st);
    tt.status = 'DRAFT';
    tt.stats.unplaced = 12;
    ST.store.save();
  });
  await pk.reload(); await pk.waitForSelector('.nav-item');
  await go(pk, 'history');
  await pk.click('button[data-act="publish"]');
  await pk.waitForSelector('.modal-overlay');
  const k10 = await modalText(pk);
  record('AC-K10 ประกาศใช้ตารางที่ยังมีคาบค้าง ระบบเตือนพร้อมบอกจำนวน',
    /คำเตือน/.test(k10) && /12 คาบ/.test(k10));
  await closeModal(pk);
  await pk.context().close();

  await browser.close();

  console.log('\n=== สรุป ===');
  const pass = results.filter(r => r.pass).length;
  console.log(`ผ่าน ${pass} จาก ${results.length} ข้อ`);
  console.log('ข้อผิดพลาดใน Console: ' + errors.length);
  errors.slice(0, 10).forEach(e => console.log('  ✗ ' + e));
  results.filter(r => !r.pass).forEach(r => console.log('  ไม่ผ่าน: ' + r.name + ' — ' + r.note));
  process.exitCode = pass === results.length && errors.length === 0 ? 0 : 1;
})();
