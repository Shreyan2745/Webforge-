// Time-window helpers for business rules (cancellation cutoff, check-in window, no-show grace).
// TODO(build: registrations/spot): implement.

function isBeforeCancellationCutoff(workshop, now = new Date()) {}
function isCheckinWindowOpen(workshop, now = new Date()) {}
function canMarkNoShow(workshop, now = new Date()) {}

module.exports = { isBeforeCancellationCutoff, isCheckinWindowOpen, canMarkNoShow };
