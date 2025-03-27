const Thread = require("../models/Thread");
const User = require("../models/User");
const { sendEmail } = require("../services/emailService");
const {
 addMessage,
 runAssistant,
 getLatestAssistantMessage,
} = require("../services/openai");
const { CONSULTANCY_EMAIL } = require("../config/env");

const requestConsultation = async (req, res) => {
 const { threadId, description } = req.body;
 if (!threadId || !description)
  return res.status(400).json({ error: "Thread ID and description required" });

 const thread = await Thread.findOne({ userId: req.user.id, threadId });
 if (!thread) return res.status(400).json({ error: "Invalid threadId" });

 const user = await User.findById(req.user.id);
 const name = user.name || user.username || "Unknown";
 const email = user.email;

 await sendEmail({
  from: process.env.EMAIL_USER,
  to: CONSULTANCY_EMAIL,
  subject: "New Consultation Request",
  text: `Name: ${name}\nEmail: ${email}\nDescription: ${description}\nPlease follow up.`,
 });

 await sendEmail({
  from: process.env.EMAIL_USER,
  to: email,
  subject: "Your Consultation Request with Healthematics",
  text: `Dear ${name},\n\nWe've received your request:\nDescription: ${description}\n\nWe'll reach out soon.\n\nBest,\nHealthematics Team`,
 });

 const message = `Consultation request submitted!\n\nName: ${name}\nEmail: ${email}\nDescription: ${description}\n\nTeam notified, email sent.`;
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
  } else if (runStatus.status === "failed" || attempts >= maxAttempts) {
   clearInterval(pollInterval);
   res.status(runStatus.status === "failed" ? 500 : 408).json({
    error: runStatus.status === "failed" ? "Assistant failed" : "Timed out",
   });
  }
 }, 500);
};

module.exports = { requestConsultation };
