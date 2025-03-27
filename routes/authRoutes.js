const express = require("express");
const {
 register,
 login,
 checkSubscription,
} = require("../controllers/authController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/subscription/status", authenticateToken, checkSubscription);

module.exports = router;
