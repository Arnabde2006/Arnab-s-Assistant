import React from "react";
import FileUpload from "../FileUpload.jsx";
import { Lock } from "lucide-react";

export default function FinanceImportModal({
  file,
  setFile,
  uploadLoading,
  uploadError,
  uploadResult,
  uploadStatement,
  showPasswordModal,
  pdfPassword,
  setPdfPassword,
  pdfPasswordError,
  cancelPasswordModal,
  dialogProps,
  titleProps,
}) {
  return (
    <>
      {/* Upload Form Card */}
      <form onSubmit={uploadStatement} className="card">
        <div className="label" style={{ marginBottom: 8 }}>
          Upload statement or UPI screenshot
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          A bank statement PDF or a Google Pay/PhonePe/Paytm payment screenshot — transactions are
          auto-added and categorized, and you can edit or delete any of them below.
          <br />
          <span style={{ fontSize: 11, color: "var(--accent)", display: "inline-block", marginTop: 4 }}>
            💡 <strong>Password-protected PDFs supported:</strong> If your bank statement is encrypted,
            simply upload it and enter your PDF password when prompted!
          </span>
        </p>
        <FileUpload
          id="finance-upload"
          accept="image/*,application/pdf"
          file={file}
          onChange={setFile}
          placeholder="Drag & drop your bank statement or UPI screenshot here, or click to browse"
          helpText="Supports bank statement PDF or Google Pay / PhonePe / Paytm screenshot"
        />
        <div style={{ height: 12 }} />
        {uploadError && <div className="error-text" style={{ marginBottom: 10 }}>{uploadError}</div>}
        {uploadResult && (
          <div style={{ fontSize: 12, color: "var(--present)", marginBottom: 10 }}>
            {uploadResult.count > 0
              ? `Added ${uploadResult.count} new transaction(s).`
              : "No new transactions to add."}
            {uploadResult.skippedCount > 0 &&
              ` Skipped ${uploadResult.skippedCount} existing duplicate(s).`}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button className="btn" type="submit" disabled={uploadLoading} style={{ minWidth: 140 }}>
            {uploadLoading ? "Reading…" : "Upload"}
          </button>
        </div>
      </form>

      {/* PDF Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-content" {...dialogProps}>
            <div className="modal-header">
              <h3 className="modal-title" {...titleProps}>
                <Lock size={18} style={{ color: "var(--accent)" }} />
                <span>Password Protected PDF</span>
              </h3>
            </div>

            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px" }}>
              This PDF statement is encrypted. Please enter the password to open and extract transactions.
            </p>

            {pdfPasswordError && (
              <div className="error-text" style={{ marginBottom: 12 }}>
                {pdfPasswordError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                uploadStatement(null, pdfPassword);
              }}
            >
              <div className="form-group-layout">
                <label className="form-label-styled">PDF Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Enter PDF password"
                  value={pdfPassword}
                  onChange={(e) => setPdfPassword(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={cancelPasswordModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={uploadLoading}>
                  {uploadLoading ? "Decrypting…" : "Unlock & Extract"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
