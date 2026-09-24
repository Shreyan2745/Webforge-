// Smoke test for component 3 (registration, waitlist, cancellation, promotion, concurrency).
// Needs: npm run dev running + MONGO_URI in .env.   Run: npm run smoke:registrations
const { reporter, ensureUser, loginAs, sessionFor, connectDB } = require('./helpers');
const { Workshop, Registration } = require('../../src/models');

const TAG = `[smoke ${Date.now()}]`;
const inMin = (m) => new Date(Date.now() + m * 60000);
const reg = (user, workshop, status, extra = {}) => ({ user: user._id, workshop, status, statusHistory: [{ status }], ...extra });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await connectDB();
  await Promise.all([Workshop.init(), Registration.init()]);
  const { check, done } = reporter();

  const admin = await ensureUser('smoke-admin@test.dev', 'ADMIN', 'Smoke Admin');
  const u = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => ensureUser(`smoke-u${i}@test.dev`, 'USER', `Smoke User ${i}`)));
  const asAdmin = await loginAs(admin.email);
  const as = u.map((x) => sessionFor(x));
  const base = { description: 'Smoke test workshop', trainer: 'Ravi', venue: 'Lab 1', createdBy: admin._id };
  let r;

  // Workshop A: capacity 2, starts in 2 days
  const A = await Workshop.create({ ...base, title: `${TAG} A`, startAt: inMin(2880), endAt: inMin(3000), capacity: 2, status: 'PUBLISHED' });
  const a = String(A._id);

  // ---- register ----
  r = await as[0]('POST', `/workshops/${a}/register`);
  check('u1 registers -> 201 CONFIRMED', r.status === 201 && r.body.data?.registration?.status === 'CONFIRMED', r.body);
  const u1Reg = r.body.data?.registration?.id;
  r = await as[0]('POST', `/workshops/${a}/register`);
  check('u1 registers again -> 409 ALREADY_REGISTERED', r.status === 409 && r.body.error?.code === 'ALREADY_REGISTERED', r.body);
  r = await as[1]('POST', `/workshops/${a}/register`);
  check('u2 -> CONFIRMED (last seat)', r.body.data?.registration?.status === 'CONFIRMED', r.body);
  r = await as[2]('POST', `/workshops/${a}/register`);
  check('u3 -> WAITLISTED #1', r.status === 201 && r.body.data?.registration?.status === 'WAITLISTED' && r.body.data.registration.waitlistPosition === 1, r.body);
  const u3Reg = r.body.data?.registration?.id;
  r = await as[3]('POST', `/workshops/${a}/register`);
  check('u4 -> WAITLISTED #2', r.body.data?.registration?.waitlistPosition === 2, r.body);
  const u4Reg = r.body.data?.registration?.id;
  check('seatsTaken never exceeds capacity', (await Workshop.findById(a).lean()).seatsTaken === 2);

  r = await asAdmin('POST', `/workshops/${a}/register`);
  check('ADMIN cannot register -> 403', r.status === 403, r.body);

  const draft = await Workshop.create({ ...base, title: `${TAG} draft`, startAt: inMin(3000), endAt: inMin(3100), capacity: 5, status: 'DRAFT' });
  r = await as[0]('POST', `/workshops/${draft._id}/register`);
  check('register for DRAFT -> 404', r.status === 404, r.body);
  const cancelledWs = await Workshop.create({ ...base, title: `${TAG} cancelled`, startAt: inMin(3000), endAt: inMin(3100), capacity: 5, status: 'CANCELLED' });
  r = await as[0]('POST', `/workshops/${cancelledWs._id}/register`);
  check('register for CANCELLED workshop -> 409 REGISTRATION_CLOSED', r.status === 409 && r.body.error?.code === 'REGISTRATION_CLOSED', r.body);

  // ---- read ----
  r = await as[2]('GET', '/registrations/me');
  const mine = r.body.data?.groups?.waitlisted?.find((x) => x.workshop?.id === a);
  check('my registrations -> grouped, waitlist position shown', r.status === 200 && mine?.waitlistPosition === 1 && mine.canCancel === true, r.body);
  r = await as[2]('GET', `/registrations/${u1Reg}`);
  check("someone else's registration -> 404", r.status === 404, r.body);
  r = await asAdmin('GET', `/registrations/${u1Reg}`);
  check('admin reads any registration with history', r.status === 200 && r.body.data?.registration?.statusHistory?.length === 1, r.body);

  // ---- cancel + promotion ----
  r = await as[0]('PATCH', `/registrations/${u1Reg}/cancel`, { reason: 'Exam clash' });
  check('u1 cancels -> 200, waitlist #1 promoted', r.status === 200 && r.body.data?.promoted?.[0]?.registrationId === u3Reg, r.body);
  const u3Now = await Registration.findById(u3Reg).lean();
  check('u3 is now CONFIRMED with PROMOTED history', u3Now.status === 'CONFIRMED' && u3Now.statusHistory.at(-1).reason === 'PROMOTED_FROM_WAITLIST', u3Now);
  r = await as[3]('GET', `/registrations/${u4Reg}`);
  check('u4 moved up to waitlist #1', r.body.data?.registration?.waitlistPosition === 1, r.body);
  check('seatsTaken still 2', (await Workshop.findById(a).lean()).seatsTaken === 2);
  r = await as[0]('PATCH', `/registrations/${u1Reg}/cancel`);
  check('cancel twice -> 409 INVALID_TRANSITION', r.status === 409 && r.body.error?.code === 'INVALID_TRANSITION', r.body);
  r = await as[0]('POST', `/workshops/${a}/register`);
  check('u1 re-registers after cancelling -> WAITLISTED #2', r.status === 201 && r.body.data?.registration?.waitlistPosition === 2, r.body);
  const u1Reg2 = r.body.data?.registration?.id;
  r = await as[3]('PATCH', `/registrations/${u4Reg}/cancel`);
  check('u4 leaves waitlist -> 200, nobody promoted', r.status === 200 && r.body.data?.promoted?.length === 0, r.body);

  // ---- capacity increase promotes ----
  r = await asAdmin('PATCH', `/workshops/${a}`, { capacity: 3 });
  check('capacity 2 -> 3 promotes waitlist', r.status === 200 && r.body.data?.promotedCount === 1, r.body);
  check('u1 (re-registered) now CONFIRMED', (await Registration.findById(u1Reg2).lean()).status === 'CONFIRMED');

  // ---- cutoff ----
  const B = await Workshop.create({ ...base, title: `${TAG} B`, startAt: inMin(60), endAt: inMin(180), capacity: 5, status: 'PUBLISHED' });
  r = await as[4]('POST', `/workshops/${B._id}/register`);
  const u5Reg = r.body.data?.registration?.id;
  check('register 1h before start -> CONFIRMED, canCancel=false', r.body.data?.registration?.status === 'CONFIRMED' && r.body.data.registration.canCancel === false, r.body);
  r = await as[4]('PATCH', `/registrations/${u5Reg}/cancel`);
  check('user cancel inside 2h cutoff -> 422 CANCELLATION_CUTOFF_PASSED', r.status === 422 && r.body.error?.code === 'CANCELLATION_CUTOFF_PASSED', r.body);
  r = await asAdmin('PATCH', `/registrations/${u5Reg}/cancel`, { reason: 'Admin override' });
  check('admin can still cancel before start -> 200', r.status === 200 && r.body.data?.registration?.cancelReason === 'ADMIN_CANCELLED', r.body);

  // ---- admin status: attendance rules ----
  r = await asAdmin('PATCH', `/registrations/${u3Reg}/status`, { status: 'ATTENDED' });
  check('check-in 2 days early -> 422 CHECKIN_WINDOW_CLOSED', r.status === 422 && r.body.error?.code === 'CHECKIN_WINDOW_CLOSED', r.body);

  // Workshop C: started 30 min ago, 1 seat. u2 waitlisted (NOT present) first, u3 waitlisted + present later
  const C = await Workshop.create({ ...base, title: `${TAG} C`, startAt: inMin(-30), endAt: inMin(90), capacity: 1, seatsTaken: 1, status: 'PUBLISHED' });
  const [cConfirmed] = await Registration.create([reg(u[5], C._id, 'CONFIRMED')]);
  const [cAbsentWait] = await Registration.create([reg(u[1], C._id, 'WAITLISTED')]);
  await sleep(20);
  const [cPresentWait] = await Registration.create([reg(u[2], C._id, 'WAITLISTED', { presentAt: new Date() })]);
  r = await asAdmin('PATCH', `/registrations/${cConfirmed._id}/status`, { status: 'NO_SHOW' });
  check('no-show frees seat -> promotes the PRESENT waitlisted person (skips absent #1)', r.status === 200 && r.body.data?.promoted?.[0]?.registrationId === String(cPresentWait._id), r.body);
  check('absent waitlisted person still WAITLISTED', (await Registration.findById(cAbsentWait._id).lean()).status === 'WAITLISTED');
  r = await asAdmin('PATCH', `/registrations/${cPresentWait._id}/status`, { status: 'ATTENDED' });
  check('check-in during window -> ATTENDED', r.status === 200 && r.body.data?.registration?.status === 'ATTENDED', r.body);
  check('seatsTaken stays 1 (ATTENDED holds the seat)', (await Workshop.findById(C._id).lean()).seatsTaken === 1);

  const D = await Workshop.create({ ...base, title: `${TAG} D`, startAt: inMin(-5), endAt: inMin(60), capacity: 5, seatsTaken: 1, status: 'PUBLISHED' });
  const [dReg] = await Registration.create([reg(u[0], D._id, 'CONFIRMED')]);
  r = await asAdmin('PATCH', `/registrations/${dReg._id}/status`, { status: 'NO_SHOW' });
  check('no-show inside grace period -> 422 NO_SHOW_TOO_EARLY', r.status === 422 && r.body.error?.code === 'NO_SHOW_TOO_EARLY', r.body);

  // ---- concurrency: 20 students, 1 seat ----
  const E = await Workshop.create({ ...base, title: `${TAG} E race`, startAt: inMin(2880), endAt: inMin(3000), capacity: 1, status: 'PUBLISHED' });
  const racers = await Promise.all(Array.from({ length: 20 }, (_, i) => ensureUser(`smoke-race${i + 1}@test.dev`, 'USER', `Racer ${i + 1}`)));
  const results = await Promise.all(racers.map((x) => sessionFor(x)('POST', `/workshops/${E._id}/register`)));
  const statuses = results.map((x) => x.body.data?.registration?.status);
  check('20 parallel registrations -> all 201', results.every((x) => x.status === 201), results.map((x) => x.status));
  check('exactly 1 CONFIRMED, 19 WAITLISTED', statuses.filter((s) => s === 'CONFIRMED').length === 1 && statuses.filter((s) => s === 'WAITLISTED').length === 19, statuses);
  check('seatsTaken = 1 after the race', (await Workshop.findById(E._id).lean()).seatsTaken === 1);
  const positions = results.map((x) => x.body.data?.registration?.waitlistPosition).filter(Boolean).sort((p, q) => p - q);
  check('waitlist positions are 1..19 with no gaps', positions.join() === Array.from({ length: 19 }, (_, i) => i + 1).join(), positions);

  // ---- double submit: same user fires 5 requests at once ----
  const F = await Workshop.create({ ...base, title: `${TAG} F double`, startAt: inMin(2880), endAt: inMin(3000), capacity: 10, status: 'PUBLISHED' });
  const dbl = await Promise.all(Array.from({ length: 5 }, () => as[5]('POST', `/workshops/${F._id}/register`)));
  check('same user x5 at once -> exactly one 201, rest 409', dbl.filter((x) => x.status === 201).length === 1 && dbl.filter((x) => x.status === 409).length === 4, dbl.map((x) => x.status));
  check('only 1 seat used', (await Workshop.findById(F._id).lean()).seatsTaken === 1);

  // ---- cleanup ----
  const ids = (await Workshop.find({ title: { $regex: '^\\[smoke' } }).select('_id').lean()).map((w) => w._id);
  await Registration.deleteMany({ workshop: { $in: ids } });
  await Workshop.deleteMany({ _id: { $in: ids } });
  await done();
})().catch((err) => {
  console.error('Smoke test crashed - is the server running (npm run dev)?\n', err);
  process.exit(1);
});
