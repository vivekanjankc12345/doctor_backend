const mongoose = require("mongoose");
const UserSchema = require("../models/user.tenant.schema");   // MUST be schema

const tenantConnections = {};

const createTenantDB = async (tenantId) => {
  if (tenantConnections[tenantId]) {
    return tenantConnections[tenantId];
  }

  const uri = `${process.env.MONGO_URI}${tenantId}`;
  const connection = await mongoose.createConnection(uri);

  // Register schemas on tenant DB
  connection.model("User", UserSchema);  // ❗ expects a Schema

  tenantConnections[tenantId] = connection;

  return connection;
};

module.exports = createTenantDB;
