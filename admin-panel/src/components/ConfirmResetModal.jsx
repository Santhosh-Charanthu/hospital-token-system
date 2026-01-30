"use client";
import "../styles/ConfirmResetModal.css";
export default function ConfirmResetModal({
  open,
  onCancel,
  onConfirm,
  loading,
}) {
  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="modal-title">Start Over?</h2>

        <p className="modal-text">
          This will reset all tokens and start again from the beginning.
          <br />
          This action cannot be undone.
        </p>

        <div className="modal-actions">
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={loading}
          >
            Yes, Start Over
          </button>
        </div>
      </div>
    </div>
  );
}
