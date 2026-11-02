import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getClassCurriculum,
  getClassProgramCurriculum,
  getClassDocuments,
  getMyClasses,
  getMyClassSubmissionLog,
  getMyClassTasks,
  markAssignment,
  openDocumentFile,
  type AuthSession,
  type ClassDocumentItem,
  type ClassProgramResource,
  type MyClass,
  type MyClassTask,
} from "../api";
import { PdfViewer, isPdfDocument } from "../components/PdfViewer";
import { dueDateLabel } from "./format";
import { ClassSessionsTab } from "./ClassSessionsTab";
import { ClassMaterialsTab } from "../teacher/class/ClassDetailTabs";
import { DocumentPreview } from "../components/DocumentPreview";

type MyClassesPageProps = {
  session: AuthSession;
  onOpenLesson: (lessonId: number) => void;
  onOpenWorksheet: (assignmentId: number) => void;
};

/** Tài liệu lớp trả về dạng snake_case; đổi sang hình dạng mà trình xem PDF hiểu. */
const asPdfRow = (row: ClassDocumentItem) => ({ fileUrl: row.file_url, docType: row.doc_type });

const stateLabel: Record<string, { text: string; tone: string }> = {
  NOT_SUBMITTED: { text: "Chưa nộp", tone: "bg-surface-container-high text-on-surface-variant" },
  SUBMITTED: { text: "Đã nộp", tone: "bg-primary-container text-on-primary-container" },
  GRADED: { text: "Đang chấm", tone: "bg-primary-container text-on-primary-container" },
  RETURNED: { text: "Đã trả bài", tone: "bg-tertiary-container text-on-tertiary-container" },
};

function StateChip({ status }: { status: string }) {
  const item = stateLabel[status] ?? stateLabel.NOT_SUBMITTED;
  return <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${item.tone}`}>{item.text}</span>;
}

function RequirementChip({ requirement }: { requirement: "BAT_BUOC" | "TU_CHON" }) {
  const required = requirement === "BAT_BUOC";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
        required ? "bg-error-container text-on-error-container" : "bg-surface-container-high text-on-surface-variant"
      }`}
    >
      <span className="material-symbols-outlined text-[14px]">{required ? "priority_high" : "bookmark"}</span>
      {required ? "Bắt buộc" : "Tự chọn"}
    </span>
  );
}

/**
 * Danh sách lớp của em. Hai con số tiến độ để riêng nhau theo đúng cách chấm đã chốt:
 * phần bắt buộc ra điểm, phần tự chọn chỉ đo mức tự giác và không cộng vào điểm.
 */
function ClassCard({ row, onOpen }: { row: MyClass; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left border border-outline-variant rounded-xl bg-surface-container-lowest p-4 hover:bg-surface-container-low transition-colors flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-on-surface truncate">{row.name}</p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Mã {row.code}
            {row.grade_name && ` · ${row.grade_name}`}
            {` · ${row.student_count} học sinh`}
          </p>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant shrink-0">chevron_right</span>
      </div>

      <p className="text-sm text-on-surface-variant inline-flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[16px] text-primary">person</span>
        {row.teacher_names ?? "Chưa phân công giáo viên"}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-surface-container p-3">
          <p className="text-xs font-semibold text-on-surface-variant">Bắt buộc · tính điểm</p>
          <p className="text-lg font-bold text-on-surface mt-1 data-tabular">
            {row.required_submitted}/{row.required_total}
          </p>
          <p className="text-xs text-on-surface-variant">
            {row.required_avg_score === null ? "Chưa có điểm" : `Điểm trung bình ${row.required_avg_score}/10`}
          </p>
        </div>
        <div className="rounded-lg bg-surface-container p-3">
          <p className="text-xs font-semibold text-on-surface-variant">Tự chọn · mức tự giác</p>
          <p className="text-lg font-bold text-on-surface mt-1 data-tabular">
            {row.optional_submitted}/{row.optional_total}
          </p>
          <p className="text-xs text-on-surface-variant">Không cộng vào điểm</p>
        </div>
      </div>

      <p className="text-xs text-on-surface-variant">
        {row.curriculum_count} mục chương trình · {row.document_count} tài liệu
      </p>
    </button>
  );
}

function CurriculumTab({ session, classId }: { session: AuthSession; classId: number }) {
  const programQuery = useQuery({
    queryKey: ["student-class-program-curriculum", session.userId, classId],
    queryFn: () => getClassProgramCurriculum(session, classId),
  });
  const customQuery = useQuery({
    queryKey: ["my-class-curriculum", session.userId, classId],
    queryFn: () => getClassCurriculum(session, classId),
  });

  const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>({});
  const [docError, setDocError] = useState("");

  const programCourses = programQuery.data?.courses ?? [];
  const customRows = customQuery.data ?? [];
  const isLoading = programQuery.isLoading || customQuery.isLoading;

  const toggleChapter = (id: number) => {
    setExpandedChapters(prev => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const handleOpenDoc = (doc: ClassProgramResource) => {
    setDocError("");
    if (!doc.fileUrl) {
      setDocError(`Tài liệu "${doc.title}" chưa có tệp đính kèm.`);
      return;
    }
    void openDocumentFile(session, doc.fileUrl, doc.title, doc.startPage).catch(err => {
      setDocError(err instanceof Error ? err.message : "Không thể mở tài liệu");
    });
  };

  if (isLoading) return <p className="text-sm text-on-surface-variant">Đang tải chương trình học…</p>;

  if (!programCourses.length && !customRows.length) {
    return <p className="text-sm text-on-surface-variant">Giáo viên chưa xếp chương trình học cho lớp này.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {docError && (
        <div className="p-3 bg-error-container/40 text-error border border-error/20 rounded-lg text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">error</span>
          {docError}
        </div>
      )}

      {/* ── Khóa học & Cấu trúc bài học chuẩn ── */}
      {programCourses.map(course => (
        <div key={course.courseInstanceId} className="flex flex-col gap-3">
          {/* Tiêu đề khóa học */}
          <div className="flex items-center justify-between gap-3 p-3 bg-surface-container rounded-xl border border-outline-variant/60 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="material-symbols-outlined text-primary text-[22px]">auto_stories</span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-on-surface truncate">{course.courseInstanceName}</h3>
                <p className="text-xs text-on-surface-variant">
                  {course.programName} {course.schoolYear ? `· Năm học ${course.schoolYear}` : ""}
                </p>
              </div>
            </div>
            <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-primary-container text-on-primary-container">
              {course.totalLessons} bài học · {course.totalDocuments} tài liệu
            </span>
          </div>

          {/* Tài liệu chung của khóa */}
          {course.commonDocuments.length > 0 && (
            <div className="border border-outline-variant rounded-xl bg-surface-container-lowest p-3 flex flex-col gap-2">
              <h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-primary">folder_special</span>
                Tài liệu chung của khóa học
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {course.commonDocuments.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-outline-variant bg-surface hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
                        {doc.resourceType === "VIDEO" ? "smart_display" : "description"}
                      </span>
                      <p className="text-xs font-semibold text-on-surface truncate" title={doc.title}>
                        {doc.title}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenDoc(doc)}
                      className="px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary-container/20 rounded shrink-0"
                    >
                      Xem
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Danh sách chương & bài học */}
          <div className="flex flex-col gap-2.5">
            {course.chapters.map(chapter => {
              const isOpen = expandedChapters[chapter.id] ?? true;
              const docCount = chapter.lessons.reduce((sum, l) => sum + l.documents.length, 0);

              return (
                <div
                  key={chapter.id}
                  className="border border-outline-variant rounded-xl bg-surface-container-lowest overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleChapter(chapter.id)}
                    className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-surface-container-low transition-colors select-none"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                        {isOpen ? "folder_open" : "folder"}
                      </span>
                      <span className="text-sm font-bold text-on-surface truncate">{chapter.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-on-surface-variant">
                        {chapter.lessons.length} bài · {docCount} tài liệu
                      </span>
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant" style={{ transform: isOpen ? "rotate(180deg)" : "none" }}>
                        expand_more
                      </span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-outline-variant divide-y divide-outline-variant/60 bg-surface">
                      {chapter.lessons.map(lesson => (
                        <div key={lesson.id} className="p-3 pl-4 flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                                {lesson.orderIndex}
                              </span>
                              <h4 className="text-xs font-bold text-on-surface truncate">{lesson.title}</h4>
                            </div>
                            {lesson.totalPeriods != null && (
                              <span className="text-[11px] text-on-surface-variant px-1.5 py-0.5 rounded bg-surface-container-high">
                                {lesson.totalPeriods} tiết
                              </span>
                            )}
                          </div>

                          {/* Tài liệu đính kèm theo bài */}
                          {lesson.documents.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 pl-7">
                              {lesson.documents.map(doc => (
                                <div
                                  key={doc.id}
                                  className="flex items-center justify-between gap-2 p-2 rounded-lg border border-outline-variant/70 bg-surface-container-lowest hover:border-primary/50 transition-colors"
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
                                      {doc.resourceType === "VIDEO" ? "smart_display" : "picture_as_pdf"}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-medium text-on-surface truncate" title={doc.title}>
                                        {doc.title}
                                      </p>
                                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                        {doc.required && (
                                          <span className="text-[10px] px-1 py-0.2 rounded bg-error-container text-on-error-container font-bold">
                                            Bắt buộc
                                          </span>
                                        )}
                                        {doc.startPage && (
                                          <span className="text-[10px] text-on-surface-variant">
                                            Trang {doc.startPage}
                                          </span>
                                        )}
                                        {doc.teacherNote && (
                                          <span className="text-[10px] italic text-on-surface-variant truncate" title={doc.teacherNote}>
                                            · {doc.teacherNote}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDoc(doc)}
                                    className="h-7 px-2.5 text-xs font-semibold text-primary hover:bg-primary-container/20 rounded flex items-center gap-1 shrink-0"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">visibility</span>
                                    Xem
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-on-surface-variant/60 italic pl-7">
                              Chưa có tài liệu đính kèm
                            </p>
                          )}
                        </div>
                      ))}
                      {!chapter.lessons.length && (
                        <p className="p-3 text-xs text-on-surface-variant text-center">Chương chưa có bài học.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── Chuyên đề bổ sung riêng của lớp (nếu có) ── */}
      {customRows.length > 0 && (
        <div className="border border-outline-variant rounded-xl bg-surface-container-lowest p-4 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-on-surface">Chuyên đề bổ sung riêng của lớp</h3>
          <ol className="flex flex-col gap-2">
            {customRows.map((row, index) => (
              <li key={row.id} className="border border-outline-variant rounded-lg p-3 flex items-start gap-3 bg-surface">
                <span className="w-6 h-6 shrink-0 rounded-full bg-primary-container text-on-primary-container text-xs font-bold flex items-center justify-center">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-on-surface">{row.title}</p>
                  {row.parent_title && <p className="text-xs text-on-surface-variant">{row.parent_title}</p>}
                  {row.note && <p className="text-xs text-on-surface-variant mt-1 italic">Ghi chú: {row.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function DocumentsTab({ session, classId }: { session: AuthSession; classId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["my-class-documents", session.userId, classId],
    queryFn: () => getClassDocuments(session, classId),
  });
  const [pdfDoc, setPdfDoc] = useState<ClassDocumentItem | null>(null);
  const [error, setError] = useState("");
  const rows = data ?? [];

  const open = (row: ClassDocumentItem) => {
    if (isPdfDocument(asPdfRow(row))) {
      setPdfDoc(row);
      return;
    }
    openDocumentFile(session, row.file_url, row.title).catch((reason: unknown) => setError((reason as Error).message));
  };

  if (isLoading) return <p className="text-sm text-on-surface-variant">Đang tải tài liệu…</p>;
  // Tài liệu gắn thẳng vào lớp là đường cũ; lớp không có gì ở đây thì khỏi hiện cả mục.
  if (!rows.length) return null;

  const groups: Array<[string, string, ClassDocumentItem[]]> = [
    ["BAT_BUOC", "Tài liệu bắt buộc", rows.filter((row) => row.requirement === "BAT_BUOC")],
    ["TU_CHON", "Tài liệu tự chọn", rows.filter((row) => row.requirement === "TU_CHON")],
  ];

  return (
    <div className="flex flex-col gap-4 mt-4">
      <h3 className="font-semibold">Tài liệu giáo viên giao trực tiếp</h3>
      {error && <p className="text-sm text-error">{error}</p>}
      {groups.map(([key, label, list]) =>
        list.length ? (
          <section key={key} className="flex flex-col gap-2">
            <h3 className="text-sm font-bold text-on-surface inline-flex items-center gap-2">
              {label}
              <span className="text-xs font-normal text-on-surface-variant">({list.length})</span>
            </h3>
            {list.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => open(row)}
                className="text-left border border-outline-variant rounded-lg p-3 hover:bg-surface-container-low transition-colors flex items-start gap-3"
              >
                <DocumentPreview
                  fileUrl={row.file_url}
                  title={row.title}
                  docType={row.doc_type}
                  accessToken={session.accessToken}
                  variant="compact"
                  className="w-14 h-18 shrink-0 shadow-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-on-surface truncate">{row.title}</p>
                  <p className="text-xs text-on-surface-variant">
                    {row.taxonomy_title ?? "Chưa gắn chuyên đề"}
                    {row.total_pages ? ` · ${row.total_pages} trang` : ""}
                  </p>
                  {row.note && <p className="text-sm text-on-surface-variant mt-1">{row.note}</p>}
                </div>
                <RequirementChip requirement={row.requirement} />
              </button>
            ))}
          </section>
        ) : null,
      )}
      {pdfDoc && (
        <PdfViewer
          session={session}
          documentId={pdfDoc.document_id}
          title={pdfDoc.title}
          fileUrl={pdfDoc.file_url}
          onClose={() => setPdfDoc(null)}
        />
      )}
    </div>
  );
}

function TaskRow({
  row,
  onOpen,
  onMarkDone,
  marking,
}: {
  row: MyClassTask;
  onOpen: () => void;
  onMarkDone: () => void;
  marking: boolean;
}) {
  const scheduled = row.state === "SCHEDULED";
  const closed = row.state === "CLOSED";
  const due = scheduled
    ? { text: row.open_at ? `Mở lúc ${new Date(row.open_at).toLocaleString("vi-VN")}` : "Chưa tới giờ mở", urgent: false }
    : row.state === "LATE_OPEN"
      ? { text: "Quá hạn — còn nhận muộn", urgent: true }
      : dueDateLabel(row.due_at);
  const openable = !!(row.worksheet_id || row.lesson_id || row.document_id);
  // Phiếu bài tập có luồng nộp riêng (làm xong rồi bấm "Nộp bài"), nên chỉ bài học và tài liệu
  // mới cần nút đánh dấu — đây cũng là đường duy nhất để bài tự chọn được ghi nhận.
  // Ngoài cửa nộp thì server từ chối, đừng mời học sinh bấm.
  const markable = !row.worksheet_id && !row.submitted_at && (row.state === "OPEN" || row.state === "LATE_OPEN");
  return (
    <div className="border border-outline-variant rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-on-surface">{row.title}</p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {scheduled ? "Chưa mở đề" : row.worksheet_name ?? row.document_title ?? "Bài học trên lớp"}
          </p>
        </div>
        <StateChip status={row.grading_status} />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <RequirementChip requirement={row.requirement} />
        <span className={`text-xs font-medium ${due.urgent ? "text-error" : "text-on-surface-variant"}`}>{due.text}</span>
        {row.submitted_late && <span className="text-xs font-medium text-error">Đã nộp muộn</span>}
        {!row.submitted_at && !scheduled && !closed && row.attempts_left !== null && (
          <span className="text-xs font-medium text-on-surface-variant">Còn {row.attempts_left} lượt nộp</span>
        )}
        {row.requirement === "BAT_BUOC" && row.score !== null && (
          <span className="text-xs font-bold text-primary data-tabular">
            Điểm {row.score}/{row.max_score ?? 10}
          </span>
        )}
        {row.requirement === "TU_CHON" && row.submitted_at && (
          <span className="text-xs font-medium text-on-surface-variant">Đã làm · không tính điểm</span>
        )}
      </div>

      {row.teacher_feedback && (
        <p className="text-sm text-on-surface bg-surface-container rounded-lg p-2">
          <span className="font-semibold">Nhận xét: </span>
          {row.teacher_feedback}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {openable && (
          <button
            type="button"
            onClick={onOpen}
            className="h-9 px-3 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {row.worksheet_id ? "Làm bài" : row.document_id ? "Mở tài liệu" : "Vào bài học"}
          </button>
        )}
        {markable && (
          <button
            type="button"
            onClick={onMarkDone}
            disabled={marking}
            className="h-9 px-3 rounded-lg border border-outline-variant text-on-surface text-sm font-semibold hover:bg-surface-container transition-colors disabled:opacity-50"
          >
            {marking ? "Đang ghi nhận…" : "Đánh dấu hoàn thành"}
          </button>
        )}
      </div>
    </div>
  );
}

function TasksTab({
  session,
  classId,
  onOpenLesson,
  onOpenWorksheet,
}: {
  session: AuthSession;
  classId: number;
  onOpenLesson: (lessonId: number) => void;
  onOpenWorksheet: (assignmentId: number) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["my-class-tasks", session.userId, classId],
    queryFn: () => getMyClassTasks(session, classId),
  });
  const [pdfTask, setPdfTask] = useState<MyClassTask | null>(null);
  const [error, setError] = useState("");
  const rows = data ?? [];
  const queryClient = useQueryClient();

  // Đánh dấu hoàn thành cũng là lần "nộp" của bài học/tài liệu, nên phải làm mới cả danh sách lớp
  // — hai ô tiến độ ở màn ngoài (bắt buộc và mức tự giác) đều đếm từ chính lần ghi nhận này.
  const markDone = useMutation({
    mutationFn: (assignmentId: number) => markAssignment(session, assignmentId, true),
    onSuccess: async () => {
      setError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-class-tasks", session.userId, classId] }),
        queryClient.invalidateQueries({ queryKey: ["my-class-log", session.userId, classId] }),
        queryClient.invalidateQueries({ queryKey: ["my-classes", session.userId] }),
      ]);
    },
    onError: (reason: unknown) => setError((reason as Error).message),
  });

  const open = (row: MyClassTask) => {
    if (row.worksheet_id) return onOpenWorksheet(row.id);
    if (row.document_id && row.document_file_url) {
      if (isPdfDocument({ fileUrl: row.document_file_url, docType: row.document_doc_type })) {
        setPdfTask(row);
        return;
      }
      openDocumentFile(session, row.document_file_url, row.document_title ?? row.title).catch((reason: unknown) =>
        setError((reason as Error).message),
      );
      return;
    }
    if (row.lesson_id) onOpenLesson(row.lesson_id);
  };

  if (isLoading) return <p className="text-sm text-on-surface-variant">Đang tải nhiệm vụ…</p>;
  if (!rows.length) return <p className="text-sm text-on-surface-variant">Lớp chưa giao nhiệm vụ nào.</p>;

  const required = rows.filter((row) => row.requirement === "BAT_BUOC");
  const optional = rows.filter((row) => row.requirement === "TU_CHON");

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-error">{error}</p>}
      {required.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-on-surface">Bắt buộc · có chấm điểm ({required.length})</h3>
          {required.map((row) => (
            <TaskRow
              key={row.id}
              row={row}
              onOpen={() => open(row)}
              onMarkDone={() => markDone.mutate(row.id)}
              marking={markDone.isPending && markDone.variables === row.id}
            />
          ))}
        </section>
      )}
      {optional.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-on-surface">Tự chọn · chỉ ghi nhận đã làm ({optional.length})</h3>
          {optional.map((row) => (
            <TaskRow
              key={row.id}
              row={row}
              onOpen={() => open(row)}
              onMarkDone={() => markDone.mutate(row.id)}
              marking={markDone.isPending && markDone.variables === row.id}
            />
          ))}
        </section>
      )}
      {pdfTask && pdfTask.document_id && pdfTask.document_file_url && (
        <PdfViewer
          session={session}
          documentId={pdfTask.document_id}
          title={pdfTask.document_title ?? pdfTask.title}
          fileUrl={pdfTask.document_file_url}
          onClose={() => setPdfTask(null)}
        />
      )}
    </div>
  );
}

const actionLabel: Record<string, string> = { SUBMITTED: "Em nộp bài", GRADED: "Giáo viên chấm", RETURNED: "Giáo viên trả bài" };

function LogTab({ session, classId }: { session: AuthSession; classId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["my-class-log", session.userId, classId],
    queryFn: () => getMyClassSubmissionLog(session, classId),
  });
  const rows = data ?? [];
  if (isLoading) return <p className="text-sm text-on-surface-variant">Đang tải nhật ký…</p>;
  if (!rows.length) return <p className="text-sm text-on-surface-variant">Chưa có hoạt động nộp bài nào của em trong lớp này.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.id} className="border border-outline-variant rounded-lg p-3 flex items-start gap-3">
          <span className="material-symbols-outlined text-primary shrink-0 text-[20px]">
            {row.action === "SUBMITTED" ? "upload_file" : row.action === "GRADED" ? "grading" : "task_alt"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-on-surface text-sm">{row.title}</p>
            <p className="text-xs text-on-surface-variant">
              {actionLabel[row.action] ?? row.action} · {new Date(row.created_at).toLocaleString("vi-VN")}
            </p>
            {row.note && <p className="text-sm text-on-surface-variant mt-1">{row.note}</p>}
          </div>
          {row.requirement === "BAT_BUOC" && row.score !== null && (
            <span className="text-sm font-bold text-primary data-tabular shrink-0">{row.score}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

type DetailTab = "sessions" | "curriculum" | "documents" | "tasks" | "log";

const detailTabs: Array<[DetailTab, string]> = [
  ["sessions", "Buổi học"],
  ["curriculum", "Chương trình học"],
  ["documents", "Tài liệu"],
  ["tasks", "Nhiệm vụ"],
  ["log", "Nhật ký của em"],
];

function ClassDetailView({
  session,
  row,
  onBack,
  onOpenLesson,
  onOpenWorksheet,
}: {
  session: AuthSession;
  row: MyClass;
  onBack: () => void;
  onOpenLesson: (lessonId: number) => void;
  onOpenWorksheet: (assignmentId: number) => void;
}) {
  const [tab, setTab] = useState<DetailTab>("sessions");
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="self-start inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Tất cả lớp của em
      </button>

      <header className="border border-outline-variant rounded-xl bg-surface-container-lowest p-4">
        <h1 className="text-lg font-bold text-on-surface">{row.name}</h1>
        <p className="text-xs text-on-surface-variant mt-1">
          Mã {row.code}
          {row.grade_name && ` · ${row.grade_name}`} · Giáo viên: {row.teacher_names ?? "chưa phân công"}
        </p>
        {row.description && <p className="text-sm text-on-surface-variant mt-2">{row.description}</p>}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="rounded-lg bg-surface-container p-3">
            <p className="text-xs font-semibold text-on-surface-variant">Bắt buộc · tính điểm</p>
            <p className="text-lg font-bold text-on-surface data-tabular">
              {row.required_submitted}/{row.required_total}
            </p>
            <p className="text-xs text-on-surface-variant">
              {row.required_avg_score === null ? "Chưa có điểm" : `Điểm trung bình ${row.required_avg_score}/10`}
            </p>
          </div>
          <div className="rounded-lg bg-surface-container p-3">
            <p className="text-xs font-semibold text-on-surface-variant">Tự chọn · mức tự giác</p>
            <p className="text-lg font-bold text-on-surface data-tabular">
              {row.optional_submitted}/{row.optional_total}
            </p>
            <p className="text-xs text-on-surface-variant">Không cộng vào điểm</p>
          </div>
        </div>
      </header>

      <div className="flex items-center gap-2 border-b border-outline-variant overflow-x-auto thin-scrollbar">
        {detailTabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`shrink-0 px-3 h-10 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === key ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "curriculum" && <CurriculumTab session={session} classId={row.id} />}
      {tab === "sessions" && <ClassSessionsTab session={session} classId={row.id}/>}
      {tab === "documents" && <><ClassMaterialsTab session={session} classId={row.id}/><DocumentsTab session={session} classId={row.id} /></>}
      {tab === "tasks" && (
        <TasksTab session={session} classId={row.id} onOpenLesson={onOpenLesson} onOpenWorksheet={onOpenWorksheet} />
      )}
      {tab === "log" && <LogTab session={session} classId={row.id} />}
    </div>
  );
}

/** Tab "Lớp của em": danh sách lớp em được thêm vào, mở ra là toàn bộ chi tiết lớp đó. */
export function MyClassesPage({ session, onOpenLesson, onOpenWorksheet }: MyClassesPageProps) {
  const { data, error, isLoading } = useQuery({
    queryKey: ["my-classes", session.userId],
    queryFn: () => getMyClasses(session),
  });
  const [openId, setOpenId] = useState<number | null>(null);
  const rows = data ?? [];
  const selected = rows.find((row) => row.id === openId) ?? null;

  if (error) {
    return <p className="text-sm text-error">Không tải được danh sách lớp: {(error as Error).message}</p>;
  }
  if (isLoading) {
    return <p className="text-sm text-on-surface-variant">Đang tải lớp của em…</p>;
  }
  if (selected) {
    return (
      <ClassDetailView
        session={session}
        row={selected}
        onBack={() => setOpenId(null)}
        onOpenLesson={onOpenLesson}
        onOpenWorksheet={onOpenWorksheet}
      />
    );
  }
  if (!rows.length) {
    return (
      <div className="border border-outline-variant rounded-xl bg-surface-container-lowest p-6 text-center">
        <span className="material-symbols-outlined text-[40px] text-on-surface-variant">school</span>
        <p className="font-semibold text-on-surface mt-2">Em chưa được thêm vào lớp nào</p>
        <p className="text-sm text-on-surface-variant mt-1">Khi giáo viên thêm em vào lớp, lớp sẽ hiện ở đây.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-on-surface-variant">Em đang học {rows.length} lớp.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((row) => (
          <ClassCard key={row.id} row={row} onOpen={() => setOpenId(row.id)} />
        ))}
      </div>
    </div>
  );
}
