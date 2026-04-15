import { useState, useRef } from "react";
import { Camera, X, Image } from "lucide-react";
import { toast } from "sonner";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { auth } from "../firebase";

/**
 * ReceiptAttach — attach a receipt photo to an expense entry.
 * Stores in Firebase Storage under receipts/{uid}/{expenseId}/{filename}.
 * Props:
 *   expenseId — unique ID for this expense
 *   receiptUrl — current receipt URL (or null)
 *   onAttach(url) — called with download URL after upload
 *   onRemove() — called after receipt is removed
 */
export default function ReceiptAttach({
  expenseId,
  receiptUrl,
  onAttach,
  onRemove,
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(receiptUrl || null);
  const [showFull, setShowFull] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Not authenticated");

      const storage = getStorage();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `receipts/${uid}/${expenseId}/${Date.now()}.${ext}`;
      const storageRef = ref(storage, path);

      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      setPreview(url);
      onAttach?.(url);
    } catch (err) {
      console.error("Receipt upload failed:", err);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleRemove = async () => {
    if (preview) {
      try {
        const storage = getStorage();
        const storageRef = ref(storage, preview);
        await deleteObject(storageRef).catch(() => {});
      } catch {
        // URL might be external or already deleted
      }
      setPreview(null);
      onRemove?.();
    }
  };

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {preview ? (
        <div style={{ position: "relative", display: "inline-block" }}>
          <button
            onClick={() => setShowFull(true)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              overflow: "hidden",
              border: "1px solid var(--border)",
              padding: 0,
              cursor: "pointer",
              background: "var(--bg-card2)",
            }}
            title="View receipt"
          >
            <img
              src={preview}
              alt="Receipt"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </button>
          <button
            onClick={handleRemove}
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "var(--red)",
              border: "none",
              color: "#fff",
              fontSize: 9,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
            title="Remove receipt"
          >
            <X size={8} />
          </button>
        </div>
      ) : (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px dashed var(--border)",
            cursor: "pointer",
            fontSize: 11,
            color: "var(--text-muted)",
            transition: "border-color 0.2s",
          }}
          title="Attach receipt photo"
        >
          {uploading ? (
            <span style={{ fontSize: 10 }}>Uploading…</span>
          ) : (
            <>
              <Camera size={12} />
              <span>Receipt</span>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            style={{ display: "none" }}
            disabled={uploading}
          />
        </label>
      )}

      {/* Full-size preview modal */}
      {showFull && preview && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowFull(false)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "90vh",
            }}
          >
            <img
              src={preview}
              alt="Receipt full size"
              style={{
                maxWidth: "90vw",
                maxHeight: "85vh",
                borderRadius: 8,
                objectFit: "contain",
              }}
            />
            <button
              onClick={() => setShowFull(false)}
              style={{
                position: "absolute",
                top: -12,
                right: -12,
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
