'use client';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const btnBg =
    confirmVariant === 'danger'
      ? 'bg-[#E63946] hover:bg-[#D62839] text-white'
      : confirmVariant === 'warning'
      ? 'bg-[#FF6B35] hover:bg-[#E85D26] text-white'
      : 'bg-[#1E1B18] hover:bg-[#2C2724] text-[#FAF6EE]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1B18]/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="paper-card bg-[#FFFDF9] max-w-md w-full rounded-2xl p-6 relative shadow-sketch-lg space-y-4">
        <div className="tape-strip" />

        <div className="flex items-center gap-3 pt-1">
          <div className="w-10 h-10 rounded-xl bg-[#FFF3EE] border-2 border-[#1E1B18] flex items-center justify-center text-xl shadow-sketch-sm">
            {confirmVariant === 'danger' ? '⚠️' : '❓'}
          </div>
          <div>
            <h3 className="font-display text-xl font-bold text-[#1E1B18]">
              {title}
            </h3>
            <p className="text-xs font-mono text-[#766E65]">Irreversible action</p>
          </div>
        </div>

        <p className="text-sm text-[#4A443D] leading-relaxed bg-[#FAF6EE] p-3 rounded-xl border border-[#EBE4D5]">
          {message}
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="sketch-btn px-4 py-2 text-xs font-bold text-[#4A443D] bg-white border-2 border-[#1E1B18] rounded-xl hover:bg-[#FAF6EE]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`sketch-btn px-4 py-2 text-xs font-bold rounded-xl border-2 border-[#1E1B18] shadow-sketch-sm ${btnBg}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
