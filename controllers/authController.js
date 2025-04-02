const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { JWT_KEY } = require("../config/env");

const register = async (req, res) => {
 const { email, password, name, username, phone, lastname } = req.body;
 console.log("Register - Request body:", req.body);

 if (!email || !password)
  return res.status(400).json({ error: "Email and password required" });

 try {
  const existingUser = await User.findOne({ email });
  console.log(
   "Register - Existing user check:",
   existingUser ? "Found" : "Not found"
  );
  if (existingUser)
   return res.status(400).json({ error: "User already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);
  console.log("Register - Password hashed");
  const user = new User({
   email,
   password: hashedPassword,
   name,
   username,
   phone,
   lastname,
  });

  const savedUser = await user.save().catch((err) => {
   console.error("Register - Save error:", err.message, "Stack:", err.stack);
   throw new Error("Database save failed: " + err.message);
  });
  if (!savedUser) {
   console.error("Register - No user returned from save");
   throw new Error("Failed to save user to database");
  }
  console.log("Register - User saved successfully:", savedUser);

  const token = jwt.sign({ id: savedUser._id.toString(), email }, JWT_KEY, {
   expiresIn: "1h",
  });
  console.log(
   "Register - User created:",
   { id: savedUser._id.toString(), email },
   "Token:",
   token
  );
  res.json({
   token,
   user: {
    id: savedUser._id,
    email,
    name,
    username,
    phone,
    lastname,
   },
  });
 } catch (error) {
  console.error("Register - Error:", error.message, "Stack:", error.stack);
  res
   .status(500)
   .json({ error: "Failed to register user", details: error.message });
 }
};

const login = async (req, res) => {
 const { email, password } = req.body;
 try {
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password)))
   return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user._id.toString(), email }, JWT_KEY, {
   expiresIn: "1h",
  });
  console.log(
   "Login - User found:",
   { id: user._id.toString(), email },
   "Token:",
   token
  );
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
  console.error("Login - Error:", error.message);
  res.status(500).json({ error: "Failed to log in", details: error.message });
 }
};

const checkSubscription = async (req, res) => {
 if (!req.user?.id)
  return res.json({
   isActive: false,
   subscription: { plan: "free" },
   message: "Not logged in",
  });

 try {
  const user = await User.findById(req.user.id);
  if (!user)
   return res.json({
    isActive: false,
    subscription: { plan: "free" },
    message: "User not found",
   });

  const sub = user.subscription;
  const isActive =
   sub.status === "active" &&
   (!sub.endDate || new Date() <= new Date(sub.endDate));
  res.json({
   isActive,
   subscription: sub,
   message: isActive
    ? "Subscription active"
    : "Subscription inactive or expired",
  });
 } catch (error) {
  console.error("checkSubscription - Error:", error.message);
  res
   .status(500)
   .json({ error: "Failed to check subscription", details: error.message });
 }
};

module.exports = { register, login, checkSubscription };
