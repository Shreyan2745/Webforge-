const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog.model');
const User = require('../models/User.model');
const { parsePagination, buildMeta } = require('../utils/paginate');

const toObjectId = (v) => (v && mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(String(v)) : null);

// Keep metadata JSON-safe and bounded (ObjectIds -> strings, long arrays trimmed)
function sanitize(value, depth = 0) {
  if (value == null || depth > 5) return value ?? null;
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const items = value.slice(0, 200).map((v) => sanitize(v, depth + 1));
    if (value.length > 200) items.push(`...${value.length - 200} more`);
    return items;
  }
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return value.toHexString();
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitize(v, depth + 1)]));
  }
  return value;
}

/** Best-effort write. Never throws - an audit failure must not break the request that caused it. */
async function record({ event, actor, resourceType, resourceId, data, req }) {
  try {
    await AuditLog.create({
      actor: toObjectId(actor?.id),
      actorRole: actor?.role || 'SYSTEM',
      action: event,
      resourceType: resourceType || 'Unknown',
      resourceId: toObjectId(resourceId),
      metadata: sanitize(data || {}),
      ip: req?.ip,
      userAgent: req?.userAgent,
    });
  } catch (err) {
    console.error(`[audit] failed to record ${event}:`, err.message);
  }
}

async function listLogs(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.actor) filter.actor = query.actor === 'SYSTEM' ? null : query.actor;
  if (query.actorRole) filter.actorRole = query.actorRole;
  if (query.action) filter.action = query.action;
  if (query.resourceType) filter.resourceType = query.resourceType;
  if (query.resourceId) filter.resourceId = query.resourceId;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = query.from;
    if (query.to) filter.createdAt.$lte = query.to;
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  // Attach actor name/email for readability
  const actorIds = [...new Set(logs.filter((l) => l.actor).map((l) => String(l.actor)))];
  const users = await User.find({ _id: { $in: actorIds } }).select('name email').lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  const items = logs.map((l) => ({
    id: String(l._id),
    at: l.createdAt,
    actor: l.actor
      ? { id: String(l.actor), role: l.actorRole, name: byId.get(String(l.actor))?.name || null, email: byId.get(String(l.actor))?.email || null }
      : { id: null, role: 'SYSTEM', name: 'System', email: null },
    action: l.action,
    resourceType: l.resourceType,
    resourceId: l.resourceId ? String(l.resourceId) : null,
    metadata: l.metadata,
    ip: l.ip || null,
    userAgent: l.userAgent || null,
  }));

  return { items, meta: buildMeta({ page, limit, total }) };
}

module.exports = { record, listLogs, sanitize };
