const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const settle = () => new Promise(setImmediate);

function breakPage({ url = 'https://www.youtube.com/watch?v=test', locale = 'en' } = {}) {
  let now = new Date(2026, 10, 9, 23, 59, 59).getTime();
  const data = { __dailyLimit: { enabled: true, minutes: 1 }, '2026-11-09': { focus: 60, watch: 20 } };
  const messages = JSON.parse(fs.readFileSync(path.join(__dirname, '../_locales', locale, 'messages.json')));
  const elements = ['blockedTitle', 'blockedMessage'].map(key => ({ dataset: { i18n: key }, textContent: '' }));
  const root = { dataset: {} };
  const navigation = [];
  let onChange, tick;
  let fail = false;
  const context = vm.createContext({
    console: { warn() {} },
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [now])); }
    },
    URL,
    location: { hash: '#' + encodeURIComponent(url), replace(value) { navigation.push(value); } },
    document: { documentElement: root, querySelectorAll() { return elements; }, addEventListener() {} },
    window: { addEventListener() {} },
    setInterval(fn) { tick = fn; },
    chrome: {
      i18n: { getUILanguage() { return locale; }, getMessage(key) { return messages[key].message; } },
      storage: {
        local: { async get(keys) {
          if (fail) { fail = false; throw new Error('storage unavailable'); }
          return Object.fromEntries(keys.filter(key => key in data).map(key => [key, data[key]]));
        } },
        onChanged: { addListener(fn) { onChange = fn; } },
      },
    },
  });
  for (const file of ['meter.js', 'blocked.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), context);
  }
  return {
    data, root, elements, navigation,
    async change(values) { Object.assign(data, values); onChange({}, 'local'); await settle(); },
    async nextDay() { now += 2000; tick(); await settle(); },
    async retry() { tick(); await settle(); },
    failNextRead() { fail = true; },
  };
}

test('break page localizes Korean and follows live theme changes', async () => {
  const page = breakPage({ locale: 'ko' });
  await settle();
  assert.equal(page.elements[0].textContent, '오늘의 이용 한도에 도달했어요.');
  assert.match(page.elements[1].textContent, /😌/);
  assert.equal(page.root.lang, 'ko');
  await page.change({ __theme: 'dark' });
  assert.equal(page.root.dataset.theme, 'dark');
  await page.change({ __theme: 'light' });
  assert.equal(page.root.dataset.theme, 'light');
  await page.change({ __theme: 'auto' });
  assert.equal(page.root.dataset.theme, undefined);
  assert.equal(page.navigation.length, 0);
});

test('break page unlocks after local midnight, including a suspended timer', async () => {
  const page = breakPage();
  await settle();
  assert.equal(page.navigation.length, 0);
  await page.nextDay();
  assert.deepEqual(page.navigation, ['https://www.youtube.com/watch?v=test']);
});

test('break page unlocks immediately on limit increase or disabling', async () => {
  for (const limit of [{ enabled: true, minutes: 2 }, { enabled: false, minutes: 1 }]) {
    const page = breakPage();
    await settle();
    await page.change({ __dailyLimit: limit });
    assert.equal(page.navigation.length, 1);
  }
});

test('break page never navigates to forged, malformed, or non-HTTP return URLs', async () => {
  for (const url of ['https://example.com/', 'https://youtube.com.example.com/', 'javascript:alert(1)', 'not a URL']) {
    const page = breakPage({ url });
    await settle();
    await page.change({ __dailyLimit: { enabled: false, minutes: 1 } });
    assert.equal(page.navigation.length, 0);
  }
});

test('break page stays blocked on read failure and recovers on the next check', async () => {
  const page = breakPage();
  await settle();
  page.failNextRead();
  await page.change({ __dailyLimit: { enabled: false, minutes: 1 } });
  assert.equal(page.navigation.length, 0);
  await page.retry();
  assert.equal(page.navigation.length, 1);
});
