const crypto = require('node:crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('./config');

const router = express.Router();
const AUTH_COOKIE = 'innvikta_project_auth';
const sessions = new Map();

// The built-in password itself is intentionally NOT stored in GitHub. Only a
// scrypt salt + hash are committed. AUTH_PASSWORD can override it on Render.
const BUILTIN_PASSWORD_SALT = '4d0f04f118063f13bcae7ef010b69754';
const BUILTIN_PASSWORD_HASH = 'f2c20597091af5bacbd57a178d39c937af964946479ae2ffe5747d3afe5261d60257c206c0c2da96ae35da6a5f305bcb35f16cd089781bb5d1148ae0d311fd06';

router.use(express.urlencoded({ extended: false, limit: '10kb' }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Too many login attempts. Please try again later.'
});

function parseCookies(req) {
  const header = String(req.headers.cookie || '');
  const cookies = {};
  for (const pair of header.split(';')) {
    const index = pair.indexOf('=');
    if (index <= 0) continue;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (!key) continue;
    try { cookies[key] = decodeURIComponent(value); } catch (_) { cookies[key] = value; }
  }
  return cookies;
}

function safeEqualSecret(provided, expected) {
  const a = crypto.createHash('sha256').update(String(provided || '')).digest();
  const b = crypto.createHash('sha256').update(String(expected || '')).digest();
  return crypto.timingSafeEqual(a, b);
}

function verifyPassword(provided) {
  if (config.auth.password) return safeEqualSecret(provided, config.auth.password);
  const derived = crypto.scryptSync(String(provided || ''), BUILTIN_PASSWORD_SALT, 64).toString('hex');
  return safeEqualSecret(derived, BUILTIN_PASSWORD_HASH);
}

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge
  };
}

function clearCookie(res) {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
}

function isAuthConfigured() {
  return Boolean(config.auth.username && (config.auth.password || BUILTIN_PASSWORD_HASH));
}

function sessionUser(req) {
  const token = parseCookies(req)[AUTH_COOKIE];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.exp <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function createLoginSession(res, username) {
  const token = crypto.randomBytes(32).toString('base64url');
  const maxAge = config.auth.sessionHours * 60 * 60 * 1000;
  const session = { username, exp: Date.now() + maxAge };
  sessions.set(token, session);
  res.cookie(AUTH_COOKIE, token, cookieOptions(maxAge));
  return session;
}

function htmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLogin({ error = '' } = {}) {
  const errorMarkup = error ? `<div class="error">${htmlEscape(error)}</div>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<meta name="theme-color" content="#07090d" />
<title>Innvikta Secure Access</title>
<style>
  *{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#07090d;color:#f6f7f9}body{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% -10%,rgba(241,90,36,.17),transparent 38%),#07090d}.shell{width:min(440px,100%)}.brand{display:flex;align-items:center;gap:10px;margin:0 0 18px 2px;color:#cfd4dc;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.mark{width:10px;height:10px;border-radius:50%;background:#f15a24;box-shadow:0 0 24px rgba(241,90,36,.7)}.card{background:rgba(16,19,25,.94);border:1px solid rgba(255,255,255,.09);border-radius:22px;padding:30px;box-shadow:0 28px 90px rgba(0,0,0,.48)}.eyebrow{color:#f15a24;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px}h1{font-size:28px;line-height:1.1;margin:0 0 10px;letter-spacing:-.035em}p{margin:0 0 24px;color:#929aaa;font-size:14px;line-height:1.55}.form{display:grid;gap:12px}label{font-size:12px;font-weight:700;color:#d8dde5}input{width:100%;height:52px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:#0c0f14;color:#fff;padding:0 14px;font-size:15px;outline:none}input:focus{border-color:#f15a24;box-shadow:0 0 0 3px rgba(241,90,36,.12)}button{height:52px;border-radius:12px;border:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;cursor:pointer}.primary{background:#f15a24;color:#fff;margin-top:4px}.error{padding:11px 13px;border-radius:11px;background:rgba(235,79,79,.10);border:1px solid rgba(235,79,79,.24);color:#ffc3c3;font-size:12px;margin-bottom:14px}.foot{margin:14px 4px 0;color:#606977;text-align:center;font-size:11px;line-height:1.5}@media(max-width:520px){body{padding:14px}.card{padding:24px;border-radius:18px}h1{font-size:24px}}
</style>
</head>
<body>
<main class="shell">
  <div class="brand"><span class="mark"></span>Innvikta secure access</div>
  <section class="card">
    <div class="eyebrow">Private project</div>
    <h1>Sign in to continue</h1>
    <p>This simulation is restricted. Enter the private Innvikta credentials to access the project.</p>
    ${errorMarkup}
    <form class="form" method="post" action="/auth/login">
      <label for="username">Username</label>
      <input id="username" name="username" type="text" required autofocus autocomplete="username" maxlength="80" placeholder="Username" />
      <label for="password">Password</label>
      <input id="password" name="password" type="password" required autocomplete="current-password" maxlength="256" placeholder="Password" />
      <button class="primary" type="submit">Sign in</button>
    </form>
  </section>
  <div class="foot">Access is limited to people who know the private credentials.</div>
</main>
</body>
</html>`;
}

router.get('/', (req, res) => {
  if (sessionUser(req)) return res.redirect('/');
  return res.type('html').send(renderLogin());
});

router.post('/login', loginLimiter, (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const expectedUsername = String(config.auth.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!safeEqualSecret(username, expectedUsername) || !verifyPassword(password)) {
    clearCookie(res);
    return res.status(401).type('html').send(renderLogin({ error: 'Incorrect username or password.' }));
  }

  createLoginSession(res, expectedUsername);
  return res.redirect('/');
});

router.get('/logout', (req, res) => {
  const token = parseCookies(req)[AUTH_COOKIE];
  if (token) sessions.delete(token);
  clearCookie(res);
  return res.redirect('/auth');
});

function requireProjectAuth(req, res, next) {
  const user = sessionUser(req);
  if (!user) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Authentication required.', login: '/auth' });
    }
    return res.redirect('/auth');
  }
  req.authUser = user;
  return next();
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.exp <= now) sessions.delete(token);
  }
}, 30 * 60 * 1000);
cleanupTimer.unref?.();

module.exports = {
  router,
  requireProjectAuth,
  isAuthConfigured,
  sessionUser,
  safeEqualSecret,
  verifyPassword,
  renderLogin,
  createLoginSession
};
