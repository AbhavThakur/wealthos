import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { normalizeTripPayload, mergeTripItems } from "../src/utils/tripSync.js";

function getAdminFirestore() {
  try {
    if (!getApps().length) {
      const projectId =
        process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_SA_CLIENT_EMAIL;
      const privateKey = (
        process.env.FIREBASE_SA_PRIVATE_KEY || ""
      ).replace(/\\n/g, "\n");

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
    console.warn("[trip-sync] getAdminFirestore init failed:", err.message);
    return null;
  }
}

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-webhook-token",
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      status: "online",
      message:
        "WealthOS Trip Architecture Sync API is online. Send POST with trip payload to sync bookings and expenses.",
      samplePayload: {
        name: "Goa Vacation",
        startDate: "2026-11-10",
        endDate: "2026-11-15",
        budget: 35000,
        itineraryUrl: "https://trip-architecture.web.app/trips/goa-2026",
        isShared: true,
        items: [
          {
            name: "Flight Booking",
            amount: 8500,
            category: "Transport",
            date: "2026-11-10",
          },
          {
            name: "Hotel Stay",
            amount: 14000,
            category: "Housing",
            date: "2026-11-11",
          },
        ],
      },
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

    const expectedToken =
      process.env.TRIP_SYNC_WEBHOOK_SECRET ||
      process.env.VITE_TRIP_SYNC_WEBHOOK_SECRET ||
      process.env.QUICK_LOG_WEBHOOK_SECRET;

    if (expectedToken && token !== expectedToken) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Invalid or missing webhook token." });
    }

    if (!req.body) {
      return res.status(400).json({ error: "Missing request body." });
    }

    let normalized;
    try {
      normalized = normalizeTripPayload(req.body);
    } catch (err) {
      return res.status(422).json({ error: err.message });
    }

    const targetUid = req.body?.uid || req.query?.uid;
    const isShared = req.body?.isShared !== false; // Default true (shared couple trip)
    const mergeWithExisting = req.body?.mergeExisting !== false;

    let savedToFirestore = false;

    if (targetUid) {
      try {
        const db = getAdminFirestore();
        if (db) {
          const userDocRef = db.collection("users").doc(targetUid);
          const snap = await userDocRef.get();
          if (snap.exists) {
            const data = snap.data() || {};
            const sharedData = data.shared || {};
            const p1Data = data.p1 || data.person1 || {};

            if (isShared) {
              const currentTrips = Array.isArray(sharedData.trips)
                ? [...sharedData.trips]
                : [];

              const existingIdx = currentTrips.findIndex(
                (t) =>
                  t.name.toLowerCase().trim() ===
                  normalized.name.toLowerCase().trim(),
              );

              let updatedTrips;
              if (existingIdx >= 0 && mergeWithExisting) {
                const existing = currentTrips[existingIdx];
                const merged = mergeTripItems(existing, normalized.items, {
                  deduplicate: true,
                });
                if (normalized.itineraryUrl) {
                  merged.itineraryUrl = normalized.itineraryUrl;
                }
                if (normalized.budget > 0) {
                  merged.budget = normalized.budget;
                }
                currentTrips[existingIdx] = merged;
                updatedTrips = currentTrips;
              } else {
                const nextId =
                  currentTrips.length > 0
                    ? Math.max(...currentTrips.map((t) => t.id || 0)) + 1
                    : 1;
                updatedTrips = [{ ...normalized, id: nextId }, ...currentTrips];
              }

              await userDocRef.set(
                {
                  shared: {
                    ...sharedData,
                    trips: updatedTrips,
                  },
                  updatedAt: new Date().toISOString(),
                },
                { merge: true },
              );
              savedToFirestore = true;
            } else {
              const currentExps = Array.isArray(p1Data.expenses)
                ? [...p1Data.expenses]
                : [];
              const nextId =
                currentExps.length > 0
                  ? Math.max(...currentExps.map((e) => e.id || 0)) + 1
                  : 1;

              await userDocRef.set(
                {
                  p1: {
                    ...p1Data,
                    expenses: [{ ...normalized, id: nextId }, ...currentExps],
                  },
                  updatedAt: new Date().toISOString(),
                },
                { merge: true },
              );
              savedToFirestore = true;
            }
          }
        }
      } catch (err) {
        console.warn("[trip-sync] Firestore sync skipped/failed:", err.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: savedToFirestore
        ? `Trip "${normalized.name}" saved to WealthOS account successfully.`
        : `Trip "${normalized.name}" processed successfully.`,
      trip: normalized,
      savedToDatabase: savedToFirestore,
    });
  } catch (err) {
    console.error("[trip-sync] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}
