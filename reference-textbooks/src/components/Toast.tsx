import React, { useEffect } from 'react';

interface ToastProps {
  message: string | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-[#131b2e] text-white px-4 py-3 rounded-lg shadow-xl border border-[#004ac6] flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-200 text-sm">
      <span className="material-symbols-outlined text-[#7cf994] text-[20px]">
        check_circle
      </span>
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 text-[#c3c6d7] hover:text-white">
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>
  );
};
