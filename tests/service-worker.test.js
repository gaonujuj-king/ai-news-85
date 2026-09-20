const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

test('legacy cached pages reload once, without removing unrelated caches', async () => {
  const handlers = {};
  const keys = new Set(['learning-wave-v1', 'ai-insight-daily-v1', 'unrelated-cache']);
  const navigations = [];
  let claimed = false;
  vm.runInNewContext(readFileSync(join(__dirname, '../docs/sw.js'), 'utf8'), {
    self: {
      registration: { scope: 'https://app.example/' },
      addEventListener: (name, fn) => { handlers[name] = fn; },
      skipWaiting: async () => {},
      clients: {
        claim: async () => { claimed = true; },
        matchAll: async () => [{ url: 'https://app.example/', navigate: async url => { assert.equal(claimed, true); navigations.push(url); } }]
      }
    },
    caches: { keys: async () => [...keys], delete: async key => keys.delete(key) },
    fetch: async () => {}
  });
  let completion;
  handlers.activate({ waitUntil: promise => { completion = promise; } });
  await completion;
  assert.deepEqual([...keys], ['unrelated-cache']);
  assert.equal(navigations.length, 1);
  handlers.activate({ waitUntil: promise => { completion = promise; } });
  await completion;
  assert.equal(navigations.length, 1, 'no reload loop after migration');
});
