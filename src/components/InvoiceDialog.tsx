import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Invoice } from "../types/time-entry";

type InvoiceDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  startTime: number;
  endTime: number;
  onInvoiceOpened?: (payload: { invoice: Invoice; path: string }) => void;
};

type BusinessInfo = {
  name: string;
  address: string;
  email: string;
  phone: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  clientPhone: string;
};

const BUSINESS_INFO_STORAGE_KEY = "time-tracker:business-info";
const emptyBusinessInfo: BusinessInfo = {
  name: "",
  address: "",
  email: "",
  phone: "",
  clientName: "",
  clientAddress: "",
  clientEmail: "",
  clientPhone: "",
};

const toDateInputValue = (timestampSeconds: number) => {
  const date = new Date(timestampSeconds * 1000);
  return date.toISOString().slice(0, 10);
};

const parseDate = (value: string): Date | null => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
};

type DatePickerProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function DatePicker({ id, label, value, onChange }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const parsed = parseDate(value) ?? new Date();
  const [viewDate, setViewDate] = useState(parsed);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const next = parseDate(value);
    if (next) {
      setViewDate(next);
    }
  }, [value]);

  const daysInMonth = new Date(viewDate.getUTCFullYear(), viewDate.getUTCMonth() + 1, 0).getUTCDate();
  const startDay = new Date(viewDate.getUTCFullYear(), viewDate.getUTCMonth(), 1).getUTCDay();
  const dayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const offset = startDay;
  const cells = Array.from({ length: offset + daysInMonth }, (_, index) => {
    if (index < offset) return null;
    return index - offset + 1;
  });

  const handleSelect = (day: number) => {
    const selected = new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth(), day));
    const iso = selected.toISOString().slice(0, 10);
    onChange(iso);
    setIsOpen(false);
  };

  const changeMonth = (delta: number) => {
    const next = new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth() + delta, 1));
    setViewDate(next);
  };

  const formattedValue = value ? value : "";

  return (
    <div className="form-field date-picker" ref={containerRef}>
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <div className="date-picker__input" onClick={() => setIsOpen((open) => !open)}>
        <input
          id={id}
          type="text"
          readOnly
          className="date-picker__input-field"
          value={formattedValue}
          placeholder="YYYY-MM-DD"
        />
        <span className="date-picker__icon" aria-hidden="true">📅</span>
      </div>
      {isOpen && (
        <div className="date-picker__panel" role="application" aria-label={`${label} calendar`}>
          <div className="date-picker__header">
            <button
              type="button"
              className="date-picker__nav"
              onClick={() => changeMonth(-1)}
              aria-label="Previous month"
            >
              ←
            </button>
            <div className="date-picker__month">
              {viewDate.toLocaleString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}
            </div>
            <button
              type="button"
              className="date-picker__nav"
              onClick={() => changeMonth(1)}
              aria-label="Next month"
            >
              →
            </button>
          </div>
          <div className="date-picker__grid">
            {dayLabels.map((day) => (
              <div key={day} className="date-picker__day-label">{day}</div>
            ))}
            {cells.map((day, idx) => (
              <button
                key={`${day}-${idx}`}
                type="button"
                className={`date-picker__day ${day === null ? "date-picker__day--empty" : ""} ${value && parseDate(value)?.getUTCDate() === day && parseDate(value)?.getUTCMonth() === viewDate.getUTCMonth() ? "date-picker__day--selected" : ""}`}
                onClick={() => day && handleSelect(day)}
                disabled={day === null}
                aria-label={day ? `${viewDate.toLocaleString(undefined, { month: "long", timeZone: "UTC" })} ${day}, ${viewDate.getUTCFullYear()}` : undefined}
              >
                {day ?? ""}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const loadStoredBusinessInfo = (): BusinessInfo => {
  if (typeof window === "undefined") {
    return emptyBusinessInfo;
  }
  const stored = window.localStorage.getItem(BUSINESS_INFO_STORAGE_KEY);
  if (stored) {
    try {
      return { ...emptyBusinessInfo, ...JSON.parse(stored) };
    } catch {
      return emptyBusinessInfo;
    }
  }
  return emptyBusinessInfo;
};

export function InvoiceDialog({
  isOpen,
  onClose,
  startTime,
  endTime,
  onInvoiceOpened,
}: InvoiceDialogProps) {
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(loadStoredBusinessInfo);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(toDateInputValue(startTime));
  const [endDate, setEndDate] = useState<string>(toDateInputValue(endTime));

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setStartDate(toDateInputValue(startTime));
      setEndDate(toDateInputValue(endTime));
    }
  }, [isOpen, startTime, endTime]);

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      setError("Please select a start and end date");
      return;
    }

    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(23, 59, 59, 999);

    if (rangeStart.getTime() > rangeEnd.getTime()) {
      setError("Start date cannot be after end date");
      return;
    }

    if (!businessInfo.name.trim()) {
      setError("Please enter your business name");
      return;
    }

    if (!businessInfo.clientName.trim()) {
      setError("Please enter who you are invoicing");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      window.localStorage.setItem(
        BUSINESS_INFO_STORAGE_KEY,
        JSON.stringify(businessInfo)
      );

      const invoice = await invoke<Invoice>("save_invoice", {
        businessInfo: {
          name: businessInfo.name,
          address: businessInfo.address || null,
          email: businessInfo.email || null,
          phone: businessInfo.phone || null,
          clientName: businessInfo.clientName || null,
          clientAddress: businessInfo.clientAddress || null,
          clientEmail: businessInfo.clientEmail || null,
          clientPhone: businessInfo.clientPhone || null,
        },
        startTime: Math.floor(rangeStart.getTime() / 1000),
        endTime: Math.floor(rangeEnd.getTime() / 1000),
      });

      const downloadPath = await invoke<string>("export_invoice_to_downloads", {
        id: invoice.id,
      });

      await invoke("open_file_in_default_app", { path: downloadPath });

      if (onInvoiceOpened) {
        onInvoiceOpened({ invoice, path: downloadPath });
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="dialog dialog--wide invoice-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog__header">
          <h3 className="dialog__title">Generate Invoice</h3>
          <button
            className="dialog__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <div className="dialog__body">
          {error && (
            <div className="message message--error">
              <span>{error}</span>
            </div>
          )}
          <p className="invoice-dialog__description">
            Keep your own details on the left and the recipient on the right. Both
            are saved locally for the next invoice.
          </p>

          <div className="form-grid" style={{ marginBottom: "var(--space-4)" }}>
            <DatePicker
              id="invoice-start-date"
              label="Period Start"
              value={startDate}
              onChange={setStartDate}
            />
            <DatePicker
              id="invoice-end-date"
              label="Period End"
              value={endDate}
              onChange={setEndDate}
            />
          </div>

          <div className="invoice-dialog__grid">
            <div className="invoice-group">
              <div className="invoice-group__title">From (you)</div>

              <div className="invoice-field">
                <label className="invoice-field__label" htmlFor="business-name">
                  Business Name <span className="invoice-required">*</span>
                </label>
                <input
                  id="business-name"
                  className="invoice-input"
                  type="text"
                  placeholder="Your Company Name"
                  value={businessInfo.name}
                  onChange={(e) =>
                    setBusinessInfo({ ...businessInfo, name: e.target.value })
                  }
                />
              </div>

              <div className="invoice-field">
                <label className="invoice-field__label" htmlFor="business-address">
                  Address
                </label>
                <input
                  id="business-address"
                  className="invoice-input"
                  type="text"
                  placeholder="123 Main St, City, State ZIP"
                  value={businessInfo.address}
                  onChange={(e) =>
                    setBusinessInfo({ ...businessInfo, address: e.target.value })
                  }
                />
              </div>

              <div className="invoice-field">
                <label className="invoice-field__label" htmlFor="business-email">
                  Email
                </label>
                <input
                  id="business-email"
                  className="invoice-input"
                  type="email"
                  placeholder="you@example.com"
                  value={businessInfo.email}
                  onChange={(e) =>
                    setBusinessInfo({ ...businessInfo, email: e.target.value })
                  }
                />
              </div>

              <div className="invoice-field">
                <label className="invoice-field__label" htmlFor="business-phone">
                  Phone
                </label>
                <input
                  id="business-phone"
                  className="invoice-input"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={businessInfo.phone}
                  onChange={(e) =>
                    setBusinessInfo({ ...businessInfo, phone: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="invoice-group">
              <div className="invoice-group__title">Bill to</div>

              <div className="invoice-field">
                <label className="invoice-field__label" htmlFor="client-name">
                  Company / Contact <span className="invoice-required">*</span>
                </label>
                <input
                  id="client-name"
                  className="invoice-input"
                  type="text"
                  placeholder="Client Company or Person"
                  value={businessInfo.clientName}
                  onChange={(e) =>
                    setBusinessInfo({ ...businessInfo, clientName: e.target.value })
                  }
                />
              </div>

              <div className="invoice-field">
                <label className="invoice-field__label" htmlFor="client-address">
                  Address
                </label>
                <input
                  id="client-address"
                  className="invoice-input"
                  type="text"
                  placeholder="Street, City, Country"
                  value={businessInfo.clientAddress}
                  onChange={(e) =>
                    setBusinessInfo({ ...businessInfo, clientAddress: e.target.value })
                  }
                />
              </div>

              <div className="invoice-field">
                <label className="invoice-field__label" htmlFor="client-email">
                  Email
                </label>
                <input
                  id="client-email"
                  className="invoice-input"
                  type="email"
                  placeholder="client@example.com"
                  value={businessInfo.clientEmail}
                  onChange={(e) =>
                    setBusinessInfo({ ...businessInfo, clientEmail: e.target.value })
                  }
                />
              </div>

              <div className="invoice-field">
                <label className="invoice-field__label" htmlFor="client-phone">
                  Phone
                </label>
                <input
                  id="client-phone"
                  className="invoice-input"
                  type="tel"
                  placeholder="(555) 987-6543"
                  value={businessInfo.clientPhone}
                  onChange={(e) =>
                    setBusinessInfo({ ...businessInfo, clientPhone: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <div className="dialog__footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? "Generating..." : "Generate Preview"}
          </button>
        </div>
      </div>
    </div>
  );
}
