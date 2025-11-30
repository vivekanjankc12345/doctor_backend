const Vital = require("../models/vital.model");
const Patient = require("../models/patient.model");
const Hospital = require("../models/hospital.model");
const { generateVitalId } = require("../utils/idGenerator");

/**
 * Record patient vitals/tests (Nurse functionality)
 */
exports.recordVitals = async (req, res, next) => {
  try {
    console.log('🔍 recordVitals - Request body:', JSON.stringify(req.body, null, 2));
    console.log('🔍 recordVitals - User:', req.user?.id, 'Hospital:', req.user?.hospitalId);
    
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
      console.error('🔍 recordVitals - Missing patient ID');
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

    // Add optional fields only if they exist and are valid
    if (bloodPressure && typeof bloodPressure === 'object' && (bloodPressure.systolic || bloodPressure.diastolic)) {
      vitalData.bloodPressure = {
        systolic: bloodPressure.systolic ? Number(bloodPressure.systolic) : undefined,
        diastolic: bloodPressure.diastolic ? Number(bloodPressure.diastolic) : undefined
      };
    }
    if (pulse !== undefined && pulse !== null && pulse !== '') {
      const pulseNum = Number(pulse);
      if (!isNaN(pulseNum)) vitalData.pulse = pulseNum;
    }
    if (temperature !== undefined && temperature !== null && temperature !== '') {
      const tempNum = Number(temperature);
      if (!isNaN(tempNum)) vitalData.temperature = tempNum;
    }
    if (respiratoryRate !== undefined && respiratoryRate !== null && respiratoryRate !== '') {
      const rrNum = Number(respiratoryRate);
      if (!isNaN(rrNum)) vitalData.respiratoryRate = rrNum;
    }
    if (oxygenSaturation !== undefined && oxygenSaturation !== null && oxygenSaturation !== '') {
      const spo2Num = Number(oxygenSaturation);
      if (!isNaN(spo2Num)) vitalData.oxygenSaturation = spo2Num;
    }
    if (bloodSugar && typeof bloodSugar === 'object' && (bloodSugar.fasting || bloodSugar.random || bloodSugar.postPrandial)) {
      vitalData.bloodSugar = {};
      if (bloodSugar.fasting !== undefined && bloodSugar.fasting !== null && bloodSugar.fasting !== '') {
        const fastingNum = Number(bloodSugar.fasting);
        if (!isNaN(fastingNum)) vitalData.bloodSugar.fasting = fastingNum;
      }
      if (bloodSugar.random !== undefined && bloodSugar.random !== null && bloodSugar.random !== '') {
        const randomNum = Number(bloodSugar.random);
        if (!isNaN(randomNum)) vitalData.bloodSugar.random = randomNum;
      }
      if (bloodSugar.postPrandial !== undefined && bloodSugar.postPrandial !== null && bloodSugar.postPrandial !== '') {
        const ppNum = Number(bloodSugar.postPrandial);
        if (!isNaN(ppNum)) vitalData.bloodSugar.postPrandial = ppNum;
      }
    }
    if (hba1c !== undefined && hba1c !== null && hba1c !== '') {
      const hba1cNum = Number(hba1c);
      if (!isNaN(hba1cNum)) vitalData.hba1c = hba1cNum;
    }
    if (weight !== undefined && weight !== null && weight !== '') {
      const weightNum = Number(weight);
      if (!isNaN(weightNum)) vitalData.weight = weightNum;
    }
    if (height !== undefined && height !== null && height !== '') {
      const heightNum = Number(height);
      if (!isNaN(heightNum)) vitalData.height = heightNum;
    }
    if (testResults && Array.isArray(testResults)) vitalData.testResults = testResults;
    if (notes) vitalData.notes = notes;

    console.log('🔍 recordVitals - Final vitalData to save:', JSON.stringify(vitalData, null, 2));

    // Create vital record
    const vital = await Vital.create(vitalData);
    console.log('🔍 recordVitals - Vital created successfully:', vital._id);

    // Populate before returning
    await vital.populate("patient", "name patientId");
    await vital.populate("recordedBy", "firstName lastName email");

    console.log('🔍 recordVitals - Vital populated, returning response');

    res.status(201).json({
      status: 1,
      message: "Vitals recorded successfully",
      vital: vital
    });
  } catch (error) {
    console.error('Error recording vitals:', error);
    // If next is provided, pass error to error handler, otherwise send response
    if (next && typeof next === 'function') {
      return next(error);
    }
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

    console.log('🔍 getPatientVitals - Request:', { patientId, page, limit, hospitalId: req.user?.hospitalId });

    // Validate patient exists and belongs to same hospital
    const patient = await Patient.findOne({ 
      _id: patientId,
      hospitalId: req.user.hospitalId 
    });
    if (!patient) {
      console.log('🔍 getPatientVitals - Patient not found');
      return res.status(404).json({ status: 0, message: "Patient not found" });
    }

    const query = { 
      patient: patientId,
      hospitalId: req.user.hospitalId 
    };

    console.log('🔍 getPatientVitals - Query:', JSON.stringify(query, null, 2));

    const vitals = await Vital.find(query)
      .populate("recordedBy", "firstName lastName email")
      .sort({ recordedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Vital.countDocuments(query);

    console.log('🔍 getPatientVitals - Found vitals:', vitals.length, 'Total:', total);

    // Convert Mongoose documents to plain objects
    const vitalsData = vitals.map(v => {
      const vitalObj = v.toObject ? v.toObject() : v;
      return vitalObj;
    });

    console.log('🔍 getPatientVitals - First vital sample:', vitalsData.length > 0 ? {
      _id: vitalsData[0]._id,
      recordedAt: vitalsData[0].recordedAt,
      bloodPressure: vitalsData[0].bloodPressure,
      recordedBy: vitalsData[0].recordedBy
    } : 'No vitals');

    // Set cache headers to prevent 304 responses during development
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      status: 1,
      vitals: vitalsData,
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

