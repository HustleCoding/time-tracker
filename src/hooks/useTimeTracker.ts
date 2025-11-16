import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { initializeDatabase } from "../lib/database";
import type { TimeEntry } from "../types/time-entry";

type RawTimeEntry = {
  id: number;
  project_name: string;
  start_time: number;
  end_time: number;
  duration: number;
};

const toTimeEntry = (raw: RawTimeEntry): TimeEntry => ({
  id: raw.id,
  projectName: raw.project_name,
  startTime: raw.start_time,
  endTime: raw.end_time,
  duration: raw.duration,
});

type TimerStatus = {
  is_running: boolean;
  project_name: string | null;
  start_time: number | null;
  elapsed_seconds: number | null;
};

const TIMER_STATUS_EVENT = "timer://status";

const parseError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Something went wrong. Please try again.";
};

export function useTimeTracker() {
  const [projectName, setProjectName] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [startTimestamp, setStartTimestamp] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wasRunningRef = useRef(false);

  const loadEntries = useCallback(async () => {
    const rawEntries = await invoke<RawTimeEntry[]>("get_today_entries");
    setEntries(rawEntries.map(toTimeEntry));
  }, []);

  const loadTodayTotal = useCallback(async () => {
    const total = await invoke<number>("get_today_total");
    setTodayTotal(Math.max(0, total));
  }, []);

  const refreshEntries = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadEntries(), loadTodayTotal()]);
      setError(null);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsRefreshing(false);
    }
  }, [loadEntries, loadTodayTotal]);

  const applyStatus = useCallback(
    async (status: TimerStatus) => {
      const running = status.is_running;
      const wasRunning = wasRunningRef.current;

      setIsRunning(running);

      if (running) {
        const startSeconds =
          typeof status.start_time === "number" ? status.start_time : Math.floor(Date.now() / 1000);
        setStartTimestamp(startSeconds * 1000);
        const elapsed =
          typeof status.elapsed_seconds === "number"
            ? Math.max(0, status.elapsed_seconds)
            : Math.max(0, Math.floor(Date.now() / 1000) - startSeconds);
        setElapsedSeconds(elapsed);

        if (typeof status.project_name === "string") {
          setProjectName(status.project_name);
        }
      } else {
        setStartTimestamp(null);
        setElapsedSeconds(0);
        if (wasRunning) {
          setProjectName("");
        }
      }

      wasRunningRef.current = running;
      setError(null);

      if (wasRunning && !running) {
        await refreshEntries();
      }
    },
    [refreshEntries],
  );

  const syncStatus = useCallback(async () => {
    try {
      const status = await invoke<TimerStatus>("get_timer_status");
      await applyStatus(status);
    } catch (err) {
      setError(parseError(err));
    }
  }, [applyStatus]);

  useEffect(() => {
    void (async () => {
      try {
        await initializeDatabase();
        await refreshEntries();
        await syncStatus();
      } catch (err) {
        setError(parseError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshEntries, syncStatus]);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    void (async () => {
      try {
        unlisten = await listen<TimerStatus>(TIMER_STATUS_EVENT, (event) => {
          void applyStatus(event.payload);
        });
      } catch (err) {
        setError(parseError(err));
      }
    })();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [applyStatus]);

  useEffect(() => {
    if (!isRunning || startTimestamp === null) {
      return undefined;
    }

    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTimestamp) / 1000)));
    };

    tick();
    const timerId = window.setInterval(tick, 1000);

    return () => window.clearInterval(timerId);
  }, [isRunning, startTimestamp]);

  const startTimer = useCallback(async () => {
    if (isRunning || projectName.trim().length === 0) {
      return;
    }

    try {
      const status = await invoke<TimerStatus>("start_timer", { projectName });
      await applyStatus(status);
    } catch (err) {
      setError(parseError(err));
    }
  }, [applyStatus, isRunning, projectName]);

  const stopTimer = useCallback(async () => {
    if (!isRunning) {
      return;
    }

    try {
      await invoke<TimeEntry | null>("stop_timer");
      await syncStatus();
    } catch (err) {
      setError(parseError(err));
    }
  }, [isRunning, syncStatus]);

  const deleteEntry = useCallback(
    async (id: number) => {
      try {
        await invoke("delete_time_entry", { id });
        await refreshEntries();
        setError(null);
      } catch (err) {
        setError(parseError(err));
        throw err;
      }
    },
    [refreshEntries],
  );

  const updateEntryName = useCallback(async (id: number, projectNameValue: string) => {
    try {
      const sanitized = await invoke<string>("update_time_entry_name", {
        id,
        projectName: projectNameValue,
      });

      setEntries((previous) =>
        previous.map((entry) => (entry.id === id ? { ...entry, projectName: sanitized } : entry)),
      );
      setError(null);
      return sanitized;
    } catch (err) {
      setError(parseError(err));
      throw err;
    }
  }, []);

  return {
    projectName,
    setProjectName,
    isRunning,
    startTimestamp,
    elapsedSeconds,
    todayTotal,
    entries,
    loading,
    isRefreshing,
    error,
    setError,
    refreshEntries,
    startTimer,
    stopTimer,
    deleteEntry,
    updateEntryName,
  };
}
