const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { validSession } = require('../lib/auth');
const { publishedBriefing } = require('../lib/published-briefing');

const files = new Map([
  ['index.html', 'text/html; charset=utf-8'],
  ['manifest.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['sw.js', 'text/javascript; charset=utf-8'],
  ['icon.svg', 'image/svg+xml'],
  ['data/latest.json', 'application/json; charset=utf-8']
]);

module.exports = async (request, response) => {
  response.setHeader('Cache-Control', 'private, no-store');
  const requested = new URL(request.url, 'https://app.local').searchParams.get('path') || 'index.html';
  // The update script must remain reachable even when an old session expires.
  // It contains no app content; every page and news request still requires login.
  if (requested !== 'sw.js' && !validSession(request)) {
    response.writeHead(303, { Location: '/login', 'Cache-Control': 'no-store' });
    response.end();
    return;
  }
  if (!files.has(requested)) return response.status(404).send('파일을 찾을 수 없습니다.');
  const file = requested;
  try {
    if (file === 'data/latest.json') {
      const briefing = await publishedBriefing();
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store, max-age=0');
      return response.status(200).json(briefing);
    }
    const data = await readFile(join(process.cwd(), 'docs', file));
    response.setHeader('Content-Type', files.get(file));
    response.status(200).send(data);
  } catch {
    response.status(500).send('앱 파일을 불러오지 못했습니다.');
  }
};
