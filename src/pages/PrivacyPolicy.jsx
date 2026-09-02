import { ArrowLeft, Shield, Lock, EyeOff, Server, FileText } from "lucide-react";

export default function PrivacyPolicy() {
  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg, #090d16)",
        color: "var(--text-primary, #f8fafc)",
        padding: "2rem 1rem",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 780,
          margin: "0 auto",
          background: "var(--bg-card, #131b2e)",
          border: "1px solid var(--border, #202b42)",
          borderRadius: 16,
          padding: "2.5rem 2rem",
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
        }}
      >
        {/* Back Button */}
        <button
          onClick={goBack}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid var(--border, #202b42)",
            color: "var(--text-secondary, #94a3b8)",
            padding: "8px 14px",
            borderRadius: 8,
            fontSize: 13,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginBottom: "1.5rem",
          }}
        >
          <ArrowLeft size={14} /> Back to App
        </button>

        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
          >
            <Shield size={20} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Privacy Policy</h1>
        </div>
        <p style={{ color: "var(--text-secondary, #94a3b8)", fontSize: 13, marginBottom: "2rem" }}>
          Last Updated: September 2026 • WealthOS Household Finance
        </p>

        {/* Content Sections */}
        <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary, #cbd5e1)", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <section>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <Lock size={16} style={{ color: "#6366f1" }} /> 1. Introduction & Overview
            </h2>
            <p>
              WealthOS (&quot;we&quot;, &quot;our&quot;, or &quot;app&quot;) is a private household financial management and net worth tracking application designed to help individuals and partners track investments, budgeting, and long-term financial goals. We are strictly committed to user privacy, data security, and transparent data practices.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <EyeOff size={16} style={{ color: "#10b981" }} /> 2. Google OAuth & Google User Data Policy
            </h2>
            <p style={{ marginBottom: 8 }}>
              WealthOS integrates with Google Sheets to allow users to export and synchronize their personal finance records. When you connect your Google Account:
            </p>
            <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: 6 }}>
              <li>
                <strong>Requested Scopes:</strong> We request access to <code>https://www.googleapis.com/auth/spreadsheets</code> and <code>https://www.googleapis.com/auth/drive.file</code> exclusively to create and update your designated <em>WealthOS Finance</em> spreadsheet.
              </li>
              <li>
                <strong>Limited Use Disclosure:</strong> WealthOS&apos;s use and transfer of information received from Google APIs adheres strictly to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style={{ color: "#818cf8" }}>Google API Services User Data Policy</a>, including the Limited Use requirements.
              </li>
              <li>
                <strong>Zero Selling of Data:</strong> We do NOT sell, rent, or monetize any user data, financial records, or Google user data to third parties, advertisers, or data brokers.
              </li>
              <li>
                <strong>Zero AI Training on Your Data:</strong> Your financial data from Google Sheets is NEVER used to train generalized AI models.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <Server size={16} style={{ color: "#f59e0b" }} /> 3. Data Storage & Military-Grade Encryption
            </h2>
            <p>
              All Google OAuth refresh tokens and sensitive credentials stored in our database are encrypted using <strong>AES-256-GCM authenticated encryption</strong> with unique initialization vectors. Financial records stored in Firebase Firestore are isolated by household UID with strict security rules enforcing owner-only read/write access.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={16} style={{ color: "#ec4899" }} /> 4. User Rights & Data Deletion
            </h2>
            <p style={{ marginBottom: 8 }}>
              You maintain complete ownership and control over your financial data:
            </p>
            <ul style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: 6 }}>
              <li><strong>Disconnect Anytime:</strong> You can disconnect Google Sheets at any time in Settings $\rightarrow$ Google Sheets $\rightarrow$ Disconnect, which permanently revokes and deletes stored OAuth tokens.</li>
              <li><strong>Export Your Data:</strong> You can download a complete JSON/CSV export of all your transactions, budgets, and investments at any time.</li>
              <li><strong>Account Deletion:</strong> You can permanently delete your household data from our servers in Settings $\rightarrow$ Reset Data.</li>
            </ul>
          </section>

          <section style={{ borderTop: "1px solid var(--border, #202b42)", paddingTop: "1.25rem", marginTop: "0.5rem" }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 6 }}>5. Contact Us</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary, #94a3b8)" }}>
              If you have any questions or inquiries regarding this Privacy Policy or your data, please contact us at your registered support email or through the WealthOS app.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
