const { server } = require("./app");
const connectDB = require("./config/database");
const { PORT, MONGO } = require("./config/env");

process.on("unhandledRejection", (reason, promise) => {
 console.error("Unhandled Rejection at:", promise, "reason:", reason);
 // Optionally, keep the process alive or gracefully shut down
});

const startServer = async () => {
 try {
  await connectDB(MONGO);
  server.listen(PORT, () => {
   console.log(`Server running on port ${PORT}`);
   console.log(`WebSocket server ready at ws://localhost:${PORT}`);
  });

  server.on("error", (error) => {
   if (error.code === "EADDRINUSE") {
    console.error(
     `Port ${PORT} is already in use. Please use a different port.`
    );
   } else {
    console.error("Server error:", error.message);
   }
   process.exit(1);
  });
 } catch (error) {
  console.error("Failed to start server:", error.message);
  process.exit(1);
 }
};

startServer();
