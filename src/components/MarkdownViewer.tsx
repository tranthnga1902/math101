import { openDocumentFile, type AuthSession } from "../api";
import "./markdown-viewer.css";

/**
 * Hiển thị nội dung Markdown "tối giản" (do backend trích xuất từ PDF bằng PDFBox,
 * xem PdfMarkdownService.java) trực tiếp trong trang — không cần phần mềm đọc PDF thứ 3.
 *
 * Chỉ hỗ trợ đúng những gì heuristic backend sinh ra: đoạn văn cách nhau bởi dòng trống,
 * và đoạn bắt đầu bằng "## " là tiêu đề. Render bằng text con của React (không
 * dangerouslySetInnerHTML) nên tự động an toàn XSS, không cần thư viện sanitize.
 */
export function MarkdownContent({ markdown }: { markdown: string }) {
  return (
    <div className="md-content">
      {markdown.split(/\n\n+/).map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("## ")) {
          return <h3 key={index}>{trimmed.slice(3)}</h3>;
        }
        const lines = trimmed.split("\n");
        return (
          <p key={index}>
            {lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {line}
                {lineIndex < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function MarkdownViewer({
  session,
  title,
  markdown,
  fileUrl,
  onClose,
  onOpenPdf,
}: {
  session: AuthSession;
  title: string;
  markdown: string;
  fileUrl: string;
  onClose: () => void;
  /** Có truyền → "Xem file PDF gốc" mở trình xem trong app; không thì vẫn sang tab mới. */
  onOpenPdf?: () => void;
}) {
  return (
    <div className="md-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="md-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} className="md-close" aria-label="Đóng">×</button>
        </header>
        <div className="md-body"><MarkdownContent markdown={markdown} /></div>
        <footer>
          <button type="button" className="md-secondary" onClick={() => onOpenPdf ? onOpenPdf() : void openDocumentFile(session, fileUrl, title)}>
            Xem file PDF gốc
          </button>
          <button type="button" className="md-primary" onClick={onClose}>Đóng</button>
        </footer>
      </section>
    </div>
  );
}
