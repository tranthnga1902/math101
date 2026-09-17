import * as React from "react";
import { cn } from "../../lib/utils";

export function SkeletonRow({ className, columns = 5, ...props }: React.ComponentProps<"div"> & { columns?: number }) {
  const widths = ["75%", "60%", "85%", "65%", "70%", "80%", "68%", "90%"];
  return (
    <div className={cn("flex items-center gap-4 py-3 border-b border-outline-variant/50", className)} {...props}>
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="flex-1">
          <div className="h-4 rounded bg-slate-200 animate-pulse" style={{ width: widths[i % widths.length] }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({
  className,
  rows = 7,
  columns = 5,
  ...props
}: React.ComponentProps<"div"> & { rows?: number; columns?: number }) {
  return (
    <div className={cn("w-full", className)} {...props}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} columns={columns} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("h-48 rounded-xl bg-slate-100 animate-pulse", className)} {...props} />
  );
}
