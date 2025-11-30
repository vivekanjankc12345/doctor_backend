const { resolveUserPermissions } = require("../utils/permissionResolver");

module.exports = function (...requiredPermissions) {
  // Ensure we have required permissions
  if (!requiredPermissions || requiredPermissions.length === 0) {
    throw new Error('Permission middleware requires at least one permission');
  }

  return async (req, res, next) => {
    // Ensure next is a function
    if (typeof next !== 'function') {
      console.error('Permission middleware: next is not a function', typeof next);
      console.error('Permission middleware: req.method', req.method);
      console.error('Permission middleware: req.url', req.url);
      return res.status(500).json({ status: 0, error: 'Internal server error: middleware chain broken' });
    }

    try {
      if (!req.user || !req.user.roles || req.user.roles.length === 0) {
        return res.status(403).json({ status: 0, message: "No role assigned" });
      }

      // Resolve all permissions including inherited ones from parent roles
      const userPermissions = await resolveUserPermissions(req.user.roles);

      // Check if user has ALL:ALL permission (SUPER_ADMIN)
      if (userPermissions && userPermissions.has("ALL:ALL")) {
        return next();
      }

      // Check if user has at least one of the required permissions
      const allowed = requiredPermissions.some(p => userPermissions && userPermissions.has(p));

      if (!allowed) {
        return res.status(403).json({ 
          status: 0, 
          message: "Permission denied. Required: " + requiredPermissions.join(", ") 
        });
      }

      return next();

    } catch (err) {
      console.error('Permission middleware error:', err);
      // If next is available, pass error to error handler, otherwise send response
      if (typeof next === 'function') {
        return next(err);
      }
      return res.status(500).json({ status: 0, error: err.message });
    }
  };
};
