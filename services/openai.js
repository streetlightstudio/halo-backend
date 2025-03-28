const OpenAI = require("openai");
const { OPENAI_API_KEY, ASSISTANT_ID } = require("../config/env");
const Thread = require("../models/Thread");
const Message = require("../models/Message");
const policyData = require("../data/policies.json");

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
   created_at: new Date(latest.created_at * 1000),
  }).save();
 }
 return content;
};

const extractPolicySearchTerm = async (userInput) => {
 const prompt = `
    Analyze the following user input: "${userInput}"
    Determine if this is a request to find a policy. If yes, extract the policy type as a search term.
    Examples:
    - "Find me the Communication policy" → {"isPolicyRequest": true, "searchTerm": "Communication policy"}
    - "I need a policy about educating patients" → {"isPolicyRequest": true, "searchTerm": ""}
    - "How are you today?" → {"isPolicyRequest": false, "searchTerm": ""}
    Return a plain JSON object (no markdown, no backticks, no extra text) like: {"isPolicyRequest": boolean, "searchTerm": string}
  `;
 try {
  const response = await openai.chat.completions.create({
   model: "gpt-4o-mini",
   messages: [{ role: "user", content: prompt }],
   max_tokens: 100,
   temperature: 0.3,
  });
  const rawResponse = response.choices[0].message.content.trim();
  const result = JSON.parse(rawResponse);
  console.log(`Policy analysis for "${userInput}":`, result);
  return result;
 } catch (error) {
  console.error("Policy extraction error:", error.message);
  console.error("Raw response:", error.response?.data || "No response data");
  // Fallback to default if parsing fails
  return { isPolicyRequest: false, searchTerm: "" };
 }
};

const findBestPolicyMatch = async (query) => {
 const policies = policyData.data.map((p) => ({
  id: p._id,
  name: p.policyName.name,
  description: p.policyName.desc,
  subcategory: p.pSubId.name,
 }));

 const prompt = `
    Given the user query: "${query}"
    And the following policies (each with an ID, name, description, and subcategory):
    ${JSON.stringify(policies, null, 2)}
    Analyze the query and determine which policy best matches it. The query might specify an exact policy name (e.g., "Communication policy") or a description (e.g., "educating patients and families"). Match based on:
    1. Exact or near-exact match of the policy name (case-insensitive).
    2. Similarity between the query and the policy description or subcategory.
    Return a plain JSON object (no markdown, no backticks, no extra text): {"policyId": string, "policyName": string, "reason": string}
    If multiple policies have the same name, return the first occurrence.
    If no match is found, return: {"policyId": null, "policyName": null, "reason": "No matching policy found"}
  `;
 try {
  const response = await openai.chat.completions.create({
   model: "gpt-4o-mini",
   messages: [{ role: "user", content: prompt }],
   max_tokens: 200,
   temperature: 0.5,
  });
  const result = JSON.parse(response.choices[0].message.content.trim());
  console.log(`Best policy match for "${query}":`, result);
  return result;
 } catch (error) {
  console.error("Policy match error:", error.message);
  return { policyId: null, policyName: null, reason: "Error analyzing query" };
 }
};

module.exports = {
 createThread,
 addMessage,
 runAssistant,
 getRunStatus,
 getLatestAssistantMessage,
 extractPolicySearchTerm,
 findBestPolicyMatch,
};
