const router = require("express").Router();
const auth = require("../middlewares/auth.middleware");
const role = require("../middlewares/role.middleware");
const permission = require("../middlewares/permission.middleware");

const {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getAllPermissions,
  getUserPermissions
} = require("../controllers/role.controller");

// All routes require authentication
router.use(auth);

// Get all permissions (available to all authenticated users)
router.get("/permissions", getAllPermissions);

// Get user's effective permissions
router.get("/user/:userId/permissions", getUserPermissions);

// Get all roles - available to all authenticated users (for dropdowns, etc.)
// Only SUPER_ADMIN and HOSPITAL_ADMIN can see full details, others see basic list
router.get("/", getAllRoles);
router.get("/:id", permission("ROLE:READ"), getRoleById);

// Create role - require ROLE:CREATE permission
router.post("/", permission("ROLE:CREATE"), createRole);

// Update role - require ROLE:UPDATE permission
router.put("/:id", permission("ROLE:UPDATE"), updateRole);

// Delete role - require ROLE:DELETE permission
router.delete("/:id", permission("ROLE:DELETE"), deleteRole);

module.exports = router;

