const config = require('./config/env');
const { connectDB } = require('./config/db');
const app = require('./app');
const { registerListeners } = require('./events');
const { startReminderJob } = require('./jobs/reminders');

async function start() {
  await connectDB();
  registerListeners();
  if (config.enableCron) startReminderJob();

  app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port} (${config.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
