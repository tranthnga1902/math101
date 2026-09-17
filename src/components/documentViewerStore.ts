import { useSyncExternalStore } from "react";
import type { AuthSession } from "../api";

/** Tài liệu đang mở trong trình xem chung. Chỉ một tài liệu mở tại một thời điểm. */
export type OpenDocument = {
  session: AuthSession;
  /** fileUrl từ API: đường tương đối tới /content.{ext}, hoặc URL tuyệt đối (video ngoài). */
  fileUrl: string;
  title: string;
  startPage?: number | null;
};

let current: OpenDocument | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

export function openDocumentViewer(doc: OpenDocument) { current = doc; emit(); }
export function closeDocumentViewer() { current = null; emit(); }

export function useOpenDocument() {
  return useSyncExternalStore(
    listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => current,
  );
}
