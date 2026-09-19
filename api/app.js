const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { validSession } = require('./auth');

const files = new Map([
  ['index.html', 'text/html; charset=utf-8'],
  ['manifest.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['sw.js', 'text/javascript; charset=utf-8'],
  ['icon.svg', 'image/svg+xml'],
  ['data/latest.json', 'application/json; charset=utf-8']
]);

module.exports = async (request, response) => {
  if (!validSession(request)) {
    response.writeHead(303, { Location: '/login', 'Cache-Control': 'no-store' });
    response.end();
    return;
  }
  const requested = new URL(request.url, 'https://app.local').searchParams.get('path') || 'index.html';
  const file = files.get(requested) ? requested : 'index.html';
  try {
    const data = await readFile(join(process.cwd(), 'docs', file));
    response.setHeader('Content-Type', files.get(file));
    response.setHeader('Cache-Control', file === 'data/latest.json' ? 'no-store' : 'private, max-age=3600');
    response.status(200).send(data);
  } catch {
    response.status(500).send('앱 파일을 불러오지 못했습니다.');
  }
};
