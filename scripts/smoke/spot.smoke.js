// Smoke test for component 4 (spot registrar event-day dashboard).
// Needs: npm run dev running + MONGO_URI in .env.   Run: npm run smoke:spot
const { reporter, ensureUser, loginAs, sessionFor, connectDB } = require('./helpers');
const { Workshop, Registration } = require('../../src/models');

const TAG = `[smoke ${Date.now()}]`;
const inMin = (m) => new Date(Date.now() + m * 60000);

(async () => {
  await connectDB();
  await Promise.all([Workshop.init(), Registration.init()]);
  const { check, done } = reporter();

  const admin = await ensureUser('smoke-admin@test.dev', 'ADMIN', 'Smoke Admin');
  const spot1 = await ensureUser('smoke-spot@test.dev', 'SPOT_REGISTRAR', 'Smoke Spot');
  const spot2 = await ensureUser('smoke-spot2@test.dev', 'SPOT_REGISTRAR', 'Other Spot');
  const u = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => ensureUser(`smoke-u${i}@test.dev`, 'USER', `Smoke User ${i}`)));
  const asAdmin = await loginAs(admin.email);
  const asSpot = sessionFor(spot1);
  const asSpot2 = sessionFor(spot2);
  const asUser = sessionFor(u[0]);

  const base = { description: 'Spot smoke workshop', trainer: 'Ravi', venue: 'Hall A', createdBy: admin._id, status: 'PUBLISHED' };
  const mkRegs = (ws, list) =>
    Registration.create(list.map(([user, status], i) => ({ user: user._id, workshop: ws._id, status, queueSeq: i + 1, statusHistory: [{ status }] })));

  // LIVE: started 20 min ago, 3 seats full, 3 waitlisted
  const LIVE = await Workshop.create({ ...base, title: `${TAG} Live`, startAt: inMin(-20), endAt: inMin(100), capacity: 3, seatsTaken: 3, queueSeq: 6, spotRegistrars: [spot1._id] });
  const [r1, r2, r3, r4, r5, r6] = await mkRegs(LIVE, [[u[0], 'CONFIRMED'], [u[1], 'CONFIRMED'], [u[2], 'CONFIRMED'], [u[3], 'WAITLISTED'], [u[4], 'WAITLISTED'], [u[5], 'WAITLISTED']]);
  const FUTURE = await Workshop.create({ ...base, title: `${TAG} Future`, startAt: inMin(2880), endAt: inMin(3000), capacity: 5, seatsTaken: 1, spotRegistrars: [spot1._id] });
  const [f1] = await mkRegs(FUTURE, [[u[0], 'CONFIRMED']]);
  const OTHER = await Workshop.create({ ...base, title: `${TAG} Other`, startAt: inMin(-20), endAt: inMin(100), capacity: 5, seatsTaken: 1, spotRegistrars: [spot2._id] });
  const [o1] = await mkRegs(OTHER, [[u[0], 'CONFIRMED']]);
  const EARLY = await Workshop.create({ ...base, title: `${TAG} Early`, startAt: inMin(-5), endAt: inMin(100), capacity: 5, seatsTaken: 1, spotRegistrars: [spot1._id] });
  const [e1] = await mkRegs(EARLY, [[u[0], 'CONFIRMED']]);
  let r;

  // ---- my workshops ----
  r = await asSpot('GET', '/spot/workshops');
  const mine = (r.body.data?.workshops || []).map((w) => w.id);
  check('spot sees assigned workshops only', r.status === 200 && mine.includes(String(LIVE._id)) && mine.includes(String(FUTURE._id)) && !mine.includes(String(OTHER._id)), mine);
  check('live workshop shows windowOpen=true', r.body.data?.workshops?.find((w) => w.id === String(LIVE._id))?.windowOpen === true, r.body);
  r = await asUser('GET', '/spot/workshops');
  check('USER on spot routes -> 403', r.status === 403, r.body);

  // ---- roster ----
  r = await asSpot('GET', `/spot/workshops/${LIVE._id}/roster`);
  check('roster -> 3 confirmed, 3 waitlisted, 0 present', r.status === 200 && r.body.data?.counts?.confirmed === 3 && r.body.data.counts.waitlisted === 3 && r.body.data.counts.present === 0, r.body);
  check('nextInLine = null (window open, nobody present)', r.body.data?.nextInLine === null, r.body.data?.nextInLine);
  r = await asSpot2('GET', `/spot/workshops/${LIVE._id}/roster`);
  check('unassigned spot registrar -> 404', r.status === 404, r.body);
  r = await asAdmin('GET', `/spot/workshops/${OTHER._id}/roster`);
  check('admin can open any roster', r.status === 200, r.body);

  // ---- check-in ----
  r = await asSpot('PATCH', `/spot/registrations/${r1._id}/check-in`);
  check('check-in -> ATTENDED', r.status === 200 && r.body.data?.status === 'ATTENDED' && r.body.data.checkedInAt, r.body);
  r = await asSpot('PATCH', `/spot/registrations/${r1._id}/check-in`);
  check('check-in twice -> 409 INVALID_TRANSITION', r.status === 409 && r.body.error?.code === 'INVALID_TRANSITION', r.body);
  r = await asSpot('PATCH', `/spot/registrations/${f1._id}/check-in`);
  check('check-in 2 days early -> 422 CHECKIN_WINDOW_CLOSED', r.status === 422 && r.body.error?.code === 'CHECKIN_WINDOW_CLOSED', r.body);
  r = await asSpot('PATCH', `/spot/registrations/${o1._id}/check-in`);
  check('check-in on unassigned workshop -> 404', r.status === 404, r.body);

  // ---- present ----
  r = await asSpot('PATCH', `/spot/registrations/${r5._id}/present`);
  check('mark waitlist #2 present -> 200, no seat yet', r.status === 200 && r.body.data?.presentAt && r.body.data.promoted.length === 0 && r.body.data.position === 2, r.body);
  r = await asSpot('PATCH', `/spot/registrations/${r5._id}/present`);
  check('mark present twice -> alreadyPresent', r.status === 200 && r.body.data?.alreadyPresent === true, r.body);
  r = await asSpot('PATCH', `/spot/registrations/${r2._id}/present`);
  check('mark a CONFIRMED person present -> 409', r.status === 409, r.body);
  r = await asSpot('GET', `/spot/workshops/${LIVE._id}/roster`);
  check('nextInLine = present #2, not absent #1', r.body.data?.nextInLine?.registrationId === String(r5._id), r.body.data?.nextInLine);

  // ---- the swap ----
  r = await asSpot('PATCH', `/spot/registrations/${r2._id}/no-show`);
  check('no-show -> seat goes to the PRESENT person (#2), not #1', r.status === 200 && r.body.data?.promoted?.[0]?.registrationId === String(r5._id) && r.body.data.promoted[0].name === 'Smoke User 5', r.body);
  r = await asSpot('GET', `/spot/workshops/${LIVE._id}/roster`);
  const c = r.body.data?.counts;
  check('roster after swap: 1 attended, 1 no-show, 2 confirmed, 2 waitlisted', c?.attended === 1 && c.noShow === 1 && c.confirmed === 2 && c.waitlisted === 2, c);
  check('seats still full (3/3)', r.body.data?.workshop?.seatsTaken === 3, r.body.data?.workshop);
  const promotedReg = await Registration.findById(r5._id).lean();
  check('promoted registration has PROMOTED_FROM_WAITLIST in history', promotedReg.statusHistory.at(-1).reason === 'PROMOTED_FROM_WAITLIST', promotedReg.statusHistory);
  r = await asSpot('PATCH', `/spot/registrations/${r2._id}/no-show`);
  check('no-show twice -> 409', r.status === 409, r.body);
  r = await asSpot2('PATCH', `/spot/registrations/${r3._id}/no-show`);
  check('unassigned spot registrar no-show -> 404', r.status === 404, r.body);

  // ---- no one present -> seat stays open; someone arrives -> gets it immediately ----
  r = await asSpot('PATCH', `/spot/registrations/${r3._id}/no-show`);
  check('no-show with nobody present -> seat stays open', r.status === 200 && r.body.data?.promoted?.length === 0, r.body);
  check('seatsTaken dropped to 2', (await Workshop.findById(LIVE._id).lean()).seatsTaken === 2);
  r = await asSpot('PATCH', `/spot/registrations/${r6._id}/present`);
  check('late arrival marked present -> takes the open seat instantly', r.status === 200 && r.body.data?.promoted?.[0]?.registrationId === String(r6._id) && r.body.data.status === 'CONFIRMED', r.body);
  check('seats full again (3/3), waitlist #1 (absent) untouched', (await Workshop.findById(LIVE._id).lean()).seatsTaken === 3 && (await Registration.findById(r4._id).lean()).status === 'WAITLISTED');

  // ---- grace period ----
  r = await asSpot('PATCH', `/spot/registrations/${e1._id}/no-show`);
  check('no-show 5 min after start (grace 15) -> 422 NO_SHOW_TOO_EARLY', r.status === 422 && r.body.error?.code === 'NO_SHOW_TOO_EARLY', r.body);

  // ---- cleanup ----
  const ids = (await Workshop.find({ title: { $regex: '^\\[smoke' } }).select('_id').lean()).map((w) => w._id);
  await Registration.deleteMany({ workshop: { $in: ids } });
  await Workshop.deleteMany({ _id: { $in: ids } });
  await done();
})().catch((err) => {
  console.error('Smoke test crashed - is the server running (npm run dev)?\n', err);
  process.exit(1);
});
