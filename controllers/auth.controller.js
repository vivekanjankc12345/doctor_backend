const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const Hospital = require("../models/hospital.model");
const createTenantDB = require("../utils/createTenantDB");
const { sendResetPasswordMail } = require("../services/mail.service");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../services/token.service");
const {
  validatePassword,
  checkPasswordHistory,
} = require("../utils/passwordValidator");
const crypto = require("crypto");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // First, check main database for super admin users
    let user = await User.findOne({ email });
    let hospital = null;

    // If not found in main DB, search tenant databases
    if (!user) {
      const hospitals = await Hospital.find().select(
        "tenantId _id name status"
      );

      for (const hosp of hospitals) {
        try {
          const tenantConnection = await createTenantDB(hosp.tenantId);
          const TenantUser = tenantConnection.model("User");
          const tenantUser = await TenantUser.findOne({ email });

          if (tenantUser) {
            user = tenantUser;
            hospital = hosp;
            break;
          }
        } catch (err) {
          console.error(`Error checking tenant ${hosp.tenantId}:`, err.message);
          continue;
        }
      }
    } else {
      // If user found in main DB, populate hospital if exists
      if (user.hospitalId) {
        hospital = await Hospital.findById(user.hospitalId).select(
          "name status"
        );
      }
    }

    if (!user)
      return res.status(404).json({ status: 0, message: "User not found" });

    // Check if hospital is ACTIVE or VERIFIED (for tenant users)
    // VERIFIED hospitals can login, but ACTIVE is preferred
    if (
      hospital &&
      hospital.status !== "ACTIVE" &&
      hospital.status !== "VERIFIED"
    ) {
      return res.status(403).json({
        status: 0,
        message: `Hospital is ${hospital.status}. Please contact administrator to activate your hospital.`,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res
        .status(401)
        .json({ status: 0, message: "Invalid credentials" });

    // Check if user is active
    if (
      user.status === "INACTIVE" ||
      user.status === "LOCKED" ||
      user.isActive === false
    ) {
      return res.status(403).json({
        status: 0,
        message: `Account is ${user.status || "deactivated"}`,
      });
    }

    // Ensure hospitalId is set correctly for token generation BEFORE saving
    // This is critical for tenant users
    if (hospital && !user.hospitalId) {
      user.hospitalId = hospital._id;
      // Save the hospitalId to the user document
      try {
        await user.save();
      } catch (saveErr) {
        console.error("Error saving hospitalId to user:", saveErr);
        // Continue anyway - hospitalId is set in memory
      }
    } else {
      // Update last login
      user.lastLogin = new Date();
      await user.save();
    }

    // Populate roles if they are ObjectIds
    let roles = user.roles || [];

    // Remove undefined / null values
    roles = roles.filter((r) => r);

    if (roles.length > 0) {
      const Role = require("../models/role.model");

      // roles are ObjectIds → fetch names
      const roleObjects = await Role.find({ _id: roles }).select("name _id");
      roles = roleObjects.map((r) => ({ _id: r._id, name: r.name }));
    }
    // Create a user object with hospitalId for token generation
    const userForToken = {
      _id: user._id,
      roles: user.roles,
      hospitalId: user.hospitalId || (hospital ? hospital._id : null),
    };

    const accessToken = generateAccessToken(userForToken);
    const refreshToken = generateRefreshToken(userForToken);

    // Cookie settings - use secure only in production
    const isProduction = process.env.NODE_ENV === "production";

    // Set refresh token cookie (this is stored in browser, not sent with every request)
    // It will only be used when access token expires (401 error)
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProduction, // Only use secure cookies in production (HTTPS)
      sameSite: isProduction ? "strict" : "lax", // More permissive in development
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/", // Ensure cookie is available for all paths
    });

    res.status(200).json({
      status: 1,
      message: "Login successful",
      accessToken,
      role: roles,
      roles: roles, // Also include as 'roles' for consistency
      hospital: hospital ? hospital.name : null,
      hospitalId: hospital
        ? hospital._id
          ? hospital._id.toString()
          : null
        : null,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      console.log("No refresh token cookie found");
      return res.status(401).json({ status: 0, message: "No refresh token" });
    }

    jwt.verify(token, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err) {
        console.error("Refresh token verification error:", err.message);
        return res
          .status(403)
          .json({ status: 0, message: "Invalid refresh token" });
      }

      let user = null;
      let hospital = null;

      // If hospitalId is in the decoded token, use it to find the hospital first
      if (decoded.hospitalId) {
        hospital = await Hospital.findById(decoded.hospitalId).select(
          "tenantId _id status"
        );
        if (
          hospital &&
          (hospital.status === "ACTIVE" || hospital.status === "VERIFIED")
        ) {
          try {
            const tenantConnection = await createTenantDB(hospital.tenantId);
            const TenantUser = tenantConnection.model("User");
            user = await TenantUser.findById(decoded.id);
            if (user && !user.hospitalId) {
              user.hospitalId = hospital._id;
            }
          } catch (err) {
            console.error(
              `Error accessing tenant ${hospital.tenantId}:`,
              err.message
            );
          }
        }
      }

      // If not found yet, check main database
      if (!user) {
        user = await User.findById(decoded.id);
        if (user && user.hospitalId) {
          hospital = await Hospital.findById(user.hospitalId).select(
            "tenantId _id status"
          );
        }
      }

      // If still not found, search all tenant databases
      if (!user) {
        const hospitals = await Hospital.find({
          status: { $in: ["ACTIVE", "VERIFIED"] },
        }).select("tenantId _id status");

        for (const hosp of hospitals) {
          try {
            const tenantConnection = await createTenantDB(hosp.tenantId);
            const TenantUser = tenantConnection.model("User");
            const tenantUser = await TenantUser.findById(decoded.id);

            if (tenantUser) {
              user = tenantUser;
              hospital = hosp;
              if (!user.hospitalId) {
                user.hospitalId = hospital._id;
              }
              break;
            }
          } catch (err) {
            console.error(
              `Error checking tenant ${hosp.tenantId}:`,
              err.message
            );
            continue;
          }
        }
      }

      if (!user) {
        console.error("User not found for refresh token:", decoded.id);
        return res.status(404).json({ status: 0, message: "User not found" });
      }

      // Create user object for token generation
      const userForToken = {
        _id: user._id,
        roles: user.roles,
        hospitalId: user.hospitalId || (hospital ? hospital._id : null),
      };

      const newAccessToken = generateAccessToken(userForToken);
      res.status(200).json({
        status: 1,
        accessToken: newAccessToken,
        message: "Token refreshed successfully",
      });
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

exports.logout = (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie("refreshToken", {
    httpOnly: true,
    sameSite: isProduction ? "strict" : "lax",
    secure: isProduction,
    path: "/",
  });
  res.status(200).json({ status: 1, message: "Logged out successfully" });
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // First check main database
    let user = await User.findOne({ email });

    // If not found, search tenant databases
    if (!user) {
      const hospitals = await Hospital.find({ status: "ACTIVE" }).select(
        "tenantId _id"
      );

      for (const hospital of hospitals) {
        try {
          const tenantConnection = await createTenantDB(hospital.tenantId);
          const TenantUser = tenantConnection.model("User");
          const tenantUser = await TenantUser.findOne({ email });

          if (tenantUser) {
            user = tenantUser;
            break;
          }
        } catch (err) {
          console.error(
            `Error checking tenant ${hospital.tenantId}:`,
            err.message
          );
          continue;
        }
      }
    }

    if (!user)
      return res.status(404).json({ status: 0, message: "User not found" });

    const token = crypto.randomBytes(32).toString("hex");
    user.resetToken = token;
    user.resetExpiry = Date.now() + 10 * 60 * 1000;
    await user.save();

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;
    await sendResetPasswordMail(user.email, resetLink);

    res.status(200).json({ status: 1, message: "Reset link sent to email" });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Validate password policy
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        status: 0,
        message: "Password validation failed",
        errors: passwordValidation.errors,
      });
    }

    // First check main database
    let user = await User.findOne({
      resetToken: token,
      resetExpiry: { $gt: Date.now() },
    });
    let userModel = User;

    // If not found, search tenant databases
    if (!user) {
      const hospitals = await Hospital.find({ status: "ACTIVE" }).select(
        "tenantId _id"
      );

      for (const hospital of hospitals) {
        try {
          const tenantConnection = await createTenantDB(hospital.tenantId);
          const TenantUser = tenantConnection.model("User");
          const tenantUser = await TenantUser.findOne({
            resetToken: token,
            resetExpiry: { $gt: Date.now() },
          });

          if (tenantUser) {
            user = tenantUser;
            userModel = TenantUser;
            break;
          }
        } catch (err) {
          console.error(
            `Error checking tenant ${hospital.tenantId}:`,
            err.message
          );
          continue;
        }
      }
    }

    if (!user)
      return res
        .status(400)
        .json({ status: 0, message: "Invalid or expired link" });

    // Check password history (cannot reuse last 3 passwords)
    const passwordHistoryCheck = await checkPasswordHistory(
      newPassword,
      user.passwordHistory || [],
      3
    );
    if (passwordHistoryCheck.isReused) {
      return res
        .status(400)
        .json({ status: 0, message: passwordHistoryCheck.message });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password history (keep last 3)
    const passwordHistory = (user.passwordHistory || []).slice(-2); // Keep last 2
    passwordHistory.push({ password: hashedPassword, changedAt: new Date() });

    user.password = hashedPassword;
    user.passwordHistory = passwordHistory;
    user.passwordChangedAt = new Date();
    user.resetToken = null;
    user.resetExpiry = null;
    user.status = "ACTIVE"; // Reset status if it was PASSWORD_EXPIRED

    await user.save();

    // Note: In a production system, you would invalidate all active sessions here
    // This could be done by maintaining a session blacklist in Redis or database

    res.status(200).json({
      status: 1,
      message: "Password reset successful. Please login again.",
    });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        status: 0,
        message: "Old password and new password are required",
      });
    }

    // Validate password policy
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        status: 0,
        message: "Password validation failed",
        errors: passwordValidation.errors,
      });
    }

    // Get user from request (set by auth middleware)
    const userId = req.userId;
    let user = await User.findById(userId);

    // If not found in main DB, check tenant databases
    if (!user && req.user.hospitalId) {
      const hospital = await Hospital.findById(req.user.hospitalId).select(
        "tenantId"
      );
      if (hospital) {
        const tenantConnection = await createTenantDB(hospital.tenantId);
        const TenantUser = tenantConnection.model("User");
        user = await TenantUser.findById(userId);
      }
    }

    if (!user)
      return res.status(404).json({ status: 0, message: "User not found" });

    // Verify old password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ status: 0, message: "Current password is incorrect" });
    }

    // Check if new password is same as old password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        status: 0,
        message: "New password cannot be same as current password",
      });
    }

    // Check password history (cannot reuse last 3 passwords)
    const passwordHistoryCheck = await checkPasswordHistory(
      newPassword,
      user.passwordHistory || [],
      3
    );
    if (passwordHistoryCheck.isReused) {
      return res
        .status(400)
        .json({ status: 0, message: passwordHistoryCheck.message });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password history (keep last 3)
    const passwordHistory = (user.passwordHistory || []).slice(-2); // Keep last 2
    passwordHistory.push({ password: hashedPassword, changedAt: new Date() });

    user.password = hashedPassword;
    user.passwordHistory = passwordHistory;
    user.passwordChangedAt = new Date();
    user.status = "ACTIVE";

    await user.save();

    res
      .status(200)
      .json({ status: 1, message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};
