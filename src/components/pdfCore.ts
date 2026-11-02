import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export type PdfLoadState =
  | { status: "loading"; pdf: null; error: "" }
  | { status: "ready"; pdf: PDFDocumentProxy; error: "" }
  | { status: "error"; pdf: null; error: string };

/**
 * Tải PDF đúng một lần cho mỗi url. Đổi trang/zoom chỉ gọi getPage trên tài liệu đã có,
 * không fetch lại — đó là lý do trình xem cũ (tải lại cả file mỗi lần lật trang) rất chậm.
 */
export function usePdfDocument(url: string | null, accessToken: string): PdfLoadState {
  const [state, setState] = useState<PdfLoadState>({ status: "loading", pdf: null, error: "" });

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    setState({ status: "loading", pdf: null, error: "" });
    (async () => {
      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { message?: string } | null;
          throw new Error(response.status === 403
            ? "Bạn không có quyền xem tài liệu này."
            : payload?.message || `Không tải được tài liệu (lỗi ${response.status}).`);
        }
        const data = await response.arrayBuffer();
        if (cancelled) return;
        loaded = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
        if (cancelled) { void loaded.destroy(); return; }
        setState({ status: "ready", pdf: loaded, error: "" });
      } catch (reason) {
        if (cancelled || (reason instanceof DOMException && reason.name === "AbortError")) return;
        setState({ status: "error", pdf: null, error: reason instanceof Error ? reason.message : "Không mở được tài liệu." });
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      void loaded?.destroy();
    };
  }, [url, accessToken]);

  return state;
}

/**
 * Vẽ một trang lên canvas. `scaleFor` nhận kích thước trang ở scale 1 và trả scale muốn vẽ,
 * để nơi dùng tự quyết "vừa trang", "vừa ngang" hay theo %.
 */
export function usePdfPageRender(
  pdf: PDFDocumentProxy | null,
  page: number,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  scaleFor: (base: { width: number; height: number }) => number,
  deps: unknown[],
  onError?: (message: string) => void,
) {
  const taskRef = useRef<RenderTask | null>(null);
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    (async () => {
      try {
        const target = await pdf.getPage(Math.min(Math.max(page, 1), pdf.numPages));
        if (cancelled) return;
        const base = target.getViewport({ scale: 1 });
        const scale = scaleFor({ width: base.width, height: base.height });
        if (!(scale > 0)) return;
        const viewport = target.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;
        // Huỷ lượt cũ trước khi đổi kích thước canvas: lượt cũ đang vẽ lên chính canvas này.
        taskRef.current?.cancel();
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.ceil(viewport.width * ratio);
        canvas.height = Math.ceil(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const task = target.render({
          canvasContext: context,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        taskRef.current = task;
        await task.promise;
      } catch (reason) {
        if (cancelled || (reason as { name?: string })?.name === "RenderingCancelledException") return;
        onError?.(reason instanceof Error ? reason.message : "Không vẽ được trang này.");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, page, ...deps]);

  useEffect(() => () => { taskRef.current?.cancel(); }, []);
}

type DragOptions = {
  /** Kéo ngang khi trang không tràn khung → lật trang (-1 trước, +1 sau). */
  onSwipe?: (direction: -1 | 1) => void;
  /** Ctrl/⌘ + lăn chuột → zoom (delta dương là phóng to). */
  onZoom?: (delta: number) => void;
};

/**
 * Kéo để di chuyển trong khung cuộn: nhấn giữ chuột (hoặc ngón tay) rồi kéo, khung cuộn theo.
 * Nhấn vào nút/ô nhập thì không bắt kéo, để các điều khiển đặt trong khung vẫn bấm được.
 */
export function useDragPan(ref: RefObject<HTMLElement | null>, { onSwipe, onZoom }: DragOptions = {}) {
  const swipeRef = useRef(onSwipe);
  const zoomRef = useRef(onZoom);
  swipeRef.current = onSwipe;
  zoomRef.current = onZoom;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let drag: { id: number; x: number; y: number; left: number; top: number; moved: boolean } | null = null;

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if ((event.target as HTMLElement).closest("button,input,select,textarea,a")) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: node.scrollLeft, top: node.scrollTop, moved: false };
      node.setPointerCapture(event.pointerId);
      node.classList.add("is-dragging");
    };
    const onMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      node.scrollLeft = drag.left - dx;
      node.scrollTop = drag.top - dy;
      event.preventDefault();
    };
    const onUp = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      const fitsHorizontally = node.scrollWidth <= node.clientWidth + 1;
      if (fitsHorizontally && Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) swipeRef.current?.(dx < 0 ? 1 : -1);
      if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
      node.classList.remove("is-dragging");
      drag = null;
    };
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !zoomRef.current) return;
      event.preventDefault();
      zoomRef.current(event.deltaY < 0 ? 1 : -1);
    };

    node.addEventListener("pointerdown", onDown);
    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerup", onUp);
    node.addEventListener("pointercancel", onUp);
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      node.removeEventListener("pointerdown", onDown);
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerup", onUp);
      node.removeEventListener("pointercancel", onUp);
      node.removeEventListener("wheel", onWheel);
    };
  }, [ref]);
}

/** Khổ trang 1 ở scale 1 — dùng làm khuôn giữ chỗ cho mọi trang khi xếp dọc (sách/đề thường cùng khổ). */
export function usePdfBaseSize(pdf: PDFDocumentProxy | null, onError?: (message: string) => void) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const errorRef = useRef(onError);
  errorRef.current = onError;
  useEffect(() => {
    setSize(null);
    if (!pdf) return;
    let cancelled = false;
    pdf.getPage(1).then(first => {
      if (cancelled) return;
      const v = first.getViewport({ scale: 1 });
      setSize({ width: v.width, height: v.height });
    }).catch(reason => {
      if (!cancelled) errorRef.current?.(reason instanceof Error ? reason.message : "Không đọc được trang 1.");
    });
    return () => { cancelled = true; };
  }, [pdf]);
  return size;
}

/**
 * Điều hướng cho dải trang cuộn dọc trong `viewportRef` (khung phải position:relative để offsetTop tính theo nó).
 * - `page`: trang chiếm dòng 1/3 phía trên khung, cập nhật khi cuộn.
 * - `goTo`: cuộn tới đầu một trang.
 * - Khi `scale` đổi, giữ nguyên chỗ đang đọc; lần đầu có scale thì cuộn tới `initialPage`.
 */
export function useScrollPages(viewportRef: RefObject<HTMLElement | null>, total: number, scale: number, initialPage = 1) {
  const start = Math.max(1, initialPage);
  const [page, setPage] = useState(start);
  const pageRefs = useRef<(HTMLElement | null)[]>([]);
  const position = useRef({ page: start, fraction: 0 });
  const totalRef = useRef(total);
  totalRef.current = total;

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    let frame = 0;
    const locate = () => {
      const els = pageRefs.current;
      const probe = node.scrollTop + node.clientHeight / 3;
      let lo = 0, hi = totalRef.current - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        const el = els[mid];
        if (el && el.offsetTop <= probe) lo = mid; else hi = mid - 1;
      }
      const el = els[lo];
      if (!el) return;
      position.current = { page: lo + 1, fraction: Math.max(0, Math.min(1, (node.scrollTop - el.offsetTop) / Math.max(1, el.offsetHeight))) };
      setPage(lo + 1);
    };
    const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(locate); };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); node.removeEventListener("scroll", onScroll); };
  }, [viewportRef]);

  // Chạy sau khi các trang đã nhận kích thước mới trong cùng lượt commit, nên offsetTop đã đúng.
  useLayoutEffect(() => {
    const node = viewportRef.current;
    const el = pageRefs.current[Math.min(position.current.page, total) - 1];
    if (!node || !el || !(scale > 0)) return;
    node.scrollTop = el.offsetTop + position.current.fraction * el.offsetHeight;
  }, [scale, total, viewportRef]);

  const goTo = useCallback((target: number) => {
    const n = Math.max(1, Math.min(totalRef.current, Math.round(target)));
    position.current = { page: n, fraction: 0 };
    setPage(n);
    const node = viewportRef.current;
    const el = pageRefs.current[n - 1];
    if (node && el) node.scrollTop = el.offsetTop - 12;
  }, [viewportRef]);

  const pageRef = useCallback((n: number) => (el: HTMLElement | null) => { pageRefs.current[n - 1] = el; }, []);
  const currentPage = useCallback(() => position.current.page, []);

  return { page, goTo, pageRef, currentPage };
}

/** Kích thước vùng nội dung (đã trừ padding) của một khung, có hãm tần suất khi kéo giãn cửa sổ. */
export function useContentSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let timer = 0;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setSize({ w: Math.floor(rect.width), h: Math.floor(rect.height) }), 80);
    });
    observer.observe(node);
    return () => { window.clearTimeout(timer); observer.disconnect(); };
  }, [ref]);
  return size;
}
