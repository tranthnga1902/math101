import { useEffect, useState, type ReactNode } from "react";
import { API_BASE_URL, fetchDocumentObjectUrl, launchDocumentPackage, openDocumentFileInNewTab } from "../api";
import { closeDocumentViewer, useOpenDocument, type OpenDocument } from "./documentViewerStore";
import { PdfViewer } from "./PdfViewer";
import { extractYoutubeId, youtubeEmbedUrl } from "./YoutubeVideoModal";
import "./pdf-viewer.css";

type Kind = "pdf" | "office" | "video" | "audio" | "image" | "package" | "youtube" | "external" | "other";

const OFFICE = ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "rtf"];
const VIDEO = ["mp4", "webm", "ogv", "mov", "m4v"];
const AUDIO = ["mp3", "wav", "ogg", "m4a", "aac"];
const IMAGE = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"];

const isAbsolute = (url: string) => /^https?:\/\//i.test(url);

function extensionOf(url: string) {
  const path = url.split(/[?#]/)[0];
  const match = /\.([a-z0-9]+)$/i.exec(path);
  return match ? match[1].toLowerCase() : "";
}

export function kindOf(fileUrl: string): Kind {
  if (extractYoutubeId(fileUrl)) return "youtube";
  const ext = extensionOf(fileUrl);
  if (ext === "pdf") return "pdf";
  if (VIDEO.includes(ext)) return "video";
  if (AUDIO.includes(ext)) return "audio";
  if (IMAGE.includes(ext)) return "image";
  if (isAbsolute(fileUrl)) return "external";
  if (OFFICE.includes(ext)) return "office";
  // Trang HTML chạy chung đường gói (token + CSP sandbox), không nhúng thẳng vào app
  if (ext === "zip" || ext === "html" || ext === "htm") return "package";
  return "other";
}

/** /api/documents/5/content.docx → /api/documents/5/preview.pdf (bản PDF server đổi sẵn). */
const previewPdfUrl = (fileUrl: string) =>
  `${API_BASE_URL}${fileUrl.replace(/\/content(\.[^/?#]*)?([?#].*)?$/, "/preview.pdf")}`;

/**
 * Trình xem tài liệu dùng chung cho toàn hệ thống, gắn một lần ở gốc app.
 * Mọi chỗ gọi openDocumentFile / openTextbookInBrowser đều mở vào đây thay vì tab mới:
 * PDF và Word/Excel/PowerPoint (server đổi sang PDF) dùng trình xem cuộn dọc;
 * video, âm thanh, ảnh phát tại chỗ; gói SCORM/xAPI chạy trong iframe sandbox.
 */
export function DocumentViewerHost() {
  const doc = useOpenDocument();
  if (!doc) return null;
  // key: đổi tài liệu thì dựng lại từ đầu, không giữ trạng thái của file trước.
  return <DocumentViewer key={`${doc.fileUrl}#${doc.startPage ?? ""}`} doc={doc} />;
}

function DocumentViewer({ doc }: { doc: OpenDocument }) {
  const { session, fileUrl, title, startPage } = doc;
  const kind = kindOf(fileUrl);

  if (kind === "pdf" || kind === "office") {
    return (
      <PdfViewer
        session={session}
        srcUrl={kind === "pdf" ? (isAbsolute(fileUrl) ? fileUrl : `${API_BASE_URL}${fileUrl}`) : previewPdfUrl(fileUrl)}
        title={title}
        fileUrl={fileUrl}
        initialPage={startPage}
        onClose={closeDocumentViewer}
      />
    );
  }
  if (kind === "youtube") {
    const embedUrl = youtubeEmbedUrl(fileUrl);
    return (
      <Frame doc={doc}>
        <iframe
          className="dv-frame"
          src={embedUrl ?? `https://www.youtube-nocookie.com/embed/${extractYoutubeId(fileUrl)}`}
          title={title}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </Frame>
    );
  }
  if (kind === "package") return <PackageViewer doc={doc} />;
  if (kind === "video" || kind === "audio" || kind === "image") return <MediaViewer doc={doc} kind={kind} />;
  return (
    <Frame doc={doc}>
      <div className="pv-state">
        <strong>Định dạng này chưa xem trực tiếp được</strong>
        {kind === "external" ? "Đây là liên kết ngoài." : "Bạn có thể mở hoặc tải file về máy."}
        <br />
        <button type="button" onClick={() => void openDocumentFileInNewTab(session, fileUrl, title, startPage)}>Mở tab mới</button>
      </div>
    </Frame>
  );
}

function MediaViewer({ doc, kind }: { doc: OpenDocument; kind: "video" | "audio" | "image" }) {
  const { session, fileUrl, title } = doc;
  const [src, setSrc] = useState<string | null>(isAbsolute(fileUrl) ? fileUrl : null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAbsolute(fileUrl)) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchDocumentObjectUrl(session, fileUrl)
      .then(url => { if (cancelled) URL.revokeObjectURL(url); else { objectUrl = url; setSrc(url); } })
      .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Không mở được tài liệu."); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [session, fileUrl]);

  return (
    <Frame doc={doc}>
      {error ? <p className="pv-state"><strong>Không mở được tài liệu</strong>{error}</p>
        : !src ? <p className="pv-state">Đang tải…</p>
        : kind === "video" ? <video className="dv-media" src={src} controls autoPlay playsInline />
        : kind === "audio" ? <audio className="dv-audio" src={src} controls autoPlay />
        : <img className="dv-media" src={src} alt={title} />}
    </Frame>
  );
}

function PackageViewer({ doc }: { doc: OpenDocument }) {
  const { session, fileUrl } = doc;
  const [launchUrl, setLaunchUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    launchDocumentPackage(session, fileUrl)
      .then(url => { if (!cancelled) setLaunchUrl(url); })
      .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Không mở được tài liệu."); });
    return () => { cancelled = true; };
  }, [session, fileUrl]);

  return (
    <Frame doc={doc} fill>
      {error ? <p className="pv-state"><strong>Không tải được nội dung</strong>{error}</p>
        : !launchUrl ? <p className="pv-state">Đang chuẩn bị nội dung…</p>
        : (
          // Không có allow-same-origin: script trong gói không đọc được phiên đăng nhập của app.
          <iframe
            className="dv-frame"
            src={launchUrl}
            title={doc.title}
            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-pointer-lock"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        )}
    </Frame>
  );
}

function Frame({ doc, fill, children }: { doc: OpenDocument; fill?: boolean; children: ReactNode }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeDocumentViewer(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="pv-overlay" onMouseDown={event => { if (event.target === event.currentTarget) closeDocumentViewer(); }}>
      <section className="pv-modal" role="dialog" aria-modal="true" aria-label={doc.title}>
        <header>
          <h2>{doc.title}</h2>
          <button type="button" className="pv-close" onClick={closeDocumentViewer} aria-label="Đóng">×</button>
        </header>
        <div className={fill ? "dv-body dv-fill" : "dv-body"}>{children}</div>
      </section>
    </div>
  );
}
