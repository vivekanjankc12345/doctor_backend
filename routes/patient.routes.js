const router = require("express").Router();
const { createPatient, searchPatients, exportPatients, getPatientById, updatePatient } = require("../controllers/patient.controller");
const auth = require("../middlewares/auth.middleware");
const tenant = require("../middlewares/tenant.middleware");
const permission = require("../middlewares/permission.middleware");
const role = require("../middlewares/role.middleware");
const abac = require("../middlewares/abac.middleware");

// Only RECEPTIONIST can create patients
router.post("/create", auth, tenant, role("RECEPTIONIST"), createPatient);
// DOCTOR, HOSPITAL_ADMIN, and RECEPTIONIST can view patients
router.get("/search", auth, tenant, permission("PATIENT:READ"), abac("PATIENT", "READ"), searchPatients);
router.get("/export", auth, tenant, permission("PATIENT:READ"), abac("PATIENT", "READ"), exportPatients);
router.get("/:id", auth, tenant, permission("PATIENT:READ"), abac("PATIENT", "READ"), getPatientById);
// DOCTOR and HOSPITAL_ADMIN can update patients (for assigning nurses, etc.)
router.put("/:id", auth, tenant, permission("PATIENT:UPDATE"), abac("PATIENT", "UPDATE"), updatePatient);

module.exports = router;
