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
    // Use Bootstrap modal classes for consistent styling; keep overlay click-to-close behavior
    <div className="modal-backdrop show" onClick={onCancel}>
      <div className="modal d-block" tabIndex={-1} role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog modal-dialog-centered" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title m-0">{title}</h5>
            </div>
            <div className="modal-body">
              {description ? <div className="text-muted">{description}</div> : null}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</button>
              <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>{loading ? '...' : confirmLabel}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
