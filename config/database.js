const mongoose = require("mongoose");

const connectDB = async (mongoUri) => {
 try {
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");
 } catch (err) {
  console.error("MongoDB connection error:", err);
  process.exit(1);
 }
};

module.exports = connectDB;
