const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, default: "" },
  location: { type: String, default: "" },
  otp: { type: String, default: null },          // ✅ Added OTP field
  otpExpires: { type: Date, default: null }      // ✅ Added OTP expiry field
});

module.exports = mongoose.model("User", userSchema);
