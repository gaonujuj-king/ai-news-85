const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const app = require('../api/app');
const login = require('../api/login');
const logout = require('../api/logout');
const { latestBriefing } = require('../lib/briefing');
const { validSession } = require('../lib/auth');

function response() {
  return {
    headers: {}, statusCode: 200,
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    writeHead(code, headers) { this.status(code); for (const [k, v] of Object.entries(headers)) this.setHeader(k, v); },
    send(body) { this.body = body; return this; },
    json(body) { return this.send(body); },
    end() {}
  };
}

test('password login, protected assets, news, and logout', async t => {
  const oldPassword = process.env.APP_PASSWORD;
  process.env.APP_PASSWORD = 'local-test-password';
  t.after(() => { if (oldPassword === undefined) delete process.env.APP_PASSWORD; else process.env.APP_PASSWORD = oldPassword; });
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return { ok: true, json: async () => ({ updatedAt: new Date().toISOString(), items: [{ title: '생성형 AI 소식', url: 'https://example.com/news' }] }) };
  };
  t.after(() => { global.fetch = originalFetch; });

  for (const path of ['index.html', 'data/latest.json', 'docs/index.html', '../.env']) {
    const res = response();
    await app({ url: '/api/app?path=' + encodeURIComponent(path), headers: {} }, res);
    assert.equal(res.statusCode, 303);
    assert.equal(res.headers.location, '/login');
  }
  assert.equal(calls, 0, 'unauthenticated requests must not collect news');

  let cookie;
  for (const body of [{ password: 'local-test-password' }, 'password=local-test-password', Buffer.from('password=local-test-password'), undefined]) {
    const req = Readable.from(['password=local-test-password']);
    req.method = 'POST';
    req.body = body;
    const res = response();
    await login(req, res);
    assert.equal(res.statusCode, 303);
    cookie = res.headers['set-cookie'].split(';')[0];
    assert.match(res.headers['set-cookie'], /HttpOnly; Secure; SameSite=Lax/);
    assert.equal(validSession({ headers: { cookie } }), true);
  }
  for (const body of [{ password: 'wrong' }, { password: ['local-test-password'] }]) {
    const res = response();
    await login({ method: 'POST', body }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.headers['set-cookie'], undefined);
  }
  for (const path of ['index.html', 'manifest.webmanifest', 'sw.js', 'icon.svg']) {
    const res = response();
    await app({ url: '/api/app?path=' + path, headers: { cookie } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, readFileSync(join(__dirname, '../docs', path)));
    assert.match(res.headers['cache-control'], /no-store/);
  }
  const news = response();
  await app({ url: '/api/app?path=data/latest.json', headers: { cookie } }, news);
  assert.equal(news.statusCode, 200);
  assert.equal(news.body.items.length, 1);
  assert.equal(calls, 1);
  assert.equal(news.body.delivery.source, 'github-actions');

  const missing = response();
  await app({ url: '/api/app?path=../.env', headers: { cookie } }, missing);
  assert.equal(missing.statusCode, 404);
  const res = response();
  logout({}, res);
  assert.match(res.headers['set-cookie'], /Max-Age=0/);
  assert.equal(validSession({ headers: { cookie: res.headers['set-cookie'].split(';')[0] } }), false);

  delete process.env.APP_PASSWORD;
  const unconfigured = response();
  await login({ method: 'GET' }, unconfigured);
  assert.equal(unconfigured.statusCode, 503);
  assert.equal(validSession({ headers: { cookie } }), false);
});

test('shared RSS collector retains sorting, deduplication and failure handling', async t => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => ({ ok: true, text: async () => `<rss><channel>${Array.from({ length: 21 }, (_, i) => `<item><title>생성형 AI ${i} - 출처</title><link>https://example.com/${i}</link><pubDate>${new Date(Date.UTC(2026, 8, i + 1)).toUTCString()}</pubDate><description>AI</description></item>`).join('')}</channel></rss>` });
  const result = await latestBriefing();
  assert.equal(result.items.length, 18);
  assert.equal(result.items[0].title, '생성형 AI 20');
  assert.equal(new Set(result.items.map(item => item.url)).size, 18);
  global.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(latestBriefing, /RSS/);
});
