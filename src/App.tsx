import type { KeyboardEvent } from "react";
import { useState } from "react";
import "./App.css";
import { formatDuration } from "./lib/time";
import type { TimeEntry } from "./types/time-entry";
import { TodayTotalCard } from "./components/TodayTotalCard";
import { TimerCard } from "./components/TimerCard";
import { EntriesSection } from "./components/EntriesSection";
import { DeleteDialog } from "./components/DeleteDialog";
import { useTimeTracker } from "./hooks/useTimeTracker";

function App() {
  const {
    projectName,
    setProjectName,
    isRunning,
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
  } = useTimeTracker();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
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
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName("");
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

    try {
      await updateEntryName(editingId, trimmed);
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

  return (
    <main className="app">
      <header className="app__header">
        <div>
          <h1>Time Tracker</h1>
          <p className="app__subtitle">
            Track today&apos;s work with a simple timer.
          </p>
        </div>
        <TodayTotalCard totalSeconds={todayTotal} />
      </header>

      {error && <div className="error-banner">{error}</div>}

      <TimerCard
        projectName={projectName}
        isRunning={isRunning}
        timerDisplay={timerDisplay}
        isStartDisabled={isStartDisabled}
        onProjectNameChange={setProjectName}
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
        onEditingNameChange={setEditingName}
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
