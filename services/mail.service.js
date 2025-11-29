const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.sendOTP = async (email, otp) => {
  await transporter.sendMail({
    from: `"HMS System" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your Login OTP - HMS",
    html: `<h2>OTP: ${otp}</h2><p>This OTP is valid for 5 minutes.</p>`
  });
};

exports.sendResetPasswordMail = async (email, resetLink) => {
  await transporter.sendMail({
    from: `"HMS System" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset Your Password - HMS",
    html: `<h2>Reset Password</h2><a href="${resetLink}">Click here to reset password</a><p>Valid for 10 minutes</p>`
  });
};

exports.sendHospitalVerification = async (email, link) => {
  await transporter.sendMail({
    from: `"HMS Platform" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify Your Hospital - HMS",
    html: `<h2>Verify Hospital Registration</h2><a href="${link}" target="_blank">Click here to activate hospital</a><p>Valid for 24 hours</p>`
  });
};

exports.sendHospitalCredentials = async (hospitalEmail, adminEmail, adminPassword="admin@1234") => {
  const mailOptions = {
    from: process.env.MAIL_FROM,
    to: hospitalEmail,
    subject: "Hospital Admin Login Credentials",
    html: `
      <h2>Welcome to HMS!</h2>
      <p>Your hospital has been verified and activated.</p>
      <h3>Admin Login Credentials:</h3>
      <p><strong>Email:</strong> ${adminEmail}</p>
      <p><strong>Temporary Password:</strong> ${adminPassword}</p>
      <p><a href="${process.env.FRONTEND_URL}/login">Click here to login</a></p>
      <p><em>Please change your password after first login.</em></p>
    `
  };
  
  return transporter.sendMail(mailOptions);
};

exports.sendHospitalStatusMail = async (to, status, hospitalName) => {
  let subject = "";
  let message = "";

  if (status === "ACTIVE") {
    subject = "✅ Hospital Activated";
    message = `
      <h2>Congratulations ${hospitalName}</h2>
      <p>Your hospital is now ACTIVE on HMS platform.</p>
      <p>You can start using the system now.</p>
    `;
  }

  if (status === "SUSPENDED") {
    subject = "⚠️ Hospital Suspended";
    message = `
      <h2>${hospitalName}</h2>
      <p>Your hospital has been SUSPENDED by Super Admin.</p>
      <p>Please contact support for more details.</p>
    `;
  }

  if (status === "INACTIVE") {
    subject = "❌ Hospital Inactivated";
    message = `
      <h2>${hospitalName}</h2>
      <p>Your hospital is now INACTIVE on HMS platform.</p>
      <p>Your access has been permanently revoked.</p>
    `;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    html: message
  });
};

exports.sendWelcomeEmail = async (email, username, temporaryPassword, firstName, hospitalName) => {
  await transporter.sendMail({
    from: `"HMS System" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Welcome to HMS - Your Account Credentials",
    html: `
      <h2>Welcome to HMS, ${firstName}!</h2>
      <p>Your account has been created${hospitalName ? ` for ${hospitalName}` : ""}.</p>
      <h3>Login Credentials:</h3>
      <p><strong>Username/Email:</strong> ${username || email}</p>
      <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
      <p><a href="${process.env.FRONTEND_URL}/login">Click here to login</a></p>
      <p><em>Please change your password after first login for security.</em></p>
      <p>If you have any questions, please contact your system administrator.</p>
    `
  });
};
