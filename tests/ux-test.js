/* Browser checks for the revised single-operator workflow. No real school data is used. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const url = pathToFileURL(path.resolve(__dirname, '..', 'schooltable.html')).href;
const screenshots = process.env.UX_SCREENSHOTS;
let checks = 0;
function check(condition, label) { assert.ok(condition, label); checks++; console.log('PASS ' + label); }

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const go = async key => { await page.locator('.nav-item[data-page="' + key + '"]').click(); await page.waitForFunction(k => ST.app.current().key === k, key); };
    const shot = async name => { if (screenshots) await page.screenshot({ path: path.join(screenshots, name + '.png'), animations:'disabled' }); };
    await page.goto(url);
    await page.waitForSelector('.overview-hero');
    const nav = await page.locator('.nav-item').evaluateAll(nodes => nodes.map(n => n.dataset.page));
    check(nav.length === 16 && nav.indexOf('settings') < nav.indexOf('generate'), '16 pages follow preparation-to-print order');
    for (const key of nav) { await go(key); check(await page.locator('.page-header h1').count() === 1, key + ' opens'); }
    await go('overview');
    check(await page.locator('.readiness-complete').getAttribute('open') === null, 'completed setup is collapsed');
    await shot('front-overview');
    await page.locator('#btnMenu').click();
    check(await page.locator('body').evaluate(el => el.classList.contains('sidebar-collapsed')), 'sidebar collapses');
    await page.reload();
    check(await page.locator('body').evaluate(el => el.classList.contains('sidebar-collapsed')), 'sidebar preference survives reload');
    await page.locator('#btnMenu').click();

    await go('assignments');
    const first = page.locator('#asTable tbody tr').first();
    const original = await first.evaluate(tr => {
      const a = ST.util.byId(ST.app.state().assignments, tr.dataset.id);
      const t = ST.util.byId(ST.app.state().teachers, a.teacherId);
      return { assignment: a.id, teacher: t.id, name: t.name };
    });
    check(await page.locator('#asTable').evaluate(el => el.scrollWidth <= el.parentElement.clientWidth + 2), 'assignment columns fit desktop panel');
    await first.locator('.teacher-picker').first().click();
    await page.locator('#teacherPickerSearch').fill('ชื่อที่ไม่มีในระบบ');
    check((await page.locator('.teacher-results').innerText()).includes('ไม่พบครู'), 'teacher search handles no matches');
    await page.locator('.teacher-option[data-value=""]').click();
    check(await page.evaluate(id => !ST.util.byId(ST.app.state().assignments, id).teacherId, original.assignment), 'clearing a teacher updates data');
    check((await page.locator('#asProgress').innerText()).includes('1,010'), 'progress updates after clearing teacher');
    await first.locator('.teacher-picker').first().click();
    await page.locator('#teacherPickerSearch').fill(original.name);
    check(await page.locator('.teacher-option[data-value="' + original.teacher + '"]').count() === 1, 'teacher can be found by name');
    await page.locator('.teacher-option[data-value="' + original.teacher + '"]').click();
    check((await page.locator('#asSaved').innerText()).includes('บันทึกแล้ว'), 'saved status appears after selection');
    await page.evaluate(() => { ST.store._testSave = ST.store.save; ST.store.save = () => false; });
    await first.locator('.teacher-picker').first().click();
    await page.locator('.teacher-option[data-value="' + original.teacher + '"]').click();
    check((await page.locator('#asSaved').innerText()).includes('บันทึกไม่สำเร็จ'), 'failed save is not displayed as success');
    await page.evaluate(() => { ST.store.save = ST.store._testSave; delete ST.store._testSave; });
    await first.locator('.teacher-picker').first().click();
    await page.locator('.teacher-option[data-value="' + original.teacher + '"]').click();
    await first.locator('.co-teacher summary').click();
    await first.locator('.co-teacher .teacher-picker').click();
    check(await page.locator('.teacher-option[data-value="' + original.teacher + '"]').isDisabled(), 'co-teacher picker prevents choosing the main teacher');
    await page.locator('.modal__close').click();
    await first.locator('.co-teacher summary').click();
    const grade = await page.locator('#secGrade option').nth(2).getAttribute('value');
    await page.locator('#secGrade').selectOption(grade);
    check(await page.locator('#secList .pickitem').evaluateAll((items, gradeId) => items.every(el => ST.util.byId(ST.app.state().classSections, el.dataset.sec).gradeLevelId === gradeId), grade), 'grade filter limits section list');
    await page.locator('#secGrade').selectOption('');
    await shot('front-assignments');

    await go('curriculum');
    const more = page.locator('.row-more').first();
    check(!await more.locator('[data-del]').isVisible(), 'secondary curriculum actions are tucked away');
    await more.locator('summary').click();
    await more.locator('[data-edit]').click();
    check(await page.locator('.modal-overlay').count() === 1, 'rename remains accessible');
    await page.locator('.modal__close').click();

    await go('conditions');
    await page.locator('#w_S1').selectOption('low');
    await page.locator('.nav-item[data-page="locks"]').click();
    check((await page.locator('.modal__title').innerText()).includes('ไม่ได้บันทึก'), 'navigation warns about unsaved conditions');
    await page.locator('.modal__close').click();
    check(await page.locator('#w_S1').inputValue() === 'low', 'cancel navigation preserves pending conditions');
    await page.locator('#saveAndGo').click();
    await page.waitForFunction(() => ST.app.current().key === 'locks');
    check(await page.evaluate(() => ST.app.state().conditions.rules.S1.weight === 'low'), 'save and continue persists conditions');
    await go('conditions'); await page.locator('#w_S1').selectOption('high'); await page.locator('#saveBottom').click();

    await go('generate');
    await page.locator('#optAll').check();
    check(!await page.locator('#optManual').isChecked(), 'generation modes are mutually exclusive');
    await page.locator('#optManual').check();
    await page.locator('#runCard .btn-hero').click();
    await page.waitForSelector('.generation-result', { timeout: 60000 });
    check((await page.locator('.generation-result .result-card__title').innerText()).includes('จัดครบ'), 'generation completes with clear success wording');
    check(await page.evaluate(() => ST.scheduler.auditHardRules(ST.app.state(), ST.model.activeTimetable(ST.app.state()).entries).length === 0), 'generated timetable passes mandatory rules');
    await shot('front-generate');
    await page.locator('.generation-result button').filter({ hasText: 'เปิดตารางเพื่อตรวจ' }).click();
    check((await page.locator('#ttTarget option').allTextContents()).slice(0,3).join('|') === 'ม.1/1|ม.1/2|ม.1/3', 'section numbers use natural ordering');
    await page.locator('#ttSize').selectOption('large');
    check(await page.locator('#content').evaluate(el => el.classList.contains('tt-view-large')), 'larger timetable text is available');
    await page.locator('#ttSize').selectOption('normal');
    await page.locator('#ttFocus').click();
    check(!await page.locator('#sidebar').isVisible(), 'focus view gives the timetable more space');
    await page.locator('#ttFocus').click();
    await page.locator('.tt-entry').first().click();
    check(await page.locator('.modal-overlay').count() === 1, 'lesson details open on click');
    await page.locator('.modal__close').click();

    const move = await page.evaluate(() => {
      const st = ST.app.state(), tt = ST.model.activeTimetable(st);
      for (const el of document.querySelectorAll('.tt-entry[draggable="true"]')) {
        const e = ST.util.byId(tt.entries, el.dataset.entry);
        if (e.pairGroupId || e.lockId) continue;
        const prep = ST.scheduler.prepareMove(st, tt, [e]);
        for (const cell of document.querySelectorAll('.tt-cell')) {
          const day = cell.dataset.day, period = Number(cell.dataset.period);
          if (e.day === day && e.periodNo === period) continue;
          const result = ST.scheduler.checkMoveTarget(prep, day, period);
          if (result.ok) return { id:e.id, day, period, beforeDay:e.day, beforePeriod:e.periodNo, warnings:result.warnings.length };
        }
      }
    });
    check(!!move, 'a valid move is available for interaction test');
    const transfer = await page.evaluateHandle(() => new DataTransfer());
    await page.locator('.tt-entry[data-entry="'+move.id+'"]').dispatchEvent('dragstart', { dataTransfer:transfer });
    check(await page.locator('.tt-cell--drop-ok').count() > 0 && await page.locator('.tt-cell--drop-bad').count() > 0, 'drag highlights allowed and blocked slots');
    await page.locator('.tt-cell[data-day="'+move.day+'"][data-period="'+move.period+'"]').dispatchEvent('drop', { dataTransfer:transfer });
    if (move.warnings) await page.locator('.modal__foot .btn--primary').click();
    check(await page.evaluate(m => { const e=ST.util.byId(ST.model.activeTimetable(ST.app.state()).entries,m.id);return e.day===m.day && e.periodNo===m.period; }, move), 'dropping a lesson moves it');
    await page.locator('#btnUndo').click();
    check(await page.evaluate(m => { const e=ST.util.byId(ST.model.activeTimetable(ST.app.state()).entries,m.id);return e.day===m.beforeDay && e.periodNo===m.beforePeriod; }, move), 'undo restores lesson position');
    await shot('front-timetable');
    await page.locator('#ttPublish').click();
    await page.locator('.modal__foot .btn--primary').click();
    check(await page.evaluate(() => ST.model.activeTimetable(ST.app.state()).status === 'PUBLISHED'), 'publish works from the timetable');
    check(await page.locator('.tt-entry[draggable="true"]').count() === 0, 'published timetable cannot be dragged');
    await page.locator('.tt-entry').first().click();
    check(await page.locator('.modal-overlay select').count() === 0, 'published lesson details are read-only');
    await page.locator('.modal__close').click();

    await go('print');
    check((await page.locator('#btnDoPrint').innerText()).includes('60 หน้า'), 'print button explains the page count');
    await page.locator('#prNext').click();
    check((await page.locator('#previewHost .print-page:visible .print-subject').innerText()).includes('ม.1/2'), 'preview advances in section order');
    await page.locator('#prZoom').selectOption('1');
    check(await page.locator('#previewHost .print-page:visible').evaluate(el => el.style.zoom === '1'), 'preview zoom changes');
    check(await page.locator('#printRoot .print-page').first().evaluate(el => !el.style.zoom && !el.style.display), 'zoom and page navigation do not change the printable document');
    await page.locator('#prZoom').selectOption('fit');
    await shot('front-print');
    await page.locator('#prScope').selectOption('pick');
    check(await page.locator('#btnDoPrint').isDisabled(), 'printing is disabled when selection is empty');
    await page.locator('#pickField label[for]').first().click();
    check((await page.locator('#btnDoPrint').innerText()).includes('1 หน้า'), 'selecting one item updates the print count');
    await page.evaluate(() => { window.print = () => { window.testPrintCalled = true; }; });
    await page.locator('#btnDoPrint').click();
    await page.waitForFunction(() => window.testPrintCalled);
    check(await page.locator('#printRoot .print-page').count() === 1, 'print command contains only the selected item');

    await go('overview');
    check((await page.locator('.overview-hero').innerText()).includes('ตารางล่าสุด'), 'overview promotes the latest timetable');
    await page.locator('#btnTheme').click(); await page.locator('#btnTheme').click();
    check(await page.locator('html').getAttribute('data-theme') === 'dark', 'dark theme still works');
    await page.waitForTimeout(200);
    check(await page.locator('#btnTopPrint').evaluate(el => getComputedStyle(el).backgroundColor === 'rgb(22, 26, 33)'), 'dark theme keeps buttons on a dark surface');
    await shot('front-dark');
    await page.locator('#btnTheme').click();
    await page.setViewportSize({ width: 1190, height: 900 });
    check(await page.locator('.nav-item__text').first().isVisible(), 'menu names remain visible on medium desktop screens');
    await page.setViewportSize({ width: 390, height: 844 });
    check(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth + 1), 'overview fits a phone viewport');
    await page.locator('#btnMenu').click();
    await page.locator('.nav-item[data-page="print"]').click();
    await page.waitForTimeout(200);
    check(await page.locator('#sidebar').evaluate(el => el.getBoundingClientRect().right <= 1), 'phone drawer closes after navigation');
    check(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth + 1), 'print options fit a phone viewport');
    await shot('front-mobile');
    const emptyPage = await browser.newPage();
    emptyPage.on('pageerror', e => errors.push(e.message));
    await emptyPage.goto(url);
    await emptyPage.evaluate(() => { ST.store.replaceState(ST.store.emptyState()); ST.app.refresh(); });
    check((await emptyPage.locator('.overview-hero').innerText()).includes('ตั้งค่าโรงเรียน'), 'a new school starts with a concrete setup action');
    await emptyPage.locator('.overview-hero .btn--primary').click();
    check(await emptyPage.evaluate(() => ST.app.current().key === 'settings'), 'setup action opens the correct form');
    await emptyPage.locator('#scName').fill('โรงเรียนทดสอบ');
    await emptyPage.locator('.workflow-next button').click();
    check((await emptyPage.locator('.modal__title').innerText()).includes('ไม่ได้บันทึก'), 'next-step action protects unsaved school settings');
    await emptyPage.locator('.modal__close').click();
    await emptyPage.close();
    check(errors.length === 0, 'no browser errors: ' + errors.join(' | '));
    console.log('Completed ' + checks + ' UX checks.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
