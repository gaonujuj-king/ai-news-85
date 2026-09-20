const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

test('video refresh clears old cards when no videos are available', () => {
  const html = readFileSync(join(__dirname, '../docs/index.html'), 'utf8');
  const source = html.slice(html.indexOf('    function render(data)'), html.indexOf('    async function loadRecommendations()'));
  const elements = Object.fromEntries(['#heroRecommendation','#videoCards','.video-list','#articleFeed'].map(id=>[id,{innerHTML:'old placeholder'}]));
  const context = { document:{querySelector:id=>elements[id]}, esc:x=>String(x||''), ago:()=> '1시간 전', itemMarkup:item=>item.title };
  vm.createContext(context);
  vm.runInContext(source,context);
  context.render({items:[{type:'video',title:'실제 AI 영상',url:'https://www.youtube.com/watch?v=AAAAAAAAAAA',source:'채널'}]});
  assert.match(elements['#videoCards'].innerHTML,/실제 AI 영상/);
  assert.match(elements['#videoCards'].innerHTML,/watch\?v=AAAAAAAAAAA/);
  context.render({items:[],videoCollection:{status:'unavailable'}});
  assert.doesNotMatch(elements['#videoCards'].innerHTML,/실제 AI 영상|old placeholder/);
  assert.match(elements['#videoCards'].innerHTML,/수집이 원활하지/);
  assert.match(elements['.video-list'].innerHTML,/수집이 원활하지/);
  assert.doesNotMatch(html,/EBS 특집|어제 업로드|10대는 왜 학교를 자퇴/);
});
