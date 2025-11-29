const Hospital = require("../models/hospital.model");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const createTenantDB = require("../utils/createTenantDB");
const createTenantAdmin = require("../utils/createTenantAdmin");
const {
  sendHospitalVerification,
  sendHospitalCredentials,
} = require("../services/mail.service");
const Role = require("../models/role.model");

exports.registerHospital = async (req, res) => {
  try {
    const { name, address, phone, email, licenseNumber } = req.body;

    // Check if license already exists
    const exists = await Hospital.findOne({ licenseNumber });
    if (exists)
      return res.status(400).json({ status: 0, message: "License already registered" });

    const tenantId = `hms_${uuidv4().slice(0, 8)}`;
    const token = crypto.randomBytes(32).toString("hex");

    // Create hospital in main DB with PENDING status
    const hospital = await Hospital.create({
      name,
      address,
      phone,
      email,
      licenseNumber,
      tenantId,
      status: "PENDING", // ✅ Explicitly set to PENDING - requires email verification
      verificationToken: token,
      tokenExpiry: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });

    console.log(`📝 Hospital ${name} registered with status: PENDING`);

    // Create tenant database connection
    const tenantConnection = await createTenantDB(tenantId);

    // Find or create HOSPITAL_ADMIN role in main DB
    let hospitalAdminRole = await Role.findOne({ name: "HOSPITAL_ADMIN" });
    if (!hospitalAdminRole) {
      hospitalAdminRole = await Role.create({
        name: "HOSPITAL_ADMIN",
        level: 2,
        permissions: [],
      });
    }

    // Create admin user in tenant DB
    // Note: Admin credentials will be sent via email during verification
    await createTenantAdmin(
      tenantConnection,
      hospital,
      hospitalAdminRole._id
    );

    // Send verification email
    const link = `${process.env.BACKEND_URL}/api/hospital/verify/${tenantId}/${token}`;
    await sendHospitalVerification(email, link);

    console.log(`📧 Verification email sent to ${email}`);

    res.status(201).json({
      status: 1,
      message: "Hospital registered successfully. Verification email has been sent to your registered email address.",
      tenantId,
      hospitalStatus: "PENDING",
      note: "Please check your email and click the verification link to verify your email. After verification, your hospital status will be VERIFIED. Login credentials will be sent to your email after verification. Then it will be activated (ACTIVE) by the administrator."
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 0, error: err.message });
  }
};

exports.verifyHospital = async (req, res) => {
  try {
    const { token, tenantId } = req.params;

    // Find hospital with valid token
    const hospital = await Hospital.findOne({
      verificationToken: token,
      tokenExpiry: { $gt: Date.now() },
    });

    if (!hospital) {
      return res.status(400).send(
        "<h1>❌ Invalid or expired link</h1>" +
        "<p>The verification link is invalid or has expired. Please contact support.</p>"
      );
    }

    // Check if already verified
    if (hospital.status === "VERIFIED" || hospital.status === "ACTIVE") {
      return res.send(
        "<h1>✅ Already Verified</h1>" +
        "<p>This hospital has already been verified. You can now login with your credentials.</p>"
      );
    }

    // Update status to VERIFIED (not ACTIVE yet - requires email verification)
    hospital.verificationToken = null;
    hospital.tokenExpiry = null;
    hospital.status = "VERIFIED"; // ✅ Changed from ACTIVE to VERIFIED
    await hospital.save();

    console.log(`✅ Hospital ${hospital.name} (${hospital.email}) email verified. Status: VERIFIED`);

    // Use tenant connection for this hospital
    const tenantConnection = await createTenantDB(tenantId);
    const User = tenantConnection.model("User");

    // Get role from main DB
    const Role = require("../models/role.model");
    const hospitalAdminRole = await Role.findOne({ name: "HOSPITAL_ADMIN" });

    // Query using correct field
    const admin = await User.findOne({
      roles: hospitalAdminRole._id,
    }).select("+password").lean();

    if (!admin) {
      return res
        .status(500)
        .send("<h1>❌ Admin not found in tenant database</h1>");
    }

    // Send admin credentials email
    await sendHospitalCredentials(hospital.email, admin.email);

    res.send(
      "<h1>✅ Email Verified Successfully</h1>" +
      "<p>Your hospital email has been verified. Login credentials have been sent to your registered email.</p>" +
      "<p><strong>Note:</strong> Your hospital status is now VERIFIED. It will be activated (ACTIVE) by the system administrator.</p>" +
      "<p>You can check your email for login credentials.</p>"
    );
  } catch (error) {
    console.error("Hospital verification error:", error);
    res.status(500).send(`<h1>❌ ${error.message}</h1>`);
  }
};
