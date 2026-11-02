import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Play, Clock, Calendar, CalendarDays, Users, FileText, BarChart2, 
  BookOpen, User, Settings, ChevronDown, ChevronRight, FileEdit, 
  LayoutGrid, CheckCircle, AlertCircle 
} from "lucide-react";
import {
  completeClassSession, postponeClassSession,
  type AuthSession, type ClassScheduleProgress,
  type ClassScheduleRow, type ClassWeeklySlot, type Classroom, type Enrollment,
} from "../../api";

// ─── Helpers (exported — dùng bởi ClassDetailTabs và ClassSessionDetail) ─────────

export const dateVi = (value?: string | null) =>
  value ? new Intl.DateTimeFormat("vi-VN").format(new Date(`${value}T00:00:00`)) : "—";

export const timeVi = (value?: string | null) => value?.slice(0, 5) || "—";

export const dayLabel = (day: number) => (day === 7 ? "Chủ nhật" : `Thứ ${day + 1}`);

export const periodLabel = (row: ClassScheduleRow) =>
  row.periodFrom == null ? null
    : row.periodFrom === row.periodTo ? `Tiết ${row.periodFrom}`
    : `Tiết ${row.periodFrom}–${row.periodTo}`;

export const sessionTitle = (row: ClassScheduleRow) => row.sessionTitle?.trim() || null;

export function findCurrent(schedule: ClassScheduleRow[]) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  schedule = [...schedule].sort((a, b) => a.seq - b.seq || a.scheduledDate.localeCompare(b.scheduledDate));
  return (
    schedule.find(x => x.status !== "COMPLETED" && x.status !== "CANCELLED" && x.scheduledDate <= today)
    ?? schedule.find(x => x.status === "PLANNED" && x.scheduledDate > today)
    ?? null
  );
}

const SESSION_STATUS_LABEL: Record<ClassScheduleRow["status"], string> = {
  PLANNED: "Sắp học", COMPLETED: "Đã học", POSTPONED: "Hoãn", CANCELLED: "Hủy",
};

function progressLabel(p?: ClassScheduleProgress) {
  if (!p) return "Chưa có dữ liệu";
  if (p.lech === 0) return "Đúng tiến độ";
  if (p.lech < 0) return `Chậm ${Math.abs(p.lech)} buổi`;
  return `Nhanh ${p.lech} buổi`;
}

// ─── ClassSummary — Header Card + 3 Stats Card chuẩn Mockup ──────────────────

const CLASS_STATUS_NAMES: Record<string, string> = {
  ACTIVE: "Đang học",
  INACTIVE: "Tạm dừng",
  COMPLETED: "Đã hoàn thành",
  ARCHIVED: "Lưu trữ",
  LOCKED: "Đã khóa",
};

export function ClassSummary({
  classroom,
  course,
  slots,
  progress,
  studentCount = 0,
  teacherName = "Chưa phân công",
  gradeName,
  schoolYear,
}: {
  classroom: Classroom;
  course?: Enrollment;
  slots: ClassWeeklySlot[];
  progress?: ClassScheduleProgress;
  studentCount?: number;
  teacherName?: string;
  gradeName?: string;
  schoolYear?: string;
}) {
  const totalSessions = progress?.tongBuoi ?? 0;
  const doneSessions = progress?.thucTe ?? 0;
  const pct = totalSessions > 0 ? Math.round((doneSessions / totalSessions) * 100) : 0;
  
  // Format lịch học trong tuần
  const weeklyDays = slots.length > 0 
    ? [...new Set(slots.map(s => dayLabel(s.dayOfWeek)))].join(", ")
    : "Chưa có lịch";
  
  const sampleSlot = slots[0];
  const weeklyTime = sampleSlot 
    ? `${timeVi(sampleSlot.startTime)} • Mỗi buổi ${sampleSlot.durationMin || (sampleSlot.periods ? sampleSlot.periods * 45 : 90)} phút`
    : "Chưa thiết lập giờ";

  const initials = classroom.name.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase() || "L1";
  const displayGrade = gradeName || `Khối ${classroom.gradeId}`;
  const displayYear = schoolYear || (classroom.startDate ? `Năm học ${new Date(classroom.startDate).getFullYear()} - ${new Date(classroom.startDate).getFullYear() + 1}` : "Năm học 2026 - 2027");

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-xs flex flex-col gap-2.5">
      {/* Upper Row: Identity & Schedule */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-gray-900 leading-tight truncate">{classroom.name}</h1>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                {CLASS_STATUS_NAMES[String(classroom.status)] || classroom.status}
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
                {classroom.code}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>{displayGrade}</span>
              <span className="text-gray-300">•</span>
              <span className="truncate max-w-xs">{course?.label || "Chương trình chưa gán"}</span>
              <span className="text-gray-300">•</span>
              <span>GV: <strong className="font-semibold text-gray-700">{teacherName}</strong></span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 text-xs text-gray-600 shrink-0 bg-gray-50/80 px-2.5 py-1.5 rounded-lg border border-gray-100 self-start lg:self-auto">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-medium text-gray-800">{weeklyDays}</span>
              <span className="text-gray-400 ml-1">({weeklyTime.split("•")[0]?.trim() || "Chưa có giờ"})</span>
            </div>
          </div>
          <div className="w-px h-3.5 bg-gray-200" />
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <div>
              <span className="text-gray-400">KG: </span>
              <span className="font-medium text-gray-800">
                {classroom.startDate ? dateVi(classroom.startDate) : "Chưa đặt"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Lower Row: 3 Compact KPI Chips/Bars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-gray-100">
        {/* Stat 1: Học sinh */}
        <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-gray-50/70 border border-gray-100/80">
          <div className="w-7 h-7 rounded-md bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0">
            <Users className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10.5px] text-gray-500 block leading-none">Học sinh</span>
            <span className="text-sm font-bold text-gray-900 leading-tight">
              {studentCount} <small className="text-[10px] font-normal text-gray-400">em</small>
            </span>
          </div>
        </div>

        {/* Stat 2: Buổi đã học */}
        <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-gray-50/70 border border-gray-100/80">
          <div className="w-7 h-7 rounded-md bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center leading-none mb-1">
              <span className="text-[10.5px] text-gray-500">Buổi đã học</span>
              <span className="text-[11px] font-semibold text-emerald-600">{pct}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-900 leading-none shrink-0">
                {doneSessions}/{totalSessions || "—"}
              </span>
              <div className="flex-1 bg-gray-200 rounded-full h-1.5 min-w-10">
                <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Stat 3: Tiến độ chương trình */}
        <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-gray-50/70 border border-gray-100/80">
          <div className="w-7 h-7 rounded-md bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0">
            <BarChart2 className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center leading-none mb-1">
              <span className="text-[10.5px] text-gray-500 truncate" title={progressLabel(progress) || "Tiến độ CT"}>
                {progressLabel(progress) || "Tiến độ CT"}
              </span>
              <span className="text-[11px] font-semibold text-emerald-600">{pct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ClassOverviewTab — Action-driven Dashboard ──────────────────────────────

export function ClassOverviewTab({
  session,
  classId,
  classroom,
  course,
  slots = [],
  schedule = [],
  progress,
  daysOffCount = 0,
  onGoToTab,
  onOpenSessionDetail,
  onEditClass,
  onManageDaysOff,
}: {
  session: AuthSession;
  classId: number;
  classroom?: Classroom;
  course?: Enrollment;
  slots?: ClassWeeklySlot[];
  schedule: ClassScheduleRow[];
  progress?: ClassScheduleProgress;
  daysOffCount?: number;
  onGoToTab?: (tabId: string) => void;
  onOpenSessionDetail?: (sessionId: number) => void;
  onEditClass?: () => void;
  onManageDaysOff?: () => void;
}) {
  const qc = useQueryClient();
  const [accordionOpen, setAccordionOpen] = useState<"slots" | "daysOff" | "schedule" | null>(null);

  const targetClass: Classroom = classroom || ({
    id: classId,
    name: `Lớp #${classId}`,
    code: `L${classId}`,
    gradeId: 10,
    status: "ACTIVE",
    description: null,
    startDate: null,
  } as unknown as Classroom);

  const invalidate = () => Promise.all([
    qc.invalidateQueries({ queryKey: ["class-detail-schedule"] }),
    qc.invalidateQueries({ queryKey: ["class-detail-progress"] }),
  ]);

  const complete = useMutation({
    mutationFn: (id: number) => completeClassSession(session, classId, id),
    onSuccess: invalidate,
  });

  const postpone = useMutation({
    mutationFn: (id: number) => postponeClassSession(session, classId, id),
    onSuccess: invalidate,
  });

  const current = findCurrent(schedule);
  const upcoming = schedule
    .filter(x => x.status === "PLANNED" && (current ? x.seq > current.seq : true))
    .sort((a, b) => a.seq - b.seq);
  const next = upcoming[0] ?? null;

  const totalSessions = progress?.tongBuoi ?? schedule.length;
  const weeklyDays = slots.length > 0 
    ? [...new Set(slots.map(s => dayLabel(s.dayOfWeek)))].join(", ")
    : "Chưa có";
  const sampleSlot = slots[0];
  const weeklyTime = sampleSlot 
    ? `${timeVi(sampleSlot.startTime)} • ${sampleSlot.durationMin || (sampleSlot.periods ? sampleSlot.periods * 45 : 90)} phút/buổi`
    : "Chưa có ca học";
  const schoolYear = targetClass.startDate 
    ? `Năm học ${new Date(targetClass.startDate).getFullYear()} - ${new Date(targetClass.startDate).getFullYear() + 1}`
    : "Năm học 2026 - 2027";

  return (
    <div className="space-y-3">
      {/* Top Row: Current / Next Session */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        
        {/* Buổi hiện tại */}
        <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="flex items-center gap-1.5 font-semibold text-gray-800 text-sm">
                <Play className="w-4 h-4 text-emerald-600 fill-emerald-100" />
                Buổi hiện tại
              </h3>
              {current && (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                  {SESSION_STATUS_LABEL[current.status]}
                </span>
              )}
            </div>
            
            {current ? (
              <div className="mb-2">
                <h4 className="text-sm font-bold text-gray-900 mb-1 leading-snug">
                  {sessionTitle(current) || `Buổi ${current.seq}`}
                </h4>
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" /> {dateVi(current.scheduledDate)}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Clock className="w-3.5 h-3.5 text-gray-400" /> {timeVi(current.startTime)} ({periodLabel(current) || "90 phút"})
                  </p>
                  {current.note && (
                    <p className="text-[11px] text-gray-500 italic mt-1 bg-gray-50 p-1.5 rounded">
                      Ghi chú: {current.note}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-gray-500">
                {schedule.length ? "Lớp đã hoàn thành tất cả các buổi học theo lịch." : "Chưa có lịch buổi học nào được sinh."}
              </div>
            )}
          </div>
          
          {current && (
            <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
              <button 
                type="button"
                onClick={() => onOpenSessionDetail?.(current.id)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" /> Vào buổi học
              </button>
              <button 
                type="button"
                onClick={() => onOpenSessionDetail?.(current.id)}
                className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer"
              >
                Xem chi tiết
              </button>
            </div>
          )}
        </div>

        {/* Buổi tiếp theo */}
        <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-xs opacity-95 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="flex items-center gap-1.5 font-semibold text-gray-800 text-sm">
                <Clock className="w-4 h-4 text-blue-500" />
                Buổi tiếp theo
              </h3>
              {next && (
                <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
                  Buổi {next.seq}
                </span>
              )}
            </div>
            
            {next ? (
              <div className="mb-2">
                <h4 className="text-sm font-bold text-gray-900 mb-1 leading-snug">
                  {sessionTitle(next) || `Buổi ${next.seq}`}
                </h4>
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" /> {dateVi(next.scheduledDate)}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Clock className="w-3.5 h-3.5 text-gray-400" /> {timeVi(next.startTime)} ({periodLabel(next) || "90 phút"})
                  </p>
                  {next.note && (
                    <p className="text-[11px] text-gray-500 italic mt-1 bg-gray-50 p-1.5 rounded">
                      Ghi chú: {next.note}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-gray-500">
                Không còn buổi học tiếp theo.
              </div>
            )}
          </div>
          
          <div className="mt-2 pt-2 border-t border-gray-100">
            <button 
              type="button"
              onClick={() => onGoToTab?.("schedule")}
              className="w-max bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CalendarDays className="w-3.5 h-3.5" /> Xem lịch học
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Rules & Config Summary */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        
        {/* Ghi chú & Quy tắc */}
        <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-xs h-full flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="flex items-center gap-1.5 font-semibold text-gray-800 text-sm">
                <FileText className="w-4 h-4 text-emerald-600" />
                Ghi chú & quy tắc lớp học
              </h3>
              <button 
                type="button"
                onClick={onEditClass}
                className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-300 text-gray-700 rounded text-xs font-medium hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <FileEdit className="w-3 h-3" /> Chỉnh sửa
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              {targetClass.description ? (
                <div className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">
                  {targetClass.description}
                </div>
              ) : (
                <ul className="list-disc list-outside ml-3.5 space-y-1 text-xs text-gray-600">
                  <li>Học sinh cần chuẩn bị đầy đủ sách vở, máy tính trước mỗi buổi học.</li>
                  <li>Đi học đúng giờ, thông báo trước nếu có kế hoạch vắng mặt.</li>
                  <li>Làm bài tập đầy đủ và nộp bài đúng thời hạn được giao.</li>
                  <li>Giữ trật tự, tôn trọng giáo viên và các bạn trong lớp.</li>
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Tóm tắt cấu hình */}
        <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-xs">
          <div className="flex items-center mb-2">
            <h3 className="flex items-center gap-1.5 font-semibold text-gray-800 text-sm">
              <Settings className="w-4 h-4 text-emerald-600" />
              Tóm tắt cấu hình lớp
            </h3>
          </div>
          
          <div className="space-y-1.5 mb-3">
            <div className="flex justify-between items-center py-1 border-b border-gray-100 text-xs">
              <div className="flex items-center gap-1.5 text-gray-600">
                <BookOpen className="w-3.5 h-3.5 text-gray-400" /> Chương trình học
              </div>
              <div className="text-right">
                <span className="font-medium text-gray-900">{course?.label || "Chưa gán"}</span>
                <span className="text-[10.5px] text-gray-400 block">{course ? "1 khóa học áp dụng" : "Chưa có khóa học"}</span>
              </div>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-100 text-xs">
              <div className="flex items-center gap-1.5 text-gray-600">
                <Calendar className="w-3.5 h-3.5 text-gray-400" /> Ngày khai giảng
              </div>
              <div className="text-right">
                <span className="font-medium text-gray-900">
                  {targetClass.startDate ? dateVi(targetClass.startDate) : "Chưa đặt"}
                </span>
                <span className="text-[10.5px] text-gray-400 block">{schoolYear}</span>
              </div>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-100 text-xs">
              <div className="flex items-center gap-1.5 text-gray-600">
                <CalendarDays className="w-3.5 h-3.5 text-gray-400" /> Lịch học trong tuần
              </div>
              <div className="text-right">
                <span className="font-medium text-gray-900">{weeklyDays}</span>
                <span className="text-[10.5px] text-gray-400 block">{weeklyTime}</span>
              </div>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-100 text-xs">
              <div className="flex items-center gap-1.5 text-gray-600">
                <User className="w-3.5 h-3.5 text-gray-400" /> Số ngày nghỉ riêng
              </div>
              <div className="text-right">
                <span className="font-medium text-gray-900">{daysOffCount} ngày</span>
              </div>
            </div>
            <div className="flex justify-between items-center py-1 text-xs">
              <div className="flex items-center gap-1.5 text-gray-600">
                <BarChart2 className="w-3.5 h-3.5 text-gray-400" /> Tổng số buổi (thực tế)
              </div>
              <div className="text-right">
                <span className="font-medium text-gray-900">{totalSessions} buổi</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <button 
              type="button"
              onClick={() => onGoToTab?.("schedule")}
              className="flex items-center justify-center gap-1 px-2 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <CalendarDays className="w-3 h-3" /> Chỉnh lịch
            </button>
            <button 
              type="button"
              onClick={onManageDaysOff}
              className="flex items-center justify-center gap-1 px-2 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <Calendar className="w-3 h-3" /> Ngày nghỉ
            </button>
            <button 
              type="button"
              onClick={() => onGoToTab?.("schedule")}
              className="flex items-center justify-center gap-1 px-2 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <LayoutGrid className="w-3 h-3" /> Xem lịch
            </button>
          </div>
        </div>
      </div>

      {/* Cấu hình rút gọn (Accordion) */}
      <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-xs">
        <div className="mb-4">
          <h3 className="flex items-center gap-2 font-semibold text-gray-800">
            <Settings className="w-5 h-5 text-gray-500" />
            Cấu hình lớp (rút gọn)
          </h3>
          <p className="text-xs text-gray-500 ml-7 mt-0.5">
            Mở rộng từng mục để xem nhanh và chuyển hướng chỉnh sửa chi tiết cấu hình lớp.
          </p>
        </div>
        
        <div className="space-y-2">
          {/* Mục 1: Lịch học trong tuần */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button 
              type="button"
              onClick={() => setAccordionOpen(v => v === "slots" ? null : "slots")}
              className="w-full flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left cursor-pointer"
            >
              <span className="flex items-center gap-3 text-sm font-medium text-gray-700">
                <CalendarDays className="w-4 h-4 text-gray-500" /> Lịch học trong tuần ({slots.length} ca/tuần)
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${accordionOpen === "slots" ? "rotate-180" : ""}`} />
            </button>
            {accordionOpen === "slots" && (
              <div className="p-4 bg-white border-t border-gray-100 space-y-2 text-xs">
                {slots.length ? (
                  <div className="divide-y divide-gray-100">
                    {slots.map(s => (
                      <div key={s.id} className="py-2 flex items-center justify-between">
                        <span className="font-semibold text-gray-800">{dayLabel(s.dayOfWeek)}</span>
                        <span className="text-gray-600">{timeVi(s.startTime)} • {s.periods || 2} tiết</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">Chưa có ca học nào được thiết lập.</p>
                )}
                <button
                  type="button"
                  onClick={() => onGoToTab?.("schedule")}
                  className="mt-2 text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1"
                >
                  Mở tab Lịch học để thêm/sửa ca học →
                </button>
              </div>
            )}
          </div>

          {/* Mục 2: Ngày nghỉ riêng */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button 
              type="button"
              onClick={() => setAccordionOpen(v => v === "daysOff" ? null : "daysOff")}
              className="w-full flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left cursor-pointer"
            >
              <span className="flex items-center gap-3 text-sm font-medium text-gray-700">
                <Calendar className="w-4 h-4 text-gray-500" /> Ngày nghỉ riêng ({daysOffCount} ngày)
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${accordionOpen === "daysOff" ? "rotate-180" : ""}`} />
            </button>
            {accordionOpen === "daysOff" && (
              <div className="p-4 bg-white border-t border-gray-100 space-y-2 text-xs">
                <p className="text-gray-600">
                  {daysOffCount ? `Lớp hiện có ${daysOffCount} ngày nghỉ riêng biệt.` : "Lớp chưa thiết lập ngày nghỉ riêng nào."}
                </p>
                <button
                  type="button"
                  onClick={onManageDaysOff}
                  className="mt-2 text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1"
                >
                  Mở bảng quản lý ngày nghỉ lớp →
                </button>
              </div>
            )}
          </div>

          {/* Mục 3: Lịch đã sinh */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button 
              type="button"
              onClick={() => setAccordionOpen(v => v === "schedule" ? null : "schedule")}
              className="w-full flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left cursor-pointer"
            >
              <span className="flex items-center gap-3 text-sm font-medium text-gray-700">
                <FileText className="w-4 h-4 text-gray-500" /> Lịch đã sinh ({schedule.length} buổi)
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${accordionOpen === "schedule" ? "rotate-180" : ""}`} />
            </button>
            {accordionOpen === "schedule" && (
              <div className="p-4 bg-white border-t border-gray-100 space-y-2 text-xs">
                <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 pr-1">
                  {schedule.slice(0, 15).map(row => (
                    <div key={row.id} className="py-2 flex items-center justify-between">
                      <span className="text-gray-800 font-medium">Buổi {row.seq}: {sessionTitle(row) || dateVi(row.scheduledDate)}</span>
                      <span className="text-gray-500">{dateVi(row.scheduledDate)} ({SESSION_STATUS_LABEL[row.status]})</span>
                    </div>
                  ))}
                  {schedule.length > 15 && (
                    <p className="py-2 text-gray-400 italic">Và {schedule.length - 15} buổi học khác...</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onGoToTab?.("schedule")}
                  className="mt-2 text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1"
                >
                  Xem và chỉnh sửa toàn bộ lịch học chi tiết →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── Empty ────────────────────────────────────────────────────────────────────

export function Empty({ text }: { text: string }) {
  return (
    <div className="border border-dashed border-gray-300 rounded-xl bg-gray-50 p-8 text-center text-sm text-gray-500">
      {text}
    </div>
  );
}
