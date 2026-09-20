const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseVideoFeed, collectVideos } = require('../lib/video-feeds');
const now = Date.UTC(2026, 8, 20);
const entry = (id, title = 'AI 교육 연구 해설', date = now - 86400000) => `<entry><yt:videoId>${id}</yt:videoId><title>${title}</title><published>${new Date(date).toISOString()}</published><author><name>테스트 채널</name></author></entry>`;

test('YouTube Atom IDs preserve different watch URLs and filter old or irrelevant uploads', () => {
  const xml = `<feed>${entry('AAAAAAAAAAA')}${entry('BBBBBBBBBBB')}${entry('CCCCCCCCCCC','일상 브이로그')}${entry('DDDDDDDDDDD','AI 소식',now-31*86400000)}${entry('EEEEEEEEEEE','AI 미래',now+86400000)}</feed>`;
  const items = parseVideoFeed(xml, { id:'channel',name:'test' },now);
  assert.equal(items.length,2);
  assert.equal(items[0].url,'https://www.youtube.com/watch?v=AAAAAAAAAAA');
  assert.equal(items[1].url,'https://www.youtube.com/watch?v=BBBBBBBBBBB');
  assert.equal(items[0].type,'video');
});

test('videos have independent slots and multiple channels; feed failure is explicit', async () => {
  const result = await collectVideos({ now, fetchImpl: async url => ({ ok:true, text:async()=>`<feed>${[0,1,2,3].map(i=>entry((url.includes('UCFC')?'A':url.includes('UCde')?'B':'C').repeat(10)+i)).join('')}</feed>` }) });
  assert.equal(result.items.length,6);
  assert.equal(new Set(result.items.map(x=>x.channelId)).size,3);
  assert.equal(result.status,'ok');
  const failed = await collectVideos({ now, fetchImpl:async()=>{throw Error('offline');} });
  assert.equal(failed.status,'unavailable');
  assert.equal(failed.items.length,0);
});

test('partial failure keeps successful channel videos', async () => {
  const result = await collectVideos({ now, fetchImpl:async url=>{
    if(!url.includes('UCFC'))throw Error('unavailable');
    return {ok:true,text:async()=>`<feed>${entry('AAAAAAAAAAA')}</feed>`};
  } });
  assert.equal(result.status,'partial');
  assert.equal(result.items.length,1);
});
