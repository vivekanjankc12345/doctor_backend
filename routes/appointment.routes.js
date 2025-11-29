const router = require("express").Router();
const { createAppointment } = require("../controllers/appointment.controller");
const auth = require("../middlewares/auth.middleware");
const tenant = require("../middlewares/tenant.middleware");
const permission = require("../middlewares/permission.middleware");

router.post("/create", auth, tenant, permission("APPOINTMENT:CREATE"), createAppointment);

module.exports = router;
