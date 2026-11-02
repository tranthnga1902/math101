import { useEffect, useRef, useState, type RefObject } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { usePdfPageRender } from "./pdfCore";

type Props = {
  pdf: PDFDocumentProxy | null;
  page: number;
  scale: number;
  base: { width: number; height: number };
  rootRef: RefObject<HTMLElement | null>;
  holderRef: (el: HTMLElement | null) => void;
  className: string;
  canvasClassName: string;
  onError?: (message: string) => void;
};

/**
 * Một trang trong dải cuộn dọc. Luôn giữ đúng chỗ theo khổ trang để thanh cuộn ổn định,
 * nhưng chỉ tạo canvas khi trang ở gần khung nhìn — và bỏ canvas khi đã cuộn xa,
 * nếu không tài liệu vài trăm trang sẽ ngốn hàng GB bộ nhớ.
 */
export function PdfScrollPage({ pdf, page, scale, base, rootRef, holderRef, className, canvasClassName, onError }: Props) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(entries => {
      const entry = entries[0];
      if (entry) setNear(entry.isIntersecting);
    }, { root: rootRef.current, rootMargin: "150% 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [rootRef]);
  usePdfPageRender(near ? pdf : null, page, canvasRef, () => scale, [scale, near], onError);
  return (
    <div
      className={className}
      data-page={page}
      ref={el => { nodeRef.current = el; holderRef(el); }}
      style={{ width: Math.floor(base.width * scale), minHeight: Math.floor(base.height * scale) }}
    >
      {near && <canvas className={canvasClassName} ref={canvasRef} />}
    </div>
  );
}
