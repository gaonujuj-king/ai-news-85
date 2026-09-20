const { collectVideos } = require('./video-feeds');
const topics = [
  ['AI 트렌드', '생성형 AI'],
  ['AI 에이전트', 'AI 에이전트'],
  ['바이브 코딩', '바이브 코딩'],
  ['교육의 변화', 'AI 교육'],
  ['창업과 일', 'AI 창업'],
  ['AI 안전', 'AI 안전']
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
    const url = tag(match[1], 'link');
    return {
      title: split > 0 ? raw.slice(0, split).trim() : raw,
      source: tag(match[1], 'source') || (split > 0 ? raw.slice(split + 3).trim() : '뉴스'),
      url,
      publishedAt: tag(match[1], 'pubDate'),
      summary: tag(match[1], 'description').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').slice(0, 220),
      topic,
      type: /youtube\.com|youtu\.be/i.test(url) ? 'video' : 'article'
    };
  }).filter(item => item.title && item.url);
}

function relevant(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const hasAi = /ai|인공지능|생성형|gpt|llm|openai|클로드|gemini|제미나이|바이브|에이전트/.test(text);
  const keywords = {
    'AI 에이전트': /에이전트|agent/.test(text),
    '바이브 코딩': /바이브|코딩|개발/.test(text),
    '교육의 변화': /교육|학습|학교|교사|대학|에듀/.test(text),
    '창업과 일': /창업|스타트업|비즈니스|일자리|직업/.test(text),
    'AI 안전': /안전|규제|정책|보안|윤리/.test(text)
  };
  return hasAi && (item.topic === 'AI 트렌드' || item.topic === '영상' || keywords[item.topic]);
}

async function latestBriefing() {
  const [results, videos] = await Promise.all([Promise.allSettled(topics.map(async ([topic, query]) => {
    const endpoint = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
    const response = await fetch(endpoint, { headers: { 'User-Agent': 'AI-Insight-Daily/1.0' }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`RSS ${response.status}`);
    return parse(await response.text(), topic);
  })), collectVideos()]);
  const seen = new Set();
  const items = results.flatMap(result => result.status === 'fulfilled' ? result.value : [])
    .filter(relevant).filter(item => {
      const key = item.url.replace(/[?#].*$/, '');
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)).slice(0, 18);
  if (!items.length && !videos.items.length) throw new Error('최신 RSS를 가져오지 못했습니다.');
  const { items: videoItems, ...videoCollection } = videos;
  return { updatedAt: new Date().toISOString(), items: [...items, ...videoItems], videoCollection };
}

module.exports = { latestBriefing };
