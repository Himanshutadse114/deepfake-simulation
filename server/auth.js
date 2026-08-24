const crypto = require('node:crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('./config');

const router = express.Router();

const AUTH_COOKIE = 'innvikta_project_auth';
const GATE_COOKIE = 'innvikta_project_gate';
const STATE_COOKIE = 'innvikta_google_state';
const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

router.use(express.urlencoded({ extended: false, limit: '10kb' }));

const codeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Too many access-code attempts. Please try again later.'
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

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function signToken(payload) {
  const encoded = base64UrlJson(payload);
  const signature = crypto
    .createHmac('sha256', config.auth.sessionSecret)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyToken(token, expectedPurpose) {
  if (!token || !config.auth.sessionSecret) return null;
  const [encoded, providedSignature, extra] = String(token).split('.');
  if (!encoded || !providedSignature || extra) return null;

  const expectedSignature = crypto
    .createHmac('sha256', config.auth.sessionSecret)
    .update(encoded)
    .digest('base64url');

  const a = Buffer.from(providedSignature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (expectedPurpose && payload.purpose !== expectedPurpose) return null;
    if (!Number.isFinite(payload.exp) || payload.exp <= Date.now()) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function safeEqualSecret(provided, expected) {
  const a = crypto.createHash('sha256').update(String(provided || '')).digest();
  const b = crypto.createHash('sha256').update(String(expected || '')).digest();
  return crypto.timingSafeEqual(a, b);
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

function clearCookie(res, name) {
  res.clearCookie(name, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
}

function isAuthConfigured() {
  return Boolean(
    config.auth.accessCode &&
    config.auth.sessionSecret &&
    config.auth.googleClientId &&
    config.auth.googleClientSecret
  );
}

function baseUrlFor(req) {
  if (config.auth.appBaseUrl) return config.auth.appBaseUrl;
  return `${req.protocol}://${req.get('host')}`;
}

function callbackUrlFor(req) {
  return `${baseUrlFor(req)}/auth/google/callback`;
}

function sessionUser(req) {
  return verifyToken(parseCookies(req)[AUTH_COOKIE], 'session');
}

function gateToken(req) {
  return verifyToken(parseCookies(req)[GATE_COOKIE], 'gate');
}

function htmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLogin({ stage = 'code', error = '', configured = true } = {}) {
  const googleReady = stage === 'google';
  const title = configured ? 'Protected simulation' : 'Authentication setup required';
  const subtitle = configured
    ? 'Enter the private access code, then verify with Google to continue.'
    : 'The project is locked until the required authentication environment variables are configured.';
  const errorMarkup = error ? `<div class="error">${htmlEscape(error)}</div>` : '';

  const body = !configured
    ? `<div class="setup">
        <strong>Required server variables</strong>
        <code>AUTH_ACCESS_CODE</code>
        <code>AUTH_SESSION_SECRET</code>
        <code>GOOGLE_CLIENT_ID</code>
        <code>GOOGLE_CLIENT_SECRET</code>
        <code>APP_BASE_URL</code>
      </div>`
    : googleReady
      ? `<div class="success">Access code accepted</div>
         <a class="google" href="/auth/google">
           <span class="g">G</span><span>Continue with Google</span>
         </a>
         <form method="post" action="/auth/reset"><button class="link" type="submit">Use a different access code</button></form>`
      : `<form class="form" method="post" action="/auth/code">
          <label for="accessCode">Private access code</label>
          <input id="accessCode" name="accessCode" type="password" required autofocus autocomplete="one-time-code" maxlength="256" placeholder="Enter access code" />
          <button class="primary" type="submit">Verify code</button>
        </form>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<meta name="theme-color" content="#07090d" />
<title>${title}</title>
<style>
  *{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#07090d;color:#f6f7f9}body{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% -10%,rgba(241,90,36,.17),transparent 38%),#07090d}.shell{width:min(440px,100%)}.brand{display:flex;align-items:center;gap:10px;margin:0 0 18px 2px;color:#cfd4dc;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.mark{width:10px;height:10px;border-radius:50%;background:#f15a24;box-shadow:0 0 24px rgba(241,90,36,.7)}.card{background:rgba(16,19,25,.94);border:1px solid rgba(255,255,255,.09);border-radius:22px;padding:30px;box-shadow:0 28px 90px rgba(0,0,0,.48)}.eyebrow{color:#f15a24;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px}h1{font-size:28px;line-height:1.1;margin:0 0 10px;letter-spacing:-.035em}p{margin:0 0 24px;color:#929aaa;font-size:14px;line-height:1.55}.form{display:grid;gap:12px}label{font-size:12px;font-weight:700;color:#d8dde5}input{width:100%;height:52px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:#0c0f14;color:#fff;padding:0 14px;font-size:15px;outline:none}input:focus{border-color:#f15a24;box-shadow:0 0 0 3px rgba(241,90,36,.12)}button,.google{height:52px;border-radius:12px;border:0;display:flex;align-items:center;justify-content:center;gap:10px;font-weight:800;font-size:14px;text-decoration:none;cursor:pointer}.primary{background:#f15a24;color:#fff;margin-top:4px}.google{background:#fff;color:#14171c}.g{font-size:19px;font-family:Arial,sans-serif;font-weight:900}.success{padding:12px 14px;border-radius:11px;background:rgba(35,180,111,.10);border:1px solid rgba(35,180,111,.25);color:#b9f0d3;font-size:12px;font-weight:750;margin-bottom:14px}.error{padding:11px 13px;border-radius:11px;background:rgba(235,79,79,.10);border:1px solid rgba(235,79,79,.24);color:#ffc3c3;font-size:12px;margin-bottom:14px}.link{height:auto;background:transparent;color:#9098a6;margin:15px auto 0;font-size:12px;font-weight:700}.setup{display:grid;gap:8px}.setup strong{font-size:12px;margin-bottom:4px}.setup code{display:block;padding:10px 12px;background:#0b0e13;border:1px solid rgba(255,255,255,.07);border-radius:9px;color:#cbd2dc;font-size:12px}.foot{margin:14px 4px 0;color:#606977;text-align:center;font-size:11px;line-height:1.5}@media(max-width:520px){body{padding:14px}.card{padding:24px;border-radius:18px}h1{font-size:24px}}
</style>
</head>
<body>
<main class="shell">
  <div class="brand"><span class="mark"></span>Innvikta secure access</div>
  <section class="card">
    <div class="eyebrow">Private access</div>
    <h1>${title}</h1>
    <p>${subtitle}</p>
    ${errorMarkup}
    ${body}
  </section>
  <div class="foot">Both the private code and a verified Google account are required.</div>
</main>
</body>
</html>`;
}

function isAllowedGoogleUser(user) {
  const email = String(user?.email || '').trim().toLowerCase();
  if (!email || user?.email_verified !== true) return false;
  if (config.auth.allowedEmails.length && !config.auth.allowedEmails.includes(email)) return false;
  if (config.auth.allowedDomain && !email.endsWith(`@${config.auth.allowedDomain}`)) return false;
  return true;
}

router.get('/', (req, res) => {
  if (!isAuthConfigured()) return res.status(503).type('html').send(renderLogin({ configured: false }));
  if (sessionUser(req)) return res.redirect('/');
  return res.type('html').send(renderLogin({ stage: gateToken(req) ? 'google' : 'code' }));
});

router.post('/code', codeLimiter, (req, res) => {
  if (!isAuthConfigured()) return res.status(503).type('html').send(renderLogin({ configured: false }));
  if (!safeEqualSecret(req.body?.accessCode, config.auth.accessCode)) {
    clearCookie(res, GATE_COOKIE);
    return res.status(401).type('html').send(renderLogin({ stage: 'code', error: 'Incorrect access code.' }));
  }

  const maxAge = config.auth.gateMinutes * 60 * 1000;
  res.cookie(GATE_COOKIE, signToken({
    purpose: 'gate',
    exp: Date.now() + maxAge,
    nonce: crypto.randomBytes(16).toString('base64url')
  }), cookieOptions(maxAge));
  return res.redirect('/auth');
});

router.post('/reset', (_req, res) => {
  clearCookie(res, GATE_COOKIE);
  clearCookie(res, STATE_COOKIE);
  return res.redirect('/auth');
});

router.get('/google', (req, res) => {
  if (!isAuthConfigured()) return res.status(503).type('html').send(renderLogin({ configured: false }));
  if (!gateToken(req)) return res.redirect('/auth');

  const state = crypto.randomBytes(24).toString('base64url');
  const stateMaxAge = 5 * 60 * 1000;
  res.cookie(STATE_COOKIE, signToken({
    purpose: 'oauth-state',
    state,
    exp: Date.now() + stateMaxAge
  }), cookieOptions(stateMaxAge));

  const params = new URLSearchParams({
    client_id: config.auth.googleClientId,
    redirect_uri: callbackUrlFor(req),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
    include_granted_scopes: 'true'
  });
  return res.redirect(`${GOOGLE_AUTHORIZE_URL}?${params.toString()}`);
});

router.get('/google/callback', async (req, res) => {
  if (!isAuthConfigured()) return res.status(503).type('html').send(renderLogin({ configured: false }));
  if (!gateToken(req)) return res.redirect('/auth');

  const statePayload = verifyToken(parseCookies(req)[STATE_COOKIE], 'oauth-state');
  const incomingState = String(req.query.state || '');
  const code = String(req.query.code || '');
  clearCookie(res, STATE_COOKIE);

  if (!statePayload || !incomingState || !safeEqualSecret(incomingState, statePayload.state) || !code) {
    return res.status(401).type('html').send(renderLogin({ stage: 'google', error: 'Google sign-in could not be verified. Please try again.' }));
  }

  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.auth.googleClientId,
        client_secret: config.auth.googleClientSecret,
        redirect_uri: callbackUrlFor(req),
        grant_type: 'authorization_code'
      })
    });
    if (!tokenResponse.ok) throw new Error(`Google token exchange failed (${tokenResponse.status}).`);
    const tokens = await tokenResponse.json();
    if (!tokens.access_token) throw new Error('Google did not return an access token.');

    const userResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { authorization: `Bearer ${tokens.access_token}` }
    });
    if (!userResponse.ok) throw new Error(`Google user verification failed (${userResponse.status}).`);
    const user = await userResponse.json();
    if (!isAllowedGoogleUser(user)) {
      return res.status(403).type('html').send(renderLogin({
        stage: 'google',
        error: 'This Google account is not allowed to access the project.'
      }));
    }

    const maxAge = config.auth.sessionHours * 60 * 60 * 1000;
    res.cookie(AUTH_COOKIE, signToken({
      purpose: 'session',
      sub: String(user.sub || ''),
      email: String(user.email || '').toLowerCase(),
      name: String(user.name || user.email || 'Google user'),
      exp: Date.now() + maxAge
    }), cookieOptions(maxAge));
    clearCookie(res, GATE_COOKIE);
    return res.redirect('/');
  } catch (error) {
    console.error('[project-auth]', error.message);
    return res.status(502).type('html').send(renderLogin({
      stage: 'google',
      error: 'Google sign-in was temporarily unavailable. Please try again.'
    }));
  }
});

router.get('/logout', (_req, res) => {
  clearCookie(res, AUTH_COOKIE);
  clearCookie(res, GATE_COOKIE);
  clearCookie(res, STATE_COOKIE);
  return res.redirect('/auth');
});

function requireProjectAuth(req, res, next) {
  if (!isAuthConfigured()) {
    if (req.path.startsWith('/api/')) {
      return res.status(503).json({ error: 'Project authentication is not configured.' });
    }
    return res.redirect('/auth');
  }

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

module.exports = {
  router,
  requireProjectAuth,
  isAuthConfigured,
  sessionUser,
  signToken,
  verifyToken,
  safeEqualSecret,
  isAllowedGoogleUser,
  renderLogin
};
