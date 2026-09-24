// npm run seed  -> WIPES the database and inserts a complete demo dataset.
// Times are relative to "now", so re-run the seed right before a demo.
const mongoose = require('mongoose');
const config = require('../src/config/env');
const { connectDB } = require('../src/config/db');
const { User, Workshop, Registration, AuditLog, Notification, Certificate } = require('../src/models');

if (config.isProd && !process.argv.includes('--force')) {
  console.error('Refusing to wipe a production database. Pass --force if you really mean it.');
  process.exit(1);
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const at = (ms) => new Date(Date.now() + ms);
// Round to the hour so demo times look tidy (e.g. 10:00, not 10:37)
const atHour = (days, hour) => {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const PASSWORDS = { ADMIN: 'Admin@123', SPOT_REGISTRAR: 'Spot@1234', USER: 'User@1234' };

const ACCOUNTS = [
  { name: 'Priya Admin', email: 'admin@webforge.dev', role: 'ADMIN' },
  { name: 'Rahul Desk', email: 'spot1@webforge.dev', role: 'SPOT_REGISTRAR' },
  { name: 'Sneha Desk', email: 'spot2@webforge.dev', role: 'SPOT_REGISTRAR' },
  { name: 'Aarav Sharma', email: 'aarav@student.dev', role: 'USER' },
  { name: 'Diya Patel', email: 'diya@student.dev', role: 'USER' },
  { name: 'Kabir Singh', email: 'kabir@student.dev', role: 'USER' },
  { name: 'Ananya Reddy', email: 'ananya@student.dev', role: 'USER' },
  { name: 'Vihaan Gupta', email: 'vihaan@student.dev', role: 'USER' },
  { name: 'Isha Nair', email: 'isha@student.dev', role: 'USER' },
  { name: 'Arjun Mehta', email: 'arjun@student.dev', role: 'USER' },
  { name: 'Meera Iyer', email: 'meera@student.dev', role: 'USER' },
];

async function seed() {
  await connectDB();
  console.log('Wiping collections...');
  await Promise.all([User, Workshop, Registration, AuditLog, Notification, Certificate].map((M) => M.deleteMany({})));
  await Promise.all([User, Workshop, Registration, AuditLog].map((M) => M.syncIndexes()));

  // User.create (not insertMany) so the bcrypt pre-save hook runs
  const users = {};
  for (const a of ACCOUNTS) {
    users[a.email.split('@')[0]] = await User.create({ ...a, password: PASSWORDS[a.role] });
  }
  const { admin, spot1, spot2, aarav, diya, kabir, ananya, vihaan, isha, arjun, meera } = users;

  const base = { createdBy: admin._id };
  const W = async (data) => Workshop.create({ ...base, publishedAt: data.status === 'DRAFT' ? undefined : at(-3 * DAY), ...data });

  // Registrations in queue order; keeps seatsTaken + queueSeq consistent with the rows
  async function book(ws, rows) {
    let seq = 0;
    let taken = 0;
    for (const [user, status, extra = {}] of rows) {
      seq += 1;
      if (['CONFIRMED', 'ATTENDED'].includes(status)) taken += 1;
      const history = [{ status: status === 'NO_SHOW' || status === 'ATTENDED' ? 'CONFIRMED' : status === 'CANCELLED' ? 'CONFIRMED' : status, at: at(-2 * DAY), byRole: 'USER', by: user._id }];
      if (status === 'ATTENDED') history.push({ status, at: extra.checkedInAt || at(-DAY), byRole: 'SPOT_REGISTRAR', by: spot1._id, reason: 'CHECKED_IN' });
      if (status === 'NO_SHOW') history.push({ status, at: at(-DAY), byRole: 'SYSTEM', by: null, reason: 'WORKSHOP_ENDED' });
      if (status === 'CANCELLED') history.push({ status, at: at(-DAY), byRole: 'ADMIN', by: admin._id, reason: extra.cancelReason || 'USER_CANCELLED' });
      await Registration.create({ user: user._id, workshop: ws._id, status, queueSeq: seq, statusHistory: history, ...extra });
      await new Promise((r) => setTimeout(r, 2)); // distinct createdAt values
    }
    await Workshop.updateOne({ _id: ws._id }, { $set: { seatsTaken: taken, queueSeq: seq } });
  }

  // 1. DRAFT - only admins can see it
  await W({ title: 'Docker for Beginners', description: 'Containers, images, volumes and docker-compose from scratch.', trainer: 'Neha Kapoor', venue: 'Lab 4', startAt: atHour(12, 10), endAt: atHour(12, 13), capacity: 25, status: 'DRAFT' });

  // 2. PUBLISHED with free seats
  const node = await W({ title: 'Node.js & Express REST APIs', description: 'Build a production-style REST API with Express, validation and JWT auth.', trainer: 'Ravi Kumar', venue: 'Auditorium', startAt: atHour(3, 10), endAt: atHour(3, 13), capacity: 30, status: 'PUBLISHED', spotRegistrars: [spot2._id] });
  await book(node, [[aarav, 'CONFIRMED'], [kabir, 'CONFIRMED'], [isha, 'CONFIRMED']]);

  // 3. PUBLISHED and FULL with a waitlist
  const mongo = await W({ title: 'MongoDB Schema Design', description: 'Embedding vs referencing, indexes, and modelling for real query patterns.', trainer: 'Anjali Rao', venue: 'Lab 2', startAt: atHour(5, 14), endAt: atHour(5, 17), capacity: 3, status: 'PUBLISHED', spotRegistrars: [spot2._id] });
  await book(mongo, [[aarav, 'CONFIRMED'], [diya, 'CONFIRMED'], [kabir, 'CONFIRMED'], [ananya, 'WAITLISTED'], [vihaan, 'WAITLISTED'], [isha, 'WAITLISTED']]);

  // 4. LIVE - started 20 min ago: check-in open and no-shows can be marked (spot registrar demo)
  const live = await W({ title: 'Git & GitHub Workflow (LIVE)', description: 'Branching, pull requests, rebasing and resolving merge conflicts.', trainer: 'Vikram Joshi', venue: 'Seminar Hall', startAt: at(-20 * MIN), endAt: at(100 * MIN), capacity: 4, status: 'PUBLISHED', spotRegistrars: [spot1._id] });
  await book(live, [
    [aarav, 'CONFIRMED'],
    [diya, 'CONFIRMED'],
    [kabir, 'ATTENDED', { checkedInAt: at(-25 * MIN) }],
    [ananya, 'CONFIRMED'],
    [vihaan, 'WAITLISTED'], // #1, not at the venue
    [meera, 'WAITLISTED', { presentAt: at(-10 * MIN) }], // #2, at the venue -> gets the next freed seat
    [arjun, 'WAITLISTED'],
  ]);

  // 5. Starting in 90 minutes - inside the 2h cancellation cutoff
  const soon = await W({ title: 'AI Prompt Engineering', description: 'Designing reliable prompts, evaluation and tool use with LLMs.', trainer: 'Sara Khan', venue: 'Lab 1', startAt: at(90 * MIN), endAt: at(210 * MIN), capacity: 20, status: 'PUBLISHED', spotRegistrars: [spot1._id] });
  await book(soon, [[aarav, 'CONFIRMED'], [isha, 'CONFIRMED']]);

  // 6. CANCELLED by admin
  const k8s = await W({ title: 'Kubernetes Deep Dive', description: 'Pods, deployments, services and autoscaling on a real cluster.', trainer: 'Manoj Pillai', venue: 'Lab 3', startAt: atHour(7, 10), endAt: atHour(7, 16), capacity: 15, status: 'CANCELLED', cancelledAt: at(-DAY), cancelReason: 'Trainer unavailable' });
  await book(k8s, [[diya, 'CANCELLED', { isActive: false, cancelledAt: at(-DAY), cancelReason: 'WORKSHOP_CANCELLED' }], [arjun, 'CANCELLED', { isActive: false, cancelledAt: at(-DAY), cancelReason: 'WORKSHOP_CANCELLED' }]]);
  await Workshop.updateOne({ _id: k8s._id }, { $set: { seatsTaken: 0 } });

  // 7. COMPLETED last week (attendance recorded)
  const react = await W({ title: 'React Hooks Masterclass', description: 'useState, useEffect, custom hooks and performance patterns.', trainer: 'Pooja Menon', venue: 'Auditorium', startAt: atHour(-7, 10), endAt: atHour(-7, 13), capacity: 10, status: 'COMPLETED', completedAt: atHour(-7, 14), spotRegistrars: [spot1._id] });
  await book(react, [[aarav, 'ATTENDED', { checkedInAt: atHour(-7, 10) }], [diya, 'ATTENDED', { checkedInAt: atHour(-7, 10) }], [vihaan, 'ATTENDED', { checkedInAt: atHour(-7, 10) }], [meera, 'NO_SHOW']]);

  // 8-10. More published workshops for search / filter / pagination
  await W({ title: 'System Design Fundamentals', description: 'Load balancers, caching, queues and designing for scale.', trainer: 'Ravi Kumar', venue: 'Seminar Hall', startAt: atHour(9, 10), endAt: atHour(9, 13), capacity: 40, status: 'PUBLISHED' });
  await W({ title: 'Python for Data Analysis', description: 'pandas, NumPy and visualisation with real datasets.', trainer: 'Anjali Rao', venue: 'Lab 2', startAt: atHour(14, 14), endAt: atHour(14, 17), capacity: 35, status: 'PUBLISHED' });
  await W({ title: 'Secure Node.js APIs', description: 'OWASP top 10 for APIs, rate limiting, JWT pitfalls and input validation.', trainer: 'Neha Kapoor', venue: 'Auditorium', startAt: atHour(20, 10), endAt: atHour(20, 13), capacity: 50, status: 'PUBLISHED' });

  const counts = await Promise.all([User.countDocuments(), Workshop.countDocuments(), Registration.countDocuments()]);
  console.log(`\nSeeded ${counts[0]} users, ${counts[1]} workshops, ${counts[2]} registrations.\n`);
  console.log('Test credentials');
  console.table(ACCOUNTS.map((a) => ({ role: a.role, email: a.email, password: PASSWORDS[a.role] })));
  console.log('Demo notes:');
  console.log('  - "Git & GitHub Workflow (LIVE)" started 20 min ago -> log in as spot1 for the no-show swap demo');
  console.log('    (Vihaan is waitlist #1 but absent; Meera is #2 and present -> she gets the seat)');
  console.log('  - "AI Prompt Engineering" starts in 90 min -> Aarav cannot cancel (2h cutoff)');
  console.log('  - "MongoDB Schema Design" is full with 3 on the waitlist');
  console.log('  - Re-run `npm run seed` before a demo: times are relative to now.\n');

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('Seed failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
