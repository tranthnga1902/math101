import { useEffect, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
// Vite sẽ bundle worker vào asset và trả URL khi build; dev thì ?url trỏ tới dev server.
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { anhCache as cache, resolveApiUrl, useAuthedImage } from "./lib/authedImage";
import { youtubeThumbnailUrl } from "./components/YoutubeVideoModal";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type Props = {
  fileUrl: string;
  accessToken?: string;
  pageNumber?: number;
  className?: string;
  renderScale?: number;
  /** URL ảnh bìa đã render sẵn từ backend. Ưu tiên dùng thay vì fetch PDF live. */
  thumbnailUrl?: string | null;
  /** Loại docType — nếu là DE_THI thì dùng kích thước nhỏ hơn. */
  docType?: string;
};

export function PdfThumbnail({ fileUrl, accessToken, pageNumber = 1, className, renderScale = 0.4, thumbnailUrl, docType }: Props) {
  const [rendered, setRendered] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  // ĐỀ THI dùng kích thước nhỏ hơn (renderScale thấp hơn → ảnh bìa nhỏ hơn)
  const effectiveScale = docType === "DE_THI" ? Math.min(renderScale, 0.2) : renderScale;

  const ytThumb = youtubeThumbnailUrl(fileUrl);
  // Ưu tiên ảnh bìa backend đã render sẵn hoặc ảnh bìa YouTube nếu là link video
  const bia = useAuthedImage(thumbnailUrl || ytThumb, accessToken);
  const dataUrl = bia.src ?? ytThumb ?? rendered;

  // Render live từ PDF khi không có ảnh bìa sẵn và không phải YouTube — hoặc khi có mà tải hỏng.
  useEffect(() => {
    if (!fileUrl || ytThumb || docType === "VIDEO" || (thumbnailUrl && !bia.loi)) return;
    // fileUrl từ API luôn là đường dẫn tương đối tới endpoint có xác thực của backend —
    // đọc file qua đó thì không phụ thuộc cấu hình CORS của domain R2, và bucket để private được.
    const resolved = resolveApiUrl(fileUrl);
    const key = `${resolved}#p${pageNumber}#s${effectiveScale}`;
    if (cache.has(key)) {
      setRendered(cache.get(key)!);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const headers: Record<string, string> = {};
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
        const res = await fetch(resolved, { headers, credentials: "include" });
        if (!res.ok) throw new Error(`Tải PDF thất bại (${res.status})`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        const loadingTask = pdfjsLib.getDocument({ data: buf, isEvalSupported: false });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: effectiveScale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Không tạo được canvas context");
        await page.render({ canvasContext: ctx, viewport }).promise;
        const url = canvas.toDataURL("image/png");
        cache.set(key, url);
        if (!cancelled) setRendered(url);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Lỗi render PDF");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileUrl, accessToken, pageNumber, effectiveScale, thumbnailUrl, bia.loi]);

  if (error || (bia.loi && !fileUrl)) {
    return (
      <div className={`flex h-[132px] w-[96px] shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-center text-[10px] font-medium text-slate-400 ${className ?? ""}`}>
        Không tải được<br />bìa
      </div>
    );
  }
  if (!dataUrl) {
    return (
      <div className={`flex h-[132px] w-[96px] shrink-0 animate-pulse items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[10px] font-medium text-slate-400 ${className ?? ""}`}>
        Đang tải bìa…
      </div>
    );
  }
  return (
    <img
      src={dataUrl}
      alt="Bìa tài liệu"
      loading="lazy"
      className={`h-[132px] w-[96px] shrink-0 rounded-lg border border-slate-200 object-cover ${className ?? ""}`}
      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}
