const Thread = require("../models/Thread");
const Message = require("../models/Message");
const {
 createThread,
 addMessage,
 runAssistant,
 getRunStatus,
 getLatestAssistantMessage,
 extractPolicySearchTerm,
 findBestPolicyMatch,
} = require("../services/openai");
const { getPolicyUrl } = require("../services/policyService");

const getThread = async (req, res) => {
 if (req.user) {
  const thread = await Thread.findOne({ userId: req.user.id });
  if (thread) return res.json({ threadId: thread.threadId });
  const newThread = await createThread(req.user.id);
  return res.json({ threadId: newThread.id });
 }

 const tempThreadId = req.cookies.tempThreadId;
 if (tempThreadId) return res.json({ threadId: tempThreadId });
 const thread = await createThread();
 res.cookie("tempThreadId", thread.id, {
  httpOnly: true,
  maxAge: 24 * 60 * 60 * 1000,
 });
 res.json({ threadId: thread.id });
};

const getMessages = async (req, res) => {
 const { threadId } = req.params;
 if (req.user) {
  const thread = await Thread.findOne({ userId: req.user.id, threadId });
  if (!thread) return res.status(400).json({ error: "Invalid threadId" });
  const messages = await Message.find({ threadId })
   .sort({ createdAt: 1 })
   .lean();
  return res.json({ messages });
 }

 if (req.cookies.tempThreadId === threadId) return res.json({ messages: [] });
 res.status(400).json({ error: "Invalid threadId" });
};

const postMessage = async (req, res) => {
 const { message, threadId } = req.body;
 console.log("Received request:", { message, threadId, user: req.user?.id });
 const userId = req.user?.id || null;
 let thread = userId
  ? await Thread.findOne({ userId, threadId })
  : req.cookies.tempThreadId === threadId
  ? { threadId }
  : null;

 if (!thread) {
  console.log("Thread not found for:", { userId, threadId });
  return res.status(400).json({ error: "No active conversation found" });
 }

 const policyAnalysis = await extractPolicySearchTerm(message);
 if (policyAnalysis.isPolicyRequest) {
  const bestMatch = await findBestPolicyMatch(message);
  let responseMessage;
  let responseData = { role: "assistant" };

  if (bestMatch.policyId) {
   const policyResult = await getPolicyUrl(bestMatch.policyName);
   if (policyResult.status === "success") {
    responseMessage = `Here’s the best matching policy: ${bestMatch.policyName} - ${policyResult.url}\nReason: ${bestMatch.reason}`;
    responseData.content = responseMessage;
    responseData.url = policyResult.url;
    responseData.policyName = bestMatch.policyName;
    responseData.reason = bestMatch.reason;
   } else {
    console.error("getPolicyUrl failed:", policyResult.message);
    responseMessage = `I found a matching policy (${bestMatch.policyName}), but couldn’t retrieve its URL: ${policyResult.message}`;
    responseData.content = responseMessage;
   }
  } else {
   responseMessage = `I couldn’t find a specific policy matching your request. For a list of available policies, visit [Healthematics Policies](https://healthematics.com/policies). Reason: ${bestMatch.reason}`;
   responseData.content = responseMessage;
  }

  console.log("Backend response:", responseData);
  await addMessage(threadId, message, userId);
  if (userId) {
   await new Message({ userId, threadId, ...responseData }).save();
  }
  req.io.to(threadId).emit("newMessage", responseData);
  return res.json({ messages: [responseData] });
 }

 await addMessage(threadId, message, userId);
 const run = await runAssistant(threadId);
 const runId = run.id;

 let attempts = 0;
 const maxAttempts = 20;
 const pollInterval = setInterval(async () => {
  attempts++;
  const runStatus = await getRunStatus(threadId, runId);
  if (runStatus.status === "completed") {
   clearInterval(pollInterval);
   const latestMessage = await getLatestAssistantMessage(threadId, userId);
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
