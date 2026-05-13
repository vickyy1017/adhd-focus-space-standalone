/* ============================================================
   ADHD FOCUS SPACE — Brain Dump v5.0 (DB-backed)
   All entries persisted to database via tRPC
   ============================================================ */

import { useEffect, useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { PixelBrain } from "@/components/PixelIcons";
import { cn } from "@/lib/utils";
import { ArrowRight, Hash, Sparkles, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import type { Task } from "./TaskManager";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { callAI } from "@/lib/ai";

interface BrainDumpEntry {
  id: string;
  text: string;
  tags: string[];
  createdAt: Date;
  converted: boolean;
}

interface BrainDumpProps {
  onConvertToTask: (task: Task) => void;
  onCreateAgent?: (taskText: string) => void;
  onAddGoal?: (text: string) => void;
  onDump?: () => void;
  initialText?: string;
  onInitialTextConsumed?: () => void;
  // External entries control (for DB sync)
  externalEntries?: Array<{ id: string; text: string; tags: string[]; createdAt: string; converted: boolean }>;
  onExternalEntriesChange?: (entries: Array<{ id: string; text: string; tags: string[]; createdAt: string; converted: boolean }>) => void;
}

const M = {
  coral:    "#111111",      // soft rose
  coralBg:  "#F5F5F5",      // rose tint
  coralBdr: "#E5E5E5",      // rose border
  sage:     "#666666",     // sage green
  sageBg:   "#F5F5F5",
  sageBdr:  "#E5E5E5",
  ink:      "#111111",      // near-black
  muted:    "#888888",      // muted text
  border:   "#E5E5E5",     // hairline
  card:     "#FFFFFF",             // pure white
  tagBg:    "#F5F5F5",     // tag bg
  tagBdr:   "#E5E5E5",     // tag border
};

/** Extract all #tags from a string, return lowercase without the # */
function extractTags(text: string): string[] {
  const matches = text.match(/(?:^|\s)(#[a-zA-Z0-9\u4e00-\u9fa5_-]+)/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((t) => t.trim().slice(1).toLowerCase())));
}

/** Render text with #tags highlighted as inline coral chips */
function HighlightedText({ text, activeTag }: { text: string; activeTag: string | null }) {
  const parts = text.split(/((?:^|(?<=\s))#[a-zA-Z0-9\u4e00-\u9fa5_-]+)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith("#")) {
          const tag = part.slice(1).toLowerCase();
          const isActive = activeTag === tag;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                background: isActive ? "#111111" : "#F5F5F5",
                border: `1px solid ${isActive ? "#111111" : "#E5E5E5"}`,
                borderRadius: 9999,
                color: isActive ? "#FFFFFF" : "#888888",
                fontFamily: "'Pretendard', system-ui, sans-serif",
                fontSize: "0.72rem",
                fontWeight: 600,
                padding: "1px 8px",
                margin: "0 2px",
                verticalAlign: "middle",
              }}
            >
              {part.slice(1)}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

export function BrainDump({ onConvertToTask, onCreateAgent, onAddGoal, onDump, initialText, onInitialTextConsumed, externalEntries, onExternalEntriesChange }: BrainDumpProps) {
  const [currentThought, setCurrentThought] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [initialTextHandled, setInitialTextHandled] = useState(false);
  const [aiSorting, setAiSorting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [aiResults, setAiResults] = useState<Array<{
    id: string;
    original: string;
    rewritten: string;
    category: string;
    emoji: string;
  }> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // localStorage-backed entries (fallback when no external entries provided)
  const [rawEntries, setRawEntries] = useLocalStorage<Array<{
    id: string; text: string; tags: string[]; createdAt: string; converted: boolean;
  }>>("adhd_braindump_entries", []);

  // Use external entries if provided (DB sync), otherwise use localStorage
  const effectiveRaw = externalEntries ?? rawEntries;
  const setEffectiveRaw = (updater: ((prev: any[]) => any[]) | any[]) => {
    const newVal = typeof updater === "function" ? updater(effectiveRaw) : updater;
    if (onExternalEntriesChange) {
      onExternalEntriesChange(newVal);
    } else {
      setRawEntries(newVal);
    }
  };

  const entries: BrainDumpEntry[] = useMemo(() =>
    effectiveRaw.map((e: any) => ({ ...e, createdAt: new Date(e.createdAt) })),
    [effectiveRaw]
  );

  const isLoading = false;

  const createMutation = {
    mutate: ({ id, text, tags }: { id: string; text: string; tags: string[] }) => {
      setEffectiveRaw((prev: any[]) => [{ id, text, tags, createdAt: new Date().toISOString(), converted: false }, ...prev]);
    },
    isPending: false,
  };

  const updateMutation = {
    mutate: ({ id, converted }: { id: string; converted?: boolean }) => {
      setEffectiveRaw((prev: any[]) => prev.map((e: any) => e.id === id ? { ...e, ...(converted !== undefined && { converted }) } : e));
    },
  };

  const deleteMutation = {
    mutate: ({ id }: { id: string }) => {
      setEffectiveRaw((prev: any[]) => prev.filter((e: any) => e.id !== id));
    },
  };

  const deleteAllMutation = {
    mutate: () => {
      setEffectiveRaw([]);
      setActiveTag(null);
    },
  };

  // All unique tags across all entries
  const allTags = useMemo(() => {
    // Only show tags that exist on at least one unconverted (visible) entry
    const tagSet = new Set<string>();
    entries.filter((e) => !e.converted).forEach((e) => e.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [entries]);

  // Entries filtered by active tag — exclude converted entries from display
  const visibleEntries = useMemo(() => {
    const active = entries.filter((e) => !e.converted);
    if (!activeTag) return active;
    return active.filter((e) => e.tags.includes(activeTag));
  }, [entries, activeTag]);

  const dump = (text?: string) => {
    const thought = (text ?? currentThought).trim();
    if (!thought) return;
    let tags = extractTags(thought);
    // Auto-add active tag if one is selected and not already in the text
    if (activeTag && !tags.includes(activeTag)) {
      tags = [activeTag, ...tags];
    }
    const id = nanoid();
    createMutation.mutate({ id, text: thought, tags });
    if (!text) setCurrentThought("");
    onDump?.();
  };

  const convertToTask = (entry: BrainDumpEntry) => {
    const cleanText = entry.text.replace(/(?:^|\s)#[a-zA-Z0-9\u4e00-\u9fa5_-]+/g, " ").replace(/\s{2,}/g, " ").trim();
    onConvertToTask({
      id: nanoid(), text: cleanText || entry.text.trim(), priority: "focus",
      context: "work", done: false, createdAt: new Date(),
    });
    updateMutation.mutate({ id: entry.id, converted: true });
      };

  const deleteEntry = (id: string) => {
    deleteMutation.mutate({ id });
  };

  const clearAll = () => {
    deleteAllMutation.mutate();
    toast.info("Brain dump cleared.", { duration: 2000 });
  };

  const handleAiSort = async () => {
    const active = entries.filter((e) => !e.converted);
    if (active.length === 0) { toast.info("Nothing to sort."); return; }
    setAiSorting(true);
    setAiResults(null);
    try {
      const result = await callAI(
        `Categorize each brain dump entry. Return ONLY valid JSON:
{"items":[{"original":"exact original text","rewritten":"clean action version","category":"task|goal|idea|worry","emoji":"one emoji"}]}
- task: something to do. goal: something to achieve over time. idea: creative thought. worry: concern/anxiety.
- rewritten: make it a clear, actionable sentence. Keep short.`,
        active.map((e) => e.text).join("\n")
      );
      // Try to extract and parse JSON from the AI response
      let parsed: { items: { original: string; category: string; rewritten: string; emoji: string }[] } | null = null;
      try {
        // First try: direct parse
        parsed = JSON.parse(result);
      } catch {
        // Second try: extract JSON object
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try { parsed = JSON.parse(jsonMatch[0]); } catch { /* ignore */ }
        }
        // Third try: extract just the items array
        if (!parsed) {
          const arrMatch = result.match(/\[[\s\S]*\]/);
          if (arrMatch) {
            try { parsed = { items: JSON.parse(arrMatch[0]) }; } catch { /* ignore */ }
          }
        }
      }
      if (parsed?.items?.length) {
        setAiResults(parsed.items.map((item, i) => ({ ...item, id: String(i) })));
      } else {
        toast.info("AI couldn't parse the entries. Try again.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI sort failed";
      toast.error(msg, { duration: 5000 });
    } finally {
      setAiSorting(false);
    }
  };

  const applyAiItem = (item: NonNullable<typeof aiResults>[0], action: "task" | "goal") => {
    const entry = entries.find((e) => e.text.trim() === item.original.trim()
      || e.text.includes(item.original.slice(0, 30)));
    if (action === "task") {
      onConvertToTask({
        id: nanoid(), text: item.rewritten || item.original,
        priority: "focus", context: "work", done: false, createdAt: new Date(),
      });
      if (entry) updateMutation.mutate({ id: entry.id, converted: true });
    } else if (action === "goal") {
      onAddGoal?.(item.rewritten || item.original);
      if (entry) updateMutation.mutate({ id: entry.id, converted: true });
    }
    setAiResults((prev) => prev ? prev.filter((r) => r.id !== item.id) : null);
  };

  // Auto-dump initialText once on mount
  useEffect(() => {
    if (initialText && initialText.trim() && !initialTextHandled) {
      setInitialTextHandled(true);
      dump(initialText.trim());
      onInitialTextConsumed?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText]);

  // Live tag preview while typing
  const liveTagsInInput = extractTags(currentThought);

  return (
    <div data-tour-id="tour-dump" style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>

      {/* ── Input area ── */}
      <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid #F0F0F0" }}>
        <textarea
          ref={textareaRef}
          value={currentThought}
          onChange={(e) => setCurrentThought(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) dump(); }}
          placeholder="What's on your mind? Use #tags to label..."
          rows={4}
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            background: "transparent",
            resize: "none",
            fontSize: 17,
            lineHeight: 1.6,
            color: "#111111",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
        {/* Live tags */}
        {liveTagsInInput.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {liveTagsInInput.map((t) => (
              <span key={t} style={{ background: "#F0F0F0", borderRadius: 9999, color: "#888888", fontSize: 12, fontWeight: 600, padding: "2px 10px" }}>{t}</span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "#BBBBBB" }}>⌘+Enter to save</span>
          <button
            onClick={() => dump()}
            disabled={createMutation.isPending || !currentThought.trim()}
            style={{
              background: currentThought.trim() ? "#111111" : "#F0F0F0",
              color: currentThought.trim() ? "#FFFFFF" : "#BBBBBB",
              border: "none",
              borderRadius: 9999,
              padding: "8px 20px",
              fontSize: 14,
              fontWeight: 700,
              cursor: currentThought.trim() ? "pointer" : "default",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            {createMutation.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div style={{ padding: "10px 16px", display: "flex", gap: 6, flexWrap: "wrap", borderBottom: "1px solid #F0F0F0" }}>
          <button
            onClick={() => setActiveTag(null)}
            style={{ background: !activeTag ? "#111111" : "#F5F5F5", color: !activeTag ? "#FFFFFF" : "#888888", border: "none", borderRadius: 9999, padding: "4px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              style={{ background: activeTag === tag ? "#111111" : "#F5F5F5", color: activeTag === tag ? "#FFFFFF" : "#888888", border: "none", borderRadius: 9999, padding: "4px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Entries header */}
      {entries.filter(e => !e.converted).length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px 4px" }}>
          <p className="text-sm font-medium" style={{ color: M.ink, fontFamily: "'Pretendard', system-ui, sans-serif" }}>
            {activeTag ? `#${activeTag}` : "All thoughts"}{" "}
            <span style={{ color: M.muted }}>({visibleEntries.length})</span>
          </p>
          <div className="flex items-center gap-2">
            <button onClick={handleAiSort} disabled={aiSorting} className="m-btn-link flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {aiSorting ? "Sorting…" : "AI Sort"}
            </button>
            <div style={{ width: 1, height: 12, background: "oklch(0.75 0.040 330)", alignSelf: "center" }} />
            <button onClick={clearAll} disabled={deleteAllMutation.isPending} className="m-btn-link">
              Clear all
            </button>
          </div>
        </div>
      )}

      {/* AI Sort Results Panel */}
      {aiResults && aiResults.length > 0 && (
        <div style={{
          background: "#FFFFFF",
          border: "1.5px solid #E5E5E5",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "3px 3px 0 rgba(0,0,0,0.05)",
        }}>
          {/* Title bar */}
          <div style={{
            background: "#F5F5F5",
            borderBottom: "1px solid #E5E5E5",
            padding: "4px 10px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.58rem", letterSpacing: "0.10em", color: "#555555" }}>
              ✦ AI_SORT.EXE — {aiResults.length} item{aiResults.length !== 1 ? "s" : ""}
            </span>
            <button onClick={() => setAiResults(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.65rem", color: "#888888", lineHeight: 1 }}>✕</button>
          </div>
          {/* Items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {aiResults.map((item, i) => (
              <div key={item.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 10px",
                borderBottom: i < aiResults.length - 1 ? "1px solid #E5E5E5" : "none",
              }}>
                <span style={{ fontSize: "0.85rem", flexShrink: 0 }}>{item.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.72rem", color: "#111111", lineHeight: 1.35, margin: 0 }}>
                    {item.rewritten || item.original}
                  </p>
                  <span style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.48rem", letterSpacing: "0.08em", color: "#888888", textTransform: "uppercase" as const }}>
                    {item.category}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => applyAiItem(item, "task")}
                    style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.48rem", letterSpacing: "0.08em", padding: "2px 7px", borderRadius: 8, border: "1px solid #888888", background: "#F5F5F5", color: "#555555", cursor: "pointer" }}
                  >
                    + TASK
                  </button>
                  <button
                    onClick={() => applyAiItem(item, "goal")}
                    style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.48rem", letterSpacing: "0.08em", padding: "2px 7px", borderRadius: 8, border: "1px solid #888888", background: "#F5F5F5", color: "#555555", cursor: "pointer" }}
                  >
                    + GOAL
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <span className="text-xs" style={{ color: M.muted, fontFamily: "'Pretendard', system-ui, sans-serif" }}>Loading…</span>
        </div>
      )}

      {/* Entries list */}
      {!isLoading && (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {entries.filter(e => !e.converted).length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <div style={{ opacity: 0.3 }}><PixelBrain size={40} color={M.muted} /></div>
              <p className="text-sm" style={{ color: M.muted, fontFamily: "'Pretendard', system-ui, sans-serif" }}>Empty. Let your thoughts flow.</p>
            </div>
          )}

          {visibleEntries.length === 0 && entries.filter(e => !e.converted).length > 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Tag className="w-8 h-8 mb-2" style={{ color: `${M.muted}50` }} />
              <p className="text-sm" style={{ color: M.muted, fontFamily: "'Pretendard', system-ui, sans-serif" }}>
                No ideas tagged <span style={{ color: M.coral }}>#{activeTag}</span> yet.
              </p>
            </div>
          )}

          {visibleEntries.map((entry) => (
            <div
              key={entry.id}
              className={cn("group flex flex-col gap-2 p-3 transition-all")}
              style={{
                background: entry.converted ? "#F9F9F9" : M.card,
                border: `1px solid ${editingId === entry.id ? M.coralBdr : M.border}`,
                opacity: entry.converted ? 0.55 : 1,
              }}
              onMouseEnter={(e) => {
                if (!entry.converted && editingId !== entry.id) (e.currentTarget as HTMLDivElement).style.borderColor = M.coralBdr;
              }}
              onMouseLeave={(e) => {
                if (editingId !== entry.id) (e.currentTarget as HTMLDivElement).style.borderColor = M.border;
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  {editingId === entry.id ? (
                    <textarea
                      autoFocus
                      value={editText}
                      onChange={(e) => {
                        setEditText(e.target.value);
                        // Auto-resize: reset then expand to content
                        e.target.style.height = "auto";
                        e.target.style.height = e.target.scrollHeight + "px";
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          updateMutation.mutate({ id: entry.id, text: editText });
                          setEditingId(null);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onBlur={() => {
                        if (editText.trim()) updateMutation.mutate({ id: entry.id, text: editText });
                        setEditingId(null);
                      }}
                      ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                      style={{ width: "100%", boxSizing: "border-box", fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.875rem", color: M.ink, lineHeight: 1.6, padding: "4px 6px", border: `1px solid ${M.coralBdr}`, borderRadius: 8, outline: "none", resize: "none", overflow: "hidden", background: "oklch(0.995 0.008 355)" }}
                    />
                  ) : (
                    <p
                      className={cn("text-sm leading-relaxed", entry.converted && "line-through")}
                      style={{ color: entry.converted ? M.muted : M.ink, fontFamily: "'Pretendard', system-ui, sans-serif", cursor: entry.converted ? "default" : "text", whiteSpace: "pre-wrap" }}
                      onClick={() => { if (!entry.converted) { setEditingId(entry.id); setEditText(entry.text); } }}
                      title={entry.converted ? "" : "Click to edit"}
                    >
                      {entry.text.replace(/(?:^|\s)#[a-zA-Z0-9\u4e00-\u9fa5_-]+/g, "").trim()}
                    </p>
                  )}
                  <p className="text-xs mt-1" style={{ color: M.muted, fontFamily: "'Pretendard', system-ui, sans-serif" }}>
                    {new Date(entry.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>

                {!entry.converted && (
                  <div className="flex items-center gap-1 shrink-0" style={{ opacity: 1 }}>
                    <button onClick={() => convertToTask(entry)} className="m-chip active">
                      <ArrowRight className="w-3 h-3" />
                      Task
                    </button>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="p-1 transition-colors"
                      style={{
                        color: M.muted,
                        minWidth: 28,
                        minHeight: 28,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {entry.converted && (
                  <span className="text-xs shrink-0" style={{ color: M.sage, fontFamily: "'Pretendard', system-ui, sans-serif" }}>→ Task</span>
                )}
              </div>

              {entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1" style={{ borderTop: `1px solid ${M.border}` }}>
                  {entry.tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                      className={cn("m-chip", activeTag === tag && "active")}
                      style={{ fontSize: "0.72rem" }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
