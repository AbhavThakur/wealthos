/**
 * Feedback system — users submit feedback, admin replies and resolves.
 * Floating button + modal UI.
 */
import { useState, useEffect } from "react";
import {
  MessageSquare,
  X,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Reply,
  Loader2,
  Trash2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import useDraggable from "../hooks/useDraggable";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  arrayUnion,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";

import ADMIN_EMAILS from "../utils/adminEmails";

const CATEGORIES = [
  { value: "bug", label: "🐛 Bug Report", color: "#e05c5c" },
  { value: "feature", label: "✨ Feature Request", color: "#4caf82" },
  { value: "question", label: "❓ Question", color: "#5ca7e0" },
  { value: "other", label: "📝 Other", color: "#888" },
];

const STATUS_CONFIG = {
  open: { label: "Open", icon: AlertCircle, color: "#e05c5c" },
  "in-progress": { label: "In Progress", icon: Clock, color: "#c9a84c" },
  resolved: { label: "Resolved", icon: CheckCircle, color: "#4caf82" },
};

// Format timestamp
const fmtDate = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function FeedbackButton() {
  const { user } = useAuth();
  const drag = useDraggable("feedback", { bottom: 88, right: 24 });
  const [open, setOpen] = useState(false);
  const [feedbackList, setFeedbackList] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);

  // Subscribe to feedback
  useEffect(() => {
    if (!user?.uid) return;

    const feedbackRef = collection(db, "feedback");
    // Admin sees all, users see only their own
    const q = isAdmin
      ? query(feedbackRef, orderBy("createdAt", "desc"))
      : query(
          feedbackRef,
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
        );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setFeedbackList(items);

        // Count unread (admin replied but user hasn't seen)
        if (!isAdmin) {
          const unread = items.filter(
            (f) => f.hasAdminReply && !f.userReadReply,
          ).length;
          setUnreadCount(unread);
        } else {
          // Admin: count open items
          const openCount = items.filter((f) => f.status === "open").length;
          setUnreadCount(openCount);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Feedback subscription error:", err);
        setLoading(false);
      },
    );

    return unsub;
  }, [user?.uid, isAdmin]);

  if (!user || user.isDemo) return null;

  return (
    <>
      {/* Floating button - positioned above AI advisor button */}
      <button
        {...drag.handlers}
        onClick={() => {
          if (!drag.isDragging) setOpen(true);
        }}
        className="feedback-fab"
        title="Send Feedback"
        style={{
          ...drag.style,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          cursor: "grab",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          zIndex: 199,
        }}
      >
        <MessageSquare size={20} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "#e05c5c",
              color: "#fff",
              borderRadius: "50%",
              width: 18,
              height: 18,
              fontSize: 10,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Modal */}
      {open && (
        <FeedbackModal
          onClose={() => setOpen(false)}
          feedbackList={feedbackList}
          isAdmin={isAdmin}
          user={user}
          loading={loading}
        />
      )}
    </>
  );
}

function FeedbackModal({ onClose, feedbackList, isAdmin, user, loading }) {
  const [tab, setTab] = useState("new"); // 'new' | 'history'
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("bug");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, "feedback"), {
        userId: user.uid,
        userEmail: user.email,
        subject: subject.trim(),
        category,
        message: message.trim(),
        status: "open",
        createdAt: serverTimestamp(),
        replies: [],
        hasAdminReply: false,
        userReadReply: false,
      });

      setSuccess(true);
      setSubject("");
      setCategory("bug");
      setMessage("");

      setTimeout(() => {
        setSuccess(false);
        setTab("history");
      }, 1500);
    } catch (err) {
      console.error("Submit feedback error:", err);
      alert("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1001,
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 600,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>
            {isAdmin ? "📬 Feedback Admin" : "💬 Feedback"}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted)",
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border)",
            padding: "0 20px",
          }}
        >
          <button
            onClick={() => setTab("new")}
            style={{
              padding: "12px 16px",
              background: "none",
              border: "none",
              borderBottom:
                tab === "new"
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
              color: tab === "new" ? "var(--accent)" : "var(--muted)",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            New Feedback
          </button>
          <button
            onClick={() => setTab("history")}
            style={{
              padding: "12px 16px",
              background: "none",
              border: "none",
              borderBottom:
                tab === "history"
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
              color: tab === "history" ? "var(--accent)" : "var(--muted)",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            {isAdmin ? "All Feedback" : "My Feedback"}{" "}
            {feedbackList.length > 0 && `(${feedbackList.length})`}
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          {tab === "new" && (
            <form onSubmit={handleSubmit}>
              {success ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: 40,
                    color: "#4caf82",
                  }}
                >
                  <CheckCircle size={48} style={{ marginBottom: 12 }} />
                  <p style={{ fontSize: 16, fontWeight: 500 }}>
                    Feedback submitted successfully!
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontSize: 13,
                        color: "var(--muted)",
                      }}
                    >
                      Subject
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Brief summary..."
                      required
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--bg)",
                        color: "var(--text)",
                        fontSize: 14,
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontSize: 13,
                        color: "var(--muted)",
                      }}
                    >
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--bg)",
                        color: "var(--text)",
                        fontSize: 14,
                      }}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontSize: 13,
                        color: "var(--muted)",
                      }}
                    >
                      Message
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe your feedback in detail..."
                      required
                      rows={5}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--bg)",
                        color: "var(--text)",
                        fontSize: 14,
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary"
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    {submitting ? (
                      <Loader2 size={18} className="spin" />
                    ) : (
                      <Send size={18} />
                    )}
                    {submitting ? "Submitting..." : "Submit Feedback"}
                  </button>
                </>
              )}
            </form>
          )}

          {tab === "history" && (
            <FeedbackList
              items={feedbackList}
              isAdmin={isAdmin}
              loading={loading}
              userId={user.uid}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function FeedbackList({ items, isAdmin, loading, userId }) {
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
        <Loader2 size={24} className="spin" />
        <p style={{ marginTop: 8 }}>Loading...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
        <MessageSquare size={32} style={{ opacity: 0.5, marginBottom: 12 }} />
        <p>
          {isAdmin
            ? "No feedback yet"
            : "You haven't submitted any feedback yet"}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((item) => (
        <FeedbackItem
          key={item.id}
          item={item}
          isAdmin={isAdmin}
          userId={userId}
        />
      ))}
    </div>
  );
}

function FeedbackItem({ item, isAdmin, userId: _userId }) {
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.open;
  const categoryCfg =
    CATEGORIES.find((c) => c.value === item.category) || CATEGORIES[3];
  const StatusIcon = statusCfg.icon;

  // Mark as read when user views an item with admin reply
  useEffect(() => {
    if (!isAdmin && item.hasAdminReply && !item.userReadReply && expanded) {
      updateDoc(doc(db, "feedback", item.id), { userReadReply: true }).catch(
        console.error,
      );
    }
  }, [isAdmin, item.id, item.hasAdminReply, item.userReadReply, expanded]);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setReplying(true);
    try {
      const replyData = {
        text: replyText.trim(),
        from: isAdmin ? "admin" : "user",
        fromEmail: isAdmin ? "Admin" : item.userEmail,
        timestamp: new Date().toISOString(),
      };

      await updateDoc(doc(db, "feedback", item.id), {
        replies: arrayUnion(replyData),
        hasAdminReply: isAdmin ? true : item.hasAdminReply,
        userReadReply: isAdmin ? false : true,
      });

      setReplyText("");
    } catch (err) {
      console.error("Reply error:", err);
    } finally {
      setReplying(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await updateDoc(doc(db, "feedback", item.id), {
        status: newStatus,
        ...(newStatus === "resolved" && {
          resolvedAt: serverTimestamp(),
          replies: arrayUnion({
            text: `✅ Marked as resolved`,
            from: "system",
            timestamp: new Date().toISOString(),
          }),
          hasAdminReply: true,
          userReadReply: false,
        }),
      });
    } catch (err) {
      console.error("Status change error:", err);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this feedback permanently?")) return;
    try {
      await deleteDoc(doc(db, "feedback", item.id));
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete. Please try again.");
    }
  };

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: statusCfg.color,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.subject}
            </span>
            {item.hasAdminReply && !item.userReadReply && !isAdmin && (
              <span
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  fontSize: 10,
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontWeight: 600,
                }}
              >
                NEW REPLY
              </span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            <span
              style={{
                background: `${categoryCfg.color}20`,
                color: categoryCfg.color,
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              {categoryCfg.label}
            </span>
            {isAdmin && <span style={{ opacity: 0.7 }}>{item.userEmail}</span>}
            <span>{fmtDate(item.createdAt)}</span>
          </div>
        </div>
        <StatusIcon size={18} style={{ color: statusCfg.color }} />
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div
          style={{
            padding: "0 16px 16px",
            borderTop: "1px solid var(--border)",
          }}
        >
          {/* Original message */}
          <div
            style={{
              background: "var(--bg)",
              padding: 12,
              borderRadius: 8,
              marginTop: 12,
              fontSize: 14,
              whiteSpace: "pre-wrap",
            }}
          >
            {item.message}
          </div>

          {/* Replies thread */}
          {item.replies?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  marginBottom: 8,
                  fontWeight: 500,
                }}
              >
                Conversation
              </div>
              {item.replies.map((r, i) => (
                <div
                  key={i}
                  style={{
                    padding: 12,
                    background:
                      r.from === "admin"
                        ? "rgba(76, 175, 130, 0.1)"
                        : r.from === "system"
                          ? "rgba(201, 168, 76, 0.1)"
                          : "var(--bg)",
                    borderRadius: 8,
                    marginBottom: 8,
                    borderLeft:
                      r.from === "admin"
                        ? "3px solid #4caf82"
                        : r.from === "system"
                          ? "3px solid #c9a84c"
                          : "3px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      marginBottom: 4,
                    }}
                  >
                    {r.from === "admin"
                      ? "Admin"
                      : r.from === "system"
                        ? "System"
                        : r.fromEmail}{" "}
                    · {fmtDate(r.timestamp)}
                  </div>
                  <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>
                    {r.text}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Admin controls */}
          {isAdmin && item.status !== "resolved" && (
            <div
              style={{
                marginTop: 16,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <select
                value={item.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: "var(--text)",
                  fontSize: 13,
                }}
              >
                <option value="open">Open</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          )}

          {/* Delete button for resolved items (admin only) */}
          {isAdmin && item.status === "resolved" && (
            <button
              onClick={handleDelete}
              style={{
                marginTop: 16,
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid #e05c5c44",
                background: "#e05c5c22",
                color: "#e05c5c",
                cursor: "pointer",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Trash2 size={14} />
              Delete Feedback
            </button>
          )}

          {/* Reply input */}
          {item.status !== "resolved" && (
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={isAdmin ? "Reply to user..." : "Add a comment..."}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: "var(--text)",
                  fontSize: 14,
                }}
                onKeyDown={(e) => e.key === "Enter" && handleReply()}
              />
              <button
                onClick={handleReply}
                disabled={replying || !replyText.trim()}
                className="btn-primary"
                style={{ padding: "10px 16px" }}
              >
                {replying ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Reply size={16} />
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Admin Page Component (for sidebar navigation) ───────────────────────────
export function FeedbackAdmin() {
  const { user } = useAuth();
  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | open | in-progress | resolved

  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);

  useEffect(() => {
    if (!user?.uid || !isAdmin) return;

    const feedbackRef = collection(db, "feedback");
    const q = query(feedbackRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setFeedbackList(items);
        setLoading(false);
      },
      (err) => {
        console.error("Feedback subscription error:", err);
        setLoading(false);
      },
    );

    return unsub;
  }, [user?.uid, isAdmin]);

  if (!isAdmin) {
    return (
      <div className="card" style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "var(--muted)" }}>
          You don't have access to this page.
        </p>
      </div>
    );
  }

  const filteredList =
    filter === "all"
      ? feedbackList
      : feedbackList.filter((f) => f.status === filter);

  const counts = {
    all: feedbackList.length,
    open: feedbackList.filter((f) => f.status === "open").length,
    "in-progress": feedbackList.filter((f) => f.status === "in-progress")
      .length,
    resolved: feedbackList.filter((f) => f.status === "resolved").length,
  };

  const handleDeleteAllResolved = async () => {
    const resolvedItems = feedbackList.filter((f) => f.status === "resolved");
    if (resolvedItems.length === 0) {
      alert("No resolved feedback to delete.");
      return;
    }
    if (
      !confirm(
        `Delete ${resolvedItems.length} resolved feedback item(s) permanently?`,
      )
    )
      return;

    try {
      const batch = writeBatch(db);
      resolvedItems.forEach((item) => {
        batch.delete(doc(db, "feedback", item.id));
      });
      await batch.commit();
    } catch (err) {
      console.error("Bulk delete error:", err);
      alert("Failed to delete. Please try again.");
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>📬 Feedback Admin</h1>
        <p style={{ color: "var(--muted)", marginTop: 4 }}>
          Manage user feedback, bug reports, and feature requests
        </p>
      </div>

      {/* Filter tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {["all", "open", "in-progress", "resolved"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border:
                filter === f
                  ? "1px solid var(--accent)"
                  : "1px solid var(--border)",
              background: filter === f ? "var(--accent)" : "var(--card)",
              color: filter === f ? "#fff" : "var(--text)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {f === "all"
              ? "All"
              : f === "in-progress"
                ? "In Progress"
                : f.charAt(0).toUpperCase() + f.slice(1)}{" "}
            ({counts[f]})
          </button>
        ))}

        {/* Delete all resolved button */}
        {counts.resolved > 0 && (
          <button
            onClick={handleDeleteAllResolved}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #e05c5c44",
              background: "#e05c5c22",
              color: "#e05c5c",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Trash2 size={14} />
            Delete All Resolved ({counts.resolved})
          </button>
        )}
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div className="card" style={{ padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: "#e05c5c" }}>
            {counts.open}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Open</div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: "#c9a84c" }}>
            {counts["in-progress"]}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>In Progress</div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: "#4caf82" }}>
            {counts.resolved}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Resolved</div>
        </div>
      </div>

      {/* Feedback list */}
      {loading ? (
        <div
          style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}
        >
          <Loader2 size={24} className="spin" />
          <p style={{ marginTop: 8 }}>Loading...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <MessageSquare
            size={32}
            style={{ opacity: 0.5, marginBottom: 12, color: "var(--muted)" }}
          />
          <p style={{ color: "var(--muted)" }}>
            {filter === "all" ? "No feedback yet" : `No ${filter} feedback`}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredList.map((item) => (
            <FeedbackItem
              key={item.id}
              item={item}
              isAdmin={true}
              userId={user.uid}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Add spin animation for loaders
const style = document.createElement("style");
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .spin {
    animation: spin 1s linear infinite;
  }
`;
if (!document.querySelector("style[data-feedback-styles]")) {
  style.setAttribute("data-feedback-styles", "");
  document.head.appendChild(style);
}
