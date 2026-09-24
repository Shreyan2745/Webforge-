// Smoke test for auth against a RUNNING server + real database.
// 1) npm run dev   2) in another terminal: npm run smoke:auth
// Creates a throwaway user (smoke+<timestamp>@test.dev) each run.

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:5000/api/v1';
let cookie = '';
let passed = 0;
let failed = 0;

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  return { status: res.status, body: await res.json().catch(() => ({})), setCookie };
}

function check(name, condition, info) {
  if (condition) passed++;
  else failed++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${condition ? '' : `\n      got: ${JSON.stringify(info)}`}`);
}

(async () => {
  const email = `smoke+${Date.now()}@test.dev`;
  let r;

  r = await call('POST', '/auth/register', { name: 'Smoke Test', email, password: 'secret123', role: 'ADMIN' });
  check('register -> 201', r.status === 201, r.body);
  check('role in body ignored (USER)', r.body.data?.user?.role === 'USER', r.body);
  check('password never returned', r.body.data?.user && !('password' in r.body.data.user), r.body);
  check('HTTP-only cookie set', /HttpOnly/i.test(r.setCookie || ''), r.setCookie);

  r = await call('GET', '/auth/me');
  check('me with cookie -> 200', r.status === 200 && r.body.data?.user?.email === email, r.body);

  r = await call('POST', '/auth/register', { name: 'Smoke Test', email, password: 'secret123' });
  check('duplicate email -> 409 EMAIL_TAKEN', r.status === 409 && r.body.error?.code === 'EMAIL_TAKEN', r.body);

  r = await call('POST', '/auth/logout');
  check('logout -> 200', r.status === 200, r.body);
  cookie = '';

  r = await call('GET', '/auth/me');
  check('me without cookie -> 401', r.status === 401, r.body);

  r = await call('POST', '/auth/login', { email, password: 'wrongpass1' });
  check('wrong password -> 401 INVALID_CREDENTIALS', r.status === 401 && r.body.error?.code === 'INVALID_CREDENTIALS', r.body);

  r = await call('POST', '/auth/login', { email: email.toUpperCase(), password: 'secret123' });
  check('login (case-insensitive email) -> 200', r.status === 200 && !!cookie, r.body);

  r = await call('POST', '/workshops', {});
  check('USER on admin route -> 403', r.status === 403, r.body);

  r = await call('POST', '/auth/register', { name: 'x', email: 'nope', password: '123' });
  check('invalid body -> 400 with details', r.status === 400 && r.body.error?.details?.length > 0, r.body);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error('Smoke test crashed - is the server running (npm run dev)?\n', err.message);
  process.exit(1);
});
