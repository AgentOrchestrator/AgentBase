import React from 'react';
import './CheckoutConflictModal.css';

interface CheckoutConflictModalProps {
  isOpen: boolean;
  files: string[];
  onStashAndCheckout: () => void;
  onMigrateChanges: () => void;
  onForceCheckout: () => void;
  onCancel: () => void;
}

export function CheckoutConflictModal({
  isOpen,
  files,
  onStashAndCheckout,
  onMigrateChanges,
  onForceCheckout,
  onCancel,
}: CheckoutConflictModalProps) {
  if (!isOpen) return null;

  return (
    <div className="checkout-conflict-modal-overlay" onClick={(e) => {
      // Only close if clicking directly on overlay, not on modal content
      if (e.target === e.currentTarget) {
        onCancel();
      }
    }}>
      <div
        className="checkout-conflict-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="checkout-conflict-modal-content">
          <h2 className="checkout-conflict-modal-title">
            Your local changes would be overwritten by checkout.
          </h2>
          {files.length > 0 && (
            <div className="checkout-conflict-modal-files">
              <div className="checkout-conflict-modal-files-label">Affected files:</div>
              <ul className="checkout-conflict-modal-files-list">
                {files.map((file, index) => (
                  <li key={index}>{file}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="checkout-conflict-modal-actions">
          <button
            className="checkout-conflict-modal-button checkout-conflict-modal-button-primary"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              console.log('[CheckoutConflictModal] Stash & Checkout clicked');
              onStashAndCheckout();
            }}
          >
            Stash & Checkout
          </button>
          <button
            className="checkout-conflict-modal-button checkout-conflict-modal-button-secondary"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onMigrateChanges();
            }}
          >
            Migrate Changes
          </button>
          <button
            className="checkout-conflict-modal-button checkout-conflict-modal-button-secondary"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onForceCheckout();
            }}
          >
            Force Checkout
          </button>
          <button
            className="checkout-conflict-modal-button checkout-conflict-modal-button-secondary"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onCancel();
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
