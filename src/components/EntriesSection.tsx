import type { KeyboardEvent } from "react";
import type { TimeEntry } from "../types/time-entry";
import { formatClockTime, formatDuration } from "../lib/time";

type EntriesSectionProps = {
  loading: boolean;
  entries: TimeEntry[];
  isRefreshing: boolean;
  editingId: number | null;
  editingName: string;
  onEditingNameChange: (value: string) => void;
  onEditKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  beginEditing: (entry: TimeEntry) => void;
  cancelEditing: () => void;
  saveEditing: () => void | Promise<void>;
  onDeleteClick: (entry: TimeEntry) => void;
  onRefresh: () => void | Promise<void>;
};

export function EntriesSection({
  loading,
  entries,
  isRefreshing,
  editingId,
  editingName,
  onEditingNameChange,
  onEditKeyDown,
  beginEditing,
  cancelEditing,
  saveEditing,
  onDeleteClick,
  onRefresh,
}: EntriesSectionProps) {
  return (
    <section className="entries-card">
      <div className="entries-card__header">
        <div>
          <h2>Today&apos;s Entries</h2>
          {isRefreshing && (
            <span className="entries-card__hint">Refreshing…</span>
          )}
        </div>
        <button
          type="button"
          className="button-ghost"
          onClick={() => {
            onRefresh();
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
                      onChange={(event) =>
                        onEditingNameChange(event.target.value)
                      }
                      onKeyDown={onEditKeyDown}
                      autoFocus
                    />
                    <div className="edit-actions">
                      <button
                        type="button"
                        className="button-ghost"
                        onClick={cancelEditing}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="button-primary"
                        onClick={saveEditing}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="entry-title">{entry.projectName}</span>
                    <span className="entry-meta">
                      {formatClockTime(entry.startTime)} –{" "}
                      {formatClockTime(entry.endTime)} ·{" "}
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
                    onClick={() => onDeleteClick(entry)}
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
  );
}
