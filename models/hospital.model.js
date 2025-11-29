const mongoose = require("mongoose");

const hospitalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    licenseNumber: { type: String, required: true, unique: true },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    tenantId: { type: String, required: true, unique: true },
    status: { type: String, enum: ["PENDING","VERIFIED","ACTIVE","SUSPENDED","INACTIVE"], default: "PENDING" },
    verificationToken: { type: String },
    tokenExpiry: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Hospital", hospitalSchema);
