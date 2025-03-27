const OpenAI = require("openai");
const { OPENAI_API_KEY, ASSISTANT_ID } = require("../config/env");
const Thread = require("../models/Thread");
const Message = require("../models/Message");

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const createThread = async (userId = null) => {
 console.log(`Creating thread for ${userId || "unauthenticated"}...`);
 const thread = await openai.beta.threads.create();
 if (userId) {
  const newThread = new Thread({ userId, threadId: thread.id });
  await newThread.save();
  console.log(`Thread stored: ${thread.id}`);
 }
 return thread;
};

const addMessage = async (threadId, message, userId) => {
 const openaiMessage = await openai.beta.threads.messages.create(threadId, {
  role: "user",
  content: message,
 });
 if (userId) {
  await new Message({
   userId,
   threadId,
   role: "user",
   content: message,
   createdAt: new Date(openaiMessage.created_at * 1000),
  }).save();
 }
 return openaiMessage;
};

const runAssistant = (threadId) =>
 openai.beta.threads.runs.create(threadId, { assistant_id: ASSISTANT_ID });

const getRunStatus = (threadId, runId) =>
 openai.beta.threads.runs.retrieve(threadId, runId);

const getLatestAssistantMessage = async (threadId, userId) => {
 const messagesList = await openai.beta.threads.messages.list(threadId);
 const latest = messagesList.data.find((msg) => msg.role === "assistant");
 const content = latest
  ? {
     role: "assistant",
     content: latest.content
      .filter((c) => c.type === "text")
      .map((c) => c.text.value)
      .join("\n")
      .trim(),
    }
  : { role: "assistant", content: "I'm here to help. How can I assist you?" };

 if (userId && latest) {
  await new Message({
   userId,
   threadId,
   role: "assistant",
   content: content.content,
   createdAt: new Date(latest.created_at * 1000),
  }).save();
 }
 return content;
};

const extractPolicySearchTerm = async (userInput) => {
 const prompt = `
    Analyze: "${userInput}"
    Return JSON: { "isPolicyRequest": boolean, "searchTerm": string }
  `;
 try {
  const response = await openai.chat.completions.create({
   model: "gpt-3.5-turbo",
   messages: [{ role: "user", content: prompt }],
   max_tokens: 100,
   temperature: 0.3,
  });
  return JSON.parse(response.choices[0].message.content.trim());
 } catch (error) {
  console.error("Policy extraction error:", error.message);
  return { isPolicyRequest: false, searchTerm: "" };
 }
};

module.exports = {
 createThread,
 addMessage,
 runAssistant,
 getRunStatus,
 getLatestAssistantMessage,
 extractPolicySearchTerm,
};
