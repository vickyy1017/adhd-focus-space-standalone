/* ============================================================
   DailyPlanView — Weekly Planner
   Layout: To-dos (top-left) + 7 days in 2-column grid
   Matches reference screenshot exactly
   ============================================================ */

import React, { useState, useRef, useCallback } from "react";
import { Plus, Check, X, ChevronLeft, ChevronRight } from "lucide-react";
import { nanoid } from "nanoid";
import type { Task } from "./TaskManager";

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getWeekStart(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay(); // 0=Sun
  copy.setDate(copy.getDate() - day);
  return copy;
}

// ── Single task row ──────────────────────────────────────────
function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "7px 14px",
        minHeight: 36,
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          border: `1.5px solid ${task.done ? "#111" : "#C8C8C8"}`,
          background: task.done ? "#111" : "transparent",
          flexShrink: 0,
          marginTop: 1,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        {task.done && <Check size={11} color="#fff" strokeWidth={3} />}
      </button>
      <span
        style={{
          flex: 1,
          fontSize: 14,
          lineHeight: 1.4,
          color: task.done ? "#AAAAAA" : "#111111",
          textDecoration: task.done ? "line-through" : "none",
          wordBreak: "break-word",
        }}
      >
        {task.text}
      </span>
      <button
        onClick={onDelete}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "#CCCCCC",
          padding: "2px 0",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          opacity: 0,
        }}
        className="task-delete-btn"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ── Day cell ─────────────────────────────────────────────────
function DayCell({
  label,
  date,
  isToday,
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  borderRight = false,
  borderBottom = false,
}: {
  label: string;
  date: string | null; // null = "To-dos" (no date)
  isToday: boolean;
  tasks: Task[];
  onAddTask: (text: string) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  borderRight?: boolean;
  borderBottom?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const cellTasks = date
    ? tasks.filter((t) => t.dueDate === date)
    : tasks.filter((t) => !t.dueDate || t.dueDate === "null" || t.dueDate === "");

  const startAdd = () => {
    setAdding(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const commit = () => {
    if (input.trim()) onAddTask(input.trim());
    setInput("");
    setAdding(false);
  };

  return (
    <div
      style={{
        borderRight: borderRight ? "1px solid #EEEEEE" : "none",
        borderBottom: borderBottom ? "1px solid #EEEEEE" : "none",
        minHeight: 120,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Cell header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px 6px",
        }}
      >
        {/* Day label */}
        {isToday ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#111111",
              borderRadius: 9999,
              padding: "3px 10px",
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 900, color: "#FFFFFF" }}>
              {label.split(" ")[0]}
            </span>
            {label.split(" ")[1] && (
              <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
                {label.split(" ")[1]}
              </span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: 15, fontWeight: 700, color: "#111111" }}>{label}</span>
        )}
        {/* + button */}
        <button
          onClick={startAdd}
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#AAAAAA",
          }}
        >
          <Plus size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* Tasks */}
      <div style={{ flex: 1 }}>
        {cellTasks.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            onToggle={() => onToggleTask(t.id)}
            onDelete={() => onDeleteTask(t.id)}
          />
        ))}
        {adding && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px" }}>
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: "1.5px solid #C8C8C8",
                flexShrink: 0,
              }}
            />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setAdding(false);
                  setInput("");
                }
              }}
              onBlur={commit}
              placeholder="New task..."
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 14,
                color: "#111111",
                fontFamily: "inherit",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
interface DailyPlanViewProps {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
}

export function DailyPlanView({ tasks, onTasksChange }: DailyPlanViewProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayYMD = toYMD(today);

  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));

  // 7 days starting from Sunday of current week
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const isCurrentWeek = toYMD(weekStart) === toYMD(getWeekStart(today));

  const handleAdd = useCallback(
    (text: string, dueDate: string | null) => {
      const newTask: Task = {
        id: nanoid(),
        text,
        priority: "focus",
        context: "personal",
        done: false,
        createdAt: new Date(),
        dueDate: dueDate,
      };
      onTasksChange([newTask, ...tasks]);
    },
    [tasks, onTasksChange]
  );

  const handleToggle = useCallback(
    (id: string) => {
      onTasksChange(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    },
    [tasks, onTasksChange]
  );

  const handleDelete = useCallback(
    (id: string) => {
      onTasksChange(tasks.filter((t) => t.id !== id));
    },
    [tasks, onTasksChange]
  );

  // Week label
  const monthName = weekStart.toLocaleDateString("en-US", { month: "long" });
  const year = weekStart.getFullYear();
  const weekNum = (() => {
    const d = new Date(Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  })();

  return (
    <div style={{ background: "#FFFFFF" }}>
      {/* ── Week header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "16px 16px 12px",
          gap: 10,
        }}
      >
        <button
          onClick={() => setWeekStart((d) => addDays(d, -7))}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#888", padding: 4, display: "flex", alignItems: "center" }}
        >
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: "#111111" }}>
              This Week
            </span>
            <span
              style={{
                fontSize: 13,
                color: "#888888",
                background: "#F5F5F5",
                borderRadius: 6,
                padding: "2px 8px",
                fontWeight: 600,
              }}
            >
              {monthName.slice(0, 3)}
            </span>
            <span
              style={{
                fontSize: 13,
                color: "#888888",
                background: "#F5F5F5",
                borderRadius: 6,
                padding: "2px 8px",
                fontWeight: 600,
              }}
            >
              W{weekNum}
            </span>
          </div>
        </div>

        <button
          onClick={() => setWeekStart((d) => addDays(d, 7))}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#888", padding: 4, display: "flex", alignItems: "center" }}
        >
          <ChevronRight size={20} strokeWidth={1.5} />
        </button>
      </div>

      {/* Jump to today */}
      {!isCurrentWeek && (
        <div style={{ padding: "0 16px 12px" }}>
          <button
            onClick={() => setWeekStart(getWeekStart(today))}
            style={{
              background: "#111111",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 9999,
              padding: "6px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Jump to today
          </button>
        </div>
      )}

      {/* ── Grid ── */}
      {/* Row 1: To-dos | Sun */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          borderTop: "1px solid #EEEEEE",
        }}
      >
        {/* To-dos */}
        <DayCell
          label="To-dos"
          date={null}
          isToday={false}
          tasks={tasks}
          onAddTask={(text) => handleAdd(text, null)}
          onToggleTask={handleToggle}
          onDeleteTask={handleDelete}
          borderRight
          borderBottom
        />
        {/* Sunday */}
        <DayCell
          label={`${days[0].getDate()} ${WEEKDAYS_SHORT[0]}`}
          date={toYMD(days[0])}
          isToday={toYMD(days[0]) === todayYMD}
          tasks={tasks}
          onAddTask={(text) => handleAdd(text, toYMD(days[0]))}
          onToggleTask={handleToggle}
          onDeleteTask={handleDelete}
          borderBottom
        />
      </div>

      {/* Rows 2-4: Mon-Sat */}
      {[
        [days[1], days[2]],
        [days[3], days[4]],
        [days[5], days[6]],
      ].map(([left, right], rowIdx) => (
        <div
          key={rowIdx}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
          }}
        >
          <DayCell
            label={`${left.getDate()} ${WEEKDAYS_SHORT[left.getDay()]}`}
            date={toYMD(left)}
            isToday={toYMD(left) === todayYMD}
            tasks={tasks}
            onAddTask={(text) => handleAdd(text, toYMD(left))}
            onToggleTask={handleToggle}
            onDeleteTask={handleDelete}
            borderRight
            borderBottom={rowIdx < 2}
          />
          <DayCell
            label={`${right.getDate()} ${WEEKDAYS_SHORT[right.getDay()]}`}
            date={toYMD(right)}
            isToday={toYMD(right) === todayYMD}
            tasks={tasks}
            onAddTask={(text) => handleAdd(text, toYMD(right))}
            onToggleTask={handleToggle}
            onDeleteTask={handleDelete}
            borderBottom={rowIdx < 2}
          />
        </div>
      ))}
    </div>
  );
}
