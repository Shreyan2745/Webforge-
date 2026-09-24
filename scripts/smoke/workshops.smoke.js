// Smoke test for component 2 (workshops). Needs: npm run dev running + MONGO_URI in .env
// Run: npm run smoke:workshops
const { reporter, ensureUser, loginAs, client, connectDB } = require('./helpers');
const { Workshop, Registration } = require('../../src/models');

const TAG = `[smoke ${Date.now()}]`;
const inHours = (h) => new Date(Date.now() + h * 3600e3).toISOString();

(async () => {
  await connectDB();
  await Promise.all([Workshop.init(), Registration.init()]); // make sure indexes exist before testing them
  const { check, done } = reporter();

  const admin = await ensureUser('smoke-admin@test.dev', 'ADMIN', 'Smoke Admin');
  const spot = await ensureUser('smoke-spot@test.dev', 'SPOT_REGISTRAR', 'Smoke Spot');
  const students = await Promise.all([1, 2, 3, 4, 5].map((i) => ensureUser(`smoke-u${i}@test.dev`, 'USER', `Smoke User ${i}`)));

  const asAdmin = await loginAs(admin.email);
  const asUser = await loginAs(students[0].email);
  const anon = client();
  let r;

  // ---- create ----
  const body = { title: `${TAG} Node.js APIs`, description: 'Build REST APIs with Express', trainer: 'Ravi Kumar', venue: 'Lab 3', startAt: inHours(48), endAt: inHours(50), capacity: 3 };
  r = await asAdmin('POST', '/workshops', { ...body, status: 'PUBLISHED', seatsTaken: 99 });
  check('admin creates workshop -> 201 DRAFT (status/seatsTaken ignored)', r.status === 201 && r.body.data?.workshop?.status === 'DRAFT' && r.body.data.workshop.seatsTaken === 0, r.body);
  const id = r.body.data?.workshop?.id;

  r = await asUser('POST', '/workshops', body);
  check('USER creates workshop -> 403', r.status === 403, r.body);
  r = await asAdmin('POST', '/workshops', { ...body, endAt: inHours(47) });
  check('endAt before startAt -> 400', r.status === 400 && r.body.error?.details?.some((d) => d.field === 'endAt'), r.body);
  r = await asAdmin('POST', '/workshops', { ...body, startAt: inHours(-5), endAt: inHours(-3) });
  check('start in the past -> 400', r.status === 400, r.body);

  // ---- visibility ----
  r = await anon('GET', `/workshops/${id}`);
  check('public cannot see DRAFT -> 404', r.status === 404, r.body);
  r = await asAdmin('GET', `/workshops/${id}`);
  check('admin sees DRAFT -> 200', r.status === 200, r.body);
  r = await anon('GET', `/workshops?search=${encodeURIComponent(TAG)}`);
  check('DRAFT not in public catalogue', r.status === 200 && r.body.data.workshops.length === 0, r.body);

  // ---- publish ----
  r = await asAdmin('PATCH', `/workshops/${id}/status`, { status: 'PUBLISHED' });
  check('publish -> 200 PUBLISHED', r.status === 200 && r.body.data?.workshop?.status === 'PUBLISHED', r.body);
  r = await asAdmin('PATCH', `/workshops/${id}/status`, { status: 'PUBLISHED' });
  check('publish again -> 409 INVALID_TRANSITION', r.status === 409 && r.body.error?.code === 'INVALID_TRANSITION', r.body);
  r = await anon('GET', `/workshops?search=${encodeURIComponent(TAG)}&limit=5`);
  const listed = r.body.data?.workshops?.[0];
  check('public catalogue finds it (search) with seatsLeft', r.status === 200 && listed?.id === id && listed.seatsLeft === 3, r.body);
  check('public view hides staff fields', listed && !('spotRegistrars' in listed) && !('createdBy' in listed), listed);
  check('pagination meta present', r.body.meta && r.body.meta.page === 1 && r.body.meta.total >= 1, r.body.meta);
  r = await anon('GET', '/workshops?sort=password');
  check('invalid sort -> 400', r.status === 400, r.body);
  r = await anon('GET', '/workshops/not-an-id');
  check('bad id -> 400 INVALID_ID', r.status === 400 && r.body.error?.code === 'INVALID_ID', r.body);

  // ---- update ----
  r = await asAdmin('PATCH', `/workshops/${id}`, { venue: 'Auditorium', capacity: 3 });
  check('update venue -> 200, reports only real changes', r.status === 200 && Object.keys(r.body.data?.changes || {}).join() === 'venue', r.body);

  // Book seats directly in the DB (registration endpoints come in component 3)
  const regs = await Registration.create([
    { user: students[0]._id, workshop: id, status: 'CONFIRMED', statusHistory: [{ status: 'CONFIRMED' }] },
    { user: students[1]._id, workshop: id, status: 'CONFIRMED', statusHistory: [{ status: 'CONFIRMED' }] },
    { user: students[2]._id, workshop: id, status: 'CONFIRMED', statusHistory: [{ status: 'CONFIRMED' }] },
  ]);
  await new Promise((res) => setTimeout(res, 20));
  const waiting = await Registration.create({ user: students[3]._id, workshop: id, status: 'WAITLISTED', statusHistory: [{ status: 'WAITLISTED' }] });
  await Workshop.updateOne({ _id: id }, { $set: { seatsTaken: 3 } });

  r = await asAdmin('PATCH', `/workshops/${id}`, { capacity: 2 });
  check('capacity below booked -> 409 CAPACITY_BELOW_BOOKED', r.status === 409 && r.body.error?.code === 'CAPACITY_BELOW_BOOKED', r.body);

  let dupErr = null;
  try { await Registration.create({ user: students[0]._id, workshop: id, status: 'CONFIRMED' }); } catch (e) { dupErr = e; }
  check('DB blocks a 2nd active registration (partial unique index)', dupErr && dupErr.code === 11000, dupErr?.message);

  // ---- participants ----
  r = await asAdmin('GET', `/workshops/${id}/participants`);
  const d = r.body.data;
  check('participants -> counts 3 confirmed / 1 waitlisted', r.status === 200 && d?.counts?.CONFIRMED === 3 && d.counts.WAITLISTED === 1, r.body);
  check('waitlist position computed', d?.participants?.find((p) => p.id === String(waiting._id))?.waitlistPosition === 1, d?.participants);
  r = await asAdmin('GET', `/workshops/${id}/participants?status=WAITLISTED&search=user%204`);
  check('participants filter + search', r.status === 200 && r.body.data?.participants?.length === 1, r.body);
  r = await asUser('GET', `/workshops/${id}/participants`);
  check('USER cannot view participants -> 403', r.status === 403, r.body);

  // ---- spot registrars ----
  r = await asAdmin('PUT', `/workshops/${id}/spot-registrars`, { userIds: [String(spot._id)] });
  check('assign spot registrar -> 200', r.status === 200 && r.body.data?.workshop?.spotRegistrars?.length === 1, r.body);
  r = await asAdmin('PUT', `/workshops/${id}/spot-registrars`, { userIds: [String(students[0]._id)] });
  check('assign a normal USER -> 422 INVALID_ASSIGNEE', r.status === 422 && r.body.error?.code === 'INVALID_ASSIGNEE', r.body);

  // ---- complete too early ----
  r = await asAdmin('PATCH', `/workshops/${id}/status`, { status: 'COMPLETED' });
  check('complete before end -> 422 WORKSHOP_NOT_ENDED', r.status === 422 && r.body.error?.code === 'WORKSHOP_NOT_ENDED', r.body);

  // ---- cancel cascade ----
  r = await asAdmin('PATCH', `/workshops/${id}/status`, { status: 'CANCELLED', reason: 'Trainer unavailable' });
  check('cancel -> 200, 4 registrations cancelled', r.status === 200 && r.body.data?.affected?.cancelled === 4, r.body);
  const after = await Registration.find({ workshop: id }).lean();
  check('all registrations CANCELLED + inactive + history entry', after.every((x) => x.status === 'CANCELLED' && !x.isActive && x.cancelReason === 'WORKSHOP_CANCELLED' && x.statusHistory.at(-1).status === 'CANCELLED'), after.map((x) => x.status));
  const wsAfter = await Workshop.findById(id).lean();
  check('seatsTaken reset to 0', wsAfter.seatsTaken === 0, wsAfter.seatsTaken);
  r = await asAdmin('PATCH', `/workshops/${id}/status`, { status: 'PUBLISHED' });
  check('CANCELLED -> PUBLISHED -> 409', r.status === 409, r.body);
  r = await asAdmin('PATCH', `/workshops/${id}`, { venue: 'Somewhere' });
  check('edit a CANCELLED workshop -> 409 WORKSHOP_NOT_EDITABLE', r.status === 409 && r.body.error?.code === 'WORKSHOP_NOT_EDITABLE', r.body);
  r = await anon('GET', `/workshops/${id}`);
  check('public can still view a CANCELLED workshop', r.status === 200 && r.body.data?.workshop?.status === 'CANCELLED', r.body);

  // ---- completion (workshop that already ended; inserted directly) ----
  const past = await Workshop.create({ ...body, title: `${TAG} Past Workshop`, startAt: inHours(-4), endAt: inHours(-2), status: 'PUBLISHED', seatsTaken: 2, createdBy: admin._id });
  await Registration.create([
    { user: students[0]._id, workshop: past._id, status: 'ATTENDED' },
    { user: students[1]._id, workshop: past._id, status: 'CONFIRMED' },
    { user: students[4]._id, workshop: past._id, status: 'WAITLISTED' },
  ]);
  r = await asAdmin('PATCH', `/workshops/${past._id}/status`, { status: 'COMPLETED' });
  check('complete ended workshop -> 200 (1 no-show, 1 waitlist closed)', r.status === 200 && r.body.data?.affected?.markedNoShow === 1 && r.body.data.affected.cancelled === 1, r.body);
  const pastRegs = await Registration.find({ workshop: past._id }).lean();
  const byUser = Object.fromEntries(pastRegs.map((x) => [String(x.user), x.status]));
  check('ATTENDED kept, CONFIRMED -> NO_SHOW, WAITLISTED -> CANCELLED', byUser[students[0]._id] === 'ATTENDED' && byUser[students[1]._id] === 'NO_SHOW' && byUser[students[4]._id] === 'CANCELLED', byUser);
  check('seatsTaken = attended count', (await Workshop.findById(past._id).lean()).seatsTaken === 1);

  // ---- cleanup ----
  const smokeIds = (await Workshop.find({ title: { $regex: '^\\[smoke' } }).select('_id').lean()).map((w) => w._id);
  await Registration.deleteMany({ workshop: { $in: smokeIds } });
  await Workshop.deleteMany({ _id: { $in: smokeIds } });

  await done();
})().catch(async (err) => {
  console.error('Smoke test crashed - is the server running (npm run dev)?\n', err);
  process.exit(1);
});
