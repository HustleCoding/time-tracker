import { useState, useEffect, type KeyboardEvent } from "react";
import type { TimeEntry } from "../types/time-entry";

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
  const [durationError, setDurationError] = useState<string | null>(null);
  const parsedHours = parseInt(hours, 10) || 0;
  const parsedMinutes = parseInt(minutes, 10) || 0;
  const requestedDurationSeconds = parsedHours * 3600 + parsedMinutes * 60;
  const effectiveDurationSeconds =
    requestedDurationSeconds > 0 ? requestedDurationSeconds : entry?.duration ?? 0;

  useEffect(() => {
    if (entry) {
      setProjectName(entry.projectName);
      setHourlyRate(entry.hourlyRate.toString());

      const totalHours = Math.floor(entry.duration / 3600);
      const totalMinutes = Math.floor((entry.duration % 3600) / 60);

      setHours(totalHours.toString());
      setMinutes(totalMinutes.toString());
      setOverlapWarning(null);
      setDurationError(null);
    }
  }, [entry]);

  if (!entry) {
    return null;
  }

  const handleSave = async () => {
    const parsedRate = parseFloat(hourlyRate) || 0;
    // Fallback to the existing duration so sub-minute entries can still be edited
    if (effectiveDurationSeconds <= 0) {
      setDurationError("Duration must be greater than zero.");
      setOverlapWarning(null);
      return;
    }
    setDurationError(null);

    const result = await onSave(entry.id, projectName, parsedRate, effectiveDurationSeconds);

    if (result && result.overlap_warning) {
      setOverlapWarning(result.overlap_warning);
    } else {
      setOverlapWarning(null);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleSave();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  const calculatedEndTime = entry.startTime + effectiveDurationSeconds;

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__header">
          <h3 className="dialog__title">Edit Time Entry</h3>
          <button className="dialog__close" onClick={onCancel} aria-label="Close">
            ×
          </button>
        </div>

        <div className="dialog__body">
          {overlapWarning && (
            <div className="message message--warning">
              <div>
                <strong>Warning:</strong> This entry overlaps with {overlapWarning.overlapping_entries.length} other{" "}
                {overlapWarning.overlapping_entries.length === 1 ? "entry" : "entries"}.
                You can still save, but you may want to adjust the duration.
              </div>
            </div>
          )}
          {durationError && (
            <div className="message message--error">
              <span>{durationError}</span>
            </div>
          )}

          <div className="form-field">
            <label className="form-label" htmlFor="edit-project">
              Project Name
            </label>
            <input
              id="edit-project"
              className="form-input"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Project name"
              autoFocus
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="edit-rate">
              Hourly Rate
            </label>
            <div className="input-group">
              <span className="input-group__prefix">$</span>
              <input
                id="edit-rate"
                className="input-group__input"
                type="text"
                inputMode="decimal"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="0"
              />
              <span className="input-group__suffix">/h</span>
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Duration</label>
            <div className="edit-entry__duration-row">
              <div className="edit-entry__duration-field">
                <input
                  className="form-input"
                  type="text"
                  inputMode="numeric"
                  value={hours}
                  onChange={(e) => setHours(e.target.value.replace(/[^0-9]/g, ""))}
                  onKeyDown={handleKeyDown}
                  placeholder="0"
                />
                <div className="edit-entry__duration-hint">hours</div>
              </div>
              <div className="edit-entry__duration-field">
                <input
                  className="form-input"
                  type="text"
                  inputMode="numeric"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, ""))}
                  onKeyDown={handleKeyDown}
                  placeholder="0"
                />
                <div className="edit-entry__duration-hint">minutes</div>
              </div>
            </div>
          </div>

          <div className="edit-entry__meta">
            <div>
              <strong>Start:</strong> {new Date(entry.startTime * 1000).toLocaleString()}
            </div>
            <div>
              <strong>End:</strong> {new Date(calculatedEndTime * 1000).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="dialog__footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSave()}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
