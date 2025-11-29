const bcrypt = require("bcryptjs");
const userSchema = require("../models/user.tenant.schema");

module.exports = async (connection, hospital, roleId) => {
  const User = connection.model("User", userSchema);

  const domain = hospital.email.split("@")[1] || hospital.tenantId;
  const email = `admin@${domain}`;

  const password = `admin@1234`;

  // Hash password for database storage
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Verify hash was created
  if (!hashedPassword || !hashedPassword.startsWith('$2')) {
    throw new Error('Failed to hash admin password');
  }
  
  console.log(`✅ Admin password hashed. Hash: ${hashedPassword.substring(0, 20)}...`);

  const admin = await User.create({
    firstName: "Hospital",
    lastName: "Admin",
    email,
    password: hashedPassword, // ✅ HASHED password stored in database
    roles: [roleId],
    hospitalId: hospital._id
  });

  // Verify password was stored correctly
  const verifyAdmin = await User.findById(admin._id).select("+password").lean();
  if (verifyAdmin && verifyAdmin.password) {
    const isHashed = verifyAdmin.password.startsWith('$2');
    console.log(`✅ Admin created. Password stored as hash: ${isHashed}`);
    if (!isHashed) {
      console.error(`❌ ERROR: Admin password was NOT hashed in database!`);
    }
  }

  // Return plain password for email (database has hashed version)
  return { email, password }; // ✅ Return PLAIN password for email
};
