import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const SYSTEM_PROMPT = `You are WealthOS AI, a concise personal finance advisor for an Indian household.
Use the household's exact data and give specific rupee impacts. Understand SIP, ELSS, PPF, NPS,
Indian tax regimes, mutual funds, index funds, direct versus regular plans, expense ratios, EPF,
HRA, FDs, gold, REITs and goal planning. Consider current allocation before suggesting changes.
Prioritize an emergency fund and expensive debt before additional risk. Do not invent missing data.
Keep responses under 200 words unless the user asks for detail. State that this is educational guidance.`;

function getAdminAuth() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:
          process.env.FIREBASE_PROJECT_ID ||
          process.env.VITE_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_SA_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_SA_PRIVATE_KEY || "").replace(
          /\\n/g,
          "\n",
        ),
      }),
    });
  }
  return getAuth();
}

async function verifyRequest(req) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  return getAdminAuth().verifyIdToken(token);
}

async function askGemini(message) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Gemini is not configured on the server.");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(18000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { maxOutputTokens: 800, temperature: 0.65 },
      }),
    },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message || "Gemini request failed.");
  return data.candidates?.[0]?.content?.parts?.[0]?.text;
}

async function askGroq(message) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Groq is not configured on the server.");
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(18000),
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
        max_tokens: 800,
        temperature: 0.65,
      }),
    },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message || "Groq request failed.");
  return data.choices?.[0]?.message?.content;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await verifyRequest(req);
    if (!user)
      return res.status(401).json({ error: "Authentication required." });

    const { provider, userMessage, financialContext } = req.body || {};
    const question = String(userMessage || "").trim();
    const context = JSON.stringify(financialContext || {});
    if (!question || question.length > 2000 || context.length > 100000) {
      return res.status(400).json({ error: "Invalid advisor request." });
    }

    const message = `My financial data:\n${context}\n\nQuestion: ${question}`;
    const reply =
      provider === "gemini" ? await askGemini(message) : await askGroq(message);
    return res.json({ reply: reply || "No response was generated." });
  } catch (error) {
    const status = error.code?.startsWith?.("auth/") ? 401 : 502;
    return res
      .status(status)
      .json({ error: error.message || "AI request failed." });
  }
}
