type TimerCardProps = {
  projectName: string;
  hourlyRate: string;
  isRunning: boolean;
  timerDisplay: string;
  isStartDisabled: boolean;
  isStarting: boolean;
  isStopping: boolean;
  onProjectNameChange: (value: string) => void;
  onHourlyRateChange: (value: string) => void;
  onStart: () => void | Promise<void>;
  onStop: () => void | Promise<void>;
};

export function TimerCard({
  projectName,
  hourlyRate,
  isRunning,
  timerDisplay,
  isStartDisabled,
  isStarting,
  isStopping,
  onProjectNameChange,
  onHourlyRateChange,
  onStart,
  onStop,
}: TimerCardProps) {
  return (
    <section className="timer-card">
      <div>
        <div className="timer-display">{timerDisplay}</div>
        <div
          className={`status-badge ${
            isRunning ? "status-badge--running" : "status-badge--idle"
          }`}
        >
          {isRunning ? "Recording" : "Ready"}
        </div>
      </div>

      <div className="timer-controls">
        <div className="timer-inputs">
          <div className="timer-field">
            <input
              className="timer-input"
              type="text"
              placeholder="Project description..."
              value={projectName}
              onChange={(event) => onProjectNameChange(event.target.value)}
              disabled={isRunning}
              title={isRunning ? "Stop the timer to edit" : "Enter a project name to start tracking"}
            />
          </div>
          <div className="timer-field">
            <div className="rate-input-group" title="Your hourly rate in USD">
              <span className="rate-input-group__prefix">$</span>
              <input
                className="rate-input"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={hourlyRate}
                onChange={(event) => onHourlyRateChange(event.target.value)}
              />
              <span className="rate-input-group__suffix">/h</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          className={isRunning ? "button-stop" : "button-primary"}
          onClick={isRunning ? onStop : onStart}
          disabled={isRunning ? isStopping : isStartDisabled || isStarting}
          title={
            isRunning
              ? "Stop timer (⌘/Ctrl+Enter)"
              : isStartDisabled
                ? "Enter a project name first"
                : "Start timer (⌘/Ctrl+Enter)"
          }
        >
          {isRunning
            ? isStopping
              ? "Stopping..."
              : "Stop Timer"
            : isStarting
              ? "Starting..."
              : "Start Timer"}
        </button>
      </div>
    </section>
  );
}
