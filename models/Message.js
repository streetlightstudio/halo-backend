const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
 userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
 threadId: { type: String, required: true },
 role: { type: String, enum: ["user", "assistant"], required: true },
 content: { type: String, required: true },
 createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Message", messageSchema);
