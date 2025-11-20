import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

type InvoiceDialogProps = {
  isOpen: boolean;
  onClose: () => void;
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

export function InvoiceDialog({ isOpen, onClose }: InvoiceDialogProps) {
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(loadStoredBusinessInfo);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  const handleGenerate = async () => {
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
    setSuccess(null);

    try {
      // Save business info to localStorage
      window.localStorage.setItem(
        BUSINESS_INFO_STORAGE_KEY,
        JSON.stringify(businessInfo)
      );

      // Generate PDF
      const pdfPath = await invoke<string>("generate_invoice_pdf", {
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
      });

      setSuccess(`Invoice saved to: ${pdfPath}`);
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
    <div className="invoice-dialog">
      <div className="invoice-dialog__panel">
        <div className="invoice-dialog__header">
          <h2 className="invoice-dialog__title">Generate Invoice</h2>
          <button
            className="invoice-dialog__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="invoice-dialog__error">
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="invoice-dialog__success">
            <p>{success}</p>
            <button className="button-primary" onClick={onClose}>
              Close
            </button>
          </div>
        )}

        {!success && (
          <div className="invoice-dialog__body">
            <p className="invoice-dialog__description">
              Keep your own details on the left and the recipient on the right. Both
              are saved locally for the next invoice.
            </p>

            <div className="invoice-dialog__form">
              <div className="invoice-columns">
                <div className="invoice-group">
                  <div className="invoice-group__title">From (you)</div>

                  <div className="invoice-field">
                    <label className="invoice-field__label" htmlFor="business-name">
                      Business Name <span className="required">*</span>
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
                      Company / Contact <span className="required">*</span>
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

            <div className="invoice-dialog__actions">
              <button className="button-ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                className="button-primary"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? "Generating..." : "Generate Invoice PDF"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
