const router = require("express").Router();
const auth = require("../middlewares/auth.middleware");
const tenant = require("../middlewares/tenant.middleware");
const permission = require("../middlewares/permission.middleware");

const {
  recordVitals,
  getPatientVitals,
  getVitalById,
  updateVitals,
  getLatestVitals
} = require("../controllers/vital.controller");

// Record vitals - requires VITALS:CREATE permission (Nurse or Doctor)
router.post("/record", auth, tenant, permission("VITALS:CREATE"), recordVitals);

// Get all vitals for a patient - requires VITALS:READ permission
router.get("/patient/:patientId", auth, tenant, permission("VITALS:READ"), getPatientVitals);

// Get latest vitals for a patient - requires VITALS:READ permission
router.get("/patient/:patientId/latest", auth, tenant, permission("VITALS:READ"), getLatestVitals);

// Get single vital record - requires VITALS:READ permission
router.get("/:id", auth, tenant, permission("VITALS:READ"), getVitalById);

// Update vital record - requires VITALS:UPDATE permission
router.put("/:id", auth, tenant, permission("VITALS:UPDATE"), updateVitals);

module.exports = router;

