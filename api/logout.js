const { cookieName } = require('./auth');

module.exports = (request, response) => {
  response.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  response.writeHead(303, { Location: '/login' });
  response.end();
};
