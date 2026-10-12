// Real Manifest V3 smoke test: service worker, options, popup, and content scripts.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium, launchOptions } = require('./browser.cjs');
const modules = require('../config/modules.json');
const root = path.resolve(__dirname, '..');
(async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><title>Application fixture</title><form id="application">' +
      '<label>First name<input name="firstName"></label>' +
      '<label>Last name<input name="lastName"></label>' +
      '<label>Email<input name="email"></label>' +
      '<label>City<input name="city"></label><button type="submit">Submit application</button></form>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port + '/form.html';
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'autoapply-test-'));
  let context;
  try {
    const opts = launchOptions();
    context = await chromium.launchPersistentContext(profile, {
      ...opts,
      ...(!opts.executablePath ? { channel: 'chromium' } : {}),
      ignoreDefaultArgs: ['--disable-extensions'],
      args: [...opts.args, '--disable-extensions-except=' + root, '--load-extension=' + root]
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    assert.deepEqual(await worker.evaluate(() =>
      [typeof aaCallProvider, typeof aaListModels, typeof aaAnalyzeJob, typeof aaAnswerQuestions]
    ), ['function', 'function', 'function', 'function']);
    await worker.evaluate(async () => {
      await seedIfEmpty();
      await chrome.storage.local.set({
        autoapplyData: {version: 2, activeProfileId: 'smoke', profiles: [{
          id: 'smoke', label: 'Smoke profile', personal: {
            firstName: 'Test', lastName: 'User', email: 'smoke@example.test'
          }, address: {city: 'TestCity'}, links: {}, professional: {},
          experience: [], education: [], customFields: []
        }]},
        autoapplyAI: {provider: 'gemini', keys: {gemini: ''}}
      });
    });
    console.log('PASS real MV3 service-worker module loading');
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('chrome-extension://' + id + '/options/options.html');
    await page.waitForSelector('#profileForm input');
    assert.equal(await page.locator('#profileSelect').inputValue(), 'smoke');
    assert((await page.locator('#profileForm input').count()) > 20);
    assert.equal(await page.evaluate(() => document.styleSheets.length), modules.optionsCss.length);
    await page.locator('#saveBtn').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Saved'));
    await page.locator('.aa-nav-item[data-tab="detection"]').click();
    assert.equal(await page.locator('#detectEnabled').isChecked(), true);
    assert.deepEqual(errors, []);
    console.log('PASS options initialization, profile save, tabs, and split stylesheets');
    await page.goto('chrome-extension://' + id + '/popup/popup.html');
    await page.waitForFunction(() => document.querySelector('#profileSelect').options.length > 0);
    assert.equal(await page.locator('#profileSelect').inputValue(), 'smoke');
    assert.deepEqual(await page.evaluate(() => ({js: AutoApplyModules.js, css: AutoApplyModules.css})),
      {js: modules.contentJs, css: modules.contentCss});
    assert.deepEqual(errors, []);
    console.log('PASS popup initialization and generated fallback module lists');
    await page.goto(url);
    await page.waitForTimeout(500);
    const result = await worker.evaluate(async target => {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      return chrome.tabs.sendMessage(tab.id, {action: 'autoapply-fill'});
    }, url);
    assert.equal(result.filled, 4);
    assert.equal(await page.locator('[name="firstName"]').inputValue(), 'Test');
    assert.equal(await page.locator('[name="email"]').inputValue(), 'smoke@example.test');
    assert.equal(await page.locator('[name="city"]').inputValue(), 'TestCity');
    assert.equal(await page.locator('#autoapply-panel').count(), 1);
    assert.deepEqual(errors, []);
    console.log('PASS real content-script injection, full fill, and result panel');
    console.log('4 entry-point smoke tests passed');
  } finally {
    if (context) await context.close();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(profile, {recursive: true, force: true});
  }
})().catch(e => { console.error(e); process.exit(1); });
