const mongoose = require("mongoose");

const threadSchema = new mongoose.Schema({
 userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
 threadId: { type: String, required: true },
 createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Thread", threadSchema);
