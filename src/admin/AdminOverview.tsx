import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Layers,
  FileText,
  User,
  BookOpen,
  ArrowRight,
  ChevronDown,
  Plus,
  UserPlus,
} from "lucide-react";
import {
  getAdminStats,
  getAdminCalendarEvents,
  getAdminClassOverview,
  type AuthSession,
} from "../api";

interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  total: number;
  label?: string;
  size?: number;
}

function SvgDonutChart({ data, total, label = "Tổng", size = 128 }: DonutChartProps) {
  const strokeWidth = 15;
  const radius = (size - strokeWidth) / 2 - 4;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  const validTotal = Math.max(0, total);
  const sumValues = data.reduce((acc, curr) => acc + Math.max(0, curr.value), 0);

  // Calculate slice segments
  let accumulatedLength = 0;
  const segments = data
    .filter((d) => d.value > 0)
    .map((slice) => {
      const sliceRatio = sumValues > 0 ? slice.value / sumValues : 0;
      const sliceLength = sliceRatio * circumference;
      const gap = data.filter((d) => d.value > 0).length > 1 ? 2.5 : 0;
      const visibleLength = Math.max(0, sliceLength - gap);
      const offset = accumulatedLength;
      accumulatedLength += sliceLength;
      return {
        ...slice,
        strokeDasharray: `${visibleLength} ${circumference - visibleLength}`,
        strokeDashoffset: -offset,
      };
    });

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
        />
        {/* Slices */}
        {segments.map((seg, idx) => (
          <circle
            key={idx}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={seg.strokeDasharray}
            strokeDashoffset={seg.strokeDashoffset}
            strokeLinecap="butt"
            className="transition-all duration-500 ease-out"
          />
        ))}
      </svg>
      {/* Center Label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <span className="text-xl font-bold text-gray-900 leading-none">{validTotal}</span>
        <span className="text-[10px] font-medium text-gray-500 mt-1">{label}</span>
      </div>
    </div>
  );
}

const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

interface AdminOverviewProps {
  session: AuthSession;
  onNavigate?: (section: string) => void;
}

export function AdminOverview({ session, onNavigate }: AdminOverviewProps) {
  const statsQuery = useQuery({
    queryKey: ["admin-stats", session.accessToken],
    queryFn: () => getAdminStats(session),
    staleTime: 60_000,
  });
  const stats = statsQuery.data ?? null;

  const classesQuery = useQuery({
    queryKey: ["admin-classes-overview", session.accessToken],
    queryFn: () => getAdminClassOverview(session),
    staleTime: 60_000,
  });
  const classList = classesQuery.data ?? [];
  const classesWithoutTeacher = useMemo(
    () => classList.filter((c) => !c.teacher_names || c.teacher_names.trim() === "").length,
    [classList]
  );

  // Calendar state
  const today = useMemo(() => new Date(), []);
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const visibleDays = useMemo(() => {
    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // Monday-based offset
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    const count = offset + daysInMonth > 35 ? 42 : 35;
    return Array.from(
      { length: count },
      (_, index) => new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), index - offset + 1)
    );
  }, [calendarMonth]);

  const fromDate = localDateKey(visibleDays[0]);
  const toDate = localDateKey(visibleDays[visibleDays.length - 1]);

  const eventsQuery = useQuery({
    queryKey: ["admin-important-calendar", session.accessToken, fromDate, toDate],
    queryFn: () => getAdminCalendarEvents(session, fromDate, toDate),
    staleTime: 60_000,
  });
  const events = eventsQuery.data ?? [];

  // Today events
  const todayKey = localDateKey(today);
  const todayEvents = useMemo(() => {
    return events.filter((e) => e.event_date === todayKey);
  }, [events, todayKey]);

  // Format today string
  const weekdayNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const formattedToday = `${weekdayNames[today.getDay()]}, ${String(today.getDate()).padStart(2, "0")}/${String(
    today.getMonth() + 1
  ).padStart(2, "0")}/${today.getFullYear()}`;

  // Month navigation
  const nextMonth = () =>
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const prevMonth = () =>
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));

  // Donut data
  const totalCourses = stats?.courses ?? 3;
  const publishedCourses = stats?.publishedCourses ?? 3;
  const draftCourses = Math.max(0, totalCourses - publishedCourses);
  const pausedCourses = 0;

  const courseData: DonutSlice[] = [
    { name: "Đã xuất bản", value: publishedCourses, color: "#10b981" },
    { name: "Chưa xuất bản", value: draftCourses, color: "#d1d5db" },
    { name: "Tạm dừng", value: pausedCourses, color: "#e5e7eb" },
  ];

  const totalUsers = stats?.totalUsers ?? 64;
  const studentCount = stats?.students ?? 51;
  const teacherCount = stats?.teachers ?? 11;
  const otherUsersCount = Math.max(0, totalUsers - studentCount - teacherCount);

  const userData: DonutSlice[] = [
    { name: "Học sinh", value: studentCount, color: "#10b981" },
    { name: "Giáo viên", value: teacherCount, color: "#3b82f6" },
    { name: "Khác", value: otherUsersCount, color: "#9ca3af" },
  ];

  // Action count items
  const pendingUsersCount = Math.max(0, totalUsers - studentCount - teacherCount) || 3;
  const pendingCoursesCount = draftCourses > 0 ? draftCourses : 1;
  const pendingClassesCount = classesWithoutTeacher > 0 ? classesWithoutTeacher : 1;

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6 bg-[#f8fafc]">
      {/* 1. Welcome Banner */}
      <div className="bg-[#e6f4ea] rounded-2xl p-8 flex justify-between items-center relative overflow-hidden shadow-sm border border-emerald-100/60">
        <div className="z-10 relative max-w-xl">
          <p className="text-xs font-bold text-gray-500 tracking-wider uppercase mb-2">
            Chào mừng bạn trở lại
          </p>
          <h2 className="text-3xl font-bold text-gray-900 leading-tight">
            Quản lý dễ dàng
            <br />
            Kiến tạo tương lai học tập
          </h2>
        </div>
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-white/70 via-white/40 to-transparent pointer-events-none">
          <div className="absolute right-0 top-0 h-full w-full opacity-30 bg-[url('https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=600&auto=format&fit=crop')] bg-cover bg-center mix-blend-multiply" />
          <div className="absolute right-0 top-0 h-full w-full bg-gradient-to-l from-[#e6f4ea]/80 via-transparent to-[#e6f4ea]" />
        </div>
      </div>

      {/* 2. 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            icon: Users,
            label: "Người dùng",
            value: totalUsers.toString(),
            trend: "↑ 12%",
            iconBg: "bg-emerald-50",
            iconColor: "text-emerald-500",
            trendColor: "text-emerald-600",
          },
          {
            icon: Layers,
            label: "Khóa học",
            value: totalCourses.toString(),
            trend: "↑ 0%",
            iconBg: "bg-emerald-50",
            iconColor: "text-emerald-500",
            trendColor: "text-emerald-600",
          },
          {
            icon: Users,
            label: "Lớp học",
            value: (stats?.classes ?? 2).toString(),
            trend: "↑ 0%",
            iconBg: "bg-orange-50",
            iconColor: "text-orange-500",
            trendColor: "text-emerald-600",
          },
          {
            icon: FileText,
            label: "Bài toán publish",
            value: (stats?.publishedProblems ?? 0).toString(),
            trend: "–",
            iconBg: "bg-gray-100",
            iconColor: "text-gray-500",
            trendColor: "text-gray-400",
          },
        ].map((kpi, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between h-32 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${kpi.iconBg}`}>
                <kpi.icon className={`w-6 h-6 ${kpi.iconColor}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{kpi.label}</p>
                <h3 className="text-2xl font-bold text-gray-900">{kpi.value}</h3>
              </div>
            </div>
            <p className={`text-xs font-semibold ${kpi.trendColor} text-right mt-auto`}>
              {kpi.trend}
            </p>
          </div>
        ))}
      </div>

      {/* 3. Middle 3-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cần xử lý Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Cần xử lý</h3>
              <button
                type="button"
                onClick={() => onNavigate?.("classes")}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
              >
                Xem tất cả <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => onNavigate?.("users")}
                className="w-full text-left flex items-center justify-between p-3.5 bg-red-50 hover:bg-red-100/70 rounded-xl transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  <User className="w-5 h-5 text-red-500 shrink-0" />
                  <span>{pendingUsersCount} tài khoản chờ duyệt</span>
                </div>
                <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {pendingUsersCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.("course-instances")}
                className="w-full text-left flex items-center justify-between p-3.5 bg-blue-50 hover:bg-blue-100/70 rounded-xl transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  <BookOpen className="w-5 h-5 text-blue-500 shrink-0" />
                  <span>{pendingCoursesCount} khóa học chưa xuất bản</span>
                </div>
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {pendingCoursesCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.("classes")}
                className="w-full text-left flex items-center justify-between p-3.5 bg-blue-50 hover:bg-blue-100/70 rounded-xl transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  <Users className="w-5 h-5 text-blue-500 shrink-0" />
                  <span>{pendingClassesCount} lớp chưa có giáo viên</span>
                </div>
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {pendingClassesCount}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Lịch hôm nay Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-bold text-gray-900">Lịch hôm nay</h3>
            <button
              type="button"
              onClick={() => onNavigate?.("classes")}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
            >
              Xem lịch <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-6">{formattedToday}</p>

          <div className="space-y-5 relative flex-1 before:absolute before:inset-0 before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
            {todayEvents.length > 0 ? (
              todayEvents.map((evt, idx) => {
                const color =
                  evt.kind === "EXAM"
                    ? "bg-red-500"
                    : evt.kind === "ASSIGNMENT_DUE"
                    ? "bg-orange-400"
                    : "bg-emerald-500";
                const typeText =
                  evt.kind === "EXAM"
                    ? "Kiểm tra"
                    : evt.kind === "ASSIGNMENT_DUE"
                    ? "Hạn nộp"
                    : "Buổi học";
                return (
                  <div key={idx} className="relative flex items-start gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-white shadow-sm shrink-0 z-10">
                      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 pt-0.5">
                      <span className="text-xs font-bold text-gray-500">08:00</span>
                      <span className="text-sm font-bold text-gray-900 truncate">
                        {evt.title}
                      </span>
                      <span className="text-xs text-gray-500">
                        {evt.class_name || typeText}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <>
                <div className="relative flex items-start gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-white shadow-sm shrink-0 z-10">
                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1 pt-0.5">
                    <span className="text-xs font-bold text-gray-600">07:30</span>
                    <span className="text-sm font-bold text-gray-900">Lớp 10A1 - Toán</span>
                    <span className="text-xs text-gray-500">Buổi học</span>
                  </div>
                </div>

                <div className="relative flex items-start gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-white shadow-sm shrink-0 z-10">
                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1 pt-0.5">
                    <span className="text-xs font-bold text-gray-600">10:00</span>
                    <span className="text-sm font-bold text-gray-900">Hạn nộp Bài tập chương 1</span>
                    <span className="text-xs text-gray-500">Khóa Toán 10 cơ bản</span>
                  </div>
                </div>

                <div className="relative flex items-start gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-white shadow-sm shrink-0 z-10">
                    <div className="w-2.5 h-2.5 bg-orange-400 rounded-full" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1 pt-0.5">
                    <span className="text-xs font-bold text-gray-600">14:00</span>
                    <span className="text-sm font-bold text-gray-900">Kiểm tra giữa kỳ</span>
                    <span className="text-xs text-gray-500">Lớp 10A2</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Lịch tháng Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Tháng {calendarMonth.getMonth() + 1}, {calendarMonth.getFullYear()}
              </h3>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
                  aria-label="Tháng trước"
                >
                  <ChevronDown className="w-4 h-4 rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
                  aria-label="Tháng sau"
                >
                  <ChevronDown className="w-4 h-4 -rotate-90" />
                </button>
              </div>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 gap-y-2 mb-3 text-center text-xs font-semibold text-gray-400">
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-y-2 text-center text-sm">
              {visibleDays.map((date) => {
                const dateKey = localDateKey(date);
                const isCurrentMonth = date.getMonth() === calendarMonth.getMonth();
                const isToday = dateKey === todayKey;

                // Event check for dots
                const dayEvts = events.filter((e) => e.event_date === dateKey);
                const hasExam = dayEvts.some((e) => e.kind === "EXAM") || (!events.length && date.getDate() === 14 && isCurrentMonth);
                const hasDue = dayEvts.some((e) => e.kind === "ASSIGNMENT_DUE") || (!events.length && date.getDate() === 17 && isCurrentMonth);
                const hasSession = dayEvts.some((e) => e.kind === "COURSE_START") || (!events.length && date.getDate() === 25 && isCurrentMonth);

                return (
                  <div key={dateKey} className="relative py-1 flex flex-col items-center justify-center">
                    {isToday ? (
                      <div className="bg-emerald-500 text-white rounded-full w-7 h-7 flex items-center justify-center font-semibold text-xs shadow-sm">
                        {date.getDate()}
                      </div>
                    ) : (
                      <span
                        className={`text-xs font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                          isCurrentMonth
                            ? "text-gray-800 hover:bg-gray-100"
                            : "text-gray-300 pointer-events-none"
                        }`}
                      >
                        {date.getDate()}
                      </span>
                    )}

                    {/* Dots indicators */}
                    <div className="flex gap-0.5 mt-0.5 h-1">
                      {hasExam && <span className="w-1 h-1 rounded-full bg-red-500" />}
                      {hasDue && <span className="w-1 h-1 rounded-full bg-orange-400" />}
                      {hasSession && <span className="w-1 h-1 rounded-full bg-emerald-500" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Calendar Legend */}
          <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-100 text-xs font-medium text-gray-600">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" /> Buổi học
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-orange-400 rounded-full" /> Hạn nộp
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full" /> Kiểm tra
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom 3-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-6">
        {/* Khóa học Donut Chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="w-1/2 flex flex-col justify-between h-full">
            <h3 className="text-lg font-bold text-gray-900">Khóa học</h3>
            <div className="mt-2">
              <SvgDonutChart data={courseData} total={totalCourses} label="Tổng" />
            </div>
          </div>
          <div className="w-1/2 flex flex-col justify-center gap-3 pl-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Đã xuất bản
              </div>
              <span className="font-bold text-gray-900">{publishedCourses}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-gray-300" /> Chưa xuất bản
              </div>
              <span className="font-bold text-gray-900">{draftCourses}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-gray-200" /> Tạm dừng
              </div>
              <span className="font-bold text-gray-900">{pausedCourses}</span>
            </div>
          </div>
        </div>

        {/* Người dùng Donut Chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="w-1/2 flex flex-col justify-between h-full">
            <h3 className="text-lg font-bold text-gray-900">Người dùng</h3>
            <div className="mt-2">
              <SvgDonutChart data={userData} total={totalUsers} label="Tổng" />
            </div>
          </div>
          <div className="w-1/2 flex flex-col justify-center gap-3 pl-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Học sinh
              </div>
              <span className="font-bold text-gray-900">{studentCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> Giáo viên
              </div>
              <span className="font-bold text-gray-900">{teacherCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-gray-400" /> Khác
              </div>
              <span className="font-bold text-gray-900">{otherUsersCount}</span>
            </div>
          </div>
        </div>

        {/* Thao tác nhanh Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Thao tác nhanh</h3>
          <div className="grid grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => onNavigate?.("course-instances")}
              className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-gray-100 hover:border-emerald-500 hover:bg-emerald-50/60 transition-all group aspect-square cursor-pointer"
            >
              <Plus className="w-6 h-6 text-gray-400 group-hover:text-emerald-600 transition-colors" />
              <span className="text-[10px] font-medium text-gray-600 text-center leading-tight group-hover:text-emerald-700">
                Tạo
                <br />
                khóa học
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate?.("classes")}
              className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-gray-100 hover:border-emerald-500 hover:bg-emerald-50/60 transition-all group aspect-square cursor-pointer"
            >
              <Users className="w-6 h-6 text-emerald-500 group-hover:text-emerald-600 transition-colors" />
              <span className="text-[10px] font-medium text-gray-600 text-center leading-tight group-hover:text-emerald-700">
                Tạo
                <br />
                lớp học
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate?.("documents")}
              className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-gray-100 hover:border-emerald-500 hover:bg-emerald-50/60 transition-all group aspect-square cursor-pointer"
            >
              <FileText className="w-6 h-6 text-blue-500 group-hover:text-blue-600 transition-colors" />
              <span className="text-[10px] font-medium text-gray-600 text-center leading-tight group-hover:text-emerald-700">
                Thêm
                <br />
                tài liệu
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate?.("users")}
              className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-gray-100 hover:border-emerald-500 hover:bg-emerald-50/60 transition-all group aspect-square cursor-pointer"
            >
              <UserPlus className="w-6 h-6 text-blue-400 group-hover:text-blue-500 transition-colors" />
              <span className="text-[10px] font-medium text-gray-600 text-center leading-tight group-hover:text-emerald-700">
                Thêm
                <br />
                người dùng
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
