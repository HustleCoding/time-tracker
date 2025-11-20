import type { KeyboardEvent } from "react";
import { useState, useEffect } from "react";
import "./App.css";
import { formatDuration } from "./lib/time";
import type { TimeEntry } from "./types/time-entry";
import { TodayTotalCard } from "./components/TodayTotalCard";
import { TimerCard } from "./components/TimerCard";
import { EntriesSection } from "./components/EntriesSection";
import { DeleteDialog } from "./components/DeleteDialog";
import { HistoryView } from "./components/HistoryView";
import { useTimeTracker } from "./hooks/useTimeTracker";

function App() {
  const {
    projectName,
    setProjectName,
    isRunning,
    elapsedSeconds,
    todayTotalSeconds,
    todayTotalAmount,
    entries,
    loading,
    isRefreshing,
    isStarting,
    isStopping,
    error,
    setError,
    clearError,
    hourlyRate,
    setHourlyRate,
    refreshEntries,
    startTimer,
    stopTimer,
    deleteEntry,
    updateEntryDetails,
    historyEntries,
    loadHistory,
  } = useTimeTracker();

  const [view, setView] = useState<"timer" | "history">("timer");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingRate, setEditingRate] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TimeEntry | null>(null);

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await deleteEntry(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // error handling handled in the hook
    }
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
  };

  const beginEditing = (entry: TimeEntry) => {
    setEditingId(entry.id);
    setEditingName(entry.projectName);
    setEditingRate(entry.hourlyRate.toString());
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName("");
    setEditingRate("");
  };

  const saveEditing = async () => {
    if (editingId === null) {
      return;
    }

    const trimmed = editingName.trim();
    if (trimmed.length === 0) {
      setError("Project name cannot be empty.");
      return;
    }

    const rateInput = editingRate.trim();
    const parsedRate = rateInput.length === 0 ? 0 : Number(rateInput);
    if (Number.isNaN(parsedRate)) {
      setError("Hourly rate must be a valid number.");
      return;
    }
    if (parsedRate < 0) {
      setError("Hourly rate cannot be negative.");
      return;
    }

    try {
      await updateEntryDetails(editingId, trimmed, parsedRate);
      cancelEditing();
    } catch {
      // hook already surfaces the error state
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

  const timerDisplay = formatDuration(isRunning ? elapsedSeconds : 0);
  const isStartDisabled = isRunning || projectName.trim().length === 0;

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      // Cmd/Ctrl + Enter to start/stop timer
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (view === "timer") {
          if (isRunning) {
            void stopTimer();
          } else if (!isStartDisabled) {
            void startTimer();
          }
        }
      }

      // Escape to clear project name input when not running
      if (event.key === "Escape" && !isRunning && view === "timer") {
        setProjectName("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRunning, isStartDisabled, view, startTimer, stopTimer, setProjectName]);

  return (
    <main className="app">
      <header className="app__header">
        <div className="app__title-group">
          <div className="app__brand">
            <img
              src="/logo.svg"
              alt="Time Tracker logo"
              className="app__logo"
              draggable={false}
            />
            <div className="app__titles">
              <h1>Time Tracker</h1>
              <p className="app__subtitle">Minimal, focused time tracking</p>
            </div>
          </div>
          <div className="app__tabs">
            <button
              className={`app__tab ${view === "timer" ? "app__tab--active" : ""}`}
              onClick={() => setView("timer")}
            >
              Timer
            </button>
            <button
              className={`app__tab ${view === "history" ? "app__tab--active" : ""}`}
              onClick={() => setView("history")}
            >
              History
            </button>
          </div>
        </div>
        <TodayTotalCard
          totalSeconds={todayTotalSeconds}
          totalAmount={todayTotalAmount}
        />
      </header>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button
            className="error-banner__close"
            onClick={clearError}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <div className="view-switcher">
        <div className={`view ${view === "timer" ? "view--active" : ""}`}>
          <TimerCard
            projectName={projectName}
            hourlyRate={hourlyRate}
            isRunning={isRunning}
            timerDisplay={timerDisplay}
            isStartDisabled={isStartDisabled}
            isStarting={isStarting}
            isStopping={isStopping}
            onProjectNameChange={setProjectName}
            onHourlyRateChange={setHourlyRate}
            onStart={() => {
              void startTimer();
            }}
            onStop={() => {
              void stopTimer();
            }}
          />

          <EntriesSection
            loading={loading}
            entries={entries}
            isRefreshing={isRefreshing}
            editingId={editingId}
            editingName={editingName}
            editingRate={editingRate}
            onEditingNameChange={setEditingName}
            onEditingRateChange={setEditingRate}
            onEditKeyDown={onEditKeyDown}
            beginEditing={beginEditing}
            cancelEditing={cancelEditing}
            saveEditing={saveEditing}
            onDeleteClick={(entry) => {
              setDeleteTarget(entry);
            }}
            onRefresh={() => {
              void refreshEntries();
            }}
          />
        </div>

        <div className={`view ${view === "history" ? "view--active" : ""}`}>
          <HistoryView
            entries={historyEntries}
            loading={loading}
            onLoadHistory={loadHistory}
            onDeleteClick={(entry) => setDeleteTarget(entry)}
            editingId={editingId}
            editingName={editingName}
            editingRate={editingRate}
            onEditingNameChange={setEditingName}
            onEditingRateChange={setEditingRate}
            onEditKeyDown={onEditKeyDown}
            beginEditing={beginEditing}
            cancelEditing={cancelEditing}
            saveEditing={saveEditing}
          />
        </div>
      </div>

      <DeleteDialog
        target={deleteTarget}
        onCancel={cancelDelete}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </main>
  );
}

export default App;
