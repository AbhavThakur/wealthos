import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase";

const NOTIFICATIONS_COL = "notifications";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Subscribe to the global notifications collection (real-time).
 * Filters out notifications older than 30 days and auto-deletes them.
 * Returns an unsubscribe function.
 */
export function subscribeNotifications(callback) {
  const q = query(
    collection(db, NOTIFICATIONS_COL),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snapshot) => {
    const now = Date.now();
    const active = [];
    for (const d of snapshot.docs) {
      const data = { id: d.id, ...d.data() };
      const created = data.createdAt?.toDate?.();
      if (created && now - created.getTime() > THIRTY_DAYS_MS) {
        // Auto-delete expired notification (fire-and-forget)
        deleteDoc(doc(db, NOTIFICATIONS_COL, d.id)).catch(() => {});
      } else {
        active.push(data);
      }
    }
    callback(active);
  });
}

/**
 * Create a new notification (admin only).
 * @param {{ title: string, body: string, type: string, createdByEmail: string }} data
 */
export async function createNotification({
  title,
  body,
  type,
  createdByEmail,
}) {
  return addDoc(collection(db, NOTIFICATIONS_COL), {
    title: title.trim(),
    body: body.trim(),
    type: type || "announcement",
    createdAt: serverTimestamp(),
    createdByEmail,
    readBy: [],
  });
}

/**
 * Mark a notification as read for a given user.
 */
export async function markAsRead(notificationId, userId) {
  const ref = doc(db, NOTIFICATIONS_COL, notificationId);
  return updateDoc(ref, { readBy: arrayUnion(userId) });
}

/**
 * Delete a notification (admin only).
 */
export async function deleteNotification(notificationId) {
  return deleteDoc(doc(db, NOTIFICATIONS_COL, notificationId));
}
