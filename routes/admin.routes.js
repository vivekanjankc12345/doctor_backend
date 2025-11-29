const router = require("express").Router();
const auth = require("../middlewares/auth.middleware");
const role = require("../middlewares/role.middleware");

const { 
  getAllHospitals,
  getHospitalById,
  updateHospitalStatus 
} = require("../controllers/admin.controller");

router.use(auth);
router.use(role("SUPER_ADMIN"));

router.get("/hospitals", getAllHospitals);
router.get("/hospitals/:id", getHospitalById);
router.put("/hospital/status/:id", updateHospitalStatus);

module.exports = router;
