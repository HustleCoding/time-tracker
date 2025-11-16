type TimerCardProps = {
  projectName: string;
  isRunning: boolean;
  timerDisplay: string;
  isStartDisabled: boolean;
  onProjectNameChange: (value: string) => void;
  onStart: () => void | Promise<void>;
  onStop: () => void | Promise<void>;
};

export function TimerCard({
  projectName,
  isRunning,
  timerDisplay,
  isStartDisabled,
  onProjectNameChange,
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
        <input
          className="timer-input"
          type="text"
          placeholder="What are you working on?"
          value={projectName}
          onChange={(event) => onProjectNameChange(event.target.value)}
          disabled={isRunning}
        />
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
