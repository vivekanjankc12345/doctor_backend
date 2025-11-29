const router = require("express").Router();
const { createUser, getCurrentUser, updateProfile, getAllUsers, updateUser, deleteUser, getUserById, getDoctors, getNurses, getDashboardStats } = require("../controllers/user.controller");
const auth = require("../middlewares/auth.middleware");
const tenant = require("../middlewares/tenant.middleware");
const role = require("../middlewares/role.middleware");

// User profile routes (available to all authenticated users)
router.get("/profile", auth, getCurrentUser);
router.put("/profile", auth, updateProfile);

// Get doctors list (available to RECEPTIONIST, HOSPITAL_ADMIN, SUPER_ADMIN)
router.get("/doctors", auth, tenant, role("RECEPTIONIST", "HOSPITAL_ADMIN", "SUPER_ADMIN"), getDoctors);

// Get nurses list (available to DOCTOR, HOSPITAL_ADMIN, SUPER_ADMIN)
router.get("/nurses", auth, tenant, role("DOCTOR", "HOSPITAL_ADMIN", "SUPER_ADMIN"), getNurses);

// Get dashboard statistics (available to HOSPITAL_ADMIN)
router.get("/dashboard/stats", auth, tenant, role("HOSPITAL_ADMIN", "SUPER_ADMIN"), getDashboardStats);

// Get all users with pagination and search (requires HOSPITAL_ADMIN or SUPER_ADMIN role)
router.get("/", auth, role("HOSPITAL_ADMIN","SUPER_ADMIN"), getAllUsers);

// Get user by ID (requires HOSPITAL_ADMIN or SUPER_ADMIN role)
router.get("/:id", auth, role("HOSPITAL_ADMIN","SUPER_ADMIN"), getUserById);

// Create user (requires HOSPITAL_ADMIN or SUPER_ADMIN role)
router.post("/create", auth, tenant, role("HOSPITAL_ADMIN","SUPER_ADMIN"), createUser);

// Update user by ID (requires HOSPITAL_ADMIN or SUPER_ADMIN role)
router.put("/:id", auth, role("HOSPITAL_ADMIN","SUPER_ADMIN"), updateUser);

// Delete user by ID (requires HOSPITAL_ADMIN or SUPER_ADMIN role)
router.delete("/:id", auth, role("HOSPITAL_ADMIN","SUPER_ADMIN"), deleteUser);

module.exports = router;
