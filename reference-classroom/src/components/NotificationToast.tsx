import React from 'react';

interface NotificationToastProps {
  message: string | null;
  type?: 'success' | 'info' | 'error';
  onClose: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  message,
  type = 'success',
  onClose
}) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#131b2e] text-white px-4 py-3 rounded-xl shadow-2xl border border-[#c3c6d7]/30 animate-in slide-in-from-bottom-4 duration-200">
      <span
        className={`material-symbols-outlined text-[20px] ${
          type === 'success'
            ? 'text-[#7cf994]'
            : type === 'error'
            ? 'text-[#ffdad6]'
            : 'text-[#b4c5ff]'
        }`}
      >
        {type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}
      </span>
      <p className="text-xs font-medium">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="ml-2 text-white/60 hover:text-white cursor-pointer"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>
  );
};
