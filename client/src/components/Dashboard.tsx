/* ============================================================
   ADHD FOCUS SPACE — Editorial Dashboard v6.0
   Layout:
     [TOP]    hero bar: illustration left + greeting/quick-capture/context right
     [MIDDLE] 3-col grid: Focus Timer | Next Up (MIT + cute cards) | AI Command Center
     [BOTTOM] Today's wins/focus strip
   Changes v6:
     - MIT "What should I focus on?" button in task panel
     - Glowing highlight on the MIT task
     - Persistent AI chat history (last 10 msgs) in localStorage
     - Softer, warmer UI palette — no harsh blues/dark boxes
   ============================================================ */

import { useState, useEffect, useRef } from "react";
import { useMobile } from "@/hooks/useMobile";

// ── Inject sticker peel keyframes once ───────────────────────────────────────
const STICKER_STYLE_ID = "adhd-sticker-peel-kf";
const DUMP_FLY_STYLE_ID = "adhd-dump-fly-kf";
if (typeof document !== "undefined" && !document.getElementById(DUMP_FLY_STYLE_ID)) {
  const s = document.createElement("style");
  s.id = DUMP_FLY_STYLE_ID;
  s.textContent = `
    @keyframes dumpFlyArc {
      0%   { transform: translate(0, 0) scale(1) rotate(0deg);   opacity: 1; }
      30%  { transform: translate(calc(var(--fly-dx)*0.3), calc(var(--fly-dy)*0.3 - 40px)) scale(1.3) rotate(-15deg); opacity: 1; }
      70%  { transform: translate(calc(var(--fly-dx)*0.75), calc(var(--fly-dy)*0.75 - 20px)) scale(0.9) rotate(10deg); opacity: 0.85; }
      100% { transform: translate(var(--fly-dx), var(--fly-dy)) scale(0.4) rotate(20deg); opacity: 0; }
    }
    @keyframes dumpNavBounce {
      0%   { transform: scale(1); }
      30%  { transform: scale(1.45); }
      60%  { transform: scale(0.88); }
      80%  { transform: scale(1.18); }
      100% { transform: scale(1); }
    }
    .dump-fly-particle {
      position: fixed;
      pointer-events: none;
      z-index: 9999;
      font-size: 20px;
      line-height: 1;
      animation: dumpFlyArc 0.75s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    }
    .dump-nav-bounce {
      animation: dumpNavBounce 0.5s ease forwards;
    }
  `;
  document.head.appendChild(s);
}
if (typeof document !== "undefined" && !document.getElementById(STICKER_STYLE_ID)) {
  const s = document.createElement("style");
  s.id = STICKER_STYLE_ID;
  s.textContent = `
    @keyframes stickerPeelIn {
      0%   { transform: rotate(0deg) scale(1);    box-shadow: 1px 2px 4px oklch(0.60 0.08 340 / 0.18); }
      100% { transform: rotate(-3deg) scale(1.04); box-shadow: 3px 6px 10px oklch(0.60 0.08 340 / 0.28); }
    }
    @keyframes stickerPeelOut {
      0%   { transform: rotate(-3deg) scale(1.04); box-shadow: 3px 6px 10px oklch(0.60 0.08 340 / 0.28); }
      100% { transform: rotate(0deg) scale(1);    box-shadow: 1px 2px 4px oklch(0.60 0.08 340 / 0.18); }
    }
    @keyframes curlGrow {
      0%   { border-width: 10px 10px 0 0; }
      100% { border-width: 16px 16px 0 0; }
    }
    @keyframes curlShrink {
      0%   { border-width: 16px 16px 0 0; }
      100% { border-width: 10px 10px 0 0; }
    }
    .sticker-hover     { animation: stickerPeelIn  0.22s ease forwards; }
    .sticker-idle      { animation: stickerPeelOut 0.22s ease forwards; }
    .curl-hover        { animation: curlGrow   0.22s ease forwards; }
    .curl-idle         { animation: curlShrink 0.22s ease forwards; }
  `;
  document.head.appendChild(s);
}
import { FocusTimer } from "./FocusTimer";
import { ContextSwitcher, getContextConfig, type ActiveContext } from "./ContextSwitcher";
import type { Task } from "./TaskManager";
import { EisenhowerMatrix, priorityToQuadrant } from "./EisenhowerMatrix";
import type { Win } from "./DailyWins";
import type { Goal } from "./Goals";
import type { Agent } from "./AgentTracker";
import { useTimer } from "@/contexts/TimerContext";
import { Clock, Sparkles, Zap, Bot, Check, Send } from "lucide-react";
import { PixelTrophy } from "@/components/PixelIcons";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { callAI, callAIStream } from "@/lib/ai";
import { buildRoutineContext } from "@/lib/routineContext";

const SUNSET_BLOB = "https://d2xsxph8kpxj0f.cloudfront.net/310519663410012773/WNs8kMVMKanwFbtYhk72en/adhd-sunset-blob_5606b6c8.png";
const PERSON_IMG  = "https://d2xsxph8kpxj0f.cloudfront.net/310519663410012773/WNs8kMVMKanwFbtYhk72en/pink-lofi-illustration_e5665e16.png";
const CAT_BLUE    = "https://d2xsxph8kpxj0f.cloudfront.net/310519663410012773/WNs8kMVMKanwFbtYhk72en/cat1_blue_lying_fbb2632f.png";
const CAT_PINK    = "https://d2xsxph8kpxj0f.cloudfront.net/310519663410012773/WNs8kMVMKanwFbtYhk72en/cat2_pink_standing_a0abaf8f.png";
const CAT_OLIVE   = "https://d2xsxph8kpxj0f.cloudfront.net/310519663410012773/WNs8kMVMKanwFbtYhk72en/cat6_olive_playing_2d875a0d.png";
const CAT_SALMON  = "https://d2xsxph8kpxj0f.cloudfront.net/310519663410012773/WNs8kMVMKanwFbtYhk72en/cat4_salmon_sitting_2fe20a45.png";

const CHAT_HISTORY_KEY = "adhd-ai-chat-history";
const MAX_CHAT_HISTORY = 10;

const CHAT_SUGGESTIONS = [
  "What should I focus on first today?",
  "How are my routines going? Give me a detailed breakdown",
  "Add task: review my emails — urgent",
  "What tasks do I have left?",
  "Mark my most urgent task as done",
  "Help me pick one thing to do next",
  "Set a goal: finish my top priority this week",
];

const MOOD_LABELS = ["Drained", "Low", "Okay", "Good", "Glowing"];
const MOOD_GREETINGS: Record<number, string> = {
  1: "Looks like a low-energy day 🌧 — want me to suggest lighter tasks first, or help you find one small win to start with?",
  2: "Energy's a bit low today — shall I help you pick just one thing to focus on so it doesn't feel overwhelming?",
  3: "Feeling okay today! Want me to help you prioritise your tasks, or is there something specific on your mind?",
  4: "You're in a good headspace today 🌿 — great time to tackle something meaningful. Want me to find your MIT?",
  5: "You're glowing today ✨ — let's make the most of it! Want me to line up your most important tasks?",
};

interface DashboardProps {
  tasks: Task[];
  wins: Win[];
  goals: Goal[];
  agents: Agent[];
  mood: number | null;
  onNavigate: (section: string) => void;
  onQuickDump?: (text: string) => void;
  onSessionComplete: () => void;
  onBlockComplete?: () => void;
  onTaskToggle?: (taskId: string) => void;
  onTasksChange?: (tasks: Task[]) => void;
  onTaskCreate?: (task: Task) => void;
  onGoalCreate?: (goal: Goal) => void;
  onAgentCreate?: (agent: Agent) => void;
  onWinCreate?: (win: Win) => void;
  onDumpCreate?: (text: string) => void;
  blockStreak?: number;
  blockHistory?: Record<string, number>;
  focusSessions?: number;
  allCategories?: string[];
  displayName?: string;
}

const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* ── Dreamy SukiSketch Palette (aligned with index.css CSS vars) ── */
const TC        = "oklch(0.58 0.18 340)";   // hot pink accent
const CREAM     = "oklch(0.970 0.022 355)"; // soft pink card bg
const BORDER    = "oklch(0.78 0.060 340)";  // mauve border
const INK       = "oklch(0.28 0.040 320)";  // dark plum ink
const MUTED     = "oklch(0.52 0.040 330)";  // muted mauve text
// AI panel: soft lavender
const AI_BG     = "oklch(0.960 0.030 290)";  // soft lavender
const AI_BORDER = "oklch(0.78 0.060 290)";   // lavender border
const AI_MSG_BG = "oklch(0.940 0.040 355)";  // bubblegum pink for AI messages
const AI_ACCENT = "oklch(0.58 0.18 340)";    // hot pink for AI header/icons
const TITLEBAR  = "oklch(0.88 0.060 340)";   // pink title bar bg
const TITLEBAR_TEXT = "oklch(0.30 0.060 320)"; // title bar text

function CornerMark() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" style={{ opacity: 0.4 }}>
      <line x1="6" y1="0" x2="6" y2="5" stroke={BORDER} strokeWidth="1" />
      <line x1="7" y1="6" x2="12" y2="6" stroke={BORDER} strokeWidth="1" />
    </svg>
  );
}

/* Priority config — distinct colors per level, sorted urgent → focus → normal → someday */
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, focus: 1, normal: 2, someday: 3 };
const PRIORITY_DOTS: Record<string, { color: string; bg: string; label: string; labelBg: string }> = {
  // Muted ink-stamp palette — desaturated, dusty, lo-fi
  urgent:  { color: "#C0306A", bg: "oklch(0.95 0.040 355)",  label: "urgent",  labelBg: "rgba(192, 48, 106, 0.10)" },
  focus:   { color: "#7A50A0", bg: "oklch(0.95 0.030 290)",  label: "focus",   labelBg: "rgba(122, 80, 160, 0.10)" },
  normal:  { color: "#7A50A0", bg: "oklch(0.95 0.025 290)",  label: "normal",  labelBg: "rgba(122, 80, 160, 0.08)" },
  someday: { color: "#6070A0", bg: "oklch(0.95 0.020 240)",  label: "someday", labelBg: "rgba(96, 112, 160, 0.08)" },
};

type ChatMessage = { role: "user" | "assistant"; content: string };

/* ── AI Command Center Panel ── */

export function Dashboard({
  tasks, wins, goals, agents, mood, blockStreak = 0, focusSessions = 0,
  onNavigate, onSessionComplete, onBlockComplete, allCategories, onQuickDump,
  onTaskToggle, onTaskCreate, onGoalCreate, onAgentCreate, onWinCreate, onTasksChange, onDumpCreate,
  displayName,
}: DashboardProps) {
  const isMobile = useMobile();
  const [activeContext, setActiveContext] = useState<ActiveContext>("all");
  const [nextUpFilter, setNextUpFilter] = useState<"all" | "today">("all");
  const [quickCapture, setQuickCapture] = useState("");
  const [completing, setCompleting] = useState<string | null>(null);
  const dumpInputRef = useRef<HTMLInputElement>(null);

  // ── Flying brain dump animation ──────────────────────────────────────────────
  const fireDumpAnimation = (inputEl: HTMLElement) => {
    const dumpBtn = document.querySelector('[data-nav-id="dump"]') as HTMLElement | null;
    if (!dumpBtn) return;
    const from = inputEl.getBoundingClientRect();
    const to = dumpBtn.getBoundingClientRect();
    const startX = from.left + from.width / 2;
    const startY = from.top + from.height / 2;
    const endX = to.left + to.width / 2;
    const endY = to.top + to.height / 2;
    const dx = endX - startX;
    const dy = endY - startY;
    // Create flying particle
    const particle = document.createElement("div");
    particle.className = "dump-fly-particle";
    particle.textContent = "💭";
    particle.style.left = `${startX - 10}px`;
    particle.style.top = `${startY - 10}px`;
    particle.style.setProperty("--fly-dx", `${dx}px`);
    particle.style.setProperty("--fly-dy", `${dy}px`);
    document.body.appendChild(particle);
    // Bounce the DUMP nav icon when particle arrives
    setTimeout(() => {
      dumpBtn.classList.remove("dump-nav-bounce");
      void dumpBtn.offsetWidth; // force reflow
      dumpBtn.classList.add("dump-nav-bounce");
      setTimeout(() => dumpBtn.classList.remove("dump-nav-bounce"), 500);
    }, 600);
    // Remove particle after animation
    setTimeout(() => particle.remove(), 800);
  };
  const [quadrantMap, setQuadrantMap] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("adhd-quadrant-map") ?? "{}"); } catch { return {}; }
  });
  const handleQuadrantMapChange = (m: Record<string, string>) => {
    setQuadrantMap(m);
    try { localStorage.setItem("adhd-quadrant-map", JSON.stringify(m)); } catch {}
  };

  const [showAI, setShowAI] = useState<boolean>(() => {
    return localStorage.getItem("adhd-dashboard-show-ai") !== "false";
  });
  const toggleAI = () => setShowAI(v => {
    const next = !v;
    localStorage.setItem("adhd-dashboard-show-ai", String(next));
    return next;
  });

  // Listen for AI toggle from header button
  useEffect(() => {
    const handler = () => toggleAI();
    window.addEventListener("toggleDashboardAI", handler);
    return () => window.removeEventListener("toggleDashboardAI", handler);
  }, []);

  // ── AI Chat ──
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    try { return JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) ?? "[]"); } catch { return []; }
  });
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Persist chat history
  useEffect(() => {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatHistory.slice(-MAX_CHAT_HISTORY)));
  }, [chatHistory]);

  // Scroll to bottom when new message arrives
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, chatLoading]);

  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput("");
    const userMsg: ChatMessage = { role: "user", content: msg };
    setChatHistory((prev) => [...prev, userMsg]);
    setChatLoading(true);
    try {
      const n = new Date();
      const localDate = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
      const taskSummary = tasks.map((t) => {
        const linkedGoal = t.goalId ? goals.find(g => g.id === t.goalId) : null;
        return `[id:${t.id}] [${t.priority}] "${t.text}" (${t.done ? "done" : "pending"})${linkedGoal ? ` [linked to goal: "${linkedGoal.text}"]` : ""}`;
      }).join("\n");
      const goalSummary = goals.filter(g => !g.archived).map(g => `[id:${g.id}] "${g.text}" (${g.progress}%)`).join("\n");
      const routineContext = buildRoutineContext();
      const systemPrompt = `You are an ADHD productivity assistant. You act immediately — never ask for confirmation, never ask for a due date.

CRITICAL RULES:
- When the user wants to add or create a task (ANY phrasing: "add X to tasks", "add task X", "create task X", "remind me to X", "put X on my list", "X task", or any similar intent) — IMMEDIATELY output ACTION:create_task. Do NOT say "Would you like to add it?" or "When is it due?". Just create it.
- Due date ALWAYS defaults to "today" (${localDate}) unless the user explicitly says a different date or "tomorrow". NEVER ask for a due date.
- Keep your reply ultra-short — just confirm what you did: "✓ Added!" or "✓ Done!". No follow-up questions.
- Only ask a question if the user's intent is genuinely unclear with no possible action.

Available actions — output on a new line after your reply:
ACTION:{"type":"complete_task","taskId":"id"} — mark a task done
ACTION:{"type":"create_task","text":"task text (no hashtags)","priority":"focus|normal|urgent","context":"work|personal|<any #tag the user specified>","dueDate":"today","goalId":"exact goal id to link, or null"} — add a task. dueDate defaults to "today" unless user specifies otherwise. If user includes #tag, strip it from text and use it as context.
ACTION:{"type":"create_goal","text":"goal text","context":"work|personal"} — add a goal (use when user says "add goal" or "set goal")
ACTION:{"type":"create_dump","text":"idea text"} — dump an idea to Brain Dump (use when user says "dump", "brain dump", "capture idea", "note this")
ACTION:{"type":"none"} — only if truly no action is needed
Today is ${localDate} (${n.toLocaleDateString("en-US",{weekday:"long"})}).

Current tasks:
${taskSummary || "none"}

Current goals:
${goalSummary || "none"}
Mood: ${mood ? ["Drained","Low","Okay","Good","Glowing"][mood - 1] : "unknown"}

${routineContext}`;

      // Add empty assistant message to start streaming into
      setChatHistory((prev) => [...prev, { role: "assistant", content: "" }]);

      let reply = "";
      await callAIStream(
        systemPrompt, msg,
        (delta) => {
          reply += delta;
          setChatHistory((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: reply };
            return updated;
          });
        },
        () => {} // onDone — no-op, we handle via state
      );

      // Parse optional action from reply
      const actionMatch = reply.match(/ACTION:(\{.*\})/);
      let displayReply = reply.replace(/\nACTION:\{.*\}/g, "").trim();

      if (actionMatch) {
        try {
          const action = JSON.parse(actionMatch[1]) as { type: string; taskId?: string; text?: string; priority?: string; context?: string; dueDate?: string; goalId?: string; goalName?: string };
          if (action.type === "complete_task" && action.taskId) {
            const task = tasks.find((t) => t.id === action.taskId);
            if (task && !task.done) {
              onTaskToggle?.(action.taskId);
              displayReply += `\n✓ Marked "${task.text}" as done!`;
            }
          } else if (action.type === "create_task" && action.text) {
            // Strip any #hashtag from text and use as context if context not set
            const hashMatch = action.text.match(/#([\w-]+)/);
            if (hashMatch && (!action.context || action.context === "work" || action.context === "personal")) {
              action.context = hashMatch[1].toLowerCase();
            }
            action.text = action.text.replace(/\s*#[\w-]+/g, "").trim();
            // Resolve "today" / "tomorrow" as actual dates (local)
            const nn = new Date();
            let dueDate = action.dueDate as string | undefined;
            if (dueDate === "null" || dueDate === "undefined") dueDate = undefined;
            const todayStr = `${nn.getFullYear()}-${String(nn.getMonth()+1).padStart(2,'0')}-${String(nn.getDate()).padStart(2,'0')}`;
            if (!dueDate || dueDate === "today") dueDate = todayStr;
            if (dueDate === "tomorrow") { const d = new Date(); d.setDate(d.getDate()+1); dueDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
            // Use direct goalId from AI, or fall back to name match
            let goalId = action.goalId && goals.find(g => g.id === action.goalId) ? action.goalId : undefined;
            if (!goalId && action.goalName) {
              const goalMatch = goals.find(g => g.text.toLowerCase().includes((action.goalName as string).toLowerCase()));
              if (goalMatch) goalId = goalMatch.id;
            }
            const linkedGoal = goalId ? goals.find(g => g.id === goalId) : null;
            onTaskCreate?.({
              id: Math.random().toString(36).slice(2),
              text: action.text,
              priority: (action.priority as Task["priority"]) ?? "normal",
              context: (action.context as Task["context"]) ?? "work",
              done: false,
              createdAt: new Date(),
              dueDate,
              ...(goalId ? { goalId } : {}),
            });
            displayReply += `\n✓ Created task: "${action.text}"${linkedGoal ? ` → linked to goal "${linkedGoal.text}"` : ""}`;
          } else if (action.type === "create_dump" && action.text) {
            onDumpCreate?.(action.text);
            displayReply += `\n✓ Dumped to Brain Dump: "${action.text}"`;
          } else if (action.type === "create_goal" && action.text) {
            onGoalCreate?.({
              id: Math.random().toString(36).slice(2),
              text: action.text,
              progress: 0,
              context: (action.context as Goal["context"]) ?? "personal",
              createdAt: new Date(),
            });
            displayReply += `\n✓ Created goal: "${action.text}"`;
          }
        } catch { /* ignore parse errors */ }
      }

      // Update the last message with the final processed reply (action stripped)
      setChatHistory((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: displayReply };
        return updated;
      });
    } catch (err) {
      const m = err instanceof Error ? err.message : "AI unavailable";
      toast.error(m, { duration: 5000 });
      // Remove both the user message and the empty assistant placeholder
      setChatHistory((prev) => prev.slice(0, -2));
      setChatInput(msg);
    } finally {
      setChatLoading(false);
    }
  };

  // Press / to focus the dashboard dump input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        dumpInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const now = new Date();

  const contextTasks = tasks.filter((t) => activeContext === "all" ? true : t.context === activeContext);
  const activeTasks  = contextTasks.filter((t) => !t.done);
  const todayWins    = wins.filter((w) => new Date(w.createdAt).toDateString() === now.toDateString());

  const allContexts = Array.from(new Set(["work", "personal", ...tasks.map((t) => t.context)]));
  const ctxCounts: Record<string, number> = { all: tasks.filter((t) => !t.done).length };
  allContexts.forEach((ctx) => {
    ctxCounts[ctx] = tasks.filter((t) => !t.done && t.context === ctx).length;
  });

  const handleCheck = (taskId: string) => {
    setCompleting(taskId);
    setTimeout(() => {
      onTaskToggle?.(taskId);
      setCompleting(null);
    }, 350);
  };

  // C key shortcut: focus the AI chat input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        chatInputRef.current?.focus();
        chatInputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div data-tour-id="tour-dashboard" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* ── HERO: just the quick capture input, no window frame ── */}
      <div style={{ padding: isMobile ? "8px 0" : "8px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${BORDER}`, background: "oklch(0.975 0.018 355 / 0.85)", padding: "10px 16px", borderRadius: 10 }}>
          <Zap size={14} style={{ color: TC, flexShrink: 0 }} />
          <input
            ref={dumpInputRef}
            value={quickCapture}
            onChange={(e) => setQuickCapture(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                if (quickCapture.trim()) {
                  const text = quickCapture.trim();
                  setQuickCapture("");
                  fireDumpAnimation(e.target as HTMLInputElement);
                  (e.target as HTMLInputElement).blur();
                  onQuickDump?.(text);
                }
              }
            }}
            placeholder="what's in your mind?"
            autoComplete="new-password"
            style={{ flex: 1, fontSize: 14, background: "transparent", border: "none", outline: "none", color: INK }}
          />
          <span style={{ fontSize: 11, color: MUTED, opacity: 0.65, fontFamily: "'Space Mono', monospace", flexShrink: 0 }}>↵</span>
        </div>
      </div>

      {/* AI toggle handled by GlobalRightPanel's AI button (dispatches toggleDashboardAI) */}

      {/* ── MIDDLE: 3-column grid (single column on mobile) ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr", gap: 10, alignItems: "stretch" }}>

        {/* Col 1: Focus Timer — FocusTimer has its own CYBER_PET.EXE chrome, no outer title bar */}
        <div data-tour-id="tour-focus-timer" style={{ display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
          <div style={{ position: "relative", display: "flex", flexDirection: "column" }}>
            {/* Cat sticker: pink standing cat — top-right of focus timer */}
            <img src={CAT_PINK} alt="" aria-hidden="true" style={{ position: "absolute", top: -8, right: -8, width: 56, opacity: 0.40, pointerEvents: "none", zIndex: 5 }} />
            <FocusTimer onSessionComplete={onSessionComplete} onBlockComplete={onBlockComplete} />
          </div>
        </div>

        {/* Col 2: Next Up task list — taller when AI is hidden */}
        {(true || showAI) && (
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", alignSelf: "start", height: isMobile ? "360px" : "410px", borderRadius: 12, border: `1px solid ${BORDER}`, background: "oklch(0.975 0.018 355 / 0.95)", boxShadow: "0 2px 16px oklch(0.58 0.18 340 / 0.08)" }}>
          {/* macOS title bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "oklch(0.945 0.030 355)", borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 5 }}>
              <div style={{ width: 11, height: 11, borderRadius: "50%", background: "oklch(0.72 0.18 25)" }} />
              <div style={{ width: 11, height: 11, borderRadius: "50%", background: "oklch(0.78 0.14 85)" }} />
              <div style={{ width: 11, height: 11, borderRadius: "50%", background: "oklch(0.72 0.14 160)" }} />
            </div>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "oklch(0.35 0.040 320)", flex: 1, textAlign: "center", marginRight: 36 }}>Next Up</span>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Zap size={12} style={{ color: TC }} />
              <p className="editorial-label">Next Up</p>
            </div>
            {showAI ? (
              <button className="m-btn-link" onClick={() => onNavigate("tasks")}>All tasks</button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {(["today", "all"] as const).map(f => (
                  <button key={f} onClick={() => setNextUpFilter(f)}
                    style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.52rem", letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 3, border: `1px solid ${nextUpFilter === f ? TC : BORDER}`, background: nextUpFilter === f ? TC + "18" : "transparent", color: nextUpFilter === f ? TC : MUTED, cursor: "pointer" }}>
                    {f === "today" ? "Today" : "All Tasks"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Retro task list — dashed-border rows with icon box */}
          {(() => {
            // Use LOCAL date to avoid UTC offset issues
            const n = new Date();
            const todayYMD = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
            const sortFn = (a: typeof activeTasks[0], b: typeof activeTasks[0]) => {
              const aDate = a.dueDate || null;
              const bDate = b.dueDate || null;
              const aOverdue = aDate && aDate < todayYMD;
              const bOverdue = bDate && bDate < todayYMD;
              const aToday  = aDate === todayYMD;
              const bToday  = bDate === todayYMD;
              // no-date treated same as today (bucket 1)
              const bucket = (d: string | null, ovr: boolean | string, tdy: boolean) =>
                ovr ? 0 : tdy ? 1 : d ? 2 : 1;
              const aBucket = bucket(aDate, aOverdue, aToday);
              const bBucket = bucket(bDate, bOverdue, bToday);
              if (aBucket !== bBucket) return aBucket - bBucket;
              // Within same bucket:
              const pDiff = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
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
            };
            // Sort FIRST, then filter/slice
            const sorted = [...activeTasks].sort(sortFn);
            const filtered = showAI
              ? sorted
              : nextUpFilter === "today"
                ? sorted.filter(t => !t.dueDate || t.dueDate === todayYMD)
                : sorted;
            const displayTasks = showAI ? filtered.slice(0, 7) : filtered;
            return (
          <div className="retro-task-list" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {displayTasks.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, textAlign: "center" }}>
                <svg width="32" height="32" viewBox="0 0 40 40" style={{ opacity: 0.15 }}>
                  <rect x="6" y="6" width="28" height="28" rx="2" fill="none" stroke={INK} strokeWidth="1.5" />
                  <line x1="14" y1="20" x2="26" y2="20" stroke={INK} strokeWidth="1" />
                  <line x1="20" y1="14" x2="20" y2="26" stroke={INK} strokeWidth="1" />
                </svg>
                <button className="m-btn-primary" onClick={() => onNavigate("tasks")}>Add a task</button>
              </div>
            ) : (
              displayTasks // already sorted above
                .map((t) => {
                  const pd = PRIORITY_DOTS[t.priority] ?? PRIORITY_DOTS.normal;
                  const ctxColor = getContextConfig(t.context).color;
                  const isCompleting = completing === t.id;
                  const cleanText = t.text.replace(/(?:^|\s)#[a-zA-Z0-9\u4e00-\u9fa5_-]+/g, " ").replace(/\s{2,}/g, " ").trim() || t.text;
                  return (
                    <div
                      key={t.id}
                      className={`retro-task-row ${t.priority}`}
                      style={{
                        opacity: isCompleting ? 0.5 : 1,
                        transition: "all 0.3s ease",
                        padding: "6px 8px",
                      }}
                    >
                      {/* Task text */}
                      <p style={{
                        fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        color: isCompleting ? MUTED : INK,
                        textDecoration: isCompleting ? "line-through" : "none",
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 500,
                      }}>
                        {cleanText}
                      </p>

                      {/* Due date — only in bigger view (AI off) */}
                      {!showAI && !isCompleting && t.dueDate && t.dueDate !== "null" && t.dueDate.includes('-') && (() => {
                        const d = new Date(t.dueDate + "T00:00:00");
                        if (isNaN(d.getTime())) return null;
                        const isOverdue = t.dueDate < todayYMD;
                        const isToday = t.dueDate === todayYMD;
                        const label = isToday ? "Today" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                        return (
                          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.48rem", letterSpacing: "0.04em", color: isOverdue ? "#c0306a" : isToday ? "#7a50a0" : MUTED, flexShrink: 0, padding: "1px 4px", borderRadius: 2, background: isOverdue ? "rgba(192,48,106,0.10)" : isToday ? "rgba(122,80,160,0.10)" : "transparent" }}>
                            {label}
                          </span>
                        );
                      })()}

                      {/* Priority stamp tag */}
                      {!isCompleting && (
                        <span style={{
                          fontFamily: "'Space Mono', monospace",
                          fontSize: "0.52rem",
                          fontWeight: 700,
                          letterSpacing: "0.07em",
                          textTransform: "uppercase",
                          color: pd.color,
                          border: `1.5px solid ${pd.color}55`,
                          borderRadius: 2,
                          padding: "1px 4px",
                          background: pd.labelBg,
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                        }}>
                          {pd.label}
                        </span>
                      )}

                      {/* Checkbox */}
                      <button
                        onClick={() => handleCheck(t.id)}
                        title="Mark done"
                        style={{
                          width: 18, height: 18, flexShrink: 0, borderRadius: 3,
                          border: `2px solid ${isCompleting ? "oklch(0.60 0.08 290)" : "oklch(0.88 0.018 355)"}`,
                          background: isCompleting ? "oklch(0.60 0.08 290 / 0.15)" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.2s",
                        }}
                      >
                        {isCompleting && <Check size={10} style={{ color: "oklch(0.60 0.08 290)" }} />}
                      </button>
                    </div>
                  );
                })
            )}
            {showAI && filtered.length > 7 && (
              <button onClick={() => onNavigate("tasks")} className="m-btn-link"
                style={{ fontSize: 9, textAlign: "center", paddingTop: 4, width: "100%", justifyContent: "center" }}>
                +{filtered.length - 7} more →
              </button>
            )}
          </div>
          ); })()}
          </div>{/* /inner padding div */}
        </div>)}{/* /retro-window Col 2 */}

      </div>{/* /grid */}

      {/* ── BOTTOM: Today's wins + focus strip ── */}
      {(todayWins.length > 0 || focusSessions > 0) && (
        <div style={{ position: "relative", border: `1px solid oklch(0.65 0.12 340 / 0.3)`, background: "oklch(0.65 0.12 340 / 0.04)", padding: "7px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", borderRadius: 8 }}>
          {/* Cat sticker: olive playing cat — right side of wins strip */}
          <img src={CAT_OLIVE} alt="" aria-hidden="true" style={{ position: "absolute", right: 8, bottom: -22, width: 60, opacity: 0.42, pointerEvents: "none", zIndex: 5 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <Sparkles size={11} style={{ color: TC }} />
            <p className="editorial-label" style={{ fontSize: 9 }}>Today{todayWins.length > 0 ? ` · ${todayWins.length} win${todayWins.length > 1 ? "s" : ""}` : ""}</p>
          </div>
          {focusSessions > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "oklch(0.52 0.18 340 / 0.08)", border: "1px solid oklch(0.52 0.18 340 / 0.25)", borderRadius: 20, color: "oklch(0.42 0.14 340)", fontSize: 10, fontWeight: 600, fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em", padding: "2px 9px" }}>
              ⏱ {focusSessions} session{focusSessions > 1 ? "s" : ""}
            </div>
          )}
          {todayWins.map((w) => {
            const isRoutine = w.id.startsWith("routine-");
            return (
              <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 9px", border: `1px solid ${BORDER}`, background: CREAM, color: INK, fontSize: 11, borderRadius: 6 }}>
                {isRoutine ? <span style={{ fontSize: 11, lineHeight: 1 }}>💫</span> : <PixelTrophy size={10} color={TC} />}
                <span>{isRoutine ? w.text.replace(/^[\p{Emoji}\s]+/u, "").trim() || w.text : w.text}</span>
              </div>
            );
          })}
          <button className="m-btn-link" style={{ marginLeft: "auto", fontSize: 10 }} onClick={() => onNavigate("wins")}>Log more</button>
        </div>
      )}
    </div>
  );
}
