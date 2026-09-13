const TOPICS = ['AI 교육', '에듀테크', 'AI 에이전트', '미래 교육', 'AI 리터러시', 'site:youtube.com AI 교육 강연'];
const decode = value => (value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
const tag = (xml, name) => decode(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1]);

function parseItems(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(match => {
    const item = match[1], rawTitle = tag(item, 'title'), source = tag(item, 'source'), split = rawTitle.lastIndexOf(' - ');
    return { title: split > 0 ? rawTitle.slice(0, split).trim() : rawTitle, source: source || (split > 0 ? rawTitle.slice(split + 3).trim() : '뉴스'), url: tag(item, 'link'), publishedAt: tag(item, 'pubDate'), description: tag(item, 'description').replace(/<[^>]+>/g, '').slice(0, 250) };
  }).filter(item => item.title && item.url);
}

async function getRecommendations() {
  const results = await Promise.allSettled(TOPICS.map(async topic => {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=ko&gl=KR&ceid=KR:ko`;
    const response = await fetch(url, { headers: { 'User-Agent': 'LearningWave/1.0', 'Accept': 'application/rss+xml, application/xml, text/xml' } });
    if (!response.ok) throw new Error(`RSS ${response.status}`);
    return parseItems(await response.text());
  }));
  const seen = new Set();
  const items = results.flatMap(result => result.status === 'fulfilled' ? result.value : []).filter(item => {
    const id = item.url.replace(/[?#].*$/, ''); if (seen.has(id)) return false; seen.add(id); return true;
  }).slice(0, 15).map((item, index) => ({ ...item, type: /youtube\.com|youtu\.be/i.test(item.url) ? 'video' : 'article', summary: item.description || 'AI와 교육의 최근 흐름을 확인해 보세요.', reason: TOPICS[index % (TOPICS.length - 1)] }));
  if (!items.length) throw new Error('RSS에서 새 콘텐츠를 찾지 못했습니다. 잠시 후 다시 시도해 주세요.');
  return { updatedAt: new Date().toISOString(), source: 'rss', items };
}

// Vercel의 기본 Node.js Serverless Function 형식입니다.
module.exports = async (request, response) => {
  if (!['GET', 'POST'].includes(request.method)) return response.status(405).json({ error: 'Method not allowed' });
  try {
    const data = await getRecommendations();
    response.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    return response.status(200).json(data);
  } catch (error) {
    return response.status(502).json({ error: error.message || '추천을 만들지 못했습니다.' });
  }
};
