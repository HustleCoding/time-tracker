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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this invoice?')) {
      onDelete(invoice.id);
    }
  };

  return (
    <div className="invoice-card">
      <div className="invoice-card__main">
        <div className="invoice-card__header">
          <div className="invoice-card__number">Invoice #{String(invoice.id).padStart(3, '0')}</div>
          <div className="invoice-card__date">{formattedDate}</div>
        </div>
        <div className="invoice-card__amount">{formatCurrency(invoice.totalAmount)}</div>
      </div>

      <div className="invoice-card__actions">
        <button
          className="btn btn-secondary"
          onClick={() => onPreview(invoice)}
          title="View invoice PDF"
        >
          View PDF
        </button>
        <button
          className="btn-ghost"
          onClick={handleDelete}
          title="Delete invoice"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
