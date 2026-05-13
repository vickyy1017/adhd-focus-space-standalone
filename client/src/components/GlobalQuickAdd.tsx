/* ============================================================
   ADHD FOCUS SPACE — Global Quick Add v6.0
   Configurable quick-reply chips, persisted to DB via tRPC
   ============================================================ */

import { useEffect, useRef, useState, useCallback } from "react";
import { Flame, Loader2, Mic, MicOff, Plus, RotateCcw, Send, Sparkles, Star, Trash2, X, Zap } from "lucide-react";
import { callAI, callAIStream } from "@/lib/ai";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useMobile } from "@/hooks/useMobile";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import type { Task } from "./TaskManager";

const M = {
  coral:    "oklch(0.82 0.08 10)",      // soft rose (Nori accent)
  coralBg:  "oklch(0.97 0.02 10)",      // rose tint
  coralBdr: "oklch(0.88 0.05 10)",      // rose border
  ink:      "oklch(0.12 0.01 20)",      // near-black
  muted:    "oklch(0.52 0.01 20)",      // muted text
  border:   "oklch(0.88 0.005 20)",     // hairline
  card:     "oklch(1 0 0)",             // pure white
};

const PRIORITY_CFG = {
  urgent: { label: "Urgent", Icon: Flame, color: "oklch(0.55 0.09 35)",  bg: "oklch(0.55 0.09 35 / 0.08)",  border: "oklch(0.55 0.09 35 / 0.28)" },
  focus:  { label: "Focus",  Icon: Zap,   color: "oklch(0.52 0.14 290)", bg: "oklch(0.52 0.14 290 / 0.08)", border: "oklch(0.52 0.14 290 / 0.28)" },
  normal: { label: "Normal", Icon: Star,  color: "oklch(0.55 0.10 330)", bg: "oklch(0.72 0.10 330 / 0.10)", border: "oklch(0.72 0.10 330 / 0.30)" },
} as const;

type Priority = "urgent" | "focus" | "normal";

const DEFAULT_CHIPS = [
  "Reply message from Sarah",
  "Reply email from manager",
  "Book appointment with doctor",
  "Book meeting with team",
  "Review pull request from Alex",
  "Send invoice to client",
];

interface GlobalQuickAddProps {
  onAddTask: (task: Task) => void;
  onAddGoal?: (text: string, context?: string) => void;
  onAddWin?: (text: string, iconIdx?: number) => void;
  onAddDump?: (text: string) => void;
  tasks?: Task[];
}

/* ── Mobile-aware floating trigger ── */
function MobileAwareQuickAddTrigger({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  const isMobile = useMobile();
  return (
    <div
      data-tour-id="tour-quick-add"
      style={{
        position: "fixed",
        bottom: isMobile
          ? "calc(68px + env(safe-area-inset-bottom, 0px))"
          : "24px",
        right: "24px",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        opacity: open ? 0 : 1,
        pointerEvents: open ? "none" : "auto",
        transition: "opacity 0.15s",
      }}
    >
      <button
        onClick={onOpen}
        title="AI Assistant (+)"
        style={{
          width: 52,
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "oklch(0.12 0.01 20)",
          border: "none",
          borderRadius: "50%",
          cursor: "pointer",
          boxShadow: "0 4px 16px oklch(0.12 0.01 20 / 0.25)",
          transition: "transform 0.15s, opacity 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.05)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
      >
        <Plus style={{ width: 22, height: 22, color: "oklch(1 0 0)" }} />
      </button>
    </div>
  );
}

export function GlobalQuickAdd({ onAddTask, onAddGoal, onAddWin, onAddDump, tasks = [] }: GlobalQuickAddProps) {
  const [open, setOpen]           = useState(false);
  const [configMode, setConfigMode] = useState(false);
  const [text, setText]           = useState("");
  const [aiMode, setAiMode] = useState(true); // default to AI mode
  const [aiGenerating, setAiGenerating] = useState(false);

  // Chat history
  type ChatMsg = { role: "user" | "assistant"; content: string };
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [dueDate, setDueDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [priority, setPriority]   = useState<Priority>("focus");
  const [newChip, setNewChip]     = useState("");
  const inputRef    = useRef<HTMLInputElement>(null);
  const newChipRef  = useRef<HTMLInputElement>(null);

  // ── localStorage chips ─────────────────────────────────────────────────────
  const [customChips, setCustomChips] = useLocalStorage<string[]>("adhd-quick-chips", []);

  const createChip = {
    mutate: ({ text }: { text: string }) => setCustomChips((prev) => [...prev, text]),
    isPending: false,
  };
  const deleteChip = {
    mutate: ({ text }: { text: string }) => setCustomChips((prev) => prev.filter((c) => c !== text)),
    isPending: false,
  };

  // Use custom chips if any, otherwise use defaults
  const chips: string[] = customChips.length > 0 ? customChips : DEFAULT_CHIPS;

  // ── Tour: open/close modal on events ─────────────────────────────────────────
  useEffect(() => {
    const openHandler = () => setOpen(true);
    const closeHandler = () => { setOpen(false); setConfigMode(false); };
    window.addEventListener("tour-open-quickadd", openHandler);
    window.addEventListener("tour-close-quickadd", closeHandler);
    return () => {
      window.removeEventListener("tour-open-quickadd", openHandler);
      window.removeEventListener("tour-close-quickadd", closeHandler);
    };
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen((v) => !v); }
      if (e.key === "Escape") { setOpen(false); setConfigMode(false); }
      if (e.key === "+") {
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA" && !(e.target as HTMLElement).isContentEditable) {
          e.preventDefault();
          setOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open && !configMode) setTimeout(() => inputRef.current?.focus(), 80);
    if (configMode) setTimeout(() => newChipRef.current?.focus(), 80);
  }, [open, configMode]);

  // ── Submit task ───────────────────────────────────────────────────────────
  // ── Voice recording ─────────────────────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { toast.error("Voice input not supported in this browser."); return; }
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    let transcriptResult = "";
    recognition.onresult = (e: any) => {
      transcriptResult = e.results[0][0].transcript;
      setText(transcriptResult);
    };
    recognition.onerror = () => { setIsRecording(false); };
    recognition.onend = () => {
      setIsRecording(false);
      // Auto-send after voice recognition ends
      if (transcriptResult.trim()) {
        // Use a small delay to let state update
        setTimeout(() => {
          if (transcriptResult.trim()) {
            handleChatSendWithText(transcriptResult.trim());
          }
        }, 100);
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [isRecording]);

  // ── Chat-based AI send ────────────────────────────────────────────────────────
  const handleChatSendWithText = async (inputText: string) => {
    if (!inputText.trim() || aiGenerating) return;
    const userMsg = inputText.trim();
    setText("");
    const newHistory = [...chatHistory, { role: "user" as const, content: userMsg }];
    setChatHistory(newHistory);
    setAiGenerating(true);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
      const taskList = tasks.map((t: any) => `- [${t.done ? 'x' : ' '}] ${t.text} (${t.priority}${t.dueDate ? ', due ' + t.dueDate : ''})`).join('\n') || 'No tasks yet.';
      const systemPrompt = `You are a powerful ADHD focus assistant. Today is ${today} (${todayName}).\n\nUser's current tasks:\n${taskList}\n\nYou can:\n1. PRIORITIZE: Analyze tasks and tell the user what to focus on first\n2. PLAN: Help structure their day\n3. ADD TASKS: respond with JSON: {"action":"task","text":"...","priority":"urgent|focus|normal","dueDate":"YYYY-MM-DD or null"}\n4. BRAIN DUMP: respond with JSON: {"action":"dump","text":"..."}\n\nBe warm, direct, and ADHD-friendly.`;
      const result = await callAI(systemPrompt, newHistory.map(m => `${m.role}: ${m.content}`).join("\n"));
      const jsonMatch = result.match(/\{[\s\S]*"action"[\s\S]*\}/);
      let displayResult = result;
      if (jsonMatch) {
        try {
          const action = JSON.parse(jsonMatch[0]);
          displayResult = result.replace(jsonMatch[0], "").trim();
          if (action.action === "task") {
            onAddTask({ id: nanoid(), text: action.text, priority: action.priority ?? "focus", context: "personal", done: false, createdAt: new Date(), dueDate: action.dueDate ?? today });
            displayResult = displayResult || `✓ Task created: "${action.text}"`;
          } else if (action.action === "dump" && onAddDump) {
            onAddDump(action.text);
            displayResult = displayResult || `💭 Added to Brain Dump: "${action.text}"`;
          }
        } catch { }
      }
      setChatHistory(prev => [...prev, { role: "assistant", content: displayResult || result }]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI unavailable";
      setChatHistory(prev => [...prev, { role: "assistant", content: `Sorry, ${msg}` }]);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleChatSend = async () => {
    if (!text.trim() || aiGenerating) return;
    const userMsg = text.trim();
    setText("");
    const newHistory = [...chatHistory, { role: "user" as const, content: userMsg }];
    setChatHistory(newHistory);
    setAiGenerating(true);
    // Scroll to bottom
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
      const taskList = tasks.map((t: any) => `- [${t.done ? 'x' : ' '}] ${t.text} (${t.priority}${t.dueDate ? ', due ' + t.dueDate : ''})`).join('\n') || 'No tasks yet.';
      const systemPrompt = `You are a powerful ADHD focus assistant. Today is ${today} (${todayName}).

User's current tasks:
${taskList}

You can:
1. PRIORITIZE: Analyze tasks and tell the user what to focus on first, using urgency/importance reasoning
2. PLAN: Help structure their day, break down big tasks, suggest time blocks
3. ADD TASKS: When user wants to add a task, respond with JSON: {"action":"task","text":"...","priority":"urgent|focus|normal","dueDate":"YYYY-MM-DD or null"}
4. BRAIN DUMP: When user wants to capture a thought/idea, respond with JSON: {"action":"dump","text":"..."}
5. THINK TOGETHER: Help with decisions, overwhelm, procrastination, focus strategies
6. MULTIPLE TASKS: You can create multiple tasks by including multiple JSON objects

Be warm, direct, and ADHD-friendly. Avoid long lists. Give clear, actionable advice. When prioritizing, pick ONE thing to do first and explain why briefly.`;
      const messages = newHistory.map(m => ({ role: m.role, content: m.content }));
      const result = await callAI(systemPrompt, messages.map(m => `${m.role}: ${m.content}`).join("\n"));
      // Check for action JSON
      const jsonMatch = result.match(/\{[\s\S]*"action"[\s\S]*\}/);
      let displayResult = result;
      if (jsonMatch) {
        try {
          const action = JSON.parse(jsonMatch[0]);
          displayResult = result.replace(jsonMatch[0], "").trim();
          if (action.action === "task") {
            onAddTask({ id: nanoid(), text: action.text, priority: action.priority ?? "focus", context: "personal", done: false, createdAt: new Date(), dueDate: action.dueDate ?? today });
            displayResult = (displayResult || `✓ Task created: "${action.text}"`);
          } else if (action.action === "dump" && onAddDump) {
            onAddDump(action.text);
            displayResult = (displayResult || `💭 Added to Brain Dump: "${action.text}"`);
          }
        } catch { /* keep original result */ }
      }
      setChatHistory(prev => [...prev, { role: "assistant", content: displayResult || result }]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI unavailable";
      setChatHistory(prev => [...prev, { role: "assistant", content: `Sorry, ${msg}` }]);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAiCreate = async () => {
    if (!text.trim()) return;
    setAiGenerating(true);
    try {
      const today = new Date().toISOString().slice(0,10);
      const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });

      const result = await callAI(
        `Parse this capture request and return ONLY valid JSON:
{"type":"task|win|dump","text":"clean content","priority":"urgent|focus|normal","context":"work|personal","dueDate":"YYYY-MM-DD or today or tomorrow or null"}
type: "task" for actionable tasks, "win" for accomplishments to celebrate, "dump" for random thoughts/ideas.
Today is ${today} (${todayName}).`,
        text.trim()
      );
      const match = result.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as { type?: string; text?: string; priority?: string; context?: string; dueDate?: string };
        const cleanText = parsed.text?.trim() || text.trim();
        const type = parsed.type ?? "task";

        if (type === "win" && onAddWin) {
          onAddWin(cleanText, parsed.context === "work" ? 2 : parsed.context === "personal" ? 5 : 4);
          toast.success(`🏆 Win logged: ${cleanText}`);
        } else if (type === "dump" && onAddDump) {
          onAddDump(cleanText);
          toast.success(`💭 Added to Brain Dump`);
        } else {
          // Default: create task
          const taskPriority = (["urgent","focus","normal"].includes(parsed.priority ?? "") ? parsed.priority : "focus") as Priority;
          const taskContext = (["work","personal"].includes(parsed.context ?? "") ? parsed.context : "personal") as "work" | "personal";
          let taskDue = parsed.dueDate ?? null;
          if (taskDue === "null" || taskDue === "undefined") taskDue = null;
          if (!taskDue || taskDue === "today") taskDue = today;
          if (taskDue === "tomorrow") { const d = new Date(); d.setDate(d.getDate()+1); taskDue = d.toISOString().slice(0,10); }
          onAddTask({ id: nanoid(), text: cleanText, priority: taskPriority, context: taskContext, done: false, createdAt: new Date(), dueDate: taskDue ?? today });
          toast.success(`✓ Task: ${cleanText} · ${taskPriority}`);
        }
        setText(""); setAiMode(false); setOpen(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg !== "no-key" && msg !== "invalid-key") toast.error("AI unavailable", { duration: 2000 });
    } finally {
      setAiGenerating(false);
    }
  };

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const hashMatch = trimmed.match(/(^|\s)#([\w-]+)/);
    const effectiveTag = hashMatch ? hashMatch[2].toLowerCase() : "personal";
    const cleanText = hashMatch
      ? trimmed.replace(/(^|\s)#[\w-]+(\s|$)/g, " ").replace(/\s{2,}/g, " ").trim()
      : trimmed;
    onAddTask({
      id: nanoid(),
      text: cleanText,
      priority,
      context: (effectiveTag === "work" || effectiveTag === "personal" ? effectiveTag : "personal") as "work" | "personal",
      done: false,
      createdAt: new Date(),
      dueDate: dueDate || new Date().toISOString().slice(0, 10),
    });
    toast.success(`Task added · ${priority}${effectiveTag !== "personal" ? ` · #${effectiveTag}` : ""}`);
    setText("");
    setPriority("focus");
    setDueDate(new Date().toISOString().slice(0, 10));
    setOpen(false);
  };

  // ── Add chip ──────────────────────────────────────────────────────────────
  const handleAddChip = () => {
    const trimmed = newChip.trim();
    if (!trimmed) return;
    // If using defaults (no custom chips yet), seed them first then add
    if (customChips.length === 0) {
      setCustomChips([...DEFAULT_CHIPS, trimmed]);
    } else {
      createChip.mutate({ text: trimmed });
    }
    setNewChip("");
  };

  // ── Delete chip ───────────────────────────────────────────────────────────
  const handleDeleteChip = (chipText: string) => {
    // If using defaults, seed them first then remove the target
    if (customChips.length === 0) {
      setCustomChips(DEFAULT_CHIPS.filter((c) => c !== chipText));
    } else {
      deleteChip.mutate({ text: chipText });
    }
  };

  const closeModal = () => { setOpen(false); setConfigMode(false); };

  return (
    <>
      {/* Floating trigger — on mobile, position above bottom tab bar */}
      <MobileAwareQuickAddTrigger open={open} onOpen={() => setOpen(true)} />

      {/* Backdrop + modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "oklch(0.18 0.01 60 / 0.25)", backdropFilter: "blur(4px)" }}
          onClick={closeModal}
        >
          <div
            data-tour-id="tour-quickadd-modal"
            className="w-full max-w-lg overflow-hidden"
            style={{ background: M.card, border: `1px solid ${M.border}`, borderRadius: 20, boxShadow: "0 8px 40px oklch(0.12 0.01 20 / 0.15)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${M.border}` }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "oklch(0.12 0.01 20)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Sparkles className="w-4 h-4" style={{ color: "oklch(1 0 0)" }} />
              </div>
              <div className="flex-1">
                <p style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.95rem", fontWeight: 900, color: M.ink, margin: 0 }}>AI Assistant</p>
                <p style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.75rem", color: M.muted, margin: 0 }}>Ask me anything about your tasks</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => setChatHistory([])}
                  title="Clear chat"
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: chatHistory.length > 0 ? M.ink : M.muted, opacity: chatHistory.length > 0 ? 1 : 0.35, padding: 4, display: "flex", alignItems: "center" }}
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button onClick={closeModal} style={{ background: "transparent", border: "none", cursor: "pointer", color: M.muted, padding: 4, display: "flex", alignItems: "center" }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Config mode ── */}
            {configMode ? (
              <div className="px-5 pb-5">
                {/* Add new chip */}
                <div className="flex gap-2 mb-4">
                  <input
                    ref={newChipRef}
                    value={newChip}
                    onChange={(e) => setNewChip(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddChip(); }}
                    placeholder="New quick-reply chip…"
                    autoComplete="off"
                    className="flex-1 text-sm px-3 py-2 bg-transparent focus:outline-none"
                    style={{ border: `1px solid ${M.border}`, color: M.ink, fontFamily: "'Pretendard', system-ui, sans-serif" }}
                    onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = M.coralBdr; }}
                    onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = M.border; }}
                  />
                  <button
                    onClick={handleAddChip}
                    disabled={!newChip.trim()}
                    className="m-btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ fontSize: "0.75rem" }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>

                {/* Chip list */}
                <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
                  {chips.length === 0 && (
                    <p className="text-xs text-center py-4" style={{ color: M.muted, fontFamily: "'Pretendard', system-ui, sans-serif" }}>No chips yet. Add one above.</p>
                  )}
                  {chips.map((chip) => (
                    <div
                      key={chip}
                      className="flex items-center justify-between gap-2 px-3 py-2"
                      style={{ border: `1px solid ${M.border}`, background: "oklch(0.99 0.010 355)" }}
                    >
                      <span className="text-xs flex-1 truncate" style={{ color: M.ink, fontFamily: "'Pretendard', system-ui, sans-serif" }}>{chip}</span>
                      <button
                        onClick={() => handleDeleteChip(chip)}
                        className="p-0.5 transition-colors shrink-0"
                        style={{ color: M.muted }}
                        title="Delete chip"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <p className="text-xs mt-3" style={{ color: M.muted, fontFamily: "'Pretendard', system-ui, sans-serif" }}>
                  Chips are saved to your account and backed up automatically.
                </p>
              </div>
            ) : (
              /* ── Chat Box Mode ── */
              <div style={{ display: "flex", flexDirection: "column" }}>
                {/* Chat history */}
                <div style={{ height: 280, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10, background: "oklch(0.985 0.010 355)" }}>
                  {chatHistory.length === 0 && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 16 }}>
                      <Sparkles size={22} style={{ color: M.coral, opacity: 0.7 }} />
                      <p style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.82rem", color: M.muted, textAlign: "center", lineHeight: 1.5 }}>Your ADHD focus assistant — I can plan your day, prioritize tasks, add ideas, or just think with you.</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                        {[
                          "What should I focus on right now?",
                          "Help me plan my day",
                          "I have too many tasks, help me prioritize",
                          "Add task: ",
                          "Brain dump: ",
                        ].map((prompt) => (
                          <button
                            key={prompt}
                            onClick={() => setText(prompt)}
                            style={{
                              textAlign: "left", padding: "8px 12px",
                              background: "white", border: `1px solid ${M.border}`,
                              borderRadius: 8, cursor: "pointer",
                              fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.82rem",
                              color: M.ink, lineHeight: 1.4,
                              transition: "border-color 0.15s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.borderColor = M.coralBdr)}
                            onMouseLeave={(e) => (e.currentTarget.style.borderColor = M.border)}
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {chatHistory.map((msg, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                      <div style={{
                        maxWidth: "80%",
                        padding: "8px 12px",
                        borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                        background: msg.role === "user" ? M.coral : "white",
                        color: msg.role === "user" ? "white" : M.ink,
                        fontFamily: "'Pretendard', system-ui, sans-serif",
                        fontSize: "0.875rem",
                        lineHeight: 1.5,
                        border: msg.role === "assistant" ? `1px solid ${M.border}` : "none",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                        whiteSpace: "pre-wrap",
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {aiGenerating && (
                    <div style={{ display: "flex", justifyContent: "flex-start" }}>
                      <div style={{ padding: "8px 12px", borderRadius: "12px 12px 12px 2px", background: "white", border: `1px solid ${M.border}`, display: "flex", gap: 4, alignItems: "center" }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: M.coral, animation: "pulse 1s infinite" }} />
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: M.coral, animation: "pulse 1s infinite 0.2s" }} />
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: M.coral, animation: "pulse 1s infinite 0.4s" }} />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input row */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderTop: `1px solid ${M.border}`, background: "white" }}>
                  {/* Voice button */}
                  <button
                    onClick={toggleVoice}
                    title={isRecording ? "Stop recording" : "Voice input"}
                    style={{
                      width: 36, height: 36, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0,
                      background: isRecording ? M.coral : M.coralBg,
                      color: isRecording ? "white" : M.coral,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      animation: isRecording ? "pulse 1s infinite" : "none",
                    }}
                  >
                    {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>

                  {/* Text input */}
                  <input
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend(); }
                      if (e.key === "Escape") closeModal();
                    }}
                    placeholder={isRecording ? "🎤 Listening..." : "Message AI assistant..."}
                    autoComplete="off" autoCorrect="off"
                    style={{ flex: 1, fontSize: "0.9rem", background: "transparent", border: "none", outline: "none", color: M.ink, fontFamily: "'Pretendard', system-ui, sans-serif" }}
                  />

                  {/* Send button */}
                  <button
                    onClick={handleChatSend}
                    disabled={!text.trim() || aiGenerating}
                    style={{
                      width: 36, height: 36, borderRadius: "50%", border: "none", cursor: text.trim() ? "pointer" : "default", flexShrink: 0,
                      background: text.trim() ? M.coral : M.coralBg,
                      color: text.trim() ? "white" : M.muted,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {aiGenerating ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
