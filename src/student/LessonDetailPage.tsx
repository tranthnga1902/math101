import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  getLessonDocumentQuestions,
  getLessonDocuments,
  getSharedTeacherResources,
  getMyAssignments,
  getMyCourses,
  markLessonProgress,
  openLessonDocumentFile,
  recordLessonDocumentStudy,
  submitLessonDocumentQuiz,
  type AuthSession,
  type LessonDocument,
  type LessonDocumentQuestion,
  type StudentCourse,
} from "../api";
import { assignmentGate, flattenLessons, formatPercent, lessonCompletion, lessonExercises } from "./format";
import { PdfViewer, isPdfDocument } from "../components/PdfViewer";
import { YoutubeVideoModal, youtubeThumbnailUrl } from "../components/YoutubeVideoModal";
import { LessonContentRenderer } from "../components/lesson-editor";
import { DocumentPreview } from "../components/DocumentPreview";

type LessonDetailPageProps = {
  session: AuthSession;
  lessonId: number;
  onBack: () => void;
  onOpenLesson: (lessonId: number) => void;
  /** Mở màn hình làm bài của một bài giao — cùng đường với trang Bài tập. */
  onOpenWorksheet: (assignmentId: number) => void;
};

type FlatLesson = ReturnType<typeof flattenLessons>[number];

function findLessonContext(courses: StudentCourse[], lessonId: number): FlatLesson | null {
  const flat = flattenLessons(courses);
  return flat.find(({ lesson }) => lesson.id === lessonId) ?? null;
}

function renderMathContent(html: string): string {
  return katex.renderToString(html, { throwOnError: false, displayMode: false });
}

export function LessonDetailPage({
  session,
  lessonId,
  onBack,
  onOpenLesson,
  onOpenWorksheet,
}: LessonDetailPageProps) {
  const coursesQuery = useQuery({
    queryKey: ["student-courses", session.userId],
    queryFn: () => getMyCourses(session),
  });
  // Cùng key với trang Bài tập để hai nơi dùng chung một bản dữ liệu.
  const assignmentsQuery = useQuery({
    queryKey: ["student-assignments", session.userId],
    queryFn: () => getMyAssignments(session),
  });
  const exerciseRef = useRef<HTMLElement>(null);
  const [highlightExercises, setHighlightExercises] = useState(false);
  const ctx = useMemo(() => findLessonContext(coursesQuery.data ?? [], lessonId), [coursesQuery.data, lessonId]);

  const docsQuery = useQuery({
    queryKey: ["lesson-documents", lessonId],
    queryFn: () => getLessonDocuments(session, lessonId),
    enabled: Boolean(ctx),
  });
  const teacherResources = useQuery({queryKey:["student-teacher-resources",lessonId],queryFn:()=>getSharedTeacherResources(session,lessonId),enabled:Boolean(ctx)});

  const [docQuestions, setDocQuestions] = useState<Record<number, LessonDocumentQuestion[]>>({});
  const [docAnswers, setDocAnswers] = useState<Record<number, Record<number, string>>>({});
  const [docQuizResult, setDocQuizResult] = useState<Record<number, string>>({});
  const [savingProgress, setSavingProgress] = useState(false);
  const [error, setError] = useState("");
  const [videoDoc, setVideoDoc] = useState<LessonDocument | null>(null);
  const [pdfDoc, setPdfDoc] = useState<LessonDocument | null>(null);

  useEffect(() => {
    if (!ctx) return;
    setDocQuestions({});
    setDocAnswers({});
    setDocQuizResult({});
  }, [ctx?.lesson.id]);

  useEffect(() => {
    if (!ctx) return;
    const docs = docsQuery.data ?? [];
    if (!docs.length) return;
    void Promise.all(
      docs.map(async (doc) => [doc.id, await getLessonDocumentQuestions(session, lessonId, doc.id)] as const),
    ).then((pairs) => setDocQuestions(Object.fromEntries(pairs)));
  }, [ctx, docsQuery.data, lessonId, session]);

  const markComplete = async () => {
    if (!ctx) return;
    setSavingProgress(true);
    setError("");
    try {
      await markLessonProgress(session, ctx.lesson.id, true);
      await coursesQuery.refetch();
      // Gợi ý chuyển sang bài tập, không khóa gì cả: học sinh vẫn làm bài lúc nào cũng được.
      if (exerciseRef.current) {
        exerciseRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        setHighlightExercises(true);
        window.setTimeout(() => setHighlightExercises(false), 2400);
      }
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSavingProgress(false);
    }
  };

  if (coursesQuery.error) {
    return (
      <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm">
        {(coursesQuery.error as Error).message}
      </div>
    );
  }
  if (!ctx) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 text-center">
        <h2 className="text-lg font-semibold">Không tìm thấy bài học</h2>
        <button type="button" onClick={onBack} className="mt-4 inline-flex h-10 px-4 rounded-lg bg-primary text-on-primary text-sm font-medium">
          Quay lại
        </button>
      </div>
    );
  }

  const { course, chapter, lesson } = ctx;
  const courseLessons = flattenLessons([course]);
  const completedInCourse = courseLessons.filter(({ lesson: row }) => row.completionPercent >= 100 || !!row.completedAt).length;
  const coursePercent = courseLessons.length ? Math.round((completedInCourse / courseLessons.length) * 100) : 0;
  const currentIndex = courseLessons.findIndex(({ lesson: row }) => row.id === lesson.id);
  const prev = currentIndex > 0 ? courseLessons[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < courseLessons.length - 1 ? courseLessons[currentIndex + 1] : null;
  const docs = docsQuery.data ?? [];
  const videoDocs = docs.filter((doc) => doc.docType === "VIDEO");
  const htmlLessonDocs = docs.filter((doc) => doc.docType === "HTML_LESSON_CONTENT");
  const learningDocs = docs.filter((doc) => doc.docType !== "VIDEO" && doc.docType !== "HTML_LESSON_CONTENT");
  const exercises = lessonExercises(lesson.id, assignmentsQuery.data ?? []);
  const completion = lessonCompletion(lesson, exercises);
  const hasQuiz = docs.some((doc) => (docQuestions[doc.id] ?? []).length > 0);
  const quizPassed = !hasQuiz || docs.every((doc) => {
    const qs = docQuestions[doc.id] ?? [];
    if (!qs.length) return true;
    return (docQuizResult[doc.id] ?? "").toLowerCase().includes("hoàn thành");
  });

  const openDocument = async (doc: LessonDocument) => {
    try {
      if (doc.docType === "VIDEO") {
        setVideoDoc(doc);
        await recordLessonDocumentStudy(session, lesson.id, doc.id, 30).catch(() => undefined);
        return;
      }
      // PDF xem ngay trong app; định dạng khác (docx…) vẫn đẩy sang tab mới như trước.
      if (isPdfDocument(doc)) setPdfDoc(doc);
      else await openLessonDocumentFile(session, lesson.id, doc);
      await recordLessonDocumentStudy(session, lesson.id, doc.id, 30).catch(() => undefined);
    } catch (reason) {
      setError((reason as Error).message);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {videoDoc && <YoutubeVideoModal title={videoDoc.title} url={videoDoc.fileUrl} onClose={() => setVideoDoc(null)} />}
      {pdfDoc && <PdfViewer session={session} lessonId={lesson.id} documentId={pdfDoc.id} title={pdfDoc.title}
        fileUrl={pdfDoc.fileUrl} initialPage={pdfDoc.startPage} onClose={() => setPdfDoc(null)} />}
      <article className="lg:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 space-y-6">
        <header className="border-b border-outline-variant pb-5">
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <span>{course.code}</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span>Chương {chapter.orderIndex}: {chapter.title}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mt-2">
            Bài {lesson.orderIndex}: {lesson.title}
          </h1>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">schedule</span>
              {lesson.worksheets.length > 0 ? `${lesson.worksheets.length} phiếu bài tập` : "Bài đọc"}
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">menu_book</span>
              {videoDocs.length ? `${videoDocs.length} video · ` : ""}{learningDocs.length} tài liệu đính kèm
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-on-surface-variant">
                {completion.done ? "Bài học đã xong"
                  : completion.theoryDone ? `Còn ${completion.required - completion.submittedRequired} bài tập bắt buộc`
                  : "Tiến độ bài học"}
              </span>
              <span className="text-xs font-medium text-primary">{formatPercent(lesson.completionPercent)}</span>
            </div>
          </div>
          <div className="mt-3 h-1 rounded-full bg-surface-container-highest overflow-hidden">
            <div className="h-full bg-secondary" style={{ width: formatPercent(lesson.completionPercent) }} />
          </div>
        </header>

        {error && (
          <div className="bg-error-container text-on-error-container px-4 py-2 rounded-lg text-sm">{error}</div>
        )}

        <section className="max-w-none text-on-surface">
          <LessonContentRenderer content={lesson.contentHtml} fallbackSummary={lesson.summary} />
        </section>

        {!!htmlLessonDocs.length && (
          <section className="rounded-xl border border-primary/30 bg-primary-container/20 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">html</span>
              <div>
                <h2 className="text-base font-semibold text-on-surface">Bài học tương tác HTML</h2>
                <p className="text-xs text-on-surface-variant">Nội dung bài học dạng trang web trực quan, có thể xem trực tiếp</p>
              </div>
            </div>
            <div className="space-y-3">
              {htmlLessonDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-xl border border-primary/20 bg-surface-container-lowest p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="min-w-0">
                    <span className="inline-block text-[10px] uppercase font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full mb-1">
                      Nội dung lý thuyết
                    </span>
                    <b className="block text-sm font-semibold">{doc.title}</b>
                    {doc.teacherNote && <p className="mt-1 text-xs text-on-surface-variant">{doc.teacherNote}</p>}
                    <small className="mt-1 block text-xs text-on-surface-variant">{doc.required ? "Bài học bắt buộc" : "Bài học tham khảo"}</small>
                  </div>
                  <button
                    type="button"
                    onClick={() => void openDocument(doc)}
                    className="inline-flex h-10 px-4 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 transition-colors shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[18px]">play_lesson</span>
                    Mở bài học HTML
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {!!videoDocs.length && (
          <section className="border-t border-outline-variant pt-6 space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">smart_display</span>
              Video bài học
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {videoDocs.map((doc) => (
                <article key={doc.id} className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
                  <button type="button" onClick={() => void openDocument(doc)} className="group relative flex aspect-video w-full items-center justify-center overflow-hidden bg-slate-900 text-white">
                    {youtubeThumbnailUrl(doc.fileUrl) && <img src={youtubeThumbnailUrl(doc.fileUrl)!} alt={`Ảnh video ${doc.title}`} className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105" />}
                    <span className="material-symbols-outlined relative z-10 text-[64px] drop-shadow-lg transition-transform group-hover:scale-110">play_circle</span>
                  </button>
                  <div className="p-4">
                    <b className="block text-sm">{doc.title}</b>
                    {doc.teacherNote && <p className="mt-1 text-xs text-on-surface-variant">{doc.teacherNote}</p>}
                    <small className="mt-2 block text-xs text-on-surface-variant">{doc.required ? "Video bắt buộc" : "Video tham khảo"}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {!!learningDocs.length && (
          <section className="border-t border-outline-variant pt-6 space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">auto_stories</span>
              Tài liệu học tập
            </h2>
            {learningDocs.map((doc, index) => {
              const qs = docQuestions[doc.id] ?? [];
              return (
                <article key={doc.id} className="border border-outline-variant rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start bg-surface-container-lowest hover:border-primary/40 transition-colors">
                  <DocumentPreview
                    fileUrl={doc.fileUrl}
                    thumbnailUrl={doc.thumbnailUrl}
                    title={doc.title}
                    docType={doc.docType}
                    pageNumber={doc.startPage || 1}
                    accessToken={session.accessToken}
                    variant="thumbnail"
                    className="w-24 h-32 sm:w-28 sm:h-36 cursor-pointer hover:opacity-95 shadow-sm"
                    onClick={() => void openDocument(doc)}
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <small className="text-xs text-on-surface-variant">
                      Bước {index + 1} · {doc.docType} · {doc.required ? "Bắt buộc" : "Tham khảo"}
                      {doc.startPage ? ` · Mở trang ${doc.startPage}` : ""}
                    </small>
                    <b
                      className="block text-sm text-on-surface hover:text-primary cursor-pointer transition-colors"
                      onClick={() => void openDocument(doc)}
                    >
                      {doc.title}
                    </b>
                    {doc.teacherNote && <p className="text-xs text-on-surface-variant">{doc.teacherNote}</p>}
                    {!!qs.length && (
                      <div className="mt-3 space-y-2">
                        {qs.map((question) => (
                          <fieldset key={question.id} className="border border-outline-variant rounded-lg p-3">
                            <legend className="text-xs font-semibold px-2">{question.displayOrder}. {question.questionText}</legend>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                              {(["A", "B", "C", "D"] as const).map((option) => {
                                const selected = (docAnswers[doc.id]?.[question.id] ?? "") === option;
                                const value = option === "A" ? question.optionA : option === "B" ? question.optionB : option === "C" ? question.optionC : question.optionD;
                                return (
                                  <label
                                    key={option}
                                    className={`flex items-center gap-2 text-xs px-2 py-1 rounded border cursor-pointer transition-colors ${
                                      selected ? "border-primary bg-primary-container/20" : "border-outline-variant hover:border-primary/40"
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`doc-${doc.id}-q-${question.id}`}
                                      checked={selected}
                                      onChange={() =>
                                        setDocAnswers((current) => ({
                                          ...current,
                                          [doc.id]: { ...(current[doc.id] ?? {}), [question.id]: option },
                                        }))
                                      }
                                    />
                                    <b>{option}.</b>
                                    <span>{value}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </fieldset>
                        ))}
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const result = await submitLessonDocumentQuiz(session, lesson.id, doc.id, docAnswers[doc.id] ?? {});
                                setDocQuizResult((current) => ({
                                  ...current,
                                  [doc.id]: result.status === "COMPLETED" ? `Đạt ${result.quizScore}% · Hoàn thành` : `${result.quizScore}% · Cần xem lại`,
                                }));
                              } catch (reason) {
                                setDocQuizResult((current) => ({ ...current, [doc.id]: (reason as Error).message }));
                              }
                            }}
                            className="inline-flex h-9 px-3 rounded-lg bg-primary text-on-primary text-xs font-medium"
                          >
                            Nộp kiểm tra nhanh
                          </button>
                          {docQuizResult[doc.id] && (
                            <small className="text-xs text-on-surface-variant">{docQuizResult[doc.id]}</small>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void openDocument(doc)}
                    className="inline-flex h-10 px-4 items-center justify-center rounded-lg border border-outline-variant text-sm font-medium hover:border-primary hover:text-primary transition-colors"
                  >
                    {doc.docType === "SGK" ? "Mở SGK" : "Xem tài liệu"}
                  </button>
                </article>
              );
            })}
          </section>
        )}

        {!!teacherResources.data?.length && (
          <section className="border-t border-outline-variant pt-6 space-y-3">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Bổ sung, không thuộc nội dung chuẩn</p><h2 className="mt-1 text-lg font-semibold">Từ giáo viên của em</h2></div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {teacherResources.data.map(resource=><article key={resource.id} className="rounded-xl border border-outline-variant bg-surface-container-low p-4"><p className="text-xs text-on-surface-variant">{resource.teacher_name} · {resource.class_name}</p><h3 className="mt-1 font-semibold">{resource.title}</h3>{resource.description&&<p className="mt-1 text-sm text-on-surface-variant">{resource.description}</p>}{resource.external_url&&<a className="mt-3 inline-flex text-sm font-medium text-primary hover:underline" href={resource.external_url} target="_blank" rel="noreferrer">Mở học liệu</a>}</article>)}
            </div>
          </section>
        )}

        {!!lesson.worksheets.length && (
          <section className="border-t border-outline-variant pt-6 space-y-3">
            <h2 className="text-lg font-semibold">Bài tập thực hành</h2>
            {lesson.worksheets.map((sheet) => (
              <article key={sheet.id} className="border border-outline-variant rounded-xl p-4 flex items-center justify-between">
                <div>
                  <b className="block text-sm">{sheet.name}</b>
                  <p className="text-xs text-on-surface-variant">In phiếu giấy, làm bài, sau đó quét QR để đối chiếu lời giải.</p>
                </div>
                <button type="button" onClick={() => window.print()} className="inline-flex h-9 px-3 rounded-lg border border-outline-variant text-xs font-medium">
                  In phiếu
                </button>
              </article>
            ))}
          </section>
        )}

        {!!exercises.length && (
          <section
            ref={exerciseRef}
            id="bai-tap-sau-bai-hoc"
            className={`border-t border-outline-variant pt-6 space-y-3 scroll-mt-24 rounded-xl transition-shadow duration-500 ${
              highlightExercises ? "ring-2 ring-primary ring-offset-4 ring-offset-surface-container-lowest" : ""
            }`}
          >
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">edit_note</span>
                Bài tập sau bài học
              </h2>
              {completion.required > 0 && (
                <span className="text-xs text-on-surface-variant">
                  Đã nộp {completion.submittedRequired}/{completion.required} bài bắt buộc
                </span>
              )}
            </div>
            {exercises.map((assignment) => {
              const gate = assignmentGate(assignment);
              const submitted = assignment.gradingStatus !== "NOT_SUBMITTED";
              return (
                <article key={assignment.id} className="border border-outline-variant rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <small className="text-xs text-on-surface-variant">
                      {assignment.requirement === "TU_CHON" ? "Tự chọn" : "Bắt buộc"}
                      {gate.canView && assignment.items.length ? ` · ${assignment.items.length} câu` : ""}
                      {` · ${gate.label}`}
                    </small>
                    <b className="block text-sm">{assignment.title || assignment.worksheetName}</b>
                    <p className={`text-xs ${gate.urgent ? "text-error" : "text-on-surface-variant"}`}>
                      {submitted ? "Đã nộp" : "Chưa nộp"} · {gate.note}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!gate.canView}
                    onClick={() => onOpenWorksheet(assignment.id)}
                    className="inline-flex h-10 px-4 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary text-on-primary text-sm font-medium disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">{submitted ? "visibility" : "play_arrow"}</span>
                    {!gate.canView ? "Chưa mở" : submitted ? "Xem lại" : "Bắt đầu làm bài"}
                  </button>
                </article>
              );
            })}
          </section>
        )}
        <footer className="border-t border-outline-variant pt-6 flex flex-col md:flex-row gap-3 justify-between">
          <div className="flex gap-2">
            <button type="button" onClick={onBack} className="inline-flex h-11 px-4 items-center gap-2 rounded-lg border border-outline-variant text-sm font-medium">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Quay lại
            </button>
            {prev && (
              <button
                type="button"
                onClick={() => onOpenLesson(prev.lesson.id)}
                className="inline-flex h-11 px-4 items-center gap-2 rounded-lg border border-outline-variant text-sm font-medium"
              >
                Bài {prev.lesson.orderIndex}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={savingProgress || lesson.completionPercent >= 100 || !!lesson.completedAt || (hasQuiz && !quizPassed)}
              onClick={() => void markComplete()}
              className="inline-flex h-11 px-5 items-center gap-2 rounded-lg bg-primary text-on-primary text-sm font-medium disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              {completion.theoryDone ? "Đã học xong lý thuyết" : "Hoàn thành lý thuyết"}
            </button>
            {next && (
              <button
                type="button"
                onClick={() => onOpenLesson(next.lesson.id)}
                className="inline-flex h-11 px-5 items-center gap-2 rounded-lg bg-primary text-on-primary text-sm font-medium hover:opacity-90"
              >
                Bài tiếp theo
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            )}
          </div>
        </footer>
      </article>

      <aside className="lg:col-span-4 space-y-4">
        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
          <h3 className="text-base font-semibold mb-3">Tiến độ khóa học</h3>
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>{completedInCourse}/{courseLessons.length} bài</span>
            <span className="text-primary font-medium">{coursePercent}%</span>
          </div>
          <div className="mt-2 h-1 rounded-full bg-surface-container-highest overflow-hidden">
            <div className="h-full bg-primary" style={{ width: formatPercent(coursePercent) }} />
          </div>
        </section>

        <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
          <h3 className="text-base font-semibold mb-3">Danh sách bài</h3>
          <ul className="space-y-1 thin-scrollbar max-h-96 overflow-y-auto">
            {courseLessons.map(({ lesson: row }) => {
              const active = row.id === lesson.id;
              const done = row.completionPercent >= 100 || !!row.completedAt;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    disabled={row.locked}
                    onClick={() => onOpenLesson(row.id)}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
                      active ? "bg-primary-container/30 text-primary font-semibold" : "hover:bg-surface-container-low"
                    } ${row.locked ? "opacity-50" : ""}`}
                  >
                    <span className={`material-symbols-outlined text-[16px] ${done ? "text-secondary" : "text-on-surface-variant"}`}>
                      {row.locked ? "lock" : done ? "check_circle" : "play_circle"}
                    </span>
                    Bài {row.orderIndex}: {row.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </aside>
    </div>
  );
}
