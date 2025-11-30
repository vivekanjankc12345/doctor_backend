const mongoose = require("mongoose");

const vitalSchema = new mongoose.Schema(
  {
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
    vitalId: { type: String, unique: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Nurse who recorded
    recordedAt: { type: Date, default: Date.now },
    
    // Vital Signs
    bloodPressure: {
      systolic: { type: Number }, // mmHg
      diastolic: { type: Number }, // mmHg
    },
    pulse: { type: Number }, // beats per minute
    temperature: { type: Number }, // Fahrenheit or Celsius
    temperatureUnit: { type: String, enum: ["C", "F"], default: "F" },
    respiratoryRate: { type: Number }, // breaths per minute
    oxygenSaturation: { type: Number }, // SpO2 percentage
    
    // Blood Tests
    bloodSugar: {
      fasting: { type: Number }, // mg/dL
      random: { type: Number }, // mg/dL
      postPrandial: { type: Number }, // mg/dL (after meal)
    },
    hba1c: { type: Number }, // Percentage
    
    // Other Tests
    weight: { type: Number }, // kg
    height: { type: Number }, // cm
    bmi: { type: Number }, // Calculated or manual
    
    // Additional test results (flexible for various tests)
    testResults: [{
      testName: { type: String, required: true }, // e.g., "Blood Sugar", "BP", "Temperature"
      value: { type: String, required: true }, // Test value
      unit: { type: String }, // Unit of measurement
      normalRange: { type: String }, // Normal range for reference
      status: { type: String, enum: ["NORMAL", "ABNORMAL", "CRITICAL"], default: "NORMAL" }
    }],
    
    notes: { type: String }, // Additional notes
    visitType: { type: String, enum: ["OPD", "IPD", "EMERGENCY"], default: "OPD" }
  },
  { timestamps: true }
);

// Calculate BMI before saving
vitalSchema.pre("save", async function() {
  try {
    if (this.weight && this.height) {
      const heightInMeters = this.height / 100; // Convert cm to meters
      this.bmi = parseFloat((this.weight / (heightInMeters * heightInMeters)).toFixed(2));
    }
  } catch (error) {
    console.error('Error calculating BMI in vital pre-save hook:', error);
    // Don't throw error, just log it - BMI calculation is optional
  }
});

module.exports = mongoose.model("Vital", vitalSchema);

