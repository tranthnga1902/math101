import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getMyCourses,
  type AuthSession,
  type StudentCourse,
} from "../api";
import { flattenLessons, formatPercent } from "./format";

type LessonsPageProps = {
  session: AuthSession;
  onOpenLesson: (lessonId: number) => void;
};

function ChapterProgress({
  course,
  onOpenLesson,
}: {
  course: StudentCourse;
  onOpenLesson: (lessonId: number) => void;
}) {
  const lessons = useMemo(() => flattenLessons([course]), [course]);
  const completed = lessons.filter(({ lesson }) => lesson.completionPercent >= 100 || !!lesson.completedAt).length;
  const percent = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;

  return (
    <article className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 space-y-3">
      <header className="flex items-center justify-between">
        <div>
          <small className="text-xs text-on-surface-variant">{course.code}</small>
          <h3 className="text-base font-semibold">{course.name}</h3>
        </div>
        <span className="text-sm font-semibold text-primary">{percent}%</span>
      </header>
      <p className="text-sm text-on-surface-variant">{course.description}</p>
      <div className="h-1 rounded-full bg-surface-container-highest overflow-hidden">
        <div className="h-full bg-primary" style={{ width: formatPercent(percent) }} />
      </div>
      <p className="text-xs text-on-surface-variant">{lessons.length} bài · {course.chapters.length} chương</p>
    </article>
  );
}

export function LessonsPage({ session, onOpenLesson }: LessonsPageProps) {
  const { data, error } = useQuery({
    queryKey: ["student-courses", session.userId],
    queryFn: () => getMyCourses(session),
  });
  const courses = data ?? [];
  const [activeCourseId, setActiveCourseId] = useState<number | null>(courses[0]?.id ?? null);

  const activeCourse = courses.find((course) => course.id === activeCourseId) ?? courses[0];

  if (error) {
    return (
      <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm">
        {(error as Error).message}
      </div>
    );
  }
  if (!courses.length) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 text-center">
        <h2 className="text-lg font-semibold">Chưa có khóa học nào được giao</h2>
        <p className="text-sm text-on-surface-variant mt-2">
          Liên hệ giáo viên chủ nhiệm để được thêm vào lớp học.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
      <aside className="md:col-span-4 lg:col-span-3 space-y-2">
        <h2 className="text-base font-semibold mb-2">Mục lục</h2>
        {courses.map((course) => (
          <button
            key={course.id}
            type="button"
            onClick={() => setActiveCourseId(course.id)}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${
              activeCourse?.id === course.id
                ? "bg-primary-container/30 border-primary text-primary"
                : "bg-surface-container-lowest border-outline-variant hover:border-primary/40"
            }`}
          >
            <span className="block text-xs uppercase tracking-wide text-on-surface-variant">
              {course.code}
            </span>
            <b className="block mt-1 text-sm">{course.name}</b>
          </button>
        ))}
      </aside>

      <section className="md:col-span-8 lg:col-span-9 space-y-5">
        {activeCourse && <ChapterProgress course={activeCourse} onOpenLesson={onOpenLesson} />}
        {activeCourse && (
          <div className="space-y-3">
            {activeCourse.chapters.map((chapter) => (
              <details
                key={chapter.id}
                className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden"
                open
              >
                <summary className="cursor-pointer p-4 flex items-center justify-between">
                  <div>
                    <small className="text-xs text-on-surface-variant">Chương {chapter.orderIndex}</small>
                    <h3 className="text-base font-semibold">{chapter.title}</h3>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant group-open:rotate-180">
                    expand_more
                  </span>
                </summary>
                <ul className="divide-y divide-outline-variant/50">
                  {chapter.lessons.map((lesson) => {
                    const done = lesson.completionPercent >= 100 || !!lesson.completedAt;
                    return (
                      <li key={lesson.id}>
                        <button
                          type="button"
                          onClick={() => onOpenLesson(lesson.id)}
                          className="w-full text-left flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-container-low transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`material-symbols-outlined text-[18px] ${
                                lesson.locked
                                  ? "text-outline"
                                  : done
                                  ? "text-secondary"
                                  : "text-primary"
                              }`}
                            >
                              {lesson.locked ? "lock" : done ? "check_circle" : "play_circle"}
                            </span>
                            <div>
                              <b className="block text-sm">
                                Bài {lesson.orderIndex}: {lesson.title}
                              </b>
                              <small className="text-xs text-on-surface-variant">{lesson.summary}</small>
                            </div>
                          </div>
                          <span className="text-sm font-medium text-primary">{lesson.completionPercent}%</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}