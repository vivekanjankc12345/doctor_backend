const mongoose = require("mongoose");

const prescriptionSchema = new mongoose.Schema(
  {
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
    prescriptionId: { type: String, unique: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    medicines: [{ 
      name: { type: String, required: true },
      dosage: { type: String, required: true },
      frequency: { type: String, required: true },
      duration: { type: String, required: true },
      instructions: { type: String }
    }],
    notes: { type: String },
    template: { type: String }, // Reference to template if used
    status: { type: String, enum: ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"], default: "ACTIVE" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Prescription", prescriptionSchema);
