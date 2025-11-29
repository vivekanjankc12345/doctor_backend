const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

// Routes
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/hospital", require("./routes/hospital.routes"));
app.use("/api/users", require("./routes/user.routes"));
app.use("/api/patients", require("./routes/patient.routes"));
app.use("/api/appointments", require("./routes/appointment.routes"));
app.use("/api/prescriptions", require("./routes/prescription.routes"));
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/menu", require("./routes/menu.routes"));
app.use("/api/role", require("./routes/role.routes"));
app.use("/api/roles", require("./routes/role.routes")); // Support both singular and plural
app.use("/api/vitals", require("./routes/vital.routes"));
app.use("/api/medical-records", require("./routes/medicalRecord.routes"));

// Error handler
const errorHandler = require("./middlewares/error.middleware");
app.use(errorHandler);

module.exports = app;
