/* ============================================================
   ADHD FOCUS SPACE — Settings Panel v3.0
   Sections: Film Grain | Theme Hue | Work Mode | OpenAI API Key
   ============================================================ */

import { useState, useEffect, useRef, useCallback } from "react";
import { useFilmGrain } from "@/components/FilmGrain";
import { useWorkMode } from "@/components/WorkModeToggle";
import { useHue } from "@/components/HueShift";
import { toast } from "sonner";
import { useTimer } from "@/contexts/TimerContext";

/* ─── Horizontal range slider ─────────────────────────────── */
function HSlider({
  value,
  onChange,
  accentColor,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  accentColor: string;
  disabled?: boolean;
}) {
  return (
    <div style={{ position: "relative", width: "100%", height: 16, display: "flex", alignItems: "center" }}>
      <div style={{
        position: "absolute", left: 0, right: 0, height: 4,
        background: disabled ? "oklch(0.88 0.015 330)" : "oklch(0.88 0.06 340)",
        borderRadius: 2,
        border: `1px solid ${disabled ? "oklch(0.82 0.010 330)" : "oklch(0.80 0.06 340)"}`,
        overflow: "hidden",
      }}>
        <div style={{
          width: `${value}%`, height: "100%",
          background: disabled ? "oklch(0.72 0.015 330)" : accentColor,
          borderRadius: 2,
          transition: "width 0.05s linear, background 0.2s",
        }} />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          position: "absolute", left: 0, right: 0, width: "100%",
          opacity: 0, cursor: disabled ? "not-allowed" : "ew-resize",
          height: 16, margin: 0, padding: 0,
        }}
      />
      <div style={{
        position: "absolute",
        left: `calc(${value}% - 6px)`,
        width: 12, height: 12,
        background: disabled ? "oklch(0.82 0.010 330)" : "white",
        border: `2px solid ${disabled ? "oklch(0.72 0.015 330)" : accentColor}`,
        borderRadius: "50%",
        boxShadow: disabled ? "none" : `0 1px 3px ${accentColor}55`,
        transition: "left 0.05s linear, border-color 0.2s, background 0.2s",
        pointerEvents: "none",
      }} />
    </div>
  );
}

/* ─── 3D glossy traffic-light dots ─────────────────────────── */
function TitleDots() {
  const dots = [
    { base: "oklch(0.72 0.18 25)",  hi: "oklch(0.88 0.12 25)",  sh: "oklch(0.52 0.20 25)" },
    { base: "oklch(0.78 0.14 85)",  hi: "oklch(0.92 0.10 85)",  sh: "oklch(0.58 0.16 85)" },
    { base: "oklch(0.72 0.14 160)", hi: "oklch(0.88 0.10 160)", sh: "oklch(0.52 0.16 160)" },
  ];
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
      {dots.map((d, i) => (
        <div key={i} style={{
          width: 10, height: 10, borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%, ${d.hi} 0%, ${d.base} 55%, ${d.sh} 100%)`,
          boxShadow: `0 1px 2px ${d.sh}88, inset 0 1px 1px ${d.hi}99`,
          flexShrink: 0,
        }} />
      ))}
    </div>
  );
}

/* ─── Main SettingsPanel ─────────────────────────────────────── */
export function EffectsPanel({ embedded = false, settingsOnly = false, apiKeyOnly = false }: { embedded?: boolean; settingsOnly?: boolean; apiKeyOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"effects" | "apikey">("effects");
  const panelRef = useRef<HTMLDivElement>(null);
  const { intensity, setIntensity, speed, setSpeed } = useFilmGrain();
  const { enabled: workMode, toggle: toggleWorkMode } = useWorkMode();
  const { hue, setHue, reset: resetHue, presets, setPresetHue } = useHue();
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  // ── Font size ──
  const FONT_SIZES = [
    { label: "S", title: "Small", scale: 0.88 },
    { label: "M", title: "Normal", scale: 1.0 },
    { label: "L", title: "Large", scale: 1.14 },
    { label: "XL", title: "X-Large", scale: 1.28 },
  ];
  const [fontScale, setFontScaleState] = useState<number>(() => {
    const saved = parseFloat(localStorage.getItem("adhd-font-scale") ?? "1");
    return isNaN(saved) ? 1 : saved;
  });
  const applyFontScale = (scale: number) => {
    document.documentElement.style.fontSize = `${scale * 16}px`;
  };
  useEffect(() => { applyFontScale(fontScale); }, [fontScale]);
  const setFontScale = (scale: number) => {
    setFontScaleState(scale);
    localStorage.setItem("adhd-font-scale", String(scale));
    applyFontScale(scale);
  };

  // Listen for openSettingsApiKey event — opens panel directly on API Key tab
  useEffect(() => {
    const handler = () => { setOpen(true); setActiveTab("apikey"); };
    window.addEventListener("openSettingsApiKey", handler);
    return () => window.removeEventListener("openSettingsApiKey", handler);
  }, []);

  // Tour: auto-open/close settings panel when tour highlights sidebar items
  const [tourActive, setTourActive] = useState(false);
  useEffect(() => {
    const onOpen = () => { setTourActive(true); setOpen(true); setActiveTab("effects"); };
    const onClose = () => { setTourActive(false); setOpen(false); };
    window.addEventListener("tour-open-sidebar", onOpen);
    window.addEventListener("tour-close-sidebar", onClose);
    return () => {
      window.removeEventListener("tour-open-sidebar", onOpen);
      window.removeEventListener("tour-close-sidebar", onClose);
    };
  }, []);

  // ── API Key state ──
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null); // null = not checked yet
  const [keyLoading, setKeyLoading] = useState(false);
  const [usageCount, setUsageCount] = useState<number | null>(null);
  const [freeLimit, setFreeLimit] = useState<number>(5);

  // Check key status when panel opens
  useEffect(() => {
    if (!open) return;
    fetch("/api/key", { method: "GET", credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setHasKey(d.hasKey ?? false);
        setUsageCount(d.usageCount ?? 0);
        setFreeLimit(d.freeLimit ?? 5);
      })
      .catch(() => setHasKey(false));
  }, [open]);

  const saveKey = async () => {
    if (!apiKeyInput.trim()) return;
    setKeyLoading(true);
    try {
      const res = await fetch("/api/key", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: apiKeyInput.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "Failed to save key");
        return;
      }
      setHasKey(true);
      setApiKeyInput("");
      toast.success("API key saved securely.");
    } catch {
      toast.error("Failed to save key. Are you logged in?");
    } finally {
      setKeyLoading(false);
    }
  };

  const removeKey = async () => {
    setKeyLoading(true);
    try {
      const res = await fetch("/api/key", { method: "DELETE", credentials: "include" });
      if (!res.ok) { toast.error("Failed to remove key"); return; }
      setHasKey(false);
      setApiKeyInput("");
      // Re-fetch to get updated usage count
      fetch("/api/key", { method: "GET", credentials: "include" })
        .then((r) => r.json())
        .then((d) => { setUsageCount(d.usageCount ?? 0); setFreeLimit(d.freeLimit ?? 5); })
        .catch(() => {});
      toast.success("API key removed.");
    } catch {
      toast.error("Failed to remove key.");
    } finally {
      setKeyLoading(false);
    }
  };

  const grainOn = intensity > 0;
  const iconColor = (open || grainOn || workMode)
    ? "oklch(0.48 0.18 340)"
    : "oklch(0.60 0.060 330)";

  // Close on outside click or Escape key (disabled during tour)
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (tourActive) return; // keep open while tour is active
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (tourActive) return;
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, tourActive]);

  // Embedded mode: render content directly (no popup, no tab bar)
  if (embedded) {
    return (
      <div style={{ fontFamily: "'Pretendard', system-ui, sans-serif", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(settingsOnly || (!apiKeyOnly)) && <>
            {/* Text Size */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 13, fontWeight: 700, color: "#111111" }}>Text Size</span>
                <span style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 12, color: "#888888" }}>{FONT_SIZES.find(f => f.scale === fontScale)?.title ?? "Custom"}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {FONT_SIZES.map(({ label, title, scale }) => {
                  const active = Math.abs(fontScale - scale) < 0.01;
                  return (
                    <button key={label} title={title} onClick={() => setFontScale(scale)}
                      style={{ flex: 1, padding: "8px 0", fontSize: 13, fontFamily: "'Pretendard', system-ui, sans-serif", borderRadius: 9999, border: `1px solid ${active ? "#111111" : "#E5E5E5"}`, background: active ? "#111111" : "transparent", color: active ? "#FFFFFF" : "#888888", cursor: "pointer", fontWeight: active ? 700 : 500 }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>}
          {(apiKeyOnly || (!settingsOnly)) && <div>
            {/* Gemini API Key section */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: "0.60rem", color: "#888888", letterSpacing: "0.12em", textTransform: "uppercase" }}>◉ Gemini API Key</span>
              <span style={{ fontSize: "0.48rem", fontFamily: "'Pretendard', system-ui, sans-serif", padding: "2px 8px", borderRadius: 12, border: `1px solid ${hasKey ? "oklch(0.55 0.14 160)" : "oklch(0.72 0.040 330)"}`, background: hasKey ? "oklch(0.55 0.14 160 / 0.10)" : "transparent", color: hasKey ? "oklch(0.40 0.14 160)" : "#888888" }}>
                {hasKey === null ? "…" : hasKey ? "✓ key saved" : "no key"}
              </span>
            </div>
            {hasKey ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ background: "oklch(0.96 0.020 160 / 0.15)", border: "1px solid oklch(0.55 0.14 160 / 0.25)", borderRadius: 8, padding: "8px 10px" }}>
                  <p style={{ fontSize: "0.55rem", color: "oklch(0.40 0.14 160)", fontFamily: "'Pretendard', system-ui, sans-serif", lineHeight: 1.5, margin: 0 }}>✓ Using your own Gemini key — 1,500 requests/day, dedicated quota.</p>
                </div>
                <button onClick={removeKey} disabled={keyLoading} style={{ fontSize: "0.55rem", fontFamily: "'Pretendard', system-ui, sans-serif", padding: "4px 10px", borderRadius: 8, border: "1px solid oklch(0.72 0.10 25)", background: "transparent", color: "oklch(0.52 0.14 25)", cursor: keyLoading ? "not-allowed" : "pointer", alignSelf: "flex-start" }}>
                  {keyLoading ? "Removing…" : "Remove key"}
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Shared AI status */}
                <div style={{ background: "oklch(0.96 0.020 340 / 0.15)", border: "1px solid #E5E5E5", borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ fontSize: "0.75rem", flexShrink: 0 }}>🔑</span>
                  <p style={{ fontSize: "0.52rem", color: "oklch(0.45 0.08 330)", fontFamily: "'Pretendard', system-ui, sans-serif", lineHeight: 1.5, margin: 0 }}>Currently using shared AI (1,500 requests/day, shared with all users)</p>
                </div>
                <p style={{ fontSize: "0.52rem", color: "#888888", fontFamily: "'Pretendard', system-ui, sans-serif", lineHeight: 1.5, fontWeight: 600 }}>Add your own Gemini key for dedicated quota — unaffected by other users.</p>
                <p style={{ fontSize: "0.50rem", color: "#888888", fontFamily: "'Pretendard', system-ui, sans-serif", lineHeight: 1.5 }}>Get it free at <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" style={{ color: "oklch(0.55 0.18 340)", textDecoration: "underline" }}>aistudio.google.com</a> — 1,500 req/day, no credit card needed.</p>
                <div style={{ position: "relative" }}>
                  <input type={showKey ? "text" : "password"} value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveKey(); }} placeholder="AIza..." style={{ width: "100%", boxSizing: "border-box", padding: "8px 32px 8px 10px", fontSize: "0.60rem", fontFamily: "'Pretendard', system-ui, sans-serif", border: "1px solid oklch(0.82 0.06 340)", borderRadius: 8, background: "oklch(0.975 0.010 355)", color: "#111111", outline: "none" }} />
                  <button type="button" onClick={() => setShowKey((v) => !v)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "0.65rem", color: "#888888", padding: 0 }} title={showKey ? "Hide" : "Show"}>{showKey ? "●" : "○"}</button>
                </div>
                <button onClick={saveKey} disabled={keyLoading || !apiKeyInput.trim()} style={{ fontSize: "0.55rem", fontFamily: "'Pretendard', system-ui, sans-serif", padding: "6px 12px", borderRadius: 8, border: `1px solid ${!apiKeyInput.trim() ? "oklch(0.80 0.040 330)" : "oklch(0.55 0.18 340)"}`, background: !apiKeyInput.trim() ? "transparent" : "oklch(0.55 0.18 340)", color: !apiKeyInput.trim() ? "oklch(0.65 0.040 330)" : "white", cursor: keyLoading || !apiKeyInput.trim() ? "not-allowed" : "pointer", alignSelf: "flex-start", transition: "all 0.15s" }}>
                  {keyLoading ? "Saving…" : "Save Key"}
                </button>
              </div>
            )}
          </div>}
        </div>
      </div>
    );
  }

  return (
    <div ref={panelRef} style={{ position: "relative", width: "100%" }}>
      {/* ── Sidebar button ── */}
      <button
        data-tour-id="tour-settings"
        onClick={() => setOpen((v) => !v)}
        title="Settings"
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "6px 0 5px",
          gap: 2,
          background: open ? "#F5F5F5" : "none",
          border: "none",
          cursor: "pointer",
          transition: "background 0.15s",
          position: "relative",
        }}
      >

        {/* Gear icon */}
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span style={{
          fontSize: "0.40rem",
          fontFamily: "'Pretendard', system-ui, sans-serif",
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: iconColor,
          lineHeight: 1,
        }}>
          SET
        </span>
      </button>

      {/* ── Popup panel ── */}
      {open && (
        <div data-tour-id="tour-settings-panel" style={{
          position: "fixed",
          left: "max(8px, env(safe-area-inset-left, 0px))",
          bottom: "max(8px, env(safe-area-inset-bottom, 0px))",
          width: "min(260px, calc(100vw - 16px))",
          zIndex: 10000,
          fontFamily: "'Pretendard', system-ui, sans-serif",
          filter: "drop-shadow(3px 3px 0 oklch(0.55 0.12 340 / 0.35))",
        }}>
          {/* Title bar */}
          <div style={{
            background: "#F5F5F5",
            borderRadius: "6px 6px 0 0",
            border: "1.5px solid oklch(0.82 0.08 340)",
            borderBottom: "1px solid oklch(0.82 0.08 340)",
            padding: "5px 8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <TitleDots />
              <span style={{ fontSize: "0.60rem", color: "oklch(0.38 0.10 340)", letterSpacing: "0.10em", textTransform: "lowercase" }}>
                settings.exe
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "oklch(0.50 0.10 340)", fontSize: "0.75rem", lineHeight: 1, padding: "0 2px" }}
            >×</button>
          </div>

          {/* Tab bar */}
          <div style={{ display: "flex", background: "oklch(0.96 0.020 340)", border: "1.5px solid oklch(0.82 0.08 340)", borderTop: "none", borderBottom: "none" }}>
            {(["effects", "apikey"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: "5px 0",
                  fontSize: "0.44rem", letterSpacing: "0.12em", textTransform: "uppercase",
                  fontFamily: "'Pretendard', system-ui, sans-serif", border: "none",
                  borderBottom: activeTab === tab ? "2px solid oklch(0.55 0.18 340)" : "2px solid transparent",
                  borderRight: tab === "effects" ? "1px solid oklch(0.88 0.06 340)" : "none",
                  background: activeTab === tab ? "oklch(0.98 0.015 340)" : "transparent",
                  color: activeTab === tab ? "oklch(0.45 0.14 340)" : "oklch(0.62 0.060 330)",
                  cursor: "pointer", fontWeight: activeTab === tab ? 700 : 400,
                }}
              >
                {tab === "effects" ? "Effects" : "API Key"}
              </button>
            ))}
          </div>

          {/* Body */}
          <div style={{
            background: "oklch(0.98 0.015 340)",
            border: "1.5px solid oklch(0.82 0.08 340)",
            borderTop: "none",
            borderRadius: "0 0 6px 6px",
            padding: "12px 14px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}>
              {/* ── EFFECTS TAB ── */}
              {activeTab === "effects" && <>

                {/* ── Text Size section ── */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: "0.55rem", color: "#888888", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                      ▤ Text Size
                    </span>
                    <span style={{ fontSize: "0.44rem", color: "oklch(0.58 0.10 340)", letterSpacing: "0.06em" }}>
                      {FONT_SIZES.find(f => f.scale === fontScale)?.title ?? "Custom"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 5 }}>
                    {FONT_SIZES.map(({ label, title, scale }) => {
                      const active = Math.abs(fontScale - scale) < 0.01;
                      return (
                        <button
                          key={label}
                          title={title}
                          onClick={() => setFontScale(scale)}
                          style={{
                            flex: 1,
                            padding: "4px 0",
                            fontSize: "0.50rem",
                            fontFamily: "'Pretendard', system-ui, sans-serif",
                            letterSpacing: "0.06em",
                            borderRadius: 8,
                            border: `1px solid ${active ? "oklch(0.55 0.18 340)" : "oklch(0.80 0.06 340)"}`,
                            background: active ? "oklch(0.55 0.18 340)" : "transparent",
                            color: active ? "white" : "oklch(0.55 0.08 340)",
                            cursor: "pointer",
                            transition: "all 0.15s",
                            fontWeight: active ? 700 : 400,
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                 {/* Divider */}
                <div style={{ height: 1, background: "oklch(0.88 0.06 340)", margin: "0 -2px" }} />

                {/* ── Hue Shift section ── */}
                {/* hue-rotate-cancel: inverts the global hue-rotate so preset dots & slider
                    always show their true stored colours regardless of current page hue */}
                <div className="hue-rotate-cancel">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: "0.55rem", color: "#888888", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                      ◈ Theme Hue
                    </span>
                    <button
                      onClick={() => {
                        if (selectedSlot !== null) {
                          // Reset to the selected slot's saved hue
                          setHue(presets[selectedSlot].hue);
                        } else {
                          resetHue();
                        }
                      }}
                      style={{
                        fontSize: "0.40rem",
                        fontFamily: "'Pretendard', system-ui, sans-serif",
                        letterSpacing: "0.08em",
                        padding: "2px 6px",
                        borderRadius: 12,
                        border: "1px solid oklch(0.72 0.040 330)",
                        background: "transparent",
                        color: "#888888",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      RESET
                    </button>
                  </div>
                  {/* Preset swatches */}
                  <div style={{ display: "flex", gap: 5, marginBottom: 6, flexWrap: "wrap" }}>
                    {presets.map((p, idx) => (
                      <button
                        key={idx}
                        title={selectedSlot === idx ? `Slot ${idx + 1} selected — click "Set as" to save current hue` : p.label}
                        onClick={() => { setHue(p.hue); setSelectedSlot(selectedSlot === idx ? null : idx); }}
                        style={{
                          width: 18, height: 18, minWidth: 18, minHeight: 18,
                          borderRadius: "50%",
                          background: p.color,
                          border: selectedSlot === idx
                            ? "2.5px solid oklch(0.28 0.14 330)"
                            : Math.abs(hue - p.hue) < 5
                              ? "2.5px solid oklch(0.50 0.10 330)"
                              : "2px solid transparent",
                          cursor: "pointer",
                          flexShrink: 0,
                          transition: "border-color 0.15s, transform 0.15s",
                          transform: selectedSlot === idx ? "scale(1.30)" : "scale(1)",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.20)",
                          outline: "none",
                          boxSizing: "content-box",
                          padding: 0,
                        }}
                      />
                    ))}
                  </div>
                  {/* "Set as" button — shown when slot is selected AND hue differs from slot's saved value */}
                  {selectedSlot !== null && hue !== presets[selectedSlot].hue && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <div style={{
                        width: 12, height: 12, borderRadius: "50%",
                        background: `hsl(${hue},60%,62%)`,
                        border: "1.5px solid oklch(0.40 0 0)",
                        flexShrink: 0,
                      }} />
                      <button
                        onClick={() => {
                          setPresetHue(selectedSlot, hue);
                          setSelectedSlot(null);
                        }}
                        style={{
                          fontSize: "0.42rem",
                          fontFamily: "'Pretendard', system-ui, sans-serif",
                          letterSpacing: "0.08em",
                          padding: "2px 8px",
                          borderRadius: 12,
                          border: "1px solid oklch(0.55 0.12 330)",
                          background: "oklch(0.92 0.04 330)",
                          color: "oklch(0.35 0.12 330)",
                          cursor: "pointer",
                          transition: "all 0.15s",
                          fontWeight: 700,
                        }}
                      >
                        Set as #{selectedSlot + 1}
                      </button>
                      <span style={{ fontSize: "0.38rem", color: "#888888", letterSpacing: "0.04em" }}>
                        {hue}° → slot {selectedSlot + 1}
                      </span>
                    </div>
                  )}
                  {/* Hue range slider */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.48rem", color: "oklch(0.55 0.08 340)", letterSpacing: "0.06em" }}>HUE</span>
                      <span style={{
                        fontSize: "0.48rem",
                        color: `hsl(${hue},60%,45%)`,
                        letterSpacing: "0.06em",
                        fontFamily: "'Pretendard', system-ui, sans-serif",
                      }}>{hue}°</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={hue}
                      onChange={(e) => setHue(Number(e.target.value))}
                      style={{
                        width: "100%",
                        height: 6,
                        borderRadius: 8,
                        cursor: "pointer",
                        WebkitAppearance: "none",
                        appearance: "none",
                        background: `linear-gradient(to right,
                          hsl(0,65%,62%), hsl(45,65%,62%), hsl(90,65%,55%),
                          hsl(140,55%,52%), hsl(190,65%,55%), hsl(220,65%,62%),
                          hsl(270,60%,65%), hsl(310,65%,65%), hsl(330,65%,65%), hsl(360,65%,62%))`,
                        outline: "none",
                        border: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: "oklch(0.88 0.06 340)", margin: "0 -2px" }} />
                {/* Work Mode section */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <span style={{ fontSize: "0.55rem", color: "#888888", letterSpacing: "0.12em", textTransform: "uppercase", display: "block" }}>
                        ▤ Work Mode
                      </span>
                      <span style={{ fontSize: "0.44rem", color: "oklch(0.62 0.060 330)", letterSpacing: "0.04em", marginTop: 2, display: "block" }}>
                        strips all colour → greyscale
                      </span>
                    </div>
                    <button
                      onClick={toggleWorkMode}
                      style={{
                        width: 36, height: 20,
                        borderRadius: 12,
                        border: `1px solid ${workMode ? "oklch(0.30 0 0)" : "oklch(0.72 0.040 330)"}`,
                        background: workMode ? "oklch(0.25 0 0)" : "oklch(0.92 0.015 330)",
                        cursor: "pointer",
                        position: "relative",
                        transition: "background 0.2s, border-color 0.2s",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{
                        position: "absolute",
                        top: 2, left: workMode ? 16 : 2,
                        width: 14, height: 14,
                        borderRadius: "50%",
                        background: workMode ? "white" : "oklch(0.72 0.040 330)",
                        transition: "left 0.2s, background 0.2s",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
                      }} />
                    </button>
                  </div>
                </div>
              </>
              }

              {/* ── API KEY TAB ── */}
              {activeTab === "apikey" && <div>
                {/* ── OpenAI API Key section ── */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: "0.55rem", color: "#888888", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                      ◉ OpenAI API Key
                    </span>
                    {/* Status indicator */}
                    <span style={{
                      fontSize: "0.42rem",
                      fontFamily: "'Pretendard', system-ui, sans-serif",
                      letterSpacing: "0.06em",
                      padding: "2px 6px",
                      borderRadius: 12,
                      border: `1px solid ${hasKey ? "oklch(0.55 0.14 160)" : "oklch(0.72 0.040 330)"}`,
                      background: hasKey ? "oklch(0.55 0.14 160 / 0.10)" : "transparent",
                      color: hasKey ? "oklch(0.40 0.14 160)" : "#888888",
                    }}>
                      {hasKey === null ? "…" : hasKey ? "✓ key saved" : "no key"}
                    </span>
                  </div>

                  {hasKey ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {/* API call usage stats */}
                      {(() => {
                        const total = Number(localStorage.getItem("adhd-api-calls-total") ?? 0);
                        const today = Number(localStorage.getItem(`adhd-api-calls-${new Date().toDateString()}`) ?? 0);
                        if (total === 0) return null;
                        return (
                          <div style={{ background: "oklch(0.96 0.015 340)", border: "1px solid #E5E5E5", borderRadius: 8, padding: "6px 8px", display: "flex", gap: 12 }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                              <span style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.70rem", fontWeight: 700, color: "#888888" }}>{today}</span>
                              <span style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.40rem", color: "#888888", letterSpacing: "0.08em", textTransform: "uppercase" }}>today</span>
                            </div>
                            <div style={{ width: 1, background: "#E5E5E5" }} />
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                              <span style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.70rem", fontWeight: 700, color: "#888888" }}>{total}</span>
                              <span style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.40rem", color: "#888888", letterSpacing: "0.08em", textTransform: "uppercase" }}>total</span>
                            </div>
                            <div style={{ marginLeft: "auto", alignSelf: "center" }}>
                              <span style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.38rem", color: "oklch(0.65 0.040 330)", letterSpacing: "0.06em", textTransform: "uppercase" }}>API calls</span>
                            </div>
                          </div>
                        );
                      })()}
                      <p style={{ fontSize: "0.48rem", color: "oklch(0.55 0.040 330)", fontFamily: "'Pretendard', system-ui, sans-serif", lineHeight: 1.5 }}>
                        AI features enabled. Your key is stored encrypted.
                      </p>
                      <button
                        onClick={removeKey}
                        disabled={keyLoading}
                        style={{
                          fontSize: "0.48rem",
                          fontFamily: "'Pretendard', system-ui, sans-serif",
                          letterSpacing: "0.08em",
                          padding: "3px 8px",
                          borderRadius: 8,
                          border: "1px solid oklch(0.72 0.10 25)",
                          background: "transparent",
                          color: "oklch(0.52 0.14 25)",
                          cursor: keyLoading ? "not-allowed" : "pointer",
                          alignSelf: "flex-start",
                        }}
                      >
                        {keyLoading ? "Removing…" : "Remove key"}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {/* Free tier usage bar */}
                      {usageCount !== null && (
                        <div style={{ marginBottom: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                            <span style={{ fontSize: "0.44rem", fontFamily: "'Pretendard', system-ui, sans-serif", color: "#888888", letterSpacing: "0.06em" }}>
                              FREE AI REQUESTS
                            </span>
                            <span style={{ fontSize: "0.48rem", fontFamily: "'Pretendard', system-ui, sans-serif",
                              color: usageCount >= freeLimit ? "oklch(0.52 0.14 25)" : "#888888" }}>
                              {usageCount}/{freeLimit} used
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div style={{ height: 4, background: "oklch(0.88 0.025 340)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{
                              height: "100%",
                              width: `${Math.min(100, (usageCount / freeLimit) * 100)}%`,
                              background: usageCount >= freeLimit
                                ? "oklch(0.52 0.14 25)"
                                : usageCount >= freeLimit - 1
                                ? "oklch(0.62 0.14 55)"
                                : "oklch(0.58 0.14 168)",
                              borderRadius: 2,
                              transition: "width 0.3s ease",
                            }} />
                          </div>
                          <p style={{ fontSize: "0.42rem", color: usageCount >= freeLimit ? "oklch(0.52 0.14 25)" : "#888888",
                            fontFamily: "'Pretendard', system-ui, sans-serif", lineHeight: 1.4, marginTop: 3 }}>
                            {usageCount >= freeLimit
                              ? "Free requests used up — add your key below to continue."
                              : `${freeLimit - usageCount} free request${freeLimit - usageCount === 1 ? "" : "s"} left. Add your key for unlimited access.`}
                          </p>
                        </div>
                      )}
                      <p style={{ fontSize: "0.44rem", color: "#888888", fontFamily: "'Pretendard', system-ui, sans-serif", lineHeight: 1.5, marginBottom: 2 }}>
                        Add your Gemini API key for unlimited AI. Get it free at <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" style={{ color: "oklch(0.55 0.18 340)", textDecoration: "underline" }}>aistudio.google.com</a> — 1,500 requests/day, no credit card needed.
                      </p>
                      <div style={{ position: "relative" }}>
                        <input
                          type={showKey ? "text" : "password"}
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveKey(); }}
                          placeholder="AIza..."
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            padding: "5px 28px 5px 8px",
                            fontSize: "0.55rem",
                            fontFamily: "'Pretendard', system-ui, sans-serif",
                            border: "1px solid oklch(0.82 0.06 340)",
                            borderRadius: 8,
                            background: "oklch(0.975 0.010 355)",
                            color: "#111111",
                            outline: "none",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey((v) => !v)}
                          style={{
                            position: "absolute",
                            right: 6,
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.55rem",
                            color: "#888888",
                            padding: 0,
                            lineHeight: 1,
                          }}
                          title={showKey ? "Hide" : "Show"}
                        >
                          {showKey ? "●" : "○"}
                        </button>
                      </div>
                      <button
                        onClick={saveKey}
                        disabled={keyLoading || !apiKeyInput.trim()}
                        style={{
                          fontSize: "0.48rem",
                          fontFamily: "'Pretendard', system-ui, sans-serif",
                          letterSpacing: "0.08em",
                          padding: "4px 10px",
                          borderRadius: 8,
                          border: `1px solid ${!apiKeyInput.trim() ? "oklch(0.80 0.040 330)" : "oklch(0.55 0.18 340)"}`,
                          background: !apiKeyInput.trim() ? "transparent" : "oklch(0.55 0.18 340)",
                          color: !apiKeyInput.trim() ? "oklch(0.65 0.040 330)" : "white",
                          cursor: keyLoading || !apiKeyInput.trim() ? "not-allowed" : "pointer",
                          alignSelf: "flex-start",
                          transition: "all 0.15s",
                        }}
                      >
                        {keyLoading ? "Saving…" : "Save Key"}
                      </button>
                    </div>
                  )}
                </div>
              </div>}
          </div>
        </div>
      )}
    </div>
  );
}

