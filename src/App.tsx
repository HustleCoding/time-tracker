import type { KeyboardEvent } from "react";
import { useState, useEffect } from "react";
import "./App.css";
import { formatDuration } from "./lib/time";
import type { TimeEntry } from "./types/time-entry";
import { Sidebar } from "./components/Sidebar";
import { EntriesSection } from "./components/EntriesSection";
import { DeleteDialog } from "./components/DeleteDialog";
import { EditEntryModal } from "./components/EditEntryModal";
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
    <div className="app">
      <div className="app__layout">
        <Sidebar
          view={view}
          onViewChange={setView}
          projectName={projectName}
          hourlyRate={hourlyRate}
          isRunning={isRunning}
          timerDisplay={timerDisplay}
          isStartDisabled={isStartDisabled}
          isStarting={isStarting}
          isStopping={isStopping}
          todayTotalSeconds={todayTotalSeconds}
          todayTotalAmount={todayTotalAmount}
          onProjectNameChange={setProjectName}
          onHourlyRateChange={setHourlyRate}
          onStart={() => {
            void startTimer();
          }}
          onStop={() => {
            void stopTimer();
          }}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        <main className="app__main-content">
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
          </div>
        </main>
      </div>

      <DeleteDialog
        target={deleteTarget}
        onCancel={cancelDelete}
        onConfirm={() => {
          void confirmDelete();
        }}
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
