const express = require("express");
const {
 getThread,
 getMessages,
 postMessage,
} = require("../controllers/chatController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/thread", authenticateToken, getThread);
router.get("/thread/messages/:threadId", authenticateToken, getMessages);
router.post("/message", authenticateToken, postMessage);

module.exports = router;
