// Builds the actor/request info that every event (and so every audit log) carries.
function actorFrom(req) {
  return req.user ? { id: req.user.id, role: req.user.role } : null;
}

function requestInfo(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') || null };
}

// What services receive: who is acting + request metadata for audit logs
function contextFrom(req) {
  return { actor: actorFrom(req), req: requestInfo(req) };
}

module.exports = { actorFrom, requestInfo, contextFrom };
