const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { JWT_KEY } = require("../config/env");

const authenticateToken = (req, res, next) => {
 const token = req.headers["authorization"]?.split(" ")[1];
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

const requireAuth = async (req, res, next) => {
 const token = req.headers["authorization"]?.split(" ")[1];
 if (!token) return res.status(401).json({ error: "Authentication required" });

 try {
  const decoded = jwt.verify(token, JWT_KEY);
  const user = await User.findById(decoded.id);
  if (!user) {
   return res.status(401).json({ error: "User not found" });
  }
  req.user = { id: user._id.toString(), email: user.email };
  next();
 } catch (err) {
  res.status(403).json({ error: "Invalid or expired token" });
 }
};

module.exports = { authenticateToken, requireAuth };
