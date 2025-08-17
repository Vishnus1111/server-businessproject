module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'your_jwt_secret_key_here',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '24h',
  OTP_EXPIRE_MINUTES: process.env.OTP_EXPIRE_MINUTES || 5,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  EMAIL_TEMPLATES: {
    PASSWORD_RESET: {
      SUBJECT: 'Password Reset Request',
      getBody: (otp, resetLink) => `
        <h2>Password Reset Request</h2>
        <p>You have requested to reset your password. Here is your OTP:</p>
        <h3>${otp}</h3>
        <p>Alternatively, you can click the link below to reset your password:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>This OTP will expire in 5 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      `
    }
  }
};
