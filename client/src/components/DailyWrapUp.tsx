/* ============================================================
   ADHD FOCUS SPACE — Daily Wrap-Up v3.0 (Morandi)
   End-of-day digest: agents, tasks, wins
   Coral/sage/slumber palette, English text
   ============================================================ */

import { useState } from "react";
import { CheckCircle2, ClipboardCopy, Loader2, Sparkles, X } from "lucide-react";
import { PixelAgents } from "@/components/PixelIcons";
import { toast } from "sonner";
import type { Task } from "./TaskManager";
import type { Win } from "./DailyWins";
import type { Agent } from "./AgentTracker";
import { callAI } from "@/lib/ai";

// ── Win category colours (must match DailyWins WIN_ICONS order) ──
const WIN_CAT_COLORS = [
  "oklch(0.62 0.18 355)",   // health
  "oklch(0.52 0.08 230)",  // study
  "oklch(0.55 0.14 290)",  // work
  "oklch(0.62 0.14 310)",   // social
  "oklch(0.55 0.10 300)",  // creative
  "oklch(0.55 0.07 250)",  // mindful
  "#111111",   // fitness
  "oklch(0.55 0.12 270)",  // nutrition
];
const WIN_CAT_LABELS = ["Health","Study","Work","Social","Creative","Mindful","Fitness","Nutrition"];

// Inline SVG icons matching DailyWins (simplified)
function WinSvgIcon({ idx, size = 22, color }: { idx: number; size?: number; color: string }) {
  const icons = [
    // 0 health: heart
    <svg key="h" viewBox="0 0 20 20" width={size} height={size} fill="none">
      <path d="M10 16s-7-4.5-7-8.5A4 4 0 0110 4a4 4 0 017 3.5C17 11.5 10 16 10 16z" fill={color} opacity="0.9"/>
    </svg>,
    // 1 study: open book
    <svg key="s" viewBox="0 0 20 20" width={size} height={size} fill="none">
      <path d="M3 5h6v11H3z" fill={color} opacity="0.85"/>
      <path d="M11 5h6v11h-6z" fill={color} opacity="0.6"/>
      <line x1="9" y1="5" x2="11" y2="5" stroke={color} strokeWidth="1.5"/>
      <line x1="9" y1="16" x2="11" y2="16" stroke={color} strokeWidth="1.5"/>
    </svg>,
    // 2 work: briefcase
    <svg key="w" viewBox="0 0 20 20" width={size} height={size} fill="none">
      <rect x="2" y="7" width="16" height="10" rx="2" fill={color} opacity="0.85"/>
      <path d="M7 7V5a1 1 0 011-1h4a1 1 0 011 1v2" stroke={color} strokeWidth="1.5" fill="none"/>
      <line x1="2" y1="12" x2="18" y2="12" stroke="white" strokeWidth="1" opacity="0.6"/>
    </svg>,
    // 3 social: two people
    <svg key="so" viewBox="0 0 20 20" width={size} height={size} fill="none">
      <circle cx="7" cy="6" r="3" fill={color} opacity="0.85"/>
      <circle cx="13" cy="6" r="3" fill={color} opacity="0.6"/>
      <path d="M1 17c0-3 2.5-5 6-5s6 2 6 5" fill={color} opacity="0.85"/>
      <path d="M13 12c2.5 0 5 1.5 5 5" stroke={color} strokeWidth="1.5" fill="none" opacity="0.6"/>
    </svg>,
    // 4 creative: star
    <svg key="cr" viewBox="0 0 20 20" width={size} height={size} fill="none">
      <polygon points="10,2 12.4,7.5 18.5,8 14,12 15.5,18 10,15 4.5,18 6,12 1.5,8 7.6,7.5" fill={color} opacity="0.9"/>
    </svg>,
    // 5 mindful: lotus
    <svg key="m" viewBox="0 0 20 20" width={size} height={size} fill="none">
      <path d="M10 16 C10 16 4 12 4 7 C4 4 7 3 10 6 C13 3 16 4 16 7 C16 12 10 16 10 16Z" fill={color} opacity="0.85"/>
      <path d="M10 16 C6 14 2 10 3 6" stroke={color} strokeWidth="1" fill="none" opacity="0.5"/>
      <path d="M10 16 C14 14 18 10 17 6" stroke={color} strokeWidth="1" fill="none" opacity="0.5"/>
    </svg>,
    // 6 fitness: lightning
    <svg key="f" viewBox="0 0 20 20" width={size} height={size} fill="none">
      <polygon points="12,2 5,11 10,11 8,18 15,9 10,9" fill={color} opacity="0.9"/>
    </svg>,
    // 7 nutrition: apple
    <svg key="n" viewBox="0 0 20 20" width={size} height={size} fill="none">
      <path d="M10 5 C6 5 3 8 3 12 C3 16 6 18 10 18 C14 18 17 16 17 12 C17 8 14 5 10 5Z" fill={color} opacity="0.85"/>
      <path d="M10 5 C10 3 12 2 13 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>,
  ];
  return icons[idx % icons.length] ?? icons[0];
}

// ── Grouped arc-segment wins ring (like health score reference) ──
function WinsRing({ wins }: { wins: Win[] }) {
  const [hoveredCat, setHoveredCat] = useState<number | null>(null);
  const [hoveredWin, setHoveredWin] = useState<string | null>(null);

  if (wins.length === 0) {
    return (
      <p className="text-sm italic" style={{ color: "#888888", fontFamily: "'Pretendard', system-ui, sans-serif" }}>
        No wins logged yet — completing tasks adds them automatically.
      </p>
    );
  }

  const total = wins.length;
  // Larger SVG to give room for icons outside the arc
  const SIZE = 280;
  const cx = 140, cy = 140;
  const arcR = 80;   // arc stroke center radius

  // Group wins by category index
  // iconIdx 99 (block complete) and 97 (focus session) are normalised to 5 (Mindful)
  const normIdx = (raw: number | undefined) => {
    if (raw === 99 || raw === 97) return 5; // Mindful
    return typeof raw === "number" ? raw % WIN_CAT_COLORS.length : 0;
  };
  const groups: { idx: number; wins: Win[] }[] = [];
  wins.forEach((w) => {
    const idx = normIdx(w.iconIdx);
    const existing = groups.find((g) => g.idx === idx);
    if (existing) existing.wins.push(w);
    else groups.push({ idx, wins: [w] });
  });

  // Sort groups by category index for consistent ordering
  groups.sort((a, b) => a.idx - b.idx);

  // Compute arc spans — proportional to win count, with LARGER gaps to prevent overlap
  // Minimum arc size ensures even single wins get a visible segment
  const MIN_ARC_DEG = 18; // minimum degrees per segment so it's always visible
  const GAP_DEG = groups.length > 1 ? 10 : 0; // generous gap between arcs
  const totalGap = GAP_DEG * groups.length;
  const totalMinArc = MIN_ARC_DEG * groups.length;
  const availableDeg = Math.max(0, 360 - totalGap - totalMinArc);

  let currentAngle = -90; // start at top
  const arcSegments = groups.map((g) => {
    const proportion = g.wins.length / total;
    const arcDeg = MIN_ARC_DEG + availableDeg * proportion;
    const startAngle = currentAngle + GAP_DEG / 2; // center the gap
    const endAngle = startAngle + arcDeg;
    const midAngle = (startAngle + endAngle) / 2;
    currentAngle = endAngle + GAP_DEG / 2;
    return { ...g, startAngle, endAngle, midAngle, arcDeg };
  });

  // Convert degrees to SVG arc path
  function polarToXY(angleDeg: number, radius: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function describeArc(startDeg: number, endDeg: number, radius: number) {
    const start = polarToXY(startDeg, radius);
    const end = polarToXY(endDeg, radius);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  }

  const STROKE = 14; // thinner arc so icons don't overlap the stroke
  // Icons sit OUTSIDE the arc ring to avoid overlapping segments
  const ICON_ORBIT_R = arcR + STROKE / 2 + 16; // outside the arc

  return (
    <div className="flex flex-col items-center gap-3">
      <div style={{ position: "relative", width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          {/* Background guide ring */}
          <circle cx={cx} cy={cy} r={arcR} fill="none" stroke="#E5E5E5" strokeWidth="1" strokeDasharray="3 5" />

          {/* Arc segments — use butt caps so gaps are clean */}
          {arcSegments.map((seg) => {
            const color = WIN_CAT_COLORS[seg.idx];
            const isHov = hoveredCat === seg.idx;
            const arcPath = describeArc(seg.startAngle, seg.endAngle, arcR);
            return (
              <path
                key={seg.idx}
                d={arcPath}
                fill="none"
                stroke={color}
                strokeWidth={isHov ? STROKE + 3 : STROKE}
                strokeLinecap="butt"
                opacity={isHov ? 1 : 0.80}
                style={{ transition: "stroke-width 0.2s, opacity 0.2s", cursor: "pointer" }}
                onMouseEnter={() => setHoveredCat(seg.idx)}
                onMouseLeave={() => setHoveredCat(null)}
              />
            );
          })}

          {/* Center count */}
          <text x={cx} y={cy - 8} textAnchor="middle" style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 30, fill: "#111111", fontWeight: 700 }}>{total}</text>
          <text x={cx} y={cy + 12} textAnchor="middle" style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 9, fill: "#888888", textTransform: "uppercase", letterSpacing: 2 }}>wins</text>
        </svg>

        {/* Category icons — positioned OUTSIDE the arc ring, fixed small size */}
        {arcSegments.map((seg) => {
          const color = WIN_CAT_COLORS[seg.idx];
          const label = WIN_CAT_LABELS[seg.idx];
          const isHov = hoveredCat === seg.idx;
          const { x, y } = polarToXY(seg.midAngle, ICON_ORBIT_R);
          // Fixed small icon size — no scaling to prevent overlap
          const iconSize = 14;
          const circleR = 13; // fixed bubble radius

          return (
            <div
              key={seg.idx}
              style={{
                position: "absolute",
                left: x - circleR,
                top: y - circleR,
                width: circleR * 2,
                height: circleR * 2,
                zIndex: isHov ? 20 : 5,
              }}
              onMouseEnter={() => setHoveredCat(seg.idx)}
              onMouseLeave={() => setHoveredCat(null)}
            >
              {/* Icon bubble */}
              <div style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background: `${color}18`,
                border: `2.5px solid ${color}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "transform 0.2s, box-shadow 0.2s",
                transform: isHov ? "scale(1.2)" : "scale(1)",
                boxShadow: isHov ? `0 3px 14px ${color}55` : "none",
                cursor: "default",
                backdropFilter: "blur(2px)",
              }}>
                <WinSvgIcon idx={seg.idx} size={iconSize} color={color} />
                {/* Count badge */}
                {seg.wins.length > 1 && (
                  <div style={{
                    position: "absolute",
                    top: -4, right: -4,
                    width: 16, height: 16,
                    borderRadius: "50%",
                    background: color,
                    color: "white",
                    fontSize: 9,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'Pretendard', system-ui, sans-serif",
                    border: "1.5px solid white",
                  }}>{seg.wins.length}</div>
                )}
              </div>

              {/* Hover tooltip showing all wins in category */}
              {isHov && (
                <div style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#FFFFFF",
                  color: "#111111",
                  border: "2px solid #888888",
                  boxShadow: "3px 3px 0px #111111",
                  borderRadius: 8,
                  padding: "7px 12px",
                  whiteSpace: "nowrap",
                  fontSize: 11,
                  fontFamily: "'Pretendard', system-ui, sans-serif",
                  pointerEvents: "none",
                  zIndex: 30,
                  maxWidth: 200,
                  textAlign: "left",
                  lineHeight: 1.5,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 10, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                    {label} · {seg.wins.length} {seg.wins.length === 1 ? "win" : "wins"}
                  </div>
                  {seg.wins.map((w) => (
                    <div key={w.id} style={{ paddingLeft: 6, borderLeft: `2px solid ${color}`, marginBottom: 2, opacity: 0.9 }}>
                      {w.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const M = {
  coral:    "#111111",      // soft rose (Nori accent)
  coralBg:  "#F5F5F5",      // rose tint bg
  coralBdr: "#E5E5E5",      // rose border
  sage:     "#666666",     // sage green
  sageBg:   "#F5F5F5",
  sageBdr:  "#E5E5E5",
  pink:     "oklch(0.70 0.06 10)",      // muted rose
  pinkBg:   "#F5F5F5",
  pinkBdr:  "#E5E5E5",
  slumber:  "oklch(0.60 0.01 20)",      // muted grey
  ink:      "#111111",      // near-black
  muted:    "#888888",      // muted text
  border:   "#E5E5E5",     // hairline
  card:     "#FFFFFF",             // pure white
  bg:       "#F5F5F5",     // soft bg
};

interface DailyWrapUpProps {
  tasks: Task[];
  wins?: Win[];
  agents?: Agent[];
  quitCount?: number;
  onClose: () => void;
}

export function DailyWrapUp({ tasks, wins = [], agents = [], quitCount = 0, onClose }: DailyWrapUpProps) {
  const [copied, setCopied] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [journalNote, setJournalNote] = useState<string>(() => {
    // Load today's note from daily-logs
    try {
      const today = new Date().toDateString();
      const logs = JSON.parse(localStorage.getItem("adhd-daily-logs") ?? "{}");
      return logs[today]?.journalNote ?? "";
    } catch { return ""; }
  });

  const saveJournalNote = (note: string) => {
    setJournalNote(note);
    try {
      const today = new Date().toDateString();
      const logs = JSON.parse(localStorage.getItem("adhd-daily-logs") ?? "{}");
      logs[today] = { ...(logs[today] ?? { dateKey: today }), journalNote: note };
      localStorage.setItem("adhd-daily-logs", JSON.stringify(logs));
      window.dispatchEvent(new CustomEvent("adhd-storage-update", { detail: "adhd-daily-logs" }));
    } catch {}
  };
  const [aiLoading, setAiLoading] = useState(false);

  const today    = new Date().toDateString();
  const todayStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const doneTasks     = tasks.filter((t) => t.done);
  const activeTasks   = tasks.filter((t) => !t.done);
  const todayWins     = wins.filter((w) => new Date(w.createdAt).toDateString() === today);
  const todayAgents   = agents.filter((a) => new Date(a.startedAt).toDateString() === today);
  const doneAgents    = todayAgents.filter((a) => a.status === "done");
  const runningAgents = todayAgents.filter((a) => a.status === "running");
  const workDone      = doneTasks.filter((t) => t.context === "work");
  const personalDone  = doneTasks.filter((t) => t.context === "personal");

  const rawScore   = Math.min(100, doneTasks.length * 20);
  const quitPenalty = Math.min(quitCount * 10, 40);
  const score      = Math.max(0, rawScore - quitPenalty);
  const scoreLabel = score >= 80 ? "Supercharged day! 🚀" : score >= 50 ? "Solid work today 💪" : score >= 20 ? "Progress made — keep going 🌱" : quitCount > 0 ? `${quitCount} quit${quitCount !== 1 ? 's' : ''} today — tomorrow is a new page ☁️` : "Rest is productive too ☕";

  const generateDigest = () => {
    const lines = [
      `📋 Daily Wrap-Up — ${todayStr}`,
      "─".repeat(32),
      "",
      `✅ Tasks completed (${doneTasks.length})`,
      ...doneTasks.map((t) => `  • [${t.context}] ${t.text}`),
      "",
      activeTasks.length > 0
        ? `⏳ Still pending (${activeTasks.length})\n${activeTasks.slice(0, 5).map((t) => `  • ${t.text}`).join("\n")}`
        : "🎉 All tasks cleared!",
    ];
    return lines.filter(Boolean).join("\n");
  };

  const copyDigest = async () => {
    try {
      await navigator.clipboard.writeText(generateDigest());
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Copy failed — please select text manually.");
    }
  };

  const handleGenerateSummary = async () => {
    setAiLoading(true);
    setAiSummary(null);
    try {
      // Read routine data for AI context
      const routineData = (() => {
        try {
          const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
          const todayDay = DAYS[(new Date().getDay() + 6) % 7];
          const routines = JSON.parse(localStorage.getItem("adhd-routines") ?? "[]") as { id: string; name: string; days: string[] }[];
          const todayRoutines = routines.filter(r => r.days.includes(todayDay));
          const doneData = JSON.parse(localStorage.getItem("adhd-routine-done") ?? "{}");
          const doneIds: string[] = doneData.ids ?? [];
          const done = todayRoutines.filter(r => doneIds.includes(r.id)).map(r => r.name);
          const missed = todayRoutines.filter(r => !doneIds.includes(r.id)).map(r => r.name);
          return { done, missed, total: todayRoutines.length };
        } catch { return { done: [], missed: [], total: 0 }; }
      })();
      const summary = await callAI(
        "You write warm, personal daily summaries for ADHD users. Be concise (2-3 sentences), positive, and specific about their accomplishments. No bullet points.",
        JSON.stringify({
          tasksCompleted: doneTasks.map((t) => t.text),
          tasksPending: activeTasks.slice(0, 5).map((t) => t.text),
          score,
        })
      );
      setAiSummary(summary);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI request failed";
      toast.error(msg, { duration: 5000 });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden flex flex-col"
        data-tour-id="tour-wrapup-panel"
        style={{
          maxHeight: "calc(80vh - env(safe-area-inset-bottom, 0px) - 60px)",
          background: M.card,
          border: `1px solid ${M.border}`,
          boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Nori title bar */}
        <div className="relative z-10" style={{ background: "#F5F5F5", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${M.border}`, flexShrink: 0 }}>
          <span style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 15, fontWeight: 900, color: M.ink }}>Daily Wrap-Up</span>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: M.muted, padding: 4, display: "flex", alignItems: "center" }} title="Close">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><line x1="4" y1="4" x2="16" y2="16" stroke={M.muted} strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="4" x2="4" y2="16" stroke={M.muted} strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Header */}
        <div className="relative z-10 p-5" style={{ borderBottom: `1px solid ${M.border}`, background: M.coralBg }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs" style={{ color: M.muted, fontFamily: "'Pretendard', system-ui, sans-serif", letterSpacing: "0.08em", textTransform: "uppercase" }}>{todayStr}</p>
              <h2 className="text-xl font-bold italic mt-0.5" style={{ fontFamily: "'Pretendard', system-ui, sans-serif", color: M.ink }}>
                Daily Wrap-Up
              </h2>
              <p className="text-sm mt-1" style={{ color: M.coral, fontFamily: "'Pretendard', system-ui, sans-serif" }}>{scoreLabel}</p>
            </div>
          </div>

          {/* Score bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1" style={{ color: M.muted, fontFamily: "'Pretendard', system-ui, sans-serif" }}>
              <span>Today's score</span>
              <span className="font-medium" style={{ color: M.ink }}>{score} / 100</span>
            </div>
            <div className="h-1.5 w-full" style={{ background: M.border }}>
              <div className="h-full transition-all duration-700" style={{ width: `${score}%`, background: M.coral }} />
            </div>
            {quitCount > 0 && (
              <p className="text-xs mt-1" style={{ color: "#888888", fontFamily: "'Pretendard', system-ui, sans-serif", letterSpacing: "0.08em" }}>
                −{quitPenalty} penalty · {quitCount} session{quitCount !== 1 ? 's' : ''} quit today
              </p>
            )}
          </div>
        </div>

        {/* Body */}
          <div className="relative z-10 flex-1 overflow-y-auto p-5 space-y-5">

          {/* Tasks */}
          <Section icon={<CheckCircle2 className="w-4 h-4" />} title={`Tasks completed (${doneTasks.length})`} color={M.sage}>
            {doneTasks.length === 0 ? (
              <p className="text-sm italic" style={{ color: M.muted, fontFamily: "'Pretendard', system-ui, sans-serif" }}>No tasks completed yet — tomorrow's a new start.</p>
            ) : (
              <div className="space-y-2">
                {workDone.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: M.sage, fontFamily: "'Pretendard', system-ui, sans-serif" }}>Work</p>
                    {workDone.map((t) => <TaskRow key={t.id} text={t.text} color={M.sage} />)}
                  </div>
                )}
                {personalDone.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: M.pink, fontFamily: "'Pretendard', system-ui, sans-serif" }}>Personal</p>
                    {personalDone.map((t) => <TaskRow key={t.id} text={t.text} color={M.pink} />)}
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Priority Matrix completion ring */}
          <MatrixRing tasks={tasks} />

          {/* Focus Tracker */}
          <FocusTrackerSection />

          {/* Pending */}
          {activeTasks.length > 0 && (
            <Section icon={<span className="text-base">⏳</span>} title={`Still pending (${activeTasks.length})`} color={M.slumber}>
              <div className="space-y-1.5">
                {activeTasks.slice(0, 6).map((t) => <TaskRow key={t.id} text={t.text} color={M.slumber} />)}
                {activeTasks.length > 6 && <p className="text-xs" style={{ color: M.muted, fontFamily: "'Pretendard', system-ui, sans-serif" }}>…and {activeTasks.length - 6} more</p>}
              </div>
            </Section>
          )}

          {/* Daily Journal */}
          <div className="relative z-10 pt-2 pb-4" style={{ borderTop: `1px solid ${M.border}`, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: "1rem" }}>📝</span>
              <span style={{ fontSize: "1rem", fontWeight: 700, color: M.ink, fontFamily: "'Pretendard', system-ui, sans-serif" }}>My Diary</span>
              <span style={{ fontSize: "0.72rem", color: M.muted, fontFamily: "'Pretendard', system-ui, sans-serif", fontStyle: "italic" }}>saved to monthly</span>
            </div>
            <textarea
              value={journalNote}
              onChange={(e) => saveJournalNote(e.target.value)}
              placeholder="How did today feel? Any thoughts, reflections, or things to remember…"
              rows={4}
              style={{
                width: "100%", boxSizing: "border-box",
                fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.875rem",
                color: M.ink, lineHeight: 1.7, padding: "10px 12px",
                border: `1px dashed ${M.border}`, borderRadius: 8,
                background: "rgba(255,255,255,0.6)",
                resize: "vertical", outline: "none",
              }}
            />
          </div>

          {/* AI Day Summary — inside scroll so it scrolls with content */}
          <div className="relative z-10 pt-2 pb-4" style={{ borderTop: `1px solid ${M.border}`, marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Sparkles size={16} style={{ color: M.coral }} />
            <span style={{ fontSize: "1rem", fontWeight: 700, color: M.ink, fontFamily: "'Pretendard', system-ui, sans-serif" }}>AI Day Summary</span>
          </div>
          {!aiSummary && !aiLoading && (
            <>
              <p style={{ fontSize: "0.875rem", color: M.muted, fontFamily: "'Pretendard', system-ui, sans-serif", fontStyle: "italic", lineHeight: 1.6, marginBottom: 12 }}>
                Let AI reflect on your day — a personal note based on what you actually did.
              </p>
              <button
                onClick={handleGenerateSummary}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: M.coralBg, border: `1px solid ${M.coralBdr}`,
                  color: M.coral, borderRadius: 8, padding: "8px 16px",
                  fontSize: "0.875rem", fontFamily: "'Pretendard', system-ui, sans-serif",
                  fontWeight: 500, cursor: "pointer",
                }}
              >
                <Sparkles size={14} />
                Generate summary
              </button>
            </>
          )}
          {aiLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Loader2 size={14} className="animate-spin" style={{ color: M.coral }} />
              <span style={{ fontSize: "0.875rem", color: M.muted, fontFamily: "'Pretendard', system-ui, sans-serif", fontStyle: "italic" }}>Generating…</span>
            </div>
          )}
          {aiSummary && !aiLoading && (
            <div>
              <p style={{ fontSize: "0.875rem", color: M.ink, fontFamily: "'Pretendard', system-ui, sans-serif", lineHeight: 1.7, marginBottom: 8 }}>{aiSummary}</p>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={() => setAiSummary(null)} style={{ fontSize: "0.75rem", color: M.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "'Pretendard', system-ui, sans-serif" }}>
                  Regenerate
                </button>
                <button
                  onClick={() => { navigator.clipboard.writeText(aiSummary ?? ""); toast.success("Summary copied!"); }}
                  style={{ fontSize: "0.75rem", color: M.coral, background: "none", border: `1px solid ${M.coralBdr}`, borderRadius: 8, padding: "2px 10px", cursor: "pointer", fontFamily: "'Pretendard', system-ui, sans-serif", display: "flex", alignItems: "center", gap: 4 }}
                >
                  📋 Copy
                </button>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 px-4 py-3 flex gap-3" style={{ borderTop: `1px solid ${M.border}` }}>
          <button onClick={onClose} className="m-btn-ghost flex-1" style={{ justifyContent: "center", letterSpacing: "0.12em", padding: "0.6rem 1rem", fontSize: "0.68rem" }}>
            CLOSE
          </button>
          <button onClick={copyDigest} className="m-btn-primary flex-1 justify-center" style={{ letterSpacing: "0.10em", padding: "0.6rem 1rem", fontSize: "0.68rem" }}>
            <ClipboardCopy size={14} />
            {copied ? "COPIED!" : "COPY SUMMARY"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, color, children }: { icon: React.ReactNode; title: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2" style={{ color }}>
        {icon}
        <p className="text-sm font-semibold" style={{ fontFamily: "'Pretendard', system-ui, sans-serif" }}>{title}</p>
      </div>
      {children}
    </div>
  );
}

function TaskRow({ text, color }: { text: string; color: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color }} />
      <span className="text-sm" style={{ color: "#111111", fontFamily: "'Pretendard', system-ui, sans-serif" }}>{text}</span>
    </div>
  );
}

/* ── Priority Matrix Ring — shows completed tasks per quadrant ── */
const QUADRANT_META = [
  { id: "q1", label: "Do Now",   color: "#888888" },
  { id: "q2", label: "Schedule", color: "#888888" },
  { id: "q3", label: "Delegate", color: "#888888" },
  { id: "q4", label: "Eliminate",color: "#888888" },
];

function priorityToQuadrant(p: string): string {
  if (p === "urgent") return "q1";
  if (p === "focus")  return "q2";
  return "q4";
}

function MatrixRing({ tasks }: { tasks: Task[] }) {
  const quadrantMap: Record<string, string> = (() => {
    try { return JSON.parse(localStorage.getItem("adhd-quadrant-map") ?? "{}"); } catch { return {}; }
  })();

  const doneTasks = tasks.filter(t => t.done);
  const totalDone = doneTasks.length;

  // Count done tasks per quadrant
  const counts: Record<string, number> = { q1: 0, q2: 0, q3: 0, q4: 0 };
  doneTasks.forEach(t => {
    const q = quadrantMap[t.id] ?? priorityToQuadrant(t.priority);
    if (counts[q] !== undefined) counts[q]++;
  });

  const ringColor = "#111111";

  if (totalDone === 0) {
    return (
      <Section icon={<span style={{ fontSize: 14 }}>📊</span>} title="Priority Matrix" color={ringColor}>
        <p className="text-sm italic" style={{ color: M.muted, fontFamily: "'Pretendard', system-ui, sans-serif" }}>No tasks completed yet.</p>
      </Section>
    );
  }

  // Draw arc ring
  const SIZE = 200;
  const cx = 100, cy = 100, R = 70, strokeW = 22;
  const circumference = 2 * Math.PI * R;
  let offset = 0;
  const arcs = QUADRANT_META.map(q => {
    const proportion = totalDone > 0 ? counts[q.id] / totalDone : 0;
    const arc = { ...q, proportion, count: counts[q.id], offset };
    offset += proportion;
    return arc;
  });

  return (
    <Section icon={<span style={{ fontSize: 14 }}>📊</span>} title={`Priority Matrix (${totalDone} done)`} color={ringColor}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Ring */}
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ flexShrink: 0 }}>
          {/* Background circle */}
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="#E5E5E5" strokeWidth={strokeW} />
          {/* Quadrant arcs */}
          {arcs.filter(a => a.proportion > 0).map((a) => (
            <circle
              key={a.id}
              cx={cx} cy={cy} r={R}
              fill="none"
              stroke={a.color}
              strokeWidth={strokeW}
              strokeDasharray={`${a.proportion * circumference} ${circumference}`}
              strokeDashoffset={-(a.offset * circumference)}
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: "stroke-dasharray 0.6s ease" }}
            />
          ))}
          {/* Center text */}
          <text x={cx} y={cy - 8} textAnchor="middle" style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 22, fontWeight: 700, fill: M.ink }}>{totalDone}</text>
          <text x={cx} y={cy + 10} textAnchor="middle" style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 8, fill: M.muted, letterSpacing: 1, textTransform: "uppercase" }}>done</text>
        </svg>
        {/* Legend */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {QUADRANT_META.map(q => (
            <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: q.color, flexShrink: 0 }} />
              <span style={{ fontSize: "0.75rem", color: M.ink, fontFamily: "'Pretendard', system-ui, sans-serif" }}>{q.label}</span>
              <span style={{ fontSize: "0.75rem", color: M.muted, fontFamily: "'Pretendard', system-ui, sans-serif", marginLeft: "auto" }}>{counts[q.id]}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ── Focus Tracker Section ── */
interface FocusSessionEntry {
  sessionNumber: number;
  duration: number;
  timestamp: number;
  dateKey: string;
}

function FocusTrackerSection() {
  const today = new Date().toDateString();

  // Read today's focus sessions from the detailed session list
  const sessions: FocusSessionEntry[] = (() => {
    try {
      const raw = localStorage.getItem("adhd-focus-session-list");
      if (!raw) return [];
      const list = JSON.parse(raw) as Record<string, FocusSessionEntry[]>;
      return list[today] ?? [];
    } catch { return []; }
  })();

  // Also check daily log for count (in case sessions were done before the new key was added)
  const logCount: number = (() => {
    try {
      const raw = localStorage.getItem("adhd-daily-logs");
      if (!raw) return 0;
      const logs = JSON.parse(raw) as Record<string, { focusSessions?: number }>;
      return logs[today]?.focusSessions ?? 0;
    } catch { return 0; }
  })();

  const count = Math.max(sessions.length, logCount);
  const timerColor = "#111111"; // coral / timer color

  return (
    <Section
      icon={<span style={{ fontSize: 14 }}>⏱</span>}
      title={`Focus Sessions (${count})`}
      color={timerColor}
    >
      {count === 0 ? (
        <p className="text-sm italic" style={{ color: M.muted, fontFamily: "'Pretendard', system-ui, sans-serif" }}>
          No focus sessions completed today.
        </p>
      ) : sessions.length > 0 ? (
        <div className="space-y-1.5">
          {sessions.map((s) => {
            const time = new Date(s.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            return (
              <div
                key={s.sessionNumber}
                className="flex items-center gap-3 py-1.5 px-2.5"
                style={{
                  background: "#F5F5F5",
                  border: "1px solid #E5E5E5",
                  borderRadius: 8,
                }}
              >
                <span
                  className="text-xs font-bold"
                  style={{
                    color: timerColor,
                    fontFamily: "'Pretendard', system-ui, sans-serif",
                    letterSpacing: "0.08em",
                    minWidth: 20,
                  }}
                >
                  #{s.sessionNumber}
                </span>
                <span className="text-sm flex-1" style={{ color: M.ink, fontFamily: "'Pretendard', system-ui, sans-serif" }}>
                  {s.duration} min focus session
                </span>
                <span className="text-xs" style={{ color: M.muted, fontFamily: "'Pretendard', system-ui, sans-serif" }}>
                  {time}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        // Old data: only count is available, no detailed entries
        <div className="space-y-1.5">
          {Array.from({ length: count }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-1.5 px-2.5"
              style={{
                background: "#F5F5F5",
                border: "1px solid #E5E5E5",
                borderRadius: 8,
              }}
            >
              <span
                className="text-xs font-bold"
                style={{
                  color: timerColor,
                  fontFamily: "'Pretendard', system-ui, sans-serif",
                  letterSpacing: "0.08em",
                  minWidth: 20,
                }}
              >
                #{i + 1}
              </span>
              <span className="text-sm flex-1" style={{ color: M.ink, fontFamily: "'Pretendard', system-ui, sans-serif" }}>
                Focus session complete
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
