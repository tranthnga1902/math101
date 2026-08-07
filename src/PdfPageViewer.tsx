import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { API_BASE_URL } from "./api";
import { LruCache } from "./lib/lruCache";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// Giới hạn 24 trang đã render trong bộ nhớ — trang PDF full-size khá nặng
// (data URL PNG), không cap sẽ phình RAM khi lướt qua nhiều trang/tài liệu.
const pageCache = new LruCache<string, string>(24);

type Props = {
  fileUrl: string;
  accessToken?: string;
  pageNumber: number;
  fitWidth?: number;
  className?: string;
  onUseSignedUrl?: () => Promise<string>;
};

function resolveUrl(fileUrl: string): string {
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  if (!fileUrl) return fileUrl;
  if (fileUrl.startsWith("/")) return `${API_BASE_URL}${fileUrl}`;
  return `${API_BASE_URL}/${fileUrl}`;
}

export function PdfPageViewer({ fileUrl, accessToken, pageNumber, fitWidth = 760, className, onUseSignedUrl }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  useEffect(() => {
    if (!fileUrl && !onUseSignedUrl) return;
    const pageKey = `${fileUrl || ""}#p${pageNumber}@${fitWidth}#t${accessToken?.slice(-8) ?? "anon"}`;
    if (pageCache.has(pageKey)) {
      const url = pageCache.get(pageKey)!;
      setDataUrl(url);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    setDataUrl(null);
    setDims(null);

    (async () => {
      try {
        let targetUrl = resolveUrl(fileUrl || "");
        if (onUseSignedUrl) {
          try {
            targetUrl = await onUseSignedUrl();
          } catch {
            // fallback to original url
          }
        }
        const headers: Record<string, string> = {};
        if (accessToken && !/^https?:\/\//i.test(targetUrl)) {
          headers.Authorization = `Bearer ${accessToken}`;
        }
        const res = await fetch(targetUrl, { headers, credentials: "include" });
        if (!res.ok) {
          throw new Error(
            res.status === 0 || res.status === 403
              ? `Không truy cập được PDF (CORS hoặc không có quyền). Hãy dùng nút "Mở tab mới" hoặc cấu hình CORS cho storage.`
              : `Tải PDF thất bại (${res.status} ${res.statusText}).`
          );
        }
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        const loadingTask = pdfjsLib.getDocument({ data: buf, isEvalSupported: false });
        const pdf = await loadingTask.promise;
        pdfRef.current = pdf;

        if (pageNumber < 1 || pageNumber > pdf.numPages) {
          throw new Error(`Trang ${pageNumber} nằm ngoài phạm vi 1–${pdf.numPages}`);
        }

        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = fitWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const width = Math.ceil(viewport.width);
        const height = Math.ceil(viewport.height);
        if (cancelled) return;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Không tạo được canvas context");
        await page.render({ canvasContext: ctx, viewport }).promise;
        const url = canvas.toDataURL("image/png");
        pageCache.set(pageKey, url);
        if (!cancelled) {
          setDims({ w: width, h: height });
          setDataUrl(url);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Lỗi render PDF");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileUrl, accessToken, pageNumber, fitWidth, onUseSignedUrl]);

  if (error) {
    return (
      <div className={className} style={{ display: "grid", placeItems: "center", minHeight: 360, padding: 16, textAlign: "center", color: "#ba1a1a", fontSize: 13, gap: 8 }}>
        <strong>Không tải được PDF</strong>
        <span>{error}</span>
        <span style={{ color: "#52615a", fontSize: 12 }}>Bấm "Mở tab mới" để xem trong trình duyệt.</span>
      </div>
    );
  }

  return (
    <div className={className} style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 12, minHeight: 200 }}>
      {loading && <div style={{ minHeight: 360, display: "grid", placeItems: "center", color: "#52615a", fontSize: 13 }}>Đang tải trang {pageNumber}…</div>}
      {dataUrl && dims && (
        <img
          src={dataUrl}
          alt={`Trang ${pageNumber}`}
          width={dims.w}
          height={dims.h}
          style={{ background: "#fff", boxShadow: "0 6px 20px rgba(15,23,42,.12)", borderRadius: 4, display: "block", maxWidth: "100%", height: "auto" }}
        />
      )}
    </div>
  );
}