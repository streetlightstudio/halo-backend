const rateLimit = require("express-rate-limit");

const chatRateLimiter = rateLimit({
 windowMs: 15 * 60 * 1000, // 15 minutes
 max: 100, // Limit each IP to 100 requests per window
 message: "Too many chat requests from this IP, please try again later.",
 standardHeaders: true,
 legacyHeaders: false,
});

module.exports = chatRateLimiter;
