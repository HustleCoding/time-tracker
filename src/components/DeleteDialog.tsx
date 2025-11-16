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
    <div className="delete-dialog" role="dialog" aria-modal="true">
      <div className="delete-dialog__panel">
        <h3 className="delete-dialog__title">Delete this entry?</h3>
        <p className="delete-dialog__body">
          Removing <strong>{target.projectName}</strong> can&apos;t be undone.
          The tracked time will be removed from today&apos;s total.
        </p>
        <div className="delete-dialog__actions">
          <button type="button" className="button-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="delete-dialog__confirm"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
