import { useEffect, useRef, useState } from "react";

interface User { id: string; name: string | null }
interface Props { onLogin: (user: User) => void }

export function LoginScreen({ onLogin }: Props) {
  const btnRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch Google Client ID from server
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg) => {
        const clientId = cfg.googleClientId;
        if (!clientId) {
          setError("Google login not configured yet. Add GOOGLE_CLIENT_ID to Vercel env vars.");
          return;
        }
        loadGIS(() => {
          (window as any).google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredential,
            auto_select: false,
          });
          if (btnRef.current) {
            (window as any).google.accounts.id.renderButton(btnRef.current, {
              theme: "outline",
              size: "large",
              text: "sign_in_with",
              shape: "rectangular",
              width: 280,
            });
          }
        });
      })
      .catch(() => setError("Could not connect to server."));
  }, []);

  function loadGIS(cb: () => void) {
    if ((window as any).google?.accounts) { cb(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = cb;
    document.head.appendChild(s);
  }

  async function handleCredential(response: { credential: string }) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      onLogin(data.user);
    } catch (err: any) {
      setError(err.message ?? "Login failed. Try again.");
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "#FFFFFF" }}
    >
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E5E5E5",
          borderRadius: 20,
          boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
          width: "min(360px, 92vw)",
          overflow: "hidden",
          padding: "40px 32px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          textAlign: "center",
        }}
      >
        {/* App icon */}
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "#111111", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9"/>
          </svg>
        </div>

        <div>
          <h1 style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 22, fontWeight: 900, color: "#111111", margin: "0 0 8px" }}>
            ADHD Focus Space
          </h1>
          <p style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 14, color: "#888888", margin: 0, lineHeight: 1.5 }}>
            Sign in to sync your data across devices.
          </p>
        </div>

        {/* Google Sign-In button */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%" }}>
          {loading ? (
            <div style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 14, color: "#888888" }}>
              Signing in…
            </div>
          ) : (
            <div ref={btnRef} />
          )}
          {error && (
            <p style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 13, color: "#EF4444", margin: 0, textAlign: "center" }}>
              {error}
            </p>
          )}
        </div>

        <p style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 12, color: "#BBBBBB", margin: 0, lineHeight: 1.5 }}>
          Your data is stored securely. Gemini API key is encrypted.
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a href="/privacy" style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 12, color: "#BBBBBB", textDecoration: "underline" }}>Privacy</a>
          <span style={{ fontSize: 12, color: "#DDDDDD" }}>·</span>
          <a href="/terms" style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 12, color: "#BBBBBB", textDecoration: "underline" }}>Terms</a>
        </div>
      </div>
    </div>
  );
}
