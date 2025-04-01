const express = require("express");
const {
 requestConsultation,
} = require("../controllers/consultationController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/consultation", requireAuth, (req, res, next) => {
 console.log("Consultation Route - Request Body:", req.body, "User:", req.user);
 requestConsultation(req, res, next);
});

module.exports = router;
