/* ทดสอบหน้าเว็บจริงด้วยเบราว์เซอร์ — เปิดจากไฟล์โดยตรงเหมือนผู้ใช้ */
'use strict';
const { chromium } = require('playwright');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, '..', 'schooltable.html');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  await page.goto(FILE);
  await page.waitForSelector('.nav-item');
  await page.waitForTimeout(600);

  console.log('หัวข้อหน้าแรก:', await page.textContent('.page-header h1'));
  console.log('ชื่อโรงเรียนบนแถบบน:', await page.textContent('#topSchool'));

  const navKeys = await page.$$eval('.nav-item', els => els.map(e => e.dataset.page));
  console.log('เมนูทั้งหมด:', navKeys.join(', '));

  for (const key of navKeys) {
    await page.click(`.nav-item[data-page="${key}"]`);
    await page.waitForTimeout(350);
    const h1 = await page.textContent('.page-header h1').catch(() => '(ไม่มีหัวข้อ)');
    const cards = await page.$$eval('.card, .empty, .result-card', els => els.length);
    console.log(`  หน้า ${key.padEnd(12)} → ${h1} (${cards} บล็อก)`);
  }

  console.log('\nข้อผิดพลาดใน Console:', errors.length);
  errors.slice(0, 20).forEach(e => console.log('  ✗', e));

  await page.screenshot({ path: '/tmp/shot-overview.png', fullPage: false });
  await browser.close();
  process.exitCode = errors.length ? 1 : 0;
})();
