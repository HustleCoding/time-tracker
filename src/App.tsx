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
  } = useTimeTracker();

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

  return (
    <main className="app">
      <header className="app__header">
        <div>
          <h1>Time Tracker</h1>
          <p className="app__subtitle">
            Track today&apos;s work with a simple timer.
          </p>
        </div>
        <TodayTotalCard
          totalSeconds={todayTotalSeconds}
          totalAmount={todayTotalAmount}
        />
      </header>

      {error && <div className="error-banner">{error}</div>}

      <TimerCard
        projectName={projectName}
        hourlyRate={hourlyRate}
        isRunning={isRunning}
        timerDisplay={timerDisplay}
        isStartDisabled={isStartDisabled}
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
