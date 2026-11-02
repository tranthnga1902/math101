import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { getLessonDocuments, openDocumentFile, type AuthSession, type LessonDocument } from "../api";
import { PdfViewer, isPdfDocument } from "./PdfViewer";
import { DocumentPreview } from "./DocumentPreview";
import { SkeletonTable } from "../admin/components/AdminSkeleton";
import "./lesson-attachments.css";

export function AttachmentCard({ row, actions, accessToken }: { row: LessonDocument; actions: ReactNode; accessToken?: string }) {
  return <article className="attachment-card">
    <DocumentPreview
      fileUrl={row.fileUrl}
      thumbnailUrl={row.thumbnailUrl}
      title={row.title}
      docType={row.docType}
      pageNumber={row.startPage || 1}
      accessToken={accessToken}
      variant="compact"
      className="w-14 h-18 shrink-0 shadow-xs"
    />
    <div className="attachment-copy">
      <h3 title={row.title}>{row.title}</h3>
      <div className="attachment-meta">
        <span>{row.docType === "VIDEO" ? "Video" : row.docType === "HTML_LESSON_CONTENT" ? "Bài học HTML" : row.docType === "HTML" ? "Tài liệu HTML" : "Tài liệu"}</span>
        <span>{row.audience === "STUDENT_ALLOWED" ? "Học sinh và giáo viên" : "Chỉ giáo viên"}</span>
        <span>{row.required ? "Bắt buộc" : "Tham khảo"}</span>
        {row.startPage && <span>Từ trang {row.startPage}</span>}
      </div>
      {row.teacherNote && <p className="attachment-note">{row.teacherNote}</p>}
    </div>
    <div className="attachment-actions">{actions}</div>
  </article>;
}

export function LessonAttachments({ session, lessonId }: { session: AuthSession; lessonId: number }) {
  const [pdf, setPdf] = useState<LessonDocument | null>(null);
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["lesson-attachments", session.accessToken, lessonId],
    queryFn: () => getLessonDocuments(session, lessonId),
  });
  const open = async (row: LessonDocument) => {
    setError("");
    if (isPdfDocument(row)) { setPdf(row); return; }
    try { await openDocumentFile(session, row.fileUrl, row.title, row.startPage); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể mở tài liệu."); }
  };
  return <div className="attachment-panel">
    {query.isPending ? <SkeletonTable rows={3} columns={2} aria-label="Đang tải tài liệu"/> : query.isError ?
      <div className="attachment-error" role="alert">{query.error.message}<button onClick={() => void query.refetch()}>Thử lại</button></div> :
      query.data.length ? <>
        <p className="attachment-count">{query.data.length} tài liệu đính kèm</p>
        {query.data.map(row => <AttachmentCard key={row.id} row={row} accessToken={session.accessToken} actions={<button onClick={() => void open(row)}>Xem tài liệu</button>}/>) }
      </> : <div className="attachment-empty"><FileText size={28}/><p>Bài học chưa có tài liệu đính kèm.</p><small>Thêm tài liệu từ thư viện để sử dụng trong khóa học và lớp học.</small></div>}
    {error && <p className="attachment-error" role="alert">{error}</p>}
    {pdf && <PdfViewer session={session} lessonId={lessonId} documentId={pdf.id} title={pdf.title} fileUrl={pdf.fileUrl} initialPage={pdf.startPage} onClose={() => setPdf(null)}/>}
  </div>;
}
