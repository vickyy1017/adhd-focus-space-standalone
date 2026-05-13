/* ============================================================
   HomeView — Today's focus
   Layout:
   - Date + greeting
   - Today's tasks (large, clean list)
   - Quick input at bottom
   ============================================================ */

import React, { useState, useRef } from "react";
import { Check, Plus, ChevronRight } from "lucide-react";
import { nanoid } from "nanoid";
import type { Task } from "./TaskManager";

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface HomeViewProps {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  onNavigateToTasks: () => void;
  onNavigateToDump: () => void;
  userName?: string;
}

export function HomeView({ tasks, onTasksChange, onNavigateToTasks, onNavigateToDump, userName }: HomeViewProps) {
  const today = new Date();
  const todayYMD = toYMD(today);
  const [quickInput, setQuickInput] = useState("");
  const [completing, setCompleting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const todayTasks = tasks
    .filter((t) => t.dueDate === todayYMD && !t.done)
    .sort((a, b) => {
      const order: Record<string, number> = { urgent: 0, focus: 1, normal: 2 };
      return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
    });

  const completedToday = tasks.filter((t) => t.dueDate === todayYMD && t.done);
  const totalToday = todayTasks.length + completedToday.length;

  const handleToggle = (id: string) => {
    setCompleting(id);
    setTimeout(() => {
      onTasksChange(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
      setCompleting(null);
    }, 300);
  };

  const handleQuickAdd = () => {
    if (!quickInput.trim()) return;
    const newTask: Task = {
      id: nanoid(),
      text: quickInput.trim(),
      priority: "focus",
      context: "personal",
      done: false,
      createdAt: new Date(),
      dueDate: todayYMD,
    };
    onTasksChange([newTask, ...tasks]);
    setQuickInput("");
  };

  const greeting = (() => {
    const h = today.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>

      {/* ── Date & greeting ── */}
      <div style={{ padding: "24px 20px 20px" }}>
        <p style={{ fontSize: 13, color: "#888888", margin: "0 0 4px", fontWeight: 500 }}>
          {DAYS[today.getDay()]}, {MONTHS[today.getMonth()]} {today.getDate()}
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#111111", margin: 0, lineHeight: 1.1 }}>
          {greeting}{userName ? `, ${userName.split(" ")[0]}` : ""}
        </h1>
      </div>

      {/* ── Progress ── */}
      {totalToday > 0 && (
        <div style={{ padding: "0 20px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "#888888", fontWeight: 600 }}>
              {completedToday.length} / {totalToday} done today
            </span>
            <span style={{ fontSize: 12, color: "#888888" }}>
              {Math.round((completedToday.length / totalToday) * 100)}%
            </span>
          </div>
          <div style={{ height: 3, background: "#F0F0F0", borderRadius: 9999, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${(completedToday.length / totalToday) * 100}%`,
                background: "#111111",
                borderRadius: 9999,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* ── Today's tasks ── */}
      <div style={{ flex: 1, padding: "0 0 16px" }}>
        {todayTasks.length === 0 && completedToday.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 15, color: "#BBBBBB", margin: "0 0 16px" }}>
              No tasks for today
            </p>
            <button
              onClick={onNavigateToTasks}
              style={{
                background: "#111111",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 9999,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Plan your week
            </button>
          </div>
        ) : (
          <>
            {todayTasks.map((task) => {
              const isCompleting = completing === task.id;
              return (
                <div
                  key={task.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    padding: "13px 20px",
                    borderBottom: "1px solid #F5F5F5",
                    opacity: isCompleting ? 0.4 : 1,
                    transition: "opacity 0.3s",
                  }}
                >
                  <button
                    onClick={() => handleToggle(task.id)}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      border: `1.5px solid ${isCompleting ? "#111" : "#C8C8C8"}`,
                      background: isCompleting ? "#111" : "transparent",
                      flexShrink: 0,
                      marginTop: 1,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                      transition: "all 0.2s",
                    }}
                  >
                    {isCompleting && <Check size={12} color="#fff" strokeWidth={3} />}
                  </button>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 16, color: "#111111", margin: 0, lineHeight: 1.4, fontWeight: 500 }}>
                      {task.text}
                    </p>
                    {task.priority === "urgent" && (
                      <span style={{ fontSize: 11, color: "#888888", fontWeight: 600, letterSpacing: "0.04em" }}>
                        URGENT
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Completed tasks (collapsed) */}
            {completedToday.length > 0 && (
              <div style={{ padding: "10px 20px" }}>
                <p style={{ fontSize: 13, color: "#BBBBBB", margin: 0 }}>
                  {completedToday.length} completed
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Quick add ── */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid #F0F0F0",
          background: "#FFFFFF",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#F5F5F5",
            borderRadius: 12,
            padding: "10px 14px",
          }}
        >
          <Plus size={16} color="#AAAAAA" strokeWidth={1.5} />
          <input
            ref={inputRef}
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleQuickAdd();
            }}
            placeholder="Add task for today..."
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 15,
              color: "#111111",
              fontFamily: "inherit",
            }}
          />
          {quickInput && (
            <button
              onClick={handleQuickAdd}
              style={{
                background: "#111111",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 8,
                padding: "4px 12px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
