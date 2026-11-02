import { ClassDaysOff } from "./ClassDaysOff";
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AuthSession,
  Classroom,
  ScheduleSlot,
  ClassScheduleRow,
  ClassScheduleProgress,
  getScheduleSlots,
  updateScheduleSlots,
  getClassSchedule,
  previewClassSchedule,
  generateClassSchedule,
  regenerateClassSchedule,
  getClassScheduleProgress,
  updateClass,
  ClassroomInput,
} from "../api";
import {
  Calendar,
  Clock,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  CalendarCheck,
  Eye,
} from "lucide-react";

interface Props {
  session: AuthSession;
  classroom: Classroom;
}

const DOW_LABELS: Record<number, string> = {
  1: "Thứ Hai",
  2: "Thứ Ba",
  3: "Thứ Tư",
  4: "Thứ Năm",
  5: "Thứ Sáu",
  6: "Thứ Bảy",
  7: "Chủ Nhật",
};

export const ClassSchedulePanel: React.FC<Props> = ({ session, classroom }) => {
  const queryClient = useQueryClient();
  const classId = classroom.id;
  const refreshDetail = () => {
    for (const key of ["class-detail-schedule","class-detail-progress","class-detail-slots","class-detail-people","class-hoc-lieu"]) {
      void queryClient.invalidateQueries({queryKey:[key]});
    }
  };

  // Local state for start date
  const [startDate, setStartDate] = useState(classroom.startDate || "");
  const [editingDate, setEditingDate] = useState(false);

  // Queries
  const slotsQuery = useQuery({
    queryKey: ["class-schedule-slots", classId],
    queryFn: () => getScheduleSlots(session, classId),
  });

  const scheduleQuery = useQuery({
    queryKey: ["class-schedule", classId],
    queryFn: () => getClassSchedule(session, classId),
  });

  const progressQuery = useQuery({
    queryKey: ["class-schedule-progress", classId],
    queryFn: () => getClassScheduleProgress(session, classId),
  });

  // Local slots state
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [slotsDirty, setSlotsDirty] = useState(false);

  React.useEffect(() => {
    if (slotsQuery.data) {
      setSlots(slotsQuery.data);
      setSlotsDirty(false);
    }
  }, [slotsQuery.data]);

  // Mutations
  const updateStartDateMutation = useMutation({
    mutationFn: (newDate: string) =>
      updateClass(session, classId, {
        code: classroom.code,
        name: classroom.name,
        gradeId: classroom.gradeId,
        status: classroom.status,
        description: classroom.description,
        startDate: newDate,
      } as ClassroomInput),
    onSuccess: () => {
      setEditingDate(false);
      refreshDetail();
      queryClient.invalidateQueries({ queryKey: ["admin-classes"] });
    },
  });

  const saveSlotsMutation = useMutation({
    mutationFn: (newSlots: ScheduleSlot[]) =>
      updateScheduleSlots(session, classId, newSlots),
    onSuccess: () => {
      setSlotsDirty(false);
      refreshDetail();
      queryClient.invalidateQueries({ queryKey: ["class-schedule-slots", classId] });
    },
  });

  const [previewData, setPreviewData] = useState<{
    totalScheduled: number;
    projectedEndDate: string | null;
    keptManual: number;
    warnings: string[];
  } | null>(null);

  const previewMutation = useMutation({
    mutationFn: () => previewClassSchedule(session, classId),
    onSuccess: (data) => setPreviewData(data),
  });

  const generateMutation = useMutation({
    mutationFn: () => generateClassSchedule(session, classId),
    onSuccess: () => {
      setPreviewData(null);
      refreshDetail();
      queryClient.invalidateQueries({ queryKey: ["class-schedule", classId] });
      queryClient.invalidateQueries({ queryKey: ["class-schedule-progress", classId] });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateClassSchedule(session, classId),
    onSuccess: () => {
      setPreviewData(null);
      refreshDetail();
      queryClient.invalidateQueries({ queryKey: ["class-schedule", classId] });
      queryClient.invalidateQueries({ queryKey: ["class-schedule-progress", classId] });
    },
  });

  // Slot management handlers
  const handleToggleDow = (dow: number) => {
    setSlotsDirty(true);
    const existing = slots.find((s) => s.dayOfWeek === dow);
    if (existing) {
      setSlots(slots.filter((s) => s.dayOfWeek !== dow));
    } else {
      setSlots([
        ...slots,
        {
          dayOfWeek: dow,
          startTime: "",
          durationMin: 0,
          periods: 0,
        },
      ]);
    }
  };

  const handleUpdateSlotTime = (dow: number, time: string) => {
    setSlotsDirty(true);
    setSlots(
      slots.map((s) =>
        s.dayOfWeek === dow
          ? { ...s, startTime: time.length === 5 ? `${time}:00` : time }
          : s
      )
    );
  };

  const handleUpdateSlotPeriods = (dow: number, p: number) => {
    setSlotsDirty(true);
    setSlots(
      slots.map((s) =>
        s.dayOfWeek === dow ? { ...s, periods: Math.max(1, p) } : s
      )
    );
  };

  const scheduleList = scheduleQuery.data || [];
  const progress = progressQuery.data;

  return (
    <div className="flex flex-col gap-5 p-4 bg-surface text-on-surface">
      {[slotsQuery,scheduleQuery,progressQuery,updateStartDateMutation,saveSlotsMutation,previewMutation,generateMutation,regenerateMutation].filter(x=>x.isError).map((x,i)=><p key={i} role="alert" className="api-error">{x.error?.message}</p>)}
      {/* 1. Ngày khai giảng & Cài đặt lớp */}
      <div className="bg-white border rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="text-primary" size={20} />
            <span className="font-semibold text-sm">Ngày khai giảng (bắt đầu học):</span>
            {editingDate ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  className="border rounded px-2 py-1 text-sm"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <button
                  className="px-3 py-1 bg-primary text-white rounded text-xs font-medium"
                  disabled={updateStartDateMutation.isPending}
                  onClick={() => updateStartDateMutation.mutate(startDate)}
                >
                  Lưu
                </button>
                <button
                  className="px-2 py-1 border rounded text-xs"
                  onClick={() => {
                    setStartDate(classroom.startDate || "");
                    setEditingDate(false);
                  }}
                >
                  Hủy
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-primary">
                  {classroom.startDate
                    ? new Date(classroom.startDate).toLocaleDateString("vi-VN")
                    : "Chưa đặt"}
                </span>
                <button
                  className="text-xs text-primary underline ml-2"
                  onClick={() => {
                    setStartDate(classroom.startDate || "");
                    setEditingDate(true);
                  }}
                >
                  {classroom.startDate ? "Đổi ngày" : "+ Đặt ngày khai giảng"}
                </button>
              </div>
            )}
          </div>

          {/* Tiến độ lớp học (nếu có) */}
          {progress && (
            <div className="flex items-center gap-3 bg-slate-50 border px-3 py-1.5 rounded-lg text-xs">
              <span
                className={`font-bold px-2 py-0.5 rounded ${
                  progress.trangThai === "ON_TRACK"
                    ? "bg-emerald-100 text-emerald-800"
                    : progress.trangThai === "AHEAD"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {progress.trangThai === "ON_TRACK"
                  ? "✅ Đúng tiến độ"
                  : progress.trangThai === "AHEAD"
                  ? "🚀 Nhanh tiến độ"
                  : "⚠️ Chậm tiến độ"}
              </span>
              <span>
                Thực tế: <b>{progress.thucTe}</b> / {progress.tongBuoi} buổi (Kế hoạch:{" "}
                {progress.theoKeHoach})
              </span>
              {progress.projectedEndDate && (
                <span>
                  Dự kiến kết thúc:{" "}
                  <b>
                    {new Date(progress.projectedEndDate).toLocaleDateString("vi-VN")}
                  </b>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Cấu hình lịch học trong tuần (class_schedule_slots) */}
      <div className="bg-white border rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="text-primary" size={18} />
            <h4 className="font-semibold text-sm">Lịch học trong tuần (Mẫu cố định)</h4>
          </div>
          {slotsDirty && (
            <button
              className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700"
              disabled={saveSlotsMutation.isPending || !slots.length || slots.some(s=>!s.startTime||s.periods<=0||s.durationMin<=0)}
              onClick={() => saveSlotsMutation.mutate(slots)}
            >
              {saveSlotsMutation.isPending ? "Đang lưu..." : "Lưu mẫu lịch tuần"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((dow) => {
            const slot = slots.find((s) => s.dayOfWeek === dow);
            const active = !!slot;
            return (
              <div
                key={dow}
                className={`border rounded-lg p-2.5 flex flex-col gap-1.5 transition-all ${
                  active ? "bg-emerald-50/50 border-emerald-300" : "bg-gray-50 border-gray-200"
                }`}
              >
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => handleToggleDow(dow)}
                    className="rounded text-primary focus:ring-0"
                  />
                  <span className={`text-xs font-bold ${active ? "text-emerald-900" : "text-gray-600"}`}>
                    {DOW_LABELS[dow]}
                  </span>
                </label>

                {active && slot && (
                  <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>Giờ bắt đầu:</span>
                      <input
                        type="time"
                        value={slot.startTime.substring(0, 5)}
                        onChange={(e) => handleUpdateSlotTime(dow, e.target.value)}
                        className="border rounded px-1 py-0.5 text-[11px] w-16 text-right"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>Số tiết:</span>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={slot.periods||""}
                        onChange={(e) => handleUpdateSlotPeriods(dow, Number(e.target.value))}
                        className="border rounded px-1 py-0.5 text-[11px] w-12 text-right"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">{slots.map((slot,index)=><label key={slot.dayOfWeek} className="text-sm">Thời lượng {DOW_LABELS[slot.dayOfWeek]} (phút)<input type="number" min={1} className="border rounded p-2 ml-2" value={slot.durationMin||""} onChange={e=>{setSlotsDirty(true);setSlots(current=>current.map((x,i)=>i===index?{...x,durationMin:Number(e.target.value)}:x))}}/></label>)}</div>
      <ClassDaysOff session={session} classId={classId}/>
      {/* 3. Thao tác sinh lịch & Preview */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border p-3 rounded-xl">
        <div className="flex items-center gap-2">
          <CalendarCheck className="text-indigo-600" size={18} />
          <span className="font-semibold text-xs text-gray-700">
            {scheduleList.length > 0
              ? `Hiện có ${scheduleList.length} buổi học trong lịch thực tế`
              : "Chưa có lịch học thực tế"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 border bg-white rounded-lg text-xs font-semibold hover:bg-gray-100"
            disabled={previewMutation.isPending||slotsDirty||editingDate}
            onClick={() => previewMutation.mutate()}
          >
            <Eye size={14} />
            {previewMutation.isPending ? "Đang tính..." : "Xem trước lịch"}
          </button>

          {scheduleList.length === 0 ? (
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90"
              disabled={generateMutation.isPending||slotsDirty||editingDate}
              onClick={() => generateMutation.mutate()}
            >
              <Play size={14} />
              {generateMutation.isPending ? "Đang sinh..." : "Sinh lịch học"}
            </button>
          ) : (
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700"
              disabled={regenerateMutation.isPending||slotsDirty||editingDate}
              onClick={() => {
                if (
                  confirm(
                    "Sinh lại lịch học? Các buổi đã xác nhận hoàn thành hoặc chỉnh tay sẽ được giữ nguyên."
                  )
                ) {
                  regenerateMutation.mutate();
                }
              }}
            >
              <RotateCcw size={14} />
              {regenerateMutation.isPending ? "Đang cập nhật..." : "Sinh lại lịch"}
            </button>
          )}
        </div>
      </div>

      {/* Preview modal/alert if any */}
      {previewData && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-xs">
          <div className="flex items-center justify-between font-bold text-indigo-900 mb-2">
            <span>KẾT QUẢ XEM TRƯỚC LỊCH HỌC</span>
            <button
              onClick={() => setPreviewData(null)}
              className="text-gray-400 hover:text-gray-600 font-bold"
            >
              ×
            </button>
          </div>
          <p className="text-gray-700">
            • Tổng số buổi học sẽ xếp: <b>{previewData.totalScheduled} buổi</b>
          </p>
          {previewData.projectedEndDate && (
            <p className="text-gray-700">
              • Ngày kết thúc dự kiến:{" "}
              <b>
                {new Date(previewData.projectedEndDate).toLocaleDateString("vi-VN")}
              </b>
            </p>
          )}
          {previewData.keptManual > 0 && (
            <p className="text-amber-700 font-semibold">
              • Đã giữ nguyên <b>{previewData.keptManual} buổi</b> đã chỉnh tay thủ công.
            </p>
          )}
          {previewData.warnings.length > 0 && (
            <div className="mt-2 text-rose-600 font-medium">
              {previewData.warnings.map((w, idx) => (
                <div key={idx}>⚠️ {w}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Danh sách các buổi học ngày thực (class_schedule) */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
          <h4 className="font-semibold text-xs text-gray-700">
            Lịch học chi tiết ({scheduleList.length} buổi)
          </h4>
          <span className="text-[11px] text-gray-500">
            Hệ thống tự động bỏ qua các ngày nghỉ lễ và kỳ nghỉ của khóa
          </span>
        </div>

        {scheduleList.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs">
            Lớp chưa sinh lịch học. Vui lòng cấu hình ngày khai giảng, lịch tuần và nhấn{" "}
            <b>Sinh lịch học</b>.
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-100 text-gray-600 uppercase text-[10px] sticky top-0">
                <tr>
                  <th className="px-3 py-2">Buổi</th>
                  <th className="px-3 py-2">Ngày học</th>
                  <th className="px-3 py-2">Giờ học</th>
                  <th className="px-3 py-2">Nội dung</th>
                  <th className="px-3 py-2">Loại</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {scheduleList.map((item: ClassScheduleRow) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-gray-50 ${
                      item.status === "COMPLETED"
                        ? "bg-emerald-50/20"
                        : item.status === "POSTPONED"
                        ? "bg-amber-50/20"
                        : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-bold text-gray-700">#{item.seq}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium">
                        {new Date(item.scheduledDate).toLocaleDateString("vi-VN", {
                          weekday: "short",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {item.startTime ? item.startTime.substring(0, 5) : "—"}
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-800">
                      {item.sessionTitle || `Buổi ${item.seq}`}
                    </td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600">
                        {item.sessionType === "EXAM"
                          ? "Kiểm tra"
                          : item.sessionType === "REVIEW"
                          ? "Ôn tập"
                          : item.sessionType === "ACTIVITY"
                          ? "Thực hành"
                          : "Bài dạy"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          item.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.status === "POSTPONED"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {item.status === "COMPLETED"
                          ? "Đã học"
                          : item.status === "POSTPONED"
                          ? "Hoãn"
                          : "Kế hoạch"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-[11px]">
                      {item.editedManually && (
                        <span className="text-amber-600 mr-1 font-semibold">[Chỉnh tay]</span>
                      )}
                      {item.isMakeup && (
                        <span className="text-indigo-600 mr-1 font-semibold">[Dạy bù]</span>
                      )}
                      {item.note || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
