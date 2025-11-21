import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Invoice } from "../types/time-entry";
import { InvoiceCard } from "./InvoiceCard";
import { Toast } from "./Toast";

type InvoicesViewProps = {
  refreshSignal: number;
};

export function InvoicesView({ refreshSignal }: InvoicesViewProps) {
  const parseError = (err: unknown) => (err instanceof Error ? err.message : String(err));
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoiceToast, setInvoiceToast] = useState<{ path: string } | null>(null);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await invoke<Invoice[]>("get_all_invoices");
      setInvoices(data);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices, refreshSignal]);

  const handlePreview = async (invoice: Invoice) => {
    try {
      await invoke("open_file_in_default_app", { path: invoice.filePath });
      setInvoiceToast({ path: invoice.filePath });
    } catch (err) {
      setError(`Failed to open invoice: ${err}`);
    }
  };

  if (loading) {
    return (
      <div className="invoices-view">
        <div className="empty-state">
          <div className="empty-state__title">Loading invoices...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="invoices-view">
        <div className="message message--error">
          <span>{error}</span>
          <button className="btn btn-secondary" onClick={loadInvoices}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="invoices-view">
        <div className="page-header">
          <h1 className="page-title">Invoices</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state__title">No invoices yet</div>
          <div className="empty-state__description">
            Create your first invoice from the History view
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="invoices-view">
      <div className="page-header">
        <h1 className="page-title">Invoices</h1>
        <button className="btn btn-secondary" onClick={loadInvoices}>
          Refresh
        </button>
      </div>

      <div className="invoices-list">
        {invoices.map(invoice => (
          <InvoiceCard
            key={invoice.id}
            invoice={invoice}
            onPreview={handlePreview}
          />
        ))}
      </div>
      {invoiceToast && (
        <Toast
          message="Invoice opened in your PDF viewer"
          caption={invoiceToast.path}
          actions={[
            {
              label: "Open again",
              onClick: async () => {
                try {
                  await invoke("open_file_in_default_app", { path: invoiceToast.path });
                } catch {
                  /* ignore */
                }
              },
            },
            {
              label: "Copy path",
              onClick: async () => {
                try {
                  await navigator.clipboard?.writeText(invoiceToast.path);
                } catch {
                  /* ignore */
                }
              },
            },
          ]}
          onDismiss={() => setInvoiceToast(null)}
        />
      )}
    </div>
  );
}
