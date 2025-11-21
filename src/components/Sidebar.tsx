type SidebarProps = {
  view: "timer" | "history" | "invoices";
  onViewChange: (view: "timer" | "history" | "invoices") => void;
  projectName: string;
  hourlyRate: string;
  isRunning: boolean;
  timerDisplay: string;
  isStartDisabled: boolean;
  isStarting: boolean;
  isStopping: boolean;
  todayTotalSeconds: number;
  todayTotalAmount: number;
  onProjectNameChange: (value: string) => void;
  onHourlyRateChange: (value: string) => void;
  onStart: () => void | Promise<void>;
  onStop: () => void | Promise<void>;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
};

import { formatDuration } from "../lib/time";
import { formatCurrency } from "../lib/currency";

export function Sidebar({
  view,
  onViewChange,
  projectName,
  hourlyRate,
  isRunning,
  timerDisplay,
  isStartDisabled,
  isStarting,
  isStopping,
  todayTotalSeconds,
  todayTotalAmount,
  onProjectNameChange,
  onHourlyRateChange,
  onStart,
  onStop,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  return (
    <aside className={`sidebar ${isCollapsed ? "sidebar--collapsed" : ""}`}>
      <button
        className="sidebar__toggle"
        onClick={onToggleCollapse}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? "›" : "‹"}
      </button>

      {!isCollapsed && (
        <div className="sidebar__content">
          {/* Navigation */}
          <nav className="sidebar__nav">
            <button
              className={`sidebar__nav-item ${view === "timer" ? "sidebar__nav-item--active" : ""}`}
              onClick={() => onViewChange("timer")}
            >
              <span className="sidebar__nav-icon">⏱</span>
              <span className="sidebar__nav-label">Timer</span>
            </button>
            <button
              className={`sidebar__nav-item ${view === "history" ? "sidebar__nav-item--active" : ""}`}
              onClick={() => onViewChange("history")}
            >
              <span className="sidebar__nav-icon">📋</span>
              <span className="sidebar__nav-label">History</span>
            </button>
            <button
              className={`sidebar__nav-item ${view === "invoices" ? "sidebar__nav-item--active" : ""}`}
              onClick={() => onViewChange("invoices")}
            >
              <span className="sidebar__nav-icon">📄</span>
              <span className="sidebar__nav-label">Invoices</span>
            </button>
          </nav>

          {/* Timer Section */}
          <div className="sidebar__section">
            <h3 className="sidebar__section-title">Current Timer</h3>
            <div className="sidebar__timer-display">{timerDisplay}</div>
            <div
              className={`sidebar__status-badge ${
                isRunning
                  ? "sidebar__status-badge--running"
                  : "sidebar__status-badge--idle"
              }`}
            >
              {isRunning ? "Recording" : "Ready"}
            </div>

            <div className="sidebar__timer-controls">
              <div className="sidebar__timer-field">
                <label className="sidebar__label">Project</label>
                <input
                  className="sidebar__input"
                  type="text"
                  placeholder="Project name..."
                  value={projectName}
                  onChange={(event) => onProjectNameChange(event.target.value)}
                  disabled={isRunning}
                  title={
                    isRunning
                      ? "Stop the timer to edit"
                      : "Enter a project name to start tracking"
                  }
                />
              </div>

              <div className="sidebar__timer-field">
                <label className="sidebar__label">Hourly Rate</label>
                <div
                  className="sidebar__rate-input-group"
                  title="Your hourly rate in USD"
                >
                  <span className="sidebar__rate-prefix">$</span>
                  <input
                    className="sidebar__rate-input"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={hourlyRate}
                    onChange={(event) => onHourlyRateChange(event.target.value)}
                  />
                  <span className="sidebar__rate-suffix">/h</span>
                </div>
              </div>

              <button
                type="button"
                className={
                  isRunning
                    ? "sidebar__button sidebar__button--stop"
                    : "sidebar__button sidebar__button--start"
                }
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
          </div>

          {/* Today's Total */}
          <div className="sidebar__section sidebar__section--total">
            <h3 className="sidebar__section-title">Today's Total</h3>
            <div className="sidebar__total-time">
              {formatDuration(todayTotalSeconds)}
            </div>
            <div className="sidebar__total-amount">
              {formatCurrency(todayTotalAmount)}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
