const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config/env');
const { ROLES } = require('../constants/enums');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.USER },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret._id;
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.index({ role: 1 });

// Hash the password whenever it is set or changed
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, config.bcryptSaltRounds);
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
