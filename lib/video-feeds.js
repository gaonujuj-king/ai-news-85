const CHANNELS = [
  { id: 'UCQNE2JmbasNYbjGAcuBiRRg', name: '조코딩 JoCoding' },
  { id: 'UCeN2YeJcBCRJoXgzF_OU3qw', name: '안될공학' }
];
const decode = value => String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/&#(x[0-9a-f]+|\d+);/gi, (match, code) => {
    const point = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
  }).trim();
const tag = (xml, name) => decode(xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1]);

function parseVideoFeed(xml, channel, now = Date.now()) {
  if (!/<feed\b/i.test(xml)) throw new Error('Invalid YouTube feed');
  return [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map(([, entry]) => {
    const id = tag(entry, 'yt:videoId');
    const title = tag(entry, 'title');
    const publishedAt = tag(entry, 'published');
    if (!/^[\w-]{11}$/.test(id) || !title) return null;
    const age = now - Date.parse(publishedAt);
    if (!Number.isFinite(age) || age < 0 || age > 30 * 86400000) return null;
    if (!/\bAI\b|인공지능|생성형|GPT|LLM|에이전트|agent|바이브|코딩|자동화|클로드|claude|제미나이|gemini|딥시크|deepseek|오픈AI|openai|suno|수노|오디오모델|언어모델|멀티모달/i.test(title)) return null;
    return { title, source: tag(entry, 'name') || channel.name, url: `https://www.youtube.com/watch?v=${id}`,
      publishedAt, summary: '', topic: '영상', type: 'video', channelId: channel.id };
  }).filter(Boolean);
}

async function collectVideos({ fetchImpl = (...args) => fetch(...args), now = Date.now() } = {}) {
  const results = await Promise.allSettled(CHANNELS.map(async channel => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetchImpl(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`YouTube RSS ${response.status}`);
        return parseVideoFeed(await response.text(), channel, now);
      } catch (error) { if (attempt === 1) throw error; }
    }
  }));
  const seen = new Set();
  const perChannel = new Map();
  const items = results.flatMap(result => result.status === 'fulfilled' ? result.value : [])
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .filter(item => {
      const count = perChannel.get(item.channelId) || 0;
      if (seen.has(item.url) || count >= 3) return false;
      seen.add(item.url); perChannel.set(item.channelId, count + 1); return true;
    }).slice(0, 6);
  const successfulSources = results.filter(result => result.status === 'fulfilled').length;
  return { items, status: successfulSources === 0 ? 'unavailable' : successfulSources < CHANNELS.length ? 'partial' : items.length ? 'ok' : 'empty',
    checkedAt: new Date(now).toISOString(), successfulSources, sourceCount: CHANNELS.length };
}

module.exports = { collectVideos, parseVideoFeed };
