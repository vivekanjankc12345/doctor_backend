/**
 * Password Policy Validator
 * Requirements: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
 */
exports.validatePassword = (password) => {
  const errors = [];

  if (!password || password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Check if password was used in last N passwords
 * Compares hashed passwords using bcrypt
 */
const bcrypt = require("bcryptjs");

exports.checkPasswordHistory = async (newPassword, passwordHistory, lastN = 3) => {
  if (!passwordHistory || passwordHistory.length === 0) {
    return { isReused: false };
  }

  const recentPasswords = passwordHistory
    .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))
    .slice(0, lastN)
    .map(p => p.password);

  // Compare new password (plain) with old passwords (hashed)
  for (const oldHashedPassword of recentPasswords) {
    const isMatch = await bcrypt.compare(newPassword, oldHashedPassword);
    if (isMatch) {
      return {
        isReused: true,
        message: `Password cannot be same as any of the last ${lastN} passwords`
      };
    }
  }

  return { isReused: false };
};

