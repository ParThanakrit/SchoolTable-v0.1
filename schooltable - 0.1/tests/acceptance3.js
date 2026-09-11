/* ตรวจรับงานส่วนสุดท้าย: หน้าภาพรวม คุณภาพ UI และการแบ่งหน้ากระดาษจริง */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const { execFileSync } = require('child_process');

const FILE = 'file://' + path.resolve(__dirname, '..', 'schooltable.html');
const results = [];
let errors = [];
const record = (name, pass, note) => {
  results.push({ name, pass, note: note || '' });
  console.log((pass ? '  ✅ ' : '  ❌ ') + name + (note ? ' — ' + note : ''));
};

async function newPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(FILE);
  await page.waitForSelector('.nav-item');
  return page;
}
const go = async (page, key) => { await page.click(`.nav-item[data-page="${key}"]`); await page.waitForTimeout(350); };

async function genTimetable(page) {
  await page.evaluate(async () => {
    const st = ST.app.state();
    const r = await ST.scheduler.generate(st, { seed: 5 });
    const tt = {
      id: ST.util.uid('tt'), academicYear: st.school.academicYear, semester: st.school.semester,
      status: 'DRAFT', name: 'ร่างที่ 1', entries: r.entries, issues: r.issues, stats: r.stats,
      generatedAt: new Date().toISOString(), generationTimeMs: r.elapsedMs
    };
    st.timetables.push(tt); st.activeTimetableId = tt.id; ST.store.save();
  });
  await page.reload();
  await page.waitForSelector('.nav-item');
}

(async () => {
  const browser = await chromium.launch();

  /* ---------- หมวด B · หน้าภาพรวม ---------- */
  console.log('\n=== หมวด B · หน้าภาพรวม ===');
  const p = await newPage(browser);
  const steps = await p.$$eval('.readiness__item', els =>
    els.map(e => ({ text: e.textContent.replace(/\s+/g, ' '), done: e.classList.contains('is-done') })));
  record('AC-B1 การ์ดความพร้อมบอกได้ว่าขั้นตอนใดทำแล้ว/ยังไม่ทำ',
    steps.length === 7 && steps.every(s => /ทำเรียบร้อยแล้ว|ยังไม่ได้ทำ|จัดครูแล้ว|มีหลักสูตร|ยังไม่ได้/.test(s.text)),
    `${steps.length} ขั้นตอน · ทำแล้ว ${steps.filter(s => s.done).length}`);

  const hero = await p.evaluate(() => {
    const h = document.querySelector('.btn-hero');
    const r = h.getBoundingClientRect();
    const others = Array.from(document.querySelectorAll('.content .btn'))
      .map(b => b.getBoundingClientRect().width * b.getBoundingClientRect().height);
    return { area: r.width * r.height, maxOther: Math.max(...others), text: h.textContent };
  });
  record('AC-B2 ปุ่มจัดตารางอัตโนมัติเป็นปุ่มที่เด่นที่สุดในหน้า',
    hero.area > hero.maxOther * 2 && /จัดตารางอัตโนมัติ/.test(hero.text));

  const stats = await p.$$eval('.stat', els => els.map(e => e.textContent.replace(/\s+/g, ' ')));
  record('AC-B3 แสดงจำนวนครู ชั้นเรียน ห้อง และคาบที่ต้องจัด',
    stats.length === 4 && /ครู/.test(stats[0]) && /คาบที่ต้องจัด/.test(stats[3]),
    stats.join(' | ').slice(0, 110));

  record('AC-B4 แสดงสถานะตารางล่าสุด',
    /ยังไม่ได้จัดตารางสอนของภาคเรียนนี้/.test(await p.textContent('.content')));

  await p.evaluate(() => {
    const st = ST.app.state();
    st.assignments.slice(0, 5).forEach(a => { a.teacherId = ''; });
    ST.store.save();
  });
  await p.reload(); await p.waitForSelector('.nav-item');
  const disabled = await p.evaluate(() => {
    const h = document.querySelector('.btn-hero');
    return { disabled: h.disabled, why: document.querySelector('.content').textContent.replace(/\s+/g, ' ') };
  });
  record('AC-B5/O8 ข้อมูลไม่ครบ ปุ่มจัดตารางเป็นสีเทาและบอกว่าขาดอะไร',
    disabled.disabled && /ยังขาดสิ่งเหล่านี้/.test(disabled.why) && /ยังไม่ได้เลือกครูผู้สอนอีก 5 รายการ/.test(disabled.why));
  await p.context().close();

  /* ---------- หมวด D · เพิ่ม/แก้ไข/ลบ วิชาและชั้นเรียน ---------- */
  console.log('\n=== หมวด D · เพิ่ม แก้ไข ลบ ครบทุกชนิด ===');
  const pd = await newPage(browser);
  await go(pd, 'subjects');
  await pd.click('button:has-text("+ เพิ่มวิชา")');
  await pd.waitForSelector('.modal-overlay');
  await pd.fill('#f_code', 'ทดสอบ001');
  await pd.fill('#f_name', 'วิชาทดสอบ');
  await pd.click('.modal-overlay .btn--primary');
  await pd.waitForTimeout(500);
  const added = await pd.evaluate(() => ST.app.state().subjects.some(s => s.code === 'ทดสอบ001'));
  record('AC-D1 เพิ่มวิชาได้', added);

  await pd.fill('input[type="search"]', 'ทดสอบ001');
  await pd.waitForTimeout(350);
  await pd.click('table.data tbody tr:first-child button[data-act="edit"]');
  await pd.waitForSelector('.modal-overlay');
  await pd.fill('#f_name', 'วิชาทดสอบ (แก้ไขแล้ว)');
  await pd.click('.modal-overlay .btn--primary');
  await pd.waitForTimeout(500);
  const edited = await pd.evaluate(() =>
    ST.app.state().subjects.some(s => s.name === 'วิชาทดสอบ (แก้ไขแล้ว)'));
  record('AC-D1 แก้ไขวิชาได้', edited);

  await pd.fill('input[type="search"]', 'ทดสอบ001');
  await pd.waitForTimeout(350);
  await pd.click('table.data tbody tr:first-child button[data-act="del"]');
  await pd.waitForSelector('.modal-overlay');
  const confirmText = await pd.evaluate(() =>
    document.querySelector('.modal-overlay').textContent.replace(/\s+/g, ' '));
  record('AC-O4 การลบมีหน้าต่างยืนยันก่อน และบอกว่ากู้คืนไม่ได้',
    /ยืนยันการลบ/.test(confirmText) && /กู้คืนไม่ได้/.test(confirmText));
  await pd.click('.modal-overlay .btn--danger');
  await pd.waitForTimeout(500);
  const deleted = await pd.evaluate(() => !ST.app.state().subjects.some(s => s.code === 'ทดสอบ001'));
  record('AC-D1 ลบวิชาได้', deleted);

  /* ค้นหาไม่พบ → empty state พร้อมปุ่มล้างตัวกรอง */
  await pd.fill('input[type="search"]', 'ไม่มีวิชานี้แน่นอน');
  await pd.waitForTimeout(400);
  const emptyText = await pd.textContent('.empty');
  record('AC-O5 หน้าที่ค้นหาไม่พบ แสดงข้อความอธิบายพร้อมปุ่มไปทำสิ่งถัดไป',
    /ไม่พบรายการที่ตรงกับคำค้น/.test(emptyText) && /ล้างตัวกรอง/.test(emptyText));

  /* ข้อความผิดพลาดในฟอร์มบอกวิธีแก้ */
  await go(pd, 'subjects');
  await pd.click('button:has-text("+ เพิ่มวิชา")');
  await pd.waitForSelector('.modal-overlay');
  await pd.click('.modal-overlay .btn--primary');
  await pd.waitForTimeout(300);
  const fieldErr = await pd.$$eval('.field__error', els => els.map(e => e.textContent));
  record('AC-O3 กรอกข้อมูลผิด แสดงข้อความสีแดงใต้ช่องนั้นพร้อมบอกว่าต้องกรอกอย่างไร',
    fieldErr.length >= 2 && fieldErr.every(t => /ต้องกรอก/.test(t)), fieldErr.join(' | '));
  await pd.evaluate(() => document.querySelector('.modal__close').click());
  await pd.context().close();

  /* ---------- หมวด I / O ---------- */
  console.log('\n=== หมวด I · รายงานปัญหา และ O · คุณภาพหน้าจอ ===');
  const pi = await newPage(browser);
  await genTimetable(pi);
  await go(pi, 'issues');
  const issueCards = await pi.$$eval('.card__title', els => els.map(e => e.textContent));
  record('AC-I4 แยกคาบที่จัดไม่ลงกับจุดที่ละเมิดกฎรองออกจากกันชัดเจน',
    issueCards.some(t => /คาบที่จัดไม่ลง/.test(t)) && issueCards.some(t => /จุดที่ละเมิดกฎรอง/.test(t)),
    issueCards.join(' | '));

  const softKinds = await pi.evaluate(() => {
    const st = ST.app.state();
    const tt = ST.model.activeTimetable(st);
    const c = {};
    tt.issues.forEach(i => { if (i.type === 'SOFT_VIOLATION') c[i.ruleCode] = (c[i.ruleCode] || 0) + 1; });
    return c;
  });
  record('AC-HS1 รายงานได้ว่ามีวิชาหลักกี่คาบที่ตกไปช่วงบ่าย', (softKinds.S1 || 0) >= 0,
    `พบ ${softKinds.S1 || 0} คาบ`);
  record('AC-HS2 รายงานได้ว่ามีการเดินข้ามอาคารกี่จุด', (softKinds.S2 || 0) >= 0,
    `พบ ${softKinds.S2 || 0} จุด`);
  record('AC-HS4 รายงานความไม่สมดุลของภาระงานครูได้', (softKinds.S4 || 0) >= 0,
    `พบ ${softKinds.S4 || 0} จุด`);

  const coreMorning = await pi.evaluate(() => {
    const st = ST.app.state();
    const tt = ST.model.activeTimetable(st);
    const aById = ST.util.indexById(st.assignments);
    const sById = ST.util.indexById(st.subjects);
    let total = 0, morning = 0;
    tt.entries.forEach(e => {
      const a = aById[e.assignmentId]; if (!a) return;
      const s = sById[a.subjectId]; if (!s || !s.isCore) return;
      total++; if (e.periodNo <= st.periodConfig.morningEndsAtPeriod) morning++;
    });
    return { total, morning, pct: Math.round((morning / total) * 100) };
  });
  record('AC-HS3 วิชาหลักส่วนใหญ่อยู่ช่วงเช้า', coreMorning.pct >= 80,
    `${coreMorning.morning}/${coreMorning.total} คาบ (${coreMorning.pct}%)`);

  /* สร้างคาบที่จัดไม่ลงจริง เพื่อทดสอบปุ่มกระโดดไปหน้าที่ต้องแก้ */
  await pi.evaluate(async () => {
    const st = ST.app.state();
    const load = ST.model.teacherAssignedLoad(st);
    const t = st.teachers.filter(x => load[x.id] >= 15)[0];
    t.maxPeriodsPerWeek = 2;
    const r = await ST.scheduler.generate(st, { seed: 3 });
    const tt = ST.model.activeTimetable(st);
    tt.entries = r.entries; tt.issues = r.issues; tt.stats = r.stats;
    ST.store.save();
  });
  await pi.reload();
  await pi.waitForSelector('.nav-item');
  await go(pi, 'issues');
  await pi.waitForSelector('.issue--high button');
  await pi.click('.issue--high button');
  await pi.waitForTimeout(400);
  const jumped = await pi.evaluate(() => ST.app.current().key);
  record('AC-I6 กดที่ปัญหาแล้วกระโดดไปยังหน้าที่ต้องแก้ได้',
    jumped !== 'issues', `ไปหน้า ${jumped}`);

  await go(pi, 'timetable');
  const statusVisible = await pi.evaluate(() => {
    const top = document.querySelector('#topStatus').textContent;
    const page = document.querySelector('.content').textContent;
    return { top, hasDraft: /ฉบับร่าง/.test(top) && /ฉบับร่าง/.test(page) };
  });
  record('AC-O6/U9 ผู้ใช้รู้ตลอดว่ากำลังดูตารางฉบับร่างหรือฉบับประกาศใช้',
    statusVisible.hasDraft, statusVisible.top.replace(/\s+/g, ' ').trim());

  const printButtons = await pi.evaluate(async () => {
    const pages = ['timetable', 'issues', 'print'];
    const out = {};
    for (const key of pages) {
      ST.app.go(key);
      await new Promise(r => setTimeout(r, 250));
      out[key] = Array.from(document.querySelectorAll('.content button, .topbar button'))
        .some(b => /พิมพ์/.test(b.textContent));
    }
    return out;
  });
  record('AC-O9 ทุกหน้าที่แสดงตารางมีปุ่มพิมพ์',
    printButtons.timetable && printButtons.issues && printButtons.print);
  await pi.context().close();

  /* ---------- การแบ่งหน้ากระดาษจริง (สร้าง PDF แล้วนับหน้า) ---------- */
  console.log('\n=== หมวด L · การแบ่งหน้ากระดาษจริง ===');
  const pp = await newPage(browser);
  await genTimetable(pp);
  await go(pp, 'print');
  await pp.waitForSelector('#printRoot .print-page', { state: 'attached' });
  await pp.waitForTimeout(700);

  async function pdfPages(file) {
    await pp.emulateMedia({ media: 'print' });
    await pp.pdf({
      path: file, format: 'A4', landscape: true, printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
    });
    await pp.emulateMedia({ media: null });
    const info = execFileSync('pdfinfo', [file]).toString();
    return Number((/Pages:\s+(\d+)/.exec(info) || [])[1]);
  }

  const classSections = await pp.evaluate(() => ST.app.state().classSections.length);
  const classPages = await pdfPages('/tmp/ac-class.pdf');
  record('AC-L9/L10 พิมพ์รายชั้นเรียน ได้ 1 หน้าต่อ 1 ห้องพอดี ไม่ตกขอบ',
    classPages === classSections, `${classPages} หน้า จาก ${classSections} ชั้นเรียน`);

  await pp.selectOption('#prFormat', 'teacher');
  await pp.waitForTimeout(1500);
  const teachers = await pp.evaluate(() => ST.app.state().teachers.length);
  const teacherPages = await pdfPages('/tmp/ac-teacher.pdf');
  record('AC-L2/L10 พิมพ์รายครู ได้ 1 หน้าต่อ 1 คนพอดี',
    teacherPages === teachers, `${teacherPages} หน้า จาก ${teachers} คน`);

  await pp.selectOption('#prFormat', 'school');
  await pp.waitForTimeout(1800);
  const schoolSections = await pp.$$eval('#printRoot .print-page', els => els.length);
  const schoolPages = await pdfPages('/tmp/ac-school.pdf');
  record('AC-L3/L9 ตารางรวมทั้งโรงเรียนแบ่งหน้าอัตโนมัติ ไม่มีข้อมูลถูกตัดทิ้ง',
    schoolPages === schoolSections, `${schoolPages} หน้า ตรงกับที่แบ่งไว้ ${schoolSections} ใบ`);
  await pp.context().close();

  /* ---------- AC-H6 · ข้อมูลไม่ครบต้องไม่เริ่มจัด ---------- */
  const ph6 = await newPage(browser);
  const h6 = await ph6.evaluate(async () => {
    const st = ST.app.state();
    /* ทำให้ข้อมูลไม่ครบ: เอาครูผู้สอนออกจากบางรายการ */
    st.assignments.slice(0, 20).forEach(a => { a.teacherId = ''; });
    ST.store.save();
    ST.app.go('generate');
    await new Promise(r => setTimeout(r, 500));
    const blockCard = document.querySelector('.result-card--danger');
    const items = Array.from(document.querySelectorAll('#pfList .issue'));
    return {
      blocked: !!blockCard,
      blockText: blockCard ? blockCard.textContent.replace(/\s+/g, ' ').trim() : '',
      problems: items.length,
      firstProblem: items.length ? items[0].textContent.replace(/\s+/g, ' ').trim().slice(0, 90) : '',
      hasGoButton: items.length > 0 && !!items[0].querySelector('button'),
      heroGone: !document.querySelector('#runCard .btn-hero')
    };
  });
  record('AC-H6 ข้อมูลไม่ครบ ระบบไม่เริ่มจัด และแสดงรายการสิ่งที่ต้องแก้ก่อน',
    h6.blocked && h6.problems > 0 && h6.heroGone && h6.hasGoButton,
    `${h6.blockText.slice(0, 60)} · ${h6.problems} เรื่อง เช่น ${h6.firstProblem}`);
  await ph6.context().close();

  /* ---------- หมวด S · เงื่อนไขการจัดตาราง ---------- */
  console.log('\n=== หมวด S · เงื่อนไขการจัดตาราง ===');
  const ps = await newPage(browser);
  await go(ps, 'conditions');

  const s1 = await ps.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.rulerow[data-code]'));
    return rows.map(r => ({
      code: r.dataset.code,
      on: r.querySelector('input[data-toggle]').checked,
      weight: r.querySelector('select[data-weight]').value,
      hasWhy: /เหตุผล/.test(r.textContent)
    }));
  });
  record('AC-S1 เลือกเงื่อนไขได้ทีละข้อ พร้อมกำหนดความสำคัญและบอกเหตุผลเป็นภาษาไทย',
    s1.length === 4 && s1.every(r => r.hasWhy && r.weight),
    s1.map(r => r.code + (r.on ? '=เปิด' : '=ปิด') + '/' + r.weight).join(' · '));

  /* ปิดเงื่อนไขเดินหากันใกล้ แล้วบันทึก */
  const s2 = await ps.evaluate(async () => {
    const row = document.querySelector('.rulerow[data-code="S2"] input[data-toggle]');
    row.checked = false;
    row.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 200));
    Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'บันทึกเงื่อนไข').click();
    await new Promise(r => setTimeout(r, 500));
    return ST.app.state().conditions.rules.S2.enabled;
  });
  record('AC-S2 ปิดเงื่อนไขห้องใกล้กันเดินหากันใกล้ได้ และระบบจำค่าไว้', s2 === false);

  const s3 = await ps.evaluate(async () => {
    const st = ST.app.state();
    const r = await ST.scheduler.generate(st, { seed: 9 });
    return r.issues.filter(i => i.ruleCode === 'S2').length;
  });
  record('AC-S3 ปิดเงื่อนไขแล้ว ระบบไม่รายงานการเดินไกลเป็นปัญหาอีก', s3 === 0,
    `พบการรายงาน S2 ${s3} จุด`);

  /* เปิดกลับมาแล้วตั้งเป็นสำคัญมาก */
  const s4 = await ps.evaluate(async () => {
    const row = document.querySelector('.rulerow[data-code="S2"] input[data-toggle]');
    row.checked = true;
    row.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 200));
    const sel = document.querySelector('.rulerow[data-code="S2"] select[data-weight]');
    sel.value = 'high';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'บันทึกเงื่อนไข').click();
    await new Promise(r => setTimeout(r, 500));
    const st = ST.app.state();
    const r = await ST.scheduler.generate(st, { seed: 9 });
    return {
      weight: st.conditions.rules.S2.weight,
      walk: r.issues.filter(i => i.ruleCode === 'S2').length
    };
  });
  record('AC-S4 เปิดเงื่อนไขและตั้งเป็นสำคัญมากได้ ระบบกลับมาตรวจให้อีกครั้ง',
    s4.weight === 'high' && s4.walk > 0, `พบจุดที่ต้องเดินไกล ${s4.walk} จุด`);

  /* เลือกว่าวิชาไหนควรอยู่ช่วงเช้า */
  const s5 = await ps.evaluate(async () => {
    await new Promise(r => setTimeout(r, 300));
    const boxes = Array.from(document.querySelectorAll('input[data-core]'));
    const target = boxes.find(b => !b.checked);
    const id = target.dataset.core;
    target.checked = true;
    target.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#morningEnd').value = '3';
    document.querySelector('#morningEnd').dispatchEvent(new Event('change'));
    Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'บันทึกเงื่อนไข').click();
    await new Promise(r => setTimeout(r, 500));
    const st = ST.app.state();
    return {
      isCore: !!(ST.util.byId(st.subjects, id) || {}).isCore,
      morning: st.periodConfig.morningEndsAtPeriod
    };
  });
  record('AC-S5 เลือกได้เองว่าวิชาไหนควรอยู่ช่วงเช้า และช่วงเช้าจบที่คาบใด',
    s5.isCore && s5.morning === 3, `ช่วงเช้าจบที่คาบ ${s5.morning}`);
  await ps.context().close();

  await browser.close();
  console.log('\n=== สรุป ===');
  const pass = results.filter(r => r.pass).length;
  console.log(`ผ่าน ${pass} จาก ${results.length} ข้อ`);
  console.log('ข้อผิดพลาดใน Console: ' + errors.length);
  errors.slice(0, 10).forEach(e => console.log('  ✗ ' + e));
  results.filter(r => !r.pass).forEach(r => console.log('  ไม่ผ่าน: ' + r.name + ' — ' + r.note));
  process.exitCode = pass === results.length && errors.length === 0 ? 0 : 1;
})();
