'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface RejectReasonModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading?: boolean;
}

export function RejectReasonModal({ open, onClose, onConfirm, loading = false }: RejectReasonModalProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (!reason.trim()) {
      return;
    }
    onConfirm(reason);
    setReason('');
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject Rule</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Please provide a reason for rejecting this rule. This will help improve future rule extractions.
          </p>
          <Textarea
            placeholder="Why are you rejecting this rule?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            disabled={loading}
            className="resize-none"
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!reason.trim() || loading}>
            {loading ? 'Rejecting...' : 'Reject Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
