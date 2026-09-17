import React, { useState, useRef } from "react";
import {
  X,
  Edit3,
  Upload,
  FileText,
  ClipboardList,
  Database,
  Maximize2,
  Minimize2,
  AlertCircle,
  FileCode,
  CheckCircle2,
  ChevronRight,
  BookOpen,
  Clock,
  Tag,
  Download,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { LessonContentRenderer } from "../../components/lesson-editor";
import {
  extractHtmlMetadata,
  convertLegacyHtmlToStructured,
  serializeLessonDoc,
} from "../../components/lesson-editor";
import { LessonAttachments } from "../../components/LessonAttachments";
import type { AuthSession, Lesson } from "../../api";

interface LessonPreviewModalProps {
  open: boolean;
  onClose: () => void;
  lesson: Lesson;
  courseName?: string;
  chapterTitle?: string;
  session: AuthSession;
  onEditLesson: (lesson: Lesson) => void;
  onUpdateLessonHtml: (
    lessonId: number,
    contentHtml: string,
    newTitle?: string,
    newSummary?: string
  ) => Promise<void>;
  onOpenDocuments: (lesson: Lesson) => void;
  onOpenWorksheets: (lesson: Lesson) => void;
  onOpenResources: (lesson: Lesson) => void;
}

export function LessonPreviewModal({
  open,
  onClose,
  lesson,
  courseName,
  chapterTitle,
  session,
  onEditLesson,
  onUpdateLessonHtml,
  onOpenDocuments,
  onOpenWorksheets,
  onOpenResources,
}: LessonPreviewModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [updatingHtml, setUpdatingHtml] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"content" | "attachments">("content");

  // Pending upload modal state
  const [pendingFile, setPendingFile] = useState<{
    name: string;
    size: number;
    content: string;
    extractedTitle?: string;
    extractedSummary?: string;
  } | null>(null);
  const [updateStrategy, setUpdateStrategy] = useState<"structured" | "raw">("structured");
  const [applyTitle, setApplyTitle] = useState(false);
  const [applySummary, setApplySummary] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFilePicked = (file: File) => {
    const fileNameLower = file.name.toLowerCase();
    if (!fileNameLower.endsWith(".html") && !fileNameLower.endsWith(".htm")) {
      setUpdateError("Vui lòng chọn tệp có định dạng .html hoặc .htm");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || "";
      const meta = extractHtmlMetadata(text);
      setPendingFile({
        name: file.name,
        size: file.size,
        content: text,
        extractedTitle: meta.title,
        extractedSummary: meta.summary,
      });
      setApplyTitle(Boolean(meta.title && meta.title !== lesson.title));
      setApplySummary(Boolean(meta.summary && meta.summary !== lesson.summary));
      setUpdateError("");
    };
    reader.onerror = () => {
      setUpdateError("Không thể đọc tệp HTML đã chọn.");
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleConfirmUpdate = async () => {
    if (!pendingFile) return;
    setUpdatingHtml(true);
    setUpdateError("");
    try {
      let finalContent: string;
      if (updateStrategy === "structured") {
        const blocks = convertLegacyHtmlToStructured(pendingFile.content);
        finalContent = serializeLessonDoc(blocks);
      } else {
        finalContent = pendingFile.content;
      }

      await onUpdateLessonHtml(
        lesson.id,
        finalContent,
        applyTitle && pendingFile.extractedTitle ? pendingFile.extractedTitle : undefined,
        applySummary && pendingFile.extractedSummary ? pendingFile.extractedSummary : undefined
      );

      setSuccessMessage(`Đã cập nhật bài học từ tệp "${pendingFile.name}" thành công!`);
      setPendingFile(null);
    } catch (reason) {
      setUpdateError((reason as Error).message || "Không thể cập nhật tệp HTML.");
    } finally {
      setUpdatingHtml(false);
    }
  };

  const handleDownloadCurrentHtml = () => {
    const blob = new Blob([lesson.contentHtml || ""], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${lesson.title.replace(/[/\\?%*:|"<>]/g, "-") || "bai-hoc"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.65)] backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-150"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) handleFilePicked(file);
      }}
    >
      <div
        className={`bg-white shadow-2xl flex flex-col transition-all duration-200 overflow-hidden font-sans border border-slate-200 ${
          isFullscreen
            ? "fixed inset-0 w-full h-full rounded-none"
            : "w-[95vw] max-w-[1280px] h-[92vh] max-h-[92vh] rounded-2xl"
        }`}
      >
        {/* ── HEADER KHUNG LỚN ── */}
        <header className="px-5 py-4 border-b border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex-wrap">
              <span>{courseName || "Chương trình"}</span>
              {chapterTitle && (
                <>
                  <ChevronRight size={13} className="text-slate-400" />
                  <span className="text-slate-700">{chapterTitle}</span>
                </>
              )}
              <ChevronRight size={13} className="text-slate-400" />
              <span className="text-[#176b50]">Bài {lesson.orderIndex}</span>
            </div>

            {/* Lesson Title & Badges */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 m-0 tracking-tight line-clamp-1" title={lesson.title}>
                {lesson.title.startsWith("Bài") ? lesson.title : `Bài ${lesson.orderIndex}. ${lesson.title}`}
              </h2>

              <div className="flex items-center gap-1.5 flex-wrap">
                {lesson.publicCode && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    <Tag size={11} className="text-slate-500" />
                    SGK: #{lesson.publicCode}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <Clock size={11} className="text-emerald-600" />
                  {lesson.publicCode ? `${lesson.publicCode} tiết` : "1 tiết"}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                    lesson.status === "PUBLISHED" || lesson.status === "ACTIVE"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}
                >
                  {lesson.status === "PUBLISHED" || lesson.status === "ACTIVE" ? "Đã xuất bản" : "Bản nháp"}
                </span>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* Nút Upload HTML nhanh */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="border-emerald-300 text-[#176b50] bg-emerald-50 hover:bg-emerald-100 font-semibold"
              title="Cập nhật nội dung bài học bằng tệp HTML"
            >
              <Upload size={14} className="mr-1.5 text-emerald-600" />
              Cập nhật file HTML
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".html,.htm"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFilePicked(file);
                  e.target.value = "";
                }
              }}
            />

            {/* Nút Sửa bài học */}
            <Button
              size="sm"
              onClick={() => onEditLesson(lesson)}
              className="bg-[#176b50] hover:bg-[#11543e] text-white font-semibold shadow-xs"
            >
              <Edit3 size={14} className="mr-1.5" />
              Sửa bài học
            </Button>

            {/* Nút Phóng to / Thu nhỏ */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 bg-white cursor-pointer"
              title={isFullscreen ? "Thu nhỏ cửa sổ" : "Xem toàn màn hình"}
              aria-label={isFullscreen ? "Thu nhỏ" : "Phóng to"}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Nút Đóng */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 bg-white cursor-pointer"
              title="Đóng khung xem"
              aria-label="Đóng"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* ── STATUS BANNERS ── */}
        {successMessage && (
          <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>{successMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage("")}
              className="text-emerald-600 hover:text-emerald-800 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {updateError && (
          <div className="px-5 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600" />
              <span>{updateError}</span>
            </div>
            <button
              type="button"
              onClick={() => setUpdateError("")}
              className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── MODAL XÁC NHẬN NẠP FILE HTML NHANH (NẾU ĐƯỢC CHỌN/KÉO THẢ) ── */}
        {pendingFile && (
          <div className="p-4 bg-emerald-50/80 border-b border-emerald-200 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in slide-in-from-top-2">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#176b50] flex items-center justify-center shrink-0">
                <FileCode size={20} />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <b className="text-sm text-slate-900 truncate">{pendingFile.name}</b>
                  <span className="text-xs text-slate-500 font-medium">({(pendingFile.size / 1024).toFixed(1)} KB)</span>
                </div>
                <p className="text-xs text-slate-600 m-0">
                  Bạn có muốn cập nhật nội dung bài học này bằng tệp HTML vừa chọn?
                </p>

                {/* Các tùy chọn kèm theo */}
                <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="updateStrategy"
                      checked={updateStrategy === "structured"}
                      onChange={() => setUpdateStrategy("structured")}
                    />
                    <span>Chuyển sang Khối chuẩn sư phạm (Khuyên dùng)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="updateStrategy"
                      checked={updateStrategy === "raw"}
                      onChange={() => setUpdateStrategy("raw")}
                    />
                    <span>Giữ nguyên mã HTML gốc</span>
                  </label>
                </div>

                {(pendingFile.extractedTitle || pendingFile.extractedSummary) && (
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600">
                    {pendingFile.extractedTitle && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={applyTitle}
                          onChange={(e) => setApplyTitle(e.target.checked)}
                        />
                        <span>Cập nhật tên bài thành: <i>"{pendingFile.extractedTitle}"</i></span>
                      </label>
                    )}
                    {pendingFile.extractedSummary && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={applySummary}
                          onChange={(e) => setApplySummary(e.target.checked)}
                        />
                        <span>Cập nhật tóm tắt từ file</span>
                      </label>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingFile(null)}
                disabled={updatingHtml}
              >
                Hủy
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmUpdate}
                disabled={updatingHtml}
                className="bg-[#176b50] hover:bg-[#11543e] text-white font-semibold"
              >
                {updatingHtml ? "Đang cập nhật…" : "Xác nhận cập nhật ngay"}
              </Button>
            </div>
          </div>
        )}

        {/* ── SUB-BAR: TABS & QUICK ATTACHMENT SHORTCUTS ── */}
        <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("content")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === "content"
                  ? "bg-white text-[#176b50] shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              Nội dung bài học & Lý thuyết
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("attachments")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === "attachments"
                  ? "bg-white text-[#176b50] shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              Tài liệu & Học liệu đính kèm
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenDocuments(lesson)}
              className="text-xs h-8 text-slate-700 bg-white"
            >
              <FileText size={13} className="mr-1 text-slate-500" />
              Tài liệu đính kèm
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenWorksheets(lesson)}
              className="text-xs h-8 text-slate-700 bg-white"
            >
              <ClipboardList size={13} className="mr-1 text-slate-500" />
              Phiếu bài tập
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenResources(lesson)}
              className="text-xs h-8 text-slate-700 bg-white"
            >
              <Database size={13} className="mr-1 text-slate-500" />
              Khối học liệu
            </Button>
          </div>
        </div>

        {/* ── BODY KHUNG LỚN CHÍNH ── */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6">
          {activeTab === "content" ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
              {/* KHUNG LỚN CHÍNH HIỂN THỊ NỘI DUNG (CỘT TRÁI - 8 COLS) */}
              <div className="lg:col-span-8 flex flex-col gap-5">
                {/* Mục tiêu & Tóm tắt bài học */}
                {lesson.summary ? (
                  <div className="p-4 md:p-5 bg-white rounded-xl border-l-4 border-[#176b50] border-t border-r border-b border-slate-200 shadow-xs">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#176b50] mb-1.5">
                      <BookOpen size={15} />
                      Mục tiêu & Tóm tắt trọng tâm
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed m-0">{lesson.summary}</p>
                  </div>
                ) : (
                  <div className="p-4 bg-white/70 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs flex items-center justify-between">
                    <span>Bài học này chưa có phần tóm tắt mục tiêu.</span>
                    <button
                      type="button"
                      onClick={() => onEditLesson(lesson)}
                      className="text-[#176b50] font-semibold hover:underline bg-transparent border-0 cursor-pointer p-0"
                    >
                      + Thêm tóm tắt
                    </button>
                  </div>
                )}

                {/* Khung nội dung lý thuyết chính (Paper Canvas lớn) */}
                <section className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 md:p-8 min-h-[480px]">
                  <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100 flex-wrap gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
                        LÝ THUYẾT & NỘI DUNG BÀI HỌC
                      </span>
                      <h3 className="text-lg font-bold text-slate-900 m-0">
                        {lesson.title}
                      </h3>
                    </div>
                    {lesson.contentHtml && (
                      <button
                        type="button"
                        onClick={handleDownloadCurrentHtml}
                        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                        title="Tải nội dung HTML bài học về máy"
                      >
                        <Download size={13} />
                        <span>Tải tệp HTML</span>
                      </button>
                    )}
                  </div>

                  {lesson.contentHtml ? (
                    <div className="lesson-paper-viewer overflow-x-auto">
                      <LessonContentRenderer
                        content={lesson.contentHtml}
                        fallbackSummary={lesson.summary}
                      />
                    </div>
                  ) : (
                    <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <BookOpen size={24} />
                      </div>
                      <div className="space-y-1 max-w-md">
                        <h4 className="text-sm font-bold text-slate-700 m-0">Bài học chưa có nội dung lý thuyết</h4>
                        <p className="text-xs text-slate-500 m-0">
                          Bạn có thể soạn thảo trực tiếp các khối nội dung hoặc tải lên file HTML có sẵn từ máy tính.
                        </p>
                      </div>
                      <div className="flex items-center gap-3 pt-2">
                        <Button
                          size="sm"
                          onClick={() => onEditLesson(lesson)}
                          className="bg-[#176b50] hover:bg-[#11543e] text-white"
                        >
                          <Edit3 size={14} className="mr-1.5" />
                          Soạn thảo bài học
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
                        >
                          <Upload size={14} className="mr-1.5 text-emerald-600" />
                          Tải lên file HTML
                        </Button>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              {/* CỘT PHẢI (SIDE PANEL TIỆN ÍCH - 4 COLS) */}
              <div className="lg:col-span-4 flex flex-col gap-5">
                {/* Thẻ Cập nhật nhanh file HTML */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FileCode size={14} className="text-[#176b50]" />
                    Cập nhật nhanh tệp HTML
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">
                    Kéo thả tệp <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-mono">.html</code> vào khung này hoặc chọn từ máy tính để cập nhật ngay nội dung bài học.
                  </p>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 hover:border-[#176b50] rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/70 hover:bg-emerald-50/40 group"
                  >
                    <Upload size={24} className="mx-auto text-slate-400 group-hover:text-[#176b50] mb-1.5 transition-colors" />
                    <span className="text-xs font-semibold text-slate-700 block group-hover:text-[#176b50]">
                      Chọn file HTML từ máy tính
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Hỗ trợ HTML chứa công thức KaTeX, bảng biểu, hình ảnh
                    </span>
                  </div>
                </div>

                {/* Thẻ Tài liệu đã gắn */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider m-0 flex items-center gap-1.5">
                      <FileText size={14} className="text-[#176b50]" />
                      Tài liệu bài học
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenDocuments(lesson)}
                      className="text-xs text-[#176b50] hover:bg-emerald-50 h-7 px-2"
                    >
                      Quản lý
                    </Button>
                  </div>
                  <LessonAttachments session={session} lessonId={lesson.id} />
                </div>
              </div>
            </div>
          ) : (
            /* TAB TÀI LIỆU ĐÍNH KÈM ĐẦY ĐỦ */
            <div className="max-w-4xl mx-auto bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 m-0">Tài liệu học tập & Đính kèm</h3>
                  <p className="text-xs text-slate-500 mt-0.5 m-0">Danh sách tài liệu, file PDF, video gán trực tiếp cho bài học này</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => onOpenDocuments(lesson)}
                  className="bg-[#176b50] text-white"
                >
                  <FileText size={14} className="mr-1.5" />
                  Gắn tài liệu mới
                </Button>
              </div>

              <LessonAttachments session={session} lessonId={lesson.id} />
            </div>
          )}
        </div>

        {/* ── FOOTER KHUNG LỚN ── */}
        <footer className="px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span className="font-semibold text-slate-700">Mẹo:</span>
            <span>Nhấn phím <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[10px]">Esc</kbd> hoặc click ngoài để đóng khung xem bài học.</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Đóng
            </Button>
            <Button
              size="sm"
              onClick={() => onEditLesson(lesson)}
              className="bg-[#176b50] hover:bg-[#11543e] text-white"
            >
              <Edit3 size={14} className="mr-1.5" />
              Sửa bài học
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
