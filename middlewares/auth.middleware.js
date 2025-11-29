const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/user.model");
const Hospital = require("../models/hospital.model");
const createTenantDB = require("../utils/createTenantDB");
const Role = require("../models/role.model");

module.exports = async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ status: 0, message: "Authorization token missing" });
    }

    const token = authHeader.split(" ")[1];
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (err) {
      return res.status(401).json({ status: 0, message: "Invalid or expired token" });
    }

    let user = null;
    let hospitalId = payload.hospitalId || null;

    // First, check main database
    user = await User.findById(payload.id).select("firstName lastName email roles hospitalId").populate({
      path: 'roles',
      select: 'name description level permissions parentRole'
    });
    
    // If not found in main DB and hospitalId exists, check tenant database
    // Allow both ACTIVE and VERIFIED hospitals (same as login)
    if (!user && hospitalId) {
      try {
        const hospital = await Hospital.findById(hospitalId).select("tenantId status");
        if (hospital && (hospital.status === "ACTIVE" || hospital.status === "VERIFIED")) {
          const tenantConnection = await createTenantDB(hospital.tenantId);
          const TenantUser = tenantConnection.model("User");
          user = await TenantUser.findById(payload.id).select("firstName lastName email roles hospitalId");
          
          // Populate roles from main DB (roles are stored as ObjectIds in tenant DB)
          if (user && user.roles && user.roles.length > 0) {
            try {
              // Convert to ObjectIds if they're strings
              const roleIds = user.roles.map(r => {
                if (typeof r === 'string') {
                  return mongoose.Types.ObjectId.isValid(r) ? new mongoose.Types.ObjectId(r) : null;
                }
                return r;
              }).filter(Boolean);
              
              if (roleIds.length > 0) {
                const roleObjects = await Role.find({ _id: { $in: roleIds } }).select('name description level permissions parentRole');
                if (roleObjects && roleObjects.length > 0) {
                  user.roles = roleObjects; // Replace with populated roles
                  console.log(`✅ Populated ${roleObjects.length} role(s) for tenant user:`, roleObjects.map(r => r.name));
                } else {
                  console.warn(`⚠️ No roles found in main DB for role IDs:`, roleIds.map(id => id.toString()));
                  // Try to find HOSPITAL_ADMIN role and assign it if user email suggests they're an admin
                  if (user.email && user.email.includes('admin@')) {
                    console.log('🔄 Attempting to find HOSPITAL_ADMIN role for admin user...');
                    const hospitalAdminRole = await Role.findOne({ name: 'HOSPITAL_ADMIN' });
                    if (hospitalAdminRole) {
                      console.log('✅ Found HOSPITAL_ADMIN role, assigning to user');
                      user.roles = [hospitalAdminRole];
                      // Update user in tenant DB with correct role
                      try {
                        await TenantUser.findByIdAndUpdate(user._id, { 
                          roles: [hospitalAdminRole._id] 
                        });
                        console.log('✅ Updated user roles in tenant database');
                      } catch (updateErr) {
                        console.error('❌ Failed to update user roles in tenant DB:', updateErr.message);
                      }
                    }
                  }
                }
              } else {
                console.warn(`⚠️ No valid role IDs found for user:`, { userId: user._id, roles: user.roles });
              }
            } catch (roleErr) {
              console.error(`❌ Error populating roles for tenant user:`, roleErr.message, roleErr.stack);
            }
          } else {
            console.warn(`⚠️ Tenant user has no roles assigned:`, { userId: user?._id, email: user?.email, roles: user?.roles });
            // If user has admin@ email, try to assign HOSPITAL_ADMIN role
            if (user && user.email && user.email.includes('admin@')) {
              console.log('🔄 User has admin email but no roles, attempting to assign HOSPITAL_ADMIN...');
              try {
                const hospitalAdminRole = await Role.findOne({ name: 'HOSPITAL_ADMIN' });
                if (hospitalAdminRole) {
                  await TenantUser.findByIdAndUpdate(user._id, { 
                    roles: [hospitalAdminRole._id] 
                  });
                  user.roles = [hospitalAdminRole];
                  console.log('✅ Assigned HOSPITAL_ADMIN role to user');
                } else {
                  console.error('❌ HOSPITAL_ADMIN role not found in main database!');
                }
              } catch (assignErr) {
                console.error('❌ Failed to assign HOSPITAL_ADMIN role:', assignErr.message);
              }
            }
          }
        }
      } catch (err) {
        console.error(`Error loading tenant user:`, err.message);
      }
    }

    // If still not found, search all tenant databases (fallback)
    // Search both ACTIVE and VERIFIED hospitals (same as login allows)
    if (!user) {
      const hospitals = await Hospital.find({ status: { $in: ["ACTIVE", "VERIFIED"] } }).select("tenantId _id");
      for (const hospital of hospitals) {
        try {
          const tenantConnection = await createTenantDB(hospital.tenantId);
          const TenantUser = tenantConnection.model("User");
          const tenantUser = await TenantUser.findById(payload.id).select("firstName lastName email roles hospitalId");
          
          if (tenantUser) {
            user = tenantUser;
            hospitalId = hospital._id;
            
            // Populate roles from main DB
            if (user.roles && user.roles.length > 0) {
              try {
                // Convert to ObjectIds if they're strings
                const roleIds = user.roles.map(r => {
                  if (typeof r === 'string') {
                    return mongoose.Types.ObjectId.isValid(r) ? new mongoose.Types.ObjectId(r) : null;
                  }
                  return r;
                }).filter(Boolean);
                
                if (roleIds.length > 0) {
                  const roleObjects = await Role.find({ _id: { $in: roleIds } }).select('name description level permissions parentRole');
                  if (roleObjects && roleObjects.length > 0) {
                    user.roles = roleObjects;
                    console.log(`✅ Populated ${roleObjects.length} role(s) for tenant user (fallback):`, roleObjects.map(r => r.name));
                  } else {
                    console.warn(`⚠️ No roles found in main DB for role IDs (fallback):`, roleIds.map(id => id.toString()));
                    // Try to find HOSPITAL_ADMIN role and assign it if user email suggests they're an admin
                    if (user.email && user.email.includes('admin@')) {
                      console.log('🔄 Attempting to find HOSPITAL_ADMIN role for admin user (fallback)...');
                      const hospitalAdminRole = await Role.findOne({ name: 'HOSPITAL_ADMIN' });
                      if (hospitalAdminRole) {
                        console.log('✅ Found HOSPITAL_ADMIN role, assigning to user (fallback)');
                        user.roles = [hospitalAdminRole];
                        // Update user in tenant DB with correct role
                        try {
                          await TenantUser.findByIdAndUpdate(user._id, { 
                            roles: [hospitalAdminRole._id] 
                          });
                          console.log('✅ Updated user roles in tenant database (fallback)');
                        } catch (updateErr) {
                          console.error('❌ Failed to update user roles in tenant DB (fallback):', updateErr.message);
                        }
                      }
                    }
                  }
                } else {
                  console.warn(`⚠️ No valid role IDs found for user (fallback):`, { userId: user._id, roles: user.roles });
                }
              } catch (roleErr) {
                console.error(`❌ Error populating roles for tenant user (fallback):`, roleErr.message, roleErr.stack);
              }
            } else {
              console.warn(`⚠️ Tenant user has no roles assigned (fallback):`, { userId: user?._id, email: user?.email, roles: user?.roles });
              // If user has admin@ email, try to assign HOSPITAL_ADMIN role
              if (user && user.email && user.email.includes('admin@')) {
                console.log('🔄 User has admin email but no roles, attempting to assign HOSPITAL_ADMIN (fallback)...');
                try {
                  const hospitalAdminRole = await Role.findOne({ name: 'HOSPITAL_ADMIN' });
                  if (hospitalAdminRole) {
                    await TenantUser.findByIdAndUpdate(user._id, { 
                      roles: [hospitalAdminRole._id] 
                    });
                    user.roles = [hospitalAdminRole];
                    console.log('✅ Assigned HOSPITAL_ADMIN role to user (fallback)');
                  } else {
                    console.error('❌ HOSPITAL_ADMIN role not found in main database (fallback)!');
                  }
                } catch (assignErr) {
                  console.error('❌ Failed to assign HOSPITAL_ADMIN role (fallback):', assignErr.message);
                }
              }
            }
            break;
          }
        } catch (err) {
          console.error(`Error checking tenant ${hospital.tenantId}:`, err.message);
          continue;
        }
      }
    }

    if (!user) {
      console.error(`User not found for token payload:`, { id: payload.id, hospitalId: payload.hospitalId });
      return res.status(401).json({ status: 0, message: 'User not found. Please login again.' });
    }

    // Ensure roles is an array
    const roles = Array.isArray(user.roles) ? user.roles : [];
    
    // Debug logging
    console.log('🔍 Auth middleware - Role processing:', {
      userId: user._id,
      rolesCount: roles.length,
      rolesType: roles.map(r => typeof r),
      rolesSample: roles.slice(0, 2).map(r => {
        if (typeof r === 'object' && r !== null) {
          return { _id: r._id?.toString(), name: r.name, hasId: !!r._id, hasName: !!r.name };
        }
        return { type: typeof r, value: r?.toString() };
      })
    });
    
    // Filter to only include role objects with both _id and name properties
    const roleObjects = roles.filter(r => {
      const isValid = r && typeof r === 'object' && r._id && r.name;
      if (!isValid && r) {
        console.warn('⚠️ Invalid role object:', { 
          hasId: !!r._id, 
          hasName: !!r.name, 
          type: typeof r,
          keys: typeof r === 'object' ? Object.keys(r) : 'N/A'
        });
      }
      return isValid;
    });
    
    const roleIds = roleObjects.length > 0 
      ? roleObjects.map(r => r._id) 
      : (Array.isArray(user.roles) ? user.roles : []);
    
    // Log warning if roles are missing name property
    if (roles.length > 0 && roleObjects.length === 0) {
      console.error('❌ ERROR: User roles found but missing name property:', {
        userId: user._id,
        email: user.email,
        rolesCount: roles.length,
        roles: roles.map(r => ({ 
          hasId: !!r?._id, 
          hasName: !!r?.name, 
          type: typeof r,
          isObject: typeof r === 'object',
          isString: typeof r === 'string',
          value: r?.toString?.() || String(r)
        }))
      });
    }
    
    // Final logging
    if (roleObjects.length > 0) {
      console.log('✅ Final roleObjects:', roleObjects.map(r => ({ id: r._id.toString(), name: r.name })));
    } else {
      console.error('❌ ERROR: No valid roleObjects found for user:', {
        userId: user._id,
        email: user.email,
        hospitalId: hospitalId || user.hospitalId,
        rawRoles: user.roles,
        rolesArray: roles
      });
      
      // Last resort: Try to fetch roles directly from database if we have role IDs
      if (roleIds.length > 0 && roleObjects.length === 0) {
        console.log('🔄 Attempting last resort role fetch...');
        try {
          const lastResortRoles = await Role.find({ _id: { $in: roleIds } }).select('name description level permissions parentRole');
          if (lastResortRoles && lastResortRoles.length > 0) {
            console.log('✅ Last resort role fetch successful:', lastResortRoles.map(r => r.name));
            // Update roleObjects with the fetched roles
            roleObjects.push(...lastResortRoles);
          }
        } catch (lastResortErr) {
          console.error('❌ Last resort role fetch failed:', lastResortErr.message);
        }
      }
    }

    req.user = {
      id: user._id,
      roles: roleIds,
      roleObjects: roleObjects,
      hospitalId: hospitalId || user.hospitalId
    };
    req.userId = payload.id;
    req.hospitalId = req.user.hospitalId;

    next();
  } catch (error) {
    next(error);
  }
};
