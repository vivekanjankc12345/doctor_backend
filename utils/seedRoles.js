const Role = require("../models/role.model");
const Permission = require("../models/permission.model");
const User = require("../models/user.model");
const bcrypt = require("bcryptjs");

/**
 * Seed all pre-defined roles with their permissions
 * Hierarchical structure: SUPER_ADMIN > HOSPITAL_ADMIN > DOCTOR/NURSE/PHARMACIST/RECEPTIONIST
 */
module.exports = async () => {
  try {
    console.log("🌱 Seeding roles and permissions...");

    // Define all permissions in RESOURCE:ACTION format
    const allPermissions = [
      // System permissions
      { name: "ALL:ALL", description: "All system operations" },
      
      // Dashboard
      { name: "DASHBOARD:VIEW", description: "View dashboard" },
      
      // Patient permissions
      { name: "PATIENT:CREATE", description: "Create new patient" },
      { name: "PATIENT:READ", description: "View patient information" },
      { name: "PATIENT:UPDATE", description: "Update patient information" },
      { name: "PATIENT:DELETE", description: "Delete patient" },
      
      // Prescription permissions
      { name: "PRESCRIPTION:CREATE", description: "Create prescription" },
      { name: "PRESCRIPTION:READ", description: "View prescription" },
      { name: "PRESCRIPTION:UPDATE", description: "Update prescription" },
      { name: "PRESCRIPTION:DELETE", description: "Delete prescription" },
      { name: "PRESCRIPTION:DISPENSE", description: "Dispense medication" },
      
      // Appointment permissions
      { name: "APPOINTMENT:CREATE", description: "Create appointment" },
      { name: "APPOINTMENT:READ", description: "View appointment" },
      { name: "APPOINTMENT:UPDATE", description: "Update appointment" },
      { name: "APPOINTMENT:DELETE", description: "Cancel appointment" },
      
      // User management permissions
      { name: "USER:CREATE", description: "Create user" },
      { name: "USER:READ", description: "View user" },
      { name: "USER:UPDATE", description: "Update user" },
      
      // Medical Record permissions
      { name: "MEDICAL_RECORD:CREATE", description: "Create medical record" },
      { name: "MEDICAL_RECORD:READ", description: "View medical record" },
      { name: "MEDICAL_RECORD:UPDATE", description: "Update medical record" },
      { name: "MEDICAL_RECORD:DELETE", description: "Delete medical record" },
      { name: "USER:DELETE", description: "Delete user" },
      
      // Role management permissions
      { name: "ROLE:CREATE", description: "Create custom role" },
      { name: "ROLE:READ", description: "View roles" },
      { name: "ROLE:UPDATE", description: "Update role" },
      { name: "ROLE:DELETE", description: "Delete role" },
      
      // Hospital configuration permissions
      { name: "HOSPITAL:CONFIGURE", description: "Configure hospital settings" },
      { name: "HOSPITAL:MANAGE_USERS", description: "Manage hospital users" },
      
      // Vitals permissions
      { name: "VITALS:CREATE", description: "Record patient vitals" },
      { name: "VITALS:READ", description: "View patient vitals" },
      { name: "VITALS:UPDATE", description: "Update patient vitals" },
    ];

    // Insert or get all permissions
    const permissionMap = {};
    for (const perm of allPermissions) {
      let permission = await Permission.findOne({ name: perm.name });
      if (!permission) {
        permission = await Permission.create(perm);
        console.log(`  ✅ Created permission: ${perm.name}`);
      }
      permissionMap[perm.name] = permission._id;
    }

    // Define roles with their permissions
    const rolesConfig = [
      {
        name: "SUPER_ADMIN",
        description: "Platform administrator",
        level: 1,
        permissions: ["ALL:ALL"],
        parentRole: null
      },
      {
        name: "HOSPITAL_ADMIN",
        description: "Hospital administrator - Tenant configuration, user management",
        level: 2,
        permissions: [
          "DASHBOARD:VIEW",
          "PATIENT:READ",
          "PATIENT:UPDATE",
          "PATIENT:DELETE",
          "PRESCRIPTION:READ",
          "APPOINTMENT:CREATE",
          "APPOINTMENT:READ",
          "APPOINTMENT:UPDATE",
          "APPOINTMENT:DELETE",
          "USER:CREATE",
          "USER:READ",
          "USER:UPDATE",
          "USER:DELETE",
          "ROLE:CREATE",
          "ROLE:READ",
          "ROLE:UPDATE",
          "ROLE:DELETE",
          "HOSPITAL:CONFIGURE",
          "HOSPITAL:MANAGE_USERS"
        ],
        parentRole: null // Will be set after SUPER_ADMIN is created
      },
      {
        name: "DOCTOR",
        description: "Medical practitioner - Patient management, prescriptions",
        level: 3,
        permissions: [
          "DASHBOARD:VIEW",
          "PATIENT:READ",
          "PATIENT:UPDATE",
          "PRESCRIPTION:CREATE",
          "PRESCRIPTION:READ",
          "PRESCRIPTION:UPDATE",
          "APPOINTMENT:CREATE",
          "APPOINTMENT:READ",
          "APPOINTMENT:UPDATE",
          "VITALS:CREATE",
          "VITALS:READ",
          "VITALS:UPDATE",
          "MEDICAL_RECORD:CREATE",
          "MEDICAL_RECORD:READ",
          "MEDICAL_RECORD:UPDATE"
        ],
        parentRole: "HOSPITAL_ADMIN"
      },
      {
        name: "NURSE",
        description: "Nursing staff - Patient care, vitals",
        level: 4,
        permissions: [
          "DASHBOARD:VIEW",
          "PATIENT:READ",
          "PRESCRIPTION:READ",
          "APPOINTMENT:READ",
          "VITALS:CREATE",
          "VITALS:READ",
          "MEDICAL_RECORD:CREATE",
          "MEDICAL_RECORD:READ",
          "VITALS:UPDATE"
        ],
        parentRole: "HOSPITAL_ADMIN"
      },
      {
        name: "PHARMACIST",
        description: "Pharmacy staff - Prescription view, dispensing, patient creation",
        level: 4,
        permissions: [
          "DASHBOARD:VIEW",
          "PATIENT:CREATE",
          "PATIENT:READ",
          "PRESCRIPTION:READ",
          "PRESCRIPTION:DISPENSE"
        ],
        parentRole: "HOSPITAL_ADMIN"
      },
      {
        name: "RECEPTIONIST",
        description: "Front desk - Patient registration, appointments",
        level: 4,
        permissions: [
          "DASHBOARD:VIEW",
          "PATIENT:CREATE",
          "PATIENT:READ",
          "PATIENT:UPDATE",
          "APPOINTMENT:CREATE",
          "APPOINTMENT:READ",
          "APPOINTMENT:UPDATE"
        ],
        parentRole: "HOSPITAL_ADMIN"
      }
    ];

    // Create roles
    const createdRoles = {};
    for (const roleConfig of rolesConfig) {
      let role = await Role.findOne({ name: roleConfig.name });
      
      if (!role) {
        // Get permission IDs
        const permissionIds = roleConfig.permissions.map(
          permName => permissionMap[permName]
        ).filter(Boolean);

        // Get parent role ID if specified
        let parentRoleId = null;
        if (roleConfig.parentRole && createdRoles[roleConfig.parentRole]) {
          parentRoleId = createdRoles[roleConfig.parentRole]._id;
        }

        role = await Role.create({
          name: roleConfig.name,
          description: roleConfig.description,
          level: roleConfig.level,
          permissions: permissionIds,
          parentRole: parentRoleId
        });

        console.log(`  ✅ Created role: ${roleConfig.name} (Level ${roleConfig.level})`);
      } else {
        // Update existing role to ensure it has correct permissions
        const permissionIds = roleConfig.permissions.map(
          permName => permissionMap[permName]
        ).filter(Boolean);

        let parentRoleId = null;
        if (roleConfig.parentRole) {
          const parentRole = await Role.findOne({ name: roleConfig.parentRole });
          if (parentRole) parentRoleId = parentRole._id;
        }

        role.permissions = permissionIds;
        role.description = roleConfig.description;
        role.level = roleConfig.level;
        role.parentRole = parentRoleId;
        await role.save();

        console.log(`  ✅ Updated role: ${roleConfig.name}`);
      }

      createdRoles[roleConfig.name] = role;
    }

    // Create SUPER_ADMIN user if it doesn't exist
    const superAdminRole = createdRoles["SUPER_ADMIN"];
    if (superAdminRole) {
      const existingSuperAdmin = await User.findOne({ 
        roles: superAdminRole._id 
      });
      
      if (!existingSuperAdmin) {
        const hashed = await bcrypt.hash("Super@123", 10);
        await User.create({
          firstName: "Super",
          lastName: "Admin",
          email: "super@hms.com",
          password: hashed,
          roles: [superAdminRole._id],
          hospitalId: null
        });
        console.log("  ✅ Created SUPER_ADMIN user (email: super@hms.com, password: Super@123)");
      }
    }

    console.log("✅ Role seeding completed!");
    return createdRoles;
  } catch (err) {
    console.error("❌ Error seeding roles:", err.message);
    throw err;
  }
};

