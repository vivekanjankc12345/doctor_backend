const Hospital = require("../models/hospital.model");

module.exports = async function tenant(req, res, next) {
  try {
    // Get hospitalId from user (set by auth middleware) or from request
    // Auth middleware sets both req.user.hospitalId and req.hospitalId
    const hospitalId = req.hospitalId || req.user?.hospitalId || (req.body && req.body.hospitalId) || req.headers["x-hospital-id"];
    if (!hospitalId) {
      return res.status(400).json({ status: 0, message: "Tenant (hospitalId) is required" });
    }

    const hospital = await Hospital.findById(hospitalId).select("status name tenantId");
    if (!hospital) {
      return res.status(404).json({ status: 0, message: "Hospital (tenant) not found" });
    }
    // Allow both ACTIVE and VERIFIED hospitals (same as login and auth middleware)
    if (hospital.status !== "ACTIVE" && hospital.status !== "VERIFIED") {
      return res.status(403).json({ status: 0, message: `Tenant is not active (${hospital.status})` });
    }

    req.tenant = { id: hospital._id, name: hospital.name, tenantId: hospital.tenantId };
    next();
  } catch (error) {
    next(error);
  }
};
