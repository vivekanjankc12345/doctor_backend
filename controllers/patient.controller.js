const Patient = require("../models/patient.model");
const Hospital = require("../models/hospital.model");
const { generatePatientId } = require("../utils/idGenerator");
const mongoose = require("mongoose");

exports.createPatient = async (req, res) => {
  try {
    const { 
      name, dob, gender, phone, email, bloodGroup, type, assignedDoctor,
      address, emergencyContact, photo, department
    } = req.body;
    
    // Get tenantId for ID generation
    let tenantId = null;
    if (req.user.hospitalId) {
      const hospital = await Hospital.findById(req.user.hospitalId).select("tenantId");
      tenantId = hospital ? hospital.tenantId : null;
    }
    
    // Generate patient ID
    const patientId = tenantId 
      ? await generatePatientId(Patient, tenantId)
      : `PAT-${Date.now()}`;
    
    const patient = await Patient.create({
      hospitalId: req.user.hospitalId,
      patientId,
      name, 
      dob, 
      gender, 
      phone, 
      email,
      bloodGroup, 
      type: type || "OPD", 
      assignedDoctor,
      address,
      emergencyContact,
      photo,
      department
    });
    
    res.status(201).json({ status: 1, message: "Patient Registered", patient });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

exports.searchPatients = async (req, res) => {
  try {
    const { 
      search, 
      patientType, 
      department, 
      doctor, 
      nurse,
      startDate, 
      endDate,
      page = 1, 
      limit = 20 
    } = req.query;
    
    const query = { hospitalId: req.user.hospitalId };
    
    // Apply ABAC filter if present (from ABAC middleware)
    // For doctors and nurses, ABAC already includes assignedDoctor/assignedNurse in $or
    if (req.abacFilter) {
      // If ABAC has $or (for doctors/nurses), ensure assignedDoctor/assignedNurse is included if param provided
      if (req.abacFilter.$or && Array.isArray(req.abacFilter.$or)) {
        if (doctor) {
          // Check if assignedDoctor condition already exists in $or
          let doctorId = doctor;
          if (typeof doctor === 'string' && mongoose.Types.ObjectId.isValid(doctor)) {
            doctorId = new mongoose.Types.ObjectId(doctor);
          }
          const hasDoctorCondition = req.abacFilter.$or.some(
            condition => {
              if (!condition.assignedDoctor) return false;
              return condition.assignedDoctor.toString() === doctorId.toString();
            }
          );
          if (!hasDoctorCondition) {
            req.abacFilter.$or.push({ assignedDoctor: doctorId });
          }
        }
        if (nurse) {
          // Check if assignedNurse condition already exists in $or
          let nurseId = nurse;
          if (typeof nurse === 'string' && mongoose.Types.ObjectId.isValid(nurse)) {
            nurseId = new mongoose.Types.ObjectId(nurse);
          }
          const hasNurseCondition = req.abacFilter.$or.some(
            condition => {
              if (!condition.assignedNurse) return false;
              return condition.assignedNurse.toString() === nurseId.toString();
            }
          );
          if (!hasNurseCondition) {
            req.abacFilter.$or.push({ assignedNurse: nurseId });
          }
        }
      }
      Object.assign(query, req.abacFilter);
    } else {
      // No ABAC filter, apply direct filters
      if (doctor) {
        if (typeof doctor === 'string' && mongoose.Types.ObjectId.isValid(doctor)) {
          query.assignedDoctor = new mongoose.Types.ObjectId(doctor);
        } else {
          query.assignedDoctor = doctor;
        }
      }
      if (nurse) {
        if (typeof nurse === 'string' && mongoose.Types.ObjectId.isValid(nurse)) {
          query.assignedNurse = new mongoose.Types.ObjectId(nurse);
        } else {
          query.assignedNurse = nurse;
        }
      }
    }
    
    // Debug logging for nurse queries
    if (nurse || (req.abacFilter && req.abacFilter.$or && req.abacFilter.$or.some(c => c.assignedNurse))) {
      console.log('🔍 Patient search query for nurse:', JSON.stringify(query, null, 2));
    }
    
    // Search by Patient ID, Name, Phone, Email
    if (search) {
      const searchConditions = [
        { patientId: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
      
      // If query already has $or (from ABAC), we need to use $and to combine
      // ABAC filter: { $or: [{ assignedNurse: nurseId }, { department: dept }] }
      // Search filter: { $or: [{ patientId: ... }, { name: ... }] }
      // Combined: { $and: [{ $or: ABAC }, { $or: search }] }
      if (query.$or && Array.isArray(query.$or)) {
        // Check if $or contains object conditions (ABAC filter)
        const hasObjectConditions = query.$or.some(cond => 
          typeof cond === 'object' && !cond.$regex
        );
        if (hasObjectConditions) {
          // This is ABAC filter, combine with search using $and
          query.$and = [
            { $or: query.$or },
            { $or: searchConditions }
          ];
          delete query.$or;
        } else {
          // This is search filter, just add to it
          query.$or.push(...searchConditions);
        }
      } else {
        query.$or = searchConditions;
      }
    }
    
    // Filters
    if (patientType) query.type = patientType;
    if (department && !query.$or) query.department = department;
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Debug logging for nurse queries
    const isNurseQuery = nurse || (req.abacFilter && req.abacFilter.$or && req.abacFilter.$or.some(c => c.assignedNurse));
    if (isNurseQuery) {
      console.log('🔍 Nurse patient query:', JSON.stringify(query, null, 2));
      console.log('🔍 Nurse ID from request:', req.user?.id);
    }
    
    const [patients, total] = await Promise.all([
      Patient.find(query)
        .populate("assignedDoctor", "firstName lastName email")
        .populate("assignedNurse", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Patient.countDocuments(query)
    ]);
    
    // Debug logging for results
    if (isNurseQuery) {
      console.log('🔍 Found patients for nurse:', patients.length, 'Total:', total);
      if (patients.length > 0) {
        patients.forEach((p, i) => {
          console.log(`🔍 Patient ${i + 1}:`, {
            name: p.name,
            assignedNurse: p.assignedNurse?._id || p.assignedNurse,
            assignedNurseType: typeof p.assignedNurse
          });
        });
      }
    }
    
    res.status(200).json({
      status: 1,
      patients,
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

// Export patients to CSV
exports.exportPatients = async (req, res) => {
  try {
    const { 
      search, 
      patientType, 
      department, 
      doctor, 
      startDate, 
      endDate
    } = req.query;
    
    const query = { hospitalId: req.user.hospitalId };
    
    // Apply ABAC filter if present
    if (req.abacFilter) {
      Object.assign(query, req.abacFilter);
    }
    
    // Apply same filters as search
    if (search) {
      query.$or = [
        { patientId: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }
    
    if (patientType) query.type = patientType;
    if (department) query.department = department;
    if (doctor) query.assignedDoctor = doctor;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const patients = await Patient.find(query)
      .populate("assignedDoctor", "firstName lastName")
      .sort({ createdAt: -1 });
    
    // Convert to CSV
    const csvHeader = "Patient ID,Name,DOB,Gender,Phone,Email,Blood Group,Type,Department,Assigned Doctor,Address,Registered Date\n";
    const csvRows = patients.map(p => {
      const doctorName = p.assignedDoctor 
        ? `${p.assignedDoctor.firstName} ${p.assignedDoctor.lastName}` 
        : "";
      const address = p.address 
        ? `${p.address.street || ""}, ${p.address.city || ""}, ${p.address.state || ""} ${p.address.zipCode || ""}`.trim()
        : "";
      const dob = p.dob ? new Date(p.dob).toLocaleDateString() : "";
      const regDate = p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "";
      
      return [
        p.patientId || "",
        `"${p.name || ""}"`,
        dob,
        p.gender || "",
        p.phone || "",
        p.email || "",
        p.bloodGroup || "",
        p.type || "",
        p.department || "",
        `"${doctorName}"`,
        `"${address}"`,
        regDate
      ].join(",");
    }).join("\n");
    
    const csv = csvHeader + csvRows;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=patients.csv');
    res.status(200).send(csv);
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

// Get patient by ID
exports.getPatientById = async (req, res) => {
  try {
    const query = { 
      _id: req.params.id, 
      hospitalId: req.user.hospitalId 
    };
    
    // Apply ABAC filter if present
    if (req.abacFilter) {
      Object.assign(query, req.abacFilter);
    }
    
    const patient = await Patient.findOne(query)
      .populate("assignedDoctor", "firstName lastName email specialization")
      .populate("assignedNurse", "firstName lastName email");
    
    if (!patient) {
      return res.status(404).json({ status: 0, message: "Patient not found" });
    }
    
    res.status(200).json({ status: 1, patient });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

// Update patient by ID
exports.updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, dob, gender, phone, email, bloodGroup, type, 
      assignedDoctor, assignedNurse, address, emergencyContact, 
      photo, department 
    } = req.body;
    
    const query = { 
      _id: id, 
      hospitalId: req.user.hospitalId 
    };
    
    // Apply ABAC filter if present
    if (req.abacFilter) {
      Object.assign(query, req.abacFilter);
    }
    
    const patient = await Patient.findOne(query);
    
    if (!patient) {
      return res.status(404).json({ status: 0, message: "Patient not found" });
    }
    
    // Update fields
    if (name) patient.name = name;
    if (dob) patient.dob = dob;
    if (gender) patient.gender = gender;
    if (phone) patient.phone = phone;
    if (email !== undefined) patient.email = email;
    if (bloodGroup !== undefined) patient.bloodGroup = bloodGroup;
    if (type) patient.type = type;
    if (assignedDoctor !== undefined) {
      if (assignedDoctor && assignedDoctor !== 'null' && assignedDoctor !== '') {
        if (typeof assignedDoctor === 'string' && mongoose.Types.ObjectId.isValid(assignedDoctor)) {
          patient.assignedDoctor = new mongoose.Types.ObjectId(assignedDoctor);
        } else {
          patient.assignedDoctor = assignedDoctor;
        }
      } else {
        patient.assignedDoctor = null;
      }
    }
    if (assignedNurse !== undefined) {
      if (assignedNurse && assignedNurse !== 'null' && assignedNurse !== '') {
        if (typeof assignedNurse === 'string' && mongoose.Types.ObjectId.isValid(assignedNurse)) {
          patient.assignedNurse = new mongoose.Types.ObjectId(assignedNurse);
        } else {
          patient.assignedNurse = assignedNurse;
        }
      } else {
        patient.assignedNurse = null;
      }
    }
    if (address) patient.address = address;
    if (emergencyContact) patient.emergencyContact = emergencyContact;
    if (photo !== undefined) patient.photo = photo;
    if (department !== undefined) patient.department = department;
    
    await patient.save();
    
    // Populate before returning
    await patient.populate("assignedDoctor", "firstName lastName email specialization");
    await patient.populate("assignedNurse", "firstName lastName email");
    
    res.status(200).json({ 
      status: 1, 
      message: "Patient updated successfully",
      patient 
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};
