/* ============================================================
   MonthlyProgress — Pure Minimal Monthly View
   - Month calendar grid (black dots for activity)
   - Click day → see completed tasks + focus sessions
   - AI Monthly Review
   ============================================================ */

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Sparkles, Loader2, X } from "lucide-react";
import { callAI } from "@/lib/ai";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────
interface DailyLog {
  dateKey: string;
  wrapUpDone: boolean;
  dumpCount: number;
  tasksCompleted: number;
  focusSessions: number;
  focusMinutes: number;
  focusActivities: string[]; // what user worked on each session
}

interface FocusSession {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  durationMin: number;
  activity: string;
}

// ── Helpers ──────────────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function readLogs(): Record<string, DailyLog> {
  try { return JSON.parse(localStorage.getItem("adhd-daily-logs") ?? "{}"); } catch { return {}; }
}

function readFocusSessions(): FocusSession[] {
  try { return JSON.parse(localStorage.getItem("adhd-focus-session-list") ?? "[]"); } catch { return []; }
}

function readTasks() {
  try { return JSON.parse(localStorage.getItem("adhd-tasks") ?? "[]"); } catch { return []; }
}

// ── Exported helpers for recording ───────────────────────────
export function recordWrapUp() {
  try {
    const today = new Date().toDateString();
    const logs = readLogs();
    logs[today] = { ...(logs[today] ?? { dateKey: today, wrapUpDone: false, dumpCount: 0, tasksCompleted: 0, focusSessions: 0, focusMinutes: 0, focusActivities: [] }), wrapUpDone: true };
    localStorage.setItem("adhd-daily-logs", JSON.stringify(logs));
  } catch {}
}

export function recordDumpEntry() {
  try {
    const today = new Date().toDateString();
    const logs = readLogs();
    const existing = logs[today] ?? { dateKey: today, wrapUpDone: false, dumpCount: 0, tasksCompleted: 0, focusSessions: 0, focusMinutes: 0, focusActivities: [] };
    logs[today] = { ...existing, dumpCount: (existing.dumpCount ?? 0) + 1 };
    localStorage.setItem("adhd-daily-logs", JSON.stringify(logs));
  } catch {}
}

export function recordFocusSession(durationMin: number, activity?: string) {
  try {
    const today = new Date().toDateString();
    const todayYMD = toYMD(new Date());
    const logs = readLogs();
    const existing = logs[today] ?? { dateKey: today, wrapUpDone: false, dumpCount: 0, tasksCompleted: 0, focusSessions: 0, focusMinutes: 0, focusActivities: [] };
    const activities = existing.focusActivities ?? [];
    if (activity) activities.push(activity);
    logs[today] = {
      ...existing,
      focusSessions: (existing.focusSessions ?? 0) + 1,
      focusMinutes: (existing.focusMinutes ?? 0) + durationMin,
      focusActivities: activities,
    };
    localStorage.setItem("adhd-daily-logs", JSON.stringify(logs));

    // Also save to focus session list
    const sessions = readFocusSessions();
    const now = new Date();
    sessions.push({
      id: `fs-${Date.now()}`,
      date: todayYMD,
      startTime: `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`,
      durationMin,
      activity: activity ?? "Focus session",
    });
    localStorage.setItem("adhd-focus-session-list", JSON.stringify(sessions));
  } catch {}
}

export function recordBlockComplete(durationMin: number) {
  recordFocusSession(durationMin);
}

export function recordMood(_mood: number) {
  // Mood tracking removed
}

// ── Day Detail Panel ─────────────────────────────────────────
function DayDetail({ dateKey, onClose }: { dateKey: string; onClose: () => void }) {
  const date = new Date(dateKey + "T12:00:00");
  const dateStr = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const logs = readLogs();
  const log = logs[date.toDateString()];

  // Get completed tasks for this day
  const allTasks = readTasks();
  const completedTasks = allTasks.filter((t: any) => t.done && t.dueDate === dateKey);

  // Get focus sessions for this day
  const focusSessions = readFocusSessions().filter(s => s.date === dateKey);

  const totalFocusMin = focusSessions.reduce((sum, s) => sum + s.durationMin, 0);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%", maxWidth: 480,
          background: "#FFFFFF",
          borderRadius: "20px 20px 0 0",
          maxHeight: "70vh",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #F0F0F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 900, color: "#111111", margin: 0 }}>{dateStr}</p>
            {totalFocusMin > 0 && (
              <p style={{ fontSize: 13, color: "#888888", margin: "2px 0 0" }}>
                {Math.floor(totalFocusMin / 60) > 0 ? `${Math.floor(totalFocusMin / 60)}h ` : ""}{totalFocusMin % 60}m focused
              </p>
            )}
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#888888", padding: 4 }}>
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

          {/* Focus sessions */}
          {focusSessions.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#888888", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>
                Focus Sessions
              </p>
              {focusSessions.map(session => (
                <div key={session.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #F5F5F5" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#111111" }}>{session.durationMin}m</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, color: "#111111", margin: 0, fontWeight: 500 }}>{session.activity}</p>
                    <p style={{ fontSize: 12, color: "#888888", margin: 0 }}>{session.startTime}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Completed tasks */}
          {completedTasks.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#888888", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>
                Completed Tasks ({completedTasks.length})
              </p>
              {completedTasks.map((task: any) => (
                <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F5F5F5" }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#111111", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: 14, color: "#888888", margin: 0, textDecoration: "line-through" }}>{task.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Brain dump count */}
          {log?.dumpCount > 0 && (
            <div style={{ padding: "12px 0", borderBottom: "1px solid #F5F5F5" }}>
              <p style={{ fontSize: 14, color: "#888888", margin: 0 }}>
                {log.dumpCount} brain dump {log.dumpCount === 1 ? "entry" : "entries"}
              </p>
            </div>
          )}

          {/* Empty state */}
          {focusSessions.length === 0 && completedTasks.length === 0 && (
            <p style={{ fontSize: 14, color: "#BBBBBB", textAlign: "center", padding: "20px 0" }}>
              No activity recorded
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Monthly Stats ─────────────────────────────────────────────
function MonthStats({ year, month }: { year: number; month: number }) {
  const logs = readLogs();
  const focusSessions = readFocusSessions();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let activeDays = 0, totalFocusMin = 0, totalDumps = 0, totalTasks = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const log = logs[date.toDateString()];
    if (log) {
      if (log.wrapUpDone || log.dumpCount > 0 || log.focusSessions > 0 || log.tasksCompleted > 0) activeDays++;
      totalDumps += log.dumpCount ?? 0;
      totalTasks += log.tasksCompleted ?? 0;
    }
    const ymd = toYMD(date);
    const daySessions = focusSessions.filter(s => s.date === ymd);
    totalFocusMin += daySessions.reduce((sum, s) => sum + s.durationMin, 0);
  }

  const stats = [
    { label: "Active days", value: activeDays },
    { label: "Focus time", value: totalFocusMin >= 60 ? `${Math.floor(totalFocusMin/60)}h ${totalFocusMin%60}m` : `${totalFocusMin}m` },
    { label: "Brain dumps", value: totalDumps },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
      {stats.map(s => (
        <div key={s.label} style={{ background: "#F5F5F5", borderRadius: 12, padding: "12px", textAlign: "center" }}>
          <p style={{ fontSize: 20, fontWeight: 900, color: "#111111", margin: "0 0 2px" }}>{s.value}</p>
          <p style={{ fontSize: 11, color: "#888888", margin: 0 }}>{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── AI Monthly Review ─────────────────────────────────────────
function MonthlyAIReview({ year, month }: { year: number; month: number }) {
  const [review, setReview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const logs = readLogs();
      const focusSessions = readFocusSessions();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      let activeDays = 0, totalFocusMin = 0, totalDumps = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const log = logs[date.toDateString()];
        if (log) {
          if (log.wrapUpDone || log.dumpCount > 0 || log.focusSessions > 0) activeDays++;
          totalDumps += log.dumpCount ?? 0;
        }
        const ymd = toYMD(date);
        totalFocusMin += focusSessions.filter(s => s.date === ymd).reduce((sum, s) => sum + s.durationMin, 0);
      }

      const result = await callAI(
        "You write warm, personal monthly review summaries for people with ADHD. Be specific, encouraging and concise (3-4 sentences). Mention patterns and give one concrete suggestion for next month.",
        `Month: ${MONTHS[month]} ${year}\nActive days: ${activeDays}/${daysInMonth}\nBrain dump entries: ${totalDumps}\nTotal focus time: ${Math.floor(totalFocusMin/60)}h ${totalFocusMin%60}m`
      );
      setReview(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: "1px solid #E5E5E5", borderRadius: 16, overflow: "hidden" }}>
      <div style={{ background: "#F5F5F5", padding: "12px 16px", borderBottom: "1px solid #E5E5E5" }}>
        <p style={{ fontSize: 14, fontWeight: 900, color: "#111111", margin: 0 }}>AI Monthly Review</p>
      </div>
      <div style={{ padding: 16 }}>
        {!review ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 13, color: "#888888", margin: 0, lineHeight: 1.5 }}>
              Get a personalised review of your month — patterns, insights, and one thing to try next month.
            </p>
            <button
              onClick={generate}
              disabled={loading}
              style={{
                alignSelf: "flex-start",
                background: loading ? "#F5F5F5" : "#111111",
                color: loading ? "#888888" : "#FFFFFF",
                border: "none", borderRadius: 9999,
                padding: "8px 16px", fontSize: 13, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 6,
                fontFamily: "inherit",
              }}
            >
              {loading ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating…</> : <><Sparkles size={13} /> Generate</>}
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 14, color: "#111111", lineHeight: 1.7, margin: "0 0 10px", whiteSpace: "pre-wrap" }}>{review}</p>
            <button onClick={() => setReview(null)} style={{ fontSize: 12, color: "#888888", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              Regenerate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
interface MonthlyProgressProps {
  embedded?: boolean;
  onNavigate?: (section: string) => void;
}

export default function MonthlyProgress({ embedded, onNavigate }: MonthlyProgressProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const logs = readLogs();
  const focusSessions = readFocusSessions();

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const todayYMD = toYMD(today);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // Check if a day has activity
  const hasActivity = (day: number) => {
    const date = new Date(viewYear, viewMonth, day);
    const log = logs[date.toDateString()];
    const ymd = toYMD(date);
    const hasFocus = focusSessions.some(s => s.date === ymd);
    return !!(log?.wrapUpDone || log?.dumpCount > 0 || log?.focusSessions > 0 || hasFocus);
  };

  const hasFocus = (day: number) => {
    const ymd = toYMD(new Date(viewYear, viewMonth, day));
    return focusSessions.some(s => s.date === ymd);
  };

  const hasDump = (day: number) => {
    const date = new Date(viewYear, viewMonth, day);
    return (logs[date.toDateString()]?.dumpCount ?? 0) > 0;
  };

  return (
    <div style={{ padding: embedded ? "0" : "16px", maxWidth: 480, margin: "0 auto" }}>

      {/* Month navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={prevMonth} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#888888", padding: 4, display: "flex", alignItems: "center" }}>
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>
        <p style={{ fontSize: 18, fontWeight: 900, color: "#111111", margin: 0 }}>
          {MONTHS[viewMonth]} {viewYear}
        </p>
        <button onClick={nextMonth} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#888888", padding: 4, display: "flex", alignItems: "center" }}>
          <ChevronRight size={20} strokeWidth={1.5} />
        </button>
      </div>

      {/* Stats */}
      <MonthStats year={viewYear} month={viewMonth} />

      {/* Calendar */}
      <div style={{ border: "1px solid #E5E5E5", borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
        {/* Weekday headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "#F9F9F9", borderBottom: "1px solid #F0F0F0" }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{ textAlign: "center", padding: "8px 0", fontSize: 11, fontWeight: 700, color: "#888888", letterSpacing: "0.04em" }}>{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {/* Empty cells before month start */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} style={{ padding: "8px 0" }} />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const ymd = toYMD(new Date(viewYear, viewMonth, day));
            const isToday = ymd === todayYMD;
            const active = hasActivity(day);
            const hasFocusToday = hasFocus(day);
            const hasDumpToday = hasDump(day);

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(ymd)}
                style={{
                  padding: "6px 0",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  background: "transparent",
                  border: "none",
                  cursor: active ? "pointer" : "default",
                }}
              >
                <div style={{
                  width: 32, height: 32,
                  borderRadius: "50%",
                  background: isToday ? "#111111" : "transparent",
                  border: isToday ? "none" : "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{
                    fontSize: 14,
                    fontWeight: isToday ? 900 : 400,
                    color: isToday ? "#FFFFFF" : active ? "#111111" : "#BBBBBB",
                  }}>{day}</span>
                </div>
                {/* Activity dots */}
                {(hasFocusToday || hasDumpToday) && (
                  <div style={{ display: "flex", gap: 2 }}>
                    {hasFocusToday && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#111111" }} />}
                    {hasDumpToday && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#888888" }} />}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ padding: "8px 16px 10px", borderTop: "1px solid #F0F0F0", display: "flex", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#111111" }} />
            <span style={{ fontSize: 11, color: "#888888" }}>Focus</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#888888" }} />
            <span style={{ fontSize: 11, color: "#888888" }}>Brain dump</span>
          </div>
        </div>
      </div>

      {/* AI Review */}
      <MonthlyAIReview year={viewYear} month={viewMonth} />

      {/* Day detail modal */}
      {selectedDay && (
        <DayDetail dateKey={selectedDay} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  );
}
