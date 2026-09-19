const crypto = require('node:crypto');

const WEEK = 7 * 24 * 60 * 60 * 1000;
const cookieName = 'ai_insight_session';

function secret() {
  return process.env.AUTH_SECRET || '';
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

function sessionCookie() {
  const value = `${Date.now()}.${crypto.randomBytes(16).toString('base64url')}`;
  return `${cookieName}=${value}.${sign(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(WEEK / 1000)}`;
}

function validSession(request) {
  if (!secret()) return false;
  const value = (request.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = sign(payload);
  const actual = parts[2];
  if (actual.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) return false;
  const issuedAt = Number(parts[0]);
  return Number.isFinite(issuedAt) && issuedAt + WEEK > Date.now();
}

function passwordMatches(candidate) {
  const configured = process.env.APP_PASSWORD || '';
  if (!configured || !candidate) return false;
  const candidateBuffer = Buffer.from(candidate);
  const configuredBuffer = Buffer.from(configured);
  return candidateBuffer.length === configuredBuffer.length && crypto.timingSafeEqual(candidateBuffer, configuredBuffer);
}

module.exports = { cookieName, passwordMatches, sessionCookie, validSession };
