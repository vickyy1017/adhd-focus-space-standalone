/* ============================================================
   DailyPlanView — Nori-style weekly planner
   Each day is a card with draggable tasks, click to add
   ============================================================ */

import React, { useState, useRef, useCallback } from "react";
import { Plus, GripVertical, Check, X, ChevronLeft, ChevronRight } from "lucide-react";
import { nanoid } from "nanoid";
import type { Task } from "./TaskManager";

const N = {
  ink:    "oklch(0.12 0.01 20)",
  muted:  "oklch(0.52 0.01 20)",
  border: "oklch(0.88 0.005 20)",
  bg:     "oklch(0.96 0.002 20)",
  rose:   "oklch(0.82 0.08 10)",
  roseBg: "oklch(0.97 0.02 10)",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toYMD(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getWeekStart(d: Date) {
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day;
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

interface DayCardProps {
  date: Date;
  tasks: Task[];
  isToday: boolean;
  onAddTask: (text: string, dueDate: string) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onReorderTasks: (fromId: string, toId: string, dueDate: string) => void;
}

function DayCard({ date, tasks, isToday, onAddTask, onToggleTask, onDeleteTask, onReorderTasks }: DayCardProps) {
  const [inputText, setInputText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ymd = toYMD(date);
  const dayTasks = tasks.filter(t => t.dueDate === ymd).sort((a, b) => {
    const ai = tasks.indexOf(a), bi = tasks.indexOf(b);
    return ai - bi;
  });

  const handleAdd = () => {
    if (!inputText.trim()) { setIsAdding(false); return; }
    onAddTask(inputText.trim(), ymd);
    setInputText("");
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
    if (e.key === "Escape") { setIsAdding(false); setInputText(""); }
  };

  const startAdd = () => {
    setIsAdding(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Touch drag support
  const touchDragRef = useRef<{ id: string; startY: number } | null>(null);

  return (
    <div style={{
      background: isToday ? N.roseBg : "oklch(1 0 0)",
      border: isToday ? `1.5px solid ${N.rose}` : `1px solid ${N.border}`,
      borderRadius: 16,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Day header */}
      <div style={{
        padding: "10px 14px 8px",
        borderBottom: `1px solid ${isToday ? N.rose + "40" : N.border}`,
        background: isToday ? N.rose : N.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{
            fontFamily: "'Pretendard', system-ui, sans-serif",
            fontSize: 20,
            fontWeight: 900,
            color: isToday ? "white" : N.ink,
            lineHeight: 1,
          }}>
            {date.getDate()}
          </span>
          <span style={{
            fontFamily: "'Pretendard', system-ui, sans-serif",
            fontSize: 11,
            fontWeight: 600,
            color: isToday ? "rgba(255,255,255,0.8)" : N.muted,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}>
            {WEEKDAYS[date.getDay()]}
          </span>
        </div>
        <button
          onClick={startAdd}
          style={{
            width: 24, height: 24, borderRadius: "50%",
            background: isToday ? "rgba(255,255,255,0.25)" : N.border,
            border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: isToday ? "white" : N.muted,
            flexShrink: 0,
          }}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Task list */}
      <div style={{ padding: "8px 0", minHeight: 60, flex: 1 }}>
        {dayTasks.map((task) => (
          <div
            key={task.id}
            draggable
            onDragStart={() => setDragId(task.id)}
            onDragEnd={() => { setDragId(null); setDragOverId(null); }}
            onDragOver={(e) => { e.preventDefault(); setDragOverId(task.id); }}
            onDragLeave={() => setDragOverId(null)}
            onDrop={() => {
              if (dragId && dragId !== task.id) {
                onReorderTasks(dragId, task.id, ymd);
              }
              setDragId(null);
              setDragOverId(null);
            }}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "5px 14px",
              background: dragOverId === task.id ? N.roseBg : "transparent",
              borderTop: dragOverId === task.id ? `2px solid ${N.rose}` : "2px solid transparent",
              cursor: "grab",
              transition: "background 0.1s",
              opacity: task.done ? 0.5 : 1,
            }}
          >
            {/* Drag handle */}
            <GripVertical size={14} style={{ color: N.muted, flexShrink: 0, marginTop: 2, opacity: 0.4 }} />
            {/* Checkbox */}
            <button
              onClick={() => onToggleTask(task.id)}
              style={{
                width: 18, height: 18, borderRadius: "50%",
                border: `2px solid ${task.done ? N.rose : N.border}`,
                background: task.done ? N.rose : "transparent",
                cursor: "pointer", flexShrink: 0, marginTop: 1, padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {task.done && <Check size={10} color="white" strokeWidth={3} />}
            </button>
            {/* Text */}
            <span style={{
              fontFamily: "'Pretendard', system-ui, sans-serif",
              fontSize: 14,
              color: task.done ? N.muted : N.ink,
              textDecoration: task.done ? "line-through" : "none",
              lineHeight: 1.4,
              flex: 1,
              wordBreak: "break-word",
            }}>
              {task.text}
            </span>
            {/* Delete */}
            <button
              onClick={() => onDeleteTask(task.id)}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                color: N.muted, padding: 2, flexShrink: 0, opacity: 0.5,
                display: "flex", alignItems: "center",
              }}
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {/* Inline add input */}
        {isAdding ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 14px" }}>
            <div style={{ width: 14, flexShrink: 0 }} />
            <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${N.border}`, flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleAdd}
              placeholder="Add task..."
              style={{
                flex: 1, border: "none", outline: "none", background: "transparent",
                fontFamily: "'Pretendard', system-ui, sans-serif",
                fontSize: 14, color: N.ink,
              }}
            />
          </div>
        ) : (
          dayTasks.length === 0 && (
            <button
              onClick={startAdd}
              style={{
                width: "100%", background: "transparent", border: "none",
                cursor: "pointer", padding: "8px 14px",
                fontFamily: "'Pretendard', system-ui, sans-serif",
                fontSize: 13, color: N.muted,
                textAlign: "left", display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <Plus size={13} style={{ opacity: 0.5 }} />
              Add task
            </button>
          )
        )}
      </div>
    </div>
  );
}

interface NoDateCardProps {
  tasks: Task[];
  onAddTask: (text: string) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
}

function NoDateCard({ tasks, onAddTask, onToggleTask, onDeleteTask }: NoDateCardProps) {
  const [inputText, setInputText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeTasks = tasks.filter(t => !t.dueDate || t.dueDate === "null");

  const handleAdd = () => {
    if (!inputText.trim()) { setIsAdding(false); return; }
    onAddTask(inputText.trim());
    setInputText("");
    setIsAdding(false);
  };

  return (
    <div style={{
      background: "oklch(1 0 0)",
      border: `1px solid ${N.border}`,
      borderRadius: 16,
      overflow: "hidden",
      gridColumn: "1 / -1",
    }}>
      <div style={{
        padding: "10px 14px 8px",
        borderBottom: `1px solid ${N.border}`,
        background: N.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{
          fontFamily: "'Pretendard', system-ui, sans-serif",
          fontSize: 13, fontWeight: 900, color: N.ink,
        }}>
          Someday / No date
        </span>
        <button
          onClick={() => { setIsAdding(true); setTimeout(() => inputRef.current?.focus(), 50); }}
          style={{
            width: 24, height: 24, borderRadius: "50%",
            background: N.border, border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: N.muted,
          }}
        >
          <Plus size={14} />
        </button>
      </div>
      <div style={{ padding: "8px 0", display: "flex", flexWrap: "wrap", gap: 0 }}>
        {activeTasks.map(task => (
          <div key={task.id} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "5px 14px", width: "50%", boxSizing: "border-box",
          }}>
            <button
              onClick={() => onToggleTask(task.id)}
              style={{
                width: 18, height: 18, borderRadius: "50%",
                border: `2px solid ${task.done ? N.rose : N.border}`,
                background: task.done ? N.rose : "transparent",
                cursor: "pointer", flexShrink: 0, padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {task.done && <Check size={10} color="white" strokeWidth={3} />}
            </button>
            <span style={{
              fontFamily: "'Pretendard', system-ui, sans-serif",
              fontSize: 13, color: task.done ? N.muted : N.ink,
              textDecoration: task.done ? "line-through" : "none",
              flex: 1, wordBreak: "break-word",
            }}>
              {task.text}
            </span>
            <button onClick={() => onDeleteTask(task.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: N.muted, padding: 2, opacity: 0.5 }}>
              <X size={12} />
            </button>
          </div>
        ))}
        {isAdding && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 14px", width: "50%", boxSizing: "border-box" }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${N.border}`, flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setIsAdding(false); setInputText(""); } }}
              onBlur={handleAdd}
              placeholder="Add task..."
              style={{
                flex: 1, border: "none", outline: "none", background: "transparent",
                fontFamily: "'Pretendard', system-ui, sans-serif",
                fontSize: 13, color: N.ink,
              }}
            />
          </div>
        )}
        {activeTasks.length === 0 && !isAdding && (
          <button
            onClick={() => { setIsAdding(true); setTimeout(() => inputRef.current?.focus(), 50); }}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              padding: "8px 14px", fontFamily: "'Pretendard', system-ui, sans-serif",
              fontSize: 13, color: N.muted, display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Plus size={13} style={{ opacity: 0.5 }} />
            Add a task without a date
          </button>
        )}
      </div>
    </div>
  );
}

interface DailyPlanViewProps {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
}

export function DailyPlanView({ tasks, onTasksChange }: DailyPlanViewProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayYMD = toYMD(today);

  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekLabel = (() => {
    const end = addDays(weekStart, 6);
    const startStr = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${startStr} – ${endStr}`;
  })();

  const handleAddTask = useCallback((text: string, dueDate?: string) => {
    const newTask: Task = {
      id: nanoid(),
      text,
      priority: "focus",
      context: "personal",
      done: false,
      createdAt: new Date(),
      dueDate: dueDate ?? null,
    };
    onTasksChange([newTask, ...tasks]);
  }, [tasks, onTasksChange]);

  const handleToggleTask = useCallback((id: string) => {
    onTasksChange(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }, [tasks, onTasksChange]);

  const handleDeleteTask = useCallback((id: string) => {
    onTasksChange(tasks.filter(t => t.id !== id));
  }, [tasks, onTasksChange]);

  const handleReorderTasks = useCallback((fromId: string, toId: string, dueDate: string) => {
    const dayTasks = tasks.filter(t => t.dueDate === dueDate);
    const otherTasks = tasks.filter(t => t.dueDate !== dueDate);
    const fromIdx = dayTasks.findIndex(t => t.id === fromId);
    const toIdx = dayTasks.findIndex(t => t.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = [...dayTasks];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    onTasksChange([...otherTasks, ...reordered]);
  }, [tasks, onTasksChange]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Week navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px" }}>
        <button
          onClick={() => setWeekStart(d => addDays(d, -7))}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: N.muted, padding: 4, display: "flex", alignItems: "center" }}
        >
          <ChevronLeft size={18} />
        </button>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 18, fontWeight: 900, color: N.ink, margin: 0 }}>
            {weekStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
          <p style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 12, color: N.muted, margin: 0 }}>
            {weekLabel}
          </p>
        </div>
        <button
          onClick={() => setWeekStart(d => addDays(d, 7))}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: N.muted, padding: 4, display: "flex", alignItems: "center" }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Today shortcut */}
      {toYMD(weekStart) !== toYMD(getWeekStart(today)) && (
        <button
          onClick={() => setWeekStart(getWeekStart(today))}
          style={{
            alignSelf: "center",
            background: N.ink, color: "white",
            border: "none", borderRadius: 9999,
            padding: "6px 16px",
            fontFamily: "'Pretendard', system-ui, sans-serif",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}
        >
          Today
        </button>
      )}

      {/* 2-column grid of day cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {days.map(day => (
          <DayCard
            key={toYMD(day)}
            date={day}
            tasks={tasks}
            isToday={toYMD(day) === todayYMD}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            onReorderTasks={handleReorderTasks}
          />
        ))}
      </div>

      {/* No-date tasks */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr" }}>
        <NoDateCard
          tasks={tasks}
          onAddTask={(text) => handleAddTask(text, undefined)}
          onToggleTask={handleToggleTask}
          onDeleteTask={handleDeleteTask}
        />
      </div>
    </div>
  );
}
