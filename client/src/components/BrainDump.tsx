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
  coral:    "oklch(0.58 0.18 340)",
  coralBg:  "oklch(0.58 0.18 340 / 0.08)",
  coralBdr: "oklch(0.58 0.18 340 / 0.28)",
  sage:     "oklch(0.52 0.10 168)",
  sageBg:   "oklch(0.52 0.10 168 / 0.08)",
  sageBdr:  "oklch(0.52 0.10 168 / 0.28)",
  ink:      "oklch(0.28 0.040 320)",
  muted:    "oklch(0.52 0.040 330)",
  border:   "oklch(0.82 0.050 340)",
  card:     "oklch(0.975 0.018 355)",
  tagBg:    "oklch(0.58 0.18 340 / 0.10)",
  tagBdr:   "oklch(0.58 0.18 340 / 0.22)",
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
              className="inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.5 text-xs font-medium"
              style={{
                background: isActive ? M.coral : M.tagBg,
                border: `1px solid ${isActive ? M.coral : M.tagBdr}`,
                color: isActive ? "oklch(0.97 0.010 355)" : M.coral,
                fontFamily: "'DM Sans', sans-serif",
                letterSpacing: "0.04em",
              }}
            >
              <Hash className="w-2.5 h-2.5" />
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
    <div data-tour-id="tour-dump" className="flex flex-col gap-4 h-full">

      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <PixelBrain size={28} color={M.coral} />
        <div>
          <p className="text-sm font-semibold italic" style={{ color: M.ink, fontFamily: "'Playfair Display', serif" }}>Brain Dump</p>
          <p className="editorial-label" style={{ color: M.muted }}>Use <span style={{ color: M.coral }}>#tags</span> to organise</p>
        </div>
      </div>

      {/* Input */}
      <div className="flex flex-col gap-2">
        <Textarea
          ref={textareaRef}
          value={currentThought}
          onChange={(e) => setCurrentThought(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) dump(); }}
          placeholder={"What's on your mind? Use #tags to label ideas…"}
          className="resize-none min-h-[100px]"
          style={{ background: M.card, border: `1px solid ${M.border}`, color: M.ink, fontFamily: "'DM Sans', sans-serif" }}
          rows={4}
        />

        {/* Live tag preview */}
        {liveTagsInInput.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag className="w-3 h-3 shrink-0" style={{ color: M.muted }} />
            <span className="text-xs" style={{ color: M.muted, fontFamily: "'DM Sans', sans-serif" }}>Detected:</span>
            {liveTagsInInput.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium"
                style={{ background: M.tagBg, border: `1px solid ${M.tagBdr}`, color: M.coral, fontFamily: "'DM Sans', sans-serif" }}
              >
                <Hash className="w-2.5 h-2.5" />
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: M.muted, fontFamily: "'DM Sans', sans-serif" }}>⌘ + Enter to capture</span>
          <button onClick={() => dump()} disabled={createMutation.isPending} className="m-btn-primary">
            {createMutation.isPending ? "Saving…" : "Dump It"}
          </button>
        </div>
      </div>

      {/* AI Results Panel */}
      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium" style={{ color: M.muted, fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.10em", textTransform: "uppercase" }}>
              Filter by tag
            </span>
            <button onClick={() => setActiveTag(null)} className={cn("m-chip", !activeTag && "active")}>
              All ({entries.filter(e => !e.converted).length})
            </button>
            {allTags.map((tag) => {
              const count = entries.filter((e) => e.tags.includes(tag) && !e.converted).length;
              return (
                <button
                  key={tag}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  className={cn("m-chip", activeTag === tag && "active")}
                >
                  <Hash className="w-2.5 h-2.5" />
                  {tag} ({count})
                </button>
              );
            })}
          </div>
          {activeTag && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: M.muted, fontFamily: "'DM Sans', sans-serif" }}>
                Showing {visibleEntries.length} idea{visibleEntries.length !== 1 ? "s" : ""} tagged
              </span>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium"
                style={{ background: M.coral, border: `1px solid ${M.coral}`, color: "oklch(0.97 0.005 80)", fontFamily: "'DM Sans', sans-serif" }}>
                <Hash className="w-2.5 h-2.5" />
                {activeTag}
              </span>
              <button onClick={() => setActiveTag(null)} className="p-0.5 transition-opacity hover:opacity-60" style={{ color: M.muted }}>
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Entries header */}
      {entries.filter(e => !e.converted).length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium" style={{ color: M.ink, fontFamily: "'DM Sans', sans-serif" }}>
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
          background: "oklch(0.975 0.018 355)",
          border: "1.5px solid oklch(0.75 0.14 340)",
          borderRadius: 6,
          overflow: "hidden",
          boxShadow: "3px 3px 0 oklch(0.75 0.14 340 / 0.25)",
        }}>
          {/* Title bar */}
          <div style={{
            background: "oklch(0.90 0.045 340)",
            borderBottom: "1px solid oklch(0.80 0.08 340)",
            padding: "4px 10px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.58rem", letterSpacing: "0.10em", color: "oklch(0.35 0.08 330)" }}>
              ✦ AI_SORT.EXE — {aiResults.length} item{aiResults.length !== 1 ? "s" : ""}
            </span>
            <button onClick={() => setAiResults(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.65rem", color: "oklch(0.52 0.06 330)", lineHeight: 1 }}>✕</button>
          </div>
          {/* Items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {aiResults.map((item, i) => (
              <div key={item.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 10px",
                borderBottom: i < aiResults.length - 1 ? "1px solid oklch(0.88 0.025 340)" : "none",
              }}>
                <span style={{ fontSize: "0.85rem", flexShrink: 0 }}>{item.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.72rem", color: "oklch(0.28 0.040 320)", lineHeight: 1.35, margin: 0 }}>
                    {item.rewritten || item.original}
                  </p>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.48rem", letterSpacing: "0.08em", color: "oklch(0.60 0.08 340)", textTransform: "uppercase" as const }}>
                    {item.category}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => applyAiItem(item, "task")}
                    style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.48rem", letterSpacing: "0.08em", padding: "2px 7px", borderRadius: 3, border: "1px solid oklch(0.72 0.14 290)", background: "oklch(0.72 0.14 290 / 0.10)", color: "oklch(0.40 0.14 290)", cursor: "pointer" }}
                  >
                    + TASK
                  </button>
                  <button
                    onClick={() => applyAiItem(item, "goal")}
                    style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.48rem", letterSpacing: "0.08em", padding: "2px 7px", borderRadius: 3, border: "1px solid oklch(0.72 0.10 168)", background: "oklch(0.72 0.10 168 / 0.10)", color: "oklch(0.35 0.10 168)", cursor: "pointer" }}
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
          <span className="text-xs" style={{ color: M.muted, fontFamily: "'DM Sans', sans-serif" }}>Loading…</span>
        </div>
      )}

      {/* Entries list */}
      {!isLoading && (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {entries.filter(e => !e.converted).length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <div style={{ opacity: 0.3 }}><PixelBrain size={40} color={M.muted} /></div>
              <p className="text-sm" style={{ color: M.muted, fontFamily: "'DM Sans', sans-serif" }}>Empty. Let your thoughts flow.</p>
            </div>
          )}

          {visibleEntries.length === 0 && entries.filter(e => !e.converted).length > 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Tag className="w-8 h-8 mb-2" style={{ color: `${M.muted}50` }} />
              <p className="text-sm" style={{ color: M.muted, fontFamily: "'DM Sans', sans-serif" }}>
                No ideas tagged <span style={{ color: M.coral }}>#{activeTag}</span> yet.
              </p>
            </div>
          )}

          {visibleEntries.map((entry) => (
            <div
              key={entry.id}
              className={cn("group flex flex-col gap-2 p-3 transition-all")}
              style={{
                background: entry.converted ? "oklch(0.93 0.030 355 / 0.5)" : M.card,
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
                      style={{ width: "100%", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif", fontSize: "0.875rem", color: M.ink, lineHeight: 1.6, padding: "4px 6px", border: `1px solid ${M.coralBdr}`, borderRadius: 4, outline: "none", resize: "none", overflow: "hidden", background: "oklch(0.995 0.008 355)" }}
                    />
                  ) : (
                    <p
                      className={cn("text-sm leading-relaxed", entry.converted && "line-through")}
                      style={{ color: entry.converted ? M.muted : M.ink, fontFamily: "'DM Sans', sans-serif", cursor: entry.converted ? "default" : "text", whiteSpace: "pre-wrap" }}
                      onClick={() => { if (!entry.converted) { setEditingId(entry.id); setEditText(entry.text); } }}
                      title={entry.converted ? "" : "Click to edit"}
                    >
                      {entry.text.replace(/(?:^|\s)#[a-zA-Z0-9\u4e00-\u9fa5_-]+/g, "").trim()}
                    </p>
                  )}
                  <p className="text-xs mt-1" style={{ color: M.muted, fontFamily: "'DM Sans', sans-serif" }}>
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
                  <span className="text-xs shrink-0" style={{ color: M.sage, fontFamily: "'DM Sans', sans-serif" }}>→ Task</span>
                )}
              </div>

              {entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1" style={{ borderTop: `1px solid ${M.border}` }}>
                  {entry.tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                      className={cn("m-chip", activeTag === tag && "active")}
                      style={{ fontSize: "0.58rem" }}
                    >
                      <Hash className="w-2 h-2" />
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
