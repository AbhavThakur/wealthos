import { ArrowLeft, FileText, CheckCircle2, ShieldAlert } from "lucide-react";

export default function TermsOfService() {
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
              background: "linear-gradient(135deg, #10b981, #059669)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
          >
            <FileText size={20} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Terms of Service</h1>
        </div>
        <p style={{ color: "var(--text-secondary, #94a3b8)", fontSize: 13, marginBottom: "2rem" }}>
          Last Updated: September 2026 • WealthOS Household Finance
        </p>

        {/* Content Sections */}
        <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary, #cbd5e1)", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <section>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={16} style={{ color: "#10b981" }} /> 1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using WealthOS, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the application.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={16} style={{ color: "#6366f1" }} /> 2. Personal Household Financial Tool
            </h2>
            <p>
              WealthOS is an informational personal finance and household budgeting tool. All financial simulations, compounding calculations, and budget projections are for informational and planning purposes only and do not constitute certified financial, tax, legal, or investment advice.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldAlert size={16} style={{ color: "#f59e0b" }} /> 3. Third-Party Integrations
            </h2>
            <p>
              WealthOS provides optional integrations with Google Sheets and Google Drive to enable automated data export and spreadsheet backup. You are responsible for maintaining the confidentiality of your Google account credentials.
            </p>
          </section>

          <section style={{ borderTop: "1px solid var(--border, #202b42)", paddingTop: "1.25rem", marginTop: "0.5rem" }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 6 }}>4. Limitation of Liability</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary, #94a3b8)" }}>
              WealthOS is provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind. Users are encouraged to maintain independent backups of their financial records.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
