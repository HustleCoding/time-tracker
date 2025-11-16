type TimerCardProps = {
  projectName: string;
  hourlyRate: string;
  isRunning: boolean;
  timerDisplay: string;
  isStartDisabled: boolean;
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
  onProjectNameChange,
  onHourlyRateChange,
  onStart,
  onStop,
}: TimerCardProps) {
  return (
    <section className={`timer-card ${isRunning ? "timer-card--active" : ""}`}>
      <div className="timer-display">{timerDisplay}</div>
      <span
        className={`status-badge ${
          isRunning ? "status-badge--running" : "status-badge--idle"
        }`}
      >
        {isRunning ? "Timer Running" : "Timer Stopped"}
      </span>
      <div className="timer-controls">
        <div className="timer-inputs">
          <label className="timer-field timer-field--project">
            <span className="timer-field__label">Project</span>
            <input
              className="timer-input"
              type="text"
              placeholder="What are you working on?"
              value={projectName}
              onChange={(event) => onProjectNameChange(event.target.value)}
              disabled={isRunning}
            />
          </label>
          <label className="timer-field timer-field--rate">
            <span className="timer-field__label">Hourly Rate</span>
            <div className="rate-input-group">
              <span className="rate-input-group__prefix">$</span>
              <input
                className="rate-input"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={hourlyRate}
                onChange={(event) => onHourlyRateChange(event.target.value)}
              />
              <span className="rate-input-group__suffix">/hr</span>
            </div>
          </label>
        </div>
        <button
          type="button"
          className={isRunning ? "button-stop" : "button-primary"}
          onClick={isRunning ? onStop : onStart}
          disabled={isRunning ? false : isStartDisabled}
        >
          {isRunning ? "Stop Timer" : "Start Timer"}
        </button>
      </div>
    </section>
  );
}
