/* ============================================================
   ADHD FOCUS SPACE — Calendar Task View
   Views: Week (7 days, scrollable columns) | Month (grid)
   - No due date → today
   - Drag task to date → updates dueDate
   - Week: ← → navigation, infinite forward
   - Month: shows full month grid
   ============================================================ */

import React, { useState, useRef } from "react";
import type { Task } from "./TaskManager";
import { ChevronLeft, ChevronRight, List, CalendarDays } from "lucide-react";
import { useMobile } from "@/hooks/useMobile";

const M = {
  ink:     "oklch(0.28 0.040 320)",
  muted:   "oklch(0.52 0.040 330)",
  border:  "oklch(0.82 0.050 340)",
  card:    "oklch(0.975 0.018 355)",
  coral:   "oklch(0.58 0.18 340)",
  coralBg: "oklch(0.58 0.18 340 / 0.08)",
  coralBdr:"oklch(0.58 0.18 340 / 0.28)",
  bg:      "oklch(0.965 0.025 355)",
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "oklch(0.52 0.10 32)",
  focus:  "oklch(0.52 0.14 290)",
  normal: "oklch(0.55 0.10 330)",
  someday:"oklch(0.62 0.04 330)",
};

const WEEKDAYS_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function toYMD(d: Date): string { return d.toISOString().slice(0,10); }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const r = new Date(d); r.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); r.setHours(0,0,0,0); return r;
}
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }

interface Props {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  onTaskToggle: (id: string) => void;
  doneFilter?: "active" | "done" | "all";
}

export function CalendarView({ tasks, onTasksChange, onTaskToggle, doneFilter = "active" }: Props) {
  const today = new Date(); today.setHours(0,0,0,0);
  const todayYMD = toYMD(today);
  const isMobile = useMobile();

  const [calView, setCalView] = useState<"week" | "month">("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [monthStart, setMonthStart] = useState(() => startOfMonth(today));
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // dragOverTask: when hovering over a specific task (for within-day reorder)
  const [dragOverTask, setDragOverTask] = useState<{ id: string; pos: "before" | "after" } | null>(null);
  const dragOverTaskRef = React.useRef<{ id: string; pos: "before" | "after" } | null>(null);
  // Refs to deduplicate drag state updates — avoid setState on every mousemove pixel
  const dragOverDateRef = useRef<string | null>(null);
  const dragIdRef = useRef<string | null>(null);

  // Throttled setters — only update React state when value actually changes
  const setDragOverDateDedup = (ymd: string | null) => {
    if (dragOverDateRef.current === ymd) return;
    dragOverDateRef.current = ymd;
    setDragOverDate(ymd);
  };
  const setDragIdDedup = (id: string | null) => {
    if (dragIdRef.current === id) return;
    dragIdRef.current = id;
    setDragId(id);
  };
  const setDragOverTaskDedup = (v: { id: string; pos: "before" | "after" } | null) => {
    const cur = dragOverTaskRef.current;
    if (cur?.id === v?.id && cur?.pos === v?.pos) return;
    dragOverTaskRef.current = v;
    setDragOverTask(v);
  };
  // dayOrder: persisted per-day task ordering (date → ordered task IDs)
  const [dayOrder, setDayOrder] = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem("adhd-calendar-day-order") ?? "{}"); } catch { return {}; }
  });

  function saveDayOrder(newOrder: Record<string, string[]>) {
    setDayOrder(newOrder);
    try { localStorage.setItem("adhd-calendar-day-order", JSON.stringify(newOrder)); } catch {}
  }

  function getTasksForDay(ymd: string): Task[] {
    const base = tasks
      .filter(t => doneFilter === "active" ? !t.done : doneFilter === "done" ? t.done : true)
      .filter(t => (t.dueDate ?? todayYMD) === ymd);
    const order = dayOrder[ymd];
    if (!order || !order.length) {
      return base.sort((a, b) => {
        const o = ["urgent","focus","normal","someday"];
        return o.indexOf(a.priority) - o.indexOf(b.priority);
      });
    }
    // Apply saved order, append any new tasks not yet in order
    const ordered = order.map(id => base.find(t => t.id === id)).filter(Boolean) as Task[];
    const unordered = base.filter(t => !order.includes(t.id));
    return [...ordered, ...unordered];
  }

  function handleDrop(targetYMD: string, targetTaskId?: string) {
    // Use ref — not state — so we get the value even if setState hasn't flushed
    const currentDragId = dragIdRef.current;
    if (!currentDragId) return;
    const task = tasks.find(t => t.id === currentDragId);
    if (!task) return;

    const sourceYMD = task.dueDate ?? todayYMD;

    if (targetTaskId && targetTaskId !== currentDragId) {
      const finalYMD = targetYMD;
      if (sourceYMD !== finalYMD) {
        const newDue = (finalYMD === todayYMD && !task.dueDate) ? undefined : finalYMD;
        onTasksChange(tasks.map(t => t.id === currentDragId ? { ...t, dueDate: newDue, updatedAt: new Date().toISOString() } : t));
      }
      // Merge with existing full order so unfiltered tasks keep their position
      const existingOrder = dayOrder[finalYMD] ?? [];
      const visibleIds = getTasksForDay(finalYMD).map(t => t.id);
      const hiddenIds = existingOrder.filter(id => !visibleIds.includes(id) && id !== currentDragId);
      const reorderedVisible = visibleIds.filter(id => id !== currentDragId);
      const targetIdx = reorderedVisible.indexOf(targetTaskId);
      const insertIdx = dragOverTaskRef.current?.pos === "before" ? targetIdx : targetIdx + 1;
      reorderedVisible.splice(Math.max(0, insertIdx), 0, currentDragId);
      saveDayOrder({ ...dayOrder, [finalYMD]: [...reorderedVisible, ...hiddenIds] });
    } else if (!targetTaskId) {
      const newDue = (targetYMD === todayYMD && !task.dueDate) ? undefined : targetYMD;
      onTasksChange(tasks.map(t => t.id === currentDragId ? { ...t, dueDate: newDue } : t));
    }

    dragIdRef.current = null; setDragId(null);
    setDragOverDateDedup(null); setDragOverTaskDedup(null);
  }

  // ── Compact task chip ───────────────────────────────────────────────────────
  function TaskChip({ task, dayYMD }: { task: Task; dayYMD: string }) {
    const isOver = dragOverTask?.id === task.id;
    return (
      <div style={{ position: "relative" }}>
        {isOver && dragOverTask?.pos === "before" && (
          <div style={{ height: 2, background: M.coral, borderRadius: 1, marginBottom: 2 }} />
        )}
        <div
          draggable
          onDragStart={(e) => {
            dragIdRef.current = task.id; // ref only — no setState, no re-render
            e.dataTransfer.setData("taskId", task.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => {
            dragIdRef.current = null; setDragId(null);
            setDragOverDateDedup(null);
            setDragOverTaskDedup(null);
          }}
          onDragOver={(e) => {
            e.preventDefault(); e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const pos = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
            setDragOverTaskDedup({ id: task.id, pos });
            setDragOverDateDedup(dayYMD);
          }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDrop(dayYMD, task.id); }}
          title={task.text}
          style={{
            background: "#fff",
            border: `1px solid ${isOver ? M.coral : M.border}`,
            borderLeft: `3px solid ${PRIORITY_COLOR[task.priority] ?? M.coral}`,
            borderRadius: 3, padding: isMobile ? "5px 7px" : "2px 5px",
            cursor: "grab", opacity: dragId === task.id ? 0.4 : 1,
            display: "flex", alignItems: "center", gap: isMobile ? 6 : 4,
            marginBottom: isMobile ? 3 : 0,
          }}
        >
          <button
            onClick={() => onTaskToggle(task.id)}
            style={{
              flexShrink: 0,
              width: isMobile ? 14 : 10,
              height: isMobile ? 14 : 10,
              minWidth: isMobile ? 14 : 10,
              minHeight: isMobile ? 14 : 10,
              borderRadius: "50%",
              border: `1.5px solid ${PRIORITY_COLOR[task.priority] ?? M.muted}`,
              background: "transparent", cursor: "pointer", padding: 0,
              boxSizing: "content-box",
            }}
          />
          <span style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: isMobile ? "0.78rem" : "0.60rem",
            color: M.ink, lineHeight: 1.3,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            flex: 1,
          }}>
            {task.text}
          </span>
        </div>
        {isOver && dragOverTask?.pos === "after" && (
          <div style={{ height: 2, background: M.coral, borderRadius: 1, marginTop: 2 }} />
        )}
      </div>
    );
  }

  // ── Day column (week view) ──────────────────────────────────────────────────
  function DayColumn({ day }: { day: Date }) {
    const ymd = toYMD(day);
    const isToday = ymd === todayYMD;
    const isPast = day < today;
    const isOver = dragOverDate === ymd;
    const dayTasks = getTasksForDay(ymd);

    return (
      <div
        onDragOver={e => { e.preventDefault(); setDragOverDateDedup(ymd); }}
        onDragLeave={() => setDragOverDateDedup(null)}
        onDrop={() => handleDrop(ymd)}
        style={{
          flex: 1, display: "flex", flexDirection: "column",
          background: isToday ? M.coralBg : isOver ? "oklch(0.97 0.018 340)" : "transparent",
          border: isToday ? `1.5px solid ${M.coralBdr}` : isOver ? `1.5px dashed ${M.coral}` : `1px solid ${M.border}`,
          borderRadius: 6, minWidth: 0,
          transition: "background 0.1s",
        }}
      >
        {/* Header — click to open day detail */}
        <div
          onClick={() => setSelectedDay(ymd)}
          style={{ padding: isMobile ? "8px 8px 6px" : "5px 6px 4px", borderBottom: `1px solid ${M.border}`, flexShrink: 0, cursor: "pointer", minHeight: isMobile ? 60 : 52 }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: isMobile ? "0.55rem" : "0.44rem", letterSpacing: "0.06em", textTransform: "uppercase", color: isToday ? M.coral : isPast ? M.muted : M.ink, margin: 0 }}>
              {WEEKDAYS_SHORT[(day.getDay() + 6) % 7]}
            </p>
            {dayTasks.length > 0 && (
              <span style={{ fontSize: "0.42rem", fontFamily: "'Space Mono', monospace", color: isToday ? M.coral : M.muted, background: isToday ? `${M.coral}15` : `${M.muted}18`, borderRadius: 8, padding: "0 4px", lineHeight: "14px" }}>
                {dayTasks.length}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? "1.2rem" : "0.90rem", fontWeight: 700, margin: 0, color: isToday ? M.coral : isPast ? M.muted : M.ink }}>
              {day.getDate()}
            </p>
            {isToday && <div style={{ width: 4, height: 4, borderRadius: "50%", background: M.coral, flexShrink: 0 }} />}
          </div>
        </div>

        {/* Tasks — scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "6px 5px" : "5px 4px", minHeight: isMobile ? 120 : 80, maxHeight: isMobile ? 300 : 480 }}>
          {dayTasks.map(t => <TaskChip key={t.id} task={t} dayYMD={ymd} />)}
          {isOver && dragId && (
            <div style={{ textAlign: "center", fontSize: "0.48rem", fontFamily: "'Space Mono', monospace", color: M.coral, opacity: 0.8 }}>
              drop here
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Week view ───────────────────────────────────────────────────────────────
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoverZone, setHoverZone] = useState<"left" | "right" | null>(null);

  function startAdvance(dir: -1 | 1) {
    // Only activate if a task drag is actually in progress
    if (!dragIdRef.current) return;
    setHoverZone(dir === -1 ? "left" : "right");
    if (advanceTimerRef.current) return;
    advanceTimerRef.current = setTimeout(() => {
      setWeekStart(d => addDays(d, dir * 7));
      advanceTimerRef.current = null;
    }, 600);
  }
  function cancelAdvance() {
    setHoverZone(null);
    if (advanceTimerRef.current) { clearTimeout(advanceTimerRef.current); advanceTimerRef.current = null; }
  }

  function WeekView() {
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    // No-date tasks (To-dos)
    const noDateTasks = tasks.filter(t => !t.done && (!t.dueDate || t.dueDate === "null"));

    // Header: week range + nav
    const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "short" })} · Week ${Math.ceil((weekStart.getDate() + (weekStart.getDay() + 6) % 7) / 7)}`;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%" }}>
        {/* Week header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 4px", flexShrink: 0 }}>
          <button onClick={() => setWeekStart(d => addDays(d, -7))} style={{ background: "none", border: "none", cursor: "pointer", color: M.muted, display: "flex", padding: 4 }}>
            <ChevronLeft size={18} />
          </button>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", fontWeight: 700, color: M.ink, margin: 0 }}>
              {weekStart.toLocaleDateString("en-US", { month: "long" })}
            </p>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.50rem", color: M.muted, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>Today</p>
          </div>
          <button onClick={() => setWeekStart(d => addDays(d, 7))} style={{ background: "none", border: "none", cursor: "pointer", color: M.muted, display: "flex", padding: 4 }}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* 2-column grid: To-dos + 6 days */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, flex: 1, minHeight: 0, background: M.border }}>
          {/* To-dos column */}
          <div style={{ background: "white", padding: "10px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.80rem", fontWeight: 700, color: M.ink, margin: 0 }}>To-dos</p>
            {noDateTasks.length === 0 && (
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", color: M.muted, fontStyle: "italic" }}>No tasks</p>
            )}
            {noDateTasks.slice(0, 8).map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                <button
                  onClick={() => { const updated = tasks.map(x => x.id === t.id ? { ...x, done: true } : x); onTasksChange(updated); }}
                  style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${M.coral}`, background: "transparent", cursor: "pointer", flexShrink: 0, marginTop: 1, padding: 0 }}
                />
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.78rem", color: M.ink, lineHeight: 1.3 }}>{t.text}</span>
              </div>
            ))}
          </div>

          {/* Day 1 (Sun) */}
          {days.slice(0, 1).map(d => {
            const ymd = toYMD(d);
            const isToday = ymd === todayYMD;
            const dayTasks = getTasksForDay(ymd);
            return (
              <div key={ymd} style={{ background: isToday ? M.coralBg : "white", padding: "10px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: isToday ? 28 : "auto", height: isToday ? 28 : "auto", borderRadius: "50%", background: isToday ? M.coral : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "1.0rem", fontWeight: 700, color: isToday ? "white" : M.ink, margin: 0 }}>{d.getDate()}</p>
                  </div>
                  <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.48rem", color: isToday ? M.coral : M.muted, textTransform: "uppercase", margin: 0 }}>{WEEKDAYS_SHORT[(d.getDay() + 6) % 7]}</p>
                </div>
                {dayTasks.slice(0, 5).map(t => (
                  <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 5 }}>
                    <button onClick={() => { const updated = tasks.map(x => x.id === t.id ? { ...x, done: !x.done } : x); onTasksChange(updated); }}
                      style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${M.coral}`, background: t.done ? M.coral : "transparent", cursor: "pointer", flexShrink: 0, marginTop: 2, padding: 0 }} />
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", color: t.done ? M.muted : M.ink, textDecoration: t.done ? "line-through" : "none", lineHeight: 1.3 }}>{t.text}</span>
                  </div>
                ))}
              </div>
            );
          })}

          {/* Days 2-7 (Mon-Sat) */}
          {days.slice(1).map(d => {
            const ymd = toYMD(d);
            const isToday = ymd === todayYMD;
            const dayTasks = getTasksForDay(ymd);
            return (
              <div key={ymd} style={{ background: isToday ? M.coralBg : "white", padding: "10px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: isToday ? 28 : "auto", height: isToday ? 28 : "auto", borderRadius: "50%", background: isToday ? M.coral : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "1.0rem", fontWeight: 700, color: isToday ? "white" : M.ink, margin: 0 }}>{d.getDate()}</p>
                  </div>
                  <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.48rem", color: isToday ? M.coral : M.muted, textTransform: "uppercase", margin: 0 }}>{WEEKDAYS_SHORT[(d.getDay() + 6) % 7]}</p>
                </div>
                {dayTasks.slice(0, 5).map(t => (
                  <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 5 }}>
                    <button onClick={() => { const updated = tasks.map(x => x.id === t.id ? { ...x, done: !x.done } : x); onTasksChange(updated); }}
                      style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${M.coral}`, background: t.done ? M.coral : "transparent", cursor: "pointer", flexShrink: 0, marginTop: 2, padding: 0 }} />
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", color: t.done ? M.muted : M.ink, textDecoration: t.done ? "line-through" : "none", lineHeight: 1.3 }}>{t.text}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Month view ──────────────────────────────────────────────────────────────
  function MonthView() {
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0
    const totalCells = startOffset + lastDay.getDate();
    const rows = Math.ceil(totalCells / 7);
    const cells = Array.from({ length: rows * 7 }, (_, i) => {
      const dayNum = i - startOffset + 1;
      if (dayNum < 1 || dayNum > lastDay.getDate()) return null;
      return new Date(year, month, dayNum);
    });

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => setMonthStart(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} style={{ background: "none", border: "none", cursor: "pointer", color: M.muted, display: "flex" }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "0.95rem", fontWeight: 700, color: M.ink }}>
            {MONTHS[month]} {year}
          </span>
          <button onClick={() => setMonthStart(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} style={{ background: "none", border: "none", cursor: "pointer", color: M.muted, display: "flex" }}>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Weekday headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {WEEKDAYS_SHORT.map(d => (
            <div key={d} style={{ textAlign: "center", fontFamily: "'Space Mono', monospace", fontSize: "0.48rem", letterSpacing: "0.08em", color: M.muted, textTransform: "uppercase", padding: "2px 0" }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, flex: 1, minHeight: 0, overflowY: "auto" }}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const ymd = toYMD(day);
            const isToday = ymd === todayYMD;
            const isPast = day < today;
            const isOver = dragOverDate === ymd;
            const dayTasks = getTasksForDay(ymd);

            return (
              <div
                key={ymd}
                onDragOver={e => { e.preventDefault(); setDragOverDateDedup(ymd); }}
                onDragLeave={() => setDragOverDateDedup(null)}
                onDrop={() => handleDrop(ymd)}
                style={{
                  border: isToday ? `1.5px solid ${M.coralBdr}` : isOver ? `1.5px dashed ${M.coral}` : `1px solid ${M.border}`,
                  borderRadius: 4, padding: "3px 3px 4px",
                  background: isToday ? M.coralBg : isOver ? "oklch(0.97 0.018 340)" : "transparent",
                  minHeight: 88, overflow: "hidden", cursor: "pointer",
                }}
              >
                <div
                  onClick={() => setSelectedDay(ymd)}
                  style={{ textAlign: "right", fontFamily: "'DM Sans', sans-serif", fontSize: "0.68rem", fontWeight: isToday ? 700 : 400, color: isToday ? M.coral : isPast ? M.muted : M.ink, marginBottom: 2 }}
                >
                  {day.getDate()}
                </div>
                {dayTasks.slice(0, 5).map(t => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={e => { e.stopPropagation(); dragIdRef.current = t.id; e.dataTransfer.setData("taskId", t.id); }}
                    onDragEnd={() => { dragIdRef.current = null; setDragId(null); setDragOverDateDedup(null); }}
                    onClick={e => e.stopPropagation()}
                    title={t.text}
                    style={{
                      background: PRIORITY_COLOR[t.priority] + "22",
                      borderLeft: `2px solid ${PRIORITY_COLOR[t.priority] ?? M.coral}`,
                      borderRadius: 2, padding: "1px 3px",
                      fontFamily: "'DM Sans', sans-serif", fontSize: "0.52rem",
                      color: M.ink, overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap", cursor: "grab", marginBottom: 1,
                      opacity: dragId === t.id ? 0.4 : 1,
                    }}
                  >
                    {t.text}
                  </div>
                ))}
                {dayTasks.length > 5 && (
                  <div onClick={() => setSelectedDay(ymd)} style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.42rem", color: M.coral, cursor: "pointer" }}>
                    +{dayTasks.length - 5} more
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
      {/* View toggle */}
      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
        {(["week","month"] as const).map(v => (
          <button
            key={v}
            onClick={() => setCalView(v)}
            style={{
              padding: "2px 10px", borderRadius: 3, fontSize: "0.58rem",
              fontFamily: "'Space Mono', monospace", letterSpacing: "0.06em",
              border: `1px solid ${calView === v ? M.coral : M.border}`,
              background: calView === v ? M.coralBg : "transparent",
              color: calView === v ? M.coral : M.muted,
              cursor: "pointer", textTransform: "uppercase" as const,
            }}
          >
            {v}
          </button>
        ))}
      </div>

      {calView === "week" ? <WeekView /> : <MonthView />}

      {/* Day Detail Modal */}
      {selectedDay && (
        <DayDetailModal
          selectedDay={selectedDay}
          onClose={() => setSelectedDay(null)}
          getTasksForDay={getTasksForDay}
          dayOrder={dayOrder}
          saveDayOrder={saveDayOrder}
          dragId={dragId}
          setDragId={setDragId}
          dragOverTask={dragOverTask}
          setDragOverTask={setDragOverTask}
          onTaskToggle={onTaskToggle}
          onTasksChange={onTasksChange}
          tasks={tasks}
          PRIORITY_COLOR={PRIORITY_COLOR}
          M={M}
        />
      )}
    </div>
  );
}
// ── Day Detail Modal — proper component so useState is valid ─────────────────
function DayDetailModal({ selectedDay, onClose, getTasksForDay, dayOrder, saveDayOrder, dragId, setDragId, dragOverTask, setDragOverTask, onTaskToggle, onTasksChange, tasks, PRIORITY_COLOR, M }: {
  selectedDay: string; onClose: () => void;
  getTasksForDay: (ymd: string) => Task[];
  dayOrder: Record<string, string[]>;
  saveDayOrder: (o: Record<string, string[]>) => void;
  dragId: string | null; setDragId: (id: string | null) => void;
  dragOverTask: { id: string; pos: "before" | "after" } | null;
  setDragOverTask: (v: { id: string; pos: "before" | "after" } | null) => void;
  onTaskToggle: (id: string) => void;
  onTasksChange?: (tasks: Task[]) => void;
  tasks: Task[];
  PRIORITY_COLOR: Record<string, string>;
  M: Record<string, string>;
}) {
  const [filterCtx, setFilterCtx] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editPriority, setEditPriority] = useState<string>("focus");
  const [editDate, setEditDate] = useState("");
  const [editGoalId, setEditGoalId] = useState<string>("");

  const dayTasks = getTasksForDay(selectedDay);
  const dayDate = new Date(selectedDay + "T00:00:00");
  const allContexts = Array.from(new Set(dayTasks.map(t => t.context)));
  const filtered = filterCtx === "all" ? dayTasks : dayTasks.filter(t => t.context === filterCtx);
  const totalSlots = Math.max(filtered.length, 1);
  const goals: { id: string; text: string }[] = (() => { try { return JSON.parse(localStorage.getItem("adhd-goals") ?? "[]"); } catch { return []; } })();

  const openEdit = (task: Task) => {
    setEditingId(task.id);
    setEditText(task.text);
    setEditPriority(task.priority);
    setEditDate(task.dueDate ?? "");
    setEditGoalId(task.goalId ?? "");
  };

  const saveEdit = () => {
    if (!editingId || !onTasksChange) return;
    onTasksChange(tasks.map(t => t.id === editingId ? {
      ...t, text: editText, priority: editPriority as Task["priority"],
      dueDate: editDate || undefined, goalId: editGoalId || undefined,
      updatedAt: new Date().toISOString(),
    } : t));
    setEditingId(null);
  };

  const timeRef = (i: number) => {
    const minPerSlot = ((18 - 9) * 60) / totalSlots;
    const slotMin = Math.round(9 * 60 + i * minPerSlot);
    const h = Math.floor(slotMin / 60);
    const m = slotMin % 60;
    return `${h > 12 ? h - 12 : h}:${m.toString().padStart(2,"0")}${h >= 12 ? "pm" : "am"}`;
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(140,40,90,0.18)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: "#fdf4f8", borderRadius: 16, width: "min(600px, 96vw)", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px rgba(140,40,90,0.28), 0 8px 24px rgba(0,0,0,0.10)", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid oklch(0.82 0.050 340)", background: "#F9D6E8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "1rem", fontWeight: 700, color: "oklch(0.28 0.040 320)", fontStyle: "italic" }}>
            {dayDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", color: "oklch(0.52 0.040 330)" }}>×</button>
        </div>

        {/* Tag filter */}
        {allContexts.length > 1 && (
          <div style={{ padding: "8px 14px 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["all", ...allContexts].map(ctx => (
              <button key={ctx} onClick={() => setFilterCtx(ctx)}
                style={{ fontSize: "0.58rem", fontFamily: "'Space Mono', monospace", letterSpacing: "0.06em", padding: "2px 8px", borderRadius: 10, border: `1px solid ${filterCtx === ctx ? M.coral : M.border}`, background: filterCtx === ctx ? M.coralBg : "transparent", color: filterCtx === ctx ? M.coral : M.muted, cursor: "pointer", textTransform: "uppercase" as const }}>
                {ctx}
              </button>
            ))}
          </div>
        )}

        {/* Task list */}
        {/* Notebook-style layout: single vertical spine line on the left */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", position: "relative" }}>
          {filtered.length === 0
            ? <p style={{ padding: "16px 14px", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", color: M.muted, fontStyle: "italic" }}>No tasks for this day.</p>
            : filtered.map((task, i) => (
              <div key={task.id}>
                {/* Task row */}
                <div draggable
                  onDragStart={() => setDragId(task.id)}
                  onDragEnd={() => { setDragId(null); setDragOverTask(null); }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setDragOverTask({ id: task.id, pos: e.clientY < rect.top + rect.height / 2 ? "before" : "after" });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!dragId || dragId === task.id) return;
                    const curOrder = getTasksForDay(selectedDay).map(t => t.id).filter(id => id !== dragId);
                    const targetIdx = curOrder.indexOf(task.id);
                    const insertIdx = dragOverTask?.pos === "before" ? targetIdx : targetIdx + 1;
                    curOrder.splice(Math.max(0, insertIdx), 0, dragId);
                    saveDayOrder({ ...dayOrder, [selectedDay]: curOrder });
                    setDragId(null); setDragOverTask(null);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 0, padding: "10px 18px 10px 12px", position: "relative", zIndex: 1,
                    borderRadius: 6, margin: "0 6px",
                    transition: "background 0.12s",
                    cursor: "grab", background: editingId === task.id ? "oklch(0.97 0.015 340)" : "transparent",
                    borderTop: dragOverTask?.id === task.id && dragOverTask.pos === "before" ? `2px solid oklch(0.58 0.18 340)` : "none",
                  }}
                >
                  {/* Time — left of spine */}
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.52rem", color: M.muted, opacity: 0.75, flexShrink: 0, width: 40, textAlign: "right", lineHeight: 1, letterSpacing: "-0.02em" }}>
                    {timeRef(i)}
                  </span>
                  {/* Gap crosses the spine line */}
                  <div style={{ width: 10, flexShrink: 0 }} />
                  {/* Circle — RIGHT of spine */}
                  <button onClick={() => onTaskToggle(task.id)} style={{ flexShrink: 0, width: 16, height: 16, minWidth: 16, minHeight: 16, borderRadius: "50%", border: `1.8px solid ${PRIORITY_COLOR[task.priority] ?? "oklch(0.58 0.18 340)"}`, background: task.done ? PRIORITY_COLOR[task.priority] : "#fdf4f8", cursor: "pointer", padding: 0, position: "relative", zIndex: 1, boxShadow: `0 0 0 2px #fdf4f8`, boxSizing: "content-box" }} />
                  {/* Gap after circle */}
                  <div style={{ width: 10, flexShrink: 0 }} />
                  {/* Task text */}
                  <span
                    onClick={() => editingId === task.id ? setEditingId(null) : openEdit(task)}
                    style={{ flex: 1, minWidth: 0, fontFamily: "'DM Sans', sans-serif", fontSize: "0.88rem", color: M.ink, lineHeight: 1.5, cursor: "pointer", textDecoration: task.done ? "line-through" : "none", opacity: task.done ? 0.5 : 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={task.text}
                  >
                    {task.text}
                  </span>
                </div>

                {/* Inline edit panel */}
                {editingId === task.id && (
                  <div style={{ margin: "2px 10px 8px 10px", padding: "12px 14px", background: "#fdf4f8", border: "1px solid oklch(0.78 0.08 340)", borderRadius: 10, display: "flex", flexDirection: "column", gap: 8, position: "relative", zIndex: 2, boxShadow: "0 2px 12px oklch(0.58 0.18 340 / 0.10)" }}>
                    {/* Text */}
                    <textarea value={editText} onChange={e => setEditText(e.target.value)}
                      autoFocus rows={3}
                      style={{ width: "100%", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", padding: "5px 8px", border: "1px solid oklch(0.82 0.050 340)", borderRadius: 4, outline: "none", color: M.ink, resize: "vertical", lineHeight: 1.5 }} />
                    {/* Priority + Date row */}
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {["urgent","focus","normal"].map(p => {
                        const colors: Record<string, string> = { urgent: "oklch(0.52 0.10 32)", focus: "oklch(0.52 0.14 290)", normal: "oklch(0.55 0.10 330)" };
                        const isAct = editPriority === p;
                        return (
                          <button key={p} onClick={() => setEditPriority(p)}
                            style={{ width: 24, height: 24, borderRadius: 4, border: `1.5px solid ${isAct ? colors[p] : M.border}`, background: isAct ? colors[p] + "20" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            title={p}
                          >
                            <span style={{ fontSize: 9, color: isAct ? colors[p] : M.muted }}>
                              {p === "urgent" ? (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
                            ) : p === "focus" ? (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                            ) : (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            )}
                            </span>
                          </button>
                        );
                      })}
                      <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                        style={{ fontSize: "0.60rem", fontFamily: "'DM Sans', sans-serif", padding: "3px 5px", border: `1px solid ${editDate ? "oklch(0.58 0.18 340)" : M.border}`, background: "transparent", color: editDate ? M.coral : M.muted, borderRadius: 3, outline: "none", flex: 1 }} />
                    </div>
                    {/* Goal link */}
                    {goals.length > 0 && (
                      <select value={editGoalId} onChange={e => setEditGoalId(e.target.value)}
                        style={{ width: "100%", fontSize: "0.62rem", fontFamily: "'DM Sans', sans-serif", padding: "3px 6px", border: `1px solid ${editGoalId ? "oklch(0.58 0.18 340)" : M.border}`, background: "transparent", color: editGoalId ? M.coral : M.muted, borderRadius: 3, outline: "none", cursor: "pointer" }}>
                        <option value="">No goal linked</option>
                        {goals.filter((g: any) => !g.archived).map((g: any) => <option key={g.id} value={g.id}>{g.text.length > 40 ? g.text.slice(0,40)+"…" : g.text}</option>)}
                      </select>
                    )}
                    {/* Save/Cancel */}
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button onClick={() => setEditingId(null)} style={{ fontSize: "0.60rem", fontFamily: "'Space Mono', monospace", padding: "3px 10px", border: `1px solid ${M.border}`, background: "transparent", color: M.muted, cursor: "pointer", borderRadius: 3 }}>Cancel</button>
                      <button onClick={saveEdit} style={{ fontSize: "0.60rem", fontFamily: "'Space Mono', monospace", padding: "3px 10px", border: "none", background: "oklch(0.58 0.18 340)", color: "white", cursor: "pointer", borderRadius: 3 }}>Save</button>
                    </div>
                  </div>
                )}

                {/* Separator */}
                {i < filtered.length - 1 && !editingId && (
                  <div style={{ height: 1, background: "oklch(0.82 0.050 340 / 0.4)", margin: "0 14px" }} />
                )}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
