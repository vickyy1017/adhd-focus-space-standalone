/* ============================================================
   ADHD FOCUS SPACE — useUserData hook v1.0
   Syncs all user app data to/from the server database.
   Strategy:
   - On login: load from DB; if DB empty, migrate from localStorage
   - On any change: debounced PATCH to DB (300ms)
   - localStorage kept as offline cache / fallback
   ============================================================ */

import { useState, useEffect, useCallback, useRef } from "react";
import type { Task } from "@/components/TaskManager";

export interface BrainDumpEntry {
  id: string;
  text: string;
  tags: string[];
  createdAt: string;
  converted: boolean;
}

export interface UserAppData {
  tasks: Task[];
  brain_dump: BrainDumpEntry[];
  focus_sessions: Record<string, unknown[]>;
  daily_logs: Record<string, unknown>;
  quick_chips: string[];
  quadrant_map: Record<string, string>;
  quadrant_task_order: Record<string, number>;
  calendar_day_order: Record<string, string[]>;
  deleted_categories: string[];
  display_name: string | null;
}

const DEFAULT_DATA: UserAppData = {
  tasks: [],
  brain_dump: [],
  focus_sessions: {},
  daily_logs: {},
  quick_chips: [],
  quadrant_map: {},
  quadrant_task_order: {},
  calendar_day_order: {},
  deleted_categories: [],
  display_name: null,
};

// Read localStorage safely
function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
}

// Collect existing localStorage data for migration
function collectLocalStorageData(): Partial<UserAppData> {
  return {
    tasks: readLS<Task[]>("adhd-tasks", []),
    brain_dump: readLS<BrainDumpEntry[]>("adhd_braindump_entries", []),
    focus_sessions: readLS("adhd-focus-session-list", {}),
    daily_logs: readLS("adhd-daily-logs", {}),
    quick_chips: readLS<string[]>("adhd-quick-chips", []),
    quadrant_map: readLS("adhd-quadrant-map", {}),
    quadrant_task_order: readLS("adhd-quadrant-task-order", {}),
    calendar_day_order: readLS("adhd-calendar-day-order", {}),
    deleted_categories: readLS<string[]>("adhd-deleted-categories", []),
    display_name: localStorage.getItem("adhd-display-name"),
  };
}

function hasLocalData(data: Partial<UserAppData>): boolean {
  return (data.tasks?.length ?? 0) > 0 || !!data.display_name;
}

function syncToLocalStorage(d: UserAppData) {
  try {
    localStorage.setItem("adhd-tasks", JSON.stringify(d.tasks));
    localStorage.setItem("adhd_braindump_entries", JSON.stringify(d.brain_dump));
    localStorage.setItem("adhd-focus-session-list", JSON.stringify(d.focus_sessions));
    localStorage.setItem("adhd-daily-logs", JSON.stringify(d.daily_logs));
    localStorage.setItem("adhd-quick-chips", JSON.stringify(d.quick_chips));
    localStorage.setItem("adhd-quadrant-map", JSON.stringify(d.quadrant_map));
    localStorage.setItem("adhd-quadrant-task-order", JSON.stringify(d.quadrant_task_order));
    localStorage.setItem("adhd-calendar-day-order", JSON.stringify(d.calendar_day_order));
    localStorage.setItem("adhd-deleted-categories", JSON.stringify(d.deleted_categories));
    if (d.display_name) localStorage.setItem("adhd-display-name", d.display_name);
  } catch { /* ignore */ }
}

export type DataStatus = "loading" | "ready" | "error";

export function useUserData(userId: string | null) {
  const [data, setDataRaw] = useState<UserAppData>(DEFAULT_DATA);
  const [status, setStatus] = useState<DataStatus>("loading");
  const initialized = useRef(false);
  const patchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Debounced PATCH to server
  const patchField = useCallback((field: string, value: unknown) => {
    if (!userId) return;
    if (patchTimers.current[field]) clearTimeout(patchTimers.current[field]);
    patchTimers.current[field] = setTimeout(async () => {
      try {
        await fetch("/api/user-data", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ field, value }),
        });
      } catch { /* silent fail — data in localStorage */ }
    }, 300);
  }, [userId]);

  // Load data on login
  useEffect(() => {
    if (!userId || initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        const res = await fetch("/api/user-data", { credentials: "include" });
        if (!res.ok) throw new Error("fetch failed");
        const json = await res.json();

        if (json.exists && json.data) {
          const row = json.data;
          const loaded: UserAppData = {
            tasks: row.tasks ?? [],
            brain_dump: row.brain_dump ?? [],
            focus_sessions: row.focus_sessions ?? {},
            daily_logs: row.daily_logs ?? {},
            quick_chips: row.quick_chips ?? [],
            quadrant_map: row.quadrant_map ?? {},
            quadrant_task_order: row.quadrant_task_order ?? {},
            calendar_day_order: row.calendar_day_order ?? {},
            deleted_categories: row.deleted_categories ?? [],
            display_name: row.display_name ?? null,
          };
          setDataRaw(loaded);
          syncToLocalStorage(loaded);
        } else {
          // DB empty — migrate from localStorage
          const local = collectLocalStorageData();
          if (hasLocalData(local)) {
            const merged = { ...DEFAULT_DATA, ...local };
            setDataRaw(merged);
            // Upload to DB
            fetch("/api/user-data", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(merged),
            }).catch(() => {});
          } else {
            setDataRaw(DEFAULT_DATA);
          }
        }
        setStatus("ready");
      } catch {
        // Fallback to localStorage
        const local = collectLocalStorageData();
        setDataRaw({ ...DEFAULT_DATA, ...local });
        setStatus("ready");
      }
    })();
  }, [userId]);

  // Generic field setter — updates state + localStorage + DB
  function makeFieldSetter<K extends keyof UserAppData>(field: K) {
    return (value: UserAppData[K] | ((prev: UserAppData[K]) => UserAppData[K])) => {
      setDataRaw(prev => {
        const next = typeof value === "function"
          ? (value as (p: UserAppData[K]) => UserAppData[K])(prev[field])
          : value;
        const updated = { ...prev, [field]: next };
        // Update localStorage cache
        try {
          if (field === "display_name") {
            if (next) localStorage.setItem("adhd-display-name", next as string);
          } else if (field === "brain_dump") {
            localStorage.setItem("adhd_braindump_entries", JSON.stringify(next));
          } else {
            const lsKey = `adhd-${(field as string).replace(/_/g, "-")}`;
            localStorage.setItem(lsKey, JSON.stringify(next));
          }
        } catch { /* ignore */ }
        // Patch to DB
        patchField(field, next);
        return updated;
      });
    };
  }

  return {
    status,
    data,
    setTasks: makeFieldSetter("tasks"),
    setBrainDump: makeFieldSetter("brain_dump"),
    setFocusSessions: makeFieldSetter("focus_sessions"),
    setDailyLogs: makeFieldSetter("daily_logs"),
    setQuickChips: makeFieldSetter("quick_chips"),
    setQuadrantMap: makeFieldSetter("quadrant_map"),
    setQuadrantTaskOrder: makeFieldSetter("quadrant_task_order"),
    setCalendarDayOrder: makeFieldSetter("calendar_day_order"),
    setDeletedCategories: makeFieldSetter("deleted_categories"),
    setDisplayName: makeFieldSetter("display_name"),
  };
}
