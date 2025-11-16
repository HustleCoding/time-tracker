import type { KeyboardEvent } from "react";
import type { TimeEntry } from "../types/time-entry";
import { formatClockTime, formatDuration } from "../lib/time";
import { formatCurrency } from "../lib/currency";

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
  editingRate,
        onEditingNameChange,
        onEditingRateChange,
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
                    <label className="timer-field timer-field--project edit-field-inline">
                      <span className="timer-field__label">Project</span>
                      <div className="edit-inline-row">
                        <input
                          className="edit-input edit-input--inline"
                          value={editingName}
                          onChange={(event) =>
                            onEditingNameChange(event.target.value)
                          }
                          onKeyDown={onEditKeyDown}
                          autoFocus
                        />
                        <span className="timer-field__label">Hourly Rate</span>
                        <div className="rate-input-group">
                          <span className="rate-input-group__prefix">$</span>
                          <input
                            className="rate-input"
                            type="text"
                            inputMode="decimal"
                            value={editingRate}
                            onChange={(event) =>
                              onEditingRateChange(event.target.value)
                            }
                            onKeyDown={onEditKeyDown}
                          />
                          <span className="rate-input-group__suffix">/hr</span>
                        </div>
                      </div>
                    </label>
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
                    <div className="entry-metrics">
                      <span className="entry-meta">
                        {formatClockTime(entry.startTime)} –{" "}
                        {formatClockTime(entry.endTime)} ·{" "}
                        {formatDuration(entry.duration)}
                      </span>
                      <span className="entry-amount">
                        {formatCurrency(entry.amount)}
                      </span>
                    </div>
                    <span className="entry-rate">
                      Rate: {formatCurrency(entry.hourlyRate)} / hr
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
