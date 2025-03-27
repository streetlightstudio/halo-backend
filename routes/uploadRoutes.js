const express = require("express");
const { uploadFile } = require("../controllers/uploadController");
const { requireAuth } = require("../middleware/authMiddleware");
const multer = require("multer");

const upload = multer({ dest: "uploads/" });
const router = express.Router();

router.post("/upload", requireAuth, upload.single("file"), uploadFile);

module.exports = router;
