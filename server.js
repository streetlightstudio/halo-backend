require("dotenv").config();
const OpenAI = require("openai");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const fs = require("fs").promises;
const pdfParse = require("pdf-parse");
const nodemailer = require("nodemailer");

const {
 OPENAI_API_KEY,
 ASSISTANT_ID,
 JWT_KEY,
 MONGO,
 PORT = 3001,
 FRONTEND_URL = "http://localhost:3000",
 EMAIL_USER,
 EMAIL_PASS,
 CONSULTANCY_EMAIL,
} = process.env;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
 cors: {
  origin: FRONTEND_URL,
  methods: ["GET", "POST"],
  credentials: true,
 },
});

// Middleware
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(
 rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
 })
);

// MongoDB Connection
mongoose
 .connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
 .then(() => console.log("Connected to MongoDB"))
 .catch((err) => console.error("MongoDB connection error:", err));

// User Schema (Updated to match your database)
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
 badge: { enum: [Array] }, // Adjust as needed
 subscription: {
  plan: { type: String, default: "free" },
  startDate: { type: Date },
  endDate: { type: Date },
  status: { type: String, default: "active" },
 },
 createdAt: { type: Date, default: Date.now },
 updatedAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);

// Thread Schema
const threadSchema = new mongoose.Schema({
 userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Optional
 threadId: { type: String, required: true },
 createdAt: { type: Date, default: Date.now },
});

const Thread = mongoose.model("Thread", threadSchema);

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
 const authHeader = req.headers["authorization"];
 const token = authHeader && authHeader.split(" ")[1];

 if (!token) {
  req.user = null;
  return next();
 }

 jwt.verify(token, JWT_KEY, (err, user) => {
  if (err) return res.status(403).json({ error: "Invalid token" });
  req.user = user;
  next();
 });
};

// Middleware to require authentication
const requireAuth = (req, res, next) => {
 const authHeader = req.headers["authorization"];
 const token = authHeader && authHeader.split(" ")[1];

 if (!token) return res.status(401).json({ error: "Authentication required" });

 jwt.verify(token, JWT_KEY, (err, user) => {
  if (err) return res.status(403).json({ error: "Invalid token" });
  req.user = user;
  next();
 });
};

// OpenAI Setup
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const assistantId = ASSISTANT_ID;

// File Upload Setup
const upload = multer({ dest: "uploads/" });

// Email Setup
const transporter = nodemailer.createTransport({
 service: "gmail",
 auth: {
  user: EMAIL_USER,
  pass: EMAIL_PASS,
 },
});

// OpenAI Functions
async function createThread(userId = null) {
 console.log(
  `Creating a new thread for userId: ${userId || "unauthenticated"}...`
 );
 const thread = await openai.beta.threads.create();
 const newThread = new Thread({ userId, threadId: thread.id });
 await newThread.save();
 console.log(`Thread created: ${thread.id}`);
 return thread;
}

async function addMessage(threadId, message) {
 console.log("Adding message to thread: " + threadId);
 return await openai.beta.threads.messages.create(threadId, {
  role: "user",
  content: message,
 });
}

async function runAssistant(threadId) {
 console.log("Running assistant for thread: " + threadId);
 return await openai.beta.threads.runs.create(threadId, {
  assistant_id: assistantId,
 });
}

async function getRunStatus(threadId, runId) {
 return await openai.beta.threads.runs.retrieve(threadId, runId);
}

async function getLatestAssistantMessage(threadId) {
 const messagesList = await openai.beta.threads.messages.list(threadId);
 const latestAssistantMessage = messagesList.data.find(
  (msg) => msg.role === "assistant"
 );

 return latestAssistantMessage
  ? {
     role: "assistant",
     content: latestAssistantMessage.content
      .filter((content) => content.type === "text")
      .map((content) => content.text.value)
      .join("\n")
      .trim(),
    }
  : { role: "assistant", content: "I'm here to help. How can I assist you?" };
}

// Subscription Status Check Function
async function checkSubscriptionStatus(userId) {
 if (!userId) {
  return {
   isActive: false,
   subscription: { plan: "free" },
   message: "Not logged in",
  };
 }
 try {
  const user = await User.findById(userId);
  if (!user) {
   return {
    isActive: false,
    subscription: { plan: "free" },
    message: "User not found",
   };
  }

  const sub = user.subscription;
  const isActive =
   sub.status === "active" &&
   (!sub.endDate || new Date() <= new Date(sub.endDate));

  return {
   isActive,
   subscription: {
    plan: sub.plan,
    startDate: sub.startDate,
    endDate: sub.endDate,
    status: sub.status,
   },
   message: isActive
    ? "Subscription active"
    : "Subscription inactive or expired",
  };
 } catch (error) {
  console.error("Subscription check error:", error);
  return {
   isActive: false,
   subscription: { plan: "free" },
   message: "Failed to check subscription",
  };
 }
}

// File Content Extraction
async function extractFileContent(filePath, fileName) {
 const ext = fileName.split(".").pop().toLowerCase();
 if (ext === "txt") {
  return await fs.readFile(filePath, "utf8");
 } else if (ext === "pdf") {
  const dataBuffer = await fs.readFile(filePath);
  const pdfData = await pdfParse(dataBuffer);
  return pdfData.text;
 } else {
  throw new Error("Unsupported file type. Please upload a .txt or .pdf file.");
 }
}

// Content Validation with OpenAI
async function validateContent(content) {
 const prompt = `
    Analyze the following text and determine if it is related to healthcare, finance, marketing, or services offered by a company like Healthematics (e.g., hospital project management, healthcare accreditation, market intelligence). Respond with "yes" if it is related, or "no" if it is not. Provide a brief explanation.

    Text: "${content.slice(
     0,
     1000
    )}"  // Limit to 1000 chars to avoid token issues
  `;

 const response = await openai.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [{ role: "user", content: prompt }],
  max_tokens: 100,
 });

 const result = response.choices[0].message.content.trim();
 return {
  isValid: result.startsWith("yes"),
  explanation: result,
 };
}

// Socket.IO Connection
io.on("connection", (socket) => {
 console.log("A user connected:", socket.id);

 socket.on("joinThread", (threadId) => {
  socket.join(threadId);
  console.log(`User ${socket.id} joined thread ${threadId}`);
 });

 socket.on("disconnect", () => {
  console.log("User disconnected:", socket.id);
 });
});

// Authentication Routes
app.post("/auth/register", async (req, res) => {
 try {
  const { email, password, name, username, phone, lastname } = req.body;
  if (!email || !password) {
   return res.status(400).json({ error: "Email and password are required" });
  }
  const existingUser = await User.findOne({ email });
  if (existingUser)
   return res.status(400).json({ error: "User already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({
   email,
   password: hashedPassword,
   name,
   username,
   phone,
   lastname,
  });
  await user.save();

  const token = jwt.sign({ id: user._id, email: user.email }, JWT_KEY, {
   expiresIn: "1h",
  });
  res.json({
   token,
   user: { id: user._id, email, name, username, phone, lastname },
  });
 } catch (error) {
  console.error("Registration error:", error);
  res.status(500).json({ error: "Registration failed" });
 }
});

app.post("/auth/login", async (req, res) => {
 try {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
   return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ id: user._id, email: user.email }, JWT_KEY, {
   expiresIn: "1h",
  });
  res.json({
   token,
   user: {
    id: user._id,
    email,
    name: user.name,
    username: user.username,
    phone: user.phone,
    lastname: user.lastname,
    subscription: user.subscription,
   },
  });
 } catch (error) {
  console.error("Login error:", error);
  res.status(500).json({ error: "Login failed" });
 }
});

// Subscription Status Route
app.get("/subscription/status", authenticateToken, async (req, res) => {
 const result = await checkSubscriptionStatus(req.user?.id);
 res.json(result);
});

// OpenAI Routes
app.get("/thread", authenticateToken, async (req, res) => {
 try {
  let thread;
  if (req.user) {
   const existingThread = await Thread.findOne({ userId: req.user.id });
   if (existingThread) {
    console.log(
     `Found existing thread for user ${req.user.id}: ${existingThread.threadId}`
    );
    return res.json({ threadId: existingThread.threadId });
   }
   thread = await createThread(req.user.id);
  } else {
   thread = await createThread();
  }
  res.json({ threadId: thread.id });
 } catch (error) {
  console.error("Error in /thread endpoint:", error);
  res.status(500).json({ error: "Failed to create thread" });
 }
});

app.get("/thread/messages/:threadId", authenticateToken, async (req, res) => {
 const { threadId } = req.params;
 try {
  const thread = await Thread.findOne(
   req.user ? { userId: req.user.id, threadId } : { threadId }
  );
  if (!thread) {
   console.log(
    `Thread ${threadId} not found for user: ${
     req.user?.id || "unauthenticated"
    }`
   );
   return res.status(400).json({ error: "Invalid threadId" });
  }
  const messagesList = await openai.beta.threads.messages.list(threadId);
  const messages = messagesList.data
   .map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content
     .filter((content) => content.type === "text")
     .map((content) => content.text.value)
     .join("\n")
     .trim(),
    createdAt: msg.created_at,
   }))
   .sort((a, b) => a.createdAt - b.createdAt); // Oldest first
  res.json({ messages });
 } catch (error) {
  console.error("Error in /thread/messages/:threadId endpoint:", error);
  res.status(500).json({ error: "Failed to fetch messages" });
 }
});

app.post("/message", authenticateToken, async (req, res) => {
 const { message, threadId } = req.body;

 try {
  const thread = await Thread.findOne(
   req.user ? { userId: req.user.id, threadId } : { threadId }
  );
  if (!threadId || !thread) {
   return res.status(400).json({ error: "Invalid or missing threadId" });
  }

  await addMessage(threadId, message);
  const run = await runAssistant(threadId);
  const runId = run.id;

  const maxAttempts = 20;
  let attempts = 0;
  const pollInterval = 1000;

  const pollStatus = setInterval(async () => {
   attempts++;
   const runStatus = await getRunStatus(threadId, runId);

   if (runStatus.status === "completed") {
    clearInterval(pollStatus);
    const latestMessage = await getLatestAssistantMessage(threadId);
    io.to(threadId).emit("newMessage", latestMessage);
    res.json({ messages: [latestMessage] });
   } else if (runStatus.status === "failed" || attempts >= maxAttempts) {
    clearInterval(pollStatus);
    res.status(500).json({ error: "Assistant processing failed or timed out" });
   }
  }, pollInterval);
 } catch (error) {
  console.error("Error in /message endpoint:", error);
  res.status(500).json({ error: "Internal server error" });
 }
});

app.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
 try {
  const { threadId, query } = req.body;
  const file = req.file;

  if (!threadId || !file) {
   return res.status(400).json({ error: "Thread ID and file are required" });
  }

  const thread = await Thread.findOne({ userId: req.user.id, threadId });
  if (!thread) {
   return res.status(400).json({ error: "Invalid threadId" });
  }

  const fileContent = await extractFileContent(file.path, file.originalname);
  const validation = await validateContent(fileContent);
  let message;

  if (validation.isValid) {
   message = `File uploaded: ${
    file.originalname
   }\nContent:\n${fileContent}\n\nUser query: ${
    query ||
    "No specific query provided. Please ask me anything about this file!"
   }`;
  } else {
   message = `File uploaded: ${file.originalname}\nThis file does not appear to be related to healthcare, finance, marketing, or Healthematics' services. Explanation: ${validation.explanation}\nI can only assist with relevant topics.`;
  }

  await fs.unlink(file.path);
  await addMessage(threadId, message);
  const run = await runAssistant(threadId);
  const runId = run.id;

  const maxAttempts = 20;
  let attempts = 0;
  const pollInterval = 1000;

  const pollStatus = setInterval(async () => {
   attempts++;
   const runStatus = await getRunStatus(threadId, runId);

   if (runStatus.status === "completed") {
    clearInterval(pollStatus);
    const latestMessage = await getLatestAssistantMessage(threadId);
    io.to(threadId).emit("newMessage", latestMessage);
    res.json({ messages: [latestMessage] });
   } else if (runStatus.status === "failed" || attempts >= maxAttempts) {
    clearInterval(pollStatus);
    res.status(500).json({ error: "Assistant processing failed or timed out" });
   }
  }, pollInterval);
 } catch (error) {
  console.error("Error in /upload endpoint:", error);
  res.status(500).json({
   error: `Failed to process file: ${error.message || "Unknown error"}`,
  });
 }
});

// Test Email Route
app.get("/test-email", async (req, res) => {
 try {
  const mailOptions = {
   from: EMAIL_USER,
   to: "test@example.com", // Replace with a valid email for testing
   subject: "Test Email",
   text: "This is a test email from Healthematics.",
  };
  await transporter.sendMail(mailOptions);
  res.send("Email sent successfully");
 } catch (error) {
  console.error("Test email error:", error.message);
  res.status(500).send(`Failed to send email: ${error.message}`);
 }
});

// Consultation Request Route
app.post("/consultation", requireAuth, async (req, res) => {
 try {
  const { threadId, description } = req.body;
  if (!threadId || !description) {
   return res
    .status(400)
    .json({ error: "Thread ID and description are required" });
  }

  const thread = await Thread.findOne({ userId: req.user.id, threadId });
  if (!thread) {
   return res.status(400).json({ error: "Invalid threadId" });
  }

  const user = await User.findById(req.user.id);
  console.log("req.user:", req.user);
  console.log("Found user:", user);
  if (!user) {
   return res.status(404).json({
    error: "User not found in database. Please re-login or register.",
   });
  }

  const name = user.name || user.username || "Unknown"; // Fallback to username if name is absent
  const email = user.email;

  const consultancyMailOptions = {
   from: EMAIL_USER,
   to: CONSULTANCY_EMAIL,
   subject: "New Consultation Request",
   text: `
        Consultation Request Details:
        Name: ${name}
        Email: ${email}
        Description: ${description}
        
        Please follow up with the user at your earliest convenience.
      `,
  };

  const userMailOptions = {
   from: EMAIL_USER,
   to: email,
   subject: "Your Consultation Request with Healthematics",
   text: `
        Dear ${name},
        
        We've received your consultation request:
        Description: ${description}
        
        Our team will reach out to you soon to schedule a meeting.
        
        Best regards,
        Healthematics Team
      `,
  };

  console.log("Sending email to consultancy...");
  await transporter.sendMail(consultancyMailOptions);
  console.log("Consultancy email sent.");
  console.log("Sending email to user...");
  await transporter.sendMail(userMailOptions);
  console.log("User email sent.");

  const message = `Consultation request submitted successfully!\n\nName: ${name}\nEmail: ${email}\nDescription: ${description}\n\nWe've notified our team, and a copy of this request has been sent to your email. You'll hear from us soon!`;
  await addMessage(threadId, message);
  const run = await runAssistant(threadId);
  const runId = run.id;

  const maxAttempts = 20;
  let attempts = 0;
  const pollInterval = 1000;

  const pollStatus = setInterval(async () => {
   attempts++;
   const runStatus = await getRunStatus(threadId, runId);

   if (runStatus.status === "completed") {
    clearInterval(pollStatus);
    const latestMessage = await getLatestAssistantMessage(threadId);
    io.to(threadId).emit("newMessage", latestMessage);
    res.json({ messages: [latestMessage] });
   } else if (runStatus.status === "failed" || attempts >= maxAttempts) {
    clearInterval(pollStatus);
    res.status(500).json({ error: "Assistant processing failed or timed out" });
   }
  }, pollInterval);
 } catch (error) {
  console.error("Error in /consultation endpoint:", error.message);
  res
   .status(500)
   .json({ error: `Failed to process consultation request: ${error.message}` });
 }
});

// Global Error Handler
app.use((err, req, res, next) => {
 console.error(err.stack);
 res.status(500).json({ error: "Something went wrong!" });
});

// Start Server
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
