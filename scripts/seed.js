// npm run seed  -> wipes the database and inserts demo data.
// TODO(build: seed):
//   Accounts: 1 ADMIN, 2 SPOT_REGISTRAR, 8 USER (credentials listed in README)
//   Workshops (one per demo state):
//     DRAFT · PUBLISHED with free seats · PUBLISHED full with waitlist ·
//     PUBLISHED starting in ~30 min (check-in window open, spot registrar assigned) ·
//     CANCELLED · COMPLETED with attendance + certificates

const { connectDB, disconnectDB } = require('../src/config/db');

async function seed() {
  await connectDB();
  console.log('Seed script not built yet');
  await disconnectDB();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
