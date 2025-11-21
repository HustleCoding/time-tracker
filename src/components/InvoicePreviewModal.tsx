import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

type InvoicePreviewModalProps = {
  invoiceId?: number;
  filePath?: string;
  onClose: () => void;
  onDownload?: (invoiceId: number) => void;
};

export function InvoicePreviewModal({
  invoiceId,
  filePath: propFilePath,
  onClose,
  onDownload
}: InvoicePreviewModalProps) {
  const [filePath, setFilePath] = useState<string>(propFilePath || '');
  const [loading, setLoading] = useState(!propFilePath);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (invoiceId && !propFilePath) {
      loadInvoicePath();
    }
  }, [invoiceId, propFilePath]);

  useEffect(() => {
    // Automatically open the PDF when the file path is loaded
    if (filePath && !opening) {
      openPdfInViewer();
    }
  }, [filePath]);

  const loadInvoicePath = async () => {
    try {
      setLoading(true);
      setError(null);
      const path = await invoke<string>('get_invoice_pdf_path', { id: invoiceId });
      setFilePath(path);
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const openPdfInViewer = async () => {
    if (!filePath || opening) return;

    try {
      setOpening(true);
      await invoke('open_file_in_default_app', { path: filePath });
    } catch (err) {
      console.error('Failed to open PDF:', err);
      setError(`Failed to open PDF viewer: ${err}`);
    } finally {
      setOpening(false);
    }
  };

  const handleDownload = async () => {
    if (!invoiceId) return;

    try {
      setDownloading(true);
      const downloadPath = await invoke<string>('export_invoice_to_downloads', { id: invoiceId });
      alert(`Invoice downloaded to: ${downloadPath}`);
      if (onDownload) {
        onDownload(invoiceId);
      }
    } catch (err) {
      alert(`Failed to download invoice: ${err}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content invoice-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Invoice Preview</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="invoice-preview-body">
          {loading && <div className="loading-state">Loading invoice...</div>}

          {error && (
            <div className="error-state">
              <p>{error}</p>
              <button onClick={loadInvoicePath}>Retry</button>
            </div>
          )}

          {!loading && !error && filePath && (
            <div className="pdf-opened-message">
              <div className="pdf-icon">📄</div>
              <h3>Invoice Opened in PDF Viewer</h3>
              <p>The invoice has been opened in your system's default PDF viewer.</p>
              <p className="pdf-path">Location: {filePath}</p>
              <button className="button-secondary" onClick={openPdfInViewer}>
                Open Again
              </button>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="button-secondary" onClick={onClose}>
            Close
          </button>
          {invoiceId && (
            <button
              className="button-primary"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? 'Downloading...' : 'Download'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
