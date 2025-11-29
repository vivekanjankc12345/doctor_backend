const router = require("express").Router();
const { login, refreshToken, logout, forgotPassword, resetPassword, changePassword } = require("../controllers/auth.controller");
const auth = require("../middlewares/auth.middleware");

router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/change-password", auth, changePassword);
router.get("/refresh", refreshToken);
router.post("/logout", logout);

module.exports = router;
