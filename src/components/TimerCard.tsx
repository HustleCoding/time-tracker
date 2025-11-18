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
            />
          </div>
          <div className="timer-field">
            <div className="rate-input-group">
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
          disabled={isRunning ? false : isStartDisabled}
        >
          {isRunning ? "Stop Timer" : "Start Timer"}
        </button>
      </div>
    </section>
  );
}
