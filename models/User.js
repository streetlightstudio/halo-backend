const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
 email: { type: String, required: true, unique: true },
 password: { type: String, required: true },
 username: { type: String },
 name: { type: String },
 phone: { type: String },
 lastname: { type: String },
 employer: { type: Boolean, default: false },
 isActive: { type: Boolean, default: true },
 isStudentApplied: { type: Boolean, default: false },
 verifyAt: { type: Date },
 isVerify: { type: Boolean, default: false },
 isDelete: { type: Boolean, default: false },
 orderId: { type: String, default: null },
 attempt: { type: Number, default: 0 },
 badge: [{ type: String }],
 subscription: {
  plan: { type: String, default: "free" },
  startDate: { type: Date },
  endDate: { type: Date },
  status: { type: String, default: "active" },
 },
 createdAt: { type: Date, default: Date.now },
 updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
