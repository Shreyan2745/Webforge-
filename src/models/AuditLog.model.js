const mongoose = require('mongoose');

const { ObjectId, Mixed } = mongoose.Schema.Types;

// Who did what, when, to what. Append-only: never updated or deleted by the API.
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: ObjectId, ref: 'User', default: null }, // null = SYSTEM
    actorRole: { type: String, default: 'SYSTEM' },
    action: { type: String, required: true }, // event name, e.g. WORKSHOP_CANCELLED
    resourceType: { type: String, required: true }, // User | Workshop | Registration | Certificate
    resourceId: { type: ObjectId, default: null },
    metadata: { type: Mixed, default: {} },
    ip: String,
    userAgent: String,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
