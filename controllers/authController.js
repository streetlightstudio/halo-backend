const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { JWT_KEY } = require("../config/env");

const register = async (req, res) => {
 const { email, password, name, username, phone, lastname } = req.body;
 if (!email || !password)
  return res.status(400).json({ error: "Email and password required" });

 if (await User.findOne({ email }))
  return res.status(400).json({ error: "User already exists" });

 const hashedPassword = await bcrypt.hash(password, 10);
 const user = await new User({
  email,
  password: hashedPassword,
  name,
  username,
  phone,
  lastname,
 }).save();

 const token = jwt.sign({ id: user._id, email }, JWT_KEY, { expiresIn: "1h" });
 res.json({
  token,
  user: { id: user._id, email, name, username, phone, lastname },
 });
};

const login = async (req, res) => {
 const { email, password } = req.body;
 const user = await User.findOne({ email });
 if (!user || !(await bcrypt.compare(password, user.password)))
  return res.status(401).json({ error: "Invalid credentials" });

 const token = jwt.sign({ id: user._id, email }, JWT_KEY, { expiresIn: "1h" });
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
};

const checkSubscription = async (req, res) => {
 if (!req.user?.id)
  return res.json({
   isActive: false,
   subscription: { plan: "free" },
   message: "Not logged in",
  });

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
};

module.exports = { register, login, checkSubscription };
