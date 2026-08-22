import React from "react";
import { Sparkles, X } from "lucide-react";
import FileUpload from "../FileUpload.jsx";
import { PRESET_CLASSES } from "../../utils/timetableUtils.js";

export default function TimetableAiModal({
  showAiImport,
  setShowAiImport,
  selectedClass,
  uploadFile,
  setUploadFile,
  uploading,
  uploadError,
  uploadSuccess,
  handleAiFormSubmit,
}) {
  if (!showAiImport) return null;

  return (
    <div className="card" style={{ marginBottom: 20, padding: 20 }}>
      <div className="flex-between" style={{ marginBottom: 14 }}>
        <div className="flex-gap-sm">
          <Sparkles size={18} style={{ color: "var(--accent)" }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            AI Timetable Auto-Extractor
          </h3>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setShowAiImport(false)}
          aria-label="Close AI import"
        >
          <X size={16} />
        </button>
      </div>

      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px" }}>
        Upload a picture or PDF of your class schedule, or paste an image from clipboard (Ctrl+V).
        AI will automatically extract subjects, timings, and rooms for{" "}
        <strong>{selectedClass !== "All" ? selectedClass : "BCA 2A"}</strong>.
      </p>

      {uploadError && (
        <div className="load-error" role="alert" style={{ marginBottom: 14 }}>
          <span>{uploadError}</span>
        </div>
      )}

      {uploadSuccess && (
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(79, 168, 138, 0.14)",
            border: "1px solid var(--present)",
            borderRadius: "var(--radius-sm)",
            color: "var(--present)",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 14,
          }}
        >
          {uploadSuccess}
        </div>
      )}

      <form onSubmit={handleAiFormSubmit}>
        <FileUpload
          accept="image/*,.pdf"
          value={uploadFile}
          onChange={setUploadFile}
          label="Drop your routine photo/PDF here or click to browse"
        />

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={uploading || !uploadFile}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            {uploading ? (
              <>
                <span className="chat-loading-dot" /> Extracting schedule with AI...
              </>
            ) : (
              <>
                <Sparkles size={15} /> Extract &amp; Add Slots
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
