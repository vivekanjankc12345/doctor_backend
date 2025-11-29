const router = require("express").Router();
const { createPrescription, getPrescriptions, getPrescriptionById, getTemplates } = require("../controllers/prescription.controller");
const auth = require("../middlewares/auth.middleware");
const tenant = require("../middlewares/tenant.middleware");
const permission = require("../middlewares/permission.middleware");
const abac = require("../middlewares/abac.middleware");

router.post("/create", auth, tenant, permission("PRESCRIPTION:CREATE"), createPrescription);
router.get("/list", auth, tenant, permission("PRESCRIPTION:READ"), abac("PRESCRIPTION", "READ"), getPrescriptions);
router.get("/templates", auth, tenant, permission("PRESCRIPTION:CREATE"), getTemplates);
router.get("/:id", auth, tenant, permission("PRESCRIPTION:READ"), abac("PRESCRIPTION", "READ"), getPrescriptionById);

module.exports = router;
