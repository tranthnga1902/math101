import { useEffect, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
// Vite sẽ bundle worker vào asset và trả URL khi build; dev thì ?url trỏ tới dev server.
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { API_BASE_URL } from "./api";
import { LruCache } from "./lib/lruCache";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// Giới hạn 60 ảnh bìa — nhẹ hơn trang PDF full-size nhưng vẫn cần cap để
// không phình RAM khi lướt qua danh sách nhiều tài liệu.
const cache = new LruCache<string, string>(60);

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

function resolveUrl(fileUrl: string): string {
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  if (!fileUrl) return fileUrl;
  if (fileUrl.startsWith("/")) return `${API_BASE_URL}${fileUrl}`;
  return `${API_BASE_URL}/${fileUrl}`;
}

export function PdfThumbnail({ fileUrl, accessToken, pageNumber = 1, className, renderScale = 0.4, thumbnailUrl, docType }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  // ĐỀ THI dùng kích thước nhỏ hơn (renderScale thấp hơn → ảnh bìa nhỏ hơn)
  const effectiveScale = docType === "DE_THI" ? Math.min(renderScale, 0.2) : renderScale;

  // Ưu tiên dùng thumbnailUrl đã render sẵn (CDN)
  useEffect(() => {
    if (thumbnailUrl) {
      setDataUrl(thumbnailUrl);
      setError("");
      return;
    }
  }, [thumbnailUrl]);

  // Chỉ fetch + render live khi không có thumbnailUrl
  useEffect(() => {
    if (!fileUrl || thumbnailUrl) return;
    const resolved = resolveUrl(fileUrl);
    const key = `${resolved}#p${pageNumber}#s${effectiveScale}`;
    if (cache.has(key)) {
      setDataUrl(cache.get(key)!);
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
        if (!cancelled) setDataUrl(url);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Lỗi render PDF");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileUrl, accessToken, pageNumber, effectiveScale, thumbnailUrl]);

  if (error) {
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
