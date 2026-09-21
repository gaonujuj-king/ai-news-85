// These are editorial preferences, not automatic fact-checking.
const SOURCES = [
  ['EBS', ['ebs.co.kr']], ['KBS', ['kbs.co.kr']], ['MBC', ['imbc.com']],
  ['SBS', ['sbs.co.kr']], ['연합뉴스', ['yna.co.kr', 'yonhapnews.co.kr']],
  ['BBC', ['bbc.com', 'bbc.co.uk']], ['Reuters', ['reuters.com']],
  ['한겨레', ['hani.co.kr']], ['경향신문', ['khan.co.kr']],
  ['한국일보', ['hankookilbo.com']], ['JTBC', ['jtbc.co.kr']],
  ['사이언스타임즈', ['sciencetimes.co.kr']]
];
const STRONG_DEPTH = /팩트\s*체크|사실\s*확인|검증|탐사|분석|쟁점|논란|부작용|비판/;
const DEPTH = /팩트\s*체크|검증|탐사|심층|분석|해설|기획|연구|보고서|통계|실태|쟁점|영향|한계|문제|위험|격차|차별|논란|규제|정책|노동|일자리|취업|왜|어떻게|이유|변화|대안/;
const PROMOTION = /개최|열렸|열린다|열려|성료|성황|업무\s*협약|협약\s*체결|\bMOU\b|출범식|기념식|시상식|수상|참가자?\s*모집|수강생\s*모집|공모전|교육\s*실시|교육\s*진행|양성\s*과정|인재\s*양성|인재\s*키운|역량\s*강화|체계.{0,10}(구축|강화)|제품\s*출시|신제품|출시|선보[였인여]|완전변경|할인|구매|특가|프로모션|이벤트/i;
const HYPE = /충격|경악|소름|역대급|끝판왕|대박|ㄷㄷ|무조건|안\s*보면\s*손해|[!?！]{2,}/;
function excluded(title) {
  if (/\[광고\]|\[협찬\]|유료\s*광고|협찬\s*영상|보도자료/.test(title) || HYPE.test(title)) return true;
  return PROMOTION.test(title) && !STRONG_DEPTH.test(title);
}
function publisher(sourceUrl) {
  try {
    const host = new URL(sourceUrl).hostname.toLowerCase();
    return SOURCES.find(([, domains]) => domains.some(domain => host === domain || host.endsWith('.' + domain)))?.[0];
  } catch { return undefined; }
}
function selectArticles(candidates, now = Date.now()) {
  const eligible = candidates.flatMap(item => {
    const source = publisher(item.sourceUrl), age = now - Date.parse(item.publishedAt);
    if (!source || excluded(item.title) || !DEPTH.test(item.title) || !Number.isFinite(age) || age < 0 || age > 7 * 86400000) return [];
    const opinion = /칼럼|사설|기고|오피니언/.test(item.title);
    const kind = opinion ? '의견·칼럼' : /팩트\s*체크|검증/.test(item.title) ? '검증 보도' : /연구|보고서|통계/.test(item.title) ? '연구·자료 보도' : '해설·분석';
    return [{ ...item, source, editorial: { kind, reason: `${source} 원출처 · ${kind}`, policy: 'quality-v1' },
      rank: (STRONG_DEPTH.test(item.title) ? 3 : 1) + (/연구|보고서|통계/.test(item.title) ? 1 : 0) - (opinion ? 1 : 0) }];
  }).sort((a,b) => b.rank-a.rank || Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
  const titles = new Set(), urls = new Set(), sources = new Map(), topics = new Map();
  return eligible.filter(item => {
    const title = item.title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,''), url = item.url.replace(/[?#].*$/, '');
    const sourceCount = sources.get(item.source)||0, topicCount = topics.get(item.topic)||0;
    if (titles.has(title)||urls.has(url)||sourceCount>=3||topicCount>=4) return false;
    titles.add(title); urls.add(url); sources.set(item.source,sourceCount+1); topics.set(item.topic,topicCount+1); return true;
  }).slice(0,18).map(({rank,...item})=>item);
}
function educationalVideo(title, entry = '', { description = '', interview = false } = {}) {
  if (/경제\s*폭발|다\s*풀어버|수익\s*보장|돈\s*복사/.test(title)) return false;
  if (excluded(title) || /\/shorts\/|#shorts\b|#쇼츠|#short\b/i.test(entry) || /예고|티저|라이브|생중계|한국기행|세계테마기행|건축탐구|극한직업|먹방|맛집/.test(title)) return false;
  // AI must be the subject, even on a trusted educational channel.
  const ai = /\bAI\b|\bAGI\b|인공지능|생성형|\bGPT\b|ChatGPT|\bLLMs?\b|언어\s*모델|머신\s*러닝|딥\s*러닝|에이전트|클로드|Claude|제미나이|Gemini|Codex|AlphaFold|AlphaGenome|artificial intelligence|machine learning|deep learning|neural network/i;
  const explanation = /다큐프라임|지식채널|#EBR|강연|강의|연구|해설|분석|원리|쟁점|검증|한계|왜|어떻게|이유|배우|실습|how\b|understanding|research|science|lecture|seminar|conference|mathematics|uncertainty|explain|tutorial|podcast|evaluation|benchmark/i;
  if (/introducing|now available|launch|trailer|teaser|sign up|register now|discount/i.test(title)) return false;
  // Reject declared sponsorship, but not a channel's generic business contact footer.
  if (/유료\s*광고|협찬을?\s*(받|통해)|지원을?\s*(받아|통해)\s*제작|sponsored by|paid promotion/i.test(description)) return false;
  const chapters = description.split('\n').filter(line => /^\s*\d{1,2}:\d{2}(?::\d{2})?\s+/.test(line));
  const identifiedGuest = /교수|연구원|연구자|박사|인류학자|대표|소장|개발자|엔지니어/.test(title);
  const structuredInterview = interview && identifiedGuest && chapters.filter(line => ai.test(line)).length >= 2;
  return ai.test(title) && (explanation.test(title) || structuredInterview);
}
module.exports = { selectArticles, educationalVideo, excluded };
