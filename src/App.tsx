import { useState, useEffect } from "react";
import "./App.css";
import { formatDuration } from "./lib/time";
import type { TimeEntry } from "./types/time-entry";
import { EntriesSection } from "./components/EntriesSection";
import { DeleteDialog } from "./components/DeleteDialog";
import { EditEntryModal } from "./components/EditEntryModal";
import { HistoryView } from "./components/HistoryView";
import { InvoicesView } from "./components/InvoicesView";
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

  const [view, setView] = useState<"today" | "history" | "invoices">("today");
  const [editTarget, setEditTarget] = useState<TimeEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TimeEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  const openEditModal = (entry: TimeEntry) => {
    setEditTarget(entry);
  };

  const closeEditModal = () => {
    setEditTarget(null);
    setIsSaving(false);
  };

  const saveEdit = async (
    id: number,
    projectName: string,
    hourlyRate: number,
    durationSeconds: number
  ) => {
    setIsSaving(true);
    try {
      const result = await updateEntryDetails(id, projectName, hourlyRate, durationSeconds);

      if (result?.overlap_warning) {
        // Return the overlap warning to the modal
        return result;
      }

      // If no overlap, close the modal
      closeEditModal();
      return undefined;
    } catch {
      // hook already surfaces the error state
      throw new Error("Failed to update entry");
    } finally {
      setIsSaving(false);
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
        if (view === "today") {
          if (isRunning) {
            void stopTimer();
          } else if (!isStartDisabled) {
            void startTimer();
          }
        }
      }

      // Escape to clear project name input when not running
      if (event.key === "Escape" && !isRunning && view === "today") {
        setProjectName("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRunning, isStartDisabled, view, startTimer, stopTimer, setProjectName]);

  return (
    <div className="app">
      {/* Top Navigation */}
      <nav className="app__nav">
        <div className="app__nav-left">
          <div className="app__logo">TimeTracker</div>
          <div className="app__nav-links">
            <button
              className={`app__nav-link ${view === "today" ? "app__nav-link--active" : ""}`}
              onClick={() => setView("today")}
            >
              Today
            </button>
            <button
              className={`app__nav-link ${view === "history" ? "app__nav-link--active" : ""}`}
              onClick={() => setView("history")}
            >
              History
            </button>
            <button
              className={`app__nav-link ${view === "invoices" ? "app__nav-link--active" : ""}`}
              onClick={() => setView("invoices")}
            >
              Invoices
            </button>
          </div>
        </div>

        {/* Always visible timer in nav */}
        <div className="app__nav-timer">
          <div className={`app__nav-timer-status ${isRunning ? "app__nav-timer-status--running" : ""}`} />
          {timerDisplay}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="app__main">
        {error && (
          <div className="message message--error">
            <span>{error}</span>
            <button
              className="btn-ghost"
              onClick={clearError}
              aria-label="Dismiss error"
              style={{ marginLeft: "auto" }}
            >
              ×
            </button>
          </div>
        )}

        <div className="view-switcher">
          {/* Today View */}
          <div className={`view ${view === "today" ? "view--active" : ""}`}>
            <div className="today-view">
              {/* Timer Hero Section */}
              <div className="timer-hero">
                <div className="timer-display">{timerDisplay}</div>
                <div className={`timer-status ${isRunning ? "timer-status--running" : ""}`}>
                  {isRunning ? "Running" : "Idle"}
                </div>

                <div className="timer-controls">
                  {!isRunning ? (
                    <>
                      <div className="form-field">
                        <label className="form-label" htmlFor="project-input">
                          Project
                        </label>
                        <input
                          id="project-input"
                          type="text"
                          className="form-input"
                          placeholder="What are you working on?"
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          disabled={isRunning}
                          autoFocus
                        />
                      </div>

                      <div className="form-field">
                        <label className="form-label" htmlFor="rate-input">
                          Hourly Rate
                        </label>
                        <div className="input-group">
                          <span className="input-group__prefix">$</span>
                          <input
                            id="rate-input"
                            type="number"
                            className="input-group__input"
                            placeholder="0"
                            value={hourlyRate}
                            onChange={(e) => setHourlyRate(e.target.value)}
                            disabled={isRunning}
                          />
                          <span className="input-group__suffix">/h</span>
                        </div>
                      </div>

                      <button
                        className="btn btn-primary"
                        onClick={() => void startTimer()}
                        disabled={isStartDisabled || isStarting}
                      >
                        {isStarting ? "Starting..." : "Start Timer"}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="timer-info">
                        <div className="timer-info__item">
                          <div className="timer-info__label">Project</div>
                          <div className="timer-info__value">{projectName}</div>
                        </div>
                        <div className="timer-info__item">
                          <div className="timer-info__label">Rate</div>
                          <div className="timer-info__value">${hourlyRate}/h</div>
                        </div>
                      </div>

                      <button
                        className="btn btn-danger"
                        onClick={() => void stopTimer()}
                        disabled={isStopping}
                      >
                        {isStopping ? "Stopping..." : "Stop Timer"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Today's Entries */}
              <div className="today-entries">
                <div className="today-entries__header">
                  <h2 className="today-entries__title">Time Entries</h2>
                  <div className="today-entries__total">
                    {formatDuration(todayTotalSeconds)} • ${todayTotalAmount.toFixed(2)}
                  </div>
                </div>

                <EntriesSection
                  loading={loading}
                  entries={entries}
                  isRefreshing={isRefreshing}
                  editingId={null}
                  editingName=""
                  editingRate=""
                  onEditingNameChange={() => {}}
                  onEditingRateChange={() => {}}
                  onEditKeyDown={() => {}}
                  beginEditing={openEditModal}
                  cancelEditing={() => {}}
                  saveEditing={() => {}}
                  onDeleteClick={(entry) => setDeleteTarget(entry)}
                  onRefresh={() => void refreshEntries()}
                />
              </div>
            </div>
          </div>

          {/* History View */}
          <div className={`view ${view === "history" ? "view--active" : ""}`}>
            <HistoryView
              entries={historyEntries}
              loading={loading}
              onLoadHistory={loadHistory}
              onDeleteClick={(entry) => setDeleteTarget(entry)}
              editingId={null}
              editingName=""
              editingRate=""
              onEditingNameChange={() => {}}
              onEditingRateChange={() => {}}
              onEditKeyDown={() => {}}
              beginEditing={openEditModal}
              cancelEditing={() => {}}
              saveEditing={() => {}}
            />
          </div>

          {/* Invoices View */}
          <div className={`view ${view === "invoices" ? "view--active" : ""}`}>
            <InvoicesView />
          </div>
        </div>
      </main>

      {/* Modals */}
      <DeleteDialog
        target={deleteTarget}
        onCancel={cancelDelete}
        onConfirm={() => void confirmDelete()}
      />

      <EditEntryModal
        entry={editTarget}
        onCancel={closeEditModal}
        onSave={saveEdit}
        isSaving={isSaving}
      />
    </div>
  );
}

export default App;
