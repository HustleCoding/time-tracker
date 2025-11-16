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
  hourly_rate: number;
  amount: number;
};

const toTimeEntry = (raw: RawTimeEntry): TimeEntry => ({
  id: raw.id,
  projectName: raw.project_name,
  startTime: raw.start_time,
  endTime: raw.end_time,
  duration: raw.duration,
  hourlyRate: raw.hourly_rate,
  amount: raw.amount,
});

type TimerStatus = {
  is_running: boolean;
  project_name: string | null;
  start_time: number | null;
  elapsed_seconds: number | null;
  hourly_rate: number | null;
};

type TodayTotals = {
  total_seconds: number;
  total_amount: number;
};

const TIMER_STATUS_EVENT = "timer://status";
const HOURLY_RATE_STORAGE_KEY = "time-tracker:hourly-rate";

const loadStoredHourlyRate = (): string => {
  if (typeof window === "undefined") {
    return "0";
  }
  return window.localStorage.getItem(HOURLY_RATE_STORAGE_KEY) ?? "0";
};

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
  const [todayTotalSeconds, setTodayTotalSeconds] = useState(0);
  const [todayTotalAmount, setTodayTotalAmount] = useState(0);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hourlyRate, setHourlyRate] = useState(loadStoredHourlyRate);
  const wasRunningRef = useRef(false);

  const loadEntries = useCallback(async () => {
    const rawEntries = await invoke<RawTimeEntry[]>("get_today_entries");
    setEntries(rawEntries.map(toTimeEntry));
  }, []);

  const loadTodayTotals = useCallback(async () => {
    const totals = await invoke<TodayTotals>("get_today_total");
    setTodayTotalSeconds(Math.max(0, totals.total_seconds));
    setTodayTotalAmount(Math.max(0, totals.total_amount));
  }, []);

  const refreshEntries = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadEntries(), loadTodayTotals()]);
      setError(null);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsRefreshing(false);
    }
  }, [loadEntries, loadTodayTotals]);

  const applyStatus = useCallback(
    async (status: TimerStatus) => {
      const running = status.is_running;
      const wasRunning = wasRunningRef.current;

      setIsRunning(running);

      if (running) {
        const startSeconds =
          typeof status.start_time === "number"
            ? status.start_time
            : Math.floor(Date.now() / 1000);
        setStartTimestamp(startSeconds * 1000);
        const elapsed =
          typeof status.elapsed_seconds === "number"
            ? Math.max(0, status.elapsed_seconds)
            : Math.max(0, Math.floor(Date.now() / 1000) - startSeconds);
        setElapsedSeconds(elapsed);

        if (typeof status.project_name === "string") {
          setProjectName(status.project_name);
        }
        if (typeof status.hourly_rate === "number") {
          setHourlyRate(status.hourly_rate.toString());
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
    [refreshEntries]
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
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - startTimestamp) / 1000))
      );
    };

    tick();
    const timerId = window.setInterval(tick, 1000);

    return () => window.clearInterval(timerId);
  }, [isRunning, startTimestamp]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(HOURLY_RATE_STORAGE_KEY, hourlyRate);
  }, [hourlyRate]);

  const resolveHourlyRate = useCallback((): number | null => {
    const trimmed = hourlyRate.trim();
    if (trimmed.length === 0) {
      return 0;
    }
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) {
      return null;
    }
    return parsed;
  }, [hourlyRate]);

  const startTimer = useCallback(async () => {
    if (isRunning || projectName.trim().length === 0) {
      return;
    }

    const parsedRate = resolveHourlyRate();
    if (parsedRate === null) {
      setError("Hourly rate must be a valid number.");
      return;
    }
    if (parsedRate < 0) {
      setError("Hourly rate cannot be negative.");
      return;
    }

    try {
      const status = await invoke<TimerStatus>("start_timer", {
        projectName,
        hourlyRate: parsedRate,
      });
      await applyStatus(status);
    } catch (err) {
      setError(parseError(err));
    }
  }, [applyStatus, isRunning, projectName, resolveHourlyRate]);

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
    [refreshEntries]
  );

  const updateEntryDetails = useCallback(
    async (id: number, projectNameValue: string, hourlyRateValue: number) => {
      try {
        const rawUpdated = await invoke<RawTimeEntry>("update_time_entry", {
          id,
          projectName: projectNameValue,
          hourlyRate: hourlyRateValue,
        });
        const updated = toTimeEntry(rawUpdated);

        setEntries((previous) => previous.map((entry) => (entry.id === id ? updated : entry)));
        await loadTodayTotals();
        setError(null);
        return updated;
      } catch (err) {
        setError(parseError(err));
        throw err;
      }
    },
    [loadTodayTotals]
  );

  return {
    projectName,
    setProjectName,
    isRunning,
    startTimestamp,
    elapsedSeconds,
    todayTotalSeconds,
    todayTotalAmount,
    entries,
    loading,
    isRefreshing,
    error,
    setError,
    hourlyRate,
    setHourlyRate,
    refreshEntries,
    startTimer,
    stopTimer,
    deleteEntry,
    updateEntryDetails,
  };
}
