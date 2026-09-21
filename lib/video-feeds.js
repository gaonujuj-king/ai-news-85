const { educationalVideo } = require('./editorial-policy');
const CHANNELS = [
  { id: 'UCgheNMc3gGHLsT-RISdCzDQ', name: '세바시 강연', language: 'ko', kind: '강연·인터뷰', interview: true },
  { id: 'UCA_hgsFzmynpv1zkvA5A7jA', name: '지식인사이드', language: 'ko', kind: '강연·인터뷰', interview: true },
  { id: 'UCelFN6fJ6OY6v8pbc_SLiXA', name: '티타임즈TV', language: 'ko', kind: '산업 해설·인터뷰', interview: true },
  { id: 'UC8JOLZ-YA34ylQTz2tqSlGw', name: 'KAIST', language: 'ko', kind: '대학 연구·강연' },
  { id: 'UCeN2YeJcBCRJoXgzF_OU3qw', name: '안될공학', language: 'ko', kind: '기술 해설' },
  { id: 'UChugFTK0KyrES9terTid8vA', name: 'Stanford HAI', language: 'en', kind: '대학 연구·강연' },
  { id: 'UCP7jMXSY2xbc3KCAE0MHQ-A', name: 'Google DeepMind', language: 'en', kind: '연구기관 설명' },
  { id: 'UCFCtZJTuJhE18k8IXwmXTYQ', name: 'EBS 다큐', language: 'ko', kind: '교육 방송' },
  { id: 'UCde6h6P0Axv6hd7u2Y5ykqA', name: 'EBS 비즈니스 리뷰', language: 'ko', kind: '교육 방송' },
  { id: 'UCl_tB4AqPkkxuYcJQHz6dMw', name: 'EBS 교양', language: 'ko', kind: '교육 방송' }
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
    const description = tag(entry, 'media:description');
    if (!educationalVideo(title, entry, { description, interview: channel.interview })) return null;
    return { title, source: tag(entry, 'name') || channel.name, url: `https://www.youtube.com/watch?v=${id}`,
      publishedAt, summary: '', topic: '영상', type: 'video', channelId: channel.id, language: channel.language || 'ko',
      editorial: {kind: channel.interview ? 'AI 강연·인터뷰(의견 포함)' : 'AI 연구·해설', reason: `${channel.name} · ${channel.kind || '전문 해설'} · AI 주제 선별`, policy: 'ai-video-v3'} };
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
    .sort((a, b) => Number(b.language === 'ko') - Number(a.language === 'ko') || Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .filter(item => {
      const count = perChannel.get(item.channelId) || 0;
      if (seen.has(item.url) || count >= 2) return false;
      seen.add(item.url); perChannel.set(item.channelId, count + 1); return true;
    }).slice(0, 6);
  const successfulSources = results.filter(result => result.status === 'fulfilled').length;
  return { items, status: successfulSources === 0 ? 'unavailable' : successfulSources < CHANNELS.length ? 'partial' : items.length ? 'ok' : 'empty',
    checkedAt: new Date(now).toISOString(), successfulSources, sourceCount: CHANNELS.length };
}

module.exports = { collectVideos, parseVideoFeed };
