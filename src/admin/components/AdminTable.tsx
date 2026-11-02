import * as React from "react";
import { cn } from "../../lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../components/ui/button";
import { SkeletonTable } from "./AdminSkeleton";
import { AdminEmptyState } from "./AdminEmptyState";

export interface AdminTableProps<T> {
  columns: {
    key: string;
    label: string;
    className?: string;
    sticky?: boolean;
    render?: (row: T, index: number) => React.ReactNode;
  }[];
  data: T[];
  loading?: boolean;
  skeletonRows?: number;
  keyExtractor: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  selectedId?: string | number | null;
  emptyMessage?: string;
  footer?: React.ReactNode;
  className?: string;
}

export function AdminTable<T>({
  columns,
  data,
  loading,
  skeletonRows = 5,
  keyExtractor,
  onRowClick,
  selectedId,
  emptyMessage = "Không có dữ liệu",
  footer,
  className
}: AdminTableProps<T>) {
  if (loading) {
    return <SkeletonTable rows={skeletonRows} />;
  }

  return (
    <div className={cn("overflow-x-auto border border-outline-variant rounded-xl", className)}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 text-xs font-bold uppercase tracking-wider text-on-surface-variant border-b border-outline-variant">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3 text-left",
                  col.sticky && "sticky right-0 bg-slate-50 shadow-[inset_1px_0_0_var(--color-outline-variant)]",
                  col.className
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!data.length ? (
            <tr>
              <td colSpan={columns.length} className="p-0">
                <AdminEmptyState title={emptyMessage} />
              </td>
            </tr>
          ) : (
            data.map((row, index) => {
              const id = keyExtractor(row);
              const isSelected = selectedId === id;
              return (
                <tr
                  key={id}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "border-b border-outline-variant last:border-0 transition-colors",
                    "even:bg-slate-50/50 hover:bg-primary-container/30",
                    onRowClick && "cursor-pointer",
                    isSelected && "bg-primary-container/50"
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3",
                        col.sticky && "sticky right-0 shadow-[inset_1px_0_0_var(--color-outline-variant)]",
                        col.sticky && (isSelected ? "bg-[var(--color-primary-container)] bg-opacity-50" : index % 2 === 1 ? "bg-slate-50/50" : "bg-white"),
                        col.className
                      )}
                    >
                      {col.render ? col.render(row, index) : (row as any)[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {footer && <div className="p-4 border-t border-outline-variant bg-slate-50 rounded-b-xl">{footer}</div>}
    </div>
  );
}

export interface AdminPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
}

export function AdminPagination({ page, totalPages, onPageChange, totalItems }: AdminPaginationProps) {
  return (
    <div className="flex items-center justify-between px-2 py-4">
      {totalItems !== undefined ? (
        <span className="text-sm text-on-surface-variant">Tổng cộng: {totalItems}</span>
      ) : <div />}
      <div className="flex items-center gap-4">
        <span className="text-sm text-on-surface-variant">
          Trang {page} / {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
