import type { TimeEntry } from "../types/time-entry";

type DeleteDialogProps = {
  target: TimeEntry | null;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function DeleteDialog({
  target,
  onCancel,
  onConfirm,
}: DeleteDialogProps) {
  if (!target) {
    return null;
  }

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__header">
          <h3 className="dialog__title">Delete Entry</h3>
          <button className="dialog__close" onClick={onCancel} aria-label="Close">
            ×
          </button>
        </div>

        <div className="dialog__body">
          <p>
            Are you sure you want to delete <strong>{target.projectName}</strong>?
            This action cannot be undone.
          </p>
        </div>

        <div className="dialog__footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
          >
            Delete Entry
          </button>
        </div>
      </div>
    </div>
  );
}
