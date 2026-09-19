const { passwordMatches, sessionCookie } = require('./auth');

const page = (error = '') => `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI 인사이트 데일리</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8f7f2;color:#20231f;font-family:system-ui,'Apple SD Gothic Neo',sans-serif}.card{width:min(360px,calc(100% - 48px));padding:32px;background:#fffefa;border:1px solid #e8e7df;border-radius:22px;box-shadow:0 16px 40px #20231f12}h1{font:600 27px Georgia,serif;margin:0 0 10px}p{color:#687067;line-height:1.55;font-size:14px;margin:0 0 22px}input,button{width:100%;box-sizing:border-box;border-radius:12px;padding:13px;font:inherit}input{border:1px solid #d8d8d0;background:white;margin-bottom:10px}button{border:0;background:#20231f;color:white;font-weight:700;cursor:pointer}.error{color:#b33a2a;margin:-10px 0 12px;font-size:13px}</style><main class="card"><h1>AI 인사이트 데일리</h1><p>계속하려면 공유받은 비밀번호를 입력하세요.</p>${error ? `<div class="error">${error}</div>` : ''}<form method="post"><input name="password" type="password" autocomplete="current-password" placeholder="비밀번호" required autofocus><button>들어가기</button></form></main></html>`;

module.exports = async (request, response) => {
  if (!process.env.APP_PASSWORD) {
    response.status(503).send(page('관리자가 보안 설정을 아직 완료하지 않았습니다.'));
    return;
  }
  if (request.method === 'GET') return response.status(200).send(page());
  if (request.method !== 'POST') return response.status(405).end();
  let body = '';
  for await (const part of request) body += part;
  const password = new URLSearchParams(body).get('password') || '';
  if (!passwordMatches(password)) return response.status(401).send(page('비밀번호가 맞지 않습니다. 다시 입력해 주세요.'));
  response.setHeader('Set-Cookie', sessionCookie());
  response.writeHead(303, { Location: '/' });
  response.end();
};
