const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { Server } = require("socket.io");
const http = require("http");
const jwt = require("jsonwebtoken");
const rateLimit = require("./middleware/rateLimit");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/authRoutes");
const chatRoutes = require("./routes/chatRoutes");
const policyRoutes = require("./routes/policyRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const consultationRoutes = require("./routes/consultationRoutes");
const { FRONTEND_URL, JWT_KEY } = require("./config/env");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
 cors: {
  origin: FRONTEND_URL,
  methods: ["GET", "POST"],
  credentials: true,
  allowedHeaders: ["Authorization", "Content-Type"],
 },
 transports: ["websocket", "polling"],
});

console.log("JWT_KEY loaded:", JWT_KEY ? "Yes" : "No");

io.use((socket, next) => {
 const token = socket.handshake.auth.token;
 if (!token) {
  console.log("No token provided for Socket.IO connection");
  return next();
 }

 jwt.verify(token, JWT_KEY, (err, decoded) => {
  if (err) {
   console.error("Socket.IO authentication error:", err.message);
   return next(new Error("Authentication error: Invalid token"));
  }
  socket.user = decoded;
  console.log("Socket.IO authenticated user:", decoded);
  next();
 });
});

app.use(
 cors({
  origin: FRONTEND_URL,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Authorization", "Content-Type"],
 })
);
app.use(express.json());
app.use(cookieParser());
app.use(rateLimit);

const uploadQueue = new Map();
app.use((req, res, next) => {
 req.io = io;
 req.uploadQueue = uploadQueue;
 next();
});

io.on("connection", (socket) => {
 console.log(
  "User connected:",
  socket.id,
  "User:",
  socket.user || "Unauthenticated"
 );
 socket.on("joinThread", (threadId) => {
  socket.join(threadId);
  console.log(`Socket ${socket.id} joined thread ${threadId}`);
 });
 socket.on("disconnect", (reason) => {
  console.log("User disconnected:", socket.id, "Reason:", reason);
 });

 socket.on("connect_error", (error) => {
  console.error("Socket.IO connection error:", error.message);
 });
});

app.use("/auth", authRoutes);
app.use(chatRoutes);
app.use(policyRoutes);
app.use(uploadRoutes);
app.use(consultationRoutes);

app.get("/test-email", async (req, res) => {
 const { sendEmail } = require("./services/emailService");
 try {
  await sendEmail({
   from: process.env.EMAIL_USER,
   to: "test@example.com",
   subject: "Test Email",
   text: "This is a test email from Healthematics.",
  });
  res.send("Email sent successfully");
 } catch (error) {
  res.status(500).send(`Failed to send email: ${error.message}`);
 }
});

app.use(errorHandler);

module.exports = { app, server };
