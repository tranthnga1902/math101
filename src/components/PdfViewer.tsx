import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
// Cùng cách nạp worker như PdfThumbnail: Vite bundle worker thành asset và trả URL.
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { documentContentUrl, lessonDocumentContentUrl, openDocumentFile, type AuthSession } from "../api";
import "./pdf-viewer.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Chỉ PDF mới xem được trong app. Định dạng khác (docx…) và VIDEO vẫn đi đường cũ,
 * nên mọi nơi mở tài liệu đều hỏi hàm này trước.
 */
export const isPdfDocument = (row: { fileUrl?: string | null; docType?: string | null }) =>
  !!row.fileUrl && row.docType !== "VIDEO" && row.fileUrl.toLowerCase().endsWith(".pdf");

/** Chế độ hiển thị: vừa cả trang (mặc định), vừa chiều ngang, hoặc phóng theo %. */
type FitMode = "page" | "width" | "percent";

const PERCENTS = [50, 75, 100, 125, 150, 200];
const MIN_SCALE = 0.1;
const MAX_SCALE = 4;

type Props = {
  session: AuthSession;
  documentId: number;
  /** Có lessonId → đọc qua endpoint tài liệu bài học (quyền theo việc đang học bài đó). */
  lessonId?: number | null;
  title: string;
  /** Chỉ dùng cho nút "Mở tab mới" — không dùng để render. */
  fileUrl: string;
  initialPage?: number | null;
  onClose: () => void;
};

/**
 * Xem PDF ngay trong app, mặc định hiện đúng một trang lọt hết vào khung.
 *
 * Byte PDF đi qua backend (`/content`) thay vì gọi thẳng domain R2, để không phụ thuộc
 * cấu hình CORS của domain đó — cùng lý do như PdfThumbnail. File chỉ được tải một lần
 * cho mỗi lần mở; đổi trang chỉ gọi getPage nên không phải tải lại.
 */
export function PdfViewer({ session, documentId, lessonId, title, fileUrl, initialPage, onClose }: Props) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initialPage && initialPage > 0 ? initialPage : 1);
  const [pageText, setPageText] = useState(String(initialPage && initialPage > 0 ? initialPage : 1));
  const [fitMode, setFitMode] = useState<FitMode>("page");
  const [percent, setPercent] = useState(100);
  const [box, setBox] = useState({ width: 0, height: 0 });

  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const taskRef = useRef<RenderTask | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const contentUrl = useMemo(
    () => (lessonId ? lessonDocumentContentUrl(lessonId, documentId) : documentContentUrl(documentId)),
    [lessonId, documentId],
  );

  // Tải file một lần cho mỗi lần mở.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    setStatus("loading");
    setError("");
    (async () => {
      try {
        const response = await fetch(contentUrl, {
          headers: { Authorization: `Bearer ${session.accessToken}` },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(response.status === 403
            ? "Bạn không có quyền xem tài liệu này."
            : `Không tải được tài liệu (lỗi ${response.status}).`);
        }
        const data = await response.arrayBuffer();
        if (cancelled) return;
        loaded = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
        if (cancelled) {
          void loaded.destroy();
          return;
        }
        pdfRef.current = loaded;
        setTotal(loaded.numPages);
        setPage(current => Math.min(Math.max(current, 1), loaded!.numPages));
        setStatus("ready");
      } catch (reason) {
        if (cancelled || (reason instanceof DOMException && reason.name === "AbortError")) return;
        setError(reason instanceof Error ? reason.message : "Không mở được tài liệu.");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      taskRef.current?.cancel();
      taskRef.current = null;
      pdfRef.current = null;
      void loaded?.destroy();
    };
  }, [contentUrl, session.accessToken]);

  // Đo khung chứa để tính "vừa trang". contentRect đã trừ padding sẵn.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let timer = 0;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setBox({ width: rect.width, height: rect.height }), 120);
    });
    observer.observe(stage);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [status]);

  // Vẽ trang hiện tại. Mỗi lượt vẽ mới huỷ lượt cũ để đổi trang nhanh không sinh lỗi giả.
  useEffect(() => {
    if (status !== "ready" || !box.width || !box.height) return;
    const pdf = pdfRef.current;
    if (!pdf) return;
    let cancelled = false;
    (async () => {
      try {
        const target = await pdf.getPage(page);
        if (cancelled) return;
        const base = target.getViewport({ scale: 1 });
        const raw = fitMode === "page"
          ? Math.min(box.width / base.width, box.height / base.height)
          : fitMode === "width"
            ? box.width / base.width
            : percent / 100;
        const viewport = target.getViewport({ scale: Math.min(Math.max(raw, MIN_SCALE), MAX_SCALE) });
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;
        // Huỷ trước khi đổi kích thước canvas: lượt vẽ cũ đang dùng chính canvas này.
        taskRef.current?.cancel();
        // Nét trên màn hình retina: canvas to theo devicePixelRatio, CSS giữ kích thước thật.
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
        // Huỷ render là chuyện bình thường khi người dùng lật trang nhanh — bỏ qua.
        if (cancelled || (reason as { name?: string })?.name === "RenderingCancelledException") return;
        setError(reason instanceof Error ? reason.message : "Không vẽ được trang này.");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, page, box, fitMode, percent]);

  const goTo = useCallback((next: number) => {
    setPage(current => {
      const value = Math.min(Math.max(next, 1), total || current);
      setPageText(String(value));
      return value;
    });
  }, [total]);

  useEffect(() => {
    setPageText(String(page));
  }, [page]);

  // Bàn phím: bỏ qua khi con trỏ đang trong ô nhập số trang.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        if (event.key === "Escape") (event.target as HTMLElement).blur();
        return;
      }
      if (event.key === "Escape") { onClose(); return; }
      if (event.key === "ArrowRight" || event.key === "PageDown") { event.preventDefault(); goTo(page + 1); }
      else if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); goTo(page - 1); }
      else if (event.key === "Home") { event.preventDefault(); goTo(1); }
      else if (event.key === "End") { event.preventDefault(); goTo(total); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [page, total, goTo, onClose]);

  const openInNewTab = () => void openDocumentFile(session, fileUrl, title, page);

  const zoomBy = (delta: number) => {
    setPercent(current => Math.min(Math.max(current + delta, MIN_SCALE * 100), MAX_SCALE * 100));
    setFitMode("percent");
  };

  return (
    <div className="pv-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="pv-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button type="button" className="pv-close" onClick={onClose} aria-label="Đóng">×</button>
        </header>

        <div className="pv-toolbar">
          <div className="pv-group">
            <button type="button" onClick={() => goTo(page - 1)} disabled={status !== "ready" || page <= 1} aria-label="Trang trước">‹</button>
            <input
              className="pv-page-input"
              inputMode="numeric"
              value={pageText}
              aria-label="Số trang"
              onChange={event => setPageText(event.target.value)}
              onBlur={() => goTo(Number(pageText) || page)}
              onKeyDown={event => { if (event.key === "Enter") { goTo(Number(pageText) || page); event.currentTarget.blur(); } }}
            />
            <span className="pv-total">/ {total || "…"}</span>
            <button type="button" onClick={() => goTo(page + 1)} disabled={status !== "ready" || page >= total} aria-label="Trang sau">›</button>
          </div>

          <div className="pv-group">
            <button type="button" onClick={() => zoomBy(-25)} aria-label="Thu nhỏ">−</button>
            <select
              value={fitMode === "percent" ? String(percent) : fitMode}
              aria-label="Chế độ hiển thị"
              onChange={event => {
                const value = event.target.value;
                if (value === "page" || value === "width") { setFitMode(value); return; }
                setPercent(Number(value));
                setFitMode("percent");
              }}
            >
              <option value="page">Vừa trang</option>
              <option value="width">Vừa chiều ngang</option>
              {PERCENTS.map(value => <option key={value} value={String(value)}>{value}%</option>)}
              {fitMode === "percent" && !PERCENTS.includes(percent) && <option value={String(percent)}>{percent}%</option>}
            </select>
            <button type="button" onClick={() => zoomBy(25)} aria-label="Phóng to">+</button>
          </div>

          <span className="pv-spacer" />
          <button type="button" onClick={openInNewTab}>Mở tab mới</button>
        </div>

        <div className="pv-stage" ref={stageRef}>
          {status === "loading" && <p className="pv-state">Đang tải tài liệu…</p>}
          {status === "error" && (
            <div className="pv-state">
              <strong>Không xem được tài liệu trong app</strong>
              {error}
              <br />
              <button type="button" onClick={openInNewTab}>Mở tab mới</button>
            </div>
          )}
          {status === "ready" && <canvas className="pv-canvas" ref={canvasRef} />}
        </div>
      </section>
    </div>
  );
}
