const config = require('../config/env');

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

// R7: users may cancel a CONFIRMED seat until N hours before start
function cancellationCutoff(ws) {
  return new Date(new Date(ws.startAt).getTime() - config.rules.cancellationCutoffHours * HOUR);
}
function isBeforeCancellationCutoff(ws, now = new Date()) {
  return now < cancellationCutoff(ws);
}

// Event-day window: from N minutes before start until the workshop ends
function checkinWindow(ws) {
  return {
    opensAt: new Date(new Date(ws.startAt).getTime() - config.rules.checkinWindowMinutes * MIN),
    closesAt: new Date(ws.endAt),
  };
}
function isCheckinWindowOpen(ws, now = new Date()) {
  const { opensAt, closesAt } = checkinWindow(ws);
  return now >= opensAt && now < closesAt;
}

// No-show can be marked once the grace period after start has passed (until the workshop ends)
function noShowAllowedFrom(ws) {
  const grace = ws.noShowGraceMinutes ?? config.rules.defaultNoShowGraceMinutes;
  return new Date(new Date(ws.startAt).getTime() + grace * MIN);
}
function canMarkNoShow(ws, now = new Date()) {
  return now >= noShowAllowedFrom(ws) && now < new Date(ws.endAt);
}

module.exports = {
  cancellationCutoff,
  isBeforeCancellationCutoff,
  checkinWindow,
  isCheckinWindowOpen,
  noShowAllowedFrom,
  canMarkNoShow,
};
