require("dotenv").config();
const OpenAI = require("openai");
const express = require("express");
const cors = require("cors");
const { OPENAI_API_KEY, ASSISTANT_ID } = process.env;

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
 apiKey: OPENAI_API_KEY,
});

const assistantId = ASSISTANT_ID;
const threads = new Map();

async function createThread() {
 console.log("Creating a new thread...");
 const thread = await openai.beta.threads.create();
 return thread;
}

async function addMessage(threadId, message) {
 console.log("Adding message to thread: " + threadId);
 return await openai.beta.threads.messages.create(threadId, {
  role: "user",
  content: message,
 });
}

async function runAssistant(threadId) {
 console.log("Running assistant for thread: " + threadId);
 return await openai.beta.threads.runs.create(threadId, {
  assistant_id: assistantId,
 });
}

async function getRunStatus(threadId, runId) {
 return await openai.beta.threads.runs.retrieve(threadId, runId);
}

async function getLatestAssistantMessage(threadId) {
 const messagesList = await openai.beta.threads.messages.list(threadId);
 // Get only the most recent assistant message
 const latestAssistantMessage = messagesList.data.find(
  (msg) => msg.role === "assistant"
 );

 if (!latestAssistantMessage) {
  return {
   role: "assistant",
   content: "I'm here to help. How can I assist you?",
  };
 }

 return {
  role: "assistant",
  content: latestAssistantMessage.content
   .filter((content) => content.type === "text")
   .map((content) => content.text.value)
   .join("\n")
   .trim(),
 };
}

// Routes
app.get("/thread", async (req, res) => {
 try {
  const thread = await createThread();
  threads.set(thread.id, thread);
  res.json({ threadId: thread.id });
 } catch (error) {
  console.error("Error creating thread:", error);
  res.status(500).json({ error: "Failed to create thread" });
 }
});

app.post("/message", async (req, res) => {
 const { message, threadId } = req.body;

 if (!threadId || !threads.has(threadId)) {
  return res.status(400).json({ error: "Invalid or missing threadId" });
 }

 try {
  // Add user message
  await addMessage(threadId, message);

  // Run assistant
  const run = await runAssistant(threadId);
  const runId = run.id;

  // Poll for completion
  const maxAttempts = 20;
  let attempts = 0;
  const pollInterval = 1000;

  const pollStatus = setInterval(async () => {
   attempts++;
   const runStatus = await getRunStatus(threadId, runId);

   if (runStatus.status === "completed") {
    clearInterval(pollStatus);
    const latestMessage = await getLatestAssistantMessage(threadId);
    res.json({ messages: [latestMessage] });
   } else if (runStatus.status === "failed" || attempts >= maxAttempts) {
    clearInterval(pollStatus);
    res.status(500).json({ error: "Assistant processing failed or timed out" });
   }
  }, pollInterval);
 } catch (error) {
  console.error("Error processing message:", error);
  res.status(500).json({ error: "Internal server error" });
 }
});

// Thread cleanup
setInterval(() => {
 const now = Date.now();
 for (const [threadId, thread] of threads) {
  if (now - thread.created_at * 1000 > 3600000) {
   threads.delete(threadId);
  }
 }
}, 60000);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
 console.log(`Server is running on port ${PORT}`);
});
