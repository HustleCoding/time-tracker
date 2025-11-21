import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Invoice } from '../types/time-entry';
import { InvoiceCard } from './InvoiceCard';
import { InvoicePreviewModal } from './InvoicePreviewModal';

export function InvoicesView() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await invoke<Invoice[]>('get_all_invoices');
      setInvoices(data);
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (invoiceId: number) => {
    try {
      await invoke('delete_invoice', { id: invoiceId });
      setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
    } catch (err) {
      alert(`Failed to delete invoice: ${err}`);
    }
  };

  const handlePreview = (invoice: Invoice) => {
    setPreviewInvoice(invoice);
  };

  const closePreview = () => {
    setPreviewInvoice(null);
  };

  return (
    <div className="history-view">
      <div className="history-header">
        <h2>Invoices</h2>
        <button className="button-secondary" onClick={loadInvoices}>
          Refresh
        </button>
      </div>

      {loading && (
        <div className="loading-state">
          Loading invoices...
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>Failed to load invoices: {error}</p>
          <button onClick={loadInvoices}>Retry</button>
        </div>
      )}

      {!loading && !error && invoices.length === 0 && (
        <div className="empty-state">
          <p>No invoices yet</p>
          <p className="empty-state-hint">
            Create your first invoice from the History view
          </p>
        </div>
      )}

      {!loading && !error && invoices.length > 0 && (
        <div className="invoices-list">
          {invoices.map(invoice => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              onPreview={handlePreview}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {previewInvoice && (
        <InvoicePreviewModal
          invoiceId={previewInvoice.id}
          onClose={closePreview}
          onDownload={() => {}}
        />
      )}
    </div>
  );
}
