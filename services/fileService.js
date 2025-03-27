const fs = require("fs").promises;
const pdfParse = require("pdf-parse");
const OpenAI = require("openai");
const { OPENAI_API_KEY } = require("../config/env");

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const extractFileContent = async (filePath, fileName) => {
 const ext = fileName.split(".").pop().toLowerCase();
 if (ext === "txt") return await fs.readFile(filePath, "utf8");
 if (ext === "pdf") {
  const dataBuffer = await fs.readFile(filePath);
  return (await pdfParse(dataBuffer)).text;
 }
 throw new Error("Unsupported file type. Use .txt or .pdf.");
};

const validateContent = async (content) => {
 const prompt = `
    Check if text relates to healthcare, finance, marketing, or Healthematics services.
    Text: "${content.slice(0, 1000)}"
    Return: "yes" or "no" with explanation.
  `;
 const response = await openai.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [{ role: "user", content: prompt }],
  max_tokens: 100,
 });
 const result = response.choices[0].message.content.trim();
 return { isValid: result.startsWith("yes"), explanation: result };
};

module.exports = { extractFileContent, validateContent };
