import type { KeyboardEvent } from "react";
import type { TimeEntry } from "../types/time-entry";
import { formatDuration } from "../lib/time";

type EntriesSectionProps = {
  loading: boolean;
  entries: TimeEntry[];
  isRefreshing: boolean;
  editingId: number | null;
  editingName: string;
  editingRate: string;
  onEditingNameChange: (value: string) => void;
  onEditingRateChange: (value: string) => void;
  onEditKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  beginEditing: (entry: TimeEntry) => void;
  cancelEditing: () => void;
  saveEditing: () => void;
  onDeleteClick: (entry: TimeEntry) => void;
  title?: string;
  onRefresh?: () => void;
};

export function EntriesSection({
  loading,
  entries,
  editingId,
  editingName,
  editingRate,
  onEditingNameChange,
  onEditingRateChange,
  onEditKeyDown,
  beginEditing,
  cancelEditing,
  saveEditing,
  onDeleteClick,
  title = "Today's Log",
}: EntriesSectionProps) {
  if (loading) {
    return <div className="placeholder">Loading entries...</div>;
  }

  const isToday = title === "Today's Log";

  if (entries.length === 0) {
    return (
      <div className="placeholder">
        <p>{isToday ? "No time tracked today" : "No entries for this date"}</p>
        {isToday && (
          <p>
            Enter a project name and press <strong>⌘/Ctrl+Enter</strong> to
            start tracking
          </p>
        )}
      </div>
    );
  }

  return (
    <section className="entries-card">
      <header className="entries-card__header">
        <h2>{title}</h2>
        <span className="entries-card__hint">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </span>
      </header>

      <ul className="entries-list">
        {entries.map((entry) => {
          const isEditing = editingId === entry.id;

          if (isEditing) {
            return (
              <li key={entry.id} className="entry-row">
                <div className="edit-panel">
                  <div className="entry-edit-inputs">
                    <input
                      className="edit-input"
                      type="text"
                      value={editingName}
                      onChange={(e) => onEditingNameChange(e.target.value)}
                      onKeyDown={onEditKeyDown}
                      placeholder="Project Name"
                      autoFocus
                    />
                    <div className="rate-input-group">
                      <span className="rate-input-group__prefix">$</span>
                      <input
                        className="rate-input"
                        type="text"
                        inputMode="decimal"
                        value={editingRate}
                        onChange={(e) => onEditingRateChange(e.target.value)}
                        onKeyDown={onEditKeyDown}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="entry-actions entry-actions--editing">
                    <button
                      className="button-ghost"
                      onClick={saveEditing}
                      title="Save"
                    >
                      Save
                    </button>
                    <button
                      className="button-ghost"
                      onClick={cancelEditing}
                      title="Cancel"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </li>
            );
          }

          return (
            <li key={entry.id} className="entry-row">
              <div className="entry-main">
                <div className="entry-title">{entry.projectName}</div>
                <div className="entry-meta">
                  {new Date(entry.startTime * 1000).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  -{" "}
                  {new Date(entry.endTime * 1000).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>

              <div className="entry-metrics">
                <div className="entry-amount">
                  {formatDuration(entry.duration)}
                </div>
                <div className="entry-rate">
                  ${entry.amount.toFixed(2)}
                </div>
                <div className="entry-actions">
                  <button
                    className="button-ghost"
                    onClick={() => beginEditing(entry)}
                    title="Edit"
                  >
                    Edit
                  </button>
                  <button
                    className="button-ghost button-ghost--danger"
                    onClick={() => onDeleteClick(entry)}
                    title="Delete"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
