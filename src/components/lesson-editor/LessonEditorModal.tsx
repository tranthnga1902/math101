import React, { useState, useEffect, useMemo, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Image } from "@tiptap/extension-image";
import { Link } from "@tiptap/extension-link";

import {
  DefinitionBlock,
  ExampleBlock,
  NoteBlock,
  WarningBlock,
} from "./extensions/CalloutNodes";
import { FormulaBlock } from "./extensions/FormulaBlock";
import { MathInline } from "./extensions/MathInline";

import {
  isStructuredLesson,
  safeParseStructuredLesson,
  convertLegacyHtmlToStructured,
  serializeLessonDoc,
  createEmptyLessonDoc,
  extractHtmlMetadata,
} from "./converter";
import { LessonContentRenderer } from "./LessonContentRenderer";
import type { Lesson, LessonInput } from "../../api";

import {
  ArrowLeft,
  Eye,
  Edit3,
  Save,
  BookOpen,
  Lightbulb,
  Info,
  AlertTriangle,
  Sigma,
  Table as TableIcon,
  Image as ImageIcon,
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Sparkles,
  Upload,
  FileCode,
  Download,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import "./lesson-editor.css";

interface LessonEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: Lesson | null;
  defaultChapterId: number;
  chapterTitle?: string;
  courseName?: string;
  statusOptions?: Array<{ value: string; label: string }>;
  onSave: (payload: LessonInput) => Promise<void>;
}

export function LessonEditorModal({
  isOpen,
  onClose,
  lesson,
  defaultChapterId,
  chapterTitle,
  courseName,
  statusOptions = [
    { value: "PUBLISHED", label: "Đã xuất bản" },
    { value: "DRAFT", label: "Bản nháp" },
    { value: "ARCHIVED", label: "Lưu trữ" },
  ],
  onSave,
}: LessonEditorModalProps) {
  const [mode, setMode] = useState<"edit" | "code" | "preview">("edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Metadata states
  const [title, setTitle] = useState("");
  const [publicCode, setPublicCode] = useState("");
  const [orderIndex, setOrderIndex] = useState(1);
  const [status, setStatus] = useState("PUBLISHED");
  const [summary, setSummary] = useState("");
  const [chapterId, setChapterId] = useState(defaultChapterId);
  const [isLegacy, setIsLegacy] = useState(false);

  // HTML Import / Raw Code states
  const [rawHtml, setRawHtml] = useState("");
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [importStrategy, setImportStrategy] = useState<"structured" | "raw">("structured");
  const [uploadMessage, setUploadMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tiptap editor setup
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      Link.configure({
        openOnClick: false,
      }),
      DefinitionBlock,
      ExampleBlock,
      NoteBlock,
      WarningBlock,
      FormulaBlock,
      MathInline,
    ],
    content: createEmptyLessonDoc(),
    editorProps: {
      attributes: {
        class: "tiptap-editor-canvas",
      },
    },
  });

  // Khi modal mở hoặc bài học thay đổi, load dữ liệu
  useEffect(() => {
    if (!isOpen) return;

    if (lesson) {
      setTitle(lesson.title || "");
      setPublicCode(lesson.publicCode || "");
      setOrderIndex(lesson.orderIndex || 1);
      setStatus(lesson.status || "PUBLISHED");
      setSummary(lesson.summary || "");
      setChapterId(lesson.chapterId || defaultChapterId);

      const raw = lesson.contentHtml || "";
      const isStruct = isStructuredLesson(raw);
      setIsLegacy(!isStruct && Boolean(raw.trim()));
      setRawHtml(raw);
      setUploadedFileInfo(null);
      setUploadMessage("");
      setImportStrategy(isStruct ? "structured" : "raw");

      if (editor) {
        if (isStruct) {
          const doc = safeParseStructuredLesson(raw);
          editor.commands.setContent(doc || createEmptyLessonDoc());
        } else if (raw.trim()) {
          const converted = convertLegacyHtmlToStructured(raw);
          editor.commands.setContent(converted);
        } else {
          editor.commands.setContent(createEmptyLessonDoc());
        }
      }
    } else {
      // Tạo mới
      setTitle("");
      setPublicCode("");
      setOrderIndex(1);
      setStatus("PUBLISHED");
      setSummary("");
      setChapterId(defaultChapterId);
      setIsLegacy(false);
      setRawHtml("");
      setUploadedFileInfo(null);
      setUploadMessage("");
      setImportStrategy("structured");
      if (editor) {
        editor.commands.setContent(createEmptyLessonDoc());
      }
    }
    setError("");
    setMode("edit");
  }, [isOpen, lesson, defaultChapterId, editor]);

  // Preview content derived from editor JSON
  const currentJsonString = useMemo(() => {
    if (!editor) return "";
    return serializeLessonDoc(editor.getJSON());
  }, [editor, mode]);

  const previewContent = useMemo(() => {
    if ((importStrategy === "raw" || mode === "code") && rawHtml.trim()) {
      return rawHtml;
    }
    return currentJsonString;
  }, [importStrategy, mode, rawHtml, currentJsonString]);

  if (!isOpen) return null;

  const handleFileUpload = (file: File) => {
    const fileNameLower = file.name.toLowerCase();
    if (!fileNameLower.endsWith(".html") && !fileNameLower.endsWith(".htm")) {
      setError("Vui lòng chọn tệp có định dạng .html hoặc .htm");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || "";
      setRawHtml(text);
      setUploadedFileInfo({ name: file.name, size: file.size });

      // Trích xuất tiêu đề & tóm tắt từ file HTML nếu có
      const meta = extractHtmlMetadata(text);
      if (meta.title && (!title.trim() || title === "Tạo bài học mới" || title === "Chỉnh sửa bài học")) {
        setTitle(meta.title);
      }
      if (meta.summary && !summary.trim()) {
        setSummary(meta.summary);
      }

      // Nạp vào editor nếu theo chiến lược cấu trúc khối
      if (importStrategy === "structured" && editor) {
        const converted = convertLegacyHtmlToStructured(text);
        editor.commands.setContent(converted);
      }

      setUploadMessage(`Đã nạp tệp: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
      setError("");
    };
    reader.onerror = () => {
      setError("Không thể đọc tệp HTML đã chọn.");
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleDownloadHtml = () => {
    const content = (mode === "code" || importStrategy === "raw") && rawHtml.trim()
      ? rawHtml
      : editor ? editor.getHTML() : "";
    const blob = new Blob([content], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.trim().replace(/[/\\?%*:|"<>]/g, "-") || "bai-hoc"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Vui lòng nhập tên bài học.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      let contentHtml: string;
      if (importStrategy === "raw" || mode === "code") {
        contentHtml = rawHtml.trim() || serializeLessonDoc(editor ? editor.getJSON() : createEmptyLessonDoc());
      } else {
        const doc = editor ? editor.getJSON() : createEmptyLessonDoc();
        contentHtml = serializeLessonDoc(doc);
      }

      await onSave({
        chapterId,
        title: title.trim(),
        publicCode: publicCode.trim(),
        orderIndex: Number(orderIndex),
        status,
        summary: summary.trim(),
        contentHtml,
      });

      onClose();
    } catch (reason) {
      setError((reason as Error).message || "Có lỗi xảy ra khi lưu bài học.");
    } finally {
      setSaving(false);
    }
  };

  const addImage = () => {
    const url = window.prompt("Nhập URL hình ảnh (https://...):");
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const insertTable = () => {
    if (editor) {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    }
  };

  return (
    <div className="lesson-editor-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="lesson-editor-container"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) handleFileUpload(file);
        }}
      >
        {/* TOP HEADER */}
        <header className="lesson-editor-head">
          <div className="lesson-editor-title-area">
            <button type="button" onClick={onClose} className="lesson-editor-back-btn">
              <ArrowLeft size={16} />
              <span>Đóng</span>
            </button>
            <div className="h-4 w-px bg-slate-200" />
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider m-0">
                {courseName ? `${courseName} · ` : ""}
                {chapterTitle ? `${chapterTitle}` : "Soạn thảo bài học"}
              </p>
              <h2 className="text-base font-bold text-slate-800 m-0 line-clamp-1">
                {title ? `${title}` : lesson ? "Chỉnh sửa bài học" : "Tạo bài học mới"}
              </h2>
            </div>
          </div>

          {/* Mode Switcher: Soạn thảo khối / Mã HTML / Xem trước */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[#176b50] font-semibold text-xs transition-colors cursor-pointer"
              title="Tải lên tệp HTML (.html, .htm) từ máy tính để nạp nội dung bài học"
            >
              <Upload size={14} />
              <span>Nạp file HTML</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".html,.htm"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(file);
                  e.target.value = "";
                }
              }}
            />

            <div className="lesson-mode-switch">
              <button
                type="button"
                className={`lesson-mode-tab ${mode === "edit" ? "active" : ""}`}
                onClick={() => {
                  if (mode === "code" && rawHtml.trim()) {
                    const converted = convertLegacyHtmlToStructured(rawHtml);
                    editor?.commands.setContent(converted);
                  }
                  setMode("edit");
                }}
              >
                <Edit3 size={14} />
                <span>Soạn thảo khối</span>
              </button>
              <button
                type="button"
                className={`lesson-mode-tab ${mode === "code" ? "active" : ""}`}
                onClick={() => {
                  if (editor && (!rawHtml.trim() || mode === "edit")) {
                    setRawHtml(editor.getHTML());
                  }
                  setMode("code");
                }}
              >
                <FileCode size={14} />
                <span>Mã HTML</span>
              </button>
              <button
                type="button"
                className={`lesson-mode-tab ${mode === "preview" ? "active" : ""}`}
                onClick={() => setMode("preview")}
              >
                <Eye size={14} />
                <span>Xem trước</span>
              </button>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#176b50] hover:bg-[#11543e] text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save size={14} />
              <span>{saving ? "Đang lưu…" : lesson ? "Lưu thay đổi" : "Tạo bài học"}</span>
            </button>
          </div>
        </header>

        {/* THÔNG BÁO NẠP TỆP HTML THÀNH CÔNG */}
        {uploadMessage && (
          <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-600" />
              <span>{uploadMessage}</span>
            </div>
            <button type="button" onClick={() => setUploadMessage("")} className="text-emerald-600 hover:text-emerald-800 font-bold">
              ✕
            </button>
          </div>
        )}

        {/* ERROR BANNER IF ANY */}
        {error && (
          <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs font-medium flex items-center justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} className="text-rose-500 font-bold">
              ✕
            </button>
          </div>
        )}

        {/* MAIN BODY */}
        <div className="lesson-editor-body">
          {/* CỘT TRÁI: THÔNG TIN BÀI HỌC (METADATA) */}
          <aside className="editor-metadata-sidebar">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider m-0">
                Thông tin cơ bản
              </h3>
            </div>

            {/* Tên bài học */}
            <label className="editor-field">
              <span className="editor-field-label">Tên bài học *</span>
              <input
                type="text"
                required
                className="editor-field-input"
                placeholder="Ví dụ: 1. Mệnh đề, mệnh đề toán học"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            {/* Mã SGK & Thứ tự bài */}
            <div className="grid grid-cols-2 gap-2">
              <label className="editor-field">
                <span className="editor-field-label">Mã SGK / Định danh</span>
                <input
                  type="text"
                  className="editor-field-input"
                  placeholder="Ví dụ: 12-15"
                  value={publicCode}
                  onChange={(e) => setPublicCode(e.target.value)}
                />
              </label>

              <label className="editor-field">
                <span className="editor-field-label">Thứ tự bài</span>
                <input
                  type="number"
                  min="1"
                  required
                  className="editor-field-input"
                  value={orderIndex}
                  onChange={(e) => setOrderIndex(Number(e.target.value))}
                />
              </label>
            </div>

            {/* Trạng thái */}
            <label className="editor-field">
              <span className="editor-field-label">Trạng thái xuất bản</span>
              <select
                className="editor-field-input"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Tóm tắt bài học */}
            <label className="editor-field">
              <div className="flex justify-between items-center">
                <span className="editor-field-label">Tóm tắt bài học</span>
                <span
                  className={`text-[10px] ${
                    summary.length > 1000 ? "text-amber-600 font-bold" : "text-slate-400"
                  }`}
                >
                  {summary.length}/1000 ký tự
                </span>
              </div>
              <textarea
                rows={4}
                className="editor-field-textarea"
                placeholder="Tóm tắt ngắn gọn mục tiêu, nội dung trọng tâm (khoảng 300–800 ký tự)…"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </label>

            {/* Quản lý tệp HTML */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="editor-field-label flex items-center gap-1.5 text-slate-700">
                  <FileCode size={13} className="text-[#176b50]" />
                  TỆP HTML BÀI HỌC
                </span>
                {uploadedFileInfo && (
                  <span className="text-[10px] font-medium bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                    {(uploadedFileInfo.size / 1024).toFixed(1)} KB
                  </span>
                )}
              </div>

              {uploadedFileInfo ? (
                <p className="text-xs text-slate-700 m-0 truncate" title={uploadedFileInfo.name}>
                  Tệp: <b>{uploadedFileInfo.name}</b>
                </p>
              ) : (
                <p className="text-[11px] text-slate-500 m-0">
                  Nạp file .html có sẵn từ máy tính để cập nhật nội dung bài học nhanh chóng.
                </p>
              )}

              <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-200/60">
                <span className="text-[11px] font-semibold text-slate-600">Cách xử lý nội dung:</span>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="importStrategy"
                    value="structured"
                    checked={importStrategy === "structured"}
                    onChange={() => {
                      setImportStrategy("structured");
                      if (rawHtml.trim() && editor) {
                        const converted = convertLegacyHtmlToStructured(rawHtml);
                        editor.commands.setContent(converted);
                      }
                    }}
                  />
                  <span>Khối chuẩn (Khuyên dùng)</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="importStrategy"
                    value="raw"
                    checked={importStrategy === "raw"}
                    onChange={() => setImportStrategy("raw")}
                  />
                  <span>Giữ nguyên mã HTML gốc</span>
                </label>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Upload size={12} />
                  <span>Chọn tệp HTML</span>
                </button>
                {(rawHtml || (editor && !editor.isEmpty)) && (
                  <button
                    type="button"
                    onClick={handleDownloadHtml}
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    title="Tải tệp HTML về máy"
                  >
                    <Download size={12} />
                    <span>Xuất HTML</span>
                  </button>
                )}
              </div>
            </div>

            {/* Legacy Notice */}
            {isLegacy && (
              <div className="editor-format-banner">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <Sparkles size={14} className="text-amber-600" />
                  <span>Định dạng HTML cũ</span>
                </div>
                <p className="text-xs text-amber-800 m-0 leading-relaxed">
                  Bài học này đang lưu ở định dạng HTML. Khi lưu theo Khối chuẩn, hệ thống sẽ tự động tối ưu sang cấu trúc sư phạm hiện đại.
                </p>
              </div>
            )}

            <div className="mt-auto pt-4 border-t border-slate-100 text-[11px] text-slate-400 space-y-1">
              <p className="m-0">💡 Có thể kéo thả trực tiếp tệp .html vào cửa sổ soạn thảo.</p>
              <p className="m-0">💡 Sử dụng <b>$công_thức$</b> cho toán inline.</p>
            </div>
          </aside>

          {/* CỘT PHẢI: WORKSPACE (SOẠN THẢO HOẶC XEM TRƯỚC) */}
          {mode === "edit" ? (
            <main className="editor-canvas-container">
              {/* TOOLBAR */}
              {editor && (
                <div className="editor-toolbar">
                  {/* Headings */}
                  <div className="toolbar-group">
                    <button
                      type="button"
                      className={`toolbar-btn ${editor.isActive("paragraph") ? "active" : ""}`}
                      onClick={() => editor.chain().focus().setParagraph().run()}
                      title="Đoạn văn thường"
                    >
                      Đoạn
                    </button>
                    <button
                      type="button"
                      className={`toolbar-btn ${editor.isActive("heading", { level: 1 }) ? "active" : ""}`}
                      onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                      title="Tiêu đề 1"
                    >
                      <Heading1 size={14} />
                    </button>
                    <button
                      type="button"
                      className={`toolbar-btn ${editor.isActive("heading", { level: 2 }) ? "active" : ""}`}
                      onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                      title="Tiêu đề 2"
                    >
                      <Heading2 size={14} />
                    </button>
                    <button
                      type="button"
                      className={`toolbar-btn ${editor.isActive("heading", { level: 3 }) ? "active" : ""}`}
                      onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                      title="Tiêu đề 3"
                    >
                      <Heading3 size={14} />
                    </button>
                  </div>

                  {/* Text formats */}
                  <div className="toolbar-group">
                    <button
                      type="button"
                      className={`toolbar-btn ${editor.isActive("bold") ? "active" : ""}`}
                      onClick={() => editor.chain().focus().toggleBold().run()}
                      title="In đậm (Ctrl+B)"
                    >
                      <Bold size={14} />
                    </button>
                    <button
                      type="button"
                      className={`toolbar-btn ${editor.isActive("italic") ? "active" : ""}`}
                      onClick={() => editor.chain().focus().toggleItalic().run()}
                      title="In nghiêng (Ctrl+I)"
                    >
                      <Italic size={14} />
                    </button>
                    <button
                      type="button"
                      className={`toolbar-btn ${editor.isActive("strike") ? "active" : ""}`}
                      onClick={() => editor.chain().focus().toggleStrike().run()}
                      title="Gạch ngang"
                    >
                      <Strikethrough size={14} />
                    </button>
                  </div>

                  {/* Lists */}
                  <div className="toolbar-group">
                    <button
                      type="button"
                      className={`toolbar-btn ${editor.isActive("bulletList") ? "active" : ""}`}
                      onClick={() => editor.chain().focus().toggleBulletList().run()}
                      title="Danh sách gạch đầu dòng"
                    >
                      <List size={14} />
                    </button>
                    <button
                      type="button"
                      className={`toolbar-btn ${editor.isActive("orderedList") ? "active" : ""}`}
                      onClick={() => editor.chain().focus().toggleOrderedList().run()}
                      title="Danh sách đánh số"
                    >
                      <ListOrdered size={14} />
                    </button>
                  </div>

                  {/* Khối sư phạm Toán học */}
                  <div className="toolbar-group">
                    <button
                      type="button"
                      className="toolbar-btn toolbar-btn-callout def"
                      onClick={() =>
                        editor
                          .chain()
                          .focus()
                          .insertContent({
                            type: "definitionBlock",
                            attrs: { title: "Định nghĩa" },
                            content: [{ type: "paragraph" }],
                          })
                          .run()
                      }
                      title="Chèn khối Định nghĩa (Xanh lá)"
                    >
                      <BookOpen size={13} />
                      <span>+ Định nghĩa</span>
                    </button>

                    <button
                      type="button"
                      className="toolbar-btn toolbar-btn-callout ex"
                      onClick={() =>
                        editor
                          .chain()
                          .focus()
                          .insertContent({
                            type: "exampleBlock",
                            attrs: { title: "Ví dụ" },
                            content: [{ type: "paragraph" }],
                          })
                          .run()
                      }
                      title="Chèn khối Ví dụ (Vàng cam)"
                    >
                      <Lightbulb size={13} />
                      <span>+ Ví dụ</span>
                    </button>

                    <button
                      type="button"
                      className="toolbar-btn toolbar-btn-callout note"
                      onClick={() =>
                        editor
                          .chain()
                          .focus()
                          .insertContent({
                            type: "noteBlock",
                            attrs: { title: "Ghi chú" },
                            content: [{ type: "paragraph" }],
                          })
                          .run()
                      }
                      title="Chèn khối Ghi chú (Xanh dương)"
                    >
                      <Info size={13} />
                      <span>+ Ghi chú</span>
                    </button>

                    <button
                      type="button"
                      className="toolbar-btn toolbar-btn-callout warn"
                      onClick={() =>
                        editor
                          .chain()
                          .focus()
                          .insertContent({
                            type: "warningBlock",
                            attrs: { title: "Cảnh báo / Lưu ý" },
                            content: [{ type: "paragraph" }],
                          })
                          .run()
                      }
                      title="Chèn khối Cảnh báo (Đỏ)"
                    >
                      <AlertTriangle size={13} />
                      <span>+ Cảnh báo</span>
                    </button>
                  </div>

                  {/* Math & Media */}
                  <div className="toolbar-group">
                    <button
                      type="button"
                      className="toolbar-btn font-semibold text-[#176b50] bg-emerald-50 hover:bg-emerald-100"
                      onClick={() =>
                        editor
                          .chain()
                          .focus()
                          .insertContent({
                            type: "formulaBlock",
                            attrs: { latex: "f(x) = ax^2 + bx + c" },
                          })
                          .run()
                      }
                      title="Chèn công thức KaTeX riêng dòng"
                    >
                      <Sigma size={14} />
                      <span>+ Công thức</span>
                    </button>

                    <button
                      type="button"
                      className="toolbar-btn"
                      onClick={insertTable}
                      title="Chèn bảng"
                    >
                      <TableIcon size={14} />
                      <span>Bảng</span>
                    </button>

                    <button
                      type="button"
                      className="toolbar-btn"
                      onClick={addImage}
                      title="Chèn hình ảnh từ URL"
                    >
                      <ImageIcon size={14} />
                      <span>Ảnh</span>
                    </button>
                  </div>

                  {/* History */}
                  <div className="toolbar-group ml-auto">
                    <button
                      type="button"
                      disabled={!editor.can().undo()}
                      className="toolbar-btn disabled:opacity-30"
                      onClick={() => editor.chain().focus().undo().run()}
                      title="Hoàn tác (Ctrl+Z)"
                    >
                      <Undo size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={!editor.can().redo()}
                      className="toolbar-btn disabled:opacity-30"
                      onClick={() => editor.chain().focus().redo().run()}
                      title="Làm lại (Ctrl+Y)"
                    >
                      <Redo size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* EDITOR PAPER CANVAS */}
              <div className="editor-scroll-area">
                <div className="editor-paper">
                  <EditorContent editor={editor} />
                </div>
              </div>
            </main>
          ) : mode === "code" ? (
            /* CODE MODE: XEM & CHỈNH SỬA MÃ HTML */
            <main className="editor-canvas-container">
              <div className="bg-slate-900 text-slate-100 p-3 px-4 flex items-center justify-between text-xs border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2 font-mono">
                  <FileCode size={15} className="text-emerald-400" />
                  <span className="font-semibold">Mã nguồn HTML</span>
                  {uploadedFileInfo && (
                    <span className="text-slate-400 text-[11px] truncate max-w-[280px]">
                      · {uploadedFileInfo.name} ({(uploadedFileInfo.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                  <span className="text-slate-500 font-sans text-[11px]">({rawHtml.length} ký tự)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (rawHtml.trim()) {
                        const converted = convertLegacyHtmlToStructured(rawHtml);
                        editor?.commands.setContent(converted);
                        setImportStrategy("structured");
                        setMode("edit");
                      }
                    }}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-emerald-400 font-medium transition-colors cursor-pointer"
                    title="Chuyển mã HTML này thành các khối chuẩn sư phạm và mở chế độ soạn thảo trực quan"
                  >
                    Chuyển sang Khối trực quan →
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 rounded bg-emerald-800 hover:bg-emerald-700 text-xs text-white font-medium transition-colors cursor-pointer"
                  >
                    Nạp file HTML khác
                  </button>
                </div>
              </div>
              <div className="flex-1 p-4 bg-slate-950 overflow-auto">
                <textarea
                  value={rawHtml}
                  onChange={(e) => setRawHtml(e.target.value)}
                  placeholder="Dán hoặc nhập mã HTML vào đây, hoặc nhấn 'Nạp file HTML' để tải tệp từ máy tính..."
                  className="w-full h-full min-h-[500px] font-mono text-xs text-emerald-300 bg-transparent border-0 outline-none resize-none leading-relaxed selection:bg-emerald-900 selection:text-white"
                  spellCheck={false}
                />
              </div>
            </main>
          ) : (
            /* PREVIEW MODE: CHÍNH XÁC NHƯ HỌC SINH THẤY */
            <section className="editor-preview-area">
              <div className="preview-paper space-y-5">
                {/* Header mô phỏng */}
                <div className="border-b border-slate-200 pb-4">
                  <div className="text-xs font-bold text-[#176b50] uppercase tracking-wider mb-1">
                    BÀI {orderIndex} {publicCode ? `· SGK: #${publicCode}` : ""}
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900 m-0">{title || "Tiêu đề bài học"}</h1>
                </div>

                {/* Tóm tắt */}
                {summary && (
                  <div className="p-4 bg-slate-50 rounded-xl border-l-4 border-[#176b50] text-sm text-slate-700">
                    <b className="block text-xs uppercase text-slate-500 mb-1 tracking-wider">
                      Mục tiêu & Tóm tắt bài học
                    </b>
                    <p className="m-0 leading-relaxed">{summary}</p>
                  </div>
                )}

                {/* Nội dung lý thuyết qua LessonContentRenderer */}
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3">
                    Nội dung lý thuyết
                  </h3>
                  <div className="p-6 rounded-xl border border-slate-200 bg-white">
                    <LessonContentRenderer
                      content={previewContent}
                      fallbackSummary={summary}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

