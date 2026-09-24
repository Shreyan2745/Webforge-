const registerAuditListener = require('./listeners/audit.listener');
const registerNotificationListener = require('./listeners/notification.listener');

function registerListeners() {
  registerAuditListener();
  registerNotificationListener();
}

module.exports = { registerListeners };
