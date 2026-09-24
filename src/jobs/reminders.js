// node-cron job: every 5 minutes, send 24h and 1h reminders for PUBLISHED workshops.
// Uses reminder24hSentAt / reminder1hSentAt flags so reminders are never sent twice.
// TODO(build: reminders): cron.schedule('*/5 * * * *', runReminders)

function startReminderJob() {
  console.log('Reminder job: not built yet (skipped)');
}

module.exports = { startReminderJob };
