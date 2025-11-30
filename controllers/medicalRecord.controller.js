const MedicalRecord = require("../models/medicalRecord.model");
const Patient = require("../models/patient.model");
const Hospital = require("../models/hospital.model");
const { generateMedicalRecordId } = require("../utils/idGenerator");

/**
 * Create a new medical record
 */
exports.createMedicalRecord = async (req, res) => {
  try {
    const {
      patient,
      chiefComplaint,
      diagnosis,
      treatment,
      history,
      clinicalNotes,
      physicalExamination,
      investigations,
      notes,
      visitDate
    } = req.body;

    // Validate patient exists
    const patientDoc = await Patient.findOne({ 
      _id: patient, 
      hospitalId: req.user.hospitalId 
    });
    if (!patientDoc) {
      return res.status(404).json({ status: 0, message: "Patient not found" });
    }

    // Get tenantId for ID generation
    let tenantId = null;
    if (req.user.hospitalId) {
      const hospital = await Hospital.findById(req.user.hospitalId).select("tenantId");
      tenantId = hospital ? hospital.tenantId : null;
    }

    // Generate record ID
    const recordId = tenantId 
      ? await generateMedicalRecordId(MedicalRecord, tenantId)
      : `MR-${Date.now()}`;

    // Create medical record
    // For nurses, use the assigned doctor if available, otherwise use the nurse's ID
    const recordDoctor = req.user.id; // Can be doctor or nurse
    
    const medicalRecord = await MedicalRecord.create({
      hospitalId: req.user.hospitalId,
      recordId,
      patient,
      doctor: recordDoctor,
      visitDate: visitDate || new Date(),
      chiefComplaint,
      diagnosis: diagnosis || [],
      treatment: treatment || {},
      history: history || {},
      clinicalNotes,
      physicalExamination: physicalExamination || {},
      investigations: investigations || [],
      notes,
      status: "ACTIVE"
    });

    // Populate patient and doctor details
    const populatedRecord = await MedicalRecord.findById(medicalRecord._id)
      .populate("patient", "patientId name phone email")
      .populate("doctor", "firstName lastName email specialization");

    res.status(201).json({
      status: 1,
      message: "Medical record created successfully",
      data: { medicalRecord: populatedRecord }
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

/**
 * Get all medical records for a patient
 */
exports.getPatientMedicalRecords = async (req, res) => {
  try {
    const { patientId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Validate patient exists
    const patient = await Patient.findOne({ 
      _id: patientId, 
      hospitalId: req.user.hospitalId 
    });
    if (!patient) {
      return res.status(404).json({ status: 0, message: "Patient not found" });
    }

    const query = { 
      patient: patientId,
      hospitalId: req.user.hospitalId
    };

    const medicalRecords = await MedicalRecord.find(query)
      .populate("doctor", "firstName lastName email specialization")
      .sort({ visitDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await MedicalRecord.countDocuments(query);

    res.json({
      status: 1,
      data: {
        medicalRecords,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

/**
 * Get a single medical record by ID
 */
exports.getMedicalRecordById = async (req, res) => {
  try {
    const { id } = req.params;

    const medicalRecord = await MedicalRecord.findOne({
      _id: id,
      hospitalId: req.user.hospitalId
    })
      .populate("patient", "name patientId phone email dob gender bloodGroup")
      .populate("doctor", "firstName lastName email specialization");

    if (!medicalRecord) {
      return res.status(404).json({ status: 0, message: "Medical record not found" });
    }

    res.json({
      status: 1,
      data: { medicalRecord }
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

/**
 * Update medical record
 */
exports.updateMedicalRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const medicalRecord = await MedicalRecord.findOne({
      _id: id,
      hospitalId: req.user.hospitalId
    });

    if (!medicalRecord) {
      return res.status(404).json({ status: 0, message: "Medical record not found" });
    }

    // Only allow the doctor who created it or authorized users to update
    if (medicalRecord.doctor.toString() !== req.user.id.toString()) {
      return res.status(403).json({ 
        status: 0, 
        message: "You can only update your own medical records" 
      });
    }

    // Remove fields that shouldn't be updated
    delete updateData.recordId;
    delete updateData.patient;
    delete updateData.hospitalId;
    delete updateData.doctor;

    Object.assign(medicalRecord, updateData);
    await medicalRecord.save();

    const updatedRecord = await MedicalRecord.findById(id)
      .populate("patient", "name patientId")
      .populate("doctor", "firstName lastName");

    res.json({
      status: 1,
      message: "Medical record updated successfully",
      data: { medicalRecord: updatedRecord }
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

/**
 * Get latest medical record for a patient
 */
exports.getLatestMedicalRecord = async (req, res) => {
  try {
    const { patientId } = req.params;

    const latestRecord = await MedicalRecord.findOne({ 
      patient: patientId,
      hospitalId: req.user.hospitalId
    })
      .populate("doctor", "firstName lastName")
      .sort({ visitDate: -1 });

    if (!latestRecord) {
      return res.status(404).json({ 
        status: 0, 
        message: "No medical records found for this patient" 
      });
    }

    res.json({
      status: 1,
      data: { medicalRecord: latestRecord }
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

