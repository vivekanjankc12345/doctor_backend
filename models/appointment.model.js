const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    appointmentDate: { type: Date, required: true },
    status: { type: String, enum: ["PENDING","CONFIRMED","COMPLETED","CANCELLED"], default: "PENDING" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
