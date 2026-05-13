/* ============================================================
   ADHD FOCUS SPACE — Task Manager v3.0 (Morandi)
   Priority: Urgent=coral, Focus=sage, Normal=slumber
   Context: Work=sage-green, Personal=dusty-mauve
   ============================================================ */

import { useState, useRef, useEffect } from "react";
import { CalendarView } from "./CalendarView";
import { priorityToQuadrant, type QuadrantId } from "./EisenhowerMatrix";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Flame, List, CalendarDays, Plus, Star, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import {
  ContextSwitcher, ContextBadge, ClickableContextBadge, getContextConfig,
  type ItemContext, type ActiveContext,
} from "./ContextSwitcher";
import type { Goal } from "./Goals";
import { recordDeletion } from "@/lib/appStorage";

export type TaskPriority = "focus" | "urgent" | "normal";

export interface Task {
  id: string;
  text: string;
  priority: TaskPriority;
  context: ItemContext;
  done: boolean;
  createdAt: Date;
  /** ISO timestamp — set on every mutation so merge picks the latest version */
  updatedAt?: string;
  /** Optional: ID of a Goal this task contributes to */
  goalId?: string;
  dueDate?: string; // ISO date string YYYY-MM-DD
}

/* Morandi priority palette */
const PRIORITY_CONFIG: Record<TaskPriority, {
  label: string; icon: React.ElementType;
  color: string; bg: string; border: string;
}> = {
  urgent: {
    label: "Urgent", icon: Flame,
    color:  "oklch(0.55 0.09 35)",
    bg:     "oklch(0.55 0.09 35 / 0.08)",
    border: "oklch(0.55 0.09 35 / 0.28)",
  },
  focus: {
    label: "Focus", icon: Zap,
    color:  "oklch(0.52 0.14 290)",
    bg:     "oklch(0.52 0.14 290 / 0.08)",
    border: "oklch(0.52 0.14 290 / 0.28)",
  },
  normal: {
    label: "Normal", icon: Star,
    color:  "oklch(0.55 0.10 330)",
    bg:     "oklch(0.72 0.10 330 / 0.10)",
    border: "oklch(0.72 0.10 330 / 0.30)",
  },
};

const M = {
  ink:    "oklch(0.12 0.01 20)",
  muted:  "oklch(0.52 0.01 20)",
  border: "oklch(0.88 0.005 20)",
  card:   "oklch(1 0 0)",
  bg:     "oklch(0.960 0.030 355)",
  coral:  "oklch(0.82 0.08 10)",
};

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: "'Pretendard', system-ui, sans-serif",
  fontSize: "0.65rem",
  fontWeight: 500,
  letterSpacing: "0.10em",
  textTransform: "uppercase",
  color: M.muted,
};

interface TaskManagerProps {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  defaultContext?: ActiveContext;
  /** Shared category list from Home */
  allCategories?: string[];
  /** Called when user wants to delete a custom tag */
  onDeleteCategory?: (ctx: string) => void;
  /** All goals — used for 'Contributes to goal' dropdown */
  goals?: Goal[];
}

/* Parse hashtags from input text — returns { cleanText, tag }
 * Only the #tag token is stripped; the rest of the text is preserved exactly.
 * Example: "work out #workout" → { cleanText: "work out", tag: "workout" }
 */
function parseHashtag(raw: string): { cleanText: string; tag: string | null } {
  const match = raw.match(/(^|\s)#([\w-]+)(\s|$)/);
  if (!match) return { cleanText: raw.trim(), tag: null };
  // Remove only the matched #tag token (with surrounding spaces collapsed)
  const cleanText = raw.replace(/(^|\s)#[\w-]+(\s|$)/g, " ").replace(/\s{2,}/g, " ").trim();
  return { cleanText, tag: match[2].toLowerCase() };
}

export function TaskManager({ tasks, onTasksChange, defaultContext = "all", allCategories, onDeleteCategory, goals = [] }: TaskManagerProps) {
  const [newTaskText,     setNewTaskText]     = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>("focus");
  const [newTaskContext,  setNewTaskContext]  = useState<ItemContext>("work");
  const [newTaskGoalId,   setNewTaskGoalId]   = useState<string | null>(null);
  const [newTaskDueDate,  setNewTaskDueDate]  = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [completingId,    setCompletingId]    = useState<string | null>(null);
  const [activeContext,   setActiveContext]   = useState<ActiveContext>(defaultContext);
  const [filter,          setFilter]          = useState<"all" | "active" | "done">("active");
  const [viewMode, setViewModeState] = useState<"list" | "calendar">(() => {
    return (sessionStorage.getItem("adhd-task-viewmode") as "list" | "calendar") ?? "calendar";
  });
  const setViewMode = (m: "list" | "calendar") => {
    setViewModeState(m);
    sessionStorage.setItem("adhd-task-viewmode", m);
  };
  // Inline editing state
  // Quadrant map: taskId → quadrantId (persisted in component state)
  const [quadrantMap, setQuadrantMap]         = useState<Record<string, QuadrantId>>(() => {
    try {
      const saved = localStorage.getItem("adhd-quadrant-map");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  function handleQuadrantMapChange(map: Record<string, QuadrantId>) {
    setQuadrantMap(map);
    try { localStorage.setItem("adhd-quadrant-map", JSON.stringify(map)); } catch {}
  }

  // Collect all unique contexts — prefer shared list from Home, fall back to deriving from tasks
  const allContexts = allCategories ?? Array.from(new Set(["work", "personal", ...tasks.map((t) => t.context)]));

  // Detect hashtag in current input for live preview
  const { tag: liveTag } = parseHashtag(newTaskText);


  const addTask = () => {
    if (!newTaskText.trim()) return;
    const { cleanText, tag } = parseHashtag(newTaskText);
    // If a hashtag was typed, use it. Otherwise use the currently active tab
    // (unless it's "all", in which case fall back to the manual context selector).
    const context = tag ?? (activeContext !== "all" ? (activeContext as ItemContext) : newTaskContext);
    const now = new Date().toISOString();
    const task: Task = {
      id: nanoid(), text: cleanText || newTaskText.trim(),
      priority: newTaskPriority, context,
      done: false, createdAt: new Date(), updatedAt: now,
      ...(newTaskGoalId ? { goalId: newTaskGoalId } : {}),
      dueDate: newTaskDueDate || new Date().toISOString().slice(0, 10),
    };
    onTasksChange([task, ...tasks]);
    setNewTaskText("");
    setNewTaskGoalId(null);
    setNewTaskDueDate(new Date().toISOString().slice(0, 10));
  };

  const toggleTask = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    if (!task.done) {
      setCompletingId(id);
      setTimeout(() => {
        onTasksChange(tasks.map((t) => t.id === id ? { ...t, done: true, updatedAt: new Date().toISOString() } : t));
        setCompletingId(null);
        toast("Task completed", {
          duration: 5000,
          action: { label: "Undo", onClick: () => onTasksChange(tasks.map((t) => t.id === id ? { ...t, done: false, updatedAt: new Date().toISOString() } : t)) },
        });
      }, 400);
    } else {
      onTasksChange(tasks.map((t) => t.id === id ? { ...t, done: false, updatedAt: new Date().toISOString() } : t));
    }
  };

  const deleteTask = (id: string) => {
    const deleted = tasks.find(t => t.id === id);
    recordDeletion(id);
    onTasksChange(tasks.filter((t) => t.id !== id));
    if (deleted) toast("Task deleted", {
      duration: 5000,
      action: { label: "Undo", onClick: () => onTasksChange([...tasks]) },
    });
  };

  // Build counts for all known contexts
  const counts: Record<string, number> = { all: tasks.filter((t) => !t.done).length };
  allContexts.forEach((ctx) => {
    counts[ctx] = tasks.filter((t) => !t.done && t.context === ctx).length;
  });

  const contextFiltered = tasks.filter((t) => activeContext === "all" ? true : t.context === activeContext);
  const _n = new Date();
  const todayYMD = `${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,'0')}-${String(_n.getDate()).padStart(2,'0')}`;
  const sorted = [...contextFiltered].sort((a, b) => {
    // Done tasks always go to the bottom
    if (a.done !== b.done) return a.done ? 1 : -1;
    const order: TaskPriority[] = ["urgent", "focus", "normal", "someday"];
    const aDate = a.dueDate || null;
    const bDate = b.dueDate || null;
    const aOverdue = aDate && aDate < todayYMD;
    const bOverdue = bDate && bDate < todayYMD;
    const aToday   = aDate === todayYMD;
    const bToday   = bDate === todayYMD;
    // Bucket: overdue=0, today/no-date=1, future=2
    const bucket = (d: string | null, ovr: boolean | string, tdy: boolean) =>
      ovr ? 0 : tdy ? 1 : d ? 2 : 1;
    const aBucket = bucket(aDate, aOverdue, aToday);
    const bBucket = bucket(bDate, bOverdue, bToday);
    if (aBucket !== bBucket) return aBucket - bBucket;
    const pDiff = order.indexOf(a.priority) - order.indexOf(b.priority);
    if (aBucket === 0) {
      // overdue: oldest first, then priority
      if (aDate && bDate && aDate !== bDate) return aDate < bDate ? -1 : 1;
      return pDiff;
    }
    if (aBucket === 2) {
      // future: priority first, then date ascending
      if (pDiff !== 0) return pDiff;
      if (aDate && bDate && aDate !== bDate) return aDate < bDate ? -1 : 1;
      return 0;
    }
    // today / no-date: priority only
    return pDiff;
  });
  const filtered = sorted.filter((t) => {
    if (filter === "active") return !t.done;
    if (filter === "done")   return t.done;
    return true;
  });

  const activeCount = contextFiltered.filter((t) => !t.done).length;
  const doneCount   = contextFiltered.filter((t) => t.done).length;

  const CAT_PURPLE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663410012773/WNs8kMVMKanwFbtYhk72en/cat3_purple_sitting_e38dc6af.png";
  return (
    <div data-tour-id="tour-tasks" className="flex flex-col gap-4 h-full" style={{ position: "relative" }}>
      {/* Cat sticker: purple sitting cat — top-right corner */}
      <img src={CAT_PURPLE} alt="" aria-hidden="true" style={{ position: "absolute", top: 0, right: 0, width: 64, opacity: 0.40, pointerEvents: "none", zIndex: 5 }} />
      {/* Context switcher — shows all known categories */}
      <ContextSwitcher active={activeContext} onChange={setActiveContext} counts={counts} contexts={allContexts} onDeleteContext={onDeleteCategory} />

      {/* Add task */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="task name... #tag"
            className="flex-1"
            style={{
              background: M.card,
              border: `1px solid ${liveTag ? M.coral : M.border}`,
              fontFamily: "'Pretendard', system-ui, sans-serif",
              transition: "border-color 0.2s",
              fontSize: "0.8rem",
              fontWeight: 300,
              letterSpacing: "0.01em",
              paddingTop: "0.55rem",
              paddingBottom: "0.55rem",
              color: "oklch(0.35 0.02 70)",
            }}
          />

          <button
            onClick={addTask}
            className="m-btn-primary shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        {/* Live hashtag preview */}
        {liveTag && (
          <div className="flex items-center gap-1.5" style={{ fontSize: "0.7rem", color: M.muted, fontFamily: "'Pretendard', system-ui, sans-serif" }}>
            <span style={{ color: M.coral }}>◆</span>
            Will be added to category{" "}
            <span
              className="px-2 py-0.5 font-medium"
              style={{ background: M.coral + "15", color: M.coral, border: `1px solid ${M.coral}30`, fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.68rem", letterSpacing: "0.06em" }}
            >
              #{liveTag}
            </span>
          </div>
        )}

        {/* Priority + context row */}
        <div className="flex items-center gap-2 flex-wrap">
          {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((p) => {
            const { label, icon: Icon, color, bg, border } = PRIORITY_CONFIG[p];
            const isActive = newTaskPriority === p;
            return (
              <button
                key={p}
                onClick={() => setNewTaskPriority(p)}
                className="flex items-center gap-1.5 px-3 py-1 transition-all"
                style={{
                  background:  isActive ? bg : "transparent",
                  color:       isActive ? color : M.muted,
                  border:      `1px solid ${isActive ? border : M.border}`,
                  fontFamily:  "'Pretendard', system-ui, sans-serif",
                  fontSize:    "0.62rem",
                  fontWeight:  isActive ? 600 : 400,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  borderRadius: 0,
                }}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            );
          })}

          {/* Contributes to goal — only shown when goals exist */}
          {goals.length > 0 && (
            <select
              value={newTaskGoalId ?? ""}
              onChange={(e) => setNewTaskGoalId(e.target.value || null)}
              style={{
                background: newTaskGoalId ? "oklch(0.52 0.14 290 / 0.10)" : "transparent",
                color: newTaskGoalId ? "oklch(0.40 0.14 290)" : M.muted,
                border: `1px solid ${newTaskGoalId ? "oklch(0.52 0.14 290 / 0.40)" : M.border}`,
                fontFamily: "'Pretendard', system-ui, sans-serif",
                fontSize: "0.62rem",
                fontWeight: newTaskGoalId ? 600 : 400,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                borderRadius: 0,
                padding: "3px 8px",
                cursor: "pointer",
                outline: "none",
                maxWidth: 180,
              }}
            >
              <option value="">↳ Goal (optional)</option>
              {goals.filter((g) => g.progress < 100).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.text.length > 28 ? g.text.slice(0, 28) + "…" : g.text}
                </option>
              ))}
            </select>
          )}
          {/* Due date input */}
          <input
            type="date"
            value={newTaskDueDate}
            onChange={(e) => setNewTaskDueDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            style={{
              background: newTaskDueDate ? "oklch(0.52 0.10 32 / 0.08)" : "transparent",
              color: newTaskDueDate ? "oklch(0.40 0.10 32)" : M.muted,
              border: `1px solid ${newTaskDueDate ? "oklch(0.52 0.10 32 / 0.40)" : M.border}`,
              fontFamily: "'Pretendard', system-ui, sans-serif",
              fontSize: "0.62rem",
              borderRadius: 0,
              padding: "3px 8px",
              cursor: "pointer",
              outline: "none",
            }}
            title="Due date (optional)"
          />
        </div>
      </div>

      {/* Filter tabs + sort selector */}
      <div className="flex items-center justify-between" style={{ borderBottom: `1px solid ${M.border}` }}>
        <div className="flex gap-0 text-xs">
        {[
          { id: "active", label: `Active (${activeCount})` },
          { id: "done",   label: `Done (${doneCount})` },
          { id: "all",    label: "All" },
        ].map(({ id, label }) => {
          const isAct = filter === id;
          return (
            <button
              key={id}
              onClick={() => setFilter(id as typeof filter)}
              className="px-4 py-2 transition-all"
              style={{
                color:        isAct ? M.coral : M.muted,
                borderBottom: isAct ? `2px solid ${M.coral}` : "2px solid transparent",
                fontFamily:   "'Pretendard', system-ui, sans-serif",
                fontWeight:   isAct ? 600 : 400,
                fontSize:     "0.68rem",
                letterSpacing: "0.10em",
                textTransform: "uppercase",
              }}
            >
              {label}
            </button>
          );
        })}
        </div>
        {/* View toggle: List | Calendar */}
        <div className="flex items-center gap-1 pr-2">
          {(["list", "calendar"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              title={v === "list" ? "List view" : "Calendar view"}
              style={{
                padding: "2px 7px", borderRadius: 3,
                border: `1px solid ${viewMode === v ? M.coral : M.border}`,
                background: viewMode === v ? `${M.coral}12` : "transparent",
                color: viewMode === v ? M.coral : M.muted,
                cursor: "pointer", display: "flex", alignItems: "center",
              }}
            >
              {v === "list" ? <List size={11} /> : <CalendarDays size={11} />}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar view */}
      {viewMode === "calendar" && (
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, overflowX: "hidden" }}>
          <CalendarView
            tasks={contextFiltered}
            onTasksChange={(updated) => onTasksChange(tasks.map(t => updated.find(u => u.id === t.id) ?? t))}
            onTaskToggle={(id) => onTasksChange(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t))}
            doneFilter={filter}
          />
        </div>
      )}

      {/* Task list — retro dashed-border rows with icon box + dotted connectors */}
      {viewMode === "list" && <div className="flex-1 overflow-y-auto pr-1 retro-task-list">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <svg width="40" height="40" viewBox="0 0 40 40" style={{ opacity: 0.18 }}>
              <rect x="8" y="8" width="24" height="24" rx="2" fill="none" stroke={M.muted} strokeWidth="1.5" />
              <line x1="14" y1="20" x2="26" y2="20" stroke={M.muted} strokeWidth="1" />
              <line x1="20" y1="14" x2="20" y2="26" stroke={M.muted} strokeWidth="1" />
            </svg>
            <p className="text-sm" style={{ color: M.muted, fontFamily: "'Pretendard', system-ui, sans-serif" }}>
              {filter === "active" ? "All clear." : "Nothing here."}
            </p>
          </div>
        )}

        {filtered.map((task) => {
          const pcfg        = PRIORITY_CONFIG[task.priority];
          const PIcon       = pcfg.icon;
          const isCompleting = completingId === task.id;
          const cleanText = task.text.replace(/(?:^|\s)#[a-zA-Z0-9\u4e00-\u9fa5_-]+/g, " ").replace(/\s{2,}/g, " ").trim() || task.text;

          return (
            <div
              key={task.id}
              className={cn("retro-task-row group", task.priority, task.done ? "done" : "")}
              style={{
                opacity: isCompleting ? 0.5 : 1,
                transform: isCompleting ? "scale(0.98)" : undefined,
                transition: "all 0.3s ease",
                alignItems: "flex-start",
                position: "relative",
              }}
            >
              {/* Left: priority icon box */}
              <div style={{
                flexShrink: 0,
                width: 28,
                height: 28,
                border: `1.5px solid ${pcfg.border}`,
                borderRadius: 4,
                background: pcfg.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 1,
              }}>
                <PIcon size={12} style={{ color: pcfg.color }} />
              </div>

              {/* Text + goal link */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(task.done && "line-through")}
                  style={{
                    color:      task.done ? M.muted : M.ink,
                    fontFamily: "'Pretendard', system-ui, sans-serif",
                    fontSize:   "0.82rem",
                    fontWeight: task.done ? 300 : 500,
                    letterSpacing: "0.01em",
                    lineHeight: 1.4,
                  }}
                >
                  {cleanText}
                </p>
                {task.dueDate && task.dueDate !== "null" && task.dueDate.includes('-') && (() => {
                  // Parse as LOCAL date (not UTC) to avoid timezone shift
                  const [dy, dm, dd] = task.dueDate.split('-').map(Number);
                  const due = new Date(dy, dm - 1, dd);
                  if (isNaN(due.getTime())) return null;
                  const today = new Date(); today.setHours(0,0,0,0);
                  const isOverdue = due < today && !task.done;
                  const isTomorrow = due.getTime() === today.getTime() + 86400000;
                  const isToday = due.getTime() === today.getTime();
                  const label = isToday ? "today" : isTomorrow ? "tomorrow" : due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  const badgeColor = isOverdue
                    ? { bg: "oklch(0.95 0.06 25)", color: "oklch(0.45 0.20 25)", border: "oklch(0.70 0.15 25)" }
                    : isToday
                    ? { bg: "oklch(0.97 0.08 60)", color: "oklch(0.45 0.18 60)", border: "oklch(0.75 0.14 60)" }
                    : { bg: "oklch(0.97 0.04 290)", color: "oklch(0.42 0.10 290)", border: "oklch(0.80 0.08 290)" };
                  return (
                    <span style={{
                      fontSize: "0.58rem", fontFamily: "'Pretendard', system-ui, sans-serif",
                      letterSpacing: "0.06em", padding: "1px 5px", borderRadius: 2,
                      background: badgeColor.bg, color: badgeColor.color,
                      border: `1px solid ${badgeColor.border}`,
                      fontWeight: (isOverdue || isToday) ? 700 : 400,
                    }}>
                      {isOverdue ? "● " : isToday ? "◆ " : "📅 "}{label}
                    </span>
                  );
                })()}
                {task.goalId && (() => {
                  const linkedGoal = goals.find((g) => g.id === task.goalId);
                  return linkedGoal ? (
                    <span style={{
                      display: "block",
                      fontSize: "0.62rem",
                      color: task.done ? M.muted : "oklch(0.40 0.09 145)",
                      fontFamily: "'Pretendard', system-ui, sans-serif",
                      letterSpacing: "0.06em",
                      marginTop: 1,
                    }}>
                      ↳ {linkedGoal.text.length > 30 ? linkedGoal.text.slice(0, 30) + "…" : linkedGoal.text}
                    </span>
                  ) : null;
                })()}

              </div>

              {/* Right side: context badge + edit button + checkbox + delete */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginTop: 2 }}>
                {/* Clickable context badge */}
                <ClickableContextBadge
                  context={task.context}
                  allContexts={allContexts}
                  onChange={(ctx) => onTasksChange(tasks.map(t => t.id === task.id ? { ...t, context: ctx as import("./ContextSwitcher").ItemContext, updatedAt: new Date().toISOString() } : t))}
                />
                {/* Checkbox */}
                <button
                  onClick={() => toggleTask(task.id)}
                  className="flex-shrink-0 transition-all hover:scale-110"
                  style={{ color: task.done ? pcfg.color : "oklch(0.82 0.012 72)" }}
                >
                  {task.done
                    ? <CheckCircle2 className="w-4 h-4" />
                    : <Circle       className="w-4 h-4" />
                  }
                </button>
                {/* Delete */}
                <button
                  onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: M.muted }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>}


    </div>
  );
}
