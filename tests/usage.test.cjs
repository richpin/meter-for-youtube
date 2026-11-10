const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = (name) => fs.readFileSync(path.join(__dirname, '../src', name), 'utf8');
function load(name, globals = {}) {
  const context = vm.createContext({ console, ...globals });
  vm.runInContext(source(name), context);
  return context;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const settle = () => new Promise(setImmediate);

const { Meter } = load('meter.js');
test('daily limit uses Usage seconds, including equality, and defaults to disabled', () => {
  assert.equal(Meter.limitReached(undefined, 10000), false);
  assert.equal(Meter.limitReached(Meter.DEFAULT_LIMIT, 10000), false);
  assert.equal(Meter.limitReached({ enabled: true, minutes: 1 }, 59), false);
  assert.equal(Meter.limitReached({ enabled: true, minutes: 1 }, 60), true);
  assert.equal(Meter.limitReached({ enabled: true, minutes: 1 }, 61), true);
  for (const minutes of [0, -1, 1440, 1441, 1.5, NaN, '60']) assert.equal(Meter.validMinutes(minutes), false);
  for (const minutes of [1, 60, 1439]) assert.equal(Meter.validMinutes(minutes), true);
  assert.equal(Meter.todayKey(new Date(2026, 10, 9, 0, 1)), '2026-11-09');
});

const { UsageLedger } = load('usage-ledger.js');
test('storage notification before write acknowledgement does not double count own seconds', async () => {
  const entry = new UsageLedger('2026-11-09', { focus: 55, watch: 20 });
  entry.pending = { focus: 5, watch: 2 };
  let respond;
  const saving = entry.flush(() => new Promise((resolve) => { respond = resolve; }));
  await settle();
  entry.update({ focus: 60, watch: 22 });
  assert.equal(entry.total.focus, 60);
  // New seconds accumulate while the previous snapshot is in flight.
  entry.pending.focus += 1;
  respond({ focus: 60, watch: 22 });
  await saving;
  assert.deepEqual(plain(entry.total), { focus: 61, watch: 22 });
  assert.deepEqual(plain(entry.pending), { focus: 1, watch: 0 });
});

test('concurrent remote write after own commit is retained', async () => {
  const entry = new UsageLedger('2026-11-09', { focus: 10, watch: 0 });
  entry.pending.focus = 5;
  let respond;
  const saving = entry.flush(() => new Promise((resolve) => { respond = resolve; }));
  await settle();
  entry.update({ focus: 15, watch: 0 });
  entry.update({ focus: 20, watch: 2 });
  respond({ focus: 15, watch: 0 });
  await saving;
  assert.deepEqual(plain(entry.total), { focus: 20, watch: 2 });
});

test('failed saves retain pending seconds and a later flush retries', async () => {
  const entry = new UsageLedger('2026-11-09');
  entry.pending.focus = 5;
  await assert.rejects(entry.flush(() => { throw new Error('offline'); }));
  assert.equal(entry.pending.focus, 5);
  let sent;
  await entry.flush(async (msg) => { sent = msg; return { focus: 5, watch: 0 }; });
  assert.equal(sent.focus, 5);
  assert.equal(entry.pending.focus, 0);
});

test('simultaneous flush requests send a snapshot once', async () => {
  const entry = new UsageLedger('2026-11-09');
  entry.pending.focus = 5;
  let calls = 0;
  const send = async () => { calls++; await settle(); return { focus: 5, watch: 0 }; };
  await Promise.all([entry.flush(send), entry.flush(send), entry.flush(send)]);
  assert.equal(calls, 1);
});

test('late save failure from yesterday cannot change today’s ledger', async () => {
  const yesterday = new UsageLedger('2026-11-08');
  const today = new UsageLedger('2026-11-09', { focus: 20, watch: 4 });
  yesterday.pending.focus = 5;
  await assert.rejects(yesterday.flush(async () => ({ error: 'storage unavailable' })));
  assert.equal(yesterday.pending.focus, 5);
  assert.deepEqual(plain(today.total), { focus: 20, watch: 4 });
});

function background() {
  const data = {};
  let onMessage;
  let fail = false;
  const store = {
    async get(keys) {
      await settle();
      const result = {};
      for (const key of keys === null ? Object.keys(data) : Array.isArray(keys) ? keys : [keys]) {
        if (key in data) result[key] = structuredClone(data[key]);
      }
      return result;
    },
    async set(values) {
      await settle();
      if (fail) { fail = false; throw new Error('disk full'); }
      Object.assign(data, structuredClone(values));
    },
    async remove() {},
  };
  load('background.js', { chrome: {
    storage: { local: store, sync: { async set() {}, async get() { return {}; } } },
    runtime: {
      onMessage: { addListener(fn) { onMessage = fn; } },
      onInstalled: { addListener() {} }, onStartup: { addListener() {} },
    },
  } });
  return {
    data,
    failNextWrite() { fail = true; },
    send(message) { return new Promise((resolve) => onMessage(message, {}, resolve)); },
  };
}

test('background serializes simultaneous tab writes without lost time', async () => {
  const app = background();
  await Promise.all(Array.from({ length: 25 }, () => app.send({ type: 'ADD_TIME', date: '2026-11-09', focus: 5, watch: 2 })));
  assert.deepEqual(plain(app.data['2026-11-09']), { focus: 125, watch: 50 });
});

test('background write failure responds with an error and does not poison later writes', async () => {
  const app = background();
  app.failNextWrite();
  const failed = await app.send({ type: 'ADD_TIME', date: '2026-11-09', focus: 5 });
  assert.equal(failed.error, 'disk full');
  const next = await app.send({ type: 'ADD_TIME', date: '2026-11-09', focus: 3 });
  assert.equal(next.focus, 3);
});


test('remote totals are not discarded when our own save fails', async () => {
  const entry = new UsageLedger('2026-11-09', { focus: 10, watch: 0 });
  entry.pending.focus = 2;
  let reject;
  const saving = entry.flush(() => new Promise((_resolve, fail) => { reject = fail; }));
  await settle();
  entry.update({ focus: 15, watch: 0 });
  reject(new Error('disk full'));
  await assert.rejects(saving);
  assert.equal(entry.total.focus, 17);
  assert.equal(entry.pending.focus, 2);
});

test('ADD_TIME keeps the existing daily-total response contract', async () => {
  const app = background();
  const response = await app.send({ type: 'ADD_TIME', date: '2026-11-09', focus: 5, watch: 2 });
  assert.deepEqual(plain(response), { focus: 5, watch: 2 });
});

test('a committed daily-total acknowledgement is accepted without resending the same seconds', async () => {
  const entry = new UsageLedger('2026-11-09', { focus: 1813680, watch: 1000 });
  entry.pending.focus = 5;
  let persisted = 1813680;
  let writes = 0;
  const send = async ({ focus }) => {
    writes++;
    persisted += focus;
    // ADD_TIME has returned this shape since before the limit feature.
    return { focus: persisted, watch: 1000 };
  };
  const first = await Promise.allSettled([entry.flush(send)]);
  await Promise.allSettled([entry.flush(send)]);
  assert.equal(writes, 1, 'a successful storage commit must not be written again');
  assert.equal(first[0].status, 'fulfilled');
  assert.equal(persisted, 1813685);
  assert.equal(entry.total.focus, 1813685);
});
