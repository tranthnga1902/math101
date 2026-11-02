import { useEffect, useMemo, useRef, useState } from "react";
import { documentContentUrl, lessonDocumentContentUrl, openDocumentFileInNewTab, type AuthSession } from "../api";
import { useContentSize, useDragPan, usePdfBaseSize, usePdfDocument, useScrollPages } from "./pdfCore";
import { PdfScrollPage } from "./PdfScrollPage";
import "./pdf-viewer.css";

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
  /** Bỏ trống khi đã có srcUrl. */
  documentId?: number | null;
  /** Có lessonId → đọc qua endpoint tài liệu bài học (quyền theo việc đang học bài đó). */
  lessonId?: number | null;
  /** URL byte PDF có sẵn (vd. bản xem trước Word/PowerPoint); ưu tiên hơn documentId. */
  srcUrl?: string | null;
  title: string;
  /** Chỉ dùng cho nút "Mở tab mới" — không dùng để render. */
  fileUrl: string;
  initialPage?: number | null;
  onClose: () => void;
};

/**
 * Xem PDF ngay trong app: các trang xếp dọc liên tục, lăn chuột để lướt trang.
 *
 * Byte PDF đi qua backend (`/content`) thay vì gọi thẳng domain R2, để không phụ thuộc
 * cấu hình CORS của domain đó — cùng lý do như PdfThumbnail. File chỉ được tải một lần
 * cho mỗi lần mở; chỉ các trang gần khung nhìn mới được vẽ.
 */
export function PdfViewer({ session, documentId, lessonId, srcUrl, title, fileUrl, initialPage, onClose }: Props) {
  const contentUrl = useMemo(
    () => srcUrl
      ?? (documentId == null ? null : lessonId ? lessonDocumentContentUrl(lessonId, documentId) : documentContentUrl(documentId)),
    [srcUrl, lessonId, documentId],
  );
  const pdfState = usePdfDocument(contentUrl, session.accessToken);
  const pdf = pdfState.pdf;
  const total = pdf?.numPages ?? 0;
  const [renderError, setRenderError] = useState("");
  const [fitMode, setFitMode] = useState<FitMode>("page");
  const [percent, setPercent] = useState(100);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const box = useContentSize(stageRef);
  const base = usePdfBaseSize(pdf, setRenderError);

  // Một scale chung cho mọi trang. "Vừa trang" = mỗi trang lọt hết chiều cao khung.
  const scale = useMemo(() => {
    if (!base) return 0;
    let raw: number;
    if (fitMode === "percent") raw = percent / 100;
    else {
      if (!box.w || !box.h) return 0;
      raw = fitMode === "page"
        ? Math.min((box.w - 4) / base.width, (box.h - 4) / base.height)
        : (box.w - 4) / base.width;
    }
    return Math.min(Math.max(raw, MIN_SCALE), MAX_SCALE);
  }, [base, fitMode, percent, box.w, box.h]);

  const { page, goTo, pageRef, currentPage } = useScrollPages(stageRef, total, scale, initialPage ?? 1);
  const [pageText, setPageText] = useState(String(page));
  useEffect(() => { setPageText(String(page)); }, [page]);

  // Bàn phím: mũi tên lên/xuống để trình duyệt tự cuộn; các phím dưới nhảy theo từng trang.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        if (event.key === "Escape") (event.target as HTMLElement).blur();
        return;
      }
      if (event.key === "Escape") { onClose(); return; }
      if (event.key === "ArrowRight" || event.key === "PageDown") { event.preventDefault(); goTo(currentPage() + 1); }
      else if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); goTo(currentPage() - 1); }
      else if (event.key === "Home") { event.preventDefault(); goTo(1); }
      else if (event.key === "End") { event.preventDefault(); goTo(total); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [total, goTo, currentPage, onClose]);

  const openInNewTab = () => void openDocumentFileInNewTab(session, fileUrl, title, page);

  // Phóng từ chế độ "vừa trang/ngang" thì bắt đầu từ mức đang thấy, không nhảy về 100%.
  const zoomBy = (delta: number) => {
    setPercent(current => {
      const from = fitMode === "percent" ? current : Math.round(scale * 100);
      return Math.min(Math.max(from + delta, MIN_SCALE * 100), MAX_SCALE * 100);
    });
    setFitMode("percent");
  };

  useDragPan(stageRef, { onZoom: delta => zoomBy(delta * 25) });

  const commitPageText = () => {
    const n = Number(pageText);
    if (Number.isFinite(n) && n >= 1) goTo(n); else setPageText(String(page));
  };
  const error = pdfState.error || renderError;
  const ready = pdfState.status === "ready" && !renderError && base && scale > 0;

  return (
    <div className="pv-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="pv-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button type="button" className="pv-close" onClick={onClose} aria-label="Đóng">×</button>
        </header>

        <div className="pv-toolbar">
          <div className="pv-group">
            <button type="button" onClick={() => goTo(page - 1)} disabled={!ready || page <= 1} aria-label="Trang trước">‹</button>
            <input
              className="pv-page-input"
              inputMode="numeric"
              value={pageText}
              aria-label="Số trang"
              onChange={event => setPageText(event.target.value)}
              onBlur={commitPageText}
              onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }}
            />
            <span className="pv-total">/ {total || "…"}</span>
            <button type="button" onClick={() => goTo(page + 1)} disabled={!ready || page >= total} aria-label="Trang sau">›</button>
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
          <span className="pv-hint">Lăn chuột để lướt trang · Kéo để di chuyển · Ctrl + lăn để zoom</span>
        </div>

        <div className="pv-stage pv-pan" ref={stageRef}>
          {pdfState.status === "loading" && <p className="pv-state">Đang tải tài liệu…</p>}
          {error && (
            <div className="pv-state">
              <strong>Không xem được tài liệu trong app</strong>
              {error}
              <br />
              <button type="button" onClick={openInNewTab}>Mở tab mới</button>
            </div>
          )}
          {ready && (
            <div className="pv-pages">
              {Array.from({ length: total }, (_, i) => i + 1).map(n => (
                <PdfScrollPage
                  key={n}
                  pdf={pdf}
                  page={n}
                  scale={scale}
                  base={base}
                  rootRef={stageRef}
                  holderRef={pageRef(n)}
                  className="pv-page"
                  canvasClassName="pv-canvas"
                  onError={setRenderError}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
