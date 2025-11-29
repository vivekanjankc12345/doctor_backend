const mongoose = require('mongoose');

const userTenantSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, unique: true, sparse: true },
  phone: { type: String },
  password: { type: String, required: true },
  roles: [{ type: mongoose.Schema.Types.ObjectId }],
  hospitalId: { type: mongoose.Schema.Types.ObjectId },
  department: { type: String },
  specialization: { type: String },
  shift: { type: String },
  status: { 
    type: String, 
    enum: ["ACTIVE", "INACTIVE", "LOCKED", "PASSWORD_EXPIRED"], 
    default: "ACTIVE" 
  },
  isActive: { type: Boolean, default: true },
  passwordHistory: [{ 
    password: String, 
    changedAt: { type: Date, default: Date.now } 
  }],
  passwordChangedAt: { type: Date },
  forcePasswordChange: { type: Boolean, default: false },
  otp: { type: String },
  otpExpiry: { type: Date },
  resetToken: { type: String },
  resetExpiry: { type: Date },
  lastLogin: { type: Date }
}, { timestamps: true });

module.exports = userTenantSchema;
