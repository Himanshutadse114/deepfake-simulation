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
  assert.match(index, /usernamePasswordRequired:\s*true/);
  assert.match(index, /googleRequired:\s*false/);
});

test('generic login uses innvikta username and a password check with brute-force limiting', () => {
  assert.match(config, /AUTH_USERNAME \|\| 'innvikta'/);
  assert.match(auth, /router\.post\('\/login', loginLimiter/);
  assert.match(auth, /windowMs:\s*15 \* 60 \* 1000/);
  assert.match(auth, /limit:\s*8/);
  assert.match(auth, /Incorrect username or password/);
  assert.match(auth, /timingSafeEqual/);
});

test('built-in password is stored only as a strong scrypt hash and can be overridden by environment', () => {
  assert.match(auth, /scryptSync/);
  assert.match(auth, /BUILTIN_PASSWORD_SALT/);
  assert.match(auth, /BUILTIN_PASSWORD_HASH/);
  assert.match(config, /AUTH_PASSWORD/);
  assert.match(render, /key: AUTH_PASSWORD[\s\S]*sync: false/);
  assert.match(env, /^AUTH_PASSWORD=$/m);
});

test('Google OAuth and access-code gate have been removed for the temporary login', () => {
  assert.doesNotMatch(auth, /GOOGLE_AUTHORIZE_URL|GOOGLE_TOKEN_URL|GOOGLE_USERINFO_URL/);
  assert.doesNotMatch(auth, /oauth-state|authorization_code|email_verified/);
  assert.doesNotMatch(config, /GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|AUTH_ACCESS_CODE/);
  assert.doesNotMatch(render, /GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|AUTH_ACCESS_CODE/);
});

test('login session uses a random server-side token and secure HTTP-only cookie', () => {
  assert.match(auth, /randomBytes\(32\)/);
  assert.match(auth, /const sessions = new Map\(\)/);
  assert.match(auth, /httpOnly:\s*true/);
  assert.match(auth, /secure:\s*process\.env\.NODE_ENV === 'production'/);
  assert.match(auth, /sameSite:\s*'lax'/);
  assert.match(auth, /sessions\.get\(token\)/);
});

test('auth module parses as JavaScript', () => {
  assert.doesNotThrow(() => new Function(auth));
});
