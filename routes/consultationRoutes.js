const express = require("express");
const {
 requestConsultation,
} = require("../controllers/consultationController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/consultation", requireAuth, requestConsultation);

module.exports = router;
