import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";

interface AdminDrawerProps {
  open: boolean;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg';  // sm=480px, md=560px, lg=640px
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AdminDrawer({
  open,
  onClose,
  size = 'md',
  eyebrow,
  title,
  subtitle,
  children,
  footer
}: AdminDrawerProps) {
  if (!open) return null;

  const sizeClasses = {
    sm: "w-[480px]",
    md: "w-[560px]",
    lg: "w-[640px]",
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-40 bg-[rgba(15,23,42,0.4)]" 
        onClick={onClose}
        aria-hidden="true"
      />
      <div 
        className={cn(
          "fixed top-0 right-0 bottom-0 z-50 bg-white shadow-2xl flex flex-col admin-drawer font-sans",
          sizeClasses[size]
        )}
      >
        <div className="px-6 py-4 border-b border-outline-variant flex-none relative">
          {eyebrow && (
            <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">
              {eyebrow}
            </div>
          )}
          <h2 className="text-lg font-semibold text-on-surface">
            {title}
          </h2>
          {subtitle && (
            <div className="text-sm text-on-surface-variant mt-1">
              {subtitle}
            </div>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-4 right-4" 
            onClick={onClose}
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 border-t border-outline-variant flex-none">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
