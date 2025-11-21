type ToastAction = {
  label: string;
  onClick: () => void;
};

type ToastProps = {
  message: string;
  caption?: string;
  actions?: ToastAction[];
  onDismiss?: () => void;
};

export function Toast({ message, caption, actions, onDismiss }: ToastProps) {
  return (
    <div className="toast" role="status">
      <div className="toast__content">
        <div className="toast__header">
          <div className="toast__message">{message}</div>
          {onDismiss && (
            <button
              className="toast__dismiss"
              onClick={onDismiss}
              type="button"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          )}
        </div>
        {caption && <div className="toast__caption">{caption}</div>}
        {actions?.length ? (
          <div className="toast__actions">
            {actions.map(({ label, onClick }) => (
              <button
                key={label}
                className="toast__button"
                onClick={onClick}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
