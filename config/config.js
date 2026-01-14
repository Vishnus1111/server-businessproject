const OTP_EXPIRE_MINUTES = parseInt(process.env.OTP_EXPIRE_MINUTES, 10) || 15;

module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'your_jwt_secret_key_here',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '24h',
  OTP_EXPIRE_MINUTES,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  EMAIL_USER: process.env.EMAIL_USER || 'meghakalaiselvi@gmail.com',
  EMAIL_PASS: process.env.EMAIL_PASS || 'sqofsaixwzoognfm',
  EMAIL_TEMPLATES: {
    PASSWORD_RESET: {
      SUBJECT: 'Password Reset Request',
      getBody: (otp, resetLink) => `
        Password Reset Request
        You have requested to reset your password. Here is your OTP:
        ${otp}
        Alternatively, you can click the link below to reset your password:
        <a href="${resetLink}">Reset Password</a>
        This OTP will expire in ${OTP_EXPIRE_MINUTES} minutes.
        If you did not request this, please ignore this email.
      `
    }
  }
};
