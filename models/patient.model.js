const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
    patientId: { type: String, unique: true },
    name: { type: String, required: true },
    dob: { type: Date, required: true },
    gender: { type: String, enum: ["Male","Female","Other"], required: true },
    phone: { type: String, required: true },
    email: { type: String },
    bloodGroup: { type: String },
    type: { type: String, enum: ["OPD","IPD"], default: "OPD" },
    assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedNurse: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    },
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
      email: String
    },
    photo: { type: String }, // URL or path to uploaded photo
    department: { type: String }, // For ABAC filtering
    confidentialityLevel: { type: String, enum: ["PUBLIC", "CONFIDENTIAL", "RESTRICTED"], default: "CONFIDENTIAL" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Patient", patientSchema);
