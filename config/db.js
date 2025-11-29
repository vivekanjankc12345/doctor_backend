const mongoose = require("mongoose");

module.exports = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("❌ MongoDB Connection Failed:", error.message);
    
    // Provide helpful error messages
    if (error.message.includes("IP") || error.message.includes("whitelist")) {
      console.error("\n💡 Tip: Add your IP address to MongoDB Atlas IP Whitelist:");
      console.error("   1. Go to MongoDB Atlas Dashboard");
      console.error("   2. Navigate to Network Access");
      console.error("   3. Click 'Add IP Address'");
      console.error("   4. Add your current IP or use 0.0.0.0/0 for development (not recommended for production)");
      console.error("   https://www.mongodb.com/docs/atlas/security-whitelist/\n");
    } else if (error.message.includes("authentication")) {
      console.error("\n💡 Tip: Check your MongoDB connection string credentials");
      console.error("   Make sure your username, password, and database name are correct\n");
    }
    
    process.exit(1);
  }
};
