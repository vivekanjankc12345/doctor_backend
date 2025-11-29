const Role = require("../models/role.model");
const Permission = require("../models/permission.model");
const { resolveRolePermissions, resolveUserPermissions } = require("../utils/permissionResolver");

/**
 * Get all roles (with pagination)
 * SUPER_ADMIN and HOSPITAL_ADMIN can view all roles
 */
exports.getAllRoles = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const roles = await Role.find()
      .populate("permissions", "name description")
      .populate("parentRole", "name description level")
      .sort({ level: 1, name: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Role.countDocuments();

    res.json({
      status: 1,
      data: {
        roles,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

/**
 * Get a single role by ID
 */
exports.getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id)
      .populate("permissions", "name description")
      .populate("parentRole", "name description level");

    if (!role) {
      return res.status(404).json({ status: 0, message: "Role not found" });
    }

    // Resolve all permissions including inherited ones
    const allPermissions = await resolveRolePermissions(role);

    res.json({
      status: 1,
      data: {
        role: {
          ...role.toObject(),
          allPermissions: Array.from(allPermissions)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

/**
 * Create a custom role
 * Only SUPER_ADMIN and HOSPITAL_ADMIN can create roles
 */
exports.createRole = async (req, res) => {
  try {
    const { name, description, level, permissions, parentRole } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ status: 0, message: "Role name is required" });
    }

    // Check if role already exists
    const existingRole = await Role.findOne({ name: name.toUpperCase() });
    if (existingRole) {
      return res.status(400).json({ status: 0, message: "Role already exists" });
    }

    // Validate permissions format and existence
    if (permissions && Array.isArray(permissions)) {
      const permissionDocs = await Permission.find({ 
        name: { $in: permissions } 
      });
      
      if (permissionDocs.length !== permissions.length) {
        return res.status(400).json({ 
          status: 0, 
          message: "One or more permissions are invalid" 
        });
      }
    }

    // Validate parent role if provided
    let parentRoleId = null;
    if (parentRole) {
      const parent = await Role.findById(parentRole);
      if (!parent) {
        return res.status(400).json({ status: 0, message: "Parent role not found" });
      }
      parentRoleId = parent._id;
    }

    // Get permission IDs
    let permissionIds = [];
    if (permissions && Array.isArray(permissions)) {
      const permissionDocs = await Permission.find({ name: { $in: permissions } });
      permissionIds = permissionDocs.map(p => p._id);
    }

    // Determine level if not provided
    let roleLevel = level;
    if (!roleLevel && parentRoleId) {
      const parent = await Role.findById(parentRoleId);
      roleLevel = parent ? parent.level + 1 : 4;
    }
    if (!roleLevel) {
      roleLevel = 4; // Default level for custom roles
    }

    const role = await Role.create({
      name: name.toUpperCase(),
      description,
      level: roleLevel,
      permissions: permissionIds,
      parentRole: parentRoleId
    });

    const populatedRole = await Role.findById(role._id)
      .populate("permissions", "name description")
      .populate("parentRole", "name description level");

    res.status(201).json({
      status: 1,
      message: "Role created successfully",
      data: { role: populatedRole }
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

/**
 * Update a role
 * Cannot update pre-defined roles (SUPER_ADMIN, HOSPITAL_ADMIN, etc.)
 */
exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { description, permissions, parentRole } = req.body;

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ status: 0, message: "Role not found" });
    }

    // Prevent updating pre-defined roles (except description)
    const predefinedRoles = [
      "SUPER_ADMIN",
      "HOSPITAL_ADMIN",
      "DOCTOR",
      "NURSE",
      "PHARMACIST",
      "RECEPTIONIST"
    ];

    if (predefinedRoles.includes(role.name)) {
      // Only allow description update for predefined roles
      if (description !== undefined) {
        role.description = description;
        await role.save();
        return res.json({
          status: 1,
          message: "Role description updated",
          data: { role }
        });
      }
      return res.status(403).json({
        status: 0,
        message: "Cannot modify pre-defined roles"
      });
    }

    // Update description
    if (description !== undefined) {
      role.description = description;
    }

    // Update permissions
    if (permissions && Array.isArray(permissions)) {
      const permissionDocs = await Permission.find({ 
        name: { $in: permissions } 
      });
      
      if (permissionDocs.length !== permissions.length) {
        return res.status(400).json({ 
          status: 0, 
          message: "One or more permissions are invalid" 
        });
      }
      
      role.permissions = permissionDocs.map(p => p._id);
    }

    // Update parent role
    if (parentRole !== undefined) {
      if (parentRole === null) {
        role.parentRole = null;
      } else {
        const parent = await Role.findById(parentRole);
        if (!parent) {
          return res.status(400).json({ status: 0, message: "Parent role not found" });
        }
        // Prevent circular reference
        if (parent._id.toString() === id) {
          return res.status(400).json({ 
            status: 0, 
            message: "Role cannot be its own parent" 
          });
        }
        role.parentRole = parent._id;
      }
    }

    await role.save();

    const updatedRole = await Role.findById(role._id)
      .populate("permissions", "name description")
      .populate("parentRole", "name description level");

    res.json({
      status: 1,
      message: "Role updated successfully",
      data: { role: updatedRole }
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

/**
 * Delete a role
 * Cannot delete pre-defined roles
 */
exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ status: 0, message: "Role not found" });
    }

    // Prevent deleting pre-defined roles
    const predefinedRoles = [
      "SUPER_ADMIN",
      "HOSPITAL_ADMIN",
      "DOCTOR",
      "NURSE",
      "PHARMACIST",
      "RECEPTIONIST"
    ];

    if (predefinedRoles.includes(role.name)) {
      return res.status(403).json({
        status: 0,
        message: "Cannot delete pre-defined roles"
      });
    }

    // Check if any users have this role
    const User = require("../models/user.model");
    const usersWithRole = await User.find({ roles: id });
    
    if (usersWithRole.length > 0) {
      return res.status(400).json({
        status: 0,
        message: `Cannot delete role. ${usersWithRole.length} user(s) are assigned this role. Please reassign users first.`
      });
    }

    await Role.findByIdAndDelete(id);

    res.json({
      status: 1,
      message: "Role deleted successfully"
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

/**
 * Get all permissions
 */
exports.getAllPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find().sort({ name: 1 });

    res.json({
      status: 1,
      data: { permissions }
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

/**
 * Get user's effective permissions (including inherited)
 */
exports.getUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;

    const User = require("../models/user.model");
    const user = await User.findById(userId).populate("roles");

    if (!user) {
      return res.status(404).json({ status: 0, message: "User not found" });
    }

    const permissions = await resolveUserPermissions(user.roles);

    res.json({
      status: 1,
      data: {
        userId: user._id,
        roles: user.roles.map(r => ({
          id: r._id,
          name: r.name,
          description: r.description
        })),
        permissions: Array.from(permissions).sort()
      }
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

