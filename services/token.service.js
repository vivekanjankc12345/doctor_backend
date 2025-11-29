const jwt = require("jsonwebtoken");

exports.generateAccessToken = (user) => {
  return jwt.sign({ id: user._id, role: user.roles ? user.roles : [], hospitalId: user.hospitalId }, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.ACCESS_TOKEN_EXPIRE });
};

exports.generateRefreshToken = (user) => {
  // Include hospitalId in refresh token payload to help find user in tenant DB
  const payload = { id: user._id };
  if (user.hospitalId) {
    payload.hospitalId = user.hospitalId.toString();
  }
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRE });
};
