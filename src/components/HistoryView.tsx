import { useEffect, useState } from "react";
import { EntriesSection } from "./EntriesSection";
import { InvoiceDialog } from "./InvoiceDialog";
import type { TimeEntry } from "../types/time-entry";
import { formatDuration } from "../lib/time";
import { formatCurrency } from "../lib/currency";

type HistoryViewProps = {
  entries: TimeEntry[];
  loading: boolean;
  onLoadHistory: (start: number, end: number) => void;
  onDeleteClick: (entry: TimeEntry) => void;
  // We might want to support editing in history too, but let's start read-only or reuse the same handlers if passed
  // For now, let's assume read-only or simple delete for history to keep it simple, 
  // but the user might expect full editing. 
  // Let's pass the edit props as optional or just mock them if we don't want to support editing yet.
  // Actually, the plan didn't explicitly exclude editing. 
  // Let's try to support it if possible, or just pass no-ops for now.
  // To support editing, we need to pass all the edit handlers from App.tsx.
  // For simplicity in this step, I'll pass the edit props through.
  editingId: number | null;
  editingName: string;
  editingRate: string;
  onEditingNameChange: (value: string) => void;
  onEditingRateChange: (value: string) => void;
  onEditKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  beginEditing: (entry: TimeEntry) => void;
  cancelEditing: () => void;
  saveEditing: () => void;
};

export function HistoryView({
  entries,
  loading,
  onLoadHistory,
  onDeleteClick,
  editingId,
  editingName,
  editingRate,
  onEditingNameChange,
  onEditingRateChange,
  onEditKeyDown,
  beginEditing,
  cancelEditing,
  saveEditing,
}: HistoryViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const totalDurationSeconds = entries.reduce((acc, entry) => acc + entry.duration, 0);
  const totalAmount = entries.reduce((acc, entry) => acc + entry.amount, 0);

  useEffect(() => {
    const start = new Date(currentDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(currentDate);
    end.setHours(23, 59, 59, 999);

    onLoadHistory(
      Math.floor(start.getTime() / 1000),
      Math.floor(end.getTime() / 1000)
    );
  }, [currentDate, onLoadHistory]);

  const handlePrevDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    
    // Optional: Prevent going to future?
    // if (newDate > new Date()) return;
    
    setCurrentDate(newDate);
  };

  const isToday = currentDate.toDateString() === new Date().toDateString();

  return (
    <div className="history-view">
      <div className="history-nav">
        <div className="history-nav__controls">
          <button className="button-nav" onClick={handlePrevDay}>
            ← Prev
          </button>
          <button
            className="button-nav"
            onClick={handleNextDay}
            disabled={isToday}
            style={{ visibility: isToday ? "hidden" : "visible" }}
          >
            Next →
          </button>
        </div>

        <div className="history-nav__center">
          <span className="history-nav__date">
            {currentDate.toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
          <div className="history-nav__meta">
            <span className="history-nav__pill">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </span>
            <span className="history-nav__pill">
              {formatDuration(totalDurationSeconds)}
            </span>
            <span className="history-nav__pill">
              {formatCurrency(totalAmount)}
            </span>
          </div>
        </div>

        <div className="history-nav__controls">
          <button
            className="button-export"
            onClick={() => setShowInvoiceDialog(true)}
            title="Export all entries as invoice PDF"
          >
            Export Invoice
          </button>
        </div>
      </div>

      <EntriesSection
        title={isToday ? "Today's Log" : "History Log"}
        loading={loading}
        entries={entries}
        isRefreshing={false}
        editingId={editingId}
        editingName={editingName}
        editingRate={editingRate}
        onEditingNameChange={onEditingNameChange}
        onEditingRateChange={onEditingRateChange}
        onEditKeyDown={onEditKeyDown}
        beginEditing={beginEditing}
        cancelEditing={cancelEditing}
        saveEditing={saveEditing}
        onDeleteClick={onDeleteClick}
      />

      <InvoiceDialog
        isOpen={showInvoiceDialog}
        onClose={() => setShowInvoiceDialog(false)}
      />
    </div>
  );
}
