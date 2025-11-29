module.exports = function role(...allowedRoles) {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.roleObjects) {
        return res.status(403).json({ status: 0, message: "Role information missing" });
      }

      if (allowedRoles.length === 0) return next();

      // Extract role names, handling both string names and objects with name property
      const names = req.user.roleObjects.map(r => {
        if (typeof r === 'string') return r;
        if (r && typeof r === 'object' && r.name) return r.name;
        return null;
      }).filter(Boolean);

      // Check if user has at least one of the allowed roles
      const has = allowedRoles.some(ar => names.includes(ar));
      if (!has) {
        console.error('Role check failed:', {
          userRoles: names,
          allowedRoles: allowedRoles,
          roleObjects: req.user.roleObjects
        });
        return res.status(403).json({ 
          status: 0, 
          message: `Forbidden — insufficient role. Required: ${allowedRoles.join(' or ')}, User has: ${names.join(', ') || 'none'}` 
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};
