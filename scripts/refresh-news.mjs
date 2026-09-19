import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const topics = [
  ['AI 트렌드', '생성형 AI'],
  ['AI 에이전트', 'AI 에이전트'],
  ['바이브 코딩', '바이브 코딩'],
  ['교육의 변화', 'AI 교육'],
  ['창업과 일', 'AI 창업'],
  ['AI 안전', 'AI 안전'],
  ['영상', 'site:youtube.com AI 에이전트']
];

const decode = value => String(value || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
const tag = (xml, name) => decode(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1]);

function parse(xml, topic) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(match => {
    const raw = tag(match[1], 'title');
    const split = raw.lastIndexOf(' - ');
    return {
      title: split > 0 ? raw.slice(0, split).trim() : raw,
      source: tag(match[1], 'source') || (split > 0 ? raw.slice(split + 3).trim() : '뉴스'),
      url: tag(match[1], 'link'),
      publishedAt: tag(match[1], 'pubDate'),
      summary: tag(match[1], 'description').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').slice(0, 220),
      topic,
      type: /youtube\.com|youtu\.be/i.test(tag(match[1], 'link')) ? 'video' : 'article'
    };
  }).filter(item => item.title && item.url);
}

async function fetchTopic([topic, query]) {
  const endpoint = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
  const response = await fetch(endpoint, { headers: { 'User-Agent': 'AI-Insight-Daily/1.0' } });
  if (!response.ok) throw new Error(`${topic}: RSS ${response.status}`);
  return parse(await response.text(), topic);
}

const responses = await Promise.allSettled(topics.map(fetchTopic));
const seen = new Set();
const relevant = item => {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const hasAi = /ai|인공지능|생성형|gpt|llm|openai|클로드|gemini|제미나이|바이브|에이전트/.test(text);
  const needs = {
    'AI 에이전트': /에이전트|agent/.test(text),
    '바이브 코딩': /바이브|코딩|개발/.test(text),
    '교육의 변화': /교육|학습|학교|교사|대학|에듀/.test(text),
    '창업과 일': /창업|스타트업|비즈니스|일자리|직업/.test(text),
    'AI 안전': /안전|규제|정책|보안|윤리/.test(text)
  };
  return hasAi && (item.topic === 'AI 트렌드' || item.topic === '영상' || needs[item.topic]);
};
const items = responses.flatMap(result => result.status === 'fulfilled' ? result.value : [])
  .filter(relevant)
  .filter(item => {
    const key = item.url.replace(/[?#].*$/, '');
    if (seen.has(key)) return false;
    seen.add(key); return true;
  })
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
  .slice(0, 18);

if (!items.length) throw new Error('RSS에서 최신 콘텐츠를 가져오지 못했습니다.');
const output = { updatedAt: new Date().toISOString(), items };
const target = resolve('docs/data/latest.json');
await mkdir(resolve('docs/data'), { recursive: true });
await writeFile(target, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Updated ${items.length} items: ${target}`);
