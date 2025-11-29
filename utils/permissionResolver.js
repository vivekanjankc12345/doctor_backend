const Role = require("../models/role.model");

/**
 * Resolves all permissions for a role including inherited permissions from parent roles
 * @param {Object|String} role - Role document or role ID
 * @returns {Promise<Set<String>>} Set of permission names
 */
async function resolveRolePermissions(role) {
  const permissionSet = new Set();
  
  // If role is an ID, fetch the role
  if (typeof role === 'string' || role._id) {
    const roleId = typeof role === 'string' ? role : role._id;
    role = await Role.findById(roleId).populate('permissions').populate('parentRole');
  }

  if (!role) return permissionSet;

  // Add direct permissions
  if (role.permissions && Array.isArray(role.permissions)) {
    role.permissions.forEach(permission => {
      if (typeof permission === 'object' && permission.name) {
        permissionSet.add(permission.name);
      } else if (typeof permission === 'string') {
        permissionSet.add(permission);
      }
    });
  }

  // If role has ALL:ALL permission, return early (no need to check parent)
  if (permissionSet.has('ALL:ALL')) {
    return permissionSet;
  }

  // Recursively get permissions from parent role
  if (role.parentRole) {
    const parentPermissions = await resolveRolePermissions(role.parentRole);
    parentPermissions.forEach(perm => permissionSet.add(perm));
  }

  return permissionSet;
}

/**
 * Resolves all permissions for multiple roles (user can have multiple roles)
 * @param {Array<String|Object>} roleIds - Array of role IDs or role documents
 * @returns {Promise<Set<String>>} Set of all unique permission names
 */
async function resolveUserPermissions(roleIds) {
  const allPermissions = new Set();

  if (!roleIds || roleIds.length === 0) {
    return allPermissions;
  }

  // Resolve permissions for each role
  for (const roleId of roleIds) {
    const rolePermissions = await resolveRolePermissions(roleId);
    rolePermissions.forEach(perm => allPermissions.add(perm));
  }

  return allPermissions;
}

/**
 * Check if a user has a specific permission
 * @param {Array<String|Object>} roleIds - Array of role IDs
 * @param {String|Array<String>} requiredPermissions - Single permission or array of permissions
 * @returns {Promise<Boolean>} True if user has at least one of the required permissions
 */
async function hasPermission(roleIds, requiredPermissions) {
  const userPermissions = await resolveUserPermissions(roleIds);
  
  const required = Array.isArray(requiredPermissions) 
    ? requiredPermissions 
    : [requiredPermissions];

  // Check if user has ALL:ALL permission
  if (userPermissions.has('ALL:ALL')) {
    return true;
  }

  // Check if user has at least one of the required permissions
  return required.some(perm => userPermissions.has(perm));
}

module.exports = {
  resolveRolePermissions,
  resolveUserPermissions,
  hasPermission
};

