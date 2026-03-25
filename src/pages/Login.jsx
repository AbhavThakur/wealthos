import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { IndianRupee, Eye, EyeOff, UserPlus } from "lucide-react";

export default function Login() {
  const { login, signup, loginAsDemo, resetPassword } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const isSignup = mode === "signup";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (isSignup) {
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPwd) {
        setError("Passwords do not match.");
        return;
      }
    }
    setLoading(true);
    try {
      if (isSignup) {
        await signup(email, password);
      } else {
        await login(email, password, remember);
      }
    } catch (err) {
      const code = err?.code || "";
      if (code === "auth/email-already-in-use")
        setError("An account with this email already exists. Try signing in.");
      else if (code === "auth/weak-password")
        setError("Password is too weak. Use at least 6 characters.");
      else if (isSignup) setError("Sign-up failed. Please try again.");
      else setError("Incorrect email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === "login" ? "signup" : "login"));
    setError("");
    setConfirmPwd("");
  };

  const handleReset = async () => {
    if (!email) {
      setError("Enter your email above first.");
      return;
    }
    setError("");
    try {
      await resetPassword(email);
      setResetSent(true);
      setTimeout(() => setResetSent(false), 5000);
    } catch {
      setError("Could not send reset email. Check the address.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "var(--bg)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div
            style={{
              width: 56,
              height: 56,
              background: "var(--gold-dim)",
              border: "1px solid var(--gold-border)",
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
            }}
          >
            <IndianRupee size={26} color="var(--gold)" />
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 28,
              marginBottom: 6,
            }}
          >
            WealthOS
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            {isSignup
              ? "Create your free account"
              : "Your household finance hub"}
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={submit}
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "1.75rem",
          }}
        >
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: "var(--text-muted)",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: ".06em",
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoFocus
            />
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: "var(--text-muted)",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: ".06em",
              }}
            >
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={isSignup ? 6 : undefined}
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                aria-label={showPwd ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          {isSignup && (
            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                }}
              >
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          )}
          {!isSignup && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.25rem",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  style={{ width: 14, height: 14, accentColor: "var(--gold)" }}
                />
                Remember me
              </label>
              <button
                type="button"
                onClick={handleReset}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--gold)",
                  fontSize: 12,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Forgot password?
              </button>
            </div>
          )}
          {error && (
            <div
              style={{
                background: "var(--red-dim)",
                border: "1px solid rgba(224,92,92,.25)",
                borderRadius: "var(--radius-sm)",
                padding: "8px 12px",
                fontSize: 13,
                color: "var(--red)",
                marginBottom: "1rem",
              }}
            >
              {error}
            </div>
          )}
          {resetSent && (
            <div
              style={{
                background: "var(--green-dim)",
                border: "1px solid rgba(76,175,130,.3)",
                borderRadius: "var(--radius-sm)",
                padding: "8px 12px",
                fontSize: 13,
                color: "var(--green)",
                marginBottom: "1rem",
              }}
            >
              Password reset email sent! Check your inbox.
            </div>
          )}
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{
              width: "100%",
              padding: "11px",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {isSignup && <UserPlus size={15} />}
            {loading
              ? isSignup
                ? "Creating account…"
                : "Signing in…"
              : isSignup
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        {/* Toggle sign-in / sign-up */}
        <div
          style={{
            textAlign: "center",
            marginTop: "1rem",
            fontSize: 13,
            color: "var(--text-secondary)",
          }}
        >
          {isSignup
            ? "Already have an account?"
            : "Don\u2019t have an account?"}{" "}
          <button
            type="button"
            onClick={toggleMode}
            style={{
              background: "none",
              border: "none",
              color: "var(--gold)",
              fontSize: 13,
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            {isSignup ? "Sign in" : "Sign up"}
          </button>
        </div>

        {/* Demo button */}
        <button
          onClick={loginAsDemo}
          style={{
            width: "100%",
            padding: "10px",
            fontSize: 13,
            marginTop: "0.75rem",
            background: "transparent",
            border: "1px dashed var(--gold-border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--gold)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          👀 Try Demo — explore with sample data
        </button>

        <div
          style={{
            textAlign: "center",
            marginTop: "1.25rem",
            fontSize: 12,
            color: "var(--text-muted)",
            lineHeight: 1.7,
          }}
        >
          Open-source household finance tracker.
          <br />
          Your data stays in your Firebase project.
        </div>
      </div>
    </div>
  );
}
