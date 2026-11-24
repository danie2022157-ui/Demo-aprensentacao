import React from 'react';
import { CheckCircle2, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  text: string;
  tone?: 'gold' | 'success';
}

interface ToastBannerProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export const ToastBanner: React.FC<ToastBannerProps> = ({ toast, onDismiss }) => {
  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-20 right-5 z-50 max-w-md bg-[#161922] border border-[#D4AF37]/35 rounded-xl px-4 py-3 shadow-2xl flex items-start gap-3"
    >
      {toast.tone === 'success' ? (
        <CheckCircle2 className="w-4 h-4 text-[#4ADE80] shrink-0 mt-0.5" />
      ) : (
        <Info className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
      )}
      <p className="text-xs text-neutral-200 leading-relaxed flex-1">
        {toast.text}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fechar aviso"
        className="text-neutral-500 hover:text-neutral-200 p-0.5 rounded"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
