const express = require("express");
const {
 getThread,
 getMessages,
 postMessage,
} = require("../controllers/chatController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { extractPolicySearchTerm } = require("../services/openai");

const router = express.Router();

router.get("/thread", authenticateToken, getThread);
router.get("/thread/messages/:threadId", authenticateToken, getMessages);
router.post("/message", authenticateToken, postMessage);

// Temporary test endpoint for policy extraction
router.get("/test-policy", async (req, res) => {
 const result = await extractPolicySearchTerm(
  "Can you find me a privacy policy?"
 );
 res.json(result);
});

module.exports = router;
