const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  level: { type: Number, required: true },
  permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Permission" }],
  parentRole: { type: mongoose.Schema.Types.ObjectId, ref: "Role" }
}, { timestamps: true });

module.exports = mongoose.model("Role", roleSchema);
