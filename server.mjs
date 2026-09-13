import http from 'node:http';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const cacheFile = join(root, 'data', 'recommendations.json');
loadEnv();
const port = Number(process.env.PORT || 8787);
const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const topics = (process.env.TOPICS || 'AI 교육,에듀테크,AI 에이전트,미래 교육,AI 리터러시').split(',').map(x => x.trim()).filter(Boolean);


const decode = value => value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
function tag(xml, name) { return decode(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || ''); }
function readItems(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(match => {
    const item = match[1], rawTitle = tag(item, 'title'), source = tag(item, 'source');
    const split = rawTitle.lastIndexOf(' - ');
    return { title: split > 0 ? rawTitle.slice(0, split).trim() : rawTitle, source: source || (split > 0 ? rawTitle.slice(split + 3).trim() : '뉴스'), url: tag(item, 'link'), publishedAt: tag(item, 'pubDate'), description: tag(item, 'description').replace(/<[^>]+>/g, '').slice(0, 380) };
  }).filter(x => x.title && x.url);
}
function googleNewsUrl(query) { return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`; }
async function collectCandidates() {
  const queries = [...topics, 'site:youtube.com AI 교육 강연', 'site:youtube.com AI 에이전트 교육'];
  const responses = await Promise.allSettled(queries.map(async query => readItems(await (await fetch(googleNewsUrl(query), { headers: { 'User-Agent': 'LearningWave/1.0' } })).text())));
  const seen = new Set();
  return responses.flatMap(x => x.status === 'fulfilled' ? x.value : []).filter(item => {
    const key = item.url.replace(/[?#].*$/, ''); if (seen.has(key)) return false; seen.add(key); return true;
  }).slice(0, 30);
}
function fallback(items) { return items.slice(0, 12).map((x, i) => ({ ...x, type: /youtube\.com|youtu\.be/i.test(x.url) ? 'video' : 'article', summary: x.description || 'AI와 교육의 최근 흐름을 확인해 보세요.', reason: topics[i % topics.length] || 'AI 교육' })); }
async function curate(items) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'PASTE_YOUR_KEY_HERE') return fallback(items);
  const concise = items.map((x, index) => ({ id: index, title: x.title, source: x.source, url: x.url, date: x.publishedAt, description: x.description }));
  const prompt = `당신은 한국의 유치원교사를 위한 AI·교육 큐레이터입니다. 아래 최신 후보에서 가장 유익하고 신뢰 가능한 10개 이하만 고르세요. 특정 유아교육 기사만 고집하지 말고 AI 시대의 교육, 삶, 일, 창의성, 교사 역량을 폭넓게 포함하세요. 광고·중복·클릭베이트는 제외하세요. 각 항목은 한국어 1문장 요약과 추천 이유를 작성하세요. URL에 youtube가 있으면 type은 video, 아니면 article입니다. 반드시 JSON만 반환하세요: {"items":[{"id":0,"summary":"...","reason":"...","type":"article"}]}. 후보: ${JSON.stringify(concise)}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.25, maxOutputTokens: 2200 } })
  });
  if (!response.ok) throw new Error(`Gemini API ${response.status}: ${(await response.text()).slice(0, 180)}`);
  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('') || '';
  const chosen = JSON.parse(text).items;
  const output = chosen.map(pick => ({ ...items[pick.id], summary: String(pick.summary || ''), reason: String(pick.reason || ''), type: pick.type === 'video' ? 'video' : 'article' })).filter(x => x.title && x.summary);
  return output.length ? output : fallback(items);
}
async function refresh() {
  const candidates = await collectCandidates();
  if (!candidates.length) throw new Error('RSS에서 새 후보를 받지 못했습니다. 인터넷 연결을 확인하세요.');
  const items = await curate(candidates);
  const payload = { updatedAt: new Date().toISOString(), source: process.env.GEMINI_API_KEY ? 'gemini' : 'rss-fallback', items };
  await mkdir(join(root, 'data'), { recursive: true });
  await writeFile(cacheFile, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}
async function cached() { try { return JSON.parse(await readFile(cacheFile, 'utf8')); } catch { return null; } }
function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/api/recommendations' && req.method === 'GET') return json(res, 200, await cached() || { updatedAt:null, items:[] });
    if (url.pathname === '/api/refresh' && req.method === 'POST') return json(res, 200, await refresh());
    const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const file = resolve(root, requested);
    if (!file.startsWith(root)) return json(res, 403, { error:'Forbidden' });
    await access(file); res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }); createReadStream(file).pipe(res);
  } catch (error) { json(res, url.pathname.startsWith('/api/') ? 500 : 404, { error: error.message }); }
});
if (process.argv.includes('--refresh')) { try { const result = await refresh(); console.log(`Updated ${result.items.length} recommendations at ${result.updatedAt}`); } catch (e) { console.error(e.message); process.exitCode = 1; } }
else { server.listen(port, () => console.log(`배움의 파도: http://localhost:${port}`)); }
