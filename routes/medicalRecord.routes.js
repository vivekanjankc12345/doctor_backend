const router = require("express").Router();
const auth = require("../middlewares/auth.middleware");
const tenant = require("../middlewares/tenant.middleware");
const permission = require("../middlewares/permission.middleware");

const {
  createMedicalRecord,
  getPatientMedicalRecords,
  getMedicalRecordById,
  updateMedicalRecord,
  getLatestMedicalRecord
} = require("../controllers/medicalRecord.controller");

// All routes require authentication and tenant context
router.use(auth);
router.use(tenant);

// Create medical record - requires MEDICAL_RECORD:CREATE permission (Doctor)
router.post("/create", permission("MEDICAL_RECORD:CREATE"), createMedicalRecord);

// Get all medical records for a patient - requires MEDICAL_RECORD:READ permission
router.get("/patient/:patientId", permission("MEDICAL_RECORD:READ"), getPatientMedicalRecords);

// Get latest medical record for a patient - requires MEDICAL_RECORD:READ permission
router.get("/patient/:patientId/latest", permission("MEDICAL_RECORD:READ"), getLatestMedicalRecord);

// Get single medical record - requires MEDICAL_RECORD:READ permission
router.get("/:id", permission("MEDICAL_RECORD:READ"), getMedicalRecordById);

// Update medical record - requires MEDICAL_RECORD:UPDATE permission
router.put("/:id", permission("MEDICAL_RECORD:UPDATE"), updateMedicalRecord);

module.exports = router;

