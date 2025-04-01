const mongoose = require("mongoose");

const connectDB = async (mongoUri) => {
 try {
  await mongoose.connect(mongoUri, {
   useNewUrlParser: true,
   useUnifiedTopology: true,
  });
  console.log(
   "Connected to MongoDB, database:",
   mongoose.connection.db.databaseName
  );
 } catch (err) {
  console.error("MongoDB connection error:", err);
  process.exit(1);
 }
};

module.exports = connectDB;
