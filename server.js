require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const seedRoles = require("./utils/seedRoles");

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
  await seedRoles(); // Seed all roles including SUPER_ADMIN
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
})();
