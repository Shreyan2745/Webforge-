// Builds the actor/request info that every event (and so every audit log) carries.
function actorFrom(req) {
  return req.user ? { id: req.user.id, role: req.user.role } : null;
}

function requestInfo(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') || null };
}

module.exports = { actorFrom, requestInfo };
