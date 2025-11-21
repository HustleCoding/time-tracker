import { Invoice } from '../types/time-entry';
import { formatCurrency } from '../lib/currency';

type InvoiceCardProps = {
  invoice: Invoice;
  onPreview: (invoice: Invoice) => void;
  onDelete: (invoiceId: number) => void;
};

export function InvoiceCard({ invoice, onPreview, onDelete }: InvoiceCardProps) {
  const formattedDate = new Date(invoice.createdAt * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTime = new Date(invoice.createdAt * 1000).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this invoice?')) {
      onDelete(invoice.id);
    }
  };

  return (
    <div className="invoice-card" onClick={() => onPreview(invoice)}>
      <div className="invoice-card-main">
        <div className="invoice-card-header">
          <div className="invoice-date">
            <div className="invoice-date-main">{formattedDate}</div>
            <div className="invoice-time">{formattedTime}</div>
          </div>
          <div className="invoice-amount">{formatCurrency(invoice.totalAmount)}</div>
        </div>

        <div className="invoice-card-details">
          <div className="invoice-detail">
            <span className="detail-label">Total Hours:</span>
            <span className="detail-value">{invoice.totalHours.toFixed(2)} hrs</span>
          </div>
          <div className="invoice-detail">
            <span className="detail-label">Entries:</span>
            <span className="detail-value">{invoice.entryCount}</span>
          </div>
        </div>
      </div>

      <div className="invoice-card-actions">
        <button
          className="action-button delete-button"
          onClick={handleDelete}
          title="Delete invoice"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
