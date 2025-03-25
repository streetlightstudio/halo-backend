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
const cookieParser = require("cookie-parser");

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
app.use(cookieParser());
app.use(
 rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
 })
);

// MongoDB Connection
mongoose
 .connect(MONGO)
 .then(() => console.log("Connected to MongoDB"))
 .catch((err) => console.error("MongoDB connection error:", err));

// User Schema
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
 badge: { enum: [Array] },
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
 userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
 threadId: { type: String, required: true },
 createdAt: { type: Date, default: Date.now },
});

const Thread = mongoose.model("Thread", threadSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
 userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
 threadId: { type: String, required: true },
 role: { type: String, enum: ["user", "assistant"], required: true },
 content: { type: String, required: true },
 createdAt: { type: Date, default: Date.now },
});

const Message = mongoose.model("Message", messageSchema);

// Policy Data
const policyData = require("./data/policies.json"); // Adjust path as needed

// PolicyFinder Class
class PolicyFinder {
 constructor(policyData) {
  this.policyData = policyData;
 }

 findPolicyId(searchTerm) {
  const searchLower = searchTerm.toLowerCase().trim();
  console.log(`Searching for policy with term: "${searchLower}"`);

  const matchingPolicy = this.policyData.data.find((policy) => {
   const name = policy.policyName.name?.toLowerCase() || "";
   const desc = policy.policyName.desc?.toLowerCase() || "";
   const subCat = policy.pSubId.name?.toLowerCase() || "";

   const matches =
    name.includes(searchLower) ||
    desc.includes(searchLower) ||
    subCat.includes(searchLower) ||
    name.split(" ").some((word) => word.startsWith(searchLower)) ||
    desc.split(" ").some((word) => word.startsWith(searchLower)) ||
    subCat.split(" ").some((word) => word.startsWith(searchLower));

   if (matches) {
    console.log(`Found match: ${policy.policyName.name}`);
   }
   return matches;
  });

  if (matchingPolicy) {
   return `https://healthematics.com/policies/4/6/${matchingPolicy._id}`;
  } else {
   console.log(`No policy found for "${searchLower}"`);
   return null;
  }
 }

 getPolicyUrl(searchTerm) {
  try {
   const policyUrl = this.findPolicyId(searchTerm);
   if (policyUrl) {
    return {
     status: "success",
     url: policyUrl,
     message: "Policy found",
    };
   }
   return {
    status: "error",
    message: `No matching policy found for "${searchTerm}". Try a different term.`,
   };
  } catch (error) {
   console.error("Error in getPolicyUrl:", error.message);
   return {
    status: "error",
    message: `Error processing request: ${error.message}`,
   };
  }
 }

 getPolicyDetails(searchTerm) {
  const searchLower = searchTerm.toLowerCase().trim();
  console.log(`Fetching details for policy with term: "${searchLower}"`);

  const matchingPolicy = this.policyData.data.find((policy) => {
   const name = policy.policyName.name?.toLowerCase() || "";
   const desc = policy.policyName.desc?.toLowerCase() || "";
   const subCat = policy.pSubId.name?.toLowerCase() || "";

   return (
    name.includes(searchLower) ||
    desc.includes(searchLower) ||
    subCat.includes(searchLower) ||
    name.split(" ").some((word) => word.startsWith(searchLower)) ||
    desc.split(" ").some((word) => word.startsWith(searchLower)) ||
    subCat.split(" ").some((word) => word.startsWith(searchLower))
   );
  });

  if (!matchingPolicy) {
   return {
    status: "error",
    message: "No matching policy found.",
   };
  }

  return {
   status: "success",
   policy: {
    name: matchingPolicy.policyName.name,
    description: matchingPolicy.policyName.desc,
    category: matchingPolicy.pCategoryId.name,
    subcategory: matchingPolicy.pSubId.name,
    url: `http://localhost:${PORT}/policies/4/6/${matchingPolicy._id}`,
    created: new Date(matchingPolicy.policyName.createdAt).toLocaleDateString(),
   },
  };
 }

 getPolicyById(policyId) {
  const policy = this.policyData.data.find((p) => p._id === policyId);
  if (policy) {
   console.log(`Found policy by ID: ${policy.policyName.name}`);
   return { status: "success", policy };
  } else {
   console.log(`No policy found for ID: ${policyId}`);
   return { status: "error", message: "Policy not found" };
  }
 }
}

const policyFinder = new PolicyFinder(policyData);

// Middleware to verify JWT and validate user existence
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

// Middleware to require authentication and ensure user exists
const requireAuth = async (req, res, next) => {
 const authHeader = req.headers["authorization"];
 const token = authHeader && authHeader.split(" ")[1];

 if (!token) {
  return res.status(401).json({ error: "Authentication required" });
 }

 try {
  const decoded = jwt.verify(token, JWT_KEY);
  const user = await User.findById(decoded.id);
  if (!user) {
   return res.status(401).json({
    error: "User not found in database. Please re-login or register.",
   });
  }
  req.user = { id: user._id.toString(), email: user.email };
  next();
 } catch (err) {
  console.error("Token verification error:", err.message);
  return res.status(403).json({ error: "Invalid or expired token" });
 }
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

// Upload Queue
const uploadQueue = new Map();

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

async function addMessage(threadId, message, userId) {
 console.log("Adding message to thread: " + threadId);
 const openaiMessage = await openai.beta.threads.messages.create(threadId, {
  role: "user",
  content: message,
 });

 if (userId) {
  const newMessage = new Message({
   userId,
   threadId,
   role: "user",
   content: message,
   createdAt: new Date(openaiMessage.created_at * 1000),
  });
  await newMessage.save();
 }

 return openaiMessage;
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

async function getLatestAssistantMessage(threadId, userId) {
 const messagesList = await openai.beta.threads.messages.list(threadId);
 const latestAssistantMessage = messagesList.data.find(
  (msg) => msg.role === "assistant"
 );

 const messageContent = latestAssistantMessage
  ? {
     role: "assistant",
     content: latestAssistantMessage.content
      .filter((content) => content.type === "text")
      .map((content) => content.text.value)
      .join("\n")
      .trim(),
    }
  : { role: "assistant", content: "I'm here to help. How can I assist you?" };

 if (userId && latestAssistantMessage) {
  const newMessage = new Message({
   userId,
   threadId,
   role: "assistant",
   content: messageContent.content,
   createdAt: new Date(latestAssistantMessage.created_at * 1000),
  });
  await newMessage.save();
 }

 return messageContent;
}

// Function to use OpenAI to extract policy search term
async function extractPolicySearchTerm(userInput) {
 const prompt = `
    Analyze the following user input and determine if they are asking to find a policy. If so, extract the specific policy topic or keyword they are looking for. Return the result in JSON format with two fields:
    - "isPolicyRequest": boolean (true if it's a policy request, false otherwise)
    - "searchTerm": string (the policy topic or keyword, or empty string if not a policy request)

    Input: "${userInput}"
  `;

 try {
  const response = await openai.chat.completions.create({
   model: "gpt-3.5-turbo",
   messages: [{ role: "user", content: prompt }],
   max_tokens: 100,
   temperature: 0.3, // Lower temperature for more precise extraction
  });

  const result = JSON.parse(response.choices[0].message.content.trim());
  console.log(`OpenAI policy extraction result: ${JSON.stringify(result)}`);
  return result;
 } catch (error) {
  console.error("Error extracting policy search term:", error.message);
  return { isPolicyRequest: false, searchTerm: "" };
 }
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
   const tempThreadId = req.cookies.tempThreadId;
   if (tempThreadId && (await Thread.findOne({ threadId: tempThreadId }))) {
    console.log(
     `Reusing temp thread for unauthenticated user: ${tempThreadId}`
    );
    return res.json({ threadId: tempThreadId });
   }
   thread = await createThread();
   res.cookie("tempThreadId", thread.id, {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
   });
  }
  res.json({ threadId: thread.id });
 } catch (error) {
  console.error("Error in /thread endpoint:", error);
  res
   .status(500)
   .json({ error: "Failed to create thread. Please try again later." });
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

  const messages = await Message.find({ threadId })
   .sort({ createdAt: 1 })
   .lean()
   .exec();
  res.json({ messages });
 } catch (error) {
  console.error("Error in /thread/messages/:threadId endpoint:", error);
  res
   .status(500)
   .json({ error: "Failed to fetch messages. Please try again." });
 }
});

app.post("/message", authenticateToken, async (req, res) => {
 const { message, threadId } = req.body;

 try {
  const thread = await Thread.findOne(
   req.user ? { userId: req.user.id, threadId } : { threadId }
  );
  if (!threadId || !thread) {
   return res
    .status(400)
    .json({ error: "No active conversation found. Please start a new chat." });
  }

  const userId = req.user ? req.user.id : null;

  // Use OpenAI to analyze the user input
  const policyAnalysis = await extractPolicySearchTerm(message);
  let responseMessage;

  if (policyAnalysis.isPolicyRequest && policyAnalysis.searchTerm) {
   console.log(`Detected policy request for: "${policyAnalysis.searchTerm}"`);
   const policyResult = policyFinder.getPolicyUrl(policyAnalysis.searchTerm);
   responseMessage =
    policyResult.status === "success"
     ? `Found a policy: ${policyResult.url}`
     : policyResult.message;
  } else {
   responseMessage = message;
  }

  await addMessage(threadId, responseMessage, userId);
  const run = await runAssistant(threadId);
  const runId = run.id;

  const maxAttempts = 20;
  let attempts = 0;
  const pollInterval = 500;

  const pollStatus = setInterval(async () => {
   attempts++;
   try {
    const runStatus = await getRunStatus(threadId, runId);

    if (runStatus.status === "completed") {
     clearInterval(pollStatus);
     const latestMessage = await getLatestAssistantMessage(threadId, userId);
     io.to(threadId).emit("newMessage", latestMessage);
     console.log("Sending response");
     res.json({ messages: [latestMessage] });
    } else if (runStatus.status === "failed") {
     clearInterval(pollStatus);
     res.status(500).json({ error: "Assistant processing failed" });
    } else if (attempts >= maxAttempts) {
     clearInterval(pollStatus);
     res.status(408).json({ error: "Assistant processing timed out" });
    }
   } catch (pollError) {
    clearInterval(pollStatus);
    console.error("Error during polling:", pollError.message);
    res.status(500).json({ error: "Polling error occurred" });
   }
  }, pollInterval);
 } catch (error) {
  console.error("Error in /message endpoint:", error);
  res.status(500).json({
   error: error.message.includes("network")
    ? "Network issue detected. Please check your connection and try again."
    : "Something went wrong. Please try again later or contact support.",
  });
 }
});

// Policy Routes
app.get("/api/policy", authenticateToken, async (req, res) => {
 const { search } = req.query;
 if (!search) {
  return res.status(400).json({
   status: "error",
   message: "Search term is required",
  });
 }
 const result = policyFinder.getPolicyUrl(search);
 res.json(result);
});

app.get("/api/policy/details", authenticateToken, async (req, res) => {
 const { search } = req.query;
 if (!search) {
  return res.status(400).json({
   status: "error",
   message: "Search term is required",
  });
 }
 const result = policyFinder.getPolicyDetails(search);
 res.json(result);
});

app.get("/policies/4/6/:id", authenticateToken, async (req, res) => {
 const policyId = req.params.id;
 const result = policyFinder.getPolicyById(policyId);
 if (result.status === "success") {
  res.json(result);
 } else {
  res.status(404).json(result);
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

  if (uploadQueue.has(req.user.id)) {
   return res
    .status(429)
    .json({ error: "Please wait, your previous upload is still processing." });
  }
  uploadQueue.set(req.user.id, true);

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
  await addMessage(threadId, message, req.user.id);
  const run = await runAssistant(threadId);
  const runId = run.id;

  const maxAttempts = 20;
  let attempts = 0;
  const pollInterval = 500;

  const pollStatus = setInterval(async () => {
   attempts++;
   const runStatus = await getRunStatus(threadId, runId);

   if (runStatus.status === "completed") {
    clearInterval(pollStatus);
    const latestMessage = await getLatestAssistantMessage(
     threadId,
     req.user.id
    );
    io.to(threadId).emit("newMessage", latestMessage);
    res.json({ messages: [latestMessage] });
    uploadQueue.delete(req.user.id);
   } else if (runStatus.status === "failed") {
    clearInterval(pollStatus);
    res.status(500).json({ error: "Assistant processing failed" });
    uploadQueue.delete(req.user.id);
   } else if (attempts >= maxAttempts) {
    clearInterval(pollStatus);
    res.status(408).json({ error: "Assistant processing timed out" });
    uploadQueue.delete(req.user.id);
   }
  }, pollInterval);
 } catch (error) {
  uploadQueue.delete(req.user.id);
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
   to: "test@example.com",
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
  const name = user.name || user.username || "Unknown";
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
  await addMessage(threadId, message, req.user.id);
  const run = await runAssistant(threadId);
  const runId = run.id;

  const maxAttempts = 20;
  let attempts = 0;
  const pollInterval = 500;

  const pollStatus = setInterval(async () => {
   attempts++;
   const runStatus = await getRunStatus(threadId, runId);

   if (runStatus.status === "completed") {
    clearInterval(pollStatus);
    const latestMessage = await getLatestAssistantMessage(
     threadId,
     req.user.id
    );
    io.to(threadId).emit("newMessage", latestMessage);
    res.json({ messages: [latestMessage] });
   } else if (runStatus.status === "failed") {
    clearInterval(pollStatus);
    res.status(500).json({ error: "Assistant processing failed" });
   } else if (attempts >= maxAttempts) {
    clearInterval(pollStatus);
    res.status(408).json({ error: "Assistant processing timed out" });
   }
  }, pollInterval);
 } catch (error) {
  console.error("Error in /consultation endpoint:", error.message);
  res.status(500).json({
   error: `Failed to process consultation request: ${error.message}`,
  });
 }
});

// Global Error Handler
app.use((err, req, res, next) => {
 console.error(err.stack);
 res.status(500).json({ error: "Something went wrong! Please try again." });
});

// Start Server
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
