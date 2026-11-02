import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getMyCourses,
  getStudentProgress,
  getMyAssignments,
  getMyClasses,
  getHomNay,
  getClassSchedule,
  getStudentDocuments,
  type AuthSession,
  type StudentCourse,
  type StudentAssignment,
  type ClassScheduleRow,
  type MyClass,
} from "../api";
import { flattenLessons, formatPercent, dueDateLabel } from "./format";
import type { StudentTab } from "./StudentShell";
import { DocumentPreview } from "../components/DocumentPreview";

// ─── Types ─────────────────────────────────────────────────────────────────

type StudentHomePageProps = {
  session: AuthSession;
  onOpenLesson: (lessonId: number) => void;
  onOpenWorksheet: (assignmentId: number) => void;
  onSeeAllAssignments: () => void;
  onGoTab: (tab: StudentTab) => void;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Derive course status từ tiến độ bài học thật — không hardcode. */
function courseStatus(course: StudentCourse): "IN_PROGRESS" | "NOT_STARTED" | "COMPLETED" {
  const lessons = flattenLessons([course]);
  if (!lessons.length) return "NOT_STARTED";
  const completed = lessons.filter(({ lesson }) => lesson.completionPercent >= 100 || !!lesson.completedAt).length;
  if (completed === 0) return "NOT_STARTED";
  if (completed === lessons.length) return "COMPLETED";
  return "IN_PROGRESS";
}

/** Tính % tiến độ từ dữ liệu thật. */
function courseProgressPercent(course: StudentCourse): number {
  const lessons = flattenLessons([course]);
  if (!lessons.length) return 0;
  const completed = lessons.filter(({ lesson }) => lesson.completionPercent >= 100 || !!lesson.completedAt).length;
  return Math.round((completed / lessons.length) * 100);
}

/** Tìm chapter đang học gần nhất (chapter có lesson chưa done). */
function currentChapterOf(course: StudentCourse): StudentCourse["chapters"][number] | null {
  return course.chapters.find((ch) => ch.lessons.some((l) => l.completionPercent < 100 && !l.completedAt)) ?? null;
}

/** Tìm bài học tiếp theo cần làm (IN_PROGRESS trước, rồi chưa làm). */
function nextLessonOf(course: StudentCourse): StudentCourse["chapters"][number]["lessons"][number] | null {
  const flat = flattenLessons([course]);
  return (
    flat.find(({ lesson }) => lesson.openedAt && !lesson.completedAt && lesson.completionPercent < 100)?.lesson ??
    flat.find(({ lesson }) => !lesson.completedAt && lesson.completionPercent < 100 && !lesson.locked)?.lesson ??
    null
  );
}

/** Ngày hôm nay theo YYYY-MM-DD theo giờ Việt Nam (runtime, không hardcode). */
function todayVN(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Map sessionType → label hiển thị. */
function sessionTypeLabel(type: string): string {
  if (type === "ONLINE") return "Trực tuyến";
  if (type === "MAKEUP") return "Học bù";
  return "Trực tiếp";
}

/** Map sessionType → màu dot. */
function sessionTypeDot(type: string): string {
  if (type === "ONLINE") return "bg-blue-500";
  if (type === "MAKEUP") return "bg-amber-500";
  return "bg-green-500";
}

/** Sắp xếp nhiệm vụ: quá hạn → hôm nay → gần nhất. */
function sortedPendingTasks(assignments: StudentAssignment[]): StudentAssignment[] {
  const now = Date.now();
  return assignments
    .filter((a) => a.progressStatus !== "COMPLETED")
    .sort((a, b) => {
      const da = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const db = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      // Quá hạn lên trước
      if (da < now && db >= now) return -1;
      if (db < now && da >= now) return 1;
      return da - db;
    });
}

// ─── Quick actions config (static presentation, không phải nghiệp vụ) ───────
const QUICK_ACTIONS: Array<{ icon: string; label: string; tab: StudentTab; color: string }> = [
  { icon: "play_circle", label: "Tiếp tục học", tab: "lessons", color: "text-green-600 bg-green-50" },
  { icon: "assignment", label: "Bài tập", tab: "assignments", color: "text-blue-600 bg-blue-50" },
  { icon: "quiz", label: "Kiểm tra", tab: "assignments", color: "text-purple-600 bg-purple-50" },
  { icon: "description", label: "Thư viện", tab: "materials", color: "text-orange-600 bg-orange-50" },
  { icon: "calendar_month", label: "Lịch học", tab: "classes", color: "text-pink-600 bg-pink-50" },
  { icon: "monitoring", label: "Kết quả học tập", tab: "profile", color: "text-teal-600 bg-teal-50" },
];

// ─── Sub-components ─────────────────────────────────────────────────────────

/** Skeleton block tái sử dụng. */
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-container ${className ?? ""}`} />;
}

/** Hero banner — ảnh từ /hero-banner.png (public asset), text/button là code thật render phía trên ảnh. */
function HeroBanner({ onGoTab }: { onGoTab: (tab: StudentTab) => void }) {
  return (
    <div className="relative overflow-hidden rounded-2xl shadow-sm w-full" style={{ aspectRatio: "1024 / 400" }}>
      {/* Ảnh banner — object-fit:cover, không méo, responsive tự co theo container */}
      <img
        src="/hero-banner.png"
        alt="MATH10 — Kiến tạo hành trình học tập tốt hơn"
        className="absolute inset-0 w-full h-full object-cover object-center select-none"
        draggable={false}
      />

      {/* Overlay gradient mỏng bên trái để text đọc rõ hơn — không che ảnh */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-transparent pointer-events-none" />

      {/* HeroContent — text + button là code thật, render trên ảnh qua z-index */}
      <div className="absolute inset-0 flex items-end p-4 sm:p-5 md:p-6 z-10">
        <button
          type="button"
          onClick={() => onGoTab("lessons")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold shadow hover:opacity-90 transition-opacity"
        >
          Khám phá ngay
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}

/** Quick action icon bar — static config, action dùng router hiện tại. */
function QuickActions({ onGoTab }: { onGoTab: (tab: StudentTab) => void }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => onGoTab(action.tab)}
          className="flex flex-col items-center gap-2 p-3 rounded-xl border border-outline-variant bg-surface-container-lowest hover:border-primary/40 hover:bg-primary-container/10 transition-all duration-200 group"
        >
          <span className={`material-symbols-outlined text-[28px] p-2 rounded-xl ${action.color} transition-transform group-hover:scale-110`}>
            {action.icon}
          </span>
          <span className="text-xs font-medium text-on-surface-variant text-center leading-tight">{action.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Card khóa học — dữ liệu thật từ StudentCourse. */
function CourseCard({
  course,
  onOpenLesson,
}: {
  course: StudentCourse;
  onOpenLesson: (lessonId: number) => void;
}) {
  const percent = courseProgressPercent(course);
  const chapter = currentChapterOf(course);
  const nextLesson = nextLessonOf(course);

  return (
    <article className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col">
      {/* Thumbnail placeholder — màu sắc từ hash tên khóa học */}
      <div
        className="h-32 flex items-center justify-center relative"
        style={{ background: `hsl(${(course.id * 47) % 360} 40% 88%)` }}
      >
        <span className="material-symbols-outlined text-[48px] opacity-40" style={{ color: `hsl(${(course.id * 47) % 360} 50% 35%)` }}>
          calculate
        </span>
        {/* Progress badge */}
        <span className="absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full bg-white/80 text-primary">
          {percent}%
        </span>
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div>
          <p className="text-xs text-on-surface-variant">{course.code}</p>
          <h3 className="text-sm font-semibold text-on-surface line-clamp-2 min-h-[36px]">
            {chapter ? `${course.name} · ${chapter.title}` : course.name}
          </h3>
        </div>

        {/* Progress bar — tính từ dữ liệu thật */}
        <div>
          <div className="h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: formatPercent(percent) }}
            />
          </div>
          <p className="text-xs text-on-surface-variant mt-1">{formatPercent(percent)}</p>
        </div>

        <button
          type="button"
          disabled={!nextLesson}
          onClick={() => { if (nextLesson) onOpenLesson(nextLesson.id); }}
          className="mt-auto self-end w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-opacity"
          aria-label={nextLesson ? `Tiếp tục học ${nextLesson.title}` : "Đã hoàn thành"}
        >
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>
    </article>
  );
}

/** Skeleton cho course card. */
function CourseCardSkeleton() {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
      <Skeleton className="h-32 rounded-none" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
    </div>
  );
}

/** Khóa học của tôi — tabs derive từ dữ liệu thật. */
function MyCoursesSection({
  courses,
  loading,
  error,
  onOpenLesson,
  onGoTab,
}: {
  courses: StudentCourse[];
  loading: boolean;
  error: string;
  onOpenLesson: (lessonId: number) => void;
  onGoTab: (tab: StudentTab) => void;
}) {
  type CourseFilter = "IN_PROGRESS" | "NOT_STARTED" | "COMPLETED";
  const [filter, setFilter] = useState<CourseFilter>("IN_PROGRESS");

  // Phân nhóm từ dữ liệu thật — không hardcode số lượng
  const grouped = useMemo(() => {
    const inProgress: StudentCourse[] = [];
    const notStarted: StudentCourse[] = [];
    const completed: StudentCourse[] = [];
    for (const c of courses) {
      const st = courseStatus(c);
      if (st === "IN_PROGRESS") inProgress.push(c);
      else if (st === "NOT_STARTED") notStarted.push(c);
      else completed.push(c);
    }
    return { IN_PROGRESS: inProgress, NOT_STARTED: notStarted, COMPLETED: completed };
  }, [courses]);

  const visible = grouped[filter];

  const TABS: Array<{ key: CourseFilter; label: string }> = [
    { key: "IN_PROGRESS", label: `Đang học (${grouped.IN_PROGRESS.length})` },
    { key: "NOT_STARTED", label: `Chưa bắt đầu (${grouped.NOT_STARTED.length})` },
    { key: "COMPLETED", label: `Đã hoàn thành (${grouped.COMPLETED.length})` },
  ];

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">auto_stories</span>
          Khóa học của tôi
        </h2>
        <button
          type="button"
          onClick={() => onGoTab("lessons")}
          className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
        >
          Xem tất cả
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </header>

      {error && <ErrorBox message={error} />}

      {/* Tabs — count derive từ dữ liệu */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`shrink-0 px-3 h-8 rounded-lg text-sm font-medium transition-colors ${
              filter === tab.key
                ? "bg-primary text-on-primary"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <CourseCardSkeleton />
          <CourseCardSkeleton />
          <CourseCardSkeleton />
        </div>
      ) : !visible.length ? (
        <div className="bg-surface-container-lowest border border-dashed border-outline-variant rounded-xl p-8 text-center text-sm text-on-surface-variant">
          {filter === "IN_PROGRESS" && "Chưa có khóa học nào đang được học."}
          {filter === "NOT_STARTED" && "Không có khóa học nào chưa bắt đầu."}
          {filter === "COMPLETED" && "Chưa hoàn thành khóa học nào."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.slice(0, 3).map((course) => (
            <CourseCard key={course.id} course={course} onOpenLesson={onOpenLesson} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Calendar widget ─────────────────────────────────────────────────────────

/** Mini calendar — tháng dùng new Date() runtime. */
function CalendarWidget({
  schedule,
  loading,
  myClass,
}: {
  schedule: ClassScheduleRow[];
  loading: boolean;
  myClass: MyClass | null;
}) {
  // Runtime date — không hardcode
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() }; // 0-indexed month
  });

  const today = new Date();
  const todayStr = todayVN();

  // Tính ngày đầu tháng và số ngày trong tháng
  const firstDay = new Date(viewDate.year, viewDate.month, 1);
  const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate();
  // Thứ 2 là đầu tuần (CN=0 → đặt sang 6, T2=1 → 0)
  const startWeekday = (firstDay.getDay() + 6) % 7;

  // Các ngày có buổi học — derive từ dữ liệu thật
  const scheduledDates = useMemo(() => {
    const set = new Set<string>();
    for (const row of schedule) {
      if (row.status !== "CANCELLED") set.add(row.scheduledDate);
    }
    return set;
  }, [schedule]);

  // Buổi học hôm nay — derive từ dữ liệu thật
  const todaySessions = useMemo(
    () => schedule.filter((row) => row.scheduledDate === todayStr && row.status !== "CANCELLED"),
    [schedule, todayStr],
  );

  const prevMonth = () => {
    setViewDate((d) => {
      const m = d.month - 1;
      return m < 0 ? { year: d.year - 1, month: 11 } : { year: d.year, month: m };
    });
  };
  const nextMonth = () => {
    setViewDate((d) => {
      const m = d.month + 1;
      return m > 11 ? { year: d.year + 1, month: 0 } : { year: d.year, month: m };
    });
  };
  const goToday = () => setViewDate({ year: today.getFullYear(), month: today.getMonth() });

  // Label tháng — format runtime
  const monthLabel = new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(
    new Date(viewDate.year, viewDate.month, 1),
  );

  const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]; // static presentation

  return (
    <div className="space-y-3">
      {/* Header calendar */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold capitalize">{monthLabel}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="w-7 h-7 rounded-full hover:bg-surface-container flex items-center justify-center"
            aria-label="Tháng trước"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="w-7 h-7 rounded-full hover:bg-surface-container flex items-center justify-center"
            aria-label="Tháng sau"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
          <button
            type="button"
            onClick={goToday}
            className="text-xs font-medium px-2 h-7 rounded-lg border border-outline-variant hover:bg-surface-container ml-1"
          >
            Hôm nay
          </button>
        </div>
      </div>

      {/* Grid tuần */}
      <div className="grid grid-cols-7 text-center">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="text-[11px] font-semibold text-on-surface-variant py-1">
            {label}
          </div>
        ))}
        {/* Ô trống đầu tháng */}
        {Array.from({ length: startWeekday }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {/* Ngày trong tháng */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday =
            day === today.getDate() &&
            viewDate.month === today.getMonth() &&
            viewDate.year === today.getFullYear();
          const hasSession = scheduledDates.has(dateStr);

          return (
            <div key={day} className="flex flex-col items-center py-0.5">
              <span
                className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-medium transition-colors
                  ${isToday ? "bg-primary text-on-primary font-bold" : "text-on-surface hover:bg-surface-container"}`}
              >
                {day}
              </span>
              {/* Dot chỉ có nếu có buổi học thật */}
              {hasSession && (
                <span className={`w-1 h-1 rounded-full mt-0.5 ${isToday ? "bg-on-primary" : "bg-primary"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Buổi học hôm nay */}
      {loading ? (
        <div className="space-y-2 pt-2 border-t border-outline-variant">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : (
        <div className="space-y-2 pt-2 border-t border-outline-variant">
          {todaySessions.length === 0 ? (
            <p className="text-xs text-on-surface-variant">
              {myClass ? "Hôm nay chưa có lịch học." : "Chưa có lớp học nào."}
            </p>
          ) : (
            todaySessions.map((row) => (
              <div key={row.id} className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full shrink-0 ${sessionTypeDot(row.sessionType)}`} />
                <span className="font-medium text-on-surface truncate flex-1">
                  {row.sessionTitle ?? `Buổi ${row.seq}`}
                </span>
                <span className="text-on-surface-variant shrink-0">
                  ({sessionTypeLabel(row.sessionType)})
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Widget nhiệm vụ — dữ liệu thật từ getMyAssignments(). */
function TasksWidget({
  tasks,
  loading,
  error,
  onOpenWorksheet,
  onOpenLesson,
  onSeeAll,
}: {
  tasks: StudentAssignment[];
  loading: boolean;
  error: string;
  onOpenWorksheet: (id: number) => void;
  onOpenLesson: (id: number) => void;
  onSeeAll: () => void;
}) {
  const TOP = 3;
  const visible = tasks.slice(0, TOP);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Nhiệm vụ của tôi</h3>
        <button
          type="button"
          onClick={onSeeAll}
          className="text-xs text-primary font-medium hover:underline flex items-center gap-0.5"
        >
          Xem tất cả
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </button>
      </div>

      {error && <ErrorBox message={error} />}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      ) : !tasks.length ? (
        <p className="text-xs text-on-surface-variant py-2">Không có nhiệm vụ cần hoàn thành.</p>
      ) : (
        <div className="space-y-2">
          {visible.map((task) => {
            const due = dueDateLabel(task.dueAt); // dùng helper từ format.ts
            const open = () => {
              if (task.worksheetId) onOpenWorksheet(task.id);
              else if (task.lessonId) onOpenLesson(task.lessonId);
            };
            return (
              <button
                key={task.id}
                type="button"
                onClick={open}
                className="w-full text-left flex items-center gap-3 hover:bg-surface-container-low p-1.5 rounded-lg transition-colors group"
              >
                {/* Checkbox-style indicator */}
                <span className="w-4 h-4 rounded-full border-2 border-outline shrink-0 group-hover:border-primary transition-colors" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-on-surface truncate">{task.title}</p>
                </div>
                <span className={`text-xs shrink-0 font-medium ${due.urgent ? "text-error" : "text-on-surface-variant"}`}>
                  {due.text}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Widget tin tức — dùng getStudentDocuments() làm fallback vì chưa có endpoint riêng.
 * @note Backend chưa có announcement API. Hiển thị 2 tài liệu mới nhất được chia sẻ.
 *       Sẽ cập nhật lại khi có /student/announcements endpoint.
 */
function NewsWidget({ session }: { session: AuthSession }) {
  const { data, isLoading } = useQuery({
    queryKey: ["student-documents-news", session.userId],
    queryFn: () => getStudentDocuments(session),
    staleTime: 5 * 60 * 1000,
  });

  // Lấy 2 tài liệu mới nhất — sort theo createdAt desc (dữ liệu thật)
  const news = useMemo(
    () =>
      (data ?? [])
        .filter((doc) => doc.status === "PUBLISHED")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 2),
    [data],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-error">campaign</span>
          Tin tức
        </h3>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : !news.length ? (
        <p className="text-xs text-on-surface-variant">Chưa có thông báo mới.</p>
      ) : (
        <div className="space-y-3">
          {news.map((item) => (
            <div key={item.id} className="flex gap-3 items-start">
              <DocumentPreview
                fileUrl={item.fileUrl}
                thumbnailUrl={item.thumbnailUrl}
                title={item.title}
                docType={item.docType}
                accessToken={session.accessToken}
                variant="compact"
                className="w-14 h-18 shrink-0 shadow-xs"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-on-surface line-clamp-2">{item.title}</p>
                <p className="text-[11px] text-on-surface-variant mt-1">
                  {new Date(item.createdAt).toLocaleDateString("vi-VN")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Error box — reuse pattern từ TodayPage. */
function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-error-container text-on-error-container px-4 py-2 rounded-lg text-sm" role="alert">
      {message}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function StudentHomePage({
  session,
  onOpenLesson,
  onOpenWorksheet,
  onSeeAllAssignments,
  onGoTab,
}: StudentHomePageProps) {
  // ── Data fetching — tất cả dùng API thật, không mock ──────────────────────

  const coursesQuery = useQuery({
    queryKey: ["student-courses", session.userId],
    queryFn: () => getMyCourses(session),
    staleTime: 2 * 60 * 1000,
  });

  const progressQuery = useQuery({
    queryKey: ["student-progress", session.userId],
    queryFn: () => getStudentProgress(session),
    staleTime: 2 * 60 * 1000,
  });

  const assignmentsQuery = useQuery({
    queryKey: ["student-assignments", session.userId],
    queryFn: () => getMyAssignments(session),
    staleTime: 60 * 1000,
  });

  const classesQuery = useQuery({
    queryKey: ["student-my-classes", session.userId],
    queryFn: () => getMyClasses(session),
    staleTime: 5 * 60 * 1000,
  });

  const homNayQuery = useQuery({
    queryKey: ["student-hom-nay", session.userId],
    queryFn: () => getHomNay(session),
    staleTime: 60 * 1000,
  });

  // Lấy classId của lớp đầu tiên để load lịch học
  const primaryClass = classesQuery.data?.[0] ?? null;
  const scheduleQuery = useQuery({
    queryKey: ["student-class-schedule", primaryClass?.id],
    queryFn: () => getClassSchedule(session, primaryClass!.id),
    enabled: !!primaryClass,
    staleTime: 5 * 60 * 1000,
  });

  // ── Derived values — computed từ dữ liệu thật ─────────────────────────────

  const courses = coursesQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const schedule = scheduleQuery.data ?? [];

  // Nhiệm vụ pending, sắp xếp: quá hạn → hôm nay → gần nhất
  const pendingTasks = useMemo(() => sortedPendingTasks(assignments), [assignments]);

  // Tiến độ lớp từ API /student/hom-nay
  const tienDoLop = homNayQuery.data?.tienDoLop ?? null;

  // Error messages
  const coursesError = coursesQuery.isError ? (coursesQuery.error as Error).message : "";
  const assignmentsError = assignmentsQuery.isError ? (assignmentsQuery.error as Error).message : "";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Tiến độ lớp — từ /student/hom-nay (thật) */}
      {tienDoLop && (
        <div
          role="status"
          className={`rounded-xl border p-3 flex items-center justify-between gap-3 text-sm ${
            tienDoLop.trangThai === "BEHIND"
              ? "border-error/30 bg-error-container/20 text-error"
              : tienDoLop.trangThai === "AHEAD"
              ? "border-primary/30 bg-primary-container/20 text-primary"
              : "border-secondary/30 bg-secondary-container/10 text-secondary"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">
              {tienDoLop.trangThai === "BEHIND" ? "warning" : tienDoLop.trangThai === "AHEAD" ? "rocket_launch" : "check_circle"}
            </span>
            <span className="font-medium">
              Tiến độ lớp:{" "}
              {tienDoLop.trangThai === "BEHIND"
                ? `Chậm ${tienDoLop.lech} tiết so với kế hoạch`
                : tienDoLop.trangThai === "AHEAD"
                ? `Nhanh ${tienDoLop.lech} tiết so với kế hoạch`
                : "Đúng tiến độ"}
            </span>
          </div>
          <span className="text-xs opacity-70 shrink-0">
            Đã dạy: {tienDoLop.thucTe}/{tienDoLop.theoKeHoach} tiết
          </span>
        </div>
      )}

      {/* Layout 2 cột */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        {/* ── Cột trái ─────────────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Hero banner — static marketing, không phải nghiệp vụ */}
          <HeroBanner onGoTab={onGoTab} />

          {/* Quick actions — static config */}
          <QuickActions onGoTab={onGoTab} />

          {/* Khóa học của tôi — dữ liệu thật */}
          <MyCoursesSection
            courses={courses}
            loading={coursesQuery.isLoading || progressQuery.isLoading}
            error={coursesError}
            onOpenLesson={onOpenLesson}
            onGoTab={onGoTab}
          />
        </div>

        {/* ── Cột phải (sidebar) ───────────────────────────────────────────── */}
        <aside className="space-y-4">
          {/* Lịch học */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-primary">calendar_month</span>
                Lịch học
              </h3>
              <button
                type="button"
                onClick={() => onGoTab("classes")}
                className="text-xs text-primary font-medium hover:underline flex items-center gap-0.5"
              >
                Xem chi tiết
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
            {classesQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-44" />
                <Skeleton className="h-8" />
              </div>
            ) : (
              <CalendarWidget
                schedule={schedule}
                loading={scheduleQuery.isLoading}
                myClass={primaryClass}
              />
            )}
          </section>

          {/* Nhiệm vụ */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
            <TasksWidget
              tasks={pendingTasks}
              loading={assignmentsQuery.isLoading}
              error={assignmentsError}
              onOpenWorksheet={onOpenWorksheet}
              onOpenLesson={onOpenLesson}
              onSeeAll={onSeeAllAssignments}
            />
          </section>

          {/* Tin tức — fallback dùng student documents vì chưa có announcement API */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
            <NewsWidget session={session} />
          </section>
        </aside>
      </div>
    </div>
  );
}
