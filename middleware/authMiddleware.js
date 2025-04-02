const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { JWT_KEY } = require("../config/env");
const mongoose = require("mongoose");

const authenticateToken = (req, res, next) => {
 const token = req.headers["authorization"]?.split(" ")[1];
 console.log("authenticateToken - Token:", token);
 if (!token) {
  req.user = null;
  return next();
 }

 jwt.verify(token, JWT_KEY, (err, user) => {
  if (err) {
   console.error("authenticateToken - Token verification failed:", err.message);
   return res.status(403).json({ error: "Invalid token" });
  }
  req.user = user;
  next();
 });
};

const requireAuth = async (req, res, next) => {
 const token = req.headers["authorization"]?.split(" ")[1];
 console.log("requireAuth - Token received:", token);
 if (!token) {
  return res.status(401).json({
   error: "Authentication required",
   content:
    "Error: Could not submit consultation. Please ensure you are logged in.",
  });
 }

 try {
  const decoded = jwt.verify(token, JWT_KEY);
  console.log("requireAuth - Decoded token:", decoded);
  // Fix: Use 'new' to instantiate ObjectId
  const userId = new mongoose.Types.ObjectId(decoded.id);
  let user = await User.findById(userId);
  console.log("requireAuth - User by ID:", user ? user : "Not found");

  if (!user && decoded.email) {
   console.log("requireAuth - ID not found, trying email:", decoded.email);
   user = await User.findOne({ email: decoded.email });
   if (!user) {
    console.log("requireAuth - User not found for email:", decoded.email);
    return res.status(401).json({
     error: "User not found",
     content: "Error: User not found. Please log in again.",
    });
   }
   console.log("requireAuth - User found by email, ID:", user._id.toString());
  }

  if (!user) {
   console.log("requireAuth - User not found for ID:", decoded.id);
   return res.status(401).json({
    error: "User not found",
    content: "Error: User not found. Please log in again.",
   });
  }

  if (decoded.email && user.email !== decoded.email) {
   console.log(
    "requireAuth - Email mismatch:",
    user.email,
    "vs",
    decoded.email
   );
   return res.status(401).json({
    error: "Token email mismatch",
    content: "Error: Token email does not match user. Please log in again.",
   });
  }

  req.user = { id: user._id.toString(), email: user.email };
  console.log("requireAuth - User validated:", req.user);
  next();
 } catch (err) {
  console.error("requireAuth - Token verification error:", err.message);
  res.status(403).json({
   error: "Invalid or expired token",
   content: `Error: Invalid or expired token. Please log in again. (${err.message})`,
  });
 }
};

module.exports = { authenticateToken, requireAuth };
