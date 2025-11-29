const Prescription = require("../models/prescription.model");
const Hospital = require("../models/hospital.model");
const Patient = require("../models/patient.model");
const { generatePrescriptionId } = require("../utils/idGenerator");

exports.createPrescription = async (req, res) => {
  try {
    const { patient, medicines, notes, template } = req.body;
    
    // Validate medicines array
    if (!medicines || !Array.isArray(medicines) || medicines.length === 0) {
      return res.status(400).json({ 
        status: 0, 
        message: "At least one medicine is required" 
      });
    }
    
    // Validate patient exists
    const patientExists = await Patient.findOne({ 
      _id: patient, 
      hospitalId: req.user.hospitalId 
    });
    if (!patientExists) {
      return res.status(404).json({ 
        status: 0, 
        message: "Patient not found" 
      });
    }
    
    // Get tenantId for ID generation
    let tenantId = null;
    if (req.user.hospitalId) {
      const hospital = await Hospital.findById(req.user.hospitalId).select("tenantId");
      tenantId = hospital ? hospital.tenantId : null;
    }
    
    // Generate prescription ID
    const prescriptionId = tenantId 
      ? await generatePrescriptionId(Prescription, tenantId)
      : `RX-${Date.now()}`;
    
    const prescription = await Prescription.create({
      hospitalId: req.user.hospitalId,
      prescriptionId,
      patient, 
      doctor: req.user.id, 
      medicines, 
      notes,
      template,
      status: "ACTIVE"
    });
    
    // Populate patient and doctor details
    const populatedPrescription = await Prescription.findById(prescription._id)
      .populate("patient", "patientId name phone email")
      .populate("doctor", "firstName lastName email specialization");
    
    res.status(201).json({ 
      status: 1, 
      message: "Prescription Created", 
      prescription: populatedPrescription 
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

// Get all prescriptions with filters
exports.getPrescriptions = async (req, res) => {
  try {
    const { 
      patient, 
      doctor, 
      status, 
      startDate, 
      endDate,
      page = 1, 
      limit = 20 
    } = req.query;
    
    const query = { hospitalId: req.user.hospitalId };
    
    // Apply ABAC filter if present (doctors can only see their own prescriptions)
    if (req.abacFilter) {
      Object.assign(query, req.abacFilter);
    }
    
    // Filters
    if (patient) query.patient = patient;
    if (doctor) query.doctor = doctor;
    if (status) query.status = status;
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [prescriptions, total] = await Promise.all([
      Prescription.find(query)
        .populate("patient", "patientId name phone email")
        .populate("doctor", "firstName lastName email specialization")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Prescription.countDocuments(query)
    ]);
    
    res.status(200).json({
      status: 1,
      prescriptions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

// Get prescription by ID
exports.getPrescriptionById = async (req, res) => {
  try {
    const query = { 
      _id: req.params.id, 
      hospitalId: req.user.hospitalId 
    };
    
    // Apply ABAC filter if present
    if (req.abacFilter) {
      Object.assign(query, req.abacFilter);
    }
    
    const prescription = await Prescription.findOne(query)
      .populate("patient", "patientId name dob gender phone email bloodGroup address")
      .populate("doctor", "firstName lastName email specialization department");
    
    if (!prescription) {
      return res.status(404).json({ status: 0, message: "Prescription not found" });
    }
    
    res.status(200).json({ status: 1, prescription });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

// Get prescription templates (common prescriptions)
exports.getTemplates = async (req, res) => {
  try {
    // Common prescription templates
    const templates = [
      {
        name: "Common Cold",
        medicines: [
          {
            name: "Paracetamol",
            dosage: "500mg",
            frequency: "Twice daily",
            duration: "5 days",
            instructions: "After meals"
          },
          {
            name: "Cetirizine",
            dosage: "10mg",
            frequency: "Once daily",
            duration: "5 days",
            instructions: "At bedtime"
          }
        ],
        notes: "Rest and drink plenty of fluids"
      },
      {
        name: "Fever",
        medicines: [
          {
            name: "Paracetamol",
            dosage: "500mg",
            frequency: "Every 6 hours",
            duration: "3 days",
            instructions: "As needed for fever"
          }
        ],
        notes: "Monitor temperature"
      },
      {
        name: "Headache",
        medicines: [
          {
            name: "Ibuprofen",
            dosage: "400mg",
            frequency: "Every 8 hours",
            duration: "3 days",
            instructions: "After meals"
          }
        ],
        notes: "Rest in a quiet, dark room"
      }
    ];
    
    res.status(200).json({ status: 1, templates });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};
