// Web Push subscription manager
// Subscribes the service worker to push notifications and stores the
// subscription endpoint in Firestore so the server can send messages.

import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db, IS_DEV } from "../firebase";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Subscribe this browser to Web Push and save the subscription in Firestore.
 * Returns the PushSubscription or null on failure.
 */
export async function subscribeToPush(userId) {
  if (!VAPID_PUBLIC_KEY) {
    console.warn("VAPID public key not configured");
    return null;
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // Store subscription in Firestore under the user's household doc
    const prefix = IS_DEV ? "dev_data" : "data";
    const ref = doc(db, "households", userId, prefix, "pushSubscription");
    await setDoc(ref, {
      subscription: JSON.parse(JSON.stringify(sub)),
      updatedAt: new Date().toISOString(),
      userAgent: navigator.userAgent.slice(0, 200),
    });

    return sub;
  } catch (err) {
    console.warn("Push subscription failed:", err);
    return null;
  }
}

/**
 * Unsubscribe from Web Push and remove subscription from Firestore.
 */
export async function unsubscribeFromPush(userId) {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }

    const prefix = IS_DEV ? "dev_data" : "data";
    const ref = doc(db, "households", userId, prefix, "pushSubscription");
    await deleteDoc(ref);
  } catch (err) {
    console.warn("Push unsubscribe failed:", err);
  }
}

/**
 * Check if this browser has an active push subscription.
 */
export async function isPushSubscribed() {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}
