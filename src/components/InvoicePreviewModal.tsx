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
  const [filePath, setFilePath] = useState<string>(propFilePath || "");
  const [loading, setLoading] = useState(!propFilePath);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);

  useEffect(() => {
    if (invoiceId && !propFilePath) {
      loadInvoicePath();
    }
  }, [invoiceId, propFilePath]);

  useEffect(() => {
    setDownloadMessage(null);
    setError(null);
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
      const path = await invoke<string>("get_invoice_pdf_path", { id: invoiceId });
      setFilePath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
      setDownloadMessage(null);
      setError(null);
      const downloadPath = await invoke<string>("export_invoice_to_downloads", { id: invoiceId });
      setDownloadMessage(`Invoice downloaded to: ${downloadPath}`);
      if (onDownload) {
        onDownload(invoiceId);
      }
    } catch (err) {
      setError(`Failed to download invoice: ${err}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="dialog invoice-preview" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__header">
          <h3 className="dialog__title">Invoice Preview</h3>
          <button className="dialog__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="dialog__body invoice-preview__body">
          {loading && <div className="invoice-preview__status">Loading invoice...</div>}

          {error && (
            <div className="message message--error invoice-preview__status">
              <p>{error}</p>
              <button className="btn btn-secondary" onClick={loadInvoicePath}>
                Retry
              </button>
            </div>
          )}

          {!loading && !error && filePath && (
            <div className="invoice-preview__success">
              <div className="invoice-preview__icon" aria-hidden="true">📄</div>
              <div className="invoice-preview__text">
                <h4>Invoice opened in your PDF viewer</h4>
                <p>The invoice has been opened in your system&apos;s default PDF viewer.</p>
                <p className="invoice-preview__path">Location: {filePath}</p>
              </div>
              <div className="invoice-preview__actions">
                <button className="btn btn-secondary" onClick={openPdfInViewer}>
                  Open Again
                </button>
              </div>
            </div>
          )}

          {downloadMessage && (
            <div className="invoice-preview__status">
              <div className="invoice-preview__path">{downloadMessage}</div>
            </div>
          )}
        </div>

        <div className="dialog__footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          {invoiceId && (
            <button
              className="btn btn-primary"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? "Downloading..." : "Download"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
