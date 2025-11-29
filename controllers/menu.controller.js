const Role = require("../models/role.model");
const { resolveUserPermissions } = require("../utils/permissionResolver");

/**
 * Get dynamic menu structure based on user's roles and permissions
 * Includes inherited permissions from parent roles
 */
exports.getMenu = async (req, res) => {
  try {
    if (!req.user || !req.user.roles || req.user.roles.length === 0) {
      return res.status(403).json({ status: 0, message: "No roles assigned" });
    }

    // Get all roles with permissions (for display)
    const roles = await Role.find({
      _id: { $in: req.user.roles }
    }).populate("permissions").populate("parentRole");

    // Resolve all permissions including inherited ones from parent roles
    const userPermissions = await resolveUserPermissions(req.user.roles);

    // Define menu structure
    const menuStructure = {
      Dashboard: {
        permission: "DASHBOARD:VIEW",
        icon: "dashboard",
        path: "/dashboard"
      },
      Patients: {
        permission: "PATIENT:READ",
        icon: "people",
        path: "/patients",
        children: {
          "Register Patient": {
            permission: "PATIENT:CREATE",
            path: "/patients/register"
          },
          "OPD Patients": {
            permission: "PATIENT:READ",
            path: "/patients/opd"
          },
          "IPD Patients": {
            permission: "PATIENT:READ",
            path: "/patients/ipd"
          },
          "Search Patients": {
            permission: "PATIENT:READ",
            path: "/patients/search"
          }
        }
      },
      Appointments: {
        permission: "APPOINTMENT:READ",
        icon: "calendar",
        path: "/appointments",
        children: {
          "Book Appointment": {
            permission: "APPOINTMENT:CREATE",
            path: "/appointments/book"
          },
          "View Appointments": {
            permission: "APPOINTMENT:READ",
            path: "/appointments"
          }
        }
      },
      Prescriptions: {
        permission: "PRESCRIPTION:READ",
        icon: "prescription",
        path: "/prescriptions",
        children: {
          "Create Prescription": {
            permission: "PRESCRIPTION:CREATE",
            path: "/prescriptions/create"
          },
          "View Prescriptions": {
            permission: "PRESCRIPTION:READ",
            path: "/prescriptions"
          }
        }
      },
      Users: {
        permission: "USER:READ",
        icon: "users",
        path: "/users",
        children: {
          "Create User": {
            permission: "USER:CREATE",
            path: "/users/create"
          },
          "Manage Users": {
            permission: "USER:READ",
            path: "/users"
          }
        }
      },
      Settings: {
        permission: "SETTINGS:VIEW",
        icon: "settings",
        path: "/settings"
      }
    };

    // Filter menu based on permissions
    const filterMenu = (menu) => {
      const filtered = {};
      
      for (const [key, value] of Object.entries(menu)) {
        const hasPermission = !value.permission || userPermissions.has(value.permission);
        
        if (hasPermission) {
          const menuItem = {
            label: key,
            icon: value.icon,
            path: value.path
          };
          
          // Recursively filter children
          if (value.children) {
            const filteredChildren = filterMenu(value.children);
            if (Object.keys(filteredChildren).length > 0) {
              menuItem.children = filteredChildren;
            }
          }
          
          // Only add if has permission or has visible children
          if (hasPermission || (value.children && Object.keys(menuItem.children || {}).length > 0)) {
            filtered[key] = menuItem;
          }
        }
      }
      
      return filtered;
    };

    const filteredMenu = filterMenu(menuStructure);

    res.status(200).json({
      status: 1,
      menu: filteredMenu,
      permissions: Array.from(userPermissions),
      roles: roles.map(r => r.name)
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

