// controllers/chatController.js
const Thread = require("../models/Thread");
const Message = require("../models/Message");
const {
 createThread,
 addMessage,
 runAssistant,
 getRunStatus,
 getLatestAssistantMessage,
 extractPolicySearchTerm,
} = require("../services/openai");
const { getPolicyUrl } = require("../services/policyService");

const getThread = async (req, res) => {
 if (req.user) {
  let thread = await Thread.findOne({ userId: req.user.id });
  if (thread) {
   console.log(
    `Found existing thread for user ${req.user.id}: ${thread.threadId}`
   );
   return res.json({ threadId: thread.threadId });
  }
  const newThread = await createThread(req.user.id);
  console.log(`Created new thread for user ${req.user.id}: ${newThread.id}`);
  return res.json({ threadId: newThread.id });
 }

 const tempThreadId = req.cookies.tempThreadId;
 if (tempThreadId) {
  console.log(
   `Using existing tempThreadId for unauthenticated user: ${tempThreadId}`
  );
  return res.json({ threadId: tempThreadId });
 }
 const thread = await createThread();
 console.log(`Created new tempThreadId for unauthenticated user: ${thread.id}`);
 res.cookie("tempThreadId", thread.id, {
  httpOnly: true,
  maxAge: 24 * 60 * 60 * 1000,
  sameSite: "lax",
 });
 res.json({ threadId: thread.id });
};

const getMessages = async (req, res) => {
 const { threadId } = req.params;
 console.log(
  `Fetching messages for threadId: ${threadId}, User: ${
   req.user ? req.user.id : "Unauthenticated"
  }`
 );
 if (req.user) {
  const thread = await Thread.findOne({ userId: req.user.id, threadId });
  if (!thread) {
   console.log(
    `No thread found for user ${req.user.id} with threadId ${threadId}, returning empty array`
   );
   return res.json({ messages: [] });
  }
  const messages = await Message.find({ threadId })
   .sort({ createdAt: 1 })
   .lean();
  console.log(`Found ${messages.length} messages for threadId ${threadId}`);
  return res.json({ messages });
 }

 console.log(`Checking tempThreadId cookie: ${req.cookies.tempThreadId}`);
 if (req.cookies.tempThreadId === threadId) {
  console.log(
   `tempThreadId matches, returning empty array for threadId ${threadId}`
  );
  return res.json({ messages: [] });
 }
 console.log(`tempThreadId does not match threadId ${threadId}, returning 400`);
 res.status(400).json({ error: "Invalid threadId" });
};

const postMessage = async (req, res) => {
 const { message, threadId } = req.body;
 const userId = req.user?.id || null;
 console.log(
  `Posting message to threadId: ${threadId}, User: ${
   userId || "Unauthenticated"
  }`
 );
 let thread = userId
  ? await Thread.findOne({ userId, threadId })
  : req.cookies.tempThreadId === threadId
  ? { threadId }
  : null;

 if (!thread) {
  console.log(`No active conversation found for threadId ${threadId}`);
  return res.status(400).json({ error: "No active conversation found" });
 }

 const policyAnalysis = await extractPolicySearchTerm(message);
 const responseMessage =
  policyAnalysis.isPolicyRequest && policyAnalysis.searchTerm
   ? (await getPolicyUrl(policyAnalysis.searchTerm)).status === "success"
     ? `Found a policy: ${(await getPolicyUrl(policyAnalysis.searchTerm)).url}`
     : (await getPolicyUrl(policyAnalysis.searchTerm)).message
   : message;

 await addMessage(threadId, responseMessage, userId);
 const run = await runAssistant(threadId);
 const runId = run.id;

 let hasEmitted = false; // Flag to prevent multiple emissions
 let attempts = 0;
 const maxAttempts = 20;
 const pollInterval = setInterval(async () => {
  attempts++;
  console.log(
   `Checking run status for threadId ${threadId}, attempt ${attempts}`
  );
  const runStatus = await getRunStatus(threadId, runId);
  if (runStatus.status === "completed" && !hasEmitted) {
   clearInterval(pollInterval);
   hasEmitted = true;
   const latestMessage = await getLatestAssistantMessage(threadId, userId);
   console.log(`Emitting newMessage for threadId ${threadId}:`, latestMessage);
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

module.exports = { getThread, getMessages, postMessage };
