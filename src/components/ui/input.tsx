import * as React from "react";
import { cn } from "../../lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-shadow placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
