import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  X,
  Sparkles,
  Megaphone,
  Lightbulb,
  MessageSquare,
  Trash2,
  Plus,
  Send,
} from "lucide-react";
import {
  subscribeNotifications,
  createNotification,
  markAsRead,
  deleteNotification,
} from "../utils/notificationCenter";
import { useAuth } from "../context/AuthContext";

const TYPE_META = {
  release: { icon: Sparkles, color: "var(--gold)", label: "Release" },
  announcement: {
    icon: Megaphone,
    color: "var(--blue)",
    label: "Announcement",
  },
  tip: { icon: Lightbulb, color: "var(--green)", label: "Tip" },
  custom: { icon: MessageSquare, color: "var(--purple)", label: "Custom" },
};

function timeAgo(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── Admin Compose Form ─────────────────────────────────────────────────────
function ComposeForm({ onSend, sending }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("announcement");
  const [open, setOpen] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    await onSend({ title, body, type });
    setTitle("");
    setBody("");
    setType("announcement");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          width: "100%",
          padding: "10px",
          background: "var(--gold-dim)",
          border: "1px solid var(--gold-border)",
          borderRadius: "var(--radius-sm)",
          color: "var(--gold)",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          marginBottom: 12,
        }}
      >
        <Plus size={14} /> Send Notification
      </button>
    );
  }

  return (
    <div
      style={{
        padding: "12px",
        background: "var(--bg-card2)",
        border: "1px solid var(--gold-border)",
        borderRadius: "var(--radius-sm)",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--gold)",
          fontWeight: 600,
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: ".05em",
        }}
      >
        Compose Notification
      </div>
      <div
        style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}
      >
        {Object.entries(TYPE_META).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => setType(key)}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              borderRadius: 5,
              border:
                type === key
                  ? `1px solid ${meta.color}`
                  : "1px solid var(--border)",
              background:
                type === key ? "rgba(255,255,255,0.08)" : "transparent",
              color: type === key ? meta.color : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            {meta.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: "100%", marginBottom: 6, fontSize: 13 }}
      />
      <textarea
        placeholder="Message body (optional)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        style={{
          width: "100%",
          marginBottom: 8,
          fontSize: 12,
          resize: "vertical",
          background: "var(--bg-input)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          padding: "8px 10px",
          color: "var(--text-primary)",
        }}
      />
      <div style={{ display: "flex", gap: 6 }}>
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={!title.trim() || sending}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
          }}
        >
          <Send size={12} /> {sending ? "Sending…" : "Send"}
        </button>
        <button
          className="btn-ghost"
          onClick={() => setOpen(false)}
          style={{ fontSize: 12 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Notification Drawer ────────────────────────────────────────────────────
function NotificationDrawer({
  open,
  onClose,
  notifications,
  userId,
  isAdmin,
  userEmail,
}) {
  const [sending, setSending] = useState(false);

  const handleSend = async (data) => {
    setSending(true);
    try {
      await createNotification({
        ...data,
        createdByEmail: userEmail || userId,
      });
    } catch {
      // silent
    }
    setSending(false);
  };

  if (!open) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10001,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
        }}
      />
      {/* Drawer panel */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 380,
          height: "100%",
          background: "var(--bg-card)",
          borderLeft: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight 0.2s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Bell size={18} />
            <span style={{ fontWeight: 600, fontSize: 15 }}>Notifications</span>
            {notifications.length > 0 && (
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 7px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.08)",
                  color: "var(--text-muted)",
                }}
              >
                {notifications.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
            }}
            aria-label="Close notifications"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {isAdmin && <ComposeForm onSend={handleSend} sending={sending} />}

          {notifications.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem 1rem",
                color: "var(--text-muted)",
              }}
            >
              <Bell size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div style={{ fontSize: 13 }}>No notifications yet</div>
            </div>
          ) : (
            notifications.map((n) => {
              const meta = TYPE_META[n.type] || TYPE_META.custom;
              const Icon = meta.icon;
              const isRead = (n.readBy || []).includes(userId);

              return (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!isRead && userId) markAsRead(n.id, userId);
                  }}
                  style={{
                    padding: "12px",
                    marginBottom: 8,
                    background: isRead
                      ? "transparent"
                      : "rgba(255,255,255,0.03)",
                    border: isRead
                      ? "1px solid var(--border)"
                      : `1px solid ${meta.color}40`,
                    borderRadius: "var(--radius-sm)",
                    cursor: isRead ? "default" : "pointer",
                    position: "relative",
                  }}
                >
                  {!isRead && (
                    <div
                      style={{
                        position: "absolute",
                        top: 14,
                        right: 12,
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: meta.color,
                      }}
                    />
                  )}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 4,
                    }}
                  >
                    <Icon
                      size={13}
                      style={{ color: meta.color, flexShrink: 0 }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: meta.color,
                        textTransform: "uppercase",
                        letterSpacing: ".04em",
                      }}
                    >
                      {meta.label}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        marginLeft: "auto",
                      }}
                    >
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      marginBottom: n.body ? 4 : 0,
                    }}
                  >
                    {n.title}
                  </div>
                  {n.body && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {n.body}
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(n.id);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      padding: 2,
                      position: "absolute",
                      bottom: 8,
                      right: 8,
                      opacity: 0.6,
                    }}
                    aria-label="Dismiss notification"
                    title={isAdmin ? "Delete for everyone" : "Dismiss"}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Notification Bell (fixed top-right) ────────────────────────────────────
export default function NotificationBell({ isAdmin }) {
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const unsub = subscribeNotifications(setNotifications);
    return unsub;
  }, []);

  const userId = user?.uid || "";
  const userEmail = user?.email || "";
  const unreadCount = notifications.filter(
    (n) => !(n.readBy || []).includes(userId),
  ).length;

  return (
    <>
      <button
        onClick={() => setDrawerOpen(true)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 999,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "8px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
        }}
      >
        <Bell
          size={18}
          style={{
            color: unreadCount > 0 ? "var(--gold)" : "var(--text-muted)",
          }}
        />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              background: "var(--red)",
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <NotificationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        notifications={notifications}
        userId={userId}
        userEmail={userEmail}
        isAdmin={isAdmin}
      />
    </>
  );
}
