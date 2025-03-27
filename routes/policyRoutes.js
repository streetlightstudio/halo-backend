const express = require("express");
const {
 getPolicy,
 fetchPolicyDetails,
 fetchPolicyById,
} = require("../controllers/policyController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/api/policy", authenticateToken, getPolicy);
router.get("/api/policy/details", authenticateToken, fetchPolicyDetails);
router.get("/policies/4/6/:id", authenticateToken, fetchPolicyById);

module.exports = router;
