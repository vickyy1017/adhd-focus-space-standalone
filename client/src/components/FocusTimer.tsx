import { toast } from "sonner";
import { callAI } from "@/lib/ai";
/* ============================================================
   ADHD FOCUS SPACE — Focus Timer (Cyber Pet Edition)
   Design: Tamagotchi-style pixel pet + retro OS window chrome
   - Purple/dark window chrome
   - Pixel art pet: alive/paused/dead/idle faces
   - Floating heart bubbles while running
   - Care log feed during session
   - Death counter (quit = pet dies)
   - Mode tabs: FOCUS / SHORT / LONG
   - Strip list "things to let go of" with strikethrough
   - Sound/settings controls
   - Pomodoro session dots
   ============================================================ */

import { useEffect, useRef, useState, useCallback } from "react";
import { RotateCcw, Play, Pause, Settings, Check, X, Plus, Trash2, Pencil, Coffee, Volume2, VolumeX } from "lucide-react";
import { useTimer, MODE_LABELS, MODE_COLORS, PRESETS, DEFAULT_STRIPS, type TimerMode } from "@/contexts/TimerContext";
import { useSoundContext } from "@/contexts/SoundContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";

// ── Palette (dreamy pink/lavender/mint — SukiSketch reference) ───────────────
const BG = "#F9D6E8";       // dreamy bubblegum pink
const PANEL = "#F2C4DC";    // soft rose panel
const BORDER = "#C87AAA";   // muted mauve/pink border
const DARK = "#4A2040";     // deep plum dark text
const ACCENT = "#D45898";   // vivid hot pink accent
const BTN_BG = "#E8B4D4";   // pale pink button bg
const SCREEN_BG = "#D8E8F8"; // dreamy sky-blue screen bg
const MINT = "#A8D8C8";     // mint/seafoam highlight
const LAVENDER = "#C8B4E8"; // soft lavender accent

// ── Inject keyframes once ────────────────────────────────────────────────────
const STYLE_ID = "focus-timer-cyber-keyframes";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes ft-fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes ft-scoreCount {
      from { opacity: 0; transform: scale(0.7); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes ft-petBounce {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-6px); }
    }
    .ft-fade-in    { animation: ft-fadeIn 0.5s ease forwards; }
    .ft-score-pop  { animation: ft-scoreCount 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
    .ft-pet-bounce { animation: ft-petBounce 0.3s ease; }
    .strip-row:hover .strip-actions { opacity: 1 !important; }
  `;
  document.head.appendChild(s);
}

// ── Pixel art pet SVGs ────────────────────────────────────────────────────────

function PetAlive({ blink }: { blink: boolean }) {
  return (
    <svg viewBox="0 0 32 32" width="80" height="80" style={{ imageRendering: "pixelated" }}>
      <rect x="8" y="10" width="16" height="14" fill="#F0A8B8" />
      <rect x="6" y="12" width="2" height="10" fill="#F0A8B8" />
      <rect x="24" y="12" width="2" height="10" fill="#F0A8B8" />
      <rect x="10" y="8" width="12" height="2" fill="#F0A8B8" />
      <rect x="8" y="24" width="4" height="2" fill="#F0A8B8" />
      <rect x="20" y="24" width="4" height="2" fill="#F0A8B8" />
      {blink ? (
        <>
          <rect x="11" y="14" width="4" height="1" fill="#6B2A3A" />
          <rect x="17" y="14" width="4" height="1" fill="#6B2A3A" />
        </>
      ) : (
        <>
          <rect x="11" y="13" width="4" height="4" fill="#6B2A3A" />
          <rect x="17" y="13" width="4" height="4" fill="#6B2A3A" />
          <rect x="12" y="14" width="1" height="1" fill="#fff" />
          <rect x="18" y="14" width="1" height="1" fill="#fff" />
        </>
      )}
      <rect x="10" y="18" width="3" height="2" fill="#E8A0B8" />
      <rect x="19" y="18" width="3" height="2" fill="#E8A0B8" />
      <rect x="13" y="20" width="6" height="1" fill="#6B2A3A" />
      <rect x="12" y="19" width="1" height="1" fill="#6B2A3A" />
      <rect x="19" y="19" width="1" height="1" fill="#6B2A3A" />
      <rect x="4" y="15" width="2" height="2" fill="#F0A8B8" />
    </svg>
  );
}

function PetDead() {
  return (
    <svg viewBox="0 0 32 32" width="80" height="80" style={{ imageRendering: "pixelated" }}>
      <rect x="8" y="10" width="16" height="14" fill="#B0A8B8" />
      <rect x="6" y="12" width="2" height="10" fill="#B0A8B8" />
      <rect x="24" y="12" width="2" height="10" fill="#B0A8B8" />
      <rect x="10" y="8" width="12" height="2" fill="#B0A8B8" />
      <rect x="8" y="24" width="4" height="2" fill="#B0A8B8" />
      <rect x="20" y="24" width="4" height="2" fill="#B0A8B8" />
      <rect x="11" y="13" width="1" height="1" fill="#8A3A5A" />
      <rect x="12" y="14" width="1" height="1" fill="#8A3A5A" />
      <rect x="13" y="15" width="1" height="1" fill="#8A3A5A" />
      <rect x="14" y="14" width="1" height="1" fill="#8A3A5A" />
      <rect x="13" y="13" width="1" height="1" fill="#8A3A5A" />
      <rect x="11" y="15" width="1" height="1" fill="#8A3A5A" />
      <rect x="17" y="13" width="1" height="1" fill="#8A3A5A" />
      <rect x="18" y="14" width="1" height="1" fill="#8A3A5A" />
      <rect x="19" y="15" width="1" height="1" fill="#8A3A5A" />
      <rect x="20" y="14" width="1" height="1" fill="#8A3A5A" />
      <rect x="19" y="13" width="1" height="1" fill="#8A3A5A" />
      <rect x="17" y="15" width="1" height="1" fill="#8A3A5A" />
      <rect x="13" y="20" width="6" height="1" fill="#8A3A5A" />
      <rect x="3" y="8" width="2" height="2" fill="#F4C0D0" />
      <rect x="27" y="10" width="2" height="2" fill="#F4C0D0" />
      <rect x="5" y="22" width="2" height="2" fill="#F4C0D0" />
    </svg>
  );
}

function PetPaused() {
  return (
    <svg viewBox="0 0 32 32" width="80" height="80" style={{ imageRendering: "pixelated" }}>
      <rect x="8" y="10" width="16" height="14" fill="#E890A8" />
      <rect x="6" y="12" width="2" height="10" fill="#E890A8" />
      <rect x="24" y="12" width="2" height="10" fill="#E890A8" />
      <rect x="10" y="8" width="12" height="2" fill="#E890A8" />
      <rect x="8" y="24" width="4" height="2" fill="#E890A8" />
      <rect x="20" y="24" width="4" height="2" fill="#E890A8" />
      <rect x="11" y="12" width="1" height="1" fill="#6B2A3A" />
      <rect x="14" y="11" width="1" height="1" fill="#6B2A3A" />
      <rect x="17" y="11" width="1" height="1" fill="#6B2A3A" />
      <rect x="20" y="12" width="1" height="1" fill="#6B2A3A" />
      <rect x="11" y="13" width="4" height="4" fill="#6B2A3A" />
      <rect x="17" y="13" width="4" height="4" fill="#6B2A3A" />
      <rect x="12" y="14" width="1" height="1" fill="#fff" />
      <rect x="18" y="14" width="1" height="1" fill="#fff" />
      <rect x="13" y="21" width="2" height="1" fill="#6B2A3A" />
      <rect x="15" y="20" width="2" height="1" fill="#6B2A3A" />
      <rect x="17" y="21" width="2" height="1" fill="#6B2A3A" />
      <rect x="23" y="10" width="1" height="2" fill="#88B4D8" />
      <rect x="22" y="11" width="1" height="1" fill="#88B4D8" />
      <rect x="4" y="15" width="2" height="2" fill="#E890A8" />
    </svg>
  );
}

function PetIdle() {
  return (
    <svg viewBox="0 0 32 32" width="80" height="80" style={{ imageRendering: "pixelated" }}>
      <rect x="8" y="10" width="16" height="14" fill="#F0A8B8" />
      <rect x="6" y="12" width="2" height="10" fill="#F0A8B8" />
      <rect x="24" y="12" width="2" height="10" fill="#F0A8B8" />
      <rect x="10" y="8" width="12" height="2" fill="#F0A8B8" />
      <rect x="8" y="24" width="4" height="2" fill="#F0A8B8" />
      <rect x="20" y="24" width="4" height="2" fill="#F0A8B8" />
      <rect x="11" y="15" width="4" height="2" fill="#6B2A3A" />
      <rect x="17" y="15" width="4" height="2" fill="#6B2A3A" />
      <rect x="22" y="8" width="2" height="1" fill="#C87090" />
      <rect x="23" y="9" width="1" height="1" fill="#C87090" />
      <rect x="22" y="10" width="2" height="1" fill="#C87090" />
      <rect x="13" y="20" width="6" height="1" fill="#6B2A3A" />
      <rect x="4" y="15" width="2" height="2" fill="#F0A8B8" />
    </svg>
  );
}

// ── Heart bubble type ─────────────────────────────────────────────────────────
interface HeartBubble {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  vy: number;
  vx: number;
}

// ── Care actions ──────────────────────────────────────────────────────────────
const CARE_ACTIONS = [
  { emoji: "🍗", text: "feeding chicken" },
  { emoji: "🛁", text: "bath time" },
  { emoji: "🎮", text: "playing together" },
  { emoji: "💤", text: "nap time" },
  { emoji: "🍵", text: "tea break" },
  { emoji: "🎵", text: "listening to music" },
  { emoji: "🌸", text: "flower picking" },
  { emoji: "🍙", text: "snack time" },
  { emoji: "🪀", text: "yo-yo tricks" },
  { emoji: "🌙", text: "stargazing" },
];

interface CareEntry {
  id: number;
  emoji: string;
  text: string;
  ts: number;
}

// ── Strip editor (idle state) ─────────────────────────────────────────────────
function StripEditor({ strips, onChange }: {
  strips: string[];
  onChange: (strips: string[]) => void;
}) {
  const [newText, setNewText] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  const addStrip = () => {
    const trimmed = newText.trim();
    if (!trimmed || strips.length >= 12) return;
    onChange([...strips, trimmed]);
    setNewText("");
    setTimeout(() => inputRef.current?.focus(), 40);
  };

  const removeStrip = (i: number) => onChange(strips.filter((_, idx) => idx !== i));

  const startEdit = (i: number) => {
    setEditingIdx(i);
    setEditVal(strips[i]);
    setTimeout(() => editRef.current?.focus(), 40);
  };

  const commitEdit = () => {
    if (editingIdx === null) return;
    const trimmed = editVal.trim();
    if (trimmed) {
      const next = [...strips];
      next[editingIdx] = trimmed;
      onChange(next);
    }
    setEditingIdx(null);
  };

  const resetToDefaults = () => onChange([...DEFAULT_STRIPS]);

  return (
    <div style={{ padding: "10px 12px 12px", background: BG }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <p style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 7, letterSpacing: "0.16em",
          color: BORDER, margin: 0, textTransform: "uppercase",
        }}>things to let go of</p>
        <button
          onClick={resetToDefaults}
          style={{
            fontSize: 7, letterSpacing: "0.12em",
            color: BORDER, background: "none", border: "none",
            cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
            textDecoration: "underline", padding: 0,
          }}
        >reset</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
        {strips.map((text, i) => (
          <div key={i} className="strip-row" style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 8px",
            background: i === 0 ? PANEL : BG,
            border: `1px solid ${BORDER}60`,
            position: "relative",
          }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 7, color: BORDER,
              width: 12, flexShrink: 0, textAlign: "right",
            }}>{i + 1}</span>

            {editingIdx === i ? (
              <input
                ref={editRef}
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") setEditingIdx(null);
                }}
                onBlur={commitEdit}
                style={{
                  flex: 1, fontSize: 9, border: "none",
                  borderBottom: `1px solid ${ACCENT}`,
                  background: "transparent", outline: "none",
                  fontFamily: "'JetBrains Mono', monospace",
                  color: DARK, padding: "1px 0",
                }}
              />
            ) : (
              <span style={{
                flex: 1, fontSize: 9,
                fontFamily: "'JetBrains Mono', monospace",
                color: DARK, letterSpacing: "0.04em",
              }}>{text}</span>
            )}

            <div style={{ display: "flex", gap: 3, opacity: 0, transition: "opacity 0.15s" }}
              className="strip-actions">
              <button onClick={() => startEdit(i)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                <Pencil size={9} color={BORDER} />
              </button>
              <button onClick={() => removeStrip(i)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                <Trash2 size={9} color="oklch(0.58 0.18 340)" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {strips.length < 12 && (
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <input
            ref={inputRef}
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addStrip(); }}
            placeholder="add something to let go of…"
            style={{
              flex: 1, fontSize: 9,
              border: "none", borderBottom: `1px solid ${BORDER}`,
              background: "transparent", outline: "none",
              fontFamily: "'JetBrains Mono', monospace",
              color: DARK, padding: "3px 0",
              letterSpacing: "0.04em",
            }}
          />
          <button
            onClick={addStrip}
            disabled={!newText.trim()}
            style={{
              width: 20, height: 20,
              border: `1px solid ${newText.trim() ? ACCENT : BORDER}`,
              background: newText.trim() ? ACCENT : "transparent",
              color: newText.trim() ? "#fff" : BORDER,
              cursor: newText.trim() ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          ><Plus size={10} /></button>
        </div>
      )}
      {strips.length >= 12 && (
        <p style={{ fontSize: 7, color: BORDER, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", margin: 0 }}>max 12 strips</p>
      )}
    </div>
  );
}

// ── Single strip row (strikethrough style) ────────────────────────────────────
type StripState = "attached" | "tearing" | "torn";

function TearStrip({ text, state, isNext }: {
  text: string; seed: number;
  state: StripState; isNext: boolean;
}) {
  const isDone = state === "tearing" || state === "torn";
  const [visible, setVisible] = useState(true);
  const prevState = useRef<StripState>(state);

  useEffect(() => {
    if (state === "tearing" && prevState.current !== "tearing") {
      const t = setTimeout(() => setVisible(false), 400);
      prevState.current = "tearing";
      return () => clearTimeout(t);
    }
    if (state === "attached") { setVisible(true); prevState.current = "attached"; }
    if (state === "torn") { setVisible(false); prevState.current = "torn"; }
  }, [state]);

  if (!visible) return null;

  return (
    <div style={{
      padding: "6px 12px",
      background: isNext ? `${ACCENT}18` : "transparent",
      borderTop: `1px solid ${BORDER}30`,
      display: "flex", alignItems: "center", gap: 8,
      opacity: isDone ? 0.45 : 1,
      transition: "opacity 0.35s",
    }}>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 7, color: BORDER,
        width: 12, textAlign: "right", flexShrink: 0, userSelect: "none",
      }}>{isDone ? "✓" : isNext ? "▶" : ""}</span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: isNext ? 9 : 8,
        color: isDone ? BORDER : isNext ? DARK : `${DARK}AA`,
        letterSpacing: "0.05em",
        fontWeight: isNext ? 700 : 400,
        textDecoration: isDone ? "line-through" : "none",
        textDecorationColor: ACCENT,
        textDecorationThickness: "2px",
        transition: "color 0.3s",
        flex: 1,
      }}>{text}</span>
    </div>
  );
}

// ── Complete wrap-up ──────────────────────────────────────────────────────────
function CompleteWrapUp({ sessions, mode, onNewSession, duration }: {
  sessions: number; mode: TimerMode; onNewSession: () => void; duration?: number;
}) {
  const accentColor = MODE_COLORS[mode];
  const messages = [
    "You stayed. That's everything.",
    "The noise didn't win today.",
    "One full session. Real progress.",
    "You showed up. That matters.",
  ];
  const msg = messages[sessions % messages.length];

  const [intention, setIntention] = useState("");
  const [outcome, setOutcome] = useState("");
  const [aiReflection, setAiReflection] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const handleReflect = async () => {
    setAiLoading(true);
    try {
      const reflection = await callAI(
        "Write a 1-sentence focus reflection. Warm, brief, encouraging. No emoji at start.",
        `Completed ${duration ?? mode === "focus" ? 25 : 5}min ${mode} session. Session number ${sessions} today.`
      );
      setAiReflection(reflection);
    } catch (err) {
      const m = err instanceof Error ? err.message : "AI unavailable";
      toast.error(m, { duration: 4000 });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="ft-fade-in" style={{
      background: BG, padding: "22px 16px 18px",
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: 12, textAlign: "center", minHeight: 220,
    }}>
      <div style={{ fontSize: 36, lineHeight: 1 }}>🌟</div>
      <div>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: DARK, margin: 0, letterSpacing: "0.06em" }}>SESSION COMPLETE!</p>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: BORDER, margin: "4px 0 0", letterSpacing: "0.06em" }}>{msg}</p>
      </div>
      <div className="ft-score-pop" style={{
        width: 64, height: 64, border: `3px solid ${accentColor}`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: `${accentColor}18`,
      }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: accentColor, lineHeight: 1 }}>{sessions}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 6, color: BORDER, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 2 }}>SESSION{sessions !== 1 ? "S" : ""}</span>
      </div>

      {aiReflection && (
        <p style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: DARK,
          maxWidth: 200, lineHeight: 1.5, textAlign: "center",
          background: `${accentColor}10`, border: `1px solid ${accentColor}40`,
          padding: "6px 12px",
        }}>{aiReflection}</p>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={handleReflect} disabled={aiLoading} style={{
          background: "transparent", border: `1px solid ${BORDER}`, color: BORDER,
          padding: "5px 14px", fontSize: 7, cursor: aiLoading ? "not-allowed" : "pointer",
          fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.10em",
        }}>
          {aiLoading ? "…" : "✦ REFLECT"}
        </button>
        <button onClick={onNewSession} style={{
          background: DARK, border: "none", color: "#FAF6F1",
          padding: "8px 22px", fontSize: 8, cursor: "pointer",
          fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.14em",
          boxShadow: `2px 2px 0 ${BORDER}`,
        }}>↺ NEW SESSION</button>
      </div>
    </div>
  );
}

// ── Quit (sad) wrap-up ────────────────────────────────────────────────────────
function QuitWrapUp({ quitCount, stripsLeft, onNewSession }: {
  quitCount: number; stripsLeft: number; onNewSession: () => void;
}) {
  const sadMessages = [
    "It's okay. Tomorrow is a new page.",
    "The strips are waiting for you.",
    "Rest, then try again.",
    "Even stopping takes courage.",
  ];
  const msg = sadMessages[(quitCount - 1) % sadMessages.length];
  const penalty = Math.min(stripsLeft * 5, 40);

  return (
    <div className="ft-fade-in" style={{
      background: BG, padding: "22px 16px 18px",
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: 10, textAlign: "center", minHeight: 220,
    }}>
      <div style={{ fontSize: 32, lineHeight: 1 }}>💀</div>
      <div>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: DARK, margin: 0, letterSpacing: "0.06em" }}>PET DIED</p>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: BORDER, margin: "4px 0 0", letterSpacing: "0.04em" }}>{msg}</p>
      </div>
      <div style={{ display: "flex", gap: 8, width: "100%" }}>
        {[
          { label: "QUIT" + (quitCount !== 1 ? "S" : "") + " TODAY", value: quitCount, color: BORDER },
          { label: "SCORE PENALTY", value: `-${penalty}`, color: "oklch(0.58 0.18 340)" },
          { label: "STRIPS LEFT", value: stripsLeft, color: BORDER },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ flex: 1, background: PANEL, border: `1px solid ${BORDER}`, padding: "9px 5px", textAlign: "center" }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color, margin: 0 }}>{value}</p>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 6, color: BORDER, letterSpacing: "0.10em", textTransform: "uppercase", margin: "3px 0 0" }}>{label}</p>
          </div>
        ))}
      </div>
      <button onClick={onNewSession} style={{
        background: PANEL, border: `1.5px solid ${BORDER}`, color: DARK,
        padding: "7px 20px", fontSize: 8, cursor: "pointer",
        fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em",
        boxShadow: `2px 2px 0 ${BORDER}`,
      }}>↺ TRY AGAIN</button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface FocusTimerProps {
  onSessionComplete?: () => void;
  onBlockComplete?: () => void;
  onQuit?: () => void;
  fillHeight?: boolean;
}

export function FocusTimer({ onSessionComplete, onBlockComplete, onQuit, fillHeight }: FocusTimerProps) {
  const {
    mode, phase, running, remaining, sessions, quitCount,
    durations, strips, stripStates,
    progress, tornCount, stripsLeft, nextStripIdx,
    pomodoroStep, transitionCountdown, nextMode,
    handleStartPause, handleQuit, handleNewSession, handleSkipTransition,
    switchMode, applyDuration, setCustomStrips,
    setOnSessionComplete, setOnBlockComplete, setOnQuit,
  } = useTimer();

  // MIT pre-label
  const [mitLabel, setMitLabel] = useState<string | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.taskText) setMitLabel(detail.taskText);
    };
    window.addEventListener("adhd-start-mit-focus", handler);
    return () => window.removeEventListener("adhd-start-mit-focus", handler);
  }, []);

  // Space key → start / pause (skip when typing in an input)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " && e.code !== "Space") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (phase === "recovering" || phase === "block_complete" || phase === "quit") return;
      e.preventDefault();
      handleStartPause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, handleStartPause]);

  // ── Pet growth counter (all-time sessions, animates up) ──────────────────────
  const getTotalSessions = () => {
    try {
      const raw = localStorage.getItem("adhd-focus-session-list");
      if (!raw) return sessions;
      const data = JSON.parse(raw);
      // data is { dateKey: entry[] } — sum all entries across all days
      if (data && typeof data === "object" && !Array.isArray(data)) {
        return Object.values(data).reduce((sum: number, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
      }
      // fallback: plain array
      if (Array.isArray(data)) return data.length;
      return sessions;
    } catch { return sessions; }
  };
  const [totalSessions, setTotalSessions] = useState(() => getTotalSessions());
  // Re-read total sessions whenever a focus session is recorded
  useEffect(() => {
    const onStorage = () => setTotalSessions(getTotalSessions());
    window.addEventListener("adhd-storage-update", onStorage);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("adhd-storage-update", onStorage);
      window.removeEventListener("storage", onStorage);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Also update when sessions (current block) changes
  useEffect(() => { setTotalSessions(getTotalSessions()); }, [sessions]); // eslint-disable-line react-hooks/exhaustive-deps
  // Growth % = current session progress (0→100%) while running, 0 when idle
  const sessionGrowth = phase === "idle" || phase === "quit" || phase === "block_complete"
    ? 0
    : Math.round(progress * 100);
  const targetGrowth = sessionGrowth;
  const [displayedGrowth, setDisplayedGrowth] = useState(0);
  // Smoothly animate counter to match session progress
  useEffect(() => {
    setDisplayedGrowth(targetGrowth);
  }, [targetGrowth]);

  // Register callbacks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setOnSessionComplete(onSessionComplete ?? null); return () => setOnSessionComplete(null); }, [onSessionComplete]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setOnBlockComplete(onBlockComplete ?? null); return () => setOnBlockComplete(null); }, [onBlockComplete]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setOnQuit(onQuit ?? null); return () => setOnQuit(null); }, [onQuit]);

  // Local UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showSound, setShowSound] = useState(false);
  const [editingMode, setEditingMode] = useState<TimerMode | null>(null);
  const [editVal, setEditVal] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  // Sound — uses global SoundContext so audio persists across navigation
  const sound = useSoundContext();
  const prevPhaseRef = useRef(phase);
  const prevTornRef = useRef(tornCount);
  const prevTransitionRef = useRef(transitionCountdown);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (phase === "transition" && prev !== "transition") sound.playChimeSfx();
    if (phase === "block_complete" && prev !== "block_complete") {
      // Stop music so user notices the block is done, then play gentle bell chime
      sound.stopMusicForBlockComplete();
      sound.playFanfareSfx();
    }
    if ((phase === "complete" || phase === "quit") && prev !== phase) {
      // Timer finished or was reset — stop music and disable the button
      sound.stopMusicAndDisable();
    }
    // Notify global sound context so music pauses/resumes with timer
    if (phase === "running") sound.onTimerPhaseChange("running");
    else if (phase === "paused") sound.onTimerPhaseChange("paused");
    else sound.onTimerPhaseChange("other");
  }, [phase, sound]);

  useEffect(() => {
    prevTornRef.current = tornCount;
  }, [tornCount]);

  useEffect(() => {
    if (phase === "transition" && transitionCountdown < prevTransitionRef.current && transitionCountdown > 0) sound.playTickSfx();
    prevTransitionRef.current = transitionCountdown;
  }, [transitionCountdown, phase, sound]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const segments = Array.from({ length: 20 }, (_, i) => i / 20 < progress);

  useEffect(() => { if (editingMode) setTimeout(() => editRef.current?.focus(), 40); }, [editingMode]);

  const commitEdit = () => {
    if (!editingMode) return;
    const parsed = parseInt(editVal, 10);
    if (!isNaN(parsed)) applyDuration(editingMode, parsed);
    setEditingMode(null);
  };

  // ── Cyber pet state ────────────────────────────────────────────────────────
  const [deaths, setDeaths] = useLocalStorage<number>("cyber-pet-deaths", 0);

  // ── Daily hearts system ─────────────────────────────────────────────────────
  const todayHeartsKey = `cyber-pet-hearts-${new Date().toISOString().slice(0, 10)}`;
  const [hearts5, setHearts5] = useState<number>(() => {
    try {
      const v = parseInt(localStorage.getItem(todayHeartsKey) ?? "", 10);
      return isNaN(v) ? 5 : Math.max(0, Math.min(5, v));
    } catch { return 5; }
  });
  const saveHearts5 = (n: number) => {
    const clamped = Math.max(0, Math.min(5, n));
    setHearts5(clamped);
    try { localStorage.setItem(todayHeartsKey, String(clamped)); } catch {}
  };
  // Track sessions completed today for heart restoration (every 4 → +1 heart)
  const todaySessionsKey = `cyber-pet-sessions-${new Date().toISOString().slice(0, 10)}`;
  const [sessionsToday, setSessionsToday] = useState<number>(() => {
    try { return parseInt(localStorage.getItem(todaySessionsKey) ?? "0", 10) || 0; } catch { return 0; }
  });
  // Lifetime total deep focus sessions (never resets, backed up)
  const [lifetimeSessions, setLifetimeSessions] = useState<number>(() => {
    try { return parseInt(localStorage.getItem("cyber-pet-total-sessions") ?? "0", 10) || 0; } catch { return 0; }
  });
  const [blink, setBlink] = useState(false);
  const [bounce, setBounce] = useState(false);
  const [hearts, setHearts] = useState<HeartBubble[]>([]);
  const [careLog, setCareLog] = useState<CareEntry[]>(() => {
    try {
      const raw = localStorage.getItem("adhd-care-log");
      return raw ? (JSON.parse(raw) as CareEntry[]) : [];
    } catch { return []; }
  });
  const heartIdRef = useRef(0);
  const careIdRef = useRef(0);
  const heartRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const careRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blinkRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bounceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRunning = phase === "running";

  // Track deaths from quit (lose 1 heart) and session completions (every 4 → restore 1 heart)
  const prevPhaseForDeaths = useRef(phase);
  useEffect(() => {
    if (phase === "quit" && prevPhaseForDeaths.current !== "quit") {
      setDeaths((d: number) => d + 1);
      saveHearts5(hearts5 - 1);
    }
    if (
      (phase === "complete" || phase === "block_complete") &&
      prevPhaseForDeaths.current !== "complete" &&
      prevPhaseForDeaths.current !== "block_complete"
    ) {
      const newCount = sessionsToday + 1;
      setSessionsToday(newCount);
      try { localStorage.setItem(todaySessionsKey, String(newCount)); } catch {}
      // Increment lifetime total
      const newLifetime = lifetimeSessions + 1;
      setLifetimeSessions(newLifetime);
      try { localStorage.setItem("cyber-pet-total-sessions", String(newLifetime)); } catch {}
      // Every 4 sessions completed today → restore 1 heart (up to max 5)
      if (newCount % 4 === 0 && hearts5 < 5) {
        saveHearts5(hearts5 + 1);
      }
    }
    prevPhaseForDeaths.current = phase;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, setDeaths]);

  // Blink while running
  useEffect(() => {
    if (!isRunning) { if (blinkRef.current) clearInterval(blinkRef.current); return; }
    blinkRef.current = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 150);
    }, 4000 + Math.random() * 3000);
    return () => { if (blinkRef.current) clearInterval(blinkRef.current); };
  }, [isRunning]);

  // Bounce while running
  useEffect(() => {
    if (!isRunning) { if (bounceRef.current) clearInterval(bounceRef.current); return; }
    bounceRef.current = setInterval(() => {
      setBounce(true);
      setTimeout(() => setBounce(false), 300);
    }, 6000);
    return () => { if (bounceRef.current) clearInterval(bounceRef.current); };
  }, [isRunning]);

  // Hearts spawn while running
  const spawnHeart = useCallback(() => {
    const id = heartIdRef.current++;
    const side = Math.random() < 0.5 ? -1 : 1;
    const newHeart: HeartBubble = {
      id,
      x: 42 + Math.random() * 16,
      y: 42 + Math.random() * 12,
      size: 8 + Math.random() * 8,
      opacity: 0.9,
      vy: 1.0 + Math.random() * 0.6,
      vx: side * (0.3 + Math.random() * 0.5),
    };
    setHearts((prev) => [...prev.slice(-12), newHeart]);
  }, []);

  useEffect(() => {
    if (!isRunning) { if (heartRef.current) clearInterval(heartRef.current); return; }
    heartRef.current = setInterval(spawnHeart, 1200);
    return () => { if (heartRef.current) clearInterval(heartRef.current); };
  }, [isRunning, spawnHeart]);

  // Animate hearts upward
  useEffect(() => {
    if (hearts.length === 0) return;
    const id = requestAnimationFrame(() => {
      setHearts((prev) =>
        prev
          .map((h) => ({ ...h, y: h.y + h.vy, x: h.x + h.vx, opacity: h.opacity - 0.010 }))
          .filter((h) => h.opacity > 0.05 && h.y < 95)
      );
    });
    return () => cancelAnimationFrame(id);
  }, [hearts]);

  // Persist care log to localStorage
  useEffect(() => {
    try { localStorage.setItem("adhd-care-log", JSON.stringify(careLog)); } catch { /* ignore */ }
  }, [careLog]);

  // Care log while running
  const addCareEntry = useCallback(() => {
    const action = CARE_ACTIONS[Math.floor(Math.random() * CARE_ACTIONS.length)];
    const entry: CareEntry = { id: careIdRef.current++, emoji: action.emoji, text: action.text, ts: Date.now() };
    setCareLog((prev) => [entry, ...prev].slice(0, 8));
  }, []);

  useEffect(() => {
    if (!isRunning) { if (careRef.current) clearInterval(careRef.current); return; }
    addCareEntry();
    careRef.current = setInterval(addCareEntry, 15000 + Math.random() * 10000);
    return () => { if (careRef.current) clearInterval(careRef.current); };
  }, [isRunning, addCareEntry]);

  // Clear hearts/care on idle (and clear persisted log too)
  useEffect(() => {
    if (phase === "idle") {
      setHearts([]);
      setCareLog([]);
      try { localStorage.removeItem("adhd-care-log"); } catch { /* ignore */ }
    }
  }, [phase]);

  const resetDeaths = () => { setDeaths(0); saveHearts5(5); };

  // Single heart + lifetime deep focus session count
  const renderHearts = () => (
    <span
      title={`${lifetimeSessions} deep focus session${lifetimeSessions !== 1 ? "s" : ""} completed (lifetime total)`}
      style={{ fontSize: 9, letterSpacing: 1, cursor: "default", display: "flex", alignItems: "center", gap: 2 }}
    >
      <span style={{ color: "#FAF6F1" }}>❤</span>
      <span style={{ color: "#FAF6F1", fontFamily: "'JetBrains Mono', monospace", fontSize: 7, fontWeight: 700 }}>{lifetimeSessions}</span>
    </span>
  );

  // Determine pet face
  const petFace = () => {
    if (phase === "quit") return <PetDead />;
    if (phase === "idle") return <PetIdle />;
    if (phase === "paused") return <PetPaused />;
    return <PetAlive blink={blink} />;
  };

  const petStatus = () => {
    if (phase === "idle") return "SLEEPING...";
    if (phase === "running") return "HAPPY \u2665";
    if (phase === "paused") return "WORRIED...";
    if (phase === "quit") return "GONE...";
    if (phase === "complete" || phase === "block_complete") return "FULL \u2605";
    if (phase === "transition") return "RESTING...";
    return "";
  };

  const showMainScene = phase !== "complete" && phase !== "quit" && phase !== "transition" && phase !== "block_complete";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      fontFamily: "'JetBrains Mono', monospace",
      background: BG,
      border: `3px solid ${DARK}`,
      boxShadow: `4px 4px 0 ${DARK}`,
      overflow: "hidden",
      ...(fillHeight ? { display: "flex", flexDirection: "column", height: "100%" } : {}),
    }}>

      {/* ── macOS title bar ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "9px 12px",
        background: "oklch(0.945 0.030 355)",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: "flex", gap: 5 }}>
          <div style={{ width: 11, height: 11, borderRadius: "50%", background: "oklch(0.72 0.18 25)", boxShadow: "inset 0 1px 1px oklch(0.88 0.12 25 / 0.6)" }} />
          <div style={{ width: 11, height: 11, borderRadius: "50%", background: "oklch(0.78 0.14 85)", boxShadow: "inset 0 1px 1px oklch(0.92 0.10 85 / 0.6)" }} />
          <div style={{ width: 11, height: 11, borderRadius: "50%", background: "oklch(0.72 0.14 160)", boxShadow: "inset 0 1px 1px oklch(0.88 0.10 160 / 0.6)" }} />
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginRight: 36 }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "oklch(0.35 0.040 320)" }}>Focus Timer</span>
          <div style={{ display: "flex", gap: 3 }}>{renderHearts()}</div>
        </div>
      </div>
      {/* ── Top bar: mode tabs + sound/settings + death counter ── */}
      <div style={{ display: "flex", alignItems: "stretch", borderBottom: `2px solid ${DARK}`, background: PANEL }}>
        {/* Mode tabs */}
        <div style={{ display: "flex", flex: 1 }}>
          {(["focus", "short", "long"] as TimerMode[]).map((m, idx) => (
            <button key={m} onClick={() => switchMode(m)} style={{
              flex: 1, padding: "6px 0",
              fontSize: 7, letterSpacing: "0.18em", textTransform: "uppercase",
              border: "none", borderRight: idx < 2 ? `1px solid ${BORDER}50` : "none",
              background: mode === m ? ACCENT : PANEL,
              color: mode === m ? "#fff" : BORDER,
              cursor: running ? "not-allowed" : "pointer",
              fontFamily: "'JetBrains Mono', monospace",
              opacity: running && mode !== m ? 0.5 : 1,
              fontWeight: mode === m ? 700 : 400,
              transition: "background 0.15s",
            }}>
              {m === "focus" ? "FOCUS" : m === "short" ? "SHORT" : "LONG"}
            </button>
          ))}
        </div>
        {/* Death counter + sound + settings */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 7px", borderLeft: `1px solid ${BORDER}50` }}>
          <span title={`${deaths} quit${deaths !== 1 ? "s" : ""} lifetime\nLifetime total: ${deaths}`} style={{ fontSize: 7, color: BORDER, letterSpacing: "0.08em", cursor: "default" }}>💀{deaths}</span>
          <button
            onClick={() => { setShowSound(s => !s); setShowSettings(false); }}
            title="Sound & music"
            style={{ width: 18, height: 18, border: `1px solid ${showSound || sound.musicEnabled ? DARK : BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", background: sound.musicEnabled ? `${DARK}18` : "transparent", cursor: "pointer" }}
          >
            {sound.musicLoading ? <span style={{ fontSize: 6, color: DARK }}>…</span> : sound.musicEnabled ? <span className="animate-music-beat" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><Coffee size={8} color={DARK} /></span> : (sound.sfxEnabled ? <Volume2 size={8} color={BORDER} /> : <VolumeX size={8} color={BORDER} />)}
          </button>
          <button
            onClick={() => { setShowSettings(s => !s); setShowSound(false); }}
            style={{ width: 18, height: 18, border: `1px solid ${showSettings ? ACCENT : BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", background: showSettings ? `${ACCENT}18` : "transparent", cursor: "pointer" }}
          >
            <Settings size={8} color={showSettings ? ACCENT : BORDER} />
          </button>
        </div>
      </div>

      {/* MIT label if set */}
      {mitLabel && phase === "idle" && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: `${ACCENT}18`, borderBottom: `1px solid ${BORDER}` }}>
          <span style={{ fontSize: 7, color: ACCENT, letterSpacing: "0.06em", flex: 1 }}>★ MIT: {mitLabel.length > 32 ? mitLabel.slice(0, 32) + "…" : mitLabel}</span>
          <button onClick={() => setMitLabel(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: ACCENT, fontSize: 12, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div style={{ borderBottom: `2px solid ${DARK}`, padding: "11px 12px", background: `linear-gradient(135deg, ${PANEL} 0%, #EAD4F0 100%)` }}>
          <p style={{ fontSize: 7, letterSpacing: "0.2em", color: BORDER, textTransform: "uppercase", marginBottom: 9, fontFamily: "'JetBrains Mono', monospace" }}>Duration (min) — click to edit</p>
          <div style={{ display: "flex", gap: 12 }}>
            {(["focus", "short", "long"] as TimerMode[]).map(m => (
              <div key={m} style={{ flex: 1 }}>
                <p style={{ fontSize: 7, letterSpacing: "0.18em", color: BORDER, textTransform: "uppercase", marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>{m}</p>
                {editingMode === m ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <input ref={editRef} value={editVal} onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingMode(null); }}
                      type="number" min={1} max={180}
                      style={{ width: 38, textAlign: "center", fontSize: 11, fontWeight: 700, border: `1px solid ${ACCENT}`, background: "transparent", outline: "none", padding: "2px 3px", fontFamily: "'JetBrains Mono', monospace", color: DARK }} />
                    <button onClick={commitEdit} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><Check size={10} color={ACCENT} /></button>
                    <button onClick={() => setEditingMode(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><X size={10} color={BORDER} /></button>
                  </div>
                ) : (
                  <button onClick={() => { setEditingMode(m); setEditVal(String(durations[m])); }}
                    style={{ fontSize: 17, fontWeight: 700, color: DARK, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'JetBrains Mono', monospace" }}>
                    {durations[m]}
                  </button>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 5 }}>
                  {PRESETS[m].map(p => (
                    <button key={p} onClick={() => applyDuration(m, p)} style={{
                      fontSize: 7, padding: "2px 5px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
                      border: `1px solid ${durations[m] === p ? ACCENT : BORDER}`,
                      background: durations[m] === p ? `${ACCENT}18` : "transparent",
                      color: durations[m] === p ? ACCENT : BORDER,
                    }}>{p}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sound panel */}
      {showSound && (
        <div style={{ borderBottom: `2px solid ${DARK}`, padding: "11px 12px", background: `linear-gradient(135deg, ${PANEL} 0%, #EAD4F0 100%)` }}>
          <p style={{ fontSize: 7, letterSpacing: "0.2em", color: BORDER, textTransform: "uppercase", marginBottom: 9, fontFamily: "'JetBrains Mono', monospace" }}>Sound</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <button onClick={sound.toggleSfx} style={{ width: 18, height: 18, border: `1px solid ${sound.sfxEnabled ? DARK : BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", background: sound.sfxEnabled ? `${DARK}18` : "transparent", cursor: "pointer", flexShrink: 0 }}>
                {sound.sfxEnabled ? <Volume2 size={8} color={DARK} /> : <VolumeX size={8} color={BORDER} />}
              </button>
              <span style={{ fontSize: 7, letterSpacing: "0.14em", color: BORDER, fontFamily: "'JetBrains Mono', monospace", width: 74 }}>Sound Effects</span>
              <input type="range" min={0} max={1} step={0.05} value={sound.sfxVolume}
                onChange={e => sound.setSfxVolume(parseFloat(e.target.value))}
                disabled={!sound.sfxEnabled}
                style={{ flex: 1, accentColor: "oklch(0.55 0.14 310)", cursor: sound.sfxEnabled ? "pointer" : "default", opacity: sound.sfxEnabled ? 1 : 0.4 }} />
              <span style={{ fontSize: 7, color: BORDER, fontFamily: "'JetBrains Mono', monospace", width: 22, textAlign: "right" }}>{Math.round(sound.sfxVolume * 100)}%</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <button onClick={sound.toggleMusic} style={{ width: 18, height: 18, border: `1px solid ${sound.musicEnabled ? DARK : BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", background: sound.musicEnabled ? `${DARK}18` : "transparent", cursor: "pointer", flexShrink: 0 }}>
                {sound.musicLoading ? <span style={{ fontSize: 6, color: DARK }}>…</span> : <Coffee size={8} color={sound.musicEnabled ? DARK : BORDER} />}
              </button>
              <span style={{ fontSize: 7, letterSpacing: "0.14em", color: BORDER, fontFamily: "'JetBrains Mono', monospace", width: 74 }}>Lo-fi Jazz</span>
              <input type="range" min={0} max={1} step={0.05} value={sound.musicVolume}
                onChange={e => sound.setMusicVolume(parseFloat(e.target.value))}
                disabled={!sound.musicEnabled}
                style={{ flex: 1, accentColor: "oklch(0.58 0.18 340)", cursor: sound.musicEnabled ? "pointer" : "default", opacity: sound.musicEnabled ? 1 : 0.4 }} />
              <span style={{ fontSize: 7, color: BORDER, fontFamily: "'JetBrains Mono', monospace", width: 22, textAlign: "right" }}>{Math.round(sound.musicVolume * 100)}%</span>
            </div>

          </div>
        </div>
      )}

      {/* ── Complete wrap-up ── */}
      {phase === "complete" && (
        <CompleteWrapUp sessions={sessions} mode={mode} onNewSession={handleNewSession} duration={durations[mode]} />
      )}

      {/* ── Quit wrap-up ── */}
      {phase === "quit" && (
        <QuitWrapUp quitCount={quitCount} stripsLeft={stripsLeft} onNewSession={handleNewSession} />
      )}

      {/* ── Transition countdown ── */}
      {phase === "transition" && nextMode && (
        <div style={{ background: BG, padding: "22px 16px", textAlign: "center" }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: "0.22em", color: BORDER, textTransform: "uppercase", marginBottom: 7 }}>NEXT UP</p>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>{MODE_LABELS[nextMode]}</p>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: DARK, marginBottom: 12 }}>{transitionCountdown}</p>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: BORDER, marginBottom: 12 }}>Starting automatically…</p>
          <button onClick={handleSkipTransition} style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: "0.14em",
            background: ACCENT, color: "#fff", border: "none", padding: "6px 16px", cursor: "pointer",
            boxShadow: `2px 2px 0 ${DARK}`,
          }}>Start now →</button>
        </div>
      )}

      {/* ── Block complete ── */}
      {phase === "block_complete" && (
        <div style={{ background: BG, padding: "22px 16px", textAlign: "center" }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: "0.22em", color: "oklch(0.55 0.14 310)", textTransform: "uppercase", marginBottom: 7 }}>BLOCK COMPLETE</p>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: DARK, marginBottom: 5 }}>4 sessions done.</p>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: BORDER, lineHeight: 1.6, marginBottom: 16 }}>
            You completed a full Pomodoro block.<br />Take a real break — you earned it.
          </p>
          <div style={{ display: "flex", gap: 5, justifyContent: "center", marginBottom: 16 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ width: 7, height: 7, background: "oklch(0.55 0.14 310)" }} />
            ))}
          </div>
          <button onClick={handleNewSession} style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: "0.14em",
            background: DARK, color: "#FAF6F1", border: "none", padding: "7px 20px", cursor: "pointer",
            boxShadow: `2px 2px 0 ${BORDER}`,
          }}>Start new block</button>
        </div>
      )}

      {/* ── GAME OVER screen when all hearts are lost ── */}
      {hearts5 === 0 && showMainScene && (
        <div style={{
          background: DARK, padding: "24px 16px", textAlign: "center",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        }}>
          <div style={{ fontSize: 22 }}>💀</div>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.22em", color: "#ff6b8a", textTransform: "uppercase", fontWeight: 700 }}>YOUR PET IS GONE</p>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: "#FAF6F1", opacity: 0.7, lineHeight: 1.7 }}>You ran out of hearts today.<br />Come back tomorrow — or reset to try again.</p>
          <button onClick={resetDeaths} style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: "0.14em",
            background: "#ff6b8a", color: "#fff", border: "none", padding: "6px 16px",
            cursor: "pointer", marginTop: 4, boxShadow: `2px 2px 0 #FAF6F1`,
          }}>↺ Revive pet</button>
        </div>
      )}

      {/* ── Main timer scene (idle / running / paused) ── */}
      {showMainScene && hearts5 > 0 && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Pet screen */}
          <div style={{
            background: SCREEN_BG,
            margin: "8px 8px 0",
            border: `2px solid ${DARK}`,
            position: "relative",
            height: 130,
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
          }}>
            {/* Pixel grid overlay */}
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 7px, rgba(0,0,0,0.04) 8px), repeating-linear-gradient(90deg, transparent, transparent 7px, rgba(0,0,0,0.04) 8px)",
              pointerEvents: "none",
            }} />

            {/* Hearts floating upward */}
            {hearts.map((h) => (
              <div key={h.id} style={{
                position: "absolute",
                left: `${h.x}%`,
                bottom: `${h.y}%`,
                fontSize: h.size,
                opacity: h.opacity,
                transform: "translateX(-50%)",
                pointerEvents: "none",
                transition: "none",
                color: "#E8A0B8",
              }}>♥</div>
            ))}

            {/* Pet */}
            <div className={bounce ? "ft-pet-bounce" : ""} style={{ transition: "transform 0.15s ease" }}>
              {petFace()}
            </div>

            {/* Status label top-left */}
            <div style={{
              position: "absolute", top: 5, left: 6,
              fontSize: 6, letterSpacing: "0.10em", color: DARK,
              textTransform: "uppercase", opacity: 0.7,
              fontFamily: "'JetBrains Mono', monospace",
            }}>{petStatus()}</div>

            {/* MIT label top-right */}
            {mitLabel && (
              <div style={{
                position: "absolute", top: 5, right: 6,
                fontSize: 6, color: ACCENT, letterSpacing: "0.06em",
                fontFamily: "'JetBrains Mono', monospace", maxWidth: 80,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>★ {mitLabel}</div>
            )}
            {/* Growth % counter — bottom-right */}
            <div style={{
              position: "absolute", bottom: 5, right: 6,
              display: "flex", flexDirection: "column", alignItems: "flex-end",
            }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9, fontWeight: 700,
                color: displayedGrowth >= 100 ? ACCENT : "oklch(0.72 0.12 350)",
                letterSpacing: "0.04em",
                lineHeight: 1,
              }}>{displayedGrowth}%</span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 5, letterSpacing: "0.12em",
                color: "oklch(0.72 0.10 350)", textTransform: "uppercase", marginTop: 1,
              }}>grown</span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ margin: "0 8px", display: "flex", gap: 1, background: `${BORDER}30`, border: `1px solid ${DARK}`, borderTop: "none" }}>
            {segments.map((filled, i) => (
              <div key={i} style={{ flex: 1, height: 4, background: filled ? ACCENT : "transparent", transition: "background 0.5s" }} />
            ))}
          </div>

          {/* Large timer display (Lab style) */}
          <div style={{ textAlign: "center", padding: "16px 0 14px" }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 38, fontWeight: 700,
              letterSpacing: "0.06em",
              color: phase === "paused" ? `${DARK}88` : DARK,
              lineHeight: 1,
            }}>{mm}:{ss}</span>
          </div>

          {/* Preset duration buttons — always rendered to keep fixed height; disabled while running */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "0 12px 18px", minHeight: 28 }}>
            {PRESETS[mode].map((p) => (
              <button
                key={p}
                onClick={() => { if (phase === "idle") applyDuration(mode, p); }}
                disabled={phase !== "idle"}
                style={{
                  padding: "3px 10px",
                  fontSize: 8,
                  letterSpacing: "0.12em",
                  background: durations[mode] === p ? ACCENT : BTN_BG,
                  color: durations[mode] === p ? "#fff" : DARK,
                  border: `1.5px solid ${BORDER}`,
                  cursor: phase === "idle" ? "pointer" : "default",
                  fontFamily: "'JetBrains Mono', monospace",
                  boxShadow: durations[mode] === p ? `1px 1px 0 ${DARK}` : "none",
                  opacity: phase === "idle" ? 1 : 0.35,
                  transition: "opacity 0.2s",
                }}
              >{p} MIN</button>
            ))}
          </div>

          {/* Care log — always fixed height (3 lines) so window never resizes */}
          <div style={{ borderTop: `1px solid ${BORDER}30`, padding: "5px 10px 7px", background: PANEL, flexShrink: 0, height: 72, overflow: "hidden" }}>
            {careLog.length === 0 ? (
              // Idle placeholder
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ fontSize: 6, letterSpacing: "0.14em", color: BORDER, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>care log</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {[
                    { emoji: "🌸", text: "taking care of your pet..." },
                    { emoji: "✦", text: phase === "idle" ? "press START when you're ready" : "session in progress" },
                    { emoji: "💤", text: "pet is resting..." },
                  ].map((line, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, opacity: i === 0 ? 0.55 : i === 1 ? 0.40 : 0.25 }}>
                      <span style={{ fontSize: 9 }}>{line.emoji}</span>
                      <span style={{ fontSize: 7, color: DARK, letterSpacing: "0.06em", fontFamily: "'JetBrains Mono', monospace", fontStyle: "italic" }}>{line.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Active care log entries
              <>
                <div style={{ fontSize: 6, letterSpacing: "0.14em", color: BORDER, marginBottom: 3, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>care log</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, overflow: "hidden", maxHeight: 52 }}>
                  {careLog.map((entry, i) => (
                    <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 5, opacity: i === 0 ? 1 : i === 1 ? 0.75 : 0.4 }}>
                      <span style={{ fontSize: 9 }}>{entry.emoji}</span>
                      <span style={{ fontSize: 7, color: DARK, letterSpacing: "0.06em", fontFamily: "'JetBrains Mono', monospace" }}>{entry.text}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Controls row */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 9px",
            background: PANEL, borderTop: `2px solid ${DARK}`,
            flexShrink: 0, flexWrap: "nowrap", overflow: "hidden",
          }}>
            {/* Quit */}
            {(running || phase === "paused") && (
              <button onClick={handleQuit} title="Quit session" style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "4px 9px", background: "transparent",
                border: `1.5px solid ${BORDER}`, color: BORDER,
                cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
                fontSize: 7, letterSpacing: "0.12em",
                boxShadow: `2px 2px 0 ${BORDER}`,
              }}>
                <RotateCcw size={8} /> QUIT
              </button>
            )}

            {/* Play / Pause */}
            {phase !== "recovering" && (
              <>
                <button onClick={handleStartPause} style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 16px",
                  background: running ? BTN_BG : ACCENT,
                  border: `1.5px solid ${running ? BORDER : DARK}`,
                  color: running ? DARK : "#fff",
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 7,
                  letterSpacing: "0.14em", cursor: "pointer",
                  boxShadow: running ? `2px 2px 0 ${BORDER}` : `2px 2px 0 ${DARK}`,
                  fontWeight: 700, transition: "all 0.12s", flexShrink: 0,
                }}>
                  {running ? <><Pause size={8} /> PAUSE</> : <><Play size={8} /> {phase === "paused" ? "RESUME" : "START"}</>}
                </button>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 6,
                  letterSpacing: "0.08em",
                  color: BORDER,
                  userSelect: "none",
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}>
                  press
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    lineHeight: 1,
                    color: BORDER,
                    marginLeft: 2,
                  }}>⎵</span>
                </span>
              </>
            )}

            {/* Session dots */}
            <div style={{ display: "flex", alignItems: "center", gap: 3, marginLeft: "auto" }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{
                  width: 6, height: 6,
                  background: i < sessions % 4 ? ACCENT : `${BORDER}40`,
                  border: `1px solid ${i < sessions % 4 ? ACCENT : BORDER}`,
                  transition: "background 0.3s",
                }} />
              ))}
              <span style={{ fontSize: 7, letterSpacing: "0.10em", color: BORDER, marginLeft: 3, fontFamily: "'JetBrains Mono', monospace" }}>{sessions}/4</span>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

export default FocusTimer;
