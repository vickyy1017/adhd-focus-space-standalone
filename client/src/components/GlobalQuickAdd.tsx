/* ============================================================
   ADHD FOCUS SPACE — Global Quick Add v6.0
   Configurable quick-reply chips, persisted to DB via tRPC
   ============================================================ */

import { useEffect, useRef, useState } from "react";
import { Flame, Loader2, Plus, Settings, Sparkles, Star, Trash2, X, Zap } from "lucide-react";
import { callAI } from "@/lib/ai";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useMobile } from "@/hooks/useMobile";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import type { Task } from "./TaskManager";

const M = {
  coral:    "oklch(0.58 0.18 340)",
  coralBg:  "oklch(0.58 0.18 340 / 0.08)",
  coralBdr: "oklch(0.58 0.18 340 / 0.28)",
  ink:      "oklch(0.28 0.040 320)",
  muted:    "oklch(0.52 0.040 330)",
  border:   "oklch(0.82 0.050 340)",
  card:     "oklch(0.975 0.018 355)",
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
        title="Quick add task (⌘K or +)"
        style={{
          width: 48,
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "oklch(0.975 0.018 355)",
          border: `2px solid ${M.ink}`,
          boxShadow: `3px 3px 0 ${M.ink}`,
          fontFamily: "'Space Mono', monospace",
          cursor: "pointer",
          transition: "transform 0.2s, box-shadow 0.2s",
          borderRadius: 0,
        }}
      >
        <Plus style={{ width: 20, height: 20, color: M.coral }} />
      </button>
      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.50rem", letterSpacing: "0.08em", color: M.muted, textAlign: "center", lineHeight: 1.3, userSelect: "none", pointerEvents: "none" }}>
        press +
      </span>
    </div>
  );
}

export function GlobalQuickAdd({ onAddTask, onAddGoal, onAddWin, onAddDump }: GlobalQuickAddProps) {
  const [open, setOpen]           = useState(false);
  const [configMode, setConfigMode] = useState(false);
  const [text, setText]           = useState("");
  const [aiMode, setAiMode] = useState(true); // default to AI mode
  const [aiGenerating, setAiGenerating] = useState(false);

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
            className="w-full max-w-lg overflow-hidden shadow-2xl"
            style={{ background: M.card, border: `1px solid ${M.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-3">
              <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ background: M.coralBg, border: `1px solid ${M.coralBdr}` }}>
                <Sparkles className="w-4 h-4" style={{ color: M.coral }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: M.ink, fontFamily: "'DM Sans', sans-serif" }}>AI Assistant</p>
                <p className="text-xs" style={{ color: M.muted, fontFamily: "'DM Sans', sans-serif" }}>
                  {configMode ? "Manage quick-reply chips" : "Tell me what to add — task, dump, or anything"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setConfigMode((v) => !v)}
                  title="Configure chips"
                  className="p-1 transition-colors"
                  style={{ color: configMode ? M.coral : M.muted }}
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button onClick={closeModal} className="p-1 transition-colors" style={{ color: M.muted }}>
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
                    style={{ border: `1px solid ${M.border}`, color: M.ink, fontFamily: "'DM Sans', sans-serif" }}
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
                    <p className="text-xs text-center py-4" style={{ color: M.muted, fontFamily: "'DM Sans', sans-serif" }}>No chips yet. Add one above.</p>
                  )}
                  {chips.map((chip) => (
                    <div
                      key={chip}
                      className="flex items-center justify-between gap-2 px-3 py-2"
                      style={{ border: `1px solid ${M.border}`, background: "oklch(0.99 0.010 355)" }}
                    >
                      <span className="text-xs flex-1 truncate" style={{ color: M.ink, fontFamily: "'DM Sans', sans-serif" }}>{chip}</span>
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

                <p className="text-xs mt-3" style={{ color: M.muted, fontFamily: "'DM Sans', sans-serif" }}>
                  Chips are saved to your account and backed up automatically.
                </p>
              </div>
            ) : (
              /* ── Capture mode ── */
              <div className="px-5 pb-5">
                {/* Mode toggle */}
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={() => setAiMode(false)} style={{ fontSize: "0.55rem", fontFamily: "'Space Mono', monospace", letterSpacing: "0.08em", padding: "2px 8px", borderRadius: 10, border: `1px solid ${!aiMode ? M.coral : M.border}`, background: !aiMode ? M.coralBg : "transparent", color: !aiMode ? M.coral : M.muted, cursor: "pointer" }}>
                    Manual
                  </button>
                  <button onClick={() => setAiMode(true)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.55rem", fontFamily: "'Space Mono', monospace", letterSpacing: "0.08em", padding: "2px 8px", borderRadius: 10, border: `1px solid ${aiMode ? M.coral : M.border}`, background: aiMode ? M.coralBg : "transparent", color: aiMode ? M.coral : M.muted, cursor: "pointer" }}>
                    <Sparkles size={9} /><span>AI</span>
                  </button>
                </div>

                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); aiMode ? handleAiCreate() : submit(); }
                    if (e.key === "Escape") closeModal();
                  }}
                  placeholder={aiMode ? "e.g. review emails urgent link to work goal due Friday" : "e.g. Reply message from Alice…"}
                  autoComplete="new-password" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                  className="w-full text-base px-4 py-3 bg-transparent focus:outline-none"
                  style={{ border: `1px solid ${aiMode ? M.coralBdr : M.border}`, color: M.ink, fontFamily: "'DM Sans', sans-serif" }}
                  onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = M.coralBdr; }}
                  onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = aiMode ? M.coralBdr : M.border; }}
                />

                {aiMode ? (
                  <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.48rem", color: M.muted, margin: "5px 0 0", lineHeight: 1.5, opacity: 0.8 }}>
                    Create a task, win, or brain dump — AI understands it all naturally.
                  </p>
                ) : (
                  <>
                  {/* Compact controls row: icon-only priority + date */}
                  <div className="flex items-center gap-1.5 mt-2">
                    {/* Icon-only priority buttons */}
                    {(["urgent", "focus", "normal"] as Priority[]).map((p) => {
                      const { Icon, color, bg, border } = PRIORITY_CFG[p];
                      const isActive = priority === p;
                      return (
                        <button key={p} onClick={() => setPriority(p)} title={p}
                          style={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", background: isActive ? bg : "transparent", color: isActive ? color : M.muted, border: `1px solid ${isActive ? border : M.border}`, borderRadius: 4, cursor: "pointer", flexShrink: 0 }}>
                          <Icon style={{ width: 12, height: 12 }} />
                        </button>
                      );
                    })}
                    {/* Divider */}
                    <div style={{ width: 1, height: 18, background: M.border, flexShrink: 0 }} />
                    {/* Date picker */}
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} min={new Date().toISOString().slice(0,10)}
                      style={{ fontSize: "0.60rem", fontFamily: "'DM Sans', sans-serif", padding: "3px 5px", border: `1px solid ${dueDate ? M.coralBdr : M.border}`, background: "transparent", color: dueDate ? M.coral : M.muted, borderRadius: 3, outline: "none", cursor: "pointer", flexShrink: 0, maxWidth: 110 }} />
                  </div>

                {/* Quick chips */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {chips.map((chip) => (
                    <button key={chip} onClick={() => { setText(chip); inputRef.current?.focus(); }} className="m-chip">
                      {chip}
                    </button>
                  ))}
                </div>

                  {/* Submit row */}
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-xs" style={{ color: M.muted, fontFamily: "'DM Sans', sans-serif" }}>
                      tip: type <span style={{ color: M.coral }}>#tag</span> to categorise
                    </p>
                    <button onClick={submit} disabled={!text.trim()} className="m-btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
                      <Plus className="w-3.5 h-3.5" />Add task<kbd className="text-xs opacity-60 ml-1">↵</kbd>
                    </button>
                  </div>
                  </>
                )}

                {/* AI mode submit */}
                {aiMode && (
                  <div className="flex justify-end mt-3">
                    <button onClick={handleAiCreate} disabled={aiGenerating || !text.trim()} className="m-btn-primary disabled:opacity-40 disabled:cursor-not-allowed" style={{ gap: 6 }}>
                      {aiGenerating ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={13} />}
                      {aiGenerating ? "Creating…" : "Create with AI"}
                      <kbd className="text-xs opacity-60">↵</kbd>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
