import * as React from "react";
import { cn } from "../../lib/utils";

const AdminPageRoot = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("admin-page-section", className)} {...props}>
      {children}
    </div>
  )
);
AdminPageRoot.displayName = "AdminPage";

const AdminPageHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    eyebrow?: React.ReactNode;
    title: React.ReactNode;
    description?: React.ReactNode;
  }
>(({ className, eyebrow, title, description, children, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-start justify-between mb-6", className)} {...props}>
    <div>
      {eyebrow && (
        <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">
          {eyebrow}
        </div>
      )}
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && (
        <div className="text-sm text-on-surface-variant mt-1">{description}</div>
      )}
    </div>
    {children && <div className="flex items-center gap-2">{children}</div>}
  </div>
));
AdminPageHeader.displayName = "AdminPageHeader";

const AdminPageFilters = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-wrap items-center gap-3 py-3 mb-4 border-b border-outline-variant", className)}
      {...props}
    />
  )
);
AdminPageFilters.displayName = "AdminPageFilters";

const AdminPageContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("", className)} {...props} />
  )
);
AdminPageContent.displayName = "AdminPageContent";

export const AdminPage = Object.assign(AdminPageRoot, {
  Header: AdminPageHeader,
  Filters: AdminPageFilters,
  Content: AdminPageContent,
});

export { AdminPageHeader, AdminPageFilters, AdminPageContent };
