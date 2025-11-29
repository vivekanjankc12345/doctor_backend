const User = require("../models/user.model");
const Hospital = require("../models/hospital.model");
const bcrypt = require("bcryptjs");
const createTenantDB = require("../utils/createTenantDB");
const { validatePassword } = require("../utils/passwordValidator");
const { generateUniqueUsername } = require("../utils/usernameGenerator");
const { sendWelcomeEmail } = require("../services/mail.service");

exports.createUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      roleIds,
      department,
      specialization,
    } = req.body;

    // Validate password policy
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        status: 0,
        message: "Password validation failed",
        errors: passwordValidation.errors,
      });
    }

    // Get hospital info for username generation
    let hospital = null;
    let hospitalEmail = null;

    if (req.user.hospitalId) {
      hospital = await Hospital.findById(req.user.hospitalId).select(
        "email name"
      );
      hospitalEmail = hospital ? hospital.email : null;
    }

    // Generate username
    const username = await generateUniqueUsername(
      User,
      firstName,
      lastName,
      hospitalEmail || email
    );

    // Hash password - IMPORTANT: Store hashed password in database
    const hashedPassword = await bcrypt.hash(password, 10);

    // Verify the hash was created correctly
    if (!hashedPassword || !hashedPassword.startsWith("$2")) {
      console.error("❌ Password hashing failed!");
      return res.status(500).json({
        status: 0,
        message: "Error hashing password. Please try again.",
      });
    }

    console.log(
      `✅ Password hashed successfully. Hash starts with: ${hashedPassword.substring(
        0,
        10
      )}`
    );

    // Prepare user data - STORE HASHED PASSWORD
    const userData = {
      firstName,
      lastName,
      email,
      username,
      phone,
      password: hashedPassword, // ✅ HASHED PASSWORD stored in database
      roles: roleIds,
      department,
      specialization,
      hospitalId: req.user.hospitalId,
      status: "ACTIVE",
      isActive: true,
      passwordHistory: [{ password: hashedPassword, changedAt: new Date() }],
      passwordChangedAt: new Date(),
    };

    let user;

    // If tenant exists (hospital user), create in tenant database
    if (req.tenant && req.tenant.tenantId) {
      const tenantConnection = await createTenantDB(req.tenant.tenantId);
      const TenantUser = tenantConnection.model("User");
      user = await TenantUser.create(userData);

      // Verify password was stored correctly
      const verifyUser = await TenantUser.findById(user._id)
        .select("+password")
        .lean();
      if (verifyUser && verifyUser.password) {
        const isHashed = verifyUser.password.startsWith("$2");
        console.log(
          `✅ User created in tenant DB. Password stored as hash: ${isHashed}`
        );
        if (!isHashed) {
          console.error(
            `❌ ERROR: Password was NOT hashed in tenant database for user ${email}!`
          );
        }
      }
    } else {
      // Create in main database (for super admin creating users)
      user = await User.create(userData);

      // Verify password was stored correctly
      const verifyUser = await User.findById(user._id)
        .select("+password")
        .lean();
      if (verifyUser && verifyUser.password) {
        const isHashed = verifyUser.password.startsWith("$2");
        console.log(
          `✅ User created in main DB. Password stored as hash: ${isHashed}`
        );
        if (!isHashed) {
          console.error(
            `❌ ERROR: Password was NOT hashed in main database for user ${email}!`
          );
        }
      }
    }

    // Send welcome email with PLAIN TEXT password (for user to login)
    // NOTE: Database stores HASHED password, but email sends PLAIN password
    try {
      console.log(
        `📧 Sending welcome email to ${email} with plain text password`
      );
      await sendWelcomeEmail(
        email,
        username,
        password, // ✅ PLAIN TEXT password sent in email (user needs this to login)
        firstName,
        hospital ? hospital.name : null
      );
      console.log(`✅ Welcome email sent successfully`);
    } catch (emailError) {
      console.error("❌ Failed to send welcome email:", emailError);
      // Don't fail the request if email fails
    }

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.passwordHistory;

    res.status(201).json({
      status: 1,
      message: "User Created Successfully",
      user: userResponse,
    });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        status: 0,
        message: `${field} already exists`,
        error: error.message,
      });
    }
    res.status(500).json({ status: 0, error: error.message });
  }
};

// Get current user profile
exports.getCurrentUser = async (req, res) => {
  try {
    let user = null;
    const User = require("../models/user.model");
    const Hospital = require("../models/hospital.model");
    const createTenantDB = require("../utils/createTenantDB");
    const Role = require("../models/role.model");

    // Try main database first
    user = await User.findById(req.user.id)
      .select(
        "firstName lastName email username phone department specialization shift status roles hospitalId createdAt lastLogin"
      )
      .populate("roles", "name description");

    // If not found and hospitalId exists, check tenant database
    // Allow both ACTIVE and VERIFIED hospitals (same as login)
    if (!user && req.user.hospitalId) {
      try {
        const hospital = await Hospital.findById(req.user.hospitalId).select(
          "tenantId name status"
        );
        if (
          hospital &&
          (hospital.status === "ACTIVE" || hospital.status === "VERIFIED")
        ) {
          const tenantConnection = await createTenantDB(hospital.tenantId);
          const TenantUser = tenantConnection.model("User");
          user = await TenantUser.findById(req.user.id).select(
            "firstName lastName email username phone department specialization shift status roles hospitalId createdAt lastLogin"
          );

          // Populate roles from main DB
          if (user && user.roles && user.roles.length > 0) {
            const roleObjects = await Role.find({
              _id: { $in: user.roles },
            }).select("name description");
            user.roles = roleObjects;
          }
        }
      } catch (err) {
        console.error("Error loading tenant user:", err);
      }
    }

    // If still not found, try searching all tenant databases (fallback)
    if (!user) {
      try {
        const hospitals = await Hospital.find({
          status: { $in: ["ACTIVE", "VERIFIED"] },
        }).select("tenantId _id");
        for (const hospital of hospitals) {
          try {
            const tenantConnection = await createTenantDB(hospital.tenantId);
            const TenantUser = tenantConnection.model("User");
            const tenantUser = await TenantUser.findById(req.user.id).select(
              "firstName lastName email username phone department specialization shift status roles hospitalId createdAt lastLogin"
            );

            if (tenantUser) {
              user = tenantUser;
              // Populate roles from main DB
              if (user.roles && user.roles.length > 0) {
                const roleObjects = await Role.find({
                  _id: { $in: user.roles },
                }).select("name description");
                user.roles = roleObjects;
              }
              break;
            }
          } catch (err) {
            console.error(`Error checking tenant ${hospital.tenantId}:`, err);
            continue;
          }
        }
      } catch (err) {
        console.error("Error searching tenant databases:", err);
      }
    }

    if (!user) {
      return res.status(404).json({ status: 0, message: "User not found" });
    }

    // Ensure roles are always populated with names (convert to plain object if needed)
    if (user.roles && user.roles.length > 0) {
      const roleIds = user.roles.map((r) =>
        typeof r === "object" ? r._id : r
      );

      const fullRoles = await Role.find({ _id: { $in: roleIds } }).select(
        "_id name description"
      );

      user.roles = fullRoles;
    }

    console.log("User roles after population:", user.roles);

    // Get hospital info if exists
    let hospital = null;
    if (user.hospitalId) {
      hospital = await Hospital.findById(user.hospitalId).select("name email");
    }

    const userResponse = user.toObject ? user.toObject() : user;
    userResponse.hospital = hospital;
    console.log("Final user response:", userResponse);
    res.status(200).json({
      status: 1,
      user: userResponse,
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const User = require("../models/user.model");
    const Hospital = require("../models/hospital.model");
    const createTenantDB = require("../utils/createTenantDB");
    const Role = require("../models/role.model");

    let user = null;
    let userModel = null;

    // Determine which database to query
    if (req.user.hospitalId) {
      // Hospital admin - query tenant database
      try {
        const hospital = await Hospital.findById(req.user.hospitalId).select(
          "tenantId status"
        );
        if (
          hospital &&
          (hospital.status === "ACTIVE" || hospital.status === "VERIFIED")
        ) {
          const tenantConnection = await createTenantDB(hospital.tenantId);
          userModel = tenantConnection.model("User");
          user = await userModel
            .findById(id)
            .select("-password -passwordHistory");

          // Ensure user belongs to this hospital
          if (
            user &&
            user.hospitalId?.toString() !== req.user.hospitalId?.toString()
          ) {
            return res
              .status(403)
              .json({ status: 0, message: "Access denied" });
          }
        }
      } catch (err) {
        console.error("Error getting tenant connection:", err);
        return res
          .status(500)
          .json({ status: 0, error: "Failed to access tenant database" });
      }
    } else {
      // Super admin - query main database
      userModel = User;
      user = await userModel.findById(id).select("-password -passwordHistory");
    }

    if (!user) {
      return res.status(404).json({ status: 0, message: "User not found" });
    }

    // Populate roles - ensure we always get role names (not IDs)
    if (user.roles && user.roles.length > 0) {
      const rolesWithNames = [];
      for (const role of user.roles) {
        if (typeof role === "object" && role !== null && role.name) {
          rolesWithNames.push({
            name: role.name,
            description: role.description,
          });
        } else if (
          typeof role === "string" ||
          (typeof role === "object" && role._id && !role.name)
        ) {
          // If role is an ID string or ObjectId without name, fetch it
          const roleId = typeof role === "string" ? role : role._id;
          const roleObj = await Role.findById(roleId).select(
            "name description"
          );
          if (roleObj) {
            rolesWithNames.push({
              name: roleObj.name,
              description: roleObj.description,
            });
          }
        }
      }
      user.roles = rolesWithNames;
    }

    const userResponse = user.toObject ? user.toObject() : user;

    res.status(200).json({
      status: 1,
      user: userResponse,
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

// Get all users with pagination and search
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const User = require("../models/user.model");
    const Hospital = require("../models/hospital.model");
    const createTenantDB = require("../utils/createTenantDB");
    const Role = require("../models/role.model");

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let users = [];
    let total = 0;
    let userModel = null;

    // Determine which database to query
    if (req.user.hospitalId) {
      // Hospital admin - query tenant database
      try {
        const hospital = await Hospital.findById(req.user.hospitalId).select(
          "tenantId status"
        );
        if (
          hospital &&
          (hospital.status === "ACTIVE" || hospital.status === "VERIFIED")
        ) {
          const tenantConnection = await createTenantDB(hospital.tenantId);
          userModel = tenantConnection.model("User");
        }
      } catch (err) {
        console.error("Error getting tenant connection:", err);
        return res
          .status(500)
          .json({ status: 0, error: "Failed to access tenant database" });
      }
    } else {
      // Super admin - query main database
      userModel = User;
    }

    if (!userModel) {
      return res.status(403).json({ status: 0, message: "Access denied" });
    }

    // Build query
    const query = {};

    // Filter by hospital if hospital admin
    if (req.user.hospitalId) {
      query.hospitalId = req.user.hospitalId;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    // Get users with pagination
    [users, total] = await Promise.all([
      userModel
        .find(query)
        .select("-password -passwordHistory")
        .populate("roles", "name description")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      userModel.countDocuments(query),
    ]);

    // Ensure all roles are populated with names (not IDs)
    // FINAL ROLE POPULATION (ensure id + name + description)
    if (users && users.length > 0) {
      for (let i = 0; i < users.length; i++) {
        const userObj = users[i].toObject ? users[i].toObject() : users[i];

        if (userObj.roles && userObj.roles.length > 0) {
          const roleIds = userObj.roles.map(r =>
            typeof r === "object" ? r._id : r
          );

          const fullRoles = await Role.find({ _id: { $in: roleIds } })
            .select("_id name description");
          console.log(fullRoles)

          userObj.roles = fullRoles;

          // replace back
          users[i] = userObj;
        }
      }
    }

    // console.log(users, "kuku")
    res.status(200).json({
      status: 1,
      data: {
        users: users.map((u) => {
          const userObj = u.toObject ? u.toObject() : u;
          delete userObj.password;
          delete userObj.passwordHistory;
          return userObj;
        }),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ status: 0, error: error.message });
  }
};

// Update user by ID (admin function)
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      email,
      phone,
      roleIds,
      department,
      specialization,
      status,
    } = req.body;

    const User = require("../models/user.model");
    const Hospital = require("../models/hospital.model");
    const createTenantDB = require("../utils/createTenantDB");

    let user = null;
    let userModel = null;

    // Determine which database to query
    if (req.user.hospitalId) {
      // Hospital admin - query tenant database
      try {
        const hospital = await Hospital.findById(req.user.hospitalId).select(
          "tenantId status"
        );
        if (
          hospital &&
          (hospital.status === "ACTIVE" || hospital.status === "VERIFIED")
        ) {
          const tenantConnection = await createTenantDB(hospital.tenantId);
          userModel = tenantConnection.model("User");
          user = await userModel.findById(id);

          // Ensure user belongs to this hospital
          if (
            user &&
            user.hospitalId?.toString() !== req.user.hospitalId?.toString()
          ) {
            return res
              .status(403)
              .json({ status: 0, message: "Access denied" });
          }
        }
      } catch (err) {
        console.error("Error getting tenant connection:", err);
        return res
          .status(500)
          .json({ status: 0, error: "Failed to access tenant database" });
      }
    } else {
      // Super admin - query main database
      userModel = User;
      user = await userModel.findById(id);
    }

    if (!user) {
      return res.status(404).json({ status: 0, message: "User not found" });
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (department !== undefined) user.department = department;
    if (specialization !== undefined) user.specialization = specialization;
    if (status) user.status = status;
    if (roleIds && Array.isArray(roleIds)) {
      user.roles = roleIds;
    }

    await user.save();

    // Remove sensitive fields
    const userResponse = user.toObject ? user.toObject() : user;
    delete userResponse.password;
    delete userResponse.passwordHistory;

    res.status(200).json({
      status: 1,
      message: "User updated successfully",
      user: userResponse,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        status: 0,
        message: `${field} already exists`,
        error: error.message,
      });
    }
    res.status(500).json({ status: 0, error: error.message });
  }
};

// Delete user by ID
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const User = require("../models/user.model");
    const Hospital = require("../models/hospital.model");
    const createTenantDB = require("../utils/createTenantDB");

    let user = null;
    let userModel = null;

    // Determine which database to query
    if (req.user.hospitalId) {
      // Hospital admin - query tenant database
      try {
        const hospital = await Hospital.findById(req.user.hospitalId).select(
          "tenantId status"
        );
        if (
          hospital &&
          (hospital.status === "ACTIVE" || hospital.status === "VERIFIED")
        ) {
          const tenantConnection = await createTenantDB(hospital.tenantId);
          userModel = tenantConnection.model("User");
          user = await userModel.findById(id);

          // Ensure user belongs to this hospital
          if (
            user &&
            user.hospitalId?.toString() !== req.user.hospitalId?.toString()
          ) {
            return res
              .status(403)
              .json({ status: 0, message: "Access denied" });
          }
        }
      } catch (err) {
        console.error("Error getting tenant connection:", err);
        return res
          .status(500)
          .json({ status: 0, error: "Failed to access tenant database" });
      }
    } else {
      // Super admin - query main database
      userModel = User;
      user = await userModel.findById(id);
    }

    if (!user) {
      return res.status(404).json({ status: 0, message: "User not found" });
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.user.id.toString()) {
      return res
        .status(400)
        .json({ status: 0, message: "Cannot delete your own account" });
    }

    await userModel.findByIdAndDelete(id);

    res.status(200).json({
      status: 1,
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

// Update current user profile
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, department, specialization, shift } =
      req.body;

    const User = require("../models/user.model");
    const Hospital = require("../models/hospital.model");
    const createTenantDB = require("../utils/createTenantDB");

    let user = null;
    let userModel = null;

    // Try main database first
    user = await User.findById(req.user.id);
    if (user) {
      userModel = User;
    } else if (req.user.hospitalId) {
      // Check tenant database
      try {
        const hospital = await Hospital.findById(req.user.hospitalId).select(
          "tenantId"
        );
        if (hospital && hospital.tenantId) {
          const tenantConnection = await createTenantDB(hospital.tenantId);
          userModel = tenantConnection.model("User");
          user = await userModel.findById(req.user.id);
        }
      } catch (err) {
        console.error("Error loading tenant user:", err);
      }
    }

    if (!user) {
      return res.status(404).json({ status: 0, message: "User not found" });
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (department !== undefined) user.department = department;
    if (specialization !== undefined) user.specialization = specialization;
    if (shift !== undefined) user.shift = shift;

    await user.save();

    // Remove sensitive fields
    const userResponse = user.toObject ? user.toObject() : user;
    delete userResponse.password;
    delete userResponse.passwordHistory;

    res.status(200).json({
      status: 1,
      message: "Profile updated successfully",
      user: userResponse,
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

// Get doctors list (available to RECEPTIONIST, HOSPITAL_ADMIN, SUPER_ADMIN)
exports.getDoctors = async (req, res) => {
  try {
    const User = require("../models/user.model");
    const Hospital = require("../models/hospital.model");
    const createTenantDB = require("../utils/createTenantDB");
    const Role = require("../models/role.model");

    let userModel = null;

    // Determine which database to query
    if (req.user.hospitalId) {
      // Hospital user - query tenant database
      try {
        const hospital = await Hospital.findById(req.user.hospitalId).select(
          "tenantId status"
        );
        if (
          hospital &&
          (hospital.status === "ACTIVE" || hospital.status === "VERIFIED")
        ) {
          const tenantConnection = await createTenantDB(hospital.tenantId);
          userModel = tenantConnection.model("User");
        }
      } catch (err) {
        console.error("Error getting tenant connection:", err);
        return res
          .status(500)
          .json({ status: 0, error: "Failed to access tenant database" });
      }
    } else {
      // Super admin - query main database
      userModel = User;
    }

    if (!userModel) {
      return res.status(403).json({ status: 0, message: "Access denied" });
    }

    // Get DOCTOR role ID
    const doctorRole = await Role.findOne({ name: "DOCTOR" }).select("_id");
    if (!doctorRole) {
      return res
        .status(404)
        .json({ status: 0, message: "DOCTOR role not found" });
    }

    // Find all users with DOCTOR role
    const query = {
      roles: doctorRole._id,
      status: "ACTIVE",
    };

    // Filter by hospital if hospital user
    if (req.user.hospitalId) {
      query.hospitalId = req.user.hospitalId;
    }

    const doctors = await userModel
      .find(query)
      .select("firstName lastName email phone specialization department _id")
      .sort({ firstName: 1, lastName: 1 });

    // Format response with role names
    const doctorsWithRoles = doctors.map((doctor) => {
      const doctorObj = doctor.toObject ? doctor.toObject() : doctor;
      doctorObj.roles = [{ name: "DOCTOR" }];
      return doctorObj;
    });

    res.status(200).json({
      status: 1,
      doctors: doctorsWithRoles,
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

// Get nurses list (available to DOCTOR, HOSPITAL_ADMIN, SUPER_ADMIN)
exports.getNurses = async (req, res) => {
  try {
    const User = require("../models/user.model");
    const Hospital = require("../models/hospital.model");
    const createTenantDB = require("../utils/createTenantDB");
    const Role = require("../models/role.model");

    let userModel = null;

    // Determine which database to query
    if (req.user.hospitalId) {
      // Hospital user - query tenant database
      try {
        const hospital = await Hospital.findById(req.user.hospitalId).select(
          "tenantId status"
        );
        if (
          hospital &&
          (hospital.status === "ACTIVE" || hospital.status === "VERIFIED")
        ) {
          const tenantConnection = await createTenantDB(hospital.tenantId);
          userModel = tenantConnection.model("User");
        }
      } catch (err) {
        console.error("Error getting tenant connection:", err);
        return res
          .status(500)
          .json({ status: 0, error: "Failed to access tenant database" });
      }
    } else {
      // Super admin - query main database
      userModel = User;
    }

    if (!userModel) {
      return res.status(403).json({ status: 0, message: "Access denied" });
    }

    // Get NURSE role ID
    const nurseRole = await Role.findOne({ name: "NURSE" }).select("_id");
    if (!nurseRole) {
      return res
        .status(404)
        .json({ status: 0, message: "NURSE role not found" });
    }

    // Find all users with NURSE role in the same hospital
    const query = {
      roles: nurseRole._id,
      status: "ACTIVE"
    };

    if (req.user.hospitalId) {
      query.hospitalId = req.user.hospitalId;
    }

    const nurses = await userModel
      .find(query)
      .select("firstName lastName email phone department _id")
      .sort({ firstName: 1, lastName: 1 });

    res.status(200).json({
      status: 1,
      nurses: nurses.map((n) => ({
        _id: n._id,
        firstName: n.firstName,
        lastName: n.lastName,
        email: n.email,
        phone: n.phone,
        department: n.department,
      })),
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

/**
 * Get hospital dashboard statistics
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const User = require("../models/user.model");
    const Patient = require("../models/patient.model");
    const Appointment = require("../models/appointment.model");
    const Role = require("../models/role.model");
    const Hospital = require("../models/hospital.model");
    const createTenantDB = require("../utils/createTenantDB");

    const hospitalId = req.user.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ status: 0, message: "Hospital ID is required" });
    }

    let userModel = null;

    // Try to get tenant database connection
    try {
      const hospital = await Hospital.findById(hospitalId).select("tenantId status");
      if (hospital && (hospital.status === "ACTIVE" || hospital.status === "VERIFIED")) {
        const tenantConnection = await createTenantDB(hospital.tenantId);
        userModel = tenantConnection.model("User");
      }
    } catch (err) {
      console.error("Error getting tenant connection:", err);
    }

    // Use tenant User model if available, otherwise main User model
    const UserModel = userModel || User;

    // Get DOCTOR role ID
    const doctorRole = await Role.findOne({ name: "DOCTOR" }).select("_id");
    const doctorRoleId = doctorRole ? doctorRole._id : null;

    // Count users (from tenant DB if available)
    const totalUsers = await UserModel.countDocuments({
      hospitalId: hospitalId,
      status: "ACTIVE"
    });

    // Count doctors
    let totalDoctors = 0;
    if (doctorRoleId) {
      totalDoctors = await UserModel.countDocuments({
        hospitalId: hospitalId,
        roles: doctorRoleId,
        status: "ACTIVE"
      });
    }

    // Count patients (from main database)
    const totalPatients = await Patient.countDocuments({
      hospitalId: hospitalId
    });

    // Count appointments (from main database)
    const totalAppointments = await Appointment.countDocuments({
      hospitalId: hospitalId
    });

    res.status(200).json({
      status: 1,
      stats: {
        totalUsers,
        totalDoctors,
        totalPatients,
        totalAppointments,
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ status: 0, error: error.message });
  }
};
