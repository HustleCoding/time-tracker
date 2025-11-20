import { useState, useEffect, type KeyboardEvent } from "react";
import type { TimeEntry } from "../types/time-entry";
import { formatDuration } from "../lib/time";

type OverlapWarning = {
  overlapping_entries: TimeEntry[];
};

type EditEntryModalProps = {
  entry: TimeEntry | null;
  onCancel: () => void;
  onSave: (
    id: number,
    projectName: string,
    hourlyRate: number,
    durationSeconds: number
  ) => Promise<{ overlap_warning?: OverlapWarning } | void>;
  isSaving?: boolean;
};

export function EditEntryModal({
  entry,
  onCancel,
  onSave,
  isSaving = false,
}: EditEntryModalProps) {
  const [projectName, setProjectName] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [overlapWarning, setOverlapWarning] = useState<OverlapWarning | null>(null);

  useEffect(() => {
    if (entry) {
      setProjectName(entry.projectName);
      setHourlyRate(entry.hourlyRate.toString());

      const totalHours = Math.floor(entry.duration / 3600);
      const totalMinutes = Math.floor((entry.duration % 3600) / 60);

      setHours(totalHours.toString());
      setMinutes(totalMinutes.toString());
      setOverlapWarning(null);
    }
  }, [entry]);

  if (!entry) {
    return null;
  }

  const handleSave = async () => {
    const parsedRate = parseFloat(hourlyRate) || 0;
    const parsedHours = parseInt(hours) || 0;
    const parsedMinutes = parseInt(minutes) || 0;
    const totalSeconds = parsedHours * 3600 + parsedMinutes * 60;

    if (totalSeconds <= 0) {
      alert("Duration must be greater than 0");
      return;
    }

    const result = await onSave(entry.id, projectName, parsedRate, totalSeconds);

    if (result && result.overlap_warning) {
      setOverlapWarning(result.overlap_warning);
    } else {
      // Close modal if save was successful and no overlaps
      setOverlapWarning(null);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSave();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  const calculatedEndTime = entry.startTime + (parseInt(hours) || 0) * 3600 + (parseInt(minutes) || 0) * 60;

  return (
    <div className="edit-dialog" role="dialog" aria-modal="true">
      <div className="edit-dialog__panel">
        <h3 className="edit-dialog__title">Edit Time Entry</h3>

        <div className="edit-dialog__body">
          {overlapWarning && (
            <div className="edit-dialog__warning">
              <strong>⚠️ Warning:</strong> This time entry overlaps with {overlapWarning.overlapping_entries.length} other {overlapWarning.overlapping_entries.length === 1 ? 'entry' : 'entries'}:
              <ul className="edit-dialog__overlap-list">
                {overlapWarning.overlapping_entries.map((overlap) => (
                  <li key={overlap.id}>
                    {overlap.projectName} ({new Date(overlap.startTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(overlap.endTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                  </li>
                ))}
              </ul>
              <p>You can still save, but you may want to adjust the duration.</p>
            </div>
          )}

          <div className="edit-dialog__field">
            <label className="edit-dialog__label">Project Name</label>
            <input
              className="edit-dialog__input"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Project Name"
              autoFocus
            />
          </div>

          <div className="edit-dialog__field">
            <label className="edit-dialog__label">Hourly Rate</label>
            <div className="edit-dialog__input-group">
              <span className="edit-dialog__input-prefix">$</span>
              <input
                className="edit-dialog__input edit-dialog__input--with-prefix"
                type="text"
                inputMode="decimal"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="0"
              />
            </div>
          </div>

          <div className="edit-dialog__field">
            <label className="edit-dialog__label">Duration</label>
            <div className="edit-dialog__duration-inputs">
              <div className="edit-dialog__duration-field">
                <input
                  className="edit-dialog__input edit-dialog__input--small"
                  type="text"
                  inputMode="numeric"
                  value={hours}
                  onChange={(e) => setHours(e.target.value.replace(/[^0-9]/g, ""))}
                  onKeyDown={handleKeyDown}
                  placeholder="0"
                />
                <span className="edit-dialog__duration-label">hours</span>
              </div>
              <div className="edit-dialog__duration-field">
                <input
                  className="edit-dialog__input edit-dialog__input--small"
                  type="text"
                  inputMode="numeric"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, ""))}
                  onKeyDown={handleKeyDown}
                  placeholder="0"
                />
                <span className="edit-dialog__duration-label">minutes</span>
              </div>
            </div>
          </div>

          <div className="edit-dialog__info">
            <div className="edit-dialog__info-row">
              <span className="edit-dialog__info-label">Start Time:</span>
              <span className="edit-dialog__info-value">
                {new Date(entry.startTime * 1000).toLocaleString()}
              </span>
            </div>
            <div className="edit-dialog__info-row">
              <span className="edit-dialog__info-label">End Time:</span>
              <span className="edit-dialog__info-value">
                {new Date(calculatedEndTime * 1000).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="edit-dialog__actions">
          <button
            type="button"
            className="button-ghost"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="edit-dialog__confirm"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
