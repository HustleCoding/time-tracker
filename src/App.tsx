import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import "./App.css";

type RawTimeEntry = {
  id: number;
  project_name: string;
  start_time: number;
  end_time: number;
  duration: number;
};

type TimeEntry = {
  id: number;
  projectName: string;
  startTime: number;
  endTime: number;
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

const formatDuration = (totalSeconds: number): string => {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const segments = [hours, minutes, seconds].map((segment) =>
    segment.toString().padStart(2, "0"),
  );

  return segments.join(":");
};

const formatClockTime = (timestampSeconds: number): string => {
  const date = new Date(timestampSeconds * 1000);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
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

function App() {
  const [projectName, setProjectName] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [startTimestamp, setStartTimestamp] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TimeEntry | null>(null);
  const wasRunningRef = useRef(false);

  const loadEntries = useCallback(async () => {
    const rawEntries = await invoke<RawTimeEntry[]>("get_today_entries");
    const mapped = rawEntries.map(toTimeEntry);
    setEntries(mapped);
  }, []);

  const refreshEntries = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadEntries();
      setError(null);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsRefreshing(false);
    }
  }, [loadEntries]);

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
        await invoke("initialize_database");
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

  const handleStart = async () => {
    if (isRunning || projectName.trim().length === 0) {
      return;
    }

    try {
      const status = await invoke<TimerStatus>("start_timer", { projectName });
      await applyStatus(status);
    } catch (err) {
      setError(parseError(err));
    }
  };

  const handleStop = async () => {
    if (!isRunning) {
      return;
    }

    try {
      await invoke<TimeEntry | null>("stop_timer");
      await syncStatus();
    } catch (err) {
      setError(parseError(err));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    const id = deleteTarget.id;

    try {
      await invoke("delete_time_entry", { id });
      await refreshEntries();
      setError(null);
      setDeleteTarget(null);
    } catch (err) {
      setError(parseError(err));
    }
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
  };

  const beginEditing = (entry: TimeEntry) => {
    setEditingId(entry.id);
    setEditingName(entry.projectName);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveEditing = async () => {
    if (editingId === null) {
      return;
    }

    try {
      const sanitized = await invoke<string>("update_time_entry_name", {
        id: editingId,
        projectName: editingName,
      });

      setEntries((previous) =>
        previous.map((entry) =>
          entry.id === editingId ? { ...entry, projectName: sanitized } : entry,
        ),
      );
      setError(null);
      cancelEditing();
    } catch (err) {
      setError(parseError(err));
    }
  };

  const onEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void saveEditing();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
  };

  const totalDuration = useMemo(
    () => entries.reduce((total, entry) => total + entry.duration, 0),
    [entries],
  );

  const timerDisplay = formatDuration(isRunning ? elapsedSeconds : 0);
  const isStartDisabled = isRunning || projectName.trim().length === 0;

  return (
    <main className="app">
      <header className="app__header">
        <div>
          <h1>Time Tracker</h1>
          <p className="app__subtitle">Track today&apos;s work with a simple timer.</p>
        </div>
        <div className="total-duration">
          <span className="total-duration__label">Total Today</span>
          <span className="total-duration__value">{formatDuration(totalDuration)}</span>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <section className={`timer-card ${isRunning ? "timer-card--active" : ""}`}>
        <div className="timer-display">{timerDisplay}</div>
        <span
          className={`status-badge ${
            isRunning ? "status-badge--running" : "status-badge--idle"
          }`}
        >
          {isRunning ? "Timer Running" : "Timer Stopped"}
        </span>
        <div className="timer-controls">
          <input
            className="timer-input"
            type="text"
            placeholder="What are you working on?"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            disabled={isRunning}
          />
          <button
            type="button"
            className={isRunning ? "button-stop" : "button-primary"}
            onClick={isRunning ? handleStop : handleStart}
            disabled={isRunning ? false : isStartDisabled}
          >
            {isRunning ? "Stop Timer" : "Start Timer"}
          </button>
        </div>
      </section>

      <section className="entries-card">
        <div className="entries-card__header">
          <div>
            <h2>Today&apos;s Entries</h2>
            {isRefreshing && <span className="entries-card__hint">Refreshing…</span>}
          </div>
          <button
            type="button"
            className="button-ghost"
            onClick={() => {
              void refreshEntries();
            }}
            disabled={isRefreshing}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="placeholder">Loading entries…</p>
        ) : entries.length === 0 ? (
          <p className="placeholder">
            No entries yet. Start the timer and your work will appear here.
          </p>
        ) : (
          <ul className="entries-list">
            {entries.map((entry) => (
              <li key={entry.id} className="entry-row">
                <div className="entry-main">
                  {editingId === entry.id ? (
                    <div className="edit-panel">
                      <input
                        className="edit-input"
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        onKeyDown={onEditKeyDown}
                        autoFocus
                      />
                      <div className="edit-actions">
                        <button type="button" className="button-ghost" onClick={cancelEditing}>
                          Cancel
                        </button>
                        <button type="button" className="button-primary" onClick={saveEditing}>
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="entry-title">{entry.projectName}</span>
                      <span className="entry-meta">
                        {formatClockTime(entry.startTime)} – {formatClockTime(entry.endTime)} ·{" "}
                        {formatDuration(entry.duration)}
                      </span>
                    </>
                  )}
                </div>

                {editingId === entry.id ? null : (
                  <div className="entry-actions">
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() => beginEditing(entry)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="button-ghost button-ghost--danger"
                      onClick={() => setDeleteTarget(entry)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {deleteTarget && (
        <div className="delete-dialog" role="dialog" aria-modal="true">
          <div className="delete-dialog__panel">
            <h3 className="delete-dialog__title">Delete this entry?</h3>
            <p className="delete-dialog__body">
              Removing <strong>{deleteTarget.projectName}</strong> can&apos;t be undone. The tracked
              time will be removed from today&apos;s total.
            </p>
            <div className="delete-dialog__actions">
              <button type="button" className="button-ghost" onClick={cancelDelete}>
                Cancel
              </button>
              <button
                type="button"
                className="delete-dialog__confirm"
                onClick={() => {
                  void confirmDelete();
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
