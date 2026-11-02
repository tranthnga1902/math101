import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";

interface AdminModalProps {
  open: boolean;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';  // sm=430px, md=520px, lg=680px, xl=980px
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AdminModal({
  open,
  onClose,
  size = 'md',
  title,
  children,
  footer
}: AdminModalProps) {
  if (!open) return null;

  const sizeClasses = {
    sm: "max-w-[430px]",
    md: "max-w-[520px]",
    lg: "max-w-[680px]",
    xl: "max-w-[980px]",
  };

  return (
    <div className="fixed inset-0 z-[110] bg-[rgba(15,23,42,0.4)] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0" 
        onClick={onClose}
        aria-hidden="true"
      />
      <div 
        className={cn(
          "bg-white rounded-xl shadow-2xl flex flex-col max-h-[92vh] w-full relative z-10 admin-modal font-sans",
          sizeClasses[size]
        )}
      >
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between flex-none">
          <h2 className="text-lg font-semibold text-on-surface">
            {title}
          </h2>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="px-6 py-4 flex-1 overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-3 flex-none">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
