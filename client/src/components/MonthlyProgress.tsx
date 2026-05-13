/* ============================================================
   ADHD FOCUS SPACE — Monthly Progress Page
   Design: Morandi palette, calendar grid, daily activity rings
   Data sources: adhd-wins, adhd-tasks, adhd-daily-logs
   Each day shows: wrap-up done, brain dump entries, wins count, mood
   ============================================================ */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, Brain, CheckCircle2, Flame, Loader2 } from "lucide-react";
import { callAI } from "@/lib/ai";
import { toast } from "sonner";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import type { Win } from "./DailyWins";
import type { Task } from "./TaskManager";
/* ── Types ── */
export interface DailyLog {
  dateKey: string;       // "Mon Apr 07 2026"
  wrapUpDone: boolean;
  dumpCount: number;     // brain dump entries that day
  winsCount: number;
  tasksCompleted: number;
  mood: number | null;   // 1-5
  score: number;         // 0-100
  focusSessions?: number; // individual 25-min sessions completed
  blocksCompleted?: number; // full 4-session blocks completed
  journalNote?: string;    // daily journal/notes from wrap-up
  routinesDone?: number;   // how many routines completed that day
  routinesTotal?: number;  // how many routines were scheduled that day
  routinesDoneIds?: string[];  // IDs of completed routines (for missed-name lookup)
}

const MOOD_COLORS = ["#C8B8D8","#D4B8E0","#E8A8C8","#F0B8D8","#F8C8E8"];
const MOOD_LABELS = ["Drained","Low","Okay","Good","Glowing"];

const M = {
  ink:     "oklch(0.12 0.01 20)",
  muted:   "oklch(0.52 0.01 20)",
  border:  "oklch(0.88 0.005 20)",
  card:    "oklch(1 0 0)",
  coral:   "oklch(0.82 0.08 10)",       // soft rose
  coralBg: "oklch(0.97 0.02 10)",
  sage:    "oklch(0.55 0.08 160)",      // sage green
  sageBg:  "oklch(0.96 0.02 160)",
  gold:    "oklch(0.70 0.06 10)",       // muted rose/gold
  goldBg:  "oklch(0.97 0.02 10)",
  pink:    "oklch(0.82 0.08 10)",       // soft rose
  pinkBg:  "oklch(0.97 0.02 10)",
};

/* ── Helpers ── */
function dateKey(d: Date) {
  return d.toDateString(); // "Mon Apr 07 2026"
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

/* ── Streak calculator ── */
function calcStreak(logs: Record<string, DailyLog>): number {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const k = dateKey(d);
    if (logs[k]?.wrapUpDone || logs[k]?.dumpCount > 0) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

/* ── Day hover card content ── */
function DayCellHoverContent({ log, day, month, year }: { log?: DailyLog; day: number; month: number; year: number }) {
  const dateStr = new Date(year, month, day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const hasAny = log && (log.wrapUpDone || log.dumpCount > 0 || log.winsCount > 0 || log.tasksCompleted > 0 || (log.focusSessions ?? 0) > 0 || (log.routinesDone ?? 0) > 0);
  return (
    <div style={{ fontFamily: "'Pretendard', system-ui, sans-serif", minWidth: 180 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: M.ink, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${M.border}` }}>
        {dateStr}
      </div>
      {!hasAny ? (
        <p style={{ fontSize: 11, color: M.muted, fontStyle: "italic", margin: 0 }}>No activity recorded.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {log?.wrapUpDone && (
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <CheckCircle2 size={13} style={{ color: M.sage, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: M.ink }}>Daily wrap-up completed</span>
            </div>
          )}
          {(log?.dumpCount ?? 0) > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Brain size={13} style={{ color: M.coral, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: M.ink }}>{log!.dumpCount} brain dump {log!.dumpCount === 1 ? "entry" : "entries"}</span>
            </div>
          )}
          {((log?.winsCount ?? 0) > 0 || (log?.focusSessions ?? 0) > 0 || (log?.blocksCompleted ?? 0) > 0) && (
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Sparkles size={13} style={{ color: M.gold, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: M.ink }}>
                {(log?.winsCount ?? 0) + (log?.focusSessions ?? 0) + (log?.blocksCompleted ?? 0)}{" "}
                {((log?.winsCount ?? 0) + (log?.focusSessions ?? 0) + (log?.blocksCompleted ?? 0)) === 1 ? "win" : "wins"} logged
              </span>
            </div>
          )}
          {(log?.tasksCompleted ?? 0) > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <CheckCircle2 size={13} style={{ color: M.pink, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: M.ink }}>{log!.tasksCompleted} {log!.tasksCompleted === 1 ? "task" : "tasks"} completed</span>
            </div>
          )}
          {(log?.focusSessions ?? 0) > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="9" stroke="oklch(0.82 0.08 10)" strokeWidth="1.5" />
                <polyline points="12,7 12,12 15,15" stroke="oklch(0.82 0.08 10)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: 11, color: M.ink }}>{log!.focusSessions} focus {log!.focusSessions === 1 ? "session" : "sessions"}</span>
            </div>
          )}
          {(log?.blocksCompleted ?? 0) > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M12 2c0 0-1 3-1 5 0 1.5 1 3 1 3s-3-1-3-4c0 0-3 3-3 7a6 6 0 0 0 12 0c0-5-4-8-6-11z" fill="oklch(0.82 0.08 10)" opacity="0.85" />
              </svg>
              <span style={{ fontSize: 11, color: M.ink }}>{log!.blocksCompleted} deep focus {log!.blocksCompleted === 1 ? "block" : "blocks"} 🔥</span>
            </div>
          )}

          {log?.score !== undefined && log.score > 0 && (
            <div style={{ marginTop: 2, paddingTop: 7, borderTop: `1px solid ${M.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: M.muted, textTransform: "uppercase", letterSpacing: 1 }}>Day score</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: M.ink }}>{log.score}/100</span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: M.border, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${log.score}%`, background: M.coral, borderRadius: 2 }} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Day cell ── */
function DayCell({
  day, year, month, log, isToday, isSelected, onClick,
}: {
  day: number;
  year: number;
  month: number;
  log?: DailyLog;
  isToday: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const hasRoutineDone = (log?.routinesDone ?? 0) > 0;
  const hasFocusWins = (log?.focusSessions ?? 0) > 0 || (log?.blocksCompleted ?? 0) > 0;
  const hasActivity = log && (log.wrapUpDone || log.dumpCount > 0 || log.winsCount > 0 || hasRoutineDone || hasFocusWins);
  const moodColor = log?.mood ? MOOD_COLORS[(log?.mood ?? 4) - 1] : null;

  const cellButton = (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1",
        borderRadius: 16,
        border: isSelected
          ? `2px solid ${M.coral}`
          : isToday
          ? `1.5px solid ${M.gold}`
          : `1px solid ${hasActivity ? "oklch(0.82 0.05 340)" : M.border}`,
        background: isSelected
          ? M.coralBg
          : hasActivity
          ? log?.wrapUpDone
            ? "oklch(0.97 0.015 355)"
            : "oklch(0.98 0.010 355)"
          : "transparent",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "4px 2px 2px",
        gap: 1,
        transition: "all 0.15s",
        overflow: "hidden",
      }}
    >
      <span style={{
        fontSize: 11,
        fontWeight: isToday ? 700 : 400,
        color: isToday ? M.coral : hasActivity ? M.ink : M.muted,
        fontFamily: "'Pretendard', system-ui, sans-serif",
        lineHeight: 1,
      }}>
        {day}
      </span>
      {hasActivity && (
        <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
          {log?.wrapUpDone && <div style={{ width: 5, height: 5, borderRadius: "50%", background: M.sage }} />}
          {(log?.dumpCount ?? 0) > 0 && <div style={{ width: 5, height: 5, borderRadius: "50%", background: M.coral }} />}
          {((log?.winsCount ?? 0) > 0 || hasFocusWins) && <div style={{ width: 5, height: 5, borderRadius: "50%", background: M.gold }} />}
          {hasRoutineDone && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "oklch(0.55 0.14 245)" }} />}
        </div>
      )}
      {moodColor && (
        <div style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          height: 3,
          background: moodColor,
          borderRadius: "0 0 8px 8px",
          opacity: 0.7,
        }} />
      )}
    </button>
  );

  // Only show hover card for days with activity
  if (!log || !(log.wrapUpDone || log.dumpCount > 0 || log.winsCount > 0 || log.tasksCompleted > 0 || (log.focusSessions ?? 0) > 0 || hasRoutineDone)) {
    return cellButton;
  }

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        {cellButton}
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="center"
        sideOffset={6}
        style={{
          background: M.card,
          border: `1px solid ${M.border}`,
          borderRadius: 12,
          padding: "12px 14px",
          boxShadow: "0 4px 20px oklch(0.22 0.040 320 / 0.10)",
          width: "auto",
          minWidth: 180,
        }}
        className=""
      >
        <DayCellHoverContent log={log} day={day} month={month} year={year} />
      </HoverCardContent>
    </HoverCard>
  );
}

/* ── Win category colours/labels (must match DailyWins WIN_ICONS order) ── */
const WIN_CAT_COLORS = [
  "oklch(0.62 0.18 355)",  // health
  "oklch(0.52 0.08 230)", // study
  "oklch(0.55 0.14 290)", // work
  "oklch(0.62 0.14 310)",  // social
  "oklch(0.55 0.10 300)", // creative
  "oklch(0.55 0.07 185)", // mindful
  "oklch(0.82 0.08 10)",  // fitness
  "oklch(0.55 0.12 270)", // nutrition
];
const WIN_CAT_LABELS = ["Health","Study","Work","Social","Creative","Mindful","Fitness","Nutrition"];

/* ── Day detail panel ── */
function EditableDiary({ dateKey, initialNote }: { dateKey: string; initialNote?: string }) {
  const [text, setText] = React.useState(initialNote ?? "");
  const save = (val: string) => {
    setText(val);
    try {
      const logs = JSON.parse(localStorage.getItem("adhd-daily-logs") ?? "{}");
      const existing = logs[dateKey] ?? { dateKey, wrapUpDone: false, dumpCount: 0, winsCount: 0, tasksCompleted: 0, mood: null, score: 0 };
      logs[dateKey] = { ...existing, journalNote: val };
      localStorage.setItem("adhd-daily-logs", JSON.stringify(logs));
    } catch {}
  };
  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ fontSize: 10, fontFamily: "'Pretendard', system-ui, sans-serif", letterSpacing: "0.06em", color: M.muted, textTransform: "uppercase", marginBottom: 4 }}>📝 My Diary</p>
      <textarea value={text} onChange={(e) => save(e.target.value)} placeholder="Write your thoughts for this day…" rows={3}
        style={{ width: "100%", boxSizing: "border-box", fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 13, color: M.ink, lineHeight: 1.6, padding: "10px 12px", border: "1px solid oklch(0.88 0.005 20)", borderRadius: 12, background: "oklch(0.96 0.002 20)", resize: "vertical", outline: "none" }} />
    </div>
  );
}

function DayDetail({ log, dateStr, dateKey: dk, onClose, isPast }: { log?: DailyLog; dateStr: string; dateKey: string; onClose: () => void; isPast?: boolean }) {
  const hasAny = log && (log.wrapUpDone || log.dumpCount > 0 || log.winsCount > 0 || log.tasksCompleted > 0 || (log.focusSessions ?? 0) > 0 || (log.routinesDone ?? 0) > 0);

  // Read detailed wins for this day from localStorage
  const dayWins = (() => {
    try {
      const raw = localStorage.getItem("adhd-wins");
      if (!raw) return [];
      const all = JSON.parse(raw) as Array<{ id: string; text: string; iconIdx: number; createdAt: string }>;
      return all.filter(w => new Date(w.createdAt).toDateString() === dk);
    } catch { return []; }
  })();

  // Read brain dump entries for this day from localStorage
  const dayDumps = (() => {
    try {
      const raw = localStorage.getItem("adhd_braindump_entries");
      if (!raw) return [];
      const all = JSON.parse(raw) as Array<{ id: string; text: string; createdAt: string }>;
      return all.filter(e => new Date(e.createdAt).toDateString() === dk);
    } catch { return []; }
  })();

  // Read focus session details for this day
  interface FocusSessionEntry { sessionNumber: number; duration: number; timestamp: number; dateKey: string; }
  const dayFocusSessions = (() => {
    try {
      const raw = localStorage.getItem("adhd-focus-session-list");
      if (!raw) return [] as FocusSessionEntry[];
      const list = JSON.parse(raw) as Record<string, FocusSessionEntry[]>;
      return list[dk] ?? [] as FocusSessionEntry[];
    } catch { return [] as FocusSessionEntry[]; }
  })();
  // Fallback: use count from log if no detailed entries
  const focusCount = dayFocusSessions.length > 0 ? dayFocusSessions.length : (log?.focusSessions ?? 0);
  // Compute missed routine names for this day.
  // Use the stored routineNamesSnapshot (keyed by id) if available — this
  // reflects the routines that actually existed on that day, not today's list.
  // Fall back to the current routine list only for today.
  const missedRoutineNames = (() => {
    try {
      const routinesTotal = log?.routinesTotal ?? 0;
      const routinesDone = log?.routinesDone ?? 0;
      if (routinesTotal === 0 || routinesDone === routinesTotal) return [] as string[];
      const doneIds: string[] = log?.routinesDoneIds ?? [];
      const snapshot: Record<string, string> | undefined = (log as any)?.routineNamesSnapshot;
      if (snapshot && Object.keys(snapshot).length > 0) {
        // Use the snapshot: show names of routines that were scheduled but not done
        return Object.entries(snapshot)
          .filter(([id]) => !doneIds.includes(id))
          .map(([, name]) => name);
      }
      // No snapshot — only show missed names for today (current routine list is accurate)
      const todayKey = new Date().toDateString();
      if (dk !== todayKey) return [] as string[]; // don't guess for past days without snapshot
      const allRoutines: { id: string; name: string; days: string[] }[] = JSON.parse(localStorage.getItem("adhd-routines") ?? "[]");
      const DAYS_MON = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
      const dayOfWeek = DAYS_MON[(new Date(dk).getDay() + 6) % 7];
      const scheduledThatDay = allRoutines.filter(r => r.days.includes(dayOfWeek));
      return scheduledThatDay.filter(r => !doneIds.includes(r.id)).map(r => r.name);
    } catch { return [] as string[]; }
  })();
  // Group wins by category
  // iconIdx 97 (focus session) and 99 (deep focus block) are normalised to 5 (Mindful)
  const normWinIdx = (raw: number | undefined) => {
    if (raw === 97 || raw === 99) return 5;
    return typeof raw === "number" ? raw % WIN_CAT_LABELS.length : 4;
  };
  const winsByCategory = dayWins.reduce<Record<number, typeof dayWins>>((acc, w) => {
    const idx = normWinIdx(w.iconIdx);
    if (!acc[idx]) acc[idx] = [];
    acc[idx].push(w);
    return acc;
  }, {});

  return (
    <div style={{
      background: M.card,
      border: `1px solid ${M.border}`,
      borderRadius: 16,
      fontFamily: "'Pretendard', system-ui, sans-serif",
      overflow: "hidden",
    }}>
      {/* Nori title bar */}
      <div style={{ background: "oklch(0.96 0.002 20)", padding: "12px 16px", display: "flex", alignItems: "center", borderBottom: `1px solid ${M.border}` }}>
        <span style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 14, fontWeight: 900, color: M.ink }}>Day Summary</span>
      </div>
      {/* Date header */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${M.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: M.ink, margin: 0, fontFamily: "'Pretendard', system-ui, sans-serif" }}>{dateStr}</p>
        </div>
        <button onClick={onClose} style={{ fontSize: 18, color: M.muted, background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: "0 2px" }}>×</button>
      </div>

      {/* Score bar */}
      {log?.score !== undefined && log.score > 0 && (
        <div style={{ padding: "10px 18px", borderBottom: `1px solid ${M.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 10, color: M.muted, textTransform: "uppercase", letterSpacing: 1 }}>Day Score</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: M.ink }}>{log.score}/100</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: M.border, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${log.score}%`, background: "oklch(0.12 0.01 20)", borderRadius: 3, transition: "width 0.5s" }} />
          </div>
        </div>
      )}

      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        {!hasAny ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <p style={{ fontSize: 13, color: M.muted, fontStyle: "italic" }}>No activity recorded for this day.</p>
            <p style={{ fontSize: 11, color: M.muted, marginTop: 4 }}>Even a quick brain dump counts!</p>
          </div>
        ) : (
          <>
            {/* Focus sessions */}
            {focusCount > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 11, color: M.coral }}>⏱</span>
                <span style={{ fontSize: 12, color: M.ink }}>Focus: <strong style={{ color: M.coral }}>{focusCount} {focusCount === 1 ? "session" : "sessions"}</strong></span>
              </div>
            )}
            {/* Wrap-up */}
            {log?.wrapUpDone && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={13} style={{ color: M.sage, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: M.sage, fontWeight: 600 }}>Daily wrap-up completed</span>
              </div>
            )}



            {/* Brain dump entries */}
            {dayDumps.length > 0 && (
              <div>
                <p style={{ fontSize: 10, color: M.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontWeight: 600 }}>
                  <Brain size={10} style={{ display: "inline", marginRight: 4, color: M.coral }} />
                  Brain Dump ({dayDumps.length})
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {dayDumps.map(e => (
                    <div key={e.id} style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "4px 0", borderBottom: `1px solid ${M.border}` }}>
                      <div style={{ width: 3, height: 3, borderRadius: "50%", background: M.coral, marginTop: 6, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: M.ink, lineHeight: 1.4 }}>{e.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tasks completed (count only — no completedAt timestamp available) */}
            {(log?.tasksCompleted ?? 0) > 0 && dayWins.length === 0 && dayDumps.length === 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={13} style={{ color: M.pink, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: M.ink }}>{log!.tasksCompleted} {log!.tasksCompleted === 1 ? "task" : "tasks"} completed</span>
              </div>
            )}
            <EditableDiary dateKey={dk} initialNote={log?.journalNote} />
          </>
        )}
      </div>
    </div>
  );
}

/* ── Main component ── */
interface MonthlyProgressProps {
  wins: Win[];
  tasks: Task[];
  blockHistory?: Record<string, number>;
  blockStreak?: number;
}

export function MonthlyProgress({ wins, tasks, blockHistory = {}, blockStreak = 0 }: MonthlyProgressProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [logs, setLogs] = useState<Record<string, DailyLog>>({});

  /* Load persisted logs + re-read on storage changes (e.g. focus session recorded) */
  const loadLogs = useCallback(() => {
    try {
      const raw = localStorage.getItem("adhd-daily-logs");
      if (raw) setLogs(prev => {
        const next = JSON.parse(raw) as Record<string, DailyLog>;
        // Merge: keep any in-memory wins/tasks counts that are more up-to-date
        return next;
      });
    } catch {}
  }, []);

  useEffect(() => {
    loadLogs();
    // Listen for changes from other parts of the app (same tab via custom event)
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === "adhd-daily-logs" || detail === "adhd-routine-done") loadLogs();
    };
    window.addEventListener("adhd-storage-update", handler);
    return () => window.removeEventListener("adhd-storage-update", handler);
  }, [loadLogs]);

  /* Derive today's log from live data and merge */
  useEffect(() => {
    const todayKey = dateKey(today);
    const todayWins = wins.filter(w => new Date(w.createdAt).toDateString() === todayKey);
    const todayDone = tasks.filter(t => t.done && new Date(t.createdAt).toDateString() === todayKey);

    // Read routine completion for today
    const DAYS_MON = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const todayDayMon = DAYS_MON[(new Date().getDay() + 6) % 7];
    const todayISOKey = new Date().toISOString().slice(0, 10);
    const allRoutines: { id: string; days: string[] }[] = (() => {
      try { return JSON.parse(localStorage.getItem("adhd-routines") ?? "[]"); } catch { return []; }
    })();
    const todayRoutines = allRoutines.filter(r => r.days.includes(todayDayMon));
    const routineDoneData = (() => {
      try { return JSON.parse(localStorage.getItem("adhd-routine-done") ?? "{}"); } catch { return {}; }
    })();
    const routineDoneIds: string[] = routineDoneData.date === todayISOKey ? (routineDoneData.ids ?? []) : [];
    const routinesDone = routineDoneIds.length;
    const routinesTotal = todayRoutines.length;

    setLogs(prev => {
      const existing = prev[todayKey] ?? { dateKey: todayKey, wrapUpDone: false, dumpCount: 0, winsCount: 0, tasksCompleted: 0, mood: null, score: 0 };
      const updated: DailyLog = {
        ...existing,
        winsCount: todayWins.length,
        tasksCompleted: todayDone.length,
        routinesDone,
        routinesTotal,
        score: Math.min(100, todayWins.length * 10 + todayDone.length * 15 + (existing.wrapUpDone ? 20 : 0) + existing.dumpCount * 5 + (existing.focusSessions ?? 0) * 5 + (existing.blocksCompleted ?? 0) * 10 + routinesDone * 5),
      };
      if (JSON.stringify(existing) === JSON.stringify(updated)) return prev;
      const next = { ...prev, [todayKey]: updated };
      try { localStorage.setItem("adhd-daily-logs", JSON.stringify(next)); } catch {}
      return next;
    });
  }, [wins, tasks]);

  /* Calendar math */
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDow = getFirstDayOfWeek(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  };

  /* Stats for this month */
  const monthStats = useMemo(() => {
    let activeDays = 0, wrapDays = 0, totalDumps = 0, totalWins = 0, totalTasks = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const k = dateKey(new Date(viewYear, viewMonth, d));
      const log = logs[k];
      if (!log) continue;
      if (log.wrapUpDone || log.dumpCount > 0 || log.winsCount > 0) activeDays++;
      if (log.wrapUpDone) wrapDays++;
      totalDumps += log.dumpCount ?? 0;  // total entries, not just days-with-dumps
      totalWins += log.winsCount;
      totalTasks += log.tasksCompleted;
    }
    return { activeDays, wrapDays, totalDumps, totalWins, totalTasks };
  }, [logs, viewYear, viewMonth, daysInMonth]);

  const streak = useMemo(() => calcStreak(logs), [logs]);

  const selectedDateStr = selectedDay
    ? new Date(viewYear, viewMonth, selectedDay).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : null;
  const selectedLog = selectedDay
    ? logs[dateKey(new Date(viewYear, viewMonth, selectedDay))]
    : undefined;

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px", fontFamily: "'Pretendard', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 26, fontWeight: 700, color: M.ink, margin: 0 }}>
          Monthly Progress
        </h1>
        <p style={{ fontSize: 13, color: M.muted, marginTop: 4 }}>
          Every day you show up — wrap-up, brain dump, or just a win — it counts.
        </p>
      </div>

      {/* Streak + month stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 24 }}>
        {[
          { label: "Streak", value: streak, icon: <Flame size={14} />, color: M.coral },
          { label: "Active days", value: monthStats.activeDays, icon: <CheckCircle2 size={14} />, color: M.sage },
          { label: "Wrap-ups", value: monthStats.wrapDays, icon: <CheckCircle2 size={14} />, color: M.gold },
          { label: "Dumps", value: monthStats.totalDumps, icon: <Brain size={14} />, color: M.pink },
          { label: "Wins", value: monthStats.totalWins, icon: <Sparkles size={14} />, color: M.gold },
        ].map(s => (
          <div key={s.label} style={{
            background: M.card,
            border: `1px solid ${M.border}`,
            borderRadius: 16,
            padding: "10px 8px",
            textAlign: "center",
          }}>
            <div style={{ color: s.color, marginBottom: 2, display: "flex", justifyContent: "center" }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: M.ink, lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: 9, color: M.muted, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Calendar navigation */}
      <div style={{
        background: M.card,
        border: `1px solid ${M.border}`,
        borderRadius: 16,
        marginBottom: 16,
        overflow: "hidden",
      }}>
        {/* Retro titlebar */}
        <div style={{ background: "oklch(0.96 0.002 20)", padding: "12px 16px", display: "flex", alignItems: "center", borderBottom: "1px solid oklch(0.88 0.005 20)" }}><span style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 14, fontWeight: 900, color: "oklch(0.12 0.01 20)" }}>Monthly Calendar</span></div>
        <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", color: M.muted, padding: 4, borderRadius: 6 }}>
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 17, fontWeight: 600, color: M.ink }}>
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            style={{ background: "none", border: "none", cursor: isCurrentMonth ? "default" : "pointer", color: isCurrentMonth ? M.border : M.muted, padding: 4, borderRadius: 6 }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Weekday headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 9, color: M.muted, textTransform: "uppercase", letterSpacing: 0.8, padding: "2px 0" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {/* Empty cells for offset */}
          {Array.from({ length: firstDow }, (_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const k = dateKey(new Date(viewYear, viewMonth, day));
            const log = logs[k];
            const isToday = isCurrentMonth && day === today.getDate();
            const isSel = selectedDay === day;
            return (
              <DayCell
                key={day}
                day={day}
                year={viewYear}
                month={viewMonth}
                log={log}
                isToday={isToday}
                isSelected={isSel}
                onClick={() => setSelectedDay(isSel ? null : day)}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          {[
            { color: M.sage, label: "Wrap-up" },
            { color: M.coral, label: "Brain dump" },
            { color: M.gold, label: "Focus" },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: l.color }} />
              <span style={{ fontSize: 10, color: M.muted }}>{l.label}</span>
            </div>
          ))}
        </div>
        </div>{/* end padding wrapper */}
      </div>

      {/* Day detail */}
      {selectedDay && selectedDateStr && (
        <DayDetail
          log={selectedLog}
          dateStr={selectedDateStr}
          dateKey={new Date(viewYear, viewMonth, selectedDay).toDateString()}
          onClose={() => setSelectedDay(null)}
          isPast={!(isCurrentMonth && selectedDay === today.getDate())}
        />
      )}

      {/* AI Monthly Review */}
      <MonthlyAIReview
        viewYear={viewYear}
        viewMonth={viewMonth}
        logs={logs}
        daysInMonth={daysInMonth}
        streak={streak}
        monthStats={monthStats}
      />

    </div>
  );
}

function MonthlyAIReview({ viewYear, viewMonth, logs, daysInMonth, streak, monthStats }: {
  viewYear: number; viewMonth: number;
  logs: Record<string, DailyLog>; daysInMonth: number;
  streak: number;
  monthStats: { activeDays: number; wrapDays: number; totalDumps: number; totalWins: number; totalTasks: number };
}) {
  const [review, setReview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // Gather mood data for the month
      const moodSum = Object.values(logs).reduce((s, l) => s + (l.mood ?? 0), 0);
      const moodCount = Object.values(logs).filter((l) => l.mood).length;
      const avgMood = moodCount > 0 ? Math.round((moodSum / moodCount) * 10) / 10 : null;

      const result = await callAI(
        `You write warm, personal monthly review summaries for people with ADHD. Be specific, encouraging and concise (3-4 short paragraphs). Mention patterns and give one concrete suggestion for next month.`,
        `Month: ${MONTHS[viewMonth]} ${viewYear}
Active days: ${monthStats.activeDays}/${daysInMonth}
Wrap-up days: ${monthStats.wrapDays}
Brain dump entries: ${monthStats.totalDumps}
Wins logged: ${monthStats.totalWins}
Tasks completed: ${monthStats.totalTasks}
Streak: ${streak} days
Average mood: ${avgMood ?? "not tracked"}/5`
      );
      setReview(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate review";
      toast.error(msg, { duration: 5000 });
    } finally {
      setGenerating(false);
    }
  };

  const M2 = {
    coral: "oklch(0.82 0.08 10)", coralBg: "oklch(0.97 0.02 10)",
    coralBdr: "oklch(0.88 0.005 20)", ink: "oklch(0.12 0.01 20)",
    muted: "oklch(0.52 0.01 20)", border: "oklch(0.88 0.025 340)", card: "oklch(1 0 0)",
  };

  return (
    <div style={{ marginTop: 16, background: M2.card, border: `1px solid ${M2.border}`, borderRadius: 16, overflow: "hidden",  }}>
      <div style={{ background: "oklch(0.96 0.002 20)", padding: "12px 16px", display: "flex", alignItems: "center", borderBottom: "1px solid oklch(0.88 0.005 20)" }}><span style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 14, fontWeight: 900, color: "oklch(0.12 0.01 20)" }}>AI Monthly Review</span></div>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {!review ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 13, color: M2.muted, margin: 0, fontFamily: "'Pretendard', system-ui, sans-serif", lineHeight: 1.5 }}>
              Get a personalised narrative review of your month — patterns, insights, and one thing to try next month.
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: generating ? "oklch(0.96 0.002 20)" : "oklch(0.12 0.01 20)",
                border: "none", color: generating ? "oklch(0.52 0.01 20)" : "oklch(1 0 0)",
                borderRadius: 9999, padding: "8px 16px", fontSize: 13,
                cursor: generating ? "not-allowed" : "pointer",
                fontFamily: "'Pretendard', system-ui, sans-serif", fontWeight: 700, alignSelf: "flex-start",
              }}
            >
              {generating ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Generating…</> : <><Sparkles size={12} /> Generate review</>}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ padding: "12px 14px", background: "oklch(0.96 0.002 20)", border: "1px solid oklch(0.88 0.005 20)", borderRadius: 12, fontSize: 13, color: M2.ink, lineHeight: 1.7, fontFamily: "'Pretendard', system-ui, sans-serif", whiteSpace: "pre-wrap" }}>
              {review}
            </div>
            <button onClick={() => setReview(null)} style={{ marginTop: 8, fontSize: 11, color: M2.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "'Pretendard', system-ui, sans-serif" }}>
              Regenerate
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

/** Record mood to daily-logs whenever it changes (from pill, check-in, or default) */
export function recordMood(mood: number) {
  const today = new Date().toDateString();
  try {
    const raw = localStorage.getItem("adhd-daily-logs");
    const logs: Record<string, DailyLog> = raw ? JSON.parse(raw) : {};
    const existing = logs[today] ?? { dateKey: today, wrapUpDone: false, dumpCount: 0, winsCount: 0, tasksCompleted: 0, mood: null, score: 0 };
    logs[today] = { ...existing, mood };
    localStorage.setItem("adhd-daily-logs", JSON.stringify(logs));
    window.dispatchEvent(new CustomEvent("adhd-storage-update", { detail: "adhd-daily-logs" }));
  } catch {}
}

export function recordWrapUp(mood?: number | null, score?: number) {
  const today = new Date().toDateString();
  try {
    const raw = localStorage.getItem("adhd-daily-logs");
    const logs: Record<string, DailyLog> = raw ? JSON.parse(raw) : {};
    const existing = logs[today] ?? { dateKey: today, wrapUpDone: false, dumpCount: 0, winsCount: 0, tasksCompleted: 0, mood: null, score: 0 };
    logs[today] = { ...existing, wrapUpDone: true, mood: mood ?? existing.mood, score: score ?? existing.score };
    localStorage.setItem("adhd-daily-logs", JSON.stringify(logs));
    window.dispatchEvent(new CustomEvent("adhd-storage-update", { detail: "adhd-daily-logs" }));
  } catch {}
}

/* ── Exported helper to record a brain dump entry ── */
export function recordDumpEntry() {
  const today = new Date().toDateString();
  try {
    const raw = localStorage.getItem("adhd-daily-logs");
    const logs: Record<string, DailyLog> = raw ? JSON.parse(raw) : {};
    const existing = logs[today] ?? { dateKey: today, wrapUpDone: false, dumpCount: 0, winsCount: 0, tasksCompleted: 0, mood: null, score: 0 };
    logs[today] = { ...existing, dumpCount: existing.dumpCount + 1 };
    localStorage.setItem("adhd-daily-logs", JSON.stringify(logs));
    window.dispatchEvent(new CustomEvent("adhd-storage-update", { detail: "adhd-daily-logs" }));
  } catch {}
}

/* ── Focus session detail entry type ── */
export interface FocusSessionEntry {
  sessionNumber: number;  // 1-based
  duration: number;       // minutes
  timestamp: number;      // ms since epoch
  dateKey: string;        // "Mon Apr 07 2026"
}

/* ── Exported helper to record a focus session completion ── */
export function recordFocusSession(durationMinutes = 25) {
  const today = new Date().toDateString();
  try {
    // Update daily log count
    const raw = localStorage.getItem("adhd-daily-logs");
    const logs: Record<string, DailyLog> = raw ? JSON.parse(raw) : {};
    const existing = logs[today] ?? { dateKey: today, wrapUpDone: false, dumpCount: 0, winsCount: 0, tasksCompleted: 0, mood: null, score: 0 };
    const sessions = (existing.focusSessions ?? 0) + 1;
    const score = Math.min(100, existing.score + 5);
    logs[today] = { ...existing, focusSessions: sessions, score };
    localStorage.setItem("adhd-daily-logs", JSON.stringify(logs));

    // Save detailed session entry
    const listRaw = localStorage.getItem("adhd-focus-session-list");
    const list: Record<string, FocusSessionEntry[]> = listRaw ? JSON.parse(listRaw) : {};
    if (!list[today]) list[today] = [];
    const entry: FocusSessionEntry = {
      sessionNumber: sessions,
      duration: durationMinutes,
      timestamp: Date.now(),
      dateKey: today,
    };
    list[today] = [...list[today], entry];
    localStorage.setItem("adhd-focus-session-list", JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("adhd-storage-update", { detail: "adhd-focus-session-list" }));
    window.dispatchEvent(new CustomEvent("adhd-storage-update", { detail: "adhd-daily-logs" }));
  } catch {}
}

/* ── Exported helper to record a full 4-session block completion ── */
export function recordBlockComplete() {
  const today = new Date().toDateString();
  try {
    const raw = localStorage.getItem("adhd-daily-logs");
    const logs: Record<string, DailyLog> = raw ? JSON.parse(raw) : {};
    const existing = logs[today] ?? { dateKey: today, wrapUpDone: false, dumpCount: 0, winsCount: 0, tasksCompleted: 0, mood: null, score: 0 };
    const blocks = (existing.blocksCompleted ?? 0) + 1;
    const score = Math.min(100, existing.score + 10);
    logs[today] = { ...existing, blocksCompleted: blocks, score };
    localStorage.setItem("adhd-daily-logs", JSON.stringify(logs));
    window.dispatchEvent(new CustomEvent("adhd-storage-update", { detail: "adhd-daily-logs" }));
  } catch {}
}
