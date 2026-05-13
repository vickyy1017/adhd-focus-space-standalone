/* ============================================================
   ADHD FOCUS SPACE — Home Page v3.0
   Design: Warm Editorial Minimalism + LocalStorage Persistence
   - All state persisted to localStorage
   - Focus page simplified with atmospheric sunset background
   - Less text, more geometric shapes
   ============================================================ */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Sidebar, TimerPill } from "@/components/Sidebar";
import { useMobile } from "@/hooks/useMobile";
import { Dashboard } from "@/components/Dashboard";
import { FocusTimer } from "@/components/FocusTimer";
import { TaskManager, type Task } from "@/components/TaskManager";
import { DailyPlanView } from "@/components/DailyPlanView";
import { BrainDump } from "@/components/BrainDump";
import { RetroPageWrapper } from "@/components/RetroPageWrapper";
import { GlobalQuickAdd } from "@/components/GlobalQuickAdd";
import { ConfettiCelebration } from "@/components/ConfettiCelebration";
import { DailyWrapUp } from "@/components/DailyWrapUp";
import { recordWrapUp, recordDumpEntry, recordFocusSession, recordBlockComplete } from "@/components/MonthlyProgress";
import { useUserData } from "@/hooks/useUserData";
import { useBlockStreak } from "@/hooks/useBlockStreak";
import { useOpenDayStreak } from "@/hooks/useOpenDayStreak";
import { useTimer } from "@/contexts/TimerContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { LoginScreen } from "@/components/LoginScreen";
import { nanoid } from "nanoid";
import {
  DashboardDecor,
  FocusDecor,
  TasksDecor,
  BrainDumpDecor,
} from "@/components/PageDecor";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Bot, Brain, Clock, LayoutDashboard, Moon, Sparkles, Star } from "lucide-react";
import { PixelDump } from "@/components/PixelIcons";

import Monthly from "@/pages/Monthly";
import { EffectsPanel } from "@/components/EffectsPanel";
import { EisenhowerMatrix, type QuadrantId } from "@/components/EisenhowerMatrix";



type Section = "dashboard" | "focus" | "tasks" | "dump" | "monthly" | "settings" | "matrix";

const SECTION_META: Record<Section, { title: string; icon: React.ElementType }> = {
  dashboard:  { title: "Dashboard",    icon: LayoutDashboard },
  focus:      { title: "Focus Timer",  icon: Clock           },
  tasks:      { title: "My Tasks",     icon: Star            },
  dump:       { title: "Brain Dump",   icon: Brain           },
  monthly:    { title: "Monthly Progress", icon: Star        },
  settings:   { title: "Settings",     icon: Star            },
  matrix:     { title: "Priority Matrix", icon: Star         },
};



const INITIAL_TASKS: Task[] = [
  { id: "1", text: "Review project proposal",   priority: "urgent", context: "work",     done: false, createdAt: new Date() },
  { id: "2", text: "Reply to important emails", priority: "focus",  context: "work",     done: false, createdAt: new Date() },
  { id: "3", text: "Take a 10-minute walk",     priority: "normal", context: "personal", done: false, createdAt: new Date() },
];


const SUNSET_WIDE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663410012773/WNs8kMVMKanwFbtYhk72en/adhd-sunset-wide_e4204b59.png";

export default function Home() {
  // URL-hash based section state — persists across refresh
  const [activeSection, setActiveSectionState] = useState<Section>(() => {
    const hash = window.location.hash.slice(1) as Section;
    const VALID = ["dashboard","focus","tasks","dump","monthly","settings","matrix"] as const;
    return (VALID as readonly string[]).includes(hash) ? hash as Section : "dashboard";
  });
  const setActiveSection = (s: Section) => {
    setActiveSectionState(s);
    window.location.hash = s === "dashboard" ? "" : s;
  };
  const { durations } = useTimer();
  const { user, loading: authLoading, setUser, logout } = useAuth();
  const isMobile = useMobile(); // Must be called before any early returns (React Hooks rules)
  const today = new Date().toDateString();

  // ── Name / personalisation (from DB via useUserData) ──


  // Listen for navigateTo events
  React.useEffect(() => {
    function onNavigateTo(e: Event) {
      const section = (e as CustomEvent).detail as Section;
      if (section) setActiveSection(section);
    }
    window.addEventListener("navigateTo", onNavigateTo);
    return () => window.removeEventListener("navigateTo", onNavigateTo);
  }, []);

  // ── All data synced to DB via useUserData ─────────────────────────────────
  const {
    status: dataStatus,
    data: userData,
    setTasks,
    setBrainDump,
    setFocusSessions: setDbFocusSessions,
    setDailyLogs,
    setQuickChips,
    setQuadrantMap,
    setQuadrantTaskOrder,
    setCalendarDayOrder,
    setDeletedCategories,
    setDisplayName: setDbDisplayName,
  } = useUserData(user?.id ?? null);

  const tasks = userData.tasks;
  const deletedCategories = userData.deleted_categories;

  const focusSessionsToday = (() => {
    try {
      const sessions = userData.focus_sessions as Record<string, unknown[]>;
      return (sessions[today] ?? []).length;
    } catch { return 0; }
  })();

  // ── Transient state ──
  const [focusSessions, setFocusSessionsCount] = useState(focusSessionsToday);
  useEffect(() => { setFocusSessionsCount(focusSessionsToday); }, [focusSessionsToday]);

  const { streak: blockStreak, history: blockHistory, recordBlock } = useBlockStreak();
  const { streak: openDayStreak } = useOpenDayStreak();
  const [timerQuitCount, setTimerQuitCount] = useState(0);
  const [confettiTrigger, setConfettiTrigger] = useState(false);
  const [wrapUpOpen, setWrapUpOpen] = useState(false);
  const [pendingDump, setPendingDump] = useState<string | null>(null);
  const [dashboardKey, setDashboardKey] = useState(0);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setDashboardKey(k => k + 1);
    };
    window.addEventListener("adhd-storage-update", handler);
    return () => window.removeEventListener("adhd-storage-update", handler);
  }, []);

  /* ── Task completion with confetti + goal auto-nudge ── */
  const handleTasksChange = (newTasks: Task[]) => {
    // Detect newly completed tasks (just marked done)
    const newlyDone = newTasks.filter(
      (t) => t.done && !tasks.find((old) => old.id === t.id)?.done
    );
    // Detect tasks that were undone (done → not done)
    const newlyUndone = newTasks.filter(
      (t) => !t.done && tasks.find((old) => old.id === t.id)?.done
    );
    // Detect deleted tasks (in old list but not in new list)
    const deletedTasks = tasks.filter((old) => !newTasks.find((t) => t.id === old.id));

    if (newlyDone.length > 0) {
      setConfettiTrigger(true);
    }

    setTasks(newTasks);
  };

  const handleSessionComplete = () => {
    recordFocusSession(durations.focus);
    setConfettiTrigger(true);
    setFocusSessionsCount((s) => s + 1);
    // Accumulate focusMins in daily-logs for Monthly stats
    setDailyLogs((prev: any) => {
      const dk = new Date().toDateString();
      const day = prev[dk] ?? { dateKey: dk };
      return { ...prev, [dk]: { ...day, focusMins: ((day.focusMins ?? 0) as number) + durations.focus } };
    });
  };

  const handleBlockComplete = () => {
    recordBlockComplete();
    const totalMins = durations.focus * 4;
    const focusLabel = totalMins >= 60
      ? `${Math.floor(totalMins / 60)}h${totalMins % 60 > 0 ? ` ${totalMins % 60}min` : ""}`
      : `${totalMins}min`;
    setFocusSessionsCount(0);
    recordBlock();
  };

  const handleConvertToTask = (task: Task) => {
    setTasks((prev) => [task, ...prev]);
  };

  const handleDumpEntry = (task: Task) => {
    recordDumpEntry();
    handleConvertToTask(task);
  };

  // Guard: if activeSection is a stale value (e.g. 'ai' removed from nav), reset to dashboard
  const VALID_SECTIONS = Object.keys(SECTION_META) as Section[];
  const safeSection: Section = VALID_SECTIONS.includes(activeSection) ? activeSection : "dashboard";
  useEffect(() => {
    if (!VALID_SECTIONS.includes(activeSection)) setActiveSection("dashboard");
  }, [activeSection]);
  const meta = SECTION_META[safeSection];
  const Icon = meta.icon;
  const runningAgents = 0; // Agents removed

  // ── Unified category system ──
  const isValidContext = (c: unknown): c is string =>
    typeof c === "string" && c.length > 0 && c !== "null" && c !== "undefined";
  const allItemContexts = new Set([
    ...tasks.map((t) => t.context).filter(isValidContext),
  ]);
  const allCategories = Array.from(new Set([
    "work", "personal",
    ...Array.from(allItemContexts),
  ])).filter(isValidContext).filter((c) => {
    if (deletedCategories.includes(c)) return false;
    // Always keep builtins; auto-remove custom tags with no items
    if (c === "work" || c === "personal") return true;
    return allItemContexts.has(c);
  });

  /** Clear all test data */
  const handleClearTestData = () => {
    if (!confirm("Clear all tasks? This cannot be undone.")) return;
    setTasks([]);
    setDeletedCategories([]);
    setTimeout(() => { window.location.reload(); }, 300);
  };

  /** Delete a custom category: reassign all its items to "personal", then hide the tag */
  const handleDeleteCategory = (ctx: string) => {
    if (ctx === "work" || ctx === "personal") return;
    setTasks((prev) => prev.map((t) => t.context === ctx ? { ...t, context: "personal" } : t));
    setDeletedCategories((prev) => [...prev, ctx]);
  };

  // ── Show login screen until auth check completes ─────────────────────────
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "oklch(0.96 0.025 355)" }}>
        <span style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.65rem", color: "oklch(0.62 0.060 330)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Loading…
        </span>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={(u) => setUser(u)} />;
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar — desktop only (left); mobile renders bottom tab bar */}
      <Sidebar activeSection={activeSection} onSectionChange={(s) => setActiveSection(s as Section)} onClearData={handleClearTestData} />

      {/* Main content */}
      <main className={isMobile ? "flex-1 min-h-screen flex flex-col" : "flex-1 ml-14 min-h-screen flex flex-col"}>
        {/* Top header bar — Nori minimal style (hidden on mobile, tab bar shows page name) */}
        {!isMobile && <header
          className="sticky top-0 z-30 flex items-center justify-between"
          style={{
            background: "oklch(1 0 0)",
            borderBottom: "1px solid oklch(0.88 0.005 20)",
            minHeight: 52,
            padding: "0 24px",
          }}
        >
          {/* Left: page title */}
          <div className="flex items-center gap-2">
            <h1 style={{
              fontFamily: "'Pretendard', system-ui, sans-serif",
              fontSize: "1.1rem",
              fontWeight: 900,
              color: "oklch(0.12 0.01 20)",
              margin: 0,
              lineHeight: 1,
            }}>
              {meta.title}
            </h1>
          </div>

          {/* Right: tasks count + wrap-up */}
          <div className="flex items-center gap-3">
            {/* Tasks left */}
            <button
              onClick={() => setActiveSection("tasks" as Section)}
              style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
            >
              <span style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.85rem", fontWeight: 700, color: "oklch(0.12 0.01 20)" }}>
                {tasks.filter((t) => !t.done && (!t.dueDate || t.dueDate === new Date().toISOString().slice(0, 10))).length}
              </span>
              <span style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.65rem", fontWeight: 500, color: "oklch(0.52 0.01 20)" }}>left</span>
            </button>
            {/* Wrap-up */}
            <button
              onClick={() => setWrapUpOpen(true)}
              style={{
                background: "oklch(0.12 0.01 20)",
                color: "oklch(1 0 0)",
                border: "none",
                borderRadius: 9999,
                padding: "6px 14px",
                fontFamily: "'Pretendard', system-ui, sans-serif",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Moon className="w-3 h-3" />
              <span>Wrap up</span>
            </button>
          </div>
        </header>}

        {/* Page content */}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            padding: isMobile ? "12px 12px" : "32px",
            paddingBottom: isMobile ? "calc(72px + env(safe-area-inset-bottom, 0px))" : "32px",
          }}
        >
          <div className={cn("mx-auto", activeSection === "dashboard" ? "max-w-7xl" : "max-w-3xl")}>

            {activeSection === "dashboard" && (
              <div className="relative">
                <DashboardDecor />
              <Dashboard
                tasks={tasks}
                wins={[]}
                goals={[]}
                agents={[]}
                mood={null}
                displayName={userData.display_name || undefined}
                blockStreak={openDayStreak}
                blockHistory={blockHistory}
                onNavigate={(s) => setActiveSection(s as Section)}
                onSessionComplete={handleSessionComplete}
                onBlockComplete={handleBlockComplete}
                focusSessions={focusSessions}
                allCategories={allCategories}
                onQuickDump={(text) => setPendingDump(text)}
                onTasksChange={handleTasksChange}
                onTaskToggle={(id) => {
                  const updated = tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t);
                  handleTasksChange(updated);
                }}
                onTaskCreate={(task) => setTasks((prev) => [task, ...prev])}
                onGoalCreate={() => {}}
                onAgentCreate={() => {}}
                onWinCreate={() => {}}
                onDumpCreate={(text) => {
                  setBrainDump((prev: any) => [
                    { id: `dump-${Date.now()}`, text, tags: [], createdAt: new Date().toISOString(), converted: false },
                    ...prev,
                  ]);
                }}
              />
              </div>
            )}

            {activeSection === "focus" && (
              <div className="relative" style={{ padding: isMobile ? "12px 0" : "32px 16px", minHeight: isMobile ? "auto" : 700, overflow: "visible" }}>
                <FocusDecor />

                {/* ── Speech bubble — top-left decorative (desktop only) ── */}
                {!isMobile && <div style={{
                  position: "absolute",
                  top: 18,
                  left: 12,
                  zIndex: 10,
                  transform: "rotate(-2deg)",
                  pointerEvents: "none",
                  userSelect: "none",
                }}>
                  {/* Stars */}
                  <div style={{ position: "absolute", top: -14, left: 8, fontSize: 11, color: "oklch(0.62 0.18 355)" }}>✦</div>
                  <div style={{ position: "absolute", top: -6, left: 28, fontSize: 8, color: "oklch(0.62 0.18 355)" }}>✦</div>
                  <div style={{ position: "absolute", bottom: -8, left: 4, fontSize: 14, color: "oklch(0.82 0.08 10)" }}>★</div>
                  {/* Bubble */}
                  <div style={{
                    background: "oklch(0.985 0.010 355)",
                    border: "1.5px solid oklch(0.72 0.14 340)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    maxWidth: 148,
                    position: "relative",
                    boxShadow: "2px 2px 0 oklch(0.72 0.14 340 / 0.30)",
                  }}>
                    <p style={{
                      fontFamily: "'Pretendard', system-ui, sans-serif",
                      fontSize: 10,
                      lineHeight: 1.55,
                      color: "oklch(0.38 0.18 340)",
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                      margin: 0,
                    }}>let it go,<br />so you can<br />grow.</p>
                    {/* Tail pointing right-down */}
                    <div style={{
                      position: "absolute",
                      bottom: -10,
                      right: 18,
                      width: 0,
                      height: 0,
                      borderLeft: "8px solid transparent",
                      borderRight: "0px solid transparent",
                      borderTop: "10px solid oklch(0.72 0.14 340)",
                    }} />
                    <div style={{
                      position: "absolute",
                      bottom: -8,
                      right: 19,
                      width: 0,
                      height: 0,
                      borderLeft: "7px solid transparent",
                      borderRight: "0px solid transparent",
                      borderTop: "9px solid oklch(0.985 0.010 355)",
                    }} />
                  </div>
                </div>}

                {/* ── Main focus_timer.exe window — slight tilt left (desktop only) ── */}
                <div style={{
                  position: "relative",
                  zIndex: 2,
                  transform: isMobile ? "none" : "rotate(-1deg)",
                  transformOrigin: "top center",
                  marginLeft: "auto",
                  marginRight: "auto",
                  maxWidth: isMobile ? "100%" : 660,
                }}>
                  <FocusTimer onSessionComplete={handleSessionComplete} onBlockComplete={handleBlockComplete} onQuit={() => setTimerQuitCount(q => q + 1)} />
                </div>

                {/* ── session_tips.txt window — bottom-right corner (desktop), normal flow (mobile) ── */}
                {!isMobile && <div style={{
                  position: "relative",
                  zIndex: 1,
                  width: 210,
                  marginTop: -36,
                  marginLeft: "auto",
                  marginRight: -48,
                  transform: "rotate(2deg)",
                  transformOrigin: "top right",
                  boxShadow: "4px 4px 0 rgba(180,60,120,0.15)",
                }}>
                  <RetroPageWrapper title="session_tips.txt" sticker="leaf">
                    <div style={{ padding: "10px 14px 12px" }}>
                      <p className="editorial-label mb-3">Session tips</p>
                      <div className="space-y-2">
                        {[
                          "Phone face-down or in another room",
                          "Close all unneeded browser tabs",
                          "Use Brain Dump for distracting thoughts",
                        ].map((tip, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <div
                              className="w-1 h-1 mt-1.5 shrink-0"
                              style={{ background: "oklch(0.82 0.08 10)", transform: "rotate(45deg)" }}
                            />
                            <p className="text-xs" style={{ color: "oklch(0.45 0.04 330)" }}>{tip}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </RetroPageWrapper>
                </div>}
              </div>
            )}

            {activeSection === "tasks" && (
              <div style={{ padding: isMobile ? "12px" : "24px" }}>
                <DailyPlanView
                  tasks={tasks}
                  onTasksChange={handleTasksChange}
                />
              </div>
            )}



            {activeSection === "dump" && (
              <RetroPageWrapper title="dump.txt" sticker="star">
              <div className="flex flex-col relative overflow-hidden" style={{ padding: isMobile ? "12px" : "32px", minHeight: isMobile ? "auto" : 600 }}>
                <BrainDumpDecor />
                <div className="relative z-10">
                  <BrainDump
                    onConvertToTask={handleConvertToTask}
                    onDump={() => recordDumpEntry()}
                    initialText={pendingDump ?? undefined}
                    onInitialTextConsumed={() => setPendingDump(null)}
                    externalEntries={userData.brain_dump as any}
                    onExternalEntriesChange={(entries) => setBrainDump(entries as any)}
                  />
                </div>
              </div>
              </RetroPageWrapper>
            )}

            {activeSection === "monthly" && (
              <Monthly embedded onNavigate={(s) => setActiveSection(s as Section)} />
            )}

            {activeSection === "matrix" && (
              <div style={{ padding: isMobile ? "12px" : "24px" }}>
                <EisenhowerMatrix
                  tasks={tasks}
                  onTasksChange={handleTasksChange}
                  quadrantMap={userData.quadrant_map as Record<string, QuadrantId> ?? {}}
                  onQuadrantMapChange={(map) => setQuadrantMap(map)}
                />
              </div>
            )}

            {activeSection === "settings" && (
              <div style={{ padding: isMobile ? "16px" : "32px", maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

                {/* ── Account ── */}
                <div style={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.88 0.005 20)", borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ background: "oklch(0.96 0.002 20)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid oklch(0.88 0.005 20)" }}>
                    <span style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 13, fontWeight: 700, color: "oklch(0.12 0.01 20)" }}>account.txt</span>
                  </div>
                  <div style={{ padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <p style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.95rem", fontWeight: 600, color: "oklch(0.12 0.01 20)", marginBottom: 2 }}>
                          {user?.name || "User"}
                        </p>
                        <p style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.78rem", color: "oklch(0.52 0.01 20)" }}>{user?.id ?? ""}</p>
                      </div>
                      <button
                        onClick={async () => {
                          await logout();
                          window.location.reload();
                        }}
                        style={{
                          fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: "0.55rem", letterSpacing: "0.10em",
                          padding: "6px 14px", borderRadius: 6, cursor: "pointer",
                          border: "1px solid oklch(0.72 0.10 25)",
                          background: "transparent", color: "oklch(0.52 0.14 25)",
                          whiteSpace: "nowrap", flexShrink: 0,
                        }}
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Appearance ── */}
                <div style={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.88 0.005 20)", borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ background: "oklch(0.96 0.002 20)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid oklch(0.88 0.005 20)" }}>
                    <span style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 13, fontWeight: 700, color: "oklch(0.12 0.01 20)" }}>appearance.txt</span>
                  </div>
                  <div style={{ padding: "16px" }}>
                    <EffectsPanel embedded settingsOnly />
                  </div>
                </div>

                {/* ── Gemini API Key ── */}
                <div style={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.88 0.005 20)", borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ background: "oklch(0.96 0.002 20)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid oklch(0.88 0.005 20)" }}>
                    <span style={{ fontFamily: "'Pretendard', system-ui, sans-serif", fontSize: 13, fontWeight: 700, color: "oklch(0.12 0.01 20)" }}>gemini_api.txt</span>
                  </div>
                  <div style={{ padding: "16px" }}>
                    <EffectsPanel embedded apiKeyOnly />
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Global overlays ── */}
      <GlobalQuickAdd
        onAddTask={(t) => setTasks((p) => [t, ...p])}
        onAddGoal={() => {}}
        onAddWin={() => {}}
        onAddDump={(text) => { setPendingDump(text); }}
      />
      <ConfettiCelebration trigger={confettiTrigger} onComplete={() => setConfettiTrigger(false)} />

      {wrapUpOpen && (
        <DailyWrapUp
          tasks={tasks}
          wins={[]}
          quitCount={timerQuitCount}
          onClose={() => {
            const todayDone = tasks.filter(t => t.done && new Date(t.createdAt).toDateString() === new Date().toDateString());
            const score = Math.min(100, todayDone.length * 20 + 20);
            recordWrapUp(null, score);
            setWrapUpOpen(false);
          }}
        />
      )}



    </div>
  );
}
