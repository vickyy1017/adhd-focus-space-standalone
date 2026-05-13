/*
  ADHD FOCUS SPACE — Global Timer Context
  Owns all timer state so the countdown persists across page navigation.
  Both the Dashboard mini-timer and the full Focus page read from this
  single source of truth.

  Pomodoro cycle:
    Focus → Short Break → Focus → Short Break →
    Focus → Short Break → Focus → Long Break → [STOP — full block done]
  
  Between phases: a 5-second "transition" countdown screen.
  After the 4th focus + long break: "block_complete" phase — timer stops.
*/

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

// ── Types ─────────────────────────────────────────────────────────────────────
export type TimerMode = "focus" | "short" | "long";
export type TimerPhase =
  | "idle"
  | "running"
  | "paused"
  | "complete"
  | "transition"   // 5-second auto-start countdown between phases
  | "block_complete" // all 4 focus rounds + long break done
  | "quit"
  | "recovering";
export type StripState = "attached" | "tearing" | "torn";

export const DEFAULT_DURATIONS: Record<TimerMode, number> = {
  focus: 25,
  short: 5,
  long: 15,
};
export const PRESETS: Record<TimerMode, number[]> = {
  focus: [15, 25, 45, 60],
  short: [3, 5, 10],
  long: [10, 15, 20, 30],
};
export const MODE_LABELS: Record<TimerMode, string> = {
  focus: "Focus",
  short: "Short Break",
  long: "Long Break",
};
export const MODE_COLORS: Record<TimerMode, string> = {
  focus: "oklch(0.12 0.01 20)",   // near-black
  short: "oklch(0.55 0.08 160)",   // sage green
  long: "oklch(0.52 0.06 220)",    // slate blue
};

export const DEFAULT_STRIPS = [
  "overthinking",
  "email backlog",
  "that awkward thing",
  "yesterday's worries",
  "the meeting dread",
  "unread messages",
  "tomorrow's anxiety",
  "the mental noise",
];

// ── Pomodoro sequence ─────────────────────────────────────────────────────────
// 8 steps: focus, short, focus, short, focus, short, focus, long
export const POMODORO_SEQUENCE: TimerMode[] = [
  "focus", "short",
  "focus", "short",
  "focus", "short",
  "focus", "long",
];

// ── Context shape ─────────────────────────────────────────────────────────────
export interface TimerContextValue {
  // State
  mode: TimerMode;
  phase: TimerPhase;
  running: boolean;
  remaining: number;
  sessions: number;         // focus sessions completed this block
  quitCount: number;
  durations: Record<TimerMode, number>;
  strips: string[];
  stripStates: StripState[];
  paperFlying: boolean;
  pomodoroStep: number;     // 0–7 index into POMODORO_SEQUENCE
  transitionCountdown: number; // 5→0 seconds before next phase auto-starts
  nextMode: TimerMode | null;  // what comes after the transition

  // Derived
  progress: number;
  totalSec: number;
  tornCount: number;
  stripsLeft: number;
  nextStripIdx: number;
  accentColor: string;

  // Actions
  handleStartPause: () => void;
  handleQuit: () => void;
  handleNewSession: () => void;   // start a fresh block from idle
  handleSkipTransition: () => void; // skip the 5-second countdown
  switchMode: (m: TimerMode) => void;
  applyDuration: (m: TimerMode, mins: number) => void;
  setCustomStrips: (s: string[] | ((prev: string[]) => string[])) => void;

  // Callbacks (set by consumers)
  setOnSessionComplete: (fn: (() => void) | null) => void;
  setOnBlockComplete: (fn: (() => void) | null) => void;
  setOnQuit: (fn: (() => void) | null) => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used inside TimerProvider");
  return ctx;
}

// ── Persistence helpers ───────────────────────────────────────────────────────
const TIMER_STORAGE_KEY = "adhd-timer-state";

interface PersistedTimerState {
  mode: TimerMode;
  phase: TimerPhase;
  remaining: number;
  running: boolean;
  sessions: number;
  pomodoroStep: number;
  durations: Record<TimerMode, number>;
  /** Wall-clock ms when the timer was last started (null if paused) */
  startedAt: number | null;
  /** Remaining seconds at the moment startedAt was recorded */
  remainingAtStart: number;
}

function loadTimerState(): PersistedTimerState | null {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedTimerState;
  } catch {
    return null;
  }
}

function clearTimerState() {
  localStorage.removeItem(TIMER_STORAGE_KEY);
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function TimerProvider({ children }: { children: React.ReactNode }) {
  // ── Rehydrate from localStorage on first render ──────────────────────────
  const saved = loadTimerState();

  // If the timer was running when the page was closed, calculate how much
  // time has elapsed since startedAt and compute the corrected remaining.
  let rehydratedRemaining = DEFAULT_DURATIONS.focus * 60;
  let rehydratedPhase: TimerPhase = "idle";
  let rehydratedRunning = false;

  if (saved) {
    if (saved.running && saved.startedAt !== null) {
      // Timer was running — fast-forward by elapsed wall-clock time
      const elapsedSinceClose = Math.floor((Date.now() - saved.startedAt) / 1000);
      const corrected = Math.max(0, saved.remainingAtStart - elapsedSinceClose);
      if (corrected <= 0) {
        // Session would have completed while the tab was closed — treat as complete
        rehydratedRemaining = 0;
        rehydratedPhase = "complete";
        rehydratedRunning = false;
      } else {
        rehydratedRemaining = corrected;
        rehydratedPhase = "running";
        rehydratedRunning = true;
      }
    } else if (saved.phase === "paused") {
      rehydratedRemaining = saved.remaining;
      rehydratedPhase = "paused";
      rehydratedRunning = false;
    } else if (
      saved.phase === "idle" ||
      saved.phase === "block_complete" ||
      saved.phase === "quit"
    ) {
      // Terminal states — restore but don't resume
      rehydratedRemaining = saved.remaining;
      rehydratedPhase = saved.phase;
      rehydratedRunning = false;
    }
  }

  const [durations, setDurations] = useState<Record<TimerMode, number>>(
    saved?.durations ?? { ...DEFAULT_DURATIONS }
  );
  const [mode, setMode] = useState<TimerMode>(saved?.mode ?? "focus");
  const [remaining, setRemaining] = useState(rehydratedRemaining);
  const [running, setRunning] = useState(rehydratedRunning);
  const [phase, setPhase] = useState<TimerPhase>(rehydratedPhase);
  const [sessions, setSessions] = useState(saved?.sessions ?? 0);
  const [quitCount, setQuitCount] = useState(0);
  const [pomodoroStep, setPomodoroStep] = useState(saved?.pomodoroStep ?? 0);
  const [transitionCountdown, setTransitionCountdown] = useState(5);
  const [nextMode, setNextMode] = useState<TimerMode | null>(null);

  const [customStrips, setCustomStrips] = useLocalStorage<string[]>(
    "adhd-focus-strips",
    DEFAULT_STRIPS
  );
  const strips = customStrips.length > 0 ? customStrips : DEFAULT_STRIPS;
  // Use a ref so startPhaseWithDurations always reads the latest strips
  // without causing stripStates to reinitialize on every customStrips change
  const stripsRef = useRef(strips);
  useEffect(() => { stripsRef.current = strips; }, [strips]);
  const [stripStates, setStripStates] = useState<StripState[]>(() =>
    strips.map(() => "attached" as StripState)
  );
  const [paperFlying, setPaperFlying] = useState(false);

  // Refs
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);
  // Initialise from saved state so the countdown interval is correct on rehydration
  const startedAtRef = useRef<number | null>(
    saved?.running && saved?.startedAt ? Date.now() - (saved.remainingAtStart - rehydratedRemaining) * 1000 : null
  );
  const remainingAtStartRef = useRef<number>(rehydratedRemaining);
  // Always mirrors the latest `remaining` state so the countdown useEffect
  // can read the true current value without a stale closure.
  const remainingRef = useRef<number>(rehydratedRemaining);
  const onSessionCompleteRef = useRef<(() => void) | null>(null);
  const onBlockCompleteRef = useRef<(() => void) | null>(null);
  const onQuitRef = useRef<(() => void) | null>(null);

  // Keep remainingRef in sync with state
  useEffect(() => { remainingRef.current = remaining; }, [remaining]);

  // Derived
  const totalSec = durations[mode] * 60;
  const progress = totalSec > 0 ? (totalSec - remaining) / totalSec : 0;
  const stripsToTear = Math.floor(progress * strips.length);
  const tornCount = stripStates.filter(
    (s) => s === "torn" || s === "tearing"
  ).length;
  const stripsLeft = strips.length - tornCount;
  const nextStripIdx = stripStates.findIndex((s) => s === "attached");
  const accentColor = MODE_COLORS[mode];

  // ── Persist timer state to localStorage ───────────────────────────────────────────────────────
  useEffect(() => {
    // Clear on terminal states so a fresh session always starts clean
    if (phase === "idle" || phase === "quit" || phase === "block_complete") {
      clearTimerState();
      return;
    }
    // Save a snapshot so we can resume after a page refresh
    const snapshot: PersistedTimerState = {
      mode,
      phase,
      remaining,
      running,
      sessions,
      pomodoroStep,
      durations,
      startedAt: running ? startedAtRef.current : null,
      remainingAtStart: remainingAtStartRef.current,
    };
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(snapshot));
  }, [mode, phase, remaining, running, sessions, pomodoroStep, durations]);

  // ── Browser tab title countdown ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const appTitle = "ADHD Focus Space";
    if (phase === "running" || phase === "paused") {
      const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
      const ss = String(remaining % 60).padStart(2, "0");
      const label = mode === "focus" ? "Focus" : mode === "short" ? "Short Break" : "Long Break";
      const pausedMark = phase === "paused" ? "⏸ " : "";
      document.title = `${pausedMark}${mm}:${ss} · ${label}`;
    } else if (phase === "transition") {
      document.title = `⏭ Next up… · ${appTitle}`;
    } else if (phase === "block_complete") {
      document.title = `✅ Block Complete! · ${appTitle}`;
    } else {
      document.title = appTitle;
    }
    return () => { document.title = appTitle; };
  }, [phase, remaining, mode]);

  // ── Strip tear progression ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "running") return;
    // Count both "torn" and "tearing" so we don't cascade-tear while animation is in flight
    const currentTorn = stripStates.filter((s) => s === "torn" || s === "tearing").length;
    if (stripsToTear > currentTorn) {
      const nextIdx = stripStates.findIndex((s) => s === "attached");
      if (nextIdx !== -1) {
        setStripStates((prev) => {
          const next = [...prev];
          next[nextIdx] = "tearing";
          return next;
        });
        setTimeout(() => {
          setStripStates((prev) => {
            const next = [...prev];
            if (next[nextIdx] === "tearing") next[nextIdx] = "torn";
            return next;
          });
        }, 1020);
      }
    }
  }, [stripsToTear, phase, stripStates]);

  // ── Start next phase after transition ─────────────────────────────────────
  // startPhase is superseded by startPhaseWithDurations below — kept as no-op
  const startPhase = useCallback((_m: TimerMode, _step: number) => {
    // intentionally empty — use startPhaseWithDurations
  }, []);

  // We need durations in startPhase — use a ref to avoid stale closure
  const durationsRef = useRef(durations);
  useEffect(() => { durationsRef.current = durations; }, [durations]);

  const startPhaseWithDurations = useCallback((m: TimerMode, step: number) => {
    const secs = durationsRef.current[m] * 60;
    setMode(m);
    setRemaining(secs);
    remainingAtStartRef.current = secs;
    setPhase("running");
    setRunning(true);
    setPomodoroStep(step);
    setPaperFlying(false);
    completedRef.current = false;
    if (m === "focus") {
      setStripStates(stripsRef.current.map(() => "attached" as StripState));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // stripsRef is a ref — stable reference, no dependency needed

  // ── Transition countdown ───────────────────────────────────────────────────
  const startTransition = useCallback((toMode: TimerMode, toStep: number) => {
    if (transitionRef.current) clearInterval(transitionRef.current);
    setNextMode(toMode);
    setTransitionCountdown(5);
    setPhase("transition");
    let count = 5;
    transitionRef.current = setInterval(() => {
      count -= 1;
      setTransitionCountdown(count);
      if (count <= 0) {
        clearInterval(transitionRef.current!);
        startPhaseWithDurations(toMode, toStep);
      }
    }, 1000);
  }, [startPhaseWithDurations]);

  const handleSkipTransition = useCallback(() => {
    if (transitionRef.current) clearInterval(transitionRef.current);
    if (nextMode !== null) {
      const step = POMODORO_SEQUENCE.indexOf(nextMode, pomodoroStep);
      startPhaseWithDurations(nextMode, step >= 0 ? step : pomodoroStep);
    }
  }, [nextMode, pomodoroStep, startPhaseWithDurations]);

  // ── Complete handler ───────────────────────────────────────────────────────
  const handleComplete = useCallback(
    (natural = true) => {
      setRunning(false);
      if (intervalRef.current) clearInterval(intervalRef.current);

      if (mode === "focus") {
        setSessions((s) => s + 1);
        if (natural && !completedRef.current) {
          completedRef.current = true;
          // Cascade tear remaining strips
          const remaining_strips = stripsRef.current
            .map((_: string, i: number) => i)
            .filter((i: number) => stripStates[i] === "attached");
          remaining_strips.forEach((idx: number, j: number) => {
            setTimeout(() => {
              setStripStates((prev) => {
                const next = [...prev];
                next[idx] = "tearing";
                return next;
              });
              setTimeout(() => {
                setStripStates((prev) => {
                  const next = [...prev];
                  if (next[idx] === "tearing") next[idx] = "torn";
                  return next;
                });
              }, 700);
            }, j * 200);
          });
          setTimeout(() => {
            setPaperFlying(true);
            setTimeout(() => {
              onSessionCompleteRef.current?.();
              // Determine next step in Pomodoro sequence
              const nextStep = pomodoroStep + 1;
              if (nextStep < POMODORO_SEQUENCE.length) {
                const nextM = POMODORO_SEQUENCE[nextStep];
                startTransition(nextM, nextStep);
              } else {
                // All 8 steps done — full block complete
                setPhase("block_complete");
                onBlockCompleteRef.current?.();
              }
            }, 900);
          }, remaining_strips.length * 200 + 400);
        } else {
          // Non-natural complete (e.g. forced)
          onSessionCompleteRef.current?.();
          const nextStep = pomodoroStep + 1;
          if (nextStep < POMODORO_SEQUENCE.length) {
            startTransition(POMODORO_SEQUENCE[nextStep], nextStep);
          } else {
            setPhase("block_complete");
            onBlockCompleteRef.current?.();
          }
        }
      } else {
        // Break complete — move to next step
        const nextStep = pomodoroStep + 1;
        if (nextStep < POMODORO_SEQUENCE.length) {
          startTransition(POMODORO_SEQUENCE[nextStep], nextStep);
        } else {
          // After the long break at step 7 — block complete
          setPhase("block_complete");
          onBlockCompleteRef.current?.();
        }
      }
    },
    [mode, strips, stripStates, pomodoroStep, startTransition]
  );

  // ── Timestamp-based countdown ──────────────────────────────────────────────
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    startedAtRef.current = Date.now();
    // Use the ref (not the stale closure value) so we always start from the
    // true current remaining seconds, even if React batched the state update.
    remainingAtStartRef.current = remainingRef.current;

    intervalRef.current = setInterval(() => {
      if (startedAtRef.current === null) return;
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const newRemaining = Math.max(0, remainingAtStartRef.current - elapsed);
      setRemaining(newRemaining);
      if (newRemaining <= 0) {
        clearInterval(intervalRef.current!);
        handleComplete(true);
      }
    }, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const resetStrips = () =>
    setStripStates(stripsRef.current.map(() => "attached" as StripState));

  const switchMode = (m: TimerMode) => {
    if (running || phase === "transition") return;
    setMode(m);
    setRemaining(durations[m] * 60);
    setPhase("idle");
    resetStrips();
    setPaperFlying(false);
    completedRef.current = false;
    // Reset Pomodoro to start of that mode
    const idx = POMODORO_SEQUENCE.indexOf(m);
    setPomodoroStep(idx >= 0 ? idx : 0);
  };

  const applyDuration = (m: TimerMode, mins: number) => {
    const v = Math.max(1, Math.min(180, mins));
    setDurations((d) => ({ ...d, [m]: v }));
    if (m === mode) {
      setRunning(false);
      setRemaining(v * 60);
      setPhase("idle");
      resetStrips();
    }
  };

  const handleStartPause = () => {
    if (
      phase === "complete" ||
      phase === "quit" ||
      phase === "recovering" ||
      phase === "transition" ||
      phase === "block_complete"
    )
      return;
    const next = !running;
    if (!next && startedAtRef.current !== null) {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const snapped = Math.max(0, remainingAtStartRef.current - elapsed);
      setRemaining(snapped);
      remainingAtStartRef.current = snapped;
    }
    setRunning(next);
    setPhase(next ? "running" : "paused");
  };

  const handleQuit = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (transitionRef.current) clearInterval(transitionRef.current);
    setRunning(false);
    setQuitCount((q) => q + 1);
    onQuitRef.current?.();
    setPaperFlying(false);
    setPhase("recovering");
    setTimeout(() => setPhase("quit"), 400);
  };

  const handleNewSession = () => {
    if (transitionRef.current) clearInterval(transitionRef.current);
    setRemaining(durations["focus"] * 60);
    setMode("focus");
    setPhase("idle");
    resetStrips();
    setPaperFlying(false);
    completedRef.current = false;
    setPomodoroStep(0);
    setSessions(0);
    setNextMode(null);
    setTransitionCountdown(5);
  };

  const setOnSessionComplete = (fn: (() => void) | null) => {
    onSessionCompleteRef.current = fn;
  };
  const setOnBlockComplete = (fn: (() => void) | null) => {
    onBlockCompleteRef.current = fn;
  };
  const setOnQuit = (fn: (() => void) | null) => {
    onQuitRef.current = fn;
  };

  const value: TimerContextValue = {
    mode,
    phase,
    running,
    remaining,
    sessions,
    quitCount,
    durations,
    strips,
    stripStates,
    paperFlying,
    pomodoroStep,
    transitionCountdown,
    nextMode,
    progress,
    totalSec,
    tornCount,
    stripsLeft,
    nextStripIdx,
    accentColor,
    handleStartPause,
    handleQuit,
    handleNewSession,
    handleSkipTransition,
    switchMode,
    applyDuration,
    setCustomStrips,
    setOnSessionComplete,
    setOnBlockComplete,
    setOnQuit,
  };

  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
}
