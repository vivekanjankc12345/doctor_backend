/**
 * Generate Patient ID: {tenantId}-P-{sequential}
 */
exports.generatePatientId = async (PatientModel, tenantId) => {
  try {
    // Get the last patient for this tenant
    const lastPatient = await PatientModel.findOne({ 
      patientId: { $regex: `^${tenantId}-P-` }
    }).sort({ patientId: -1 });

    let sequence = 1;
    
    if (lastPatient && lastPatient.patientId) {
      const lastSeq = parseInt(lastPatient.patientId.split("-P-")[1]);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }

    return `${tenantId}-P-${sequence.toString().padStart(6, "0")}`;
  } catch (error) {
    // Fallback to timestamp-based ID
    return `${tenantId}-P-${Date.now()}`;
  }
};

/**
 * Generate Prescription ID: {tenantId}-RX-{sequential}
 */
exports.generatePrescriptionId = async (PrescriptionModel, tenantId) => {
  try {
    // Get the last prescription for this tenant
    const lastPrescription = await PrescriptionModel.findOne({ 
      prescriptionId: { $regex: `^${tenantId}-RX-` }
    }).sort({ prescriptionId: -1 });

    let sequence = 1;
    
    if (lastPrescription && lastPrescription.prescriptionId) {
      const lastSeq = parseInt(lastPrescription.prescriptionId.split("-RX-")[1]);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }

    return `${tenantId}-RX-${sequence.toString().padStart(6, "0")}`;
  } catch (error) {
    // Fallback to timestamp-based ID
    return `${tenantId}-RX-${Date.now()}`;
  }
};

/**
 * Generate Vital ID: {tenantId}-V-{sequential}
 */
exports.generateVitalId = async (VitalModel, tenantId) => {
  try {
    // Get the last vital record for this tenant
    const lastVital = await VitalModel.findOne({ 
      vitalId: { $regex: `^${tenantId}-V-` }
    }).sort({ vitalId: -1 });

    let sequence = 1;
    
    if (lastVital && lastVital.vitalId) {
      const lastSeq = parseInt(lastVital.vitalId.split("-V-")[1]);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }

    return `${tenantId}-V-${sequence.toString().padStart(6, "0")}`;
  } catch (error) {
    // Fallback to timestamp-based ID
    return `${tenantId}-V-${Date.now()}`;
  }
};

/**
 * Generate Medical Record ID: {tenantId}-MR-{sequential}
 */
exports.generateMedicalRecordId = async (MedicalRecordModel, tenantId) => {
  try {
    // Get the last medical record for this tenant
    const lastRecord = await MedicalRecordModel.findOne({ 
      recordId: { $regex: `^${tenantId}-MR-` }
    }).sort({ recordId: -1 });

    let sequence = 1;
    
    if (lastRecord && lastRecord.recordId) {
      const lastSeq = parseInt(lastRecord.recordId.split("-MR-")[1]);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }

    return `${tenantId}-MR-${sequence.toString().padStart(6, "0")}`;
  } catch (error) {
    // Fallback to timestamp-based ID
    return `${tenantId}-MR-${Date.now()}`;
  }
};

