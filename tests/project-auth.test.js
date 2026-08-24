const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const auth = read('server/auth.js');
const index = read('server/index.js');
const config = read('server/config.js');
const render = read('render.yaml');
const env = read('.env.example');

test('project routes are protected while Render health remains public', () => {
  const health = index.indexOf("app.get('/api/health'");
  const authRouter = index.indexOf("app.use('/auth', authRouter)");
  const guard = index.indexOf('app.use(requireProjectAuth)');
  const admin = index.indexOf("app.use('/api/admin'");
  assert.ok(health >= 0 && authRouter > health && guard > authRouter && admin > guard);
  assert.match(index, /accessCodeRequired:\s*true/);
  assert.match(index, /googleRequired:\s*true/);
});

test('access code gate uses timing-safe comparison and brute-force rate limiting', () => {
  assert.match(auth, /timingSafeEqual/);
  assert.match(auth, /createHash\('sha256'\)/);
  assert.match(auth, /windowMs:\s*15 \* 60 \* 1000/);
  assert.match(auth, /limit:\s*8/);
  assert.match(auth, /router\.post\('\/code', codeLimiter/);
});

test('Google OAuth requires a valid code gate and validates OAuth state', () => {
  assert.match(auth, /if \(!gateToken\(req\)\) return res\.redirect\('\/auth'\)/);
  assert.match(auth, /GOOGLE_AUTHORIZE_URL/);
  assert.match(auth, /GOOGLE_TOKEN_URL/);
  assert.match(auth, /GOOGLE_USERINFO_URL/);
  assert.match(auth, /purpose:\s*'oauth-state'/);
  assert.match(auth, /authorization_code/);
  assert.match(auth, /email_verified !== true/);
});

test('authentication cookies are signed, HTTP-only and secure in production', () => {
  assert.match(auth, /createHmac\('sha256'/);
  assert.match(auth, /httpOnly:\s*true/);
  assert.match(auth, /secure:\s*process\.env\.NODE_ENV === 'production'/);
  assert.match(auth, /sameSite:\s*'lax'/);
  assert.match(auth, /purpose:\s*'session'/);
});

test('auth configuration is fail-closed and secrets stay in environment variables', () => {
  for (const key of ['AUTH_ACCESS_CODE', 'AUTH_SESSION_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) {
    assert.match(config, new RegExp(key));
    assert.match(render, new RegExp(`key: ${key}`));
    assert.match(env, new RegExp(`^${key}=`, 'm'));
  }
  assert.match(auth, /Project authentication is not configured/);
  assert.match(render, /key: APP_BASE_URL[\s\S]*sync: false/);
});

test('optional Google account allow-list controls are supported', () => {
  assert.match(config, /AUTH_ALLOWED_EMAILS/);
  assert.match(config, /AUTH_ALLOWED_DOMAIN/);
  assert.match(auth, /allowedEmails/);
  assert.match(auth, /allowedDomain/);
});

test('auth module parses as JavaScript', () => {
  assert.doesNotThrow(() => new Function(auth));
});
