const mongoose = require("mongoose");

const connectDB = async (mongoUri) => {
 try {
  await mongoose.connect(mongoUri, {
   useNewUrlParser: true,
   useUnifiedTopology: true,
   maxPoolSize: 50, // Increase pool size for more concurrent connections
  });
  console.log("MongoDB URI:", mongoUri);
  console.log(
   "Connected to MongoDB, database:",
   mongoose.connection.db.databaseName
  );
 } catch (err) {
  console.error("MongoDB connection error:", err.message, "Stack:", err.stack);
  process.exit(1);
 }
};

module.exports = connectDB;
