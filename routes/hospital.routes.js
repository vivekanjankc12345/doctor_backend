const router = require("express").Router();
const {
  registerHospital,
  verifyHospital,
} = require("../controllers/hospital.controller");

router.post("/register", registerHospital);
router.get("/verify/:tenantId/:token", verifyHospital);

module.exports = router;
