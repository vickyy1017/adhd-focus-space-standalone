/* ============================================================
   ADHD FOCUS SPACE — Eisenhower Matrix v2.0 (Retro Lo-fi)
   Design: thick offset borders, parchment quads, Space Mono
   stamps, ruled notebook lines, warm muted palette.
   ============================================================ */

import { useState, useRef, useEffect, useCallback } from "react";
import type { Task, TaskPriority } from "./TaskManager";

// ── Quadrant definitions ──────────────────────────────────────────────────────
export type QuadrantId = "q1" | "q2" | "q3" | "q4";

interface QuadrantDef {
  id: QuadrantId;
  label: string;
  sub: string;
  action: string;
  priority: TaskPriority;
  urgent: boolean;
  important: boolean;
  color: string;
  bg: string;
  border: string;
  shadow: string;
  numeral: string;
  ruledColor: string;
}

const QUADRANTS: QuadrantDef[] = [
  {
    id: "q1",
    label: "Do Now",
    sub: "Urgent · Important",
    action: "DO NOW",
    priority: "urgent",
    urgent: true,
    important: true,
    color:      "oklch(0.12 0.01 20)",   // near-black
    bg:         "oklch(1 0 0)",           // white
    border:     "oklch(0.88 0.005 20)",   // hairline
    shadow:     "oklch(0.88 0.005 20)",
    numeral:    "I",
    ruledColor: "oklch(0.93 0.003 20)",   // very subtle ruled lines
  },
  {
    id: "q2",
    label: "Schedule",
    sub: "Not Urgent · Important",
    action: "SCHEDULE",
    priority: "focus",
    urgent: false,
    important: true,
    color:      "oklch(0.12 0.01 20)",
    bg:         "oklch(1 0 0)",
    border:     "oklch(0.88 0.005 20)",
    shadow:     "oklch(0.88 0.005 20)",
    numeral:    "II",
    ruledColor: "oklch(0.93 0.003 20)",
  },
  {
    id: "q3",
    label: "Delegate",
    sub: "Urgent · Not Important",
    action: "DELEGATE",
    priority: "normal",
    urgent: true,
    important: false,
    color:      "oklch(0.52 0.01 20)",   // muted
    bg:         "oklch(0.98 0.001 20)",   // very light grey
    border:     "oklch(0.88 0.005 20)",
    shadow:     "oklch(0.88 0.005 20)",
    numeral:    "III",
    ruledColor: "oklch(0.93 0.003 20)",
  },
  {
    id: "q4",
    label: "Eliminate",
    sub: "Not Urgent · Not Important",
    action: "ELIMINATE",
    priority: "normal",
    urgent: false,
    important: false,
    color:      "oklch(0.52 0.01 20)",
    bg:         "oklch(0.98 0.001 20)",
    border:     "oklch(0.88 0.005 20)",
    shadow:     "oklch(0.88 0.005 20)",
    numeral:    "IV",
    ruledColor: "oklch(0.93 0.003 20)",
  },
];

// Map priority → default quadrant when a task is first placed
export function priorityToQuadrant(p: TaskPriority): QuadrantId {
  if (p === "urgent") return "q1";
  if (p === "focus")  return "q2";
  return "q4";
}

// Map quadrant → priority
function quadrantToPriority(q: QuadrantId): TaskPriority {
  const def = QUADRANTS.find((d) => d.id === q)!;
  return def.priority;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface EisenhowerMatrixProps {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  quadrantMap: Record<string, QuadrantId>;
  onQuadrantMapChange: (map: Record<string, QuadrantId>) => void;
  hideHeader?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function EisenhowerMatrix({
  tasks,
  onTasksChange,
  quadrantMap,
  onQuadrantMapChange,
  hideHeader = false,
}: EisenhowerMatrixProps) {
  const [dragOverQ, setDragOverQ] = useState<QuadrantId | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dragOverPos, setDragOverPos] = useState<"before" | "after">("after");
  const [taskOrder, setTaskOrder] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem("adhd-quadrant-task-order") ?? "{}"); } catch { return {}; }
  });

  // Persist taskOrder to localStorage whenever it changes
  useEffect(() => {
    try { localStorage.setItem("adhd-quadrant-task-order", JSON.stringify(taskOrder)); } catch {}
  }, [taskOrder]);
  const draggingId = useRef<string | null>(null);
  const touchDragId = useRef<string | null>(null);
  const touchGhost = useRef<HTMLDivElement | null>(null);

  // Touch drag support for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent, taskId: string) => {
    touchDragId.current = taskId;
    draggingId.current = taskId;
    // Create ghost element
    const target = e.currentTarget as HTMLElement;
    const ghost = target.cloneNode(true) as HTMLDivElement;
    ghost.style.position = "fixed";
    ghost.style.pointerEvents = "none";
    ghost.style.opacity = "0.7";
    ghost.style.zIndex = "9999";
    ghost.style.width = target.offsetWidth + "px";
    ghost.style.transform = "scale(1.05)";
    ghost.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
    document.body.appendChild(ghost);
    touchGhost.current = ghost;
    target.style.opacity = "0.4";
    const touch = e.touches[0];
    ghost.style.left = (touch.clientX - target.offsetWidth / 2) + "px";
    ghost.style.top = (touch.clientY - 20) + "px";
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchDragId.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (touchGhost.current) {
      touchGhost.current.style.left = (touch.clientX - 60) + "px";
      touchGhost.current.style.top = (touch.clientY - 20) + "px";
    }
    // Find which quadrant we're over
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const quadrantEl = el?.closest("[data-quadrant-id]");
    if (quadrantEl) {
      const qId = quadrantEl.getAttribute("data-quadrant-id") as QuadrantId;
      setDragOverQ(qId);
    } else {
      setDragOverQ(null);
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent, sourceTaskId: string) => {
    const touch = e.changedTouches[0];
    // Clean up ghost
    if (touchGhost.current) {
      document.body.removeChild(touchGhost.current);
      touchGhost.current = null;
    }
    // Restore opacity
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = "1";
    // Find drop target
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const quadrantEl = el?.closest("[data-quadrant-id]");
    if (quadrantEl) {
      const qId = quadrantEl.getAttribute("data-quadrant-id") as QuadrantId;
      const newMap = { ...quadrantMap, [sourceTaskId]: qId };
      onQuadrantMapChange(newMap);
      const newPriority = quadrantToPriority(qId);
      const updated = tasks.map((t) =>
        t.id === sourceTaskId ? { ...t, priority: newPriority, updatedAt: new Date().toISOString() } : t
      );
      onTasksChange(updated);
    }
    touchDragId.current = null;
    draggingId.current = null;
    setDragOverQ(null);
    setDragOverTaskId(null);
  }, [quadrantMap, tasks, onQuadrantMapChange, onTasksChange]);

  const activeTasks = tasks.filter((t) => !t.done);

  function getTaskQuadrant(task: Task): QuadrantId {
    return quadrantMap[task.id] ?? priorityToQuadrant(task.priority);
  }

  function handleDragStart(e: React.DragEvent, taskId: string) {
    draggingId.current = taskId;
    e.dataTransfer.effectAllowed = "move";
    (e.currentTarget as HTMLElement).style.opacity = "0.40";
  }

  function handleDragEnd(e: React.DragEvent) {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    draggingId.current = null;
    setDragOverQ(null);
    setDragOverTaskId(null);
  }

  function handleDragOver(e: React.DragEvent, qId: QuadrantId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverQ(qId);
  }

  function handleDrop(e: React.DragEvent, qId: QuadrantId) {
    e.preventDefault();
    const id = draggingId.current;
    if (!id) return;
    const newMap = { ...quadrantMap, [id]: qId };
    onQuadrantMapChange(newMap);
    const newPriority = quadrantToPriority(qId);
    const updated = tasks.map((t) =>
      t.id === id ? { ...t, priority: newPriority, updatedAt: new Date().toISOString() } : t
    );
    onTasksChange(updated);
    setDragOverQ(null);
  }

  function handleDragOverTask(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setDragOverTaskId(targetId);
    setDragOverPos(pos);
  }

  function handleDropOnTask(e: React.DragEvent, targetId: string, qId: QuadrantId) {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = draggingId.current;
    if (!draggedId || draggedId === targetId) { setDragOverTaskId(null); return; }

    // If moving to a different quadrant, also update the quadrant map
    const draggedQ = getTaskQuadrant(tasks.find(t => t.id === draggedId)!);
    if (draggedQ !== qId) {
      const newMap = { ...quadrantMap, [draggedId]: qId };
      onQuadrantMapChange(newMap);
      const newPriority = quadrantToPriority(qId);
      onTasksChange(tasks.map(t => t.id === draggedId ? { ...t, priority: newPriority, updatedAt: new Date().toISOString() } : t));
    }

    // Reorder within the quadrant
    const qTaskIds = activeTasks
      .filter(t => (quadrantMap[t.id] ?? priorityToQuadrant(t.priority)) === qId || t.id === draggedId)
      .sort((a, b) => (taskOrder[a.id] ?? 0) - (taskOrder[b.id] ?? 0))
      .map(t => t.id)
      .filter(id => id !== draggedId);

    const targetIdx = qTaskIds.indexOf(targetId);
    const insertIdx = dragOverPos === "before" ? targetIdx : targetIdx + 1;
    qTaskIds.splice(insertIdx, 0, draggedId);

    const newOrder = { ...taskOrder };
    qTaskIds.forEach((id, i) => { newOrder[id] = i; });
    setTaskOrder(newOrder);
    setDragOverTaskId(null);
    setDragOverQ(null);
  }

  return (
    <div style={{ marginTop: 0 }}>
      {/* ── Grid only ── */}
      <div style={{ position: "relative", padding: 0 }}>
        {/* Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 6,
          minHeight: 480,
        }}>
          {QUADRANTS.map((q) => {
            const qTasks = activeTasks
              .filter((t) => getTaskQuadrant(t) === q.id)
              .sort((a, b) => (taskOrder[a.id] ?? 0) - (taskOrder[b.id] ?? 0));
            const isOver = dragOverQ === q.id;

            return (
              <div
                key={q.id}
                data-quadrant-id={q.id}
                onDragOver={(e) => handleDragOver(e, q.id)}
                onDragLeave={() => setDragOverQ(null)}
                onDrop={(e) => handleDrop(e, q.id)}
                style={{
                  background: q.bg,
                  border: isOver ? `2px dashed oklch(0.12 0.01 20)` : `1px solid ${q.border}`,
                  borderRadius: 16,
                  boxShadow: isOver ? "0 0 0 3px oklch(0.12 0.01 20 / 0.1)" : "none",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  transition: "box-shadow 0.12s, border-color 0.12s",
                  minHeight: 190,
                  position: "relative",
                }}
              >
                {/* Ruled notebook lines (decorative) */}
                <div style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  backgroundImage: `repeating-linear-gradient(
                    to bottom,
                    transparent,
                    transparent 19px,
                    ${q.ruledColor} 19px,
                    ${q.ruledColor} 20px
                  )`,
                  backgroundPositionY: "38px",
                  zIndex: 0,
                }} />

                {/* Quadrant header — Nori style */}
                <div style={{
                  padding: "10px 12px 8px",
                  borderBottom: `1px solid ${q.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                  position: "relative",
                  zIndex: 1,
                  background: "oklch(0.96 0.002 20)",
                }}>
                  <div>
                    <div style={{
                      fontFamily: "'Pretendard', system-ui, sans-serif",
                      fontSize: 13,
                      fontWeight: 900,
                      color: q.color,
                    }}>
                      {q.label}
                    </div>
                    <div style={{
                      fontFamily: "'Pretendard', system-ui, sans-serif",
                      fontSize: 9,
                      color: "oklch(0.60 0.005 20)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginTop: 1,
                    }}>
                      {q.sub}
                    </div>
                  </div>
                </div>

                {/* Task cards */}
                <div style={{
                  flex: 1,
                  padding: "7px 7px 5px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  overflowY: "auto",
                  position: "relative",
                  zIndex: 1,
                }}>
                  {qTasks.length === 0 && (
                    <div style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "'Space Mono', monospace",
                      fontSize: 9,
                      color: "oklch(0.72 0.014 75)",
                      letterSpacing: "0.04em",
                      fontStyle: "italic",
                      opacity: isOver ? 0.9 : 0.45,
                      padding: "12px 0",
                    }}>
                      {isOver ? "drop here" : "drag tasks here"}
                    </div>
                  )}
                  {qTasks.map((task) => (
                    <TaskChip
                      key={task.id}
                      task={task}
                      quadrantColor={q.color}
                      quadrantBorder={q.border}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOverTask(e, task.id)}
                      onDragLeave={() => setDragOverTaskId(null)}
                      onDrop={(e) => handleDropOnTask(e, task.id, q.id)}
                      isDragOver={dragOverTaskId === task.id}
                      dragOverPos={dragOverPos}
                      onTouchStart={(e) => handleTouchStart(e, task.id)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={(e) => handleTouchEnd(e, task.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Task chip inside quadrant ─────────────────────────────────────────────────
function TaskChip({
  task,
  quadrantColor,
  quadrantBorder,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragOver = false,
  dragOverPos = "after",
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: {
  task: Task;
  quadrantColor: string;
  quadrantBorder: string;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragOver?: boolean;
  dragOverPos?: "before" | "after";
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      {isDragOver && dragOverPos === "before" && (
        <div style={{ height: 2, background: "oklch(0.55 0.18 340)", borderRadius: 1, marginBottom: 2 }} />
      )}
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      title={task.text}
      style={{
        background: "oklch(1 0 0 / 0.80)",
        border: `1.5px solid ${quadrantBorder}`,
        borderLeft: `3px solid ${quadrantColor}`,
        borderRadius: 2,
        padding: "4px 8px",
        cursor: "grab",
        display: "flex",
        alignItems: "center",
        gap: 6,
        transition: "box-shadow 0.10s, transform 0.10s",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "none",
        boxShadow: `2px 2px 0 ${quadrantColor}22`,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = `3px 3px 0 ${quadrantColor}40`;
        el.style.transform = "translate(-1px,-1px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = `2px 2px 0 ${quadrantColor}22`;
        el.style.transform = "none";
      }}
    >
      {/* Drag handle — 2×3 dot grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 2,
        flexShrink: 0,
        opacity: 0.28,
      }}>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{
            width: 2,
            height: 2,
            borderRadius: "50%",
            background: quadrantColor,
          }} />
        ))}
      </div>

      <span style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 11,
        color: "oklch(0.30 0.018 65)",
        lineHeight: 1.35,
        flex: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {task.text}
      </span>

      {/* Context dot */}
      <div style={{
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: quadrantColor,
        opacity: 0.50,
        flexShrink: 0,
      }} />
    </div>
      {isDragOver && dragOverPos === "after" && (
        <div style={{ height: 2, background: "oklch(0.55 0.18 340)", borderRadius: 1, marginTop: 2 }} />
      )}
    </div>
  );
}
