const Role = require("../models/role.model");
const Permission = require("../models/permission.model");
const User = require("../models/user.model");
const bcrypt = require("bcryptjs");

module.exports = async () => {
  try {
    const existing = await Role.findOne({ name: "SUPER_ADMIN" });
    if (existing) return;

    const perms = await Permission.insertMany([
      { name: "ALL:ALL", description: "All permissions" }
    ]);

    const role = await Role.create({
      name: "SUPER_ADMIN",
      level: 1,
      permissions: perms.map(p => p._id)
    });

    const hashed = await bcrypt.hash("Super@123", 10);

    await User.create({
      firstName: "Super",
      lastName: "Admin",
      email: "super@hms.com",
      password: hashed,
      roles: [role._id],
      hospitalId: null
    });

    console.log("✅ SUPER ADMIN CREATED");
  } catch (err) {
    console.log(err.message);
  }
};
