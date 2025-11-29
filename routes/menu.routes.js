const router = require("express").Router();
const { getMenu } = require("../controllers/menu.controller");
const auth = require("../middlewares/auth.middleware");

router.get("/", auth, getMenu);

module.exports = router;

