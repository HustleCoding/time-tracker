import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { EntriesSection } from "./EntriesSection";
import { InvoiceDialog } from "./InvoiceDialog";
import type { Invoice, TimeEntry } from "../types/time-entry";
import { formatDuration } from "../lib/time";
import { formatCurrency } from "../lib/currency";
import { Toast } from "./Toast";

type HistoryViewProps = {
  entries: TimeEntry[];
  loading: boolean;
  onLoadHistory: (start: number, end: number) => void;
  onDeleteClick: (entry: TimeEntry) => void;
  editingId: number | null;
  editingName: string;
  editingRate: string;
  onEditingNameChange: (value: string) => void;
  onEditingRateChange: (value: string) => void;
  onEditKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  beginEditing: (entry: TimeEntry) => void;
  cancelEditing: () => void;
  saveEditing: () => void;
  isActive: boolean;
  refreshSignal: number;
  onInvoiceCreated?: (invoice: Invoice) => void;
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
  isActive,
  refreshSignal,
  onInvoiceCreated,
}: HistoryViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [invoiceToast, setInvoiceToast] = useState<{ path: string } | null>(null);
  const totalDurationSeconds = entries.reduce((acc, entry) => acc + entry.duration, 0);
  const totalAmount = entries.reduce((acc, entry) => acc + entry.amount, 0);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const start = new Date(currentDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(currentDate);
    end.setHours(23, 59, 59, 999);

    onLoadHistory(
      Math.floor(start.getTime() / 1000),
      Math.floor(end.getTime() / 1000)
    );
  }, [currentDate, onLoadHistory, refreshSignal, isActive]);

  const handlePrevDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const isToday = currentDate.toDateString() === new Date().toDateString();

  const handleInvoiceOpened = (payload: { path: string; invoice: Invoice }) => {
    setInvoiceToast({ path: payload.path });
    onInvoiceCreated?.(payload.invoice);
  };

  const handleToastOpenAgain = async () => {
    if (!invoiceToast) return;
    try {
      await invoke("open_file_in_default_app", { path: invoiceToast.path });
    } catch {
      // swallow; user can try again
    }
  };

  const handleToastCopyPath = async () => {
    if (!invoiceToast) return;
    try {
      await navigator.clipboard?.writeText(invoiceToast.path);
    } catch {
      // no-op if clipboard blocked
    }
  };

  return (
    <div className="history-view">
      {/* Date Navigation */}
      <div className="history-nav">
        <div className="history-nav__controls">
          <button className="btn btn-secondary" onClick={handlePrevDay}>
            ← Previous
          </button>
          {!isToday && (
            <button className="btn btn-secondary" onClick={handleNextDay}>
              Next →
            </button>
          )}
        </div>

        <div className="history-nav__date">
          {currentDate.toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>

        <div className="history-nav__actions">
          <button
            className="btn btn-primary"
            onClick={() => setShowInvoiceDialog(true)}
            title="Create invoice from entries"
          >
            Create Invoice
          </button>
        </div>
      </div>

      {/* Entries Table */}
      <div className="history-entries">
        <EntriesSection
          title="Time Entries"
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

        {/* Summary */}
        {entries.length > 0 && (
          <div className="history-summary">
            <div className="history-summary__label">Total</div>
            <div className="history-summary__value">
              {formatDuration(totalDurationSeconds)} • {formatCurrency(totalAmount)}
            </div>
          </div>
        )}
      </div>

      {/* Invoice Dialog */}
      <InvoiceDialog
        isOpen={showInvoiceDialog}
        onClose={() => setShowInvoiceDialog(false)}
        onInvoiceOpened={handleInvoiceOpened}
      />

      {invoiceToast && (
        <Toast
          message="Invoice opened in your PDF viewer"
          caption={invoiceToast.path}
          actions={[
            { label: "Open again", onClick: handleToastOpenAgain },
            { label: "Copy path", onClick: handleToastCopyPath },
          ]}
          onDismiss={() => setInvoiceToast(null)}
        />
      )}
    </div>
  );
}
