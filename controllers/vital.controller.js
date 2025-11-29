const Vital = require("../models/vital.model");
const Patient = require("../models/patient.model");
const Hospital = require("../models/hospital.model");
const { generateVitalId } = require("../utils/idGenerator");

/**
 * Record patient vitals/tests (Nurse functionality)
 */
exports.recordVitals = async (req, res) => {
  try {
    const {
      patient,
      bloodPressure,
      pulse,
      temperature,
      temperatureUnit,
      respiratoryRate,
      oxygenSaturation,
      bloodSugar,
      hba1c,
      weight,
      height,
      testResults,
      notes,
      visitType
    } = req.body;

    // Validate required fields
    if (!patient) {
      return res.status(400).json({ status: 0, message: "Patient ID is required" });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({ status: 0, message: "User not authenticated" });
    }

    if (!req.user.hospitalId) {
      return res.status(400).json({ status: 0, message: "Hospital ID is required" });
    }

    // Validate patient exists and belongs to same hospital
    // Patients are stored in main database
    let patientDoc = null;
    try {
      patientDoc = await Patient.findOne({ 
        _id: patient,
        hospitalId: req.user.hospitalId 
      });
    } catch (err) {
      console.error('Error finding patient:', err);
      return res.status(500).json({ status: 0, message: "Error validating patient", error: err.message });
    }
    
    if (!patientDoc) {
      return res.status(404).json({ status: 0, message: "Patient not found" });
    }

    // Get tenantId for ID generation
    let tenantId = null;
    try {
      if (req.user.hospitalId) {
        const hospital = await Hospital.findById(req.user.hospitalId).select("tenantId");
        tenantId = hospital ? hospital.tenantId : null;
      }
    } catch (err) {
      console.error('Error fetching hospital:', err);
      // Continue without tenantId if hospital lookup fails
    }

    // Generate vital ID
    let vitalId;
    try {
      vitalId = tenantId 
        ? await generateVitalId(Vital, tenantId)
        : `V-${Date.now()}`;
    } catch (err) {
      console.error('Error generating vital ID:', err);
      vitalId = `V-${Date.now()}`;
    }

    // Prepare vital data
    const vitalData = {
      hospitalId: req.user.hospitalId,
      vitalId,
      patient,
      recordedBy: req.user.id,
      recordedAt: new Date(),
      temperatureUnit: temperatureUnit || "F",
      visitType: visitType || "OPD"
    };

    // Add optional fields only if they exist
    if (bloodPressure) vitalData.bloodPressure = bloodPressure;
    if (pulse !== undefined && pulse !== null && pulse !== '') vitalData.pulse = Number(pulse);
    if (temperature !== undefined && temperature !== null && temperature !== '') vitalData.temperature = Number(temperature);
    if (respiratoryRate !== undefined && respiratoryRate !== null && respiratoryRate !== '') vitalData.respiratoryRate = Number(respiratoryRate);
    if (oxygenSaturation !== undefined && oxygenSaturation !== null && oxygenSaturation !== '') vitalData.oxygenSaturation = Number(oxygenSaturation);
    if (bloodSugar) vitalData.bloodSugar = bloodSugar;
    if (hba1c !== undefined && hba1c !== null && hba1c !== '') vitalData.hba1c = Number(hba1c);
    if (weight !== undefined && weight !== null && weight !== '') vitalData.weight = Number(weight);
    if (height !== undefined && height !== null && height !== '') vitalData.height = Number(height);
    if (testResults && Array.isArray(testResults)) vitalData.testResults = testResults;
    if (notes) vitalData.notes = notes;

    // Create vital record
    const vital = await Vital.create(vitalData);

    // Populate before returning
    await vital.populate("patient", "name patientId");
    await vital.populate("recordedBy", "firstName lastName email");

    res.status(201).json({
      status: 1,
      message: "Vitals recorded successfully",
      vital: vital
    });
  } catch (error) {
    console.error('Error recording vitals:', error);
    res.status(500).json({ 
      status: 0, 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Get all vitals for a patient
 */
exports.getPatientVitals = async (req, res) => {
  try {
    const { patientId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Validate patient exists and belongs to same hospital
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

    const vitals = await Vital.find(query)
      .populate("recordedBy", "firstName lastName email")
      .sort({ recordedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Vital.countDocuments(query);

    res.json({
      status: 1,
      vitals: vitals,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

/**
 * Get a single vital record by ID
 */
exports.getVitalById = async (req, res) => {
  try {
    const { id } = req.params;

    const vital = await Vital.findById(id)
      .populate("patient", "name patientId phone email")
      .populate("recordedBy", "firstName lastName email");

    if (!vital) {
      return res.status(404).json({ status: 0, message: "Vital record not found" });
    }

    res.json({
      status: 1,
      data: { vital }
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

/**
 * Update vital record
 */
exports.updateVitals = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const vital = await Vital.findById(id);
    if (!vital) {
      return res.status(404).json({ status: 0, message: "Vital record not found" });
    }

    // Only allow the person who recorded it or authorized users to update
    // You can add additional authorization logic here if needed

    // Remove fields that shouldn't be updated
    delete updateData.vitalId;
    delete updateData.patient;
    delete updateData.hospitalId;
    delete updateData.recordedBy;
    delete updateData.recordedAt;

    Object.assign(vital, updateData);
    await vital.save();

    const updatedVital = await Vital.findById(id)
      .populate("patient", "name patientId")
      .populate("recordedBy", "firstName lastName");

    res.json({
      status: 1,
      message: "Vital record updated successfully",
      data: { vital: updatedVital }
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

/**
 * Get latest vitals for a patient
 */
exports.getLatestVitals = async (req, res) => {
  try {
    const { patientId } = req.params;

    const latestVital = await Vital.findOne({ patient: patientId })
      .populate("recordedBy", "firstName lastName")
      .sort({ recordedAt: -1 });

    if (!latestVital) {
      return res.status(404).json({ 
        status: 0, 
        message: "No vital records found for this patient" 
      });
    }

    res.json({
      status: 1,
      data: { vital: latestVital }
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

