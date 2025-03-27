const Thread = require("../models/Thread");
const {
 extractFileContent,
 validateContent,
} = require("../services/fileService");
const {
 addMessage,
 runAssistant,
 getLatestAssistantMessage,
} = require("../services/openai");
const fs = require("fs").promises;

const uploadFile = async (req, res) => {
 const { threadId, query } = req.body;
 const file = req.file;
 if (!threadId || !file)
  return res.status(400).json({ error: "Thread ID and file required" });

 const thread = await Thread.findOne({ userId: req.user.id, threadId });
 if (!thread) return res.status(400).json({ error: "Invalid threadId" });

 if (req.uploadQueue.has(req.user.id))
  return res.status(429).json({ error: "Previous upload still processing" });

 req.uploadQueue.set(req.user.id, true);
 const fileContent = await extractFileContent(file.path, file.originalname);
 const validation = await validateContent(fileContent);
 const message = validation.isValid
  ? `File uploaded: ${
     file.originalname
    }\nContent:\n${fileContent}\n\nUser query: ${
     query || "No query provided. Ask me anything about this file!"
    }`
  : `File uploaded: ${file.originalname}\nNot related to healthcare/finance/marketing/Healthematics: ${validation.explanation}`;

 await fs.unlink(file.path);
 await addMessage(threadId, message, req.user.id);
 const run = await runAssistant(threadId);
 const runId = run.id;

 let attempts = 0;
 const maxAttempts = 20;
 const pollInterval = setInterval(async () => {
  attempts++;
  const runStatus = await getRunStatus(threadId, runId);
  if (runStatus.status === "completed") {
   clearInterval(pollInterval);
   const latestMessage = await getLatestAssistantMessage(threadId, req.user.id);
   req.io.to(threadId).emit("newMessage", latestMessage);
   res.json({ messages: [latestMessage] });
   req.uploadQueue.delete(req.user.id);
  } else if (runStatus.status === "failed" || attempts >= maxAttempts) {
   clearInterval(pollInterval);
   res.status(runStatus.status === "failed" ? 500 : 408).json({
    error: runStatus.status === "failed" ? "Assistant failed" : "Timed out",
   });
   req.uploadQueue.delete(req.user.id);
  }
 }, 500);
};

module.exports = { uploadFile };
