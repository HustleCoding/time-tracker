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
      setError(`Failed to delete invoice: ${err}`);
    }
  };

  const handlePreview = (invoice: Invoice) => {
    setPreviewInvoice(invoice);
  };

  const closePreview = () => {
    setPreviewInvoice(null);
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
            onDelete={handleDelete}
          />
        ))}
      </div>

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
