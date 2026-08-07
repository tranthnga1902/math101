import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthSession, TextbookMappingProgress } from "../api";
import {
  appendTextbookMappingHistory,
  getTextbookMappingProgress,
  getTextbookMappingHistory,
  saveTextbookMappingProgress,
} from "../api";

export type MappingDraft = {
  pdfPage: number;
  pdfAnchor: number;
  bookAnchor: number;
  zoom: number;
  thumbPage: number;
};

export type HistoryEntry = {
  id: number;
  pdfPage: number;
  pdfAnchor: number;
  bookAnchor: number;
  action: "GOTO" | "PREV" | "NEXT";
  createdAt: string;
};

type Options = {
  documentId: number;
  session: AuthSession;
  /** Bỏ qua autosave lần đầu để không ghi đè lên server vô ích (mặc định true). */
  skipFirstSave?: boolean;
  /** Debounce cho autosave (ms). */
  debounceMs?: number;
};

/**
 * Hook quản lý tiến độ khớp trang:
 *  - loadProgress(): đọc state đã lưu từ server.
 *  - update(patch): cập nhật local + autosave debounce.
 *  - commitHistory(action): ghi 1 entry Lên/Xuống (khi bấm nút hoặc sau khi đổi trang đáng kể).
 *  - history + cursor: stack Lên/Xuống có thể tua lại tới client.
 */
export function useMappingAutoSave({ documentId, session, skipFirstSave = true, debounceMs = 800 }: Options) {
  const [draft, setDraft] = useState<MappingDraft | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [cursor, setCursor] = useState<number>(-1);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>("");
  const [historyError, setHistoryError] = useState<string>("");

  const firstSaveSkippedRef = useRef(false);
  const pendingRef = useRef<MappingDraft | null>(null);
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  const flush = useCallback(async () => {
    const payload = pendingRef.current;
    pendingRef.current = null;
    if (!payload) return;
    if (inFlightRef.current) {
      // có request đang chạy → ghi lại payload mới nhất để flush sau
      pendingRef.current = payload;
      return;
    }
    inFlightRef.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const result = await saveTextbookMappingProgress(session, documentId, payload);
      // upsert state trả về để đồng bộ updatedAt
      setDraft({
        pdfPage: result.pdfPage ?? payload.pdfPage,
        pdfAnchor: result.pdfAnchor ?? payload.pdfAnchor,
        bookAnchor: result.bookAnchor ?? payload.bookAnchor,
        zoom: result.zoom,
        thumbPage: result.thumbPage,
      });
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : "Lưu tiến độ thất bại";
      setSaveError(msg);
    } finally {
      inFlightRef.current = false;
      setSaving(false);
      // nếu trong lúc chờ có payload mới → flush tiếp
      if (pendingRef.current) {
        const next = pendingRef.current;
        pendingRef.current = null;
        pendingRef.current = next;
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(flush, debounceMs);
      }
    }
  }, [session, documentId, debounceMs]);

  const scheduleSave = useCallback((next: MappingDraft) => {
    pendingRef.current = next;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(flush, debounceMs);
  }, [flush, debounceMs]);

  const update = useCallback((patch: Partial<MappingDraft>) => {
    setDraft((prev) => {
      const base: MappingDraft = prev ?? {
        pdfPage: 1,
        pdfAnchor: 1,
        bookAnchor: 1,
        zoom: 100,
        thumbPage: 1,
      };
      const merged: MappingDraft = { ...base, ...patch };
      if (firstSaveSkippedRef.current) {
        scheduleSave(merged);
      } else {
        firstSaveSkippedRef.current = true;
      }
      return merged;
    });
  }, [scheduleSave]);

  const loadProgress = useCallback(async () => {
    setHydrated(false);
    setSaveError("");
    setHistoryError("");
    try {
      const [prog, hist] = await Promise.all([
        getTextbookMappingProgress(session, documentId),
        getTextbookMappingHistory(session, documentId).catch(() => null),
      ]);
      if (prog.exists && prog.pdfPage && prog.pdfAnchor && prog.bookAnchor) {
        setDraft({
          pdfPage: prog.pdfPage,
          pdfAnchor: prog.pdfAnchor,
          bookAnchor: prog.bookAnchor,
          zoom: prog.zoom,
          thumbPage: prog.thumbPage,
        });
        firstSaveSkippedRef.current = true; // đã có state từ server → không autosave ngay
      } else {
        setDraft(null);
        firstSaveSkippedRef.current = false;
      }
      if (hist) {
        setHistory(hist.entries);
        setCursor(hist.entries.length - 1);
      }
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : "Không tải được tiến độ";
      setSaveError(msg);
    } finally {
      setHydrated(true);
    }
  }, [session, documentId]);

  const commitHistory = useCallback(async (action: "GOTO" | "PREV" | "NEXT" = "GOTO") => {
    const current = pendingRef.current ?? draft;
    if (!current) return;
    setHistoryError("");
    try {
      const result = await appendTextbookMappingHistory(
        session,
        documentId,
        current.pdfPage,
        current.pdfAnchor,
        current.bookAnchor,
        action
      );
      setHistory(result.entries);
      setCursor(result.entries.length - 1);
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : "Ghi lịch sử thất bại";
      setHistoryError(msg);
    }
  }, [session, documentId, draft]);

  const goPrev = useCallback(() => {
    if (cursor <= 0) return null;
    const prev = history[cursor - 1];
    if (!prev) return null;
    setCursor(cursor - 1);
    setDraft({
      pdfPage: prev.pdfPage,
      pdfAnchor: prev.pdfAnchor,
      bookAnchor: prev.bookAnchor,
      zoom: draft?.zoom ?? 100,
      thumbPage: draft?.thumbPage ?? 1,
    });
    return prev;
  }, [cursor, history, draft]);

  const goNext = useCallback(() => {
    if (cursor < 0 || cursor >= history.length - 1) return null;
    const next = history[cursor + 1];
    if (!next) return null;
    setCursor(cursor + 1);
    setDraft({
      pdfPage: next.pdfPage,
      pdfAnchor: next.pdfAnchor,
      bookAnchor: next.bookAnchor,
      zoom: draft?.zoom ?? 100,
      thumbPage: draft?.thumbPage ?? 1,
    });
    return next;
  }, [cursor, history, draft]);

  const reset = useCallback(() => {
    setDraft(null);
    setHistory([]);
    setCursor(-1);
    firstSaveSkippedRef.current = false;
    pendingRef.current = null;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  return {
    draft,
    hydrated,
    saving,
    saveError,
    historyError,
    history,
    cursor,
    canPrev: cursor > 0,
    canNext: cursor >= 0 && cursor < history.length - 1,
    loadProgress,
    update,
    commitHistory,
    goPrev,
    goNext,
    reset,
  };
}
