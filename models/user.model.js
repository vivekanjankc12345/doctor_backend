const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital" },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    username: { type: String, unique: true, sparse: true },
    phone: { type: String },
    password: { type: String, required: true },
    roles: [{ type: mongoose.Schema.Types.ObjectId, ref: "Role" }],
    department: { type: String },
    specialization: { type: String }, // For doctors
    shift: { type: String }, // For ABAC
    status: { 
      type: String, 
      enum: ["ACTIVE", "INACTIVE", "LOCKED", "PASSWORD_EXPIRED"], 
      default: "ACTIVE" 
    },
    isActive: { type: Boolean, default: true }, // Legacy field, maps to status
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
