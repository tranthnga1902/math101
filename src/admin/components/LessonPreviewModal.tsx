import React, { useState, useRef } from "react";
import {
  X,
  Edit3,
  Upload,
  FileCode,
  FileText,
  ClipboardList,
  Database,
  Maximize2,
  Minimize2,
  AlertCircle,
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
  isFullHtmlDocument,
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
      // Trang có CSS/script riêng: chuyển sang khối sẽ làm mất định dạng
      setUpdateStrategy(isFullHtmlDocument(text) ? "raw" : "structured");
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
              title="Chọn tệp HTML, hoặc kéo thả tệp vào bất kỳ đâu trong khung này"
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
                {updateStrategy === "structured" && isFullHtmlDocument(pendingFile.content) && (
                  <p className="text-xs text-amber-700 m-0">
                    Tệp này có CSS/script riêng. Chuyển sang khối sẽ bỏ màu sắc, bố cục và phần tương tác của tệp.
                  </p>
                )}

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

        {/* ── THANH GẮN KÈM: nơi duy nhất mở tài liệu / phiếu / học liệu ── */}
        <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs font-bold text-slate-600">Gắn vào bài học</span>

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
                {/* Thẻ Tài liệu đã gắn */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider m-0 flex items-center gap-1.5">
                      <FileText size={14} className="text-[#176b50]" />
                      Tài liệu bài học
                    </h4>
                  </div>
                  <LessonAttachments session={session} lessonId={lesson.id} />
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
