import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { parseQuickLogText } from "../src/utils/quickLog.js";

function getAdminFirestore() {
  try {
    if (!getApps().length) {
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_SA_CLIENT_EMAIL;
      const privateKey = (process.env.FIREBASE_SA_PRIVATE_KEY || "").replace(/\\n/g, "\n");

      if (projectId && clientEmail && privateKey) {
        initializeApp({
          credential: cert({ projectId, clientEmail, privateKey }),
        });
      } else if (projectId) {
        initializeApp({ projectId });
      } else {
        return null;
      }
    }
    return getFirestore();
  } catch (err) {
    console.warn("[quick-log] getAdminFirestore init failed:", err.message);
    return null;
  }
}

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-webhook-token"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method === "GET") {
    return res.status(200).json({
      status: "online",
      message: "WealthOS Quick-Log Webhook API is active. Send POST with text to log transactions.",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const token =
      req.headers["x-webhook-token"] ||
      req.headers.authorization?.replace(/^Bearer\s+/i, "") ||
      req.query?.token;

    const expectedToken = process.env.QUICK_LOG_WEBHOOK_SECRET || process.env.VITE_QUICK_LOG_WEBHOOK_SECRET;

    // Optional token validation if configured on server
    if (expectedToken && token !== expectedToken) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing webhook token." });
    }

    // Extract text from body (supports raw text, JSON { text: "..." }, or Telegram Webhook format)
    let rawText = "";
    let isTelegram = false;
    let chatId = null;

    if (typeof req.body === "string") {
      rawText = req.body;
    } else if (req.body?.message?.text) {
      // Telegram Bot webhook payload
      rawText = req.body.message.text;
      isTelegram = true;
      chatId = req.body.message.chat?.id;
    } else if (req.body?.text) {
      rawText = req.body.text;
    } else if (req.body?.content) {
      rawText = req.body.content;
    }

    if (!rawText) {
      return res.status(400).json({ error: "Missing 'text' field in request body." });
    }

    const defaultPerson = req.body?.defaultPerson || "p1";
    const targetUid = req.body?.uid || req.query?.uid;

    const transaction = parseQuickLogText(rawText, defaultPerson);

    if (!transaction) {
      return res.status(422).json({
        error: "Could not parse amount from text. Example format: '450 Swiggy P1' or 'Petrol 2000 P2'.",
      });
    }

    // If Firestore is available and target user is identified, save to Firestore
    if (targetUid) {
      try {
        const db = getAdminFirestore();
        if (db) {
          const userDocRef = db.collection("users").doc(targetUid);
          const snap = await userDocRef.get();
          if (snap.exists) {
            const data = snap.data() || {};
            const pKey = transaction.person === "p2" ? "p2" : "p1";
            const currentPerson = data[pKey] || data[pKey === "p1" ? "person1" : "person2"] || {};
            const existingTxns = Array.isArray(currentPerson.transactions) ? currentPerson.transactions : [];
            await userDocRef.set(
              {
                [pKey]: {
                  ...currentPerson,
                  transactions: [...existingTxns, transaction],
                },
                updatedAt: new Date().toISOString(),
              },
              { merge: true },
            );
          }
        }
      } catch (err) {
        console.warn("[quick-log] Firestore write skipped:", err.message);
      }
    }

    // Respond for Telegram bot if applicable
    if (isTelegram && chatId && process.env.TELEGRAM_BOT_TOKEN) {
      try {
        const replyMsg = `✅ *Logged ₹${transaction.amount.toLocaleString("en-IN")}*\n📝 ${transaction.name} (${transaction.category})\n👤 ${transaction.person.toUpperCase()}${transaction.isSplit ? " (Split 50:50)" : ""}`;
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: replyMsg,
            parse_mode: "Markdown",
          }),
        });
      } catch (tgErr) {
        console.error("Telegram reply failed:", tgErr);
      }
    }

    return res.status(200).json({
      success: true,
      logged: transaction,
      message: `Successfully logged ₹${transaction.amount} for ${transaction.name} (${transaction.category})`,
    });
  } catch (error) {
    console.error("Quick-log error:", error);
    return res.status(500).json({ error: error.message || "Internal server error." });
  }
}
