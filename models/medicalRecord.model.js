const mongoose = require("mongoose");

const medicalRecordSchema = new mongoose.Schema(
  {
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
    recordId: { type: String, unique: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    visitDate: { type: Date, default: Date.now },
    
    // Chief Complaint
    chiefComplaint: { type: String },
    
    // Diagnosis
    diagnosis: [{
      code: { type: String }, // ICD-10 code if applicable
      description: { type: String, required: true },
      type: { type: String, enum: ["PRIMARY", "SECONDARY", "DIFFERENTIAL"], default: "PRIMARY" }
    }],
    
    // Treatment Plan
    treatment: {
      plan: { type: String }, // Treatment plan description
      procedures: [{ 
        name: { type: String },
        description: { type: String },
        date: { type: Date }
      }],
      followUp: {
        required: { type: Boolean, default: false },
        date: { type: Date },
        notes: { type: String }
      }
    },
    
    // Patient History
    history: {
      presentIllness: { type: String }, // History of Present Illness (HPI)
      pastMedicalHistory: { type: String }, // Past Medical History (PMH)
      familyHistory: { type: String }, // Family History
      socialHistory: { type: String }, // Social History
      allergies: [{ 
        substance: { type: String },
        reaction: { type: String },
        severity: { type: String, enum: ["MILD", "MODERATE", "SEVERE"], default: "MILD" }
      }]
    },
    
    // Clinical Notes
    clinicalNotes: { type: String },
    
    // Physical Examination
    physicalExamination: {
      general: { type: String },
      cardiovascular: { type: String },
      respiratory: { type: String },
      abdominal: { type: String },
      neurological: { type: String },
      other: { type: String }
    },
    
    // Investigations/Test Orders
    investigations: [{
      testName: { type: String, required: true },
      testType: { type: String, enum: ["BLOOD_TEST", "IMAGING", "ECG", "OTHER"], default: "BLOOD_TEST" },
      orderedDate: { type: Date, default: Date.now },
      status: { type: String, enum: ["ORDERED", "IN_PROGRESS", "COMPLETED", "CANCELLED"], default: "ORDERED" },
      notes: { type: String }
    }],
    
    // Status
    status: { type: String, enum: ["ACTIVE", "COMPLETED", "CANCELLED"], default: "ACTIVE" },
    
    notes: { type: String } // Additional notes
  },
  { timestamps: true }
);

module.exports = mongoose.model("MedicalRecord", medicalRecordSchema);

