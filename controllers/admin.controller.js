const Hospital = require("../models/hospital.model");
const createTenantDB = require("../utils/createTenantDB");

const {
  sendHospitalCredentials,
  sendHospitalStatusMail
} = require("../services/mail.service");

exports.getAllHospitals = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const search = req.query.search;

    // Build query object
    const query = {};
    
    if (status) {
      query.status = status;
    }

    // Add search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { licenseNumber: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } }
      ];
    }

    const hospitals = await Hospital.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Hospital.countDocuments(query);

    res.json({
      status: 1,
      data: {
        hospitals,
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

exports.getHospitalById = async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);

    if (!hospital) {
      return res.status(404).json({ status: 0, message: "Hospital not found" });
    }

    res.json({
      status: 1,
      data: { hospital }
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

exports.updateHospitalStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const validStatus = ["ACTIVE", "SUSPENDED", "INACTIVE"];

    if (!validStatus.includes(status)) {
      return res.status(400).json({
        status: 0,
        message: "Invalid status. Use ACTIVE, SUSPENDED or INACTIVE"
      });
    }

    const hospital = await Hospital.findById(req.params.id);

    if (!hospital)
      return res.status(404).json({ status: 0, message: "Hospital not found" });

    // ✅ Status transition rules:
    // PENDING → INACTIVE (reject) or VERIFIED (after email verification)
    // VERIFIED → ACTIVE (approve) or INACTIVE (reject)
    // ACTIVE → SUSPENDED (temporary) or INACTIVE (permanent)
    // SUSPENDED → ACTIVE (reactivate) or INACTIVE (permanent)

    // Prevent activating PENDING hospitals (must be VERIFIED first)
    if (hospital.status === "PENDING" && status === "ACTIVE") {
      return res.status(400).json({
        status: 0,
        message: "Hospital must be VERIFIED first. Please verify email before activation."
      });
    }

    // Allow Super Admin to reject PENDING hospitals by setting to INACTIVE
    if (hospital.status === "PENDING" && status === "INACTIVE") {
      // This is allowed - Super Admin rejecting a pending hospital
    }

    // Allow Super Admin to activate VERIFIED hospitals
    if (hospital.status === "VERIFIED" && status === "ACTIVE") {
      // This is allowed - Super Admin activating a verified hospital
    } else if (hospital.status === "VERIFIED" && status === "INACTIVE") {
      // This is allowed - Super Admin rejecting a verified hospital
    } else if (hospital.status === "VERIFIED" && status === "SUSPENDED") {
      return res.status(400).json({
        status: 0,
        message: "VERIFIED hospitals cannot be suspended. Activate first, then suspend if needed."
      });
    }

    // Store previous status
    const previousStatus = hospital.status;

    // Update status
    hospital.status = status;
    await hospital.save();

    console.log(`✅ Hospital ${hospital.name} status changed from ${previousStatus} to ${status}`);

    // ===== IF ACTIVE → Send activation notification =====
    if (status === "ACTIVE" && previousStatus === "VERIFIED") {
      // Hospital is being activated for the first time
      // Credentials were already sent during email verification
      // Just send activation notification
      console.log(`🎉 Hospital ${hospital.name} is now ACTIVE and ready to use`);
    }

    // ===== SEND STATUS EMAIL =====
    await sendHospitalStatusMail(hospital.email, status, hospital.name);

    res.json({
      status: 1,
      message: `✅ Hospital status updated to ${status}`,
      hospital: {
        id: hospital._id,
        name: hospital.name,
        email: hospital.email,
        status: hospital.status,
        tenantId: hospital.tenantId
      }
    });

  } catch (error) {
    console.error("Error updating hospital status:", error);
    res.status(500).json({ status: 0, error: error.message });
  }
};
