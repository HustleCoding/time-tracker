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
  beginEditing,
  onDeleteClick,
  title = "Time Entries",
}: EntriesSectionProps) {
  if (loading) {
    return (
      <div className="empty-state">
        <div className="empty-state__title">Loading entries...</div>
      </div>
    );
  }

  const isToday = title === "Time Entries";

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__title">
          {isToday ? "No time tracked today" : "No entries for this date"}
        </div>
        {isToday && (
          <div className="empty-state__description">
            Enter a project name and press ⌘/Ctrl+Enter to start tracking
          </div>
        )}
      </div>
    );
  }

  return (
    <table className="table">
      <thead className="table__header">
        <tr>
          <th className="table__header-cell">Project</th>
          <th className="table__header-cell">Time</th>
          <th className="table__header-cell table__cell--right">Duration</th>
          <th className="table__header-cell table__cell--right">Rate</th>
          <th className="table__header-cell table__cell--right">Amount</th>
          <th className="table__header-cell table__cell--right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.id} className="table__row">
            <td className="table__cell">{entry.projectName}</td>
            <td className="table__cell table__cell--secondary table__cell--mono">
              {new Date(entry.startTime * 1000).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              —{" "}
              {new Date(entry.endTime * 1000).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </td>
            <td className="table__cell table__cell--mono table__cell--right">
              {formatDuration(entry.duration)}
            </td>
            <td className="table__cell table__cell--secondary table__cell--right">
              ${entry.hourlyRate.toFixed(0)}/h
            </td>
            <td className="table__cell table__cell--mono table__cell--right">
              ${entry.amount.toFixed(2)}
            </td>
            <td className="table__cell table__cell--right">
              <div className="table__actions">
                <button
                  className="btn-ghost"
                  onClick={() => beginEditing(entry)}
                  title="Edit entry"
                >
                  Edit
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => onDeleteClick(entry)}
                  title="Delete entry"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
