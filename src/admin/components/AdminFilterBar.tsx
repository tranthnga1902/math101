import * as React from "react";
import { cn } from "../../lib/utils";
import { Input } from "../../components/ui/input";
import { Search } from "lucide-react";

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (val: string) => void;
  debounceMs?: number;
}

export function SearchInput({
  value,
  onChange,
  debounceMs = 500,
  placeholder = "Tìm kiếm...",
  className,
  ...props
}: SearchInputProps) {
  const [localValue, setLocalValue] = React.useState(value);

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localValue);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [localValue, debounceMs, onChange]);

  return (
    <div className={cn("relative flex items-center", className)}>
      <Search className="absolute left-3 size-4 text-on-surface-variant" />
      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="pl-9 h-10 w-full"
        {...props}
      />
    </div>
  );
}

export interface FilterSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function FilterSelect({ label, className, children, ...props }: FilterSelectProps) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-sm text-on-surface-variant font-medium">{label}</span>}
      <select
        className={cn(
          "h-10 rounded-lg border border-outline-variant bg-white text-sm px-3 outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          className
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {children}
    </div>
  );
}
