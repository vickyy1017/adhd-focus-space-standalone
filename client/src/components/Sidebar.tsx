/* ============================================================
   ADHD FOCUS SPACE — Sidebar v7.0 (Retro Lo-Fi Desktop + Mobile)
   Desktop: fixed left sidebar (56px wide)
   Mobile: fixed bottom tab bar (shows 5 main nav items)
   ============================================================ */

import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useTimer } from "@/contexts/TimerContext";
import { useSoundContext } from "@/contexts/SoundContext";
import { EffectsPanel } from "@/components/EffectsPanel";
import { useMobile } from "@/hooks/useMobile";

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  onClearData?: () => void;
}

/* ── Thin-line minimal SVG icons ──
   Clean geometric outlines — simple, no fill, consistent stroke weight */

function IconHome({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
      <path d="M3 9.5L10 3l7 6.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 8v8h4v-4h2v4h4V8" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconFocus({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7" stroke={color} strokeWidth="1.5"/>
      <circle cx="10" cy="10" r="3" stroke={color} strokeWidth="1.2"/>
      <line x1="10" y1="3" x2="10" y2="1" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="10" y1="17" x2="10" y2="19" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="3" y1="10" x2="1" y2="10" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="17" y1="10" x2="19" y2="10" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconTasks({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3" width="14" height="14" rx="2" stroke={color} strokeWidth="1.5"/>
      <line x1="7" y1="7" x2="13" y2="7" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
      <line x1="7" y1="10" x2="13" y2="10" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
      <line x1="7" y1="13" x2="10" y2="13" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

function IconWins({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
      {/* Trophy cup */}
      <path d="M7 3h6v7a3 3 0 01-6 0V3z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M7 6H4a2 2 0 000 4h3" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M13 6h3a2 2 0 010 4h-3" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
      <line x1="10" y1="13" x2="10" y2="16" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
      <line x1="7" y1="16" x2="13" y2="16" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconDump({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
      {/* Brain outline */}
      <path d="M10 16c-4 0-6-2.5-6-5.5 0-1.5.6-2.8 1.5-3.7C5.8 5.5 6 4.5 6.5 4c.5-.5 1.2-.8 2-.8.5 0 1 .1 1.5.4.5-.3 1-.4 1.5-.4.8 0 1.5.3 2 .8.5.5.7 1.5 1 2.8.9.9 1.5 2.2 1.5 3.7C16 13.5 14 16 10 16z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
      <line x1="10" y1="3.6" x2="10" y2="16" stroke={color} strokeWidth="1" strokeLinecap="round" strokeDasharray="1.5 1.5"/>
    </svg>
  );
}

function IconGoals({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
      {/* Flag on pole */}
      <line x1="5" y1="3" x2="5" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M5 3h9l-2 3.5L14 10H5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconAgents({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
      {/* Robot face */}
      <rect x="4" y="6" width="12" height="9" rx="2" stroke={color} strokeWidth="1.5"/>
      <rect x="2" y="9" width="2" height="3" rx="1" stroke={color} strokeWidth="1.2"/>
      <rect x="16" y="9" width="2" height="3" rx="1" stroke={color} strokeWidth="1.2"/>
      <line x1="10" y1="3" x2="10" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="10" cy="3" r="1" fill={color}/>
      <circle cx="7.5" cy="10" r="1.2" fill={color}/>
      <circle cx="12.5" cy="10" r="1.2" fill={color}/>
      <line x1="7.5" y1="13" x2="12.5" y2="13" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function IconStorage({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
      {/* Cloud with up arrow */}
      <path d="M5.5 13.5A3.5 3.5 0 015 6.5a4 4 0 017.9-.5A3 3 0 0115 12.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 10v6M8 14l2 2 2-2" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconAI({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
      {/* Sparkle / star */}
      <path d="M10 2v4M10 14v4M2 10h4M14 10h4" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M4.93 4.93l2.83 2.83M12.24 12.24l2.83 2.83M4.93 15.07l2.83-2.83M12.24 7.76l2.83-2.83" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="10" cy="10" r="2" stroke={color} strokeWidth="1.3"/>
    </svg>
  );
}

/* NAV config — now uses thin-line icon components */
interface NavIconProps { color: string }
const NAV: Array<{
  id: string;
  short: string;
  Icon: React.FC<NavIconProps>;
  title: string;
}> = [
  { id: "dashboard", short: "HOME",   Icon: IconHome,   title: "Dashboard"   },
  { id: "tasks",     short: "TASKS",  Icon: IconTasks,  title: "My Tasks"     },
  { id: "dump",      short: "DUMP",   Icon: IconDump,   title: "Brain Dump"   },
];

/* Mobile bottom tab bar — HOME / TASKS / DUMP / MONTHLY / SET */
const MOBILE_NAV = [
  { id: "dashboard", short: "HOME",   Icon: IconHome,   title: "Dashboard"   },
  { id: "tasks",     short: "TASKS",  Icon: IconTasks,  title: "My Tasks"     },
  { id: "dump",      short: "DUMP",   Icon: IconDump,   title: "Brain Dump"   },
  { id: "monthly",   short: "MONTHLY", Icon: (p: { color: string }) => (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="4" width="14" height="12" rx="1.5" stroke={p.color} strokeWidth="1.4"/>
      <line x1="2" y1="8" x2="16" y2="8" stroke={p.color} strokeWidth="1.2"/>
      <line x1="6" y1="2" x2="6" y2="6" stroke={p.color} strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="12" y1="2" x2="12" y2="6" stroke={p.color} strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="6" cy="11" r="1" fill={p.color} />
      <circle cx="9" cy="11" r="1" fill={p.color} />
      <circle cx="12" cy="11" r="1" fill={p.color} />
    </svg>
  ), title: "Monthly" },
  { id: "settings",  short: "SET",    Icon: (p: { color: string }) => (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="3" stroke={p.color} strokeWidth="1.4"/>
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke={p.color} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ), title: "Settings" },
];

/* ── Floating timer pill ── */
export function TimerPill({ onGoToFocus }: { onGoToFocus: () => void }) {
  const { phase, remaining, mode, durations, handleStartPause } = useTimer();
  const sound = useSoundContext();
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const active = phase === "running" || phase === "paused" || phase === "transition";
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const idleMins = String(durations?.focus ?? 25).padStart(2, "0");
  const modeColor = active
    ? (mode === "focus" ? "oklch(0.52 0.10 32)" : mode === "short" ? "oklch(0.60 0.07 138)" : "oklch(0.58 0.08 220)")
    : "oklch(0.62 0.060 330)";
  const modeBg = active
    ? (mode === "focus" ? "oklch(0.52 0.10 32 / 0.10)" : mode === "short" ? "oklch(0.60 0.07 138 / 0.10)" : "oklch(0.58 0.08 220 / 0.10)")
    : "transparent";
  const label = active
    ? (mode === "focus" ? "FOCUS" : mode === "short" ? "SHORT" : "LONG")
    : "FOCUS";

  // Close popover on outside click
  useEffect(() => {
    if (!showPopover) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPopover]);

  // Stop music on pause, resume on resume if it was playing
  const [wasPlayingRef] = useState({ value: false });
  useEffect(() => {
    if (phase === "paused" && sound.musicEnabled) {
      wasPlayingRef.value = true;
      sound.toggleMusic();
    } else if (phase === "running" && wasPlayingRef.value && !sound.musicEnabled) {
      wasPlayingRef.value = false;
      sound.toggleMusic();
    } else if (phase !== "paused") {
      wasPlayingRef.value = false;
    }
  }, [phase]);

  const handleClick = () => {
    setShowPopover(p => !p);
  };

  return (
    <div style={{ position: "relative" }} ref={popoverRef}>
      <button
        onClick={handleClick}
        title={active ? `${mm}:${ss} · ${label} — click for controls` : "Go to Focus Timer"}
        className="flex flex-col items-center justify-center py-2 transition-all duration-200"
        style={{
          background: modeBg,
          borderTop: `1px solid ${active ? modeColor : "oklch(0.80 0.060 340 / 0.4)"}`,
          borderBottom: `1px solid ${active ? modeColor : "oklch(0.80 0.060 340 / 0.4)"}`,
          borderLeft: `1px solid ${active ? modeColor : "oklch(0.80 0.060 340 / 0.4)"}`,
          borderRight: "none",
          borderRadius: "6px 0 0 6px",
          opacity: active ? 1 : 0.55,
          width: 32,
          minHeight: 64,
        }}
      >
        <div style={{ position: "relative", width: 6, height: 6, marginBottom: 3 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%", background: modeColor,
            animation: phase === "running" ? "timerPulse 2s ease-in-out infinite" : "none"
          }} />
        </div>
        <span
          className="tabular-nums"
          style={{ fontSize: 10, letterSpacing: "0.06em", color: modeColor, fontFamily: "'Space Mono', monospace", lineHeight: 1 }}
        >
          {phase === "transition" ? "NEXT" : active ? `${mm}:${ss}` : `${idleMins}:00`}
        </span>
        <span
          style={{ fontSize: 6, color: modeColor, fontFamily: "'Space Mono', monospace", marginTop: 2, opacity: 0.75, letterSpacing: "0.12em" }}
        >
          {phase === "paused" ? "PAUSED" : label}
        </span>
      </button>

      {/* Mini popover — only when timer is active */}
      {showPopover && active && (
        <div
          style={{
            position: "absolute",
            right: "calc(100% + 8px)",
            bottom: 0,
            zIndex: 200,
            background: "oklch(0.97 0.015 340)",
            border: "1.5px solid oklch(0.75 0.08 340)",
            boxShadow: "3px 3px 0 oklch(0.82 0.040 340 / 0.5)",
            padding: "10px 12px",
            minWidth: 160,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 7, letterSpacing: "0.14em", color: "oklch(0.45 0.08 340)", textTransform: "uppercase" }}>
              {label} · {mm}:{ss}
            </span>
            <button
              onClick={() => setShowPopover(false)}
              style={{ fontSize: 8, color: "oklch(0.65 0.06 340)", background: "transparent", border: "none", cursor: "pointer", lineHeight: 1 }}
            >✕</button>
          </div>

          {/* Pause / Resume */}
          <button
            onClick={() => { handleStartPause(); setShowPopover(false); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 8px",
              fontFamily: "'Space Mono', monospace",
              fontSize: 7,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 700,
              background: modeColor,
              color: "#fff",
              border: "none",
              cursor: "pointer",
              width: "100%",
            }}
          >
            <span style={{ fontSize: 9 }}>{phase === "running" ? "⏸" : "▶"}</span>
            {phase === "running" ? "Pause" : "Resume"}
          </button>

          {/* Music toggle */}
          <button
            onClick={sound.toggleMusic}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 8px",
              fontFamily: "'Space Mono', monospace",
              fontSize: 7,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              background: sound.musicEnabled ? "oklch(0.90 0.04 340)" : "transparent",
              color: "oklch(0.45 0.08 340)",
              border: "1px solid oklch(0.75 0.08 340)",
              cursor: "pointer",
              width: "100%",
            }}
          >
            <span style={{ fontSize: 9 }}>♪</span>
            {sound.musicEnabled ? "Music On" : "Music Off"}
          </button>


        </div>
      )}
    </div>
  );
}

/* ── Logo mark ── */
function LogoMark() {
  return (
    <div className="w-10 h-10 flex items-center justify-center" title="ADHD Focus Space">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Outer glow ring */}
        <circle cx="16" cy="16" r="14" fill="oklch(0.58 0.18 340 / 0.12)" />
        {/* 6-point star */}
        <path
          d="M16 4 L17.8 11.2 L24.5 8.5 L20.8 14.8 L28 16 L20.8 17.2 L24.5 23.5 L17.8 20.8 L16 28 L14.2 20.8 L7.5 23.5 L11.2 17.2 L4 16 L11.2 14.8 L7.5 8.5 L14.2 11.2 Z"
          fill="oklch(0.58 0.18 340)"
          opacity="0.9"
        />
        {/* Inner star highlight */}
        <path
          d="M16 9 L17.1 13.4 L21.2 11.8 L18.8 15.4 L23 16 L18.8 16.6 L21.2 20.2 L17.1 18.6 L16 23 L14.9 18.6 L10.8 20.2 L13.2 16.6 L9 16 L13.2 15.4 L10.8 11.8 L14.9 13.4 Z"
          fill="white"
          opacity="0.55"
        />
        {/* Center dot */}
        <circle cx="16" cy="16" r="2" fill="white" opacity="0.9" />
        {/* Sparkle top-right */}
        <path d="M24 7 L24.5 8.5 L26 7 L24.5 5.5 Z" fill="oklch(0.78 0.12 340)" opacity="0.8" />
        {/* Sparkle bottom-left */}
        <path d="M8 25 L8.5 26.5 L10 25 L8.5 23.5 Z" fill="oklch(0.78 0.12 340)" opacity="0.6" />
      </svg>
    </div>
  );
}

function LiveTime() {
  const fmt = () =>
    new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const [t, setT] = useState(fmt);
  useEffect(() => {
    const id = setInterval(() => setT(fmt()), 30000);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      style={{ fontSize: 8, letterSpacing: "0.08em", color: "oklch(0.52 0.060 330)", fontFamily: "'Space Mono', monospace" }}
    >
      {t}
    </span>
  );
}

/* Calendar icon link to /monthly */
function MonthlyLink({ onNavigate }: { onNavigate?: (s: string) => void }) {
  const [location, navigate] = useLocation();
  const active = location === "/monthly" || (location === "/" && typeof window !== "undefined" && window.location.hash === "#monthly");
  const color = active ? "oklch(0.48 0.18 340)" : "oklch(0.52 0.060 330)";
  return (
    <button
      data-tour-id="tour-monthly"
      onClick={() => onNavigate ? onNavigate("monthly") : navigate("/monthly")}
      title="Monthly Progress"
      className="relative w-full flex flex-col items-center justify-center py-2.5 transition-all duration-150"
      style={{ background: active ? "oklch(0.58 0.18 340 / 0.10)" : "transparent" }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.58 0.18 340 / 0.05)"; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
    >
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5" style={{ background: "oklch(0.58 0.18 340)" }} />
      )}
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="4" width="14" height="12" rx="1.5" stroke={color} strokeWidth="1.4"/>
        <line x1="2" y1="8" x2="16" y2="8" stroke={color} strokeWidth="1.2"/>
        <line x1="6" y1="2" x2="6" y2="6" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="12" y1="2" x2="12" y2="6" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="6" cy="11" r="1" fill={color} />
        <circle cx="9" cy="11" r="1" fill={color} />
        <circle cx="12" cy="11" r="1" fill={color} />
        <circle cx="6" cy="14" r="1" fill={color} />
        <circle cx="9" cy="14" r="1" fill={color} />
      </svg>
      <span style={{ fontSize: 7, marginTop: 2, letterSpacing: "0.12em", fontFamily: "'Space Mono', monospace", color }}>MTH</span>
    </button>
  );
}




/* Guide link — secondary/help item, visually demoted below the divider */
function GuideLink({ onNavigate }: { onNavigate?: (s: string) => void }) {
  const [location, navigate] = useLocation();
  const active = location === "/guide" || (location === "/" && typeof window !== "undefined" && window.location.hash === "#guide");
  const color = active ? "oklch(0.48 0.18 340)" : "oklch(0.68 0.025 330)";
  return (
    <button
      data-tour-id="tour-guide"
      onClick={() => onNavigate ? onNavigate("guide") : navigate("/guide")}
      title="App Guide"
      className="relative w-full flex flex-col items-center justify-center py-1.5 transition-all duration-150"
      style={{
        background: active ? "oklch(0.58 0.18 340 / 0.08)" : "transparent",
        opacity: active ? 1 : 0.5,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.opacity = "0.5"; }}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.2"/>
        <text x="8" y="12" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="8" fill={color} fontWeight="600">?</text>
      </svg>
      <span style={{ fontSize: 6, marginTop: 1.5, letterSpacing: "0.10em", fontFamily: "'Space Mono', monospace", color }}>GUIDE</span>
    </button>
  );
}

/* Tour replay button — fires startOnboardingTour event */
function TourButton() {
  const color = "oklch(0.68 0.025 330)";
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("startOnboardingTour"))}
      title="Take the feature tour"
      className="relative w-full flex flex-col items-center justify-center py-1.5 transition-all duration-150"
      style={{ background: "transparent", opacity: 0.5 }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.5"; }}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.2"/>
        <polygon points="6.5,5 11.5,8 6.5,11" fill={color} />
      </svg>
      <span style={{ fontSize: 6, marginTop: 1.5, letterSpacing: "0.10em", fontFamily: "'Space Mono', monospace", color }}>TOUR</span>
    </button>
  );
}

if (typeof document !== "undefined" && !document.getElementById("sidebar-timer-pulse")) {
  const s = document.createElement("style");
  s.id = "sidebar-timer-pulse";
  s.textContent = `@keyframes timerPulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.7); } }`;
  document.head.appendChild(s);
}

/* ── Mobile "More" menu overlay ── */
function MobileMoreMenu({
  activeSection,
  onSectionChange,
  onClose,
}: {
  activeSection: string;
  onSectionChange: (s: string) => void;
  onClose: () => void;
}) {
  const MORE_ITEMS = [
    { id: "monthly", short: "MONTHLY",    Icon: (p: { color: string }) => (
      <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="4" width="14" height="12" rx="1.5" stroke={p.color} strokeWidth="1.4"/>
        <line x1="2" y1="8" x2="16" y2="8" stroke={p.color} strokeWidth="1.2"/>
        <line x1="6" y1="2" x2="6" y2="6" stroke={p.color} strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="12" y1="2" x2="12" y2="6" stroke={p.color} strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="6" cy="11" r="1" fill={p.color} />
        <circle cx="9" cy="11" r="1" fill={p.color} />
        <circle cx="12" cy="11" r="1" fill={p.color} />
      </svg>
    ), title: "Monthly" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 998,
          background: "oklch(0.18 0.01 60 / 0.3)",
          backdropFilter: "blur(2px)",
        }}
      />
      {/* Menu panel */}
      <div
        style={{
          position: "fixed",
          bottom: "calc(60px + env(safe-area-inset-bottom, 0px))",
          right: 0,
          left: 0,
          zIndex: 999,
          background: "oklch(0.930 0.045 355)",
          borderTop: "1.5px solid oklch(0.80 0.060 340)",
          boxShadow: "0 -4px 20px oklch(0.58 0.18 340 / 0.12)",
          padding: "12px 16px",
          paddingBottom: "8px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.48rem", letterSpacing: "0.12em", color: "oklch(0.52 0.060 330)", textTransform: "uppercase", marginBottom: 4, opacity: 0.7 }}>
          More
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(1, 1fr)", gap: 8 }}>
          {MORE_ITEMS.map(({ id, short, Icon, title }) => {
            const active = activeSection === id;
            const color = active ? "oklch(0.48 0.18 340)" : "oklch(0.52 0.060 330)";
            return (
              <button
                key={id}
                onClick={() => { onSectionChange(id); onClose(); }}
                title={title}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "10px 4px",
                  background: active ? "oklch(0.58 0.18 340 / 0.12)" : "oklch(0.975 0.012 355 / 0.6)",
                  border: active ? "1px solid oklch(0.58 0.18 340 / 0.25)" : "1px solid oklch(0.86 0.030 340)",
                  borderRadius: 8,
                  gap: 4,
                  cursor: "pointer",
                }}
              >
                <Icon color={color} />
                <span style={{ fontSize: "0.45rem", letterSpacing: "0.10em", fontFamily: "'Space Mono', monospace", color, fontWeight: active ? 700 : 400 }}>
                  {short}
                </span>
              </button>
            );
          })}
        </div>
        {/* Settings row */}
        <div style={{ marginTop: 8, borderTop: "1px solid oklch(0.80 0.060 340 / 0.5)", paddingTop: 8 }}>
          <EffectsPanel />
        </div>
      </div>
    </>
  );
}

export function Sidebar({ activeSection, onSectionChange, onClearData }: SidebarProps) {
  const isMobile = useMobile();
  const [showMore, setShowMore] = useState(false);

  /* ── Mobile: bottom tab bar ── */
  if (isMobile) {
    return (
      <>
        {showMore && (
          <MobileMoreMenu
            activeSection={activeSection}
            onSectionChange={onSectionChange}
            onClose={() => setShowMore(false)}
          />
        )}
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch"
          style={{
            background: "oklch(0.930 0.045 355)",
            borderTop: "1.5px solid oklch(0.80 0.060 340)",
            boxShadow: "0 -2px 12px oklch(0.58 0.18 340 / 0.10)",
            height: "calc(60px + env(safe-area-inset-bottom, 0px))",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {MOBILE_NAV.map(({ id, short, Icon, title }) => {
            const active = activeSection === id;
            const color = active ? "oklch(0.48 0.18 340)" : "oklch(0.52 0.060 330)";
            return (
              <button
                key={id}
                data-nav-id={id}
                onClick={() => { onSectionChange(id); setShowMore(false); }}
                title={title}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  background: active ? "oklch(0.58 0.18 340 / 0.10)" : "transparent",
                  border: "none",
                  borderTop: active ? "2px solid oklch(0.58 0.18 340)" : "2px solid transparent",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  padding: "6px 2px 4px",
                }}
              >
                <Icon color={color} />
                <span style={{
                  fontSize: "0.42rem",
                  letterSpacing: "0.10em",
                  fontFamily: "'Space Mono', monospace",
                  color,
                  fontWeight: active ? 700 : 400,
                }}>
                  {short}
                </span>
              </button>
            );
          })}

        </nav>
      </>
    );
  }

  /* ── Desktop: left sidebar ── */
  return (
    <aside
      className="fixed left-0 top-0 h-screen w-14 z-40 flex flex-col items-center py-4"
      style={{
        background: "oklch(0.930 0.045 355)",
        borderRight: "1.5px solid oklch(0.80 0.060 340)",
        boxShadow: "2px 0 8px oklch(0.58 0.18 340 / 0.08)",
      }}
    >
      {/* Live time at top */}
      <div className="mb-3 flex flex-col items-center gap-1">
        <LiveTime />
      </div>

      {/* Divider */}
      <div style={{ width: "70%", height: "1px", background: "oklch(0.80 0.060 340)", marginBottom: 6 }} />

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1 w-full px-1.5">
        {NAV.map(({ id, short, Icon, title }) => {
          const active = activeSection === id;
          const color = active ? "oklch(0.48 0.18 340)" : "oklch(0.52 0.060 330)";
          return (
            <button
              key={id}
              data-nav-id={id}
              onClick={() => onSectionChange(id)}
              title={title}
              className="relative w-full flex flex-col items-center justify-center py-2 transition-all duration-150"
              style={{
                background: active ? "oklch(0.58 0.18 340 / 0.12)" : "transparent",
                borderRadius: 3,
                border: active ? "1px solid oklch(0.58 0.18 340 / 0.25)" : "1px solid transparent",
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.58 0.18 340 / 0.06)";
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              {active && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5"
                  style={{ background: "oklch(0.58 0.18 340)", borderRadius: "0 2px 2px 0" }}
                />
              )}
              <Icon color={color} />
              <span
                style={{
                  fontSize: 6.5,
                  marginTop: 2,
                  letterSpacing: "0.12em",
                  fontFamily: "'Space Mono', monospace",
                  color,
                  fontWeight: active ? 700 : 400,
                }}
              >
                {short}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div style={{ width: "70%", height: "1px", background: "oklch(0.80 0.060 340)", marginBottom: 4 }} />

      {/* Bottom links */}
      <div className="flex flex-col w-full gap-0">
        <MonthlyLink onNavigate={onSectionChange} />
      </div>

      {/* Effects panel (grain + work mode) */}
      <EffectsPanel />



      {/* Secondary divider — separates functional items from help */}
      <div style={{ width: "60%", height: "1px", background: "oklch(0.80 0.060 340 / 0.5)", margin: "12px 0 4px" }} />

      {/* Guide — secondary/help group, smaller and lighter */}
      <GuideLink onNavigate={onSectionChange} />
      {/* Tour replay button */}
      <TourButton />
    </aside>
  );
}
