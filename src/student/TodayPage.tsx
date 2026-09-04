import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCurrentProgramChapter,
  getMyAssignments,
  getMyCourses,
  getStudentProgress,
  type AuthSession,
  type Progress,
  type StudentAssignment,
  type StudentCourse,
} from "../api";
import { assignmentKind, dueDateLabel, flattenLessons, formatPercent, ngayDiHocLai } from "./format";

type TodayPageProps = {
  session: AuthSession;
  onOpenLesson: (lessonId: number) => void;
  onOpenWorksheet: (assignmentId: number) => void;
  onSeeAllAssignments: () => void;
};

function ContinueBanner({
  courses,
  progress,
  onOpenLesson,
}: {
  courses: StudentCourse[];
  progress: Progress[];
  onOpenLesson: (lessonId: number) => void;
}) {
  const flat = useMemo(() => flattenLessons(courses), [courses]);
  const continueLesson = useMemo(() => {
    const inProgress = flat.find(({ lesson }) => {
      const p = progress.find((item) => item.lessonId === lesson.id);
      return p?.openedAt && !p.completedAt;
    });
    if (inProgress) return inProgress;
    return flat.find(({ lesson }) => {
      const p = progress.find((item) => item.lessonId === lesson.id);
      return !p?.completedAt;
    });
  }, [flat, progress]);

  if (!continueLesson) {
    return (
      <section className="bg-surface-container-low border border-outline-variant rounded-xl p-5 flex items-center gap-4">
        <span className="material-symbols-outlined text-primary">lightbulb</span>
        <div>
          <h2 className="text-lg font-semibold">Chưa có bài đang học</h2>
          <p className="text-sm text-on-surface-variant">Mở khóa học đầu tiên được giao để bắt đầu.</p>
        </div>
      </section>
    );
  }

  const lessonProgress = progress.find((p) => p.lessonId === continueLesson.lesson.id);
  const percent = lessonProgress?.completionPercent ?? continueLesson.lesson.completionPercent;
  return (
    <section className="bg-surface-container-low border border-outline-variant rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
          <span className="material-symbols-outlined fill">assignment</span>
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Em đang làm dở bài {continueLesson.lesson.title}</h2>
          <p className="text-sm text-on-surface-variant">
            {continueLesson.course.name} · {continueLesson.chapter.title}
          </p>
          <div className="mt-2 w-48 h-1 rounded-full bg-surface-container-highest overflow-hidden">
            <div className="h-full bg-primary" style={{ width: formatPercent(percent) }} />
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onOpenLesson(continueLesson.lesson.id)}
        className="inline-flex h-11 items-center justify-center px-5 rounded-lg bg-primary text-on-primary text-sm font-medium hover:bg-on-primary-fixed-variant transition-colors"
      >
        Làm tiếp
      </button>
    </section>
  );
}

function AssignmentItem({
  assignment,
  onOpenLesson,
  onOpenWorksheet,
}: {
  assignment: StudentAssignment;
  onOpenLesson: (lessonId: number) => void;
  onOpenWorksheet: (assignmentId: number) => void;
}) {
  const due = dueDateLabel(assignment.dueAt);
  const kind = assignmentKind(assignment);
  const open = () => {
    if (kind === "worksheet") onOpenWorksheet(assignment.id);
    else if (assignment.lessonId) onOpenLesson(assignment.lessonId);
  };
  return (
    <button
      type="button"
      onClick={open}
      className="w-full text-left bg-surface-container-lowest border border-outline-variant rounded-xl p-5 transition-colors hover:border-primary/40"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {assignment.progressStatus === "COMPLETED" ? (
              <span className="inline-flex items-center px-2 py-1 rounded bg-secondary-container text-on-secondary-container font-medium">
                Hoàn thành
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-1 rounded bg-tertiary-container text-on-tertiary-container font-medium">
                {kind === "worksheet" ? "Bắt buộc" : "Luyện tập"}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 ${due.urgent ? "text-error" : "text-on-surface-variant"}`}>
              <span className="material-symbols-outlined text-[16px]">schedule</span>
              {due.text}
            </span>
          </div>
          <h3 className="text-base font-semibold text-on-surface">{assignment.title}</h3>
          <p className="text-sm text-on-surface-variant">
            {kind === "worksheet" ? assignment.worksheetName : `Bài học #${assignment.lessonId}`}
          </p>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">
          arrow_forward
        </span>
      </div>
    </button>
  );
}

function LatestScoreCard({ assignment }: { assignment: StudentAssignment }) {
  const firstProblem = assignment.items[0];
  return (
    <article className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
      <h4 className="font-semibold">{assignment.title}</h4>
      <div className="flex items-center justify-between mt-2 text-sm text-on-surface-variant">
        <span>{assignment.items.length} câu</span>
        <span
          className="text-base font-semibold"
          style={{ color: assignment.progressStatus === "COMPLETED" ? "var(--color-secondary)" : "var(--color-on-surface-variant)" }}
        >
          {assignment.score!=null?`${assignment.score}/${assignment.maxScore??10}`:"Chờ trả điểm"}
        </span>
      </div>
      {firstProblem?.statementLatex && (
        <p className="mt-2 text-sm text-on-surface">{firstProblem.publicCode}</p>
      )}
    </article>
  );
}

export function TodayPage({
  session,
  onOpenLesson,
  onOpenWorksheet,
  onSeeAllAssignments,
}: TodayPageProps) {
  const assignments = useQuery({
    queryKey: ["student-assignments", session.userId],
    queryFn: () => getMyAssignments(session),
  });
  const courses = useQuery({
    queryKey: ["student-courses", session.userId],
    queryFn: () => getMyCourses(session),
  });
  const progress = useQuery({
    queryKey: ["student-progress", session.userId],
    queryFn: () => getStudentProgress(session),
  });
  const firstCourse = courses.data?.[0];
  const currentChapter = useQuery({
    queryKey: ["current-program-chapter", firstCourse?.id],
    queryFn: () => getCurrentProgramChapter(session, firstCourse!.id),
    enabled: !!firstCourse,
  });

  const pending = (assignments.data ?? []).filter((item) => item.progressStatus !== "COMPLETED").slice(0, 3);
  const recent = (assignments.data ?? []).filter((item) => item.gradingStatus === "RETURNED" && item.score!=null).slice(0, 2);

  return (
    <div className="space-y-6">
      {courses.error && <ErrorBox message={(courses.error as Error).message} />}
      {assignments.error && <ErrorBox message={(assignments.error as Error).message} />}
      {currentChapter.data && (
        /* Ngày nghỉ phải nhìn ra ngay là ngày nghỉ. Vẫn tô màu "đang học" và vẫn chỉ vào Chương 5
           thì học sinh mở sách ra học mùng ba Tết — đúng cái mà bảng kỳ nghỉ sinh ra để chặn. */
        <section className={`rounded-xl border p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${currentChapter.data.onBreak ? "border-outline-variant bg-surface-container-lowest" : "border-primary/25 bg-primary-container"}`}>
          <div className={currentChapter.data.onBreak ? "text-on-surface" : "text-on-primary-container"}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em]">{currentChapter.data.onBreak ? "Đang nghỉ" : "Chương trình hiện tại"}</p>
            {currentChapter.data.onBreak ? (
              <>
                <h2 className="mt-1 text-xl font-bold">{currentChapter.data.breakReason ?? "Kỳ nghỉ"}</h2>
                <p className="mt-1 text-sm opacity-80">
                  {currentChapter.data.breakEndsOn && <>Học lại từ {ngayDiHocLai(currentChapter.data.breakEndsOn)}. </>}
                  {currentChapter.data.chapterTitle && <>Học tiếp Chương {currentChapter.data.chapterOrder}: {currentChapter.data.chapterTitle}.</>}
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-1 text-xl font-bold">Chương {currentChapter.data.chapterOrder}: {currentChapter.data.chapterTitle}</h2>
                <p className="mt-1 text-sm opacity-80">Tất cả học sinh học theo cùng lịch chương trình này.</p>
              </>
            )}
          </div>
          <button type="button" onClick={() => {
            const chapter = courses.data?.flatMap((course) => course.chapters).find((item) => item.id === currentChapter.data?.chapterId);
            const lesson = chapter?.lessons.find((item) => !item.locked) ?? chapter?.lessons[0];
            if (lesson) onOpenLesson(lesson.id);
          }} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50"
            disabled={!courses.data?.flatMap((course) => course.chapters).find((item) => item.id === currentChapter.data?.chapterId)?.lessons.length}>
            {currentChapter.data.onBreak ? "Xem trước bài" : "Vào chương đang học"}
          </button>
        </section>
      )}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">Tiến độ cá nhân</p>
        <ContinueBanner
        courses={courses.data ?? []}
        progress={progress.data ?? []}
        onOpenLesson={onOpenLesson}
        />
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Việc cần làm</h2>
            <button
              type="button"
              onClick={onSeeAllAssignments}
              className="text-sm font-medium text-primary hover:underline"
            >
              Xem tất cả
            </button>
          </header>
          {!pending.length ? (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 text-sm text-on-surface-variant">
              Tuyệt vời — em đã hoàn thành mọi nhiệm vụ được giao.
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((assignment) => (
                <AssignmentItem
                  key={assignment.id}
                  assignment={assignment}
                  onOpenLesson={onOpenLesson}
                  onOpenWorksheet={onOpenWorksheet}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-4">
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
            <h2 className="text-base font-semibold mb-3">Điểm mới trả</h2>
            {!recent.length ? (
              <p className="text-sm text-on-surface-variant">Chưa có bài chấm xong.</p>
            ) : (
              <ul className="space-y-3">
                {recent.map((assignment) => (
                  <li key={assignment.id}>
                    <LatestScoreCard assignment={assignment} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="bg-surface-container-low border border-outline-variant rounded-xl p-4 flex items-start gap-3">
            <span className="material-symbols-outlined text-primary">lightbulb</span>
            <p className="text-sm text-on-surface-variant">
              Có phiếu giấy trên tay? Nhập mã dưới mỗi câu vào ô tìm kiếm để xem gợi ý.
            </p>
          </section>
        </aside>
      </section>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-error-container text-on-error-container px-4 py-2 rounded-lg text-sm" role="alert">
      {message}
    </div>
  );
}
