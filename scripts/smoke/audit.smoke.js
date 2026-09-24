// Smoke test for component 5 (audit logs). Needs: npm run dev running + MONGO_URI in .env.
// Run: npm run smoke:audit
const { reporter, ensureUser, loginAs, sessionFor, client, connectDB } = require('./helpers');
const { Workshop, Registration } = require('../../src/models');

const TAG = `[smoke ${Date.now()}]`;
const inHours = (h) => new Date(Date.now() + h * 3600e3).toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await connectDB();
  const { check, done } = reporter();

  const admin = await ensureUser('smoke-admin@test.dev', 'ADMIN', 'Smoke Admin');
  const [u1, u2] = await Promise.all([1, 2].map((i) => ensureUser(`smoke-u${i}@test.dev`, 'USER', `Smoke User ${i}`)));
  const asAdmin = await loginAs(admin.email);
  const asU1 = sessionFor(u1);
  const asU2 = sessionFor(u2);
  let r;

  // Generate some activity
  r = await asAdmin('POST', '/workshops', { title: `${TAG} Audit`, description: 'Audit trail smoke test', trainer: 'Ravi', venue: 'Lab 2', startAt: inHours(48), endAt: inHours(50), capacity: 1 });
  const wsId = r.body.data?.workshop?.id;
  await asAdmin('PATCH', `/workshops/${wsId}/status`, { status: 'PUBLISHED' });
  r = await asU1('POST', `/workshops/${wsId}/register`);
  const u1Reg = r.body.data?.registration?.id;
  r = await asU2('POST', `/workshops/${wsId}/register`); // waitlisted
  const u2Reg = r.body.data?.registration?.id;
  await asU1('PATCH', `/registrations/${u1Reg}/cancel`, { reason: 'Clash' }); // promotes u2 (SYSTEM)
  await client()('POST', '/auth/login', { email: admin.email, password: 'definitely-wrong-1' });
  await sleep(800); // audit writes are async (after the response)

  // ---- queries ----
  r = await asAdmin('GET', `/audit-logs?resourceId=${wsId}&limit=50`);
  const wsActions = (r.body.data?.logs || []).map((l) => l.action);
  check('workshop trail: CREATED + PUBLISHED', r.status === 200 && wsActions.includes('WORKSHOP_CREATED') && wsActions.includes('WORKSHOP_PUBLISHED'), wsActions);
  const created = r.body.data?.logs?.find((l) => l.action === 'WORKSHOP_CREATED');
  check('entry has actor name/role, ip, timestamp', created?.actor?.name === 'Smoke Admin' && created.actor.role === 'ADMIN' && created.ip && created.at, created);

  r = await asAdmin('GET', `/audit-logs?resourceId=${u1Reg}`);
  const regActions = (r.body.data?.logs || []).map((l) => l.action);
  check('registration trail: CONFIRMED then CANCELLED', regActions.includes('REGISTRATION_CONFIRMED') && regActions.includes('REGISTRATION_CANCELLED'), regActions);
  check('newest first', regActions[0] === 'REGISTRATION_CANCELLED', regActions);
  const cancelLog = r.body.data?.logs?.find((l) => l.action === 'REGISTRATION_CANCELLED');
  check('cancel metadata keeps reason + promoted ids', cancelLog?.metadata?.reason === 'Clash' && cancelLog.metadata.promoted?.[0] === u2Reg, cancelLog?.metadata);

  r = await asAdmin('GET', `/audit-logs?actor=SYSTEM&action=WAITLIST_PROMOTED&resourceId=${u2Reg}`);
  check('promotion logged as SYSTEM', r.body.data?.logs?.[0]?.actor?.role === 'SYSTEM' && r.body.data.logs[0].actor.name === 'System', r.body);

  r = await asAdmin('GET', '/audit-logs?action=USER_LOGIN_FAILED&limit=5');
  const failed = r.body.data?.logs?.find((l) => l.metadata?.email === admin.email);
  check('failed login recorded with email + reason', failed?.metadata?.reason === 'WRONG_PASSWORD', r.body.data?.logs?.[0]);

  r = await asAdmin('GET', '/audit-logs?limit=2&page=1');
  check('pagination meta', r.status === 200 && r.body.data?.logs?.length === 2 && r.body.meta?.totalPages >= 1, r.body.meta);
  r = await asAdmin('GET', '/audit-logs?action=NOT_AN_EVENT');
  check('unknown action filter -> 400', r.status === 400, r.body);
  r = await asU1('GET', '/audit-logs');
  check('USER cannot read audit logs -> 403', r.status === 403, r.body);

  // ---- cleanup (audit entries are kept on purpose: the log is append-only) ----
  const ids = (await Workshop.find({ title: { $regex: '^\\[smoke' } }).select('_id').lean()).map((w) => w._id);
  await Registration.deleteMany({ workshop: { $in: ids } });
  await Workshop.deleteMany({ _id: { $in: ids } });
  await done();
})().catch((err) => {
  console.error('Smoke test crashed - is the server running (npm run dev)?\n', err);
  process.exit(1);
});
