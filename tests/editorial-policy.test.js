const { test } = require('node:test');
const assert = require('node:assert/strict');
const { selectArticles, educationalVideo } = require('../lib/editorial-policy');
const now = Date.UTC(2026,8,20);
const article = (title, extra={}) => ({title, source:'연합뉴스',sourceUrl:'https://www.yna.co.kr',url:'https://news.google.com/rss/articles/'+encodeURIComponent(title),publishedAt:new Date(now-3600000).toISOString(),topic:'AI 트렌드', ...extra});

test('structured expert interviews require an AI title and AI chapters; paid promotion is excluded', () => {
  assert.equal(educationalVideo('AI 연구로 생명의 비밀을 다 풀어버렸다'), false);
  assert.equal(educationalVideo('AI 원리로 새로운 경제 폭발한다'), false);
  const context = { interview:true, description:'00:30 AI 시대의 질문\n04:10 인공지능과 직업\n비즈니스 협찬 문의: contact@example.com' };
  assert.equal(educationalVideo('AI 시대의 진로 | 백영재 인류학자', '', context), true);
  assert.equal(educationalVideo('AI 시대의 진로', '', context), false);
  assert.equal(educationalVideo('미래의 진로 | 백영재 인류학자', '', context), false);
  assert.equal(educationalVideo('AI 시대의 진로 | 백영재 인류학자', '', {...context,description:'00:30 AI 시대\n04:10 도서 안내'}), false);
  assert.equal(educationalVideo('AI 기술 원리 분석', '', {description:'이 영상은 기업의 지원을 통해 제작되었습니다.'}), false);
});

test('exclude event announcements, PR and sensational titles even from known publishers', () => {
  for(const title of ['AI 교육 정책 포럼 개최','AI 교육 역량 강화 연수 실시','AI 신제품 출시, 혁신의 이유','AI 연구 업무협약 체결','AI 연구 수상 소식','충격! AI 연구의 진실']) {
    assert.equal(selectArticles([article(title)],now).length,0,title);
  }
  assert.equal(selectArticles([article('AI 교육 행사 예산 논란…집행 실태 분석')],now).length,1);
});

test('publisher labels cannot bypass domain checks; stale articles are excluded', () => {
  for(const sourceUrl of ['https://yna.co.kr.fake.example','https://v.daum.net','', 'https://unknown.example']) {
    assert.equal(selectArticles([article('AI 교육 연구 분석',{sourceUrl})],now).length,0);
  }
  assert.equal(selectArticles([article('AI 교육 연구 분석',{publishedAt:new Date(now-8*86400000).toISOString()})],now).length,0);
});

test('opinions are labelled, repeated titles are deduplicated and publisher dominance is capped', () => {
  const opinion=selectArticles([article('[칼럼] AI 교육 격차의 대안')],now)[0];
  assert.equal(opinion.editorial.kind,'의견·칼럼');
  const items=Array.from({length:8},(_,i)=>article('AI 교육 연구 분석 '+i));
  items.push(article(items[0].title,{url:'https://another.example'}));
  assert.equal(selectArticles(items,now).length,3);
});

test('educational channels still exclude travel, shorts, previews and incidental school mentions', () => {
  for(const title of ['역대급 AI 강의 ㄷㄷ','교육 강연 예고','시골 여행 한국기행','고등학교 때부터 K팝에 빠진 외국인의 결혼 이야기'])assert.equal(educationalVideo(title),false,title);
  assert.equal(educationalVideo('AI 교육 연구 강연','<link href="https://www.youtube.com/shorts/AAAAAAAAAAA"/>'),false);
  assert.equal(educationalVideo('인류학자 교수가 들려주는 인간의 존엄과 호스피스'),false);
  assert.equal(educationalVideo('미술의 철학｜다큐프라임'),false);
  assert.equal(educationalVideo('인공지능이 교육을 바꾸는 원리｜다큐프라임'),true);
  assert.equal(educationalVideo('How AI is transforming weather prediction'),true);
  assert.equal(educationalVideo('2026 Conference on Physics and AI: Research lecture'),true);
  assert.equal(educationalVideo('The mathematics of AI uncertainty'),true);
  assert.equal(educationalVideo('Gemini launch: introducing our AI product'),false);
  assert.equal(educationalVideo('미술의 철학｜다큐프라임','<description>다음 영상은 AI 강연입니다</description>'),false);
});
