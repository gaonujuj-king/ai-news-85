const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createBriefingReader } = require('../lib/published-briefing');
const data = time => ({ updatedAt: new Date(time).toISOString(), items: [{ title: 'AI 뉴스', url: 'https://example.com/news' }] });

test('daily JSON changes become visible without redeployment after the cache expires', async () => {
  let time = Date.UTC(2026, 8, 20);
  let current = data(time);
  let calls = 0;
  const reader = createBriefingReader({ now: () => time, fetchImpl: async () => { calls++; return { ok: true, json: async () => current }; } });
  const initial = await reader();
  assert.equal(initial.updatedAt, current.updatedAt);
  await reader();
  assert.equal(calls, 1);
  time += 24 * 60 * 60 * 1000;
  current = data(time);
  const next = await reader();
  assert.notEqual(next.updatedAt, initial.updatedAt);
  assert.equal(next.delivery.fallback, false);
  assert.equal(calls, 2);
});

test('network failure uses backup and marks stale data; recovery resumes fetching', async () => {
  const time = Date.UTC(2026, 8, 20);
  let online = false;
  const reader = createBriefingReader({ now: () => time, readBackup: async () => data(time - 48 * 60 * 60 * 1000), fetchImpl: async () => {
    if (!online) throw Error('offline');
    return { ok: true, json: async () => data(time) };
  } });
  const fallback = await reader();
  assert.equal(fallback.delivery.fallback, true);
  assert.equal(fallback.delivery.stale, true);
  online = true;
  const recovered = await reader();
  assert.equal(recovered.delivery.source, 'github-actions');
  assert.equal(recovered.delivery.stale, false);
});

test('invalid remote data cannot replace the last successful briefing', async () => {
  let time = Date.UTC(2026, 8, 20);
  let current = data(time);
  const reader = createBriefingReader({ now: () => time, fetchImpl: async () => ({ ok: true, json: async () => current }) });
  const valid = await reader();
  time += 6 * 60 * 1000;
  current = { updatedAt: new Date(time).toISOString(), items: [] };
  const fallback = await reader();
  assert.equal(fallback.updatedAt, valid.updatedAt);
  assert.equal(fallback.delivery.fallback, true);
});
