import React from 'react';

type Props = {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({ open, title = 'Confirmar', description, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', loading = false, onConfirm, onCancel }: Props) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal confirm-modal card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          {description ? <div className="muted">{description}</div> : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 6, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={onCancel} disabled={loading}>{cancelLabel}</button>
            <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>{loading ? '...' : confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
