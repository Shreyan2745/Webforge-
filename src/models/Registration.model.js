const mongoose = require('mongoose');
const { REGISTRATION_STATUS, CANCEL_REASONS } = require('../constants/enums');

const { ObjectId } = mongoose.Schema.Types;

// One entry per status change. by = null means SYSTEM.
const historyEntrySchema = new mongoose.Schema(
  {
    status: { type: String, enum: Object.values(REGISTRATION_STATUS), required: true },
    at: { type: Date, default: Date.now },
    by: { type: ObjectId, ref: 'User', default: null },
    byRole: { type: String, default: 'SYSTEM' },
    reason: { type: String, maxlength: 300 },
  },
  { _id: false }
);

const registrationSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    workshop: { type: ObjectId, ref: 'Workshop', required: true },
    status: { type: String, enum: Object.values(REGISTRATION_STATUS), required: true },
    // false only when CANCELLED - drives the "one active registration per workshop" unique index
    isActive: { type: Boolean, default: true },
    queueSeq: { type: Number, default: null }, // ticket number from Workshop.queueSeq - waitlist order
    presentAt: Date, // waitlisted person confirmed at the venue on event day
    checkedInAt: Date,
    cancelledAt: Date,
    cancelReason: { type: String, enum: [...Object.values(CANCEL_REASONS), null], default: null },
    statusHistory: { type: [historyEntrySchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret._id;
        delete ret.__v;
        delete ret.queueSeq;
        return ret;
      },
    },
  }
);

registrationSchema.pre('save', function syncIsActive() {
  this.isActive = this.status !== REGISTRATION_STATUS.CANCELLED;
});

// R5: one active registration per user per workshop (re-register after cancelling is allowed)
registrationSchema.index(
  { user: 1, workshop: 1 },
  { unique: true, partialFilterExpression: { isActive: true }, name: 'one_active_registration' }
);
registrationSchema.index({ workshop: 1, status: 1, queueSeq: 1, createdAt: 1 }); // waitlist queue + rosters
registrationSchema.index({ user: 1, createdAt: -1 }); // "my registrations"

module.exports = mongoose.model('Registration', registrationSchema);
