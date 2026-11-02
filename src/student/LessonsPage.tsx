import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCurrentProgramChapter,
  getProgramChaptersByTime,
  getMyCourses,
  getMyAssignments,
  getStudentDocuments,
  openDocumentFile,
  type AuthSession,
  type StudentCourse,
} from "../api";
import { flattenLessons, formatVietnameseDate, dueDateLabel, ngayDiHocLai } from "./format";
import type { StudentTab } from "./StudentShell";
import {
  Search,
  Maximize,
  Minimize,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  PlayCircle,
  Circle,
  PlaySquare,
  FileText,
  Calendar,
  ArrowRight,
  Leaf,
  Lock,
  Layout,
  MoreVertical,
  BookOpen,
} from "lucide-react";

export type LessonsPageProps = {
  session: AuthSession;
  onOpenLesson: (lessonId: number) => void;
  onOpenChapter: (course: StudentCourse, chapterId: number) => void;
  onOpenWorksheet?: (assignmentId: number) => void;
  onGoTab?: (tab: StudentTab) => void;
};

const ProgressBar = ({ progress, color = "bg-green-500", className = "" }: { progress: number; color?: string; className?: string }) => (
  <div className={`h-1.5 w-full bg-slate-200 rounded-full overflow-hidden ${className}`}>
    <div className={`h-full ${color} rounded-full transition-all duration-300`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}></div>
  </div>
);

export function LessonsPage({
  session,
  onOpenLesson,
  onOpenChapter,
  onOpenWorksheet,
  onGoTab,
}: LessonsPageProps) {
  // ── 1. Dữ liệu khóa học & bài học ──────────────────────────────────────────
  const coursesQuery = useQuery({
    queryKey: ["student-courses", session.userId],
    queryFn: () => getMyCourses(session),
  });
  const courses = coursesQuery.data ?? [];
  const [activeCourseId, setActiveCourseId] = useState<number | null>(null);

  useEffect(() => {
    if (courses.length && activeCourseId === null) {
      setActiveCourseId(courses[0].id);
    }
  }, [courses, activeCourseId]);

  const activeCourse = courses.find((course) => course.id === activeCourseId) ?? courses[0];

  const currentProgramQuery = useQuery({
    queryKey: ["current-program-chapter", activeCourse?.id],
    queryFn: () => getCurrentProgramChapter(session, activeCourse!.id),
    enabled: !!activeCourse,
  });

  const timedChaptersQuery = useQuery({
    queryKey: ["program-chapters-by-time", activeCourse?.id],
    queryFn: () => getProgramChaptersByTime(session, activeCourse!.id),
    enabled: !!activeCourse,
  });

  // ── 2. Dữ liệu cột tiện ích phải ───────────────────────────────────────────
  const assignmentsQuery = useQuery({
    queryKey: ["student-assignments", session.userId],
    queryFn: () => getMyAssignments(session),
  });

  const documentsQuery = useQuery({
    queryKey: ["student-documents", session.userId],
    queryFn: () => getStudentDocuments(session),
  });

  // ── 3. State điều khiển & tìm kiếm ─────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState<"ALL" | "CURRENT" | "UPCOMING" | "PAST">("ALL");
  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<number>>(new Set());


  // ── 4. Xử lý tính toán tiến độ ─────────────────────────────────────────────
  const allLessons = useMemo(() => (activeCourse ? flattenLessons([activeCourse]) : []), [activeCourse]);
  const completedLessons = useMemo(
    () => allLessons.filter(({ lesson }) => lesson.completionPercent >= 100 || !!lesson.completedAt),
    [allLessons]
  );
  const coursePercent = allLessons.length ? Math.round((completedLessons.length / allLessons.length) * 100) : 0;

  // Tìm bài học tiếp theo (bài đang dở hoặc bài chưa xong đầu tiên)
  const nextTarget = useMemo(() => {
    if (!allLessons.length) return null;
    const inProgress = allLessons.find(({ lesson }) => lesson.openedAt && !lesson.completedAt && lesson.completionPercent < 100);
    if (inProgress) return inProgress;
    const notCompleted = allLessons.find(({ lesson }) => !lesson.completedAt && lesson.completionPercent < 100 && !lesson.locked);
    if (notCompleted) return notCompleted;
    return allLessons[0];
  }, [allLessons]);

  // Đóng/mở tất cả chương
  const expandAll = () => {
    if (!activeCourse) return;
    setExpandedChapterIds(new Set(activeCourse.chapters.map((c) => c.id)));
  };

  const collapseAll = () => {
    setExpandedChapterIds(new Set());
  };

  const toggleChapter = (chapterId: number) => {
    setExpandedChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  // Lọc chương theo thời gian & từ khóa tìm kiếm
  const timedChapterIds = useMemo(() => {
    if (timeFilter === "ALL") return null;
    return new Set(
      (timedChaptersQuery.data ?? [])
        .filter((row) => row.time_group === timeFilter)
        .map((row) => row.chapter_id)
    );
  }, [timedChaptersQuery.data, timeFilter]);

  const filteredChapters = useMemo(() => {
    if (!activeCourse) return [];
    let list = activeCourse.chapters;

    if (timedChapterIds !== null) {
      list = list.filter((ch) => timedChapterIds.has(ch.id));
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter((ch) => {
      const matchChapter = ch.title.toLowerCase().includes(q) || `chương ${ch.orderIndex}`.includes(q);
      const matchLesson = ch.lessons.some(
        (l) => l.title.toLowerCase().includes(q) || (l.summary && l.summary.toLowerCase().includes(q))
      );
      return matchChapter || matchLesson;
    });
  }, [activeCourse, timedChapterIds, searchQuery]);

  // ── 5. Xác định chương đang học & đưa phần đang học lên trước ───────────────
  const activeChapterId = useMemo(() => {
    if (currentProgramQuery.data?.chapterId) return currentProgramQuery.data.chapterId;
    if (nextTarget?.chapter.id) return nextTarget.chapter.id;
    return activeCourse?.chapters[0]?.id ?? null;
  }, [currentProgramQuery.data, nextTarget, activeCourse]);

  // Sắp xếp đưa chương đang học lên đầu tiên
  const orderedChapters = useMemo(() => {
    if (!activeChapterId) return filteredChapters;
    return [...filteredChapters].sort((a, b) => {
      if (a.id === activeChapterId) return -1;
      if (b.id === activeChapterId) return 1;
      return a.orderIndex - b.orderIndex;
    });
  }, [filteredChapters, activeChapterId]);

  // Mở mặc định chương đang học khi dữ liệu tải xong
  useEffect(() => {
    if (activeChapterId) {
      setExpandedChapterIds((prev) => new Set([...prev, activeChapterId]));
    }
  }, [activeChapterId]);

  // Tự động mở các chương khi có kết quả tìm kiếm
  useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedChapterIds(new Set(filteredChapters.map((c) => c.id)));
    }
  }, [searchQuery, filteredChapters]);

  // Danh sách nhiệm vụ chưa hoàn thành
  const pendingTasks = useMemo(() => {
    const list = assignmentsQuery.data ?? [];
    return list
      .filter((a) => a.progressStatus !== "COMPLETED")
      .slice(0, 4);
  }, [assignmentsQuery.data]);

  // Danh sách tài liệu gần đây (PDF/SGK)
  const recentDocs = useMemo(() => {
    const list = documentsQuery.data ?? [];
    return list.slice(0, 4);
  }, [documentsQuery.data]);

  const todayFormatted = useMemo(() => formatVietnameseDate(new Date()), []);

  // Xử lý trạng thái tải & lỗi
  if (coursesQuery.isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 rounded-lg w-1/3"></div>
        <div className="h-36 bg-slate-200 rounded-2xl w-full"></div>
        <div className="h-64 bg-slate-200 rounded-2xl w-full"></div>
      </div>
    );
  }

  if (coursesQuery.error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
        {(coursesQuery.error as Error).message}
      </div>
    );
  }

  if (!courses.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
        <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Chưa có chương trình học nào được phân bổ</h2>
        <p className="text-sm text-slate-500 mt-2">
          Vui lòng liên hệ giáo viên hoặc quản trị viên nhà trường để được xếp lớp học.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-8 items-start">
      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* CỘT CHÍNH (MAIN CONTENT)                                              */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-6 min-w-0">
        {/* Header trang & Ô tìm kiếm */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Chương trình học</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Học theo chương trình, từng bước chinh phục {activeCourse?.code?.toUpperCase() || "Toán 10"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {courses.length > 1 && (
              <select
                value={activeCourse?.id}
                onChange={(e) => setActiveCourseId(Number(e.target.value))}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:border-green-500"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm bài học, chương..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 shadow-xs transition-all"
              />
            </div>
          </div>
        </div>

        {/* Thông báo nghỉ học (nếu có kỳ nghỉ) */}
        {currentProgramQuery.data?.onBreak && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 text-sm flex items-start gap-3">
            <span className="text-xl">🏖️</span>
            <div>
              <p className="font-semibold">{currentProgramQuery.data.breakReason ?? "Kỳ nghỉ học"}</p>
              <p className="text-xs text-amber-800 mt-0.5">
                {currentProgramQuery.data.breakEndsOn && `Học lại từ ${ngayDiHocLai(currentProgramQuery.data.breakEndsOn)}, `}
                học tiếp Chương {currentProgramQuery.data.chapterOrder}: {currentProgramQuery.data.chapterTitle}
              </p>
            </div>
          </div>
        )}

        {/* Course Banner nổi bật */}
        {activeCourse && (
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5 min-w-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-green-500 to-green-700 rounded-2xl flex items-center justify-center text-white font-black text-xl sm:text-2xl shrink-0 shadow-md">
                {activeCourse.code || "M10"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">CHƯƠNG TRÌNH HỌC</p>
                <h2 className="text-base sm:text-lg font-bold text-slate-800 line-clamp-2 leading-snug">
                  {activeCourse.name}
                </h2>
                <p className="text-xs text-slate-500 mt-1 mb-2.5">
                  {allLessons.length} bài học · {activeCourse.chapters.length} chương
                </p>
                <div className="flex items-center gap-3 w-48 sm:w-64">
                  <ProgressBar progress={coursePercent} className="flex-1" />
                  <span className="text-xs font-bold text-green-700 shrink-0">{coursePercent}%</span>
                </div>
              </div>
            </div>

            <div className="w-full md:w-auto flex flex-col items-start md:items-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
              <button
                type="button"
                onClick={() => {
                  if (nextTarget) onOpenLesson(nextTarget.lesson.id);
                }}
                disabled={!nextTarget}
                className="w-full md:w-auto bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl flex items-center justify-center font-semibold text-sm shadow-sm transition-all hover:shadow-md cursor-pointer"
              >
                <PlaySquare className="w-4 h-4 mr-2 shrink-0" /> Tiếp tục học
              </button>
              {nextTarget && (
                <p className="text-xs text-slate-500 mt-1.5 self-center md:self-end">
                  Chương {nextTarget.chapter.orderIndex} — Bài {nextTarget.lesson.orderIndex}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Thanh điều khiển (Controls) & Bộ lọc thời gian */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="flex items-center px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Maximize className="w-3.5 h-3.5 mr-1.5 text-slate-500" /> Mở toàn bộ
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="flex items-center px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Minimize className="w-3.5 h-3.5 mr-1.5 text-slate-500" /> Thu gọn toàn bộ
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
            {(
              [
                ["ALL", "Toàn bộ"],
                ["CURRENT", "Đang học"],
                ["UPCOMING", "Sắp học"],
                ["PAST", "Đã học"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTimeFilter(key)}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  timeFilter === key
                    ? "bg-white text-green-700 font-semibold shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Card Bài học đang tiếp tục (Đang học lên trước) */}
        {nextTarget && (
          <div className="bg-gradient-to-r from-green-700 via-green-800 to-emerald-800 rounded-2xl p-5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center text-white shrink-0 shadow-inner">
                <PlayCircle className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 bg-green-500/30 text-green-200 border border-green-400/30 text-[10px] font-bold uppercase tracking-wider rounded-md flex items-center">
                    <span className="w-1.5 h-1.5 bg-green-300 rounded-full mr-1.5 animate-pulse"></span>
                    Đang học
                  </span>
                  <span className="text-xs text-green-100/80 truncate">
                    Chương {nextTarget.chapter.orderIndex}: {nextTarget.chapter.title}
                  </span>
                </div>
                <h3 className="font-bold text-base text-white truncate">
                  Bài {nextTarget.lesson.orderIndex}. {nextTarget.lesson.title}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenLesson(nextTarget.lesson.id)}
              className="bg-white hover:bg-green-50 text-green-800 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center shrink-0 transition-all shadow-sm cursor-pointer hover:shadow-md"
            >
              Vào học ngay <ArrowRight className="w-4 h-4 ml-1.5" />
            </button>
          </div>
        )}

        {/* Danh sách các Chương & Bài học */}
        <div className="space-y-3.5 pb-8">
          {!orderedChapters.length ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500 text-sm">
              Không tìm thấy chương hoặc bài học nào phù hợp với điều kiện tìm kiếm.
            </div>
          ) : (
            orderedChapters.map((chapter) => {
              const isOpen = expandedChapterIds.has(chapter.id);
              const isCurrentChapter = chapter.id === activeChapterId;
              const chapterLessons = chapter.lessons;
              const completedInChapter = chapterLessons.filter(
                (l) => l.completionPercent >= 100 || !!l.completedAt
              ).length;
              const chapterPercent = chapterLessons.length
                ? Math.round((completedInChapter / chapterLessons.length) * 100)
                : 0;

              return (
                <div
                  key={chapter.id}
                  className={`bg-white border rounded-2xl overflow-hidden transition-all ${
                    isCurrentChapter
                      ? "border-green-400 ring-2 ring-green-100 shadow-sm"
                      : "border-slate-200 shadow-2xs"
                  }`}
                >
                  {/* Chapter Header */}
                  <div
                    onClick={() => toggleChapter(chapter.id)}
                    className={`p-4.5 flex items-center justify-between cursor-pointer select-none transition-colors ${
                      isCurrentChapter
                        ? "bg-green-50/40 hover:bg-green-50/60"
                        : isOpen
                        ? "border-b border-slate-100 bg-slate-50/50"
                        : "hover:bg-slate-50"
                    } ${isOpen && isCurrentChapter ? "border-b border-green-100" : ""}`}
                  >
                    <div className="flex items-center flex-1 mr-4 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mr-3.5 shrink-0 ${
                          isCurrentChapter ? "bg-green-600 text-white shadow-xs" : "bg-green-100 text-green-700"
                        }`}
                      >
                        {chapter.orderIndex}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-base text-slate-800 truncate">{chapter.title}</h3>
                          {isCurrentChapter && (
                            <span className="px-2.5 py-0.5 bg-green-100 text-green-800 text-[11px] font-bold rounded-full flex items-center shrink-0 border border-green-200 shadow-2xs">
                              <span className="w-1.5 h-1.5 bg-green-600 rounded-full mr-1.5 animate-pulse"></span>
                              Chương đang học
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">Chương {chapter.orderIndex}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="hidden sm:flex flex-col items-end w-28">
                        <p className="text-xs font-medium text-slate-600 mb-1">
                          {completedInChapter}/{chapterLessons.length} bài
                        </p>
                        <ProgressBar progress={chapterPercent} />
                      </div>

                      <span
                        className={`text-xs sm:text-sm font-semibold w-12 text-right ${
                          chapterPercent === 100 ? "text-green-600" : "text-slate-400"
                        }`}
                      >
                        {chapterPercent}%
                      </span>

                      {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Chapter Content (Expanded) */}
                  {isOpen && (
                    <div className="p-2 sm:p-3 bg-white space-y-1">

                      {chapterLessons.map((lesson) => {
                        const done = lesson.completionPercent >= 100 || !!lesson.completedAt;
                        const isCurrentLesson = nextTarget?.lesson.id === lesson.id;
                        const hasWorksheet = !!lesson.summary?.toLowerCase().includes("bài tập") || !lesson.openedAt;

                        return (
                          <div
                            key={lesson.id}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl transition-all gap-3 group ${
                              isCurrentLesson
                                ? "bg-green-50/70 border border-green-200/80 shadow-2xs"
                                : "hover:bg-slate-50/80"
                            }`}
                          >
                            <div className="flex items-start sm:items-center flex-1 min-w-0">
                              {/* Trạng thái Icon */}
                              {lesson.locked ? (
                                <Lock className="w-5 h-5 text-slate-300 mr-3.5 shrink-0 mt-0.5 sm:mt-0" />
                              ) : done ? (
                                <CheckCircle2
                                  className="w-5 h-5 text-green-500 mr-3.5 shrink-0 mt-0.5 sm:mt-0"
                                  fill="currentColor"
                                  stroke="white"
                                />
                              ) : isCurrentLesson ? (
                                <PlayCircle
                                  className="w-5 h-5 text-green-600 mr-3.5 shrink-0 mt-0.5 sm:mt-0"
                                  fill="currentColor"
                                  stroke="white"
                                />
                              ) : (
                                <Circle className="w-5 h-5 text-slate-300 mr-3.5 shrink-0 mt-0.5 sm:mt-0" />
                              )}

                              <FileText className="w-4 h-4 text-slate-400 mr-3 shrink-0 hidden md:block" />

                              <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-semibold text-slate-800 group-hover:text-green-700 transition-colors">
                                  Bài {lesson.orderIndex}. {lesson.title}
                                </h4>
                                {lesson.summary && (
                                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{lesson.summary}</p>
                                )}
                              </div>
                            </div>

                            {/* Badge & Nút Hành Động */}
                            <div className="flex items-center justify-end gap-2.5 shrink-0 pl-8 sm:pl-0">
                              {done ? (
                                <>
                                  <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-lg flex items-center">
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Đã học
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onOpenLesson(lesson.id)}
                                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 text-slate-700 flex items-center transition-colors shadow-2xs"
                                  >
                                    <Layout className="w-3.5 h-3.5 mr-1" /> Xem lại
                                  </button>
                                </>
                              ) : isCurrentLesson ? (
                                <>
                                  <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-lg flex items-center">
                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>{" "}
                                    Đang học
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onOpenLesson(lesson.id)}
                                    className="px-3.5 py-1.5 bg-green-700 text-white rounded-lg text-xs font-semibold hover:bg-green-800 flex items-center transition-colors shadow-2xs"
                                  >
                                    Tiếp tục <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                  </button>
                                </>
                              ) : hasWorksheet ? (
                                <>
                                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg flex items-center">
                                    <FileText className="w-3 h-3 mr-1" /> Có bài tập
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onOpenLesson(lesson.id)}
                                    className="px-3.5 py-1.5 border border-blue-600 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-50 flex items-center transition-colors shadow-2xs"
                                  >
                                    Làm bài <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  disabled={lesson.locked}
                                  onClick={() => onOpenLesson(lesson.id)}
                                  className="px-3.5 py-1.5 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 disabled:opacity-40 flex items-center transition-colors shadow-2xs"
                                >
                                  Bắt đầu học <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => onOpenLesson(lesson.id)}
                                title="Tùy chọn bài học"
                                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Link xem chi tiết chương */}
                      <div className="pt-2 pb-1 px-3 flex justify-end border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => onOpenChapter(activeCourse, chapter.id)}
                          className="text-xs font-semibold text-green-700 hover:text-green-800 hover:underline flex items-center gap-1"
                        >
                          Xem chi tiết chương {chapter.orderIndex} <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* CỘT PHỤ (RIGHT SIDEBAR WIDGETS)                                       */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <aside className="w-full space-y-6">
        {/* Date Widget */}
        <div className="bg-green-50/80 border border-green-200/60 rounded-2xl p-4.5 flex items-start shadow-2xs">
          <div className="p-2.5 bg-green-100/80 text-green-700 rounded-xl mr-3.5 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">{todayFormatted}</h3>
            <p className="text-xs text-slate-600 mt-0.5">Học hôm nay, tiến bộ mỗi ngày!</p>
          </div>
        </div>

        {/* Tasks Widget (Bài tập cần làm) */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-sm text-slate-800">Bài tập cần làm</h3>
            <button
              type="button"
              onClick={() => onGoTab?.("assignments")}
              className="text-green-700 text-xs font-semibold hover:underline flex items-center"
            >
              Xem tất cả <ArrowRight className="w-3 h-3 ml-1" />
            </button>
          </div>

          {!pendingTasks.length ? (
            <p className="text-xs text-slate-500 py-3 text-center">
              🎉 Tuyệt vời! Em đã hoàn thành tất cả bài tập được giao.
            </p>
          ) : (
            <div className="space-y-3.5">
              {pendingTasks.map((task, idx) => {
                const colorTone = idx === 0 ? "bg-red-50 text-red-500" : idx === 1 ? "bg-amber-50 text-amber-500" : "bg-blue-50 text-blue-500";
                return (
                  <div
                    key={task.id}
                    onClick={() => {
                      if (task.worksheetId && onOpenWorksheet) onOpenWorksheet(task.id);
                      else if (task.lessonId) onOpenLesson(task.lessonId);
                      else onGoTab?.("assignments");
                    }}
                    className="flex items-start cursor-pointer hover:bg-slate-50 p-1.5 rounded-xl transition-colors group"
                  >
                    <div className={`p-2 rounded-xl mr-3 shrink-0 ${colorTone}`}>
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-slate-800 truncate group-hover:text-green-700 transition-colors">
                        {task.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {dueDateLabel(task.dueAt).text}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-semibold rounded-md shrink-0 ml-2">
                      Chưa làm
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Documents Widget (Tài liệu gần đây) */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-sm text-slate-800">Tài liệu gần đây</h3>
            <button
              type="button"
              onClick={() => onGoTab?.("materials")}
              className="text-green-700 text-xs font-semibold hover:underline flex items-center"
            >
              Xem tất cả <ArrowRight className="w-3 h-3 ml-1" />
            </button>
          </div>

          {!recentDocs.length ? (
            <p className="text-xs text-slate-500 py-3 text-center">Chưa có tài liệu học tập mới.</p>
          ) : (
            <div className="space-y-3.5">
              {recentDocs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => {
                    if (doc.fileUrl) {
                      void openDocumentFile(session, doc.fileUrl, doc.title);
                    } else {
                      onGoTab?.("materials");
                    }
                  }}
                  className="flex items-start cursor-pointer hover:bg-slate-50 p-1.5 rounded-xl transition-colors group"
                >
                  <div className="w-8 h-8 bg-red-600 rounded-lg mr-3 shrink-0 flex items-center justify-center shadow-2xs">
                    <span className="text-white text-[10px] font-bold">PDF</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-slate-800 truncate group-hover:text-green-700 transition-colors">
                      {doc.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {doc.docType === "SGK" ? "Sách giáo khoa" : "Tài liệu PDF"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Motivational Banner */}
        <div className="relative bg-gradient-to-br from-green-50 via-green-100/50 to-emerald-100 rounded-2xl p-5 overflow-hidden border border-green-200/80 shadow-2xs">
          <div className="absolute -bottom-6 -right-6 opacity-20 transform scale-125 pointer-events-none">
            <svg width="120" height="120" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
              <path
                fill="#16a34a"
                d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,81.1,-46.3C90.4,-33.5,96,-18,94.9,-2.8C93.8,12.3,86,27.1,76.5,40.4C67,53.7,55.8,65.5,42.5,73.1C29.2,80.7,13.8,84.1,-1.5,86.6C-16.8,89.1,-32.1,90.7,-45.5,84.1C-58.9,77.5,-70.4,62.7,-78.9,47C-87.4,31.3,-92.9,14.7,-91.3,-1.2C-89.7,-17.1,-81,-32.3,-71.4,-45.7C-61.8,-59.1,-51.3,-70.7,-38,-78.5C-24.7,-86.3,-9.6,-90.3,3.2,-95.8C16,-101.3,30.6,-83.6,44.7,-76.4Z"
                transform="translate(100 100)"
              />
            </svg>
          </div>
          <div className="relative z-10 flex flex-col items-center text-center py-2">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-2.5">
              <Leaf className="w-5 h-5 text-green-700" />
            </div>
            <p className="text-sm font-bold text-green-900 leading-snug">
              Kiên trì hôm nay,
              <br />
              kiến thức vững chắc ngày mai!
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

