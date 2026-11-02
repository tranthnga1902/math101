import { useEffect, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { anhCache as cache, resolveApiUrl, useAuthedImage } from "../lib/authedImage";
import { youtubeThumbnailUrl } from "./YoutubeVideoModal";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export type DocumentPreviewProps = {
  fileUrl?: string | null;
  thumbnailUrl?: string | null;
  title?: string;
  docType?: string | null;
  pageNumber?: number;
  renderScale?: number;
  accessToken?: string;
  className?: string;
  variant?: "cover" | "thumbnail" | "compact" | "banner";
  alt?: string;
  onClick?: () => void;
};

const docTypeInfo: Record<string, { label: string; tone: string; bar: string }> = {
  SGK: { label: "SGK", tone: "bg-emerald-500/15 text-emerald-700 border-emerald-300", bar: "bg-emerald-600" },
  SBT: { label: "SBT", tone: "bg-teal-500/15 text-teal-700 border-teal-300", bar: "bg-teal-600" },
  DE_THI: { label: "ĐỀ THI", tone: "bg-rose-500/15 text-rose-700 border-rose-300", bar: "bg-rose-600" },
  CHUYEN_DE: { label: "CHUYÊN ĐỀ", tone: "bg-indigo-500/15 text-indigo-700 border-indigo-300", bar: "bg-indigo-600" },
  SPECIAL_TOPIC: { label: "CHUYÊN ĐỀ", tone: "bg-indigo-500/15 text-indigo-700 border-indigo-300", bar: "bg-indigo-600" },
  EXERCISE: { label: "BÀI TẬP", tone: "bg-amber-500/15 text-amber-800 border-amber-300", bar: "bg-amber-600" },
  VIDEO: { label: "VIDEO", tone: "bg-red-500/15 text-red-700 border-red-300", bar: "bg-red-600" },
  DOCUMENT: { label: "TÀI LIỆU", tone: "bg-primary-container text-on-primary-container border-primary/30", bar: "bg-primary" },
  HTML: { label: "HTML", tone: "bg-amber-500/15 text-amber-800 border-amber-300", bar: "bg-amber-600" },
  HTML_DOCUMENT: { label: "HTML", tone: "bg-amber-500/15 text-amber-800 border-amber-300", bar: "bg-amber-600" },
  HTML_LESSON_CONTENT: { label: "BÀI HỌC HTML", tone: "bg-violet-500/15 text-violet-800 border-violet-300", bar: "bg-violet-600" },
};

function getBadge(type?: string | null) {
  if (!type) return { label: "TÀI LIỆU", tone: "bg-primary-container text-on-primary-container border-primary/30", bar: "bg-primary" };
  const key = type.toUpperCase();
  return docTypeInfo[key] ?? { label: type, tone: "bg-primary-container text-on-primary-container border-primary/30", bar: "bg-primary" };
}

function isPdf(fileUrl?: string | null, docType?: string | null): boolean {
  if (!fileUrl || docType === "VIDEO") return false;
  const clean = fileUrl.split("?")[0].toLowerCase();
  return clean.endsWith(".pdf") || clean.includes("/content.pdf");
}

/**
 * Bản xem trước trang giấy mô phỏng (Realistic Document Sheet Mockup)
 * Đảm bảo KHÔNG BAO GIỜ chỉ hiển thị một icon đơn độc giữa ô trống.
 */
function DocumentSheetMockup({
  title,
  docType,
  variant = "thumbnail",
  loading = false,
}: {
  title?: string;
  docType?: string | null;
  variant?: "cover" | "thumbnail" | "compact" | "banner";
  loading?: boolean;
}) {
  const badge = getBadge(docType);
  const isCompact = variant === "compact";
  const isCover = variant === "cover" || variant === "banner";

  return (
    <div
      className={`relative w-full h-full flex flex-col justify-between overflow-hidden rounded-lg border border-slate-200/90 bg-gradient-to-b from-white via-slate-50 to-slate-100 p-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] select-none transition-transform ${
        loading ? "animate-pulse" : ""
      }`}
    >
      {/* Vát góc trang giấy ở góc trên bên phải */}
      <div className="absolute top-0 right-0 w-3.5 h-3.5 border-b border-l border-slate-300/80 bg-slate-200/60 rounded-bl" />

      {/* Dải header màu theo loại tài liệu */}
      <div className="flex items-center justify-between gap-1 pr-3">
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase border ${badge.tone}`}
        >
          {badge.label}
        </span>
        {loading ? (
          <span className="text-[9px] text-slate-400 font-medium animate-pulse">Đang nạp…</span>
        ) : (
          <span className="text-[9px] text-slate-400 font-medium">Bản đọc</span>
        )}
      </div>

      {/* Nội dung trang mô phỏng: Tiêu đề và các dòng chữ */}
      <div className="my-auto py-1 space-y-1.5">
        {title ? (
          <p
            className={`font-semibold text-slate-800 line-clamp-2 leading-tight ${
              isCompact ? "text-[10px]" : isCover ? "text-xs font-bold" : "text-[11px]"
            }`}
            title={title}
          >
            {title}
          </p>
        ) : (
          <div className="h-2.5 w-3/4 bg-slate-300 rounded" />
        )}

        {/* Các dòng text mô phỏng nội dung tài liệu */}
        <div className="space-y-1 pt-0.5 opacity-60">
          <div className="h-1.5 w-full bg-slate-300/80 rounded" />
          <div className="h-1.5 w-5/6 bg-slate-300/70 rounded" />
          {!isCompact && (
            <>
              <div className="h-1.5 w-4/6 bg-slate-300/60 rounded" />
              {isCover && <div className="h-1.5 w-3/4 bg-slate-300/50 rounded" />}
            </>
          )}
        </div>
      </div>

      {/* Chân trang mô phỏng footer sách/tài liệu */}
      <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between text-[8px] text-slate-400">
        <span>MATH10 Document</span>
        <span>Trang 1</span>
      </div>
    </div>
  );
}

/**
 * Hiển thị bản xem trước tài liệu:
 * 1. Nếu là Video / YouTube -> Hiển thị thumbnail kèm nút Play.
 * 2. Nếu có `thumbnailUrl` từ server -> Tải qua token xác thực và hiển thị ảnh bìa.
 * 3. Nếu là file PDF -> Dùng `pdfjsLib` render trang đầu tiên trực tiếp lên canvas.
 * 4. Nếu đang tải hoặc fallback -> Hiển thị sheet mockup mô phỏng trang tài liệu (không chỉ icon).
 */
export function DocumentPreview({
  fileUrl,
  thumbnailUrl,
  title,
  docType,
  pageNumber = 1,
  renderScale = 0.45,
  accessToken,
  className = "",
  variant = "thumbnail",
  alt,
  onClick,
}: DocumentPreviewProps) {
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  const [pdfFailed, setPdfFailed] = useState<boolean>(false);

  const ytThumb = youtubeThumbnailUrl(fileUrl || "");
  const isVideo = docType === "VIDEO" || !!ytThumb;
  const isPdfDoc = isPdf(fileUrl, docType);

  // Ảnh bìa đã có sẵn trên R2 hoặc thumbnail YouTube
  const authedCover = useAuthedImage(thumbnailUrl || ytThumb, accessToken);
  const coverSrc = authedCover.src ?? ytThumb ?? renderedUrl;

  // Render PDF live nếu không có thumbnail sẵn và có URL PDF
  useEffect(() => {
    if (!fileUrl || ytThumb || isVideo || (thumbnailUrl && !authedCover.loi) || !isPdfDoc) {
      return;
    }

    const resolved = resolveApiUrl(fileUrl);
    const key = `${resolved}#p${pageNumber}#s${renderScale}`;
    if (cache.has(key)) {
      setRenderedUrl(cache.get(key)!);
      return;
    }

    let cancelled = false;
    setPdfLoading(true);
    setPdfFailed(false);

    (async () => {
      try {
        const headers: Record<string, string> = {};
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
        const res = await fetch(resolved, { headers, credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;

        const task = pdfjsLib.getDocument({ data: buf, isEvalSupported: false });
        const pdf = await task.promise;
        const page = await pdf.getPage(Math.max(1, Math.min(pageNumber, pdf.numPages)));
        const viewport = page.getViewport({ scale: renderScale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Context failed");
        await page.render({ canvasContext: ctx, viewport }).promise;

        const dataUrl = canvas.toDataURL("image/png");
        cache.set(key, dataUrl);
        if (!cancelled) {
          setRenderedUrl(dataUrl);
          setPdfLoading(false);
        }
      } catch {
        if (!cancelled) {
          setPdfFailed(true);
          setPdfLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileUrl, ytThumb, isVideo, thumbnailUrl, authedCover.loi, isPdfDoc, pageNumber, renderScale, accessToken]);

  // Variant kích cỡ mặc định nếu className không truyền cứng
  const variantClass =
    variant === "cover"
      ? "w-full aspect-[16/10]"
      : variant === "banner"
      ? "w-full aspect-video"
      : variant === "compact"
      ? "w-14 h-18"
      : "w-24 h-32";

  const containerClasses = `relative shrink-0 overflow-hidden rounded-lg bg-surface-container-low select-none ${variantClass} ${className}`.trim();

  // 1. Trường hợp có ảnh bìa (hoặc PDF render xong)
  if (coverSrc) {
    return (
      <div
        className={`${containerClasses} ${onClick ? "cursor-pointer group" : ""}`}
        onClick={onClick}
      >
        <img
          src={coverSrc}
          alt={alt || title || "Bản xem trước tài liệu"}
          loading="lazy"
          className="w-full h-full object-cover rounded-lg border border-outline-variant/60 transition-transform duration-200 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLElement).style.display = "none";
          }}
        />

        {/* Huy hiệu loại tài liệu nổi trên ảnh bìa */}
        {docType && (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-black/65 text-white backdrop-blur-sm shadow-sm">
            {getBadge(docType).label}
          </span>
        )}

        {/* Nút Play cho Video */}
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/35">
            <span className="material-symbols-outlined text-white text-[32px] drop-shadow-md transition-transform group-hover:scale-110">
              play_circle
            </span>
          </div>
        )}
      </div>
    );
  }

  // 2. Trường hợp đang tải PDF hoặc bìa
  if (pdfLoading) {
    return (
      <div className={containerClasses}>
        <DocumentSheetMockup title={title} docType={docType} variant={variant} loading={true} />
      </div>
    );
  }

  // 3. Fallback: Bản xem trước mô phỏng dạng trang tài liệu chuẩn (KHÔNG HIỂN THỊ CHỈ ICON)
  return (
    <div
      className={`${containerClasses} ${onClick ? "cursor-pointer group hover:border-primary/50" : ""}`}
      onClick={onClick}
    >
      <DocumentSheetMockup title={title} docType={docType} variant={variant} loading={false} />
    </div>
  );
}
