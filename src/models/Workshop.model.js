const mongoose = require('mongoose');
const config = require('../config/env');
const { WORKSHOP_STATUS } = require('../constants/enums');

const { ObjectId } = mongoose.Schema.Types;

const workshopSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    trainer: { type: String, required: true, trim: true, maxlength: 80 },
    venue: { type: String, required: true, trim: true, maxlength: 120 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      max: 10000,
      validate: { validator: Number.isInteger, message: 'Capacity must be a whole number' },
    },
    // CONFIRMED + ATTENDED registrations. Only ever changed with atomic updates.
    seatsTaken: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: Object.values(WORKSHOP_STATUS), default: WORKSHOP_STATUS.DRAFT },
    spotRegistrars: [{ type: ObjectId, ref: 'User' }],
    noShowGraceMinutes: { type: Number, min: 0, max: 120, default: () => config.rules.defaultNoShowGraceMinutes },

    publishedAt: Date,
    cancelledAt: Date,
    cancelReason: { type: String, trim: true, maxlength: 300 },
    completedAt: Date,

    reminder24hSentAt: Date,
    reminder1hSentAt: Date,

    createdBy: { type: ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret._id;
        delete ret.__v;
        delete ret.reminder24hSentAt;
        delete ret.reminder1hSentAt;
        return ret;
      },
    },
  }
);

workshopSchema.virtual('seatsLeft').get(function seatsLeft() {
  return Math.max(0, (this.capacity || 0) - (this.seatsTaken || 0));
});

workshopSchema.pre('validate', function checkDates() {
  if (this.startAt && this.endAt && this.endAt <= this.startAt) {
    this.invalidate('endAt', 'endAt must be after startAt');
  }
});

workshopSchema.index({ status: 1, startAt: 1 });
workshopSchema.index({ spotRegistrars: 1, startAt: 1 });
workshopSchema.index({ title: 'text', description: 'text', trainer: 'text' });

module.exports = mongoose.model('Workshop', workshopSchema);
