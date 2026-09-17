import * as React from "react";
import { PackageOpen, LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export interface AdminEmptyStateProps extends React.ComponentProps<"div"> {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export const AdminEmptyState = React.forwardRef<HTMLDivElement, AdminEmptyStateProps>(
  ({ className, icon: Icon = PackageOpen, title = "Không có dữ liệu", description, action, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col items-center justify-center py-16 text-center text-on-surface-variant", className)}
        {...props}
      >
        <Icon className="w-12 h-12 mb-4 opacity-40" />
        <h3 className="text-lg font-medium mb-1">{title}</h3>
        {description && <p className="text-sm mb-4">{description}</p>}
        {action && <div>{action}</div>}
      </div>
    );
  }
);
AdminEmptyState.displayName = "AdminEmptyState";
