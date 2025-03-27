require("dotenv").config();

module.exports = {
 OPENAI_API_KEY: process.env.OPENAI_API_KEY,
 ASSISTANT_ID: process.env.ASSISTANT_ID,
 JWT_KEY: process.env.JWT_KEY,
 MONGO: process.env.MONGO,
 PORT: process.env.PORT || 3001,
 FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
 EMAIL_USER: process.env.EMAIL_USER,
 EMAIL_PASS: process.env.EMAIL_PASS,
 CONSULTANCY_EMAIL: process.env.CONSULTANCY_EMAIL,
};
