/* ============================================================
   DailyPlanView — Pure Minimal Weekly Planner
   ============================================================ */

import React, { useState, useRef, useCallback } from "react";
import { Plus, Check, X, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { nanoid } from "nanoid";
import type { Task } from "./TaskManager";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toYMD(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getWeekStart(d: Date) {
  const day = d.getDay();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
}

interface DailyPlanViewProps {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
}

function DayColumn({
  date,
  tasks,
  isToday,
  onAddTask,
  onToggleTask,
  onDeleteTask,
}: {
  date: Date;
  tasks: Task[];
  isToday: boolean;
  onAddTask: (text: string, dueDate: string) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
}) {
  const [inputText, setInputText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ymd = toYMD(date);
  const dayTasks = tasks.filter(t => t.dueDate === ymd);

  const startAdd = () => {
    setIsAdding(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const handleAdd = () => {
    if (inputText.trim()) {
      onAddTask(inputText.trim(), ymd);
      setInputText("");
    }
    setIsAdding(false);
  };

  return (
    <div style={{
      border: isToday ? "1.5px solid #111111" : "1px solid #E5E5E5",
      borderRadius: 12,
      background: "#FFFFFF",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Day header */}
      <div style={{
        padding: "10px 12px",
        borderBottom: "1px solid #F0F0F0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: isToday ? "#111111" : "#F9F9F9",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: isToday ? "#FFFFFF" : "#111111" }}>
            {date.getDate()}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: isToday ? "rgba(255,255,255,0.7)" : "#888888", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {WEEKDAYS[date.getDay()]}
          </span>
        </div>
        <button
          onClick={startAdd}
          style={{
            width: 24, height: 24, borderRadius: "50%",
            background: isToday ? "rgba(255,255,255,0.2)" : "#EEEEEE",
            border: "none", cursor: "pointer", color: isToday ? "#FFFFFF" : "#888888",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Tasks */}
      <div style={{ padding: "6px 0", minHeight: 56, flex: 1 }}>
        {dayTasks.map(task => (
          <div
            key={task.id}
            style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "5px 12px",
              opacity: task.done ? 0.45 : 1,
            }}
          >
            <button
              onClick={() => onToggleTask(task.id)}
              style={{
                width: 18, height: 18, borderRadius: "50%",
                border: `1.5px solid ${task.done ? "#111111" : "#CCCCCC"}`,
                background: task.done ? "#111111" : "transparent",
                cursor: "pointer", flexShrink: 0, marginTop: 1, padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {task.done && <Check size={10} color="white" strokeWidth={3} />}
            </button>
            <span style={{
              fontSize: 13, color: "#111111", flex: 1, lineHeight: 1.4,
              textDecoration: task.done ? "line-through" : "none",
              wordBreak: "break-word",
            }}>
              {task.text}
            </span>
            <button
              onClick={() => onDeleteTask(task.id)}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "#CCCCCC", padding: 2, flexShrink: 0, display: "flex", alignItems: "center" }}
            >
              <X size={11} />
            </button>
          </div>
        ))}

        {isAdding ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px" }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px solid #CCCCCC", flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setIsAdding(false); setInputText(""); } }}
              onBlur={handleAdd}
              placeholder="Add task..."
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: "#111111", fontFamily: "inherit" }}
            />
          </div>
        ) : dayTasks.length === 0 ? (
          <button
            onClick={startAdd}
            style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", padding: "6px 12px", display: "flex", alignItems: "center", gap: 5, color: "#CCCCCC", fontSize: 13 }}
          >
            <Plus size={12} />
            Add task
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function DailyPlanView({ tasks, onTasksChange }: DailyPlanViewProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayYMD = toYMD(today);

  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const isCurrentWeek = toYMD(weekStart) === toYMD(getWeekStart(today));

  const noDateTasks = tasks.filter(t => !t.done && (!t.dueDate || t.dueDate === "null" || t.dueDate === ""));

  const [noDateInput, setNoDateInput] = useState("");
  const [addingNoDate, setAddingNoDate] = useState(false);
  const noDateRef = useRef<HTMLInputElement>(null);

  const handleAddTask = useCallback((text: string, dueDate?: string) => {
    const newTask: Task = {
      id: nanoid(), text, priority: "focus", context: "personal",
      done: false, createdAt: new Date(), dueDate: dueDate ?? null,
    };
    onTasksChange([newTask, ...tasks]);
  }, [tasks, onTasksChange]);

  const handleToggleTask = useCallback((id: string) => {
    onTasksChange(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }, [tasks, onTasksChange]);

  const handleDeleteTask = useCallback((id: string) => {
    onTasksChange(tasks.filter(t => t.id !== id));
  }, [tasks, onTasksChange]);

  const handleAddNoDate = () => {
    if (noDateInput.trim()) {
      handleAddTask(noDateInput.trim());
      setNoDateInput("");
    }
    setAddingNoDate(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Week navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => setWeekStart(d => addDays(d, -7))} className="btn-icon">
          <ChevronLeft size={18} />
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#111111" }}>
            {weekStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
          <div style={{ fontSize: 12, color: "#888888" }}>
            {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {addDays(weekStart, 6).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </div>
        </div>
        <button onClick={() => setWeekStart(d => addDays(d, 7))} className="btn-icon">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Jump to today */}
      {!isCurrentWeek && (
        <button
          onClick={() => setWeekStart(getWeekStart(today))}
          className="btn-secondary"
          style={{ alignSelf: "center", padding: "6px 16px", fontSize: 13 }}
        >
          Today
        </button>
      )}

      {/* 2-column day grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {days.map(day => (
          <DayColumn
            key={toYMD(day)}
            date={day}
            tasks={tasks}
            isToday={toYMD(day) === todayYMD}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
          />
        ))}
      </div>

      {/* Someday / No date */}
      <div style={{ border: "1px solid #E5E5E5", borderRadius: 12, background: "#FFFFFF", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #F0F0F0", background: "#F9F9F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111111" }}>Someday</span>
          <button
            onClick={() => { setAddingNoDate(true); setTimeout(() => noDateRef.current?.focus(), 30); }}
            className="btn-icon"
          >
            <Plus size={16} />
          </button>
        </div>
        <div style={{ padding: "6px 0" }}>
          {noDateTasks.map(task => (
            <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 16px", borderBottom: "1px solid #F8F8F8" }}>
              <button
                onClick={() => handleToggleTask(task.id)}
                style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px solid #CCCCCC", background: "transparent", cursor: "pointer", flexShrink: 0, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              />
              <span style={{ flex: 1, fontSize: 14, color: "#111111" }}>{task.text}</span>
              <button onClick={() => handleDeleteTask(task.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#CCCCCC", padding: 2 }}>
                <X size={12} />
              </button>
            </div>
          ))}
          {addingNoDate ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 16px" }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px solid #CCCCCC", flexShrink: 0 }} />
              <input
                ref={noDateRef}
                value={noDateInput}
                onChange={e => setNoDateInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAddNoDate(); if (e.key === "Escape") { setAddingNoDate(false); setNoDateInput(""); } }}
                onBlur={handleAddNoDate}
                placeholder="Add task..."
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: "#111111", fontFamily: "inherit" }}
              />
            </div>
          ) : noDateTasks.length === 0 ? (
            <button
              onClick={() => { setAddingNoDate(true); setTimeout(() => noDateRef.current?.focus(), 30); }}
              style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", padding: "10px 16px", display: "flex", alignItems: "center", gap: 6, color: "#CCCCCC", fontSize: 14 }}
            >
              <Plus size={14} />
              Add a task without a date
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
