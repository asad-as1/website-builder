"use client";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  isBusy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ConfirmationModal({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  isBusy = false,
  onClose,
  onConfirm,
}: ConfirmationModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
      <button aria-label="Close confirmation" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="glass relative w-full max-w-md rounded-2xl border border-white/10 p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/10 text-2xl">!</div>
        <h2 id="confirmation-title" className="text-center text-xl font-semibold text-white">{title}</h2>
        <p className="mt-2 text-center text-sm text-gray-400">{description}</p>
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} disabled={isBusy} className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-gray-300 hover:bg-white/5 disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={isBusy} className="flex-1 rounded-lg bg-red-500/20 px-4 py-2.5 font-semibold text-red-300 hover:bg-red-500/30 disabled:opacity-50">{isBusy ? "Working..." : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
