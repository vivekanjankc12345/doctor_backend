const Appointment = require("../models/appointment.model");

exports.createAppointment = async (req, res) => {
  try {
    const { patient, doctor, appointmentDate } = req.body;
    const appointment = await Appointment.create({
      hospitalId: req.user.hospitalId,
      patient, doctor, appointmentDate
    });
    res.status(201).json({ status: 1, message: "Appointment Booked", appointment });
  } catch (error) {
    res.status(500).json({ status: 0, error: error.message });
  }
};
