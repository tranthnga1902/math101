import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getClassHocLieu, getClassDocuments, getClassDocumentLibrary, attachClassDocument, updateClassDocument, detachClassDocument,
  openDocumentFile, updateScheduleSlots, regenerateClassSchedule, addClassScheduleSession,
  deleteClassScheduleSession, completeClassSession, postponeClassSession,
  getClassRoster, getRosterCandidates, addRosterStudent, removeRosterStudent,
  uploadClassRoster, confirmClassRoster, downloadRosterTemplate,
  getEnrollments, addEnrollment, removeEnrollment, getUsers,
  type AuthSession, type ClassScheduleProgress, type ClassScheduleRow, type ClassWeeklySlot,
  type Enrollment, type HocLieuItem, type RosterStudent, type ClassRequirement, type ScheduleSlot,
  type RosterImportPreview, type RosterImportResult, type UserAccount,
} from "../../api";
import { Empty, dateVi, dayLabel, periodLabel, sessionTitle, timeVi } from "./ClassDetailOverview";
import { ClassDaysOff } from "../../admin/ClassDaysOff";
import { ClassSessionDetail } from "./ClassSessionDetail";
import { messageOf } from "../../lib/errors";

const statusLabel: Record<ClassScheduleRow["status"], string> = {
  PLANNED: "Sắp học",
  COMPLETED: "Đã học",
  POSTPONED: "Hoãn",
  CANCELLED: "Hủy",
};
const statusTone: Record<ClassScheduleRow["status"], string> = {
  PLANNED: "bg-primary-container text-primary",
  COMPLETED: "bg-secondary-container text-secondary",
  POSTPONED: "bg-surface-container-high text-on-surface-variant",
  CANCELLED: "bg-error-container text-error",
};

const DOW_NAMES: Record<number, string> = {
  1: "Thứ Hai", 2: "Thứ Ba", 3: "Thứ Tư", 4: "Thứ Năm", 5: "Thứ Sáu", 6: "Thứ Bảy", 7: "Chủ Nhật",
};

// ─── 1. ClassScheduleTab ──────────────────────────────────────────────────────

export function ClassScheduleTab({
  session, classId, slots, schedule, projectedEnd, onSelect,
}: {
  session?: AuthSession;
  classId?: number;
  slots: ClassWeeklySlot[];
  schedule: ClassScheduleRow[];
  projectedEnd?: string | null;
  onSelect?: (id: number) => void;
}) {
  const qc = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [showDaysOff, setShowDaysOff] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);

  // Slot form state
  const [slotDow, setSlotDow] = useState(1);
  const [slotTime, setSlotTime] = useState("08:00");
  const [slotPeriods, setSlotPeriods] = useState(2);
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);

  // Add session form state
  const [newSessionDate, setNewSessionDate] = useState("");
  const [newSessionTime, setNewSessionTime] = useState("08:00");
  const [newSessionNote, setNewSessionNote] = useState("");
  const [newSessionIsMakeup, setNewSessionIsMakeup] = useState(true);

  const invalidateSchedule = () => {
    if (!classId) return;
    Promise.all([
      qc.invalidateQueries({ queryKey: ["class-detail-schedule"] }),
      qc.invalidateQueries({ queryKey: ["class-detail-progress"] }),
      qc.invalidateQueries({ queryKey: ["class-detail-slots"] }),
      qc.invalidateQueries({ queryKey: ["class-schedule"] }),
      qc.invalidateQueries({ queryKey: ["class-schedule-slots"] }),
      qc.invalidateQueries({ queryKey: ["cp-schedule"] }),
      qc.invalidateQueries({ queryKey: ["cp-slots"] }),
    ]);
  };

  // Mutations
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      if (!session || !classId) return;
      return regenerateClassSchedule(session, classId);
    },
    onSuccess: (data) => {
      invalidateSchedule();
      alert(data ? `Đã sinh lại lịch (${data.totalScheduled} buổi).` : "Đã sinh lại lịch học.");
    },
  });

  const saveSlotMutation = useMutation({
    mutationFn: async () => {
      if (!session || !classId) return;
      let newSlots: ScheduleSlot[] = slots.map(s => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime.length === 5 ? `${s.startTime}:00` : s.startTime,
        durationMin: s.durationMin || s.periods * 45,
        periods: s.periods,
      }));

      const formattedTime = slotTime.length === 5 ? `${slotTime}:00` : slotTime;

      if (editingSlotId != null) {
        newSlots = newSlots.filter(s => (s as unknown as { id?: number }).id !== editingSlotId);
      }
      newSlots.push({
        dayOfWeek: slotDow,
        startTime: formattedTime,
        durationMin: slotPeriods * 45,
        periods: slotPeriods,
      });

      return updateScheduleSlots(session, classId, newSlots);
    },
    onSuccess: () => {
      invalidateSchedule();
      setShowSlotModal(false);
      setEditingSlotId(null);
    },
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (slotToDelete: ClassWeeklySlot) => {
      if (!session || !classId) return;
      const remaining: ScheduleSlot[] = slots
        .filter(s => s.id !== slotToDelete.id)
        .map(s => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime.length === 5 ? `${s.startTime}:00` : s.startTime,
          durationMin: s.durationMin,
          periods: s.periods,
        }));
      return updateScheduleSlots(session, classId, remaining);
    },
    onSuccess: invalidateSchedule,
  });

  const addSessionMutation = useMutation({
    mutationFn: async () => {
      if (!session || !classId) return;
      return addClassScheduleSession(session, classId, {
        scheduledDate: newSessionDate,
        startTime: newSessionTime ? `${newSessionTime}:00` : null,
        note: newSessionNote.trim() || null,
        isMakeup: newSessionIsMakeup,
      });
    },
    onSuccess: () => {
      invalidateSchedule();
      setShowAddSessionModal(false);
      setNewSessionDate("");
      setNewSessionNote("");
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (scheduleId: number) => {
      if (!session || !classId) return;
      return deleteClassScheduleSession(session, classId, scheduleId);
    },
    onSuccess: invalidateSchedule,
  });

  const quickActionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "complete" | "postpone" }) => {
      if (!session || !classId) return;
      return action === "complete"
        ? completeClassSession(session, classId, id)
        : postponeClassSession(session, classId, id);
    },
    onSuccess: invalidateSchedule,
  });

  const selectedRow = schedule.find(s => s.id === selectedSessionId);
  const error = [regenerateMutation, saveSlotMutation, deleteSlotMutation, addSessionMutation, deleteSessionMutation]
    .find(m => m.isError)?.error;

  return (
    <div className="flex flex-col gap-4">
      {/* Action bar */}
      {session && classId && (
        <div className="flex items-center justify-between gap-3 flex-wrap bg-surface-container-lowest p-3 rounded-xl border border-outline-variant">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setEditingSlotId(null);
                setSlotDow(1);
                setSlotTime("08:00");
                setSlotPeriods(2);
                setShowSlotModal(true);
              }}
              className="h-8 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold flex items-center gap-1 hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Thêm ca học tuần
            </button>
            <button
              type="button"
              onClick={() => setShowDaysOff(v => !v)}
              className={`h-8 px-3 rounded-lg border border-outline-variant text-xs font-semibold flex items-center gap-1 transition-colors ${
                showDaysOff ? "bg-surface-container text-primary" : "text-on-surface hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">event_busy</span>
              {showDaysOff ? "Đóng ngày nghỉ" : "Ngày nghỉ riêng"}
            </button>
            <button
              type="button"
              onClick={() => {
                setNewSessionDate(new Date().toISOString().slice(0, 10));
                setNewSessionTime("08:00");
                setNewSessionNote("");
                setNewSessionIsMakeup(true);
                setShowAddSessionModal(true);
              }}
              className="h-8 px-3 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface hover:bg-surface-container-low flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">calendar_add_on</span>
              Thêm buổi học bù / bổ sung
            </button>
          </div>

          <button
            type="button"
            disabled={regenerateMutation.isPending}
            onClick={() => {
              if (confirm("Sinh lại lịch sẽ cập nhật lại ngày các buổi chưa học theo TKB và ngày nghỉ. Giữ nguyên các buổi đã chỉnh tay. Tiếp tục?")) {
                regenerateMutation.mutate();
              }
            }}
            className="h-8 px-3 rounded-lg border border-primary/40 text-primary bg-primary-container/20 text-xs font-semibold flex items-center gap-1 hover:bg-primary-container/40 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">sync</span>
            {regenerateMutation.isPending ? "Đang sinh lại…" : "Sinh lại lịch học"}
          </button>
        </div>
      )}

      {error && <div className="api-error">{messageOf(error)}</div>}

      {/* Days off drawer / panel */}
      {showDaysOff && session && classId && (
        <ClassDaysOff session={session} classId={classId} />
      )}

      {/* Main Grid: Slots & Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-[.7fr_1.3fr] gap-4">
        {/* Weekly Slots */}
        <article className="border border-outline-variant rounded-xl bg-surface-container-lowest p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="font-bold text-on-surface text-sm">Thời khóa biểu hàng tuần</h3>
              <span className="text-xs text-on-surface-variant">{slots.length} ca / tuần</span>
            </div>
            <div className="divide-y divide-outline-variant">
              {slots.map(x => (
                <div key={x.id} className="flex items-center justify-between py-2.5 text-sm gap-2">
                  <div className="min-w-0">
                    <strong className="text-on-surface">{dayLabel(x.dayOfWeek)}</strong>
                    <p className="text-xs text-on-surface-variant data-tabular">
                      {timeVi(x.startTime)} · {x.periods ? `${x.periods} tiết` : `${x.durationMin} phút`}
                    </p>
                  </div>
                  {session && classId && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSlotId(x.id);
                          setSlotDow(x.dayOfWeek);
                          setSlotTime(x.startTime ? x.startTime.slice(0, 5) : "08:00");
                          setSlotPeriods(x.periods || 2);
                          setShowSlotModal(true);
                        }}
                        className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
                        title="Sửa ca học"
                      >
                        <span className="material-symbols-outlined text-[17px]">edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Xóa ca học ${dayLabel(x.dayOfWeek)} (${timeVi(x.startTime)}) khỏi thời khóa biểu?`)) {
                            deleteSlotMutation.mutate(x);
                          }
                        }}
                        className="p-1 rounded text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-colors"
                        title="Xóa ca học"
                      >
                        <span className="material-symbols-outlined text-[17px]">delete</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {!slots.length && (
                <p className="py-6 text-center text-xs text-on-surface-variant">Chưa có ca học nào trong tuần.</p>
              )}
            </div>
          </div>
          {projectedEnd && (
            <p className="mt-4 pt-3 border-t border-outline-variant text-xs text-on-surface-variant">
              Dự kiến kết thúc: <b className="text-on-surface ml-1">{dateVi(projectedEnd)}</b>
            </p>
          )}
        </article>

        {/* Schedule rows */}
        <article className="border border-outline-variant rounded-xl bg-surface-container-lowest p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-bold text-on-surface text-sm">Lịch từng buổi học</h3>
            <span className="text-xs text-on-surface-variant">{schedule.length} buổi</span>
          </div>
          <div className="divide-y divide-outline-variant max-h-[75vh] overflow-y-auto thin-scrollbar pr-1 overscroll-contain">
            {schedule.map(x => (
              <div
                key={x.id}
                className="flex items-center justify-between gap-2 py-3 hover:bg-surface-container-low px-2 rounded-lg transition-colors group"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (onSelect) onSelect(x.id);
                    setSelectedSessionId(x.id);
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (onSelect) onSelect(x.id);
                      setSelectedSessionId(x.id);
                    }
                  }}
                  className="grid grid-cols-[82px_1fr] gap-3 items-center min-w-0 flex-1 cursor-pointer"
                >
                  <span className="text-xs text-on-surface-variant data-tabular">{dateVi(x.scheduledDate)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">
                      Buổi {x.seq} · {sessionTitle(x) || "Chưa có tiêu đề"}
                      {x.isMakeup && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-tertiary-container text-tertiary text-[10px] font-bold">Bù</span>
                      )}
                      {x.editedManually && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-[10px]">Chỉnh tay</span>
                      )}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {periodLabel(x) || timeVi(x.startTime)}
                      {x.note && <span className="italic ml-2">({x.note})</span>}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`status-chip px-2 py-0.5 text-xs font-bold ${statusTone[x.status]}`}>
                    {statusLabel[x.status]}
                  </span>
                  {session && classId && (
                    <div className="opacity-80 group-hover:opacity-100 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedSessionId(x.id)}
                        className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container"
                        title="Xem & Cân chỉnh buổi học"
                      >
                        <span className="material-symbols-outlined text-[17px]">edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Xóa buổi ${x.seq} (${x.scheduledDate}) khỏi lịch?`)) {
                            deleteSessionMutation.mutate(x.id);
                          }
                        }}
                        className="p-1 rounded text-on-surface-variant hover:text-error hover:bg-error-container/30"
                        title="Xóa buổi"
                      >
                        <span className="material-symbols-outlined text-[17px]">delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {!schedule.length && <p className="py-8 text-center text-sm text-on-surface-variant">Chưa có lịch học.</p>}
          </div>
        </article>
      </div>

      {/* Modal Thêm / Sửa Ca học tuần */}
      {showSlotModal && (
        <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowSlotModal(false); }}>
          <section role="dialog" aria-modal="true" className="dialog-card !max-w-md">
            <header className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-on-surface">
                {editingSlotId != null ? "Chỉnh sửa ca học" : "Thêm ca học trong tuần"}
              </h3>
              <button onClick={() => setShowSlotModal(false)} className="text-xl">×</button>
            </header>
            <form onSubmit={e => { e.preventDefault(); saveSlotMutation.mutate(); }} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
                Thứ trong tuần
                <select
                  value={slotDow}
                  onChange={e => setSlotDow(Number(e.target.value))}
                  className="h-9 px-3 rounded-lg border border-outline-variant text-sm text-on-surface"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map(d => (
                    <option key={d} value={d}>{DOW_NAMES[d]}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
                Giờ bắt đầu
                <input
                  type="time"
                  required
                  value={slotTime}
                  onChange={e => setSlotTime(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-outline-variant text-sm text-on-surface"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
                Số tiết trong ca
                <input
                  type="number"
                  min={1}
                  max={6}
                  required
                  value={slotPeriods}
                  onChange={e => setSlotPeriods(Number(e.target.value))}
                  className="h-9 px-3 rounded-lg border border-outline-variant text-sm text-on-surface"
                />
              </label>
              <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant mt-2">
                <button
                  type="button"
                  onClick={() => setShowSlotModal(false)}
                  className="h-8 px-3 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface-variant"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saveSlotMutation.isPending}
                  className="h-8 px-4 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {saveSlotMutation.isPending ? "Đang lưu…" : "Lưu ca học"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal Thêm buổi học mới / bù */}
      {showAddSessionModal && (
        <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowAddSessionModal(false); }}>
          <section role="dialog" aria-modal="true" className="dialog-card !max-w-md">
            <header className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-on-surface">Thêm buổi học bù / bổ sung</h3>
              <button onClick={() => setShowAddSessionModal(false)} className="text-xl">×</button>
            </header>
            <form onSubmit={e => { e.preventDefault(); addSessionMutation.mutate(); }} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
                Ngày học
                <input
                  type="date"
                  required
                  value={newSessionDate}
                  onChange={e => setNewSessionDate(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-outline-variant text-sm text-on-surface"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
                Giờ bắt đầu
                <input
                  type="time"
                  value={newSessionTime}
                  onChange={e => setNewSessionTime(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-outline-variant text-sm text-on-surface"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
                Ghi chú buổi học
                <input
                  placeholder="Ví dụ: Học bù buổi Thứ Ba do mất điện"
                  value={newSessionNote}
                  onChange={e => setNewSessionNote(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-outline-variant text-sm text-on-surface"
                />
              </label>
              <label className="flex items-center gap-2 pt-2 text-sm font-medium text-on-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={newSessionIsMakeup}
                  onChange={e => setNewSessionIsMakeup(e.target.checked)}
                  className="rounded border-outline-variant text-primary"
                />
                Đánh dấu là buổi dạy bù
              </label>
              <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSessionModal(false)}
                  className="h-8 px-3 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface-variant"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={addSessionMutation.isPending}
                  className="h-8 px-4 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {addSessionMutation.isPending ? "Đang thêm…" : "Thêm buổi học"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal chi tiết & sửa buổi học */}
      {selectedSessionId != null && selectedRow && session && classId && (
        <ClassSessionDetail
          session={session}
          classId={classId}
          row={selectedRow}
          onClose={() => setSelectedSessionId(null)}
        />
      )}
    </div>
  );
}

// ─── 2. ClassMembersTab ───────────────────────────────────────────────────────

type Filter = "all" | "students" | "teachers";

export function ClassMembersTab({
  session, classId, teachers, students,
}: {
  session?: AuthSession;
  classId?: number;
  teachers: Enrollment[];
  students: RosterStudent[];
}) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  // Student Add Modal State
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [studentAddMode, setStudentAddMode] = useState<"existing" | "new">("existing");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [pickedCandidateId, setPickedCandidateId] = useState<number>(0);
  const [newStudentDraft, setNewStudentDraft] = useState({
    fullName: "", username: "", email: "", phone: "", password: "",
  });

  // Teacher Add Modal State
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [pickedTeacherId, setPickedTeacherId] = useState<number>(0);

  // Excel import
  const [preview, setPreview] = useState<RosterImportPreview | null>(null);
  const [importResult, setImportResult] = useState<RosterImportResult | null>(null);

  const invalidateMembers = () => {
    if (!classId) return;
    Promise.all([
      qc.invalidateQueries({ queryKey: ["class-roster"] }),
      qc.invalidateQueries({ queryKey: ["class-detail-people"] }),
      qc.invalidateQueries({ queryKey: ["cp-people"] }),
      qc.invalidateQueries({ queryKey: ["class-members"] }),
    ]);
  };

  // Queries for add student candidate & teachers
  const candidatesQuery = useQuery({
    queryKey: ["class-roster-candidates", session?.accessToken, classId, candidateSearch],
    queryFn: () => classId && session ? getRosterCandidates(session, classId, candidateSearch) : [],
    enabled: Boolean(session && classId && showAddStudentModal && studentAddMode === "existing"),
  });
  const candidates = candidatesQuery.data ?? [];

  const usersQuery = useQuery({
    queryKey: ["all-users", session?.accessToken],
    queryFn: () => session ? getUsers(session) : [],
    enabled: Boolean(session && showAddTeacherModal),
  });
  const teacherUsers = (usersQuery.data ?? []).filter(u => u.roleCode === "TEACHER");

  // Mutations
  const addStudentMutation = useMutation({
    mutationFn: async () => {
      if (!session || !classId) return;
      if (studentAddMode === "existing") {
        return addRosterStudent(session, classId, { userId: pickedCandidateId });
      } else {
        return addRosterStudent(session, classId, newStudentDraft);
      }
    },
    onSuccess: () => {
      invalidateMembers();
      setShowAddStudentModal(false);
      setPickedCandidateId(0);
      setNewStudentDraft({ fullName: "", username: "", email: "", phone: "", password: "" });
    },
  });

  const removeStudentMutation = useMutation({
    mutationFn: async (studentId: number) => {
      if (!session || !classId) return;
      return removeRosterStudent(session, classId, studentId);
    },
    onSuccess: invalidateMembers,
  });

  const addTeacherMutation = useMutation({
    mutationFn: async () => {
      if (!session || !classId || !pickedTeacherId) return;
      return addEnrollment(session, "class-teachers", { classId, userId: pickedTeacherId });
    },
    onSuccess: () => {
      invalidateMembers();
      setShowAddTeacherModal(false);
      setPickedTeacherId(0);
    },
  });

  const removeTeacherMutation = useMutation({
    mutationFn: async (enrollmentId: number) => {
      if (!session) return;
      return removeEnrollment(session, "class-teachers", enrollmentId);
    },
    onSuccess: invalidateMembers,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadClassRoster(session!, classId!, file),
    onSuccess: (data) => { setPreview(data); setImportResult(null); },
  });

  const confirmMutation = useMutation({
    mutationFn: (objectKey: string) => confirmClassRoster(session!, classId!, objectKey),
    onSuccess: async (data) => {
      invalidateMembers();
      setPreview(null);
      setImportResult(data);
    },
  });

  const needle = search.trim().toLocaleLowerCase("vi");
  const filteredStudents = students.filter(s =>
    !needle || `${s.full_name} ${s.username || ""}`.toLocaleLowerCase("vi").includes(needle)
  );
  const filteredTeachers = teachers.filter(t =>
    !needle || t.label.toLocaleLowerCase("vi").includes(needle)
  );

  const error = [addStudentMutation, removeStudentMutation, addTeacherMutation, removeTeacherMutation, uploadMutation, confirmMutation]
    .find(m => m.isError)?.error;

  return (
    <section className="flex flex-col gap-4">
      {/* Header controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-surface-container-lowest p-3 rounded-xl border border-outline-variant">
        <div className="flex items-center gap-2">
          {([["all", `Tất cả (${students.length + teachers.length})`], ["students", `Học sinh (${students.length})`], ["teachers", `Giáo viên (${teachers.length})`]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                filter === id ? "bg-primary text-on-primary" : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {session && classId && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => void downloadRosterTemplate(session, classId).catch(alert)}
              className="h-8 px-3 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low"
            >
              Tải mẫu Excel
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="h-8 px-3 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface hover:bg-surface-container-low disabled:opacity-50"
            >
              {uploadMutation.isPending ? "Đang đọc…" : "Nhập Excel"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) uploadMutation.mutate(file);
              }}
            />
            <button
              type="button"
              onClick={() => setShowAddStudentModal(true)}
              className="h-8 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold flex items-center gap-1 hover:opacity-90"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              Thêm học sinh
            </button>
            <button
              type="button"
              onClick={() => setShowAddTeacherModal(true)}
              className="h-8 px-3 rounded-lg border border-primary text-primary text-xs font-semibold hover:bg-primary-container/20"
            >
              Phân công GV
            </button>
          </div>
        )}
      </div>

      {error && <div className="api-error">{messageOf(error)}</div>}

      {/* Import preview & results */}
      {preview && (
        <div className="border border-outline-variant rounded-xl p-4 bg-surface-container-low flex flex-col gap-3">
          <h4 className="text-sm font-bold text-on-surface">Xem trước nhập danh sách Excel</h4>
          <p className="text-xs text-on-surface-variant">
            Tìm thấy {preview.total} dòng · {preview.total - preview.invalid} dòng hợp lệ ({preview.newAccounts} tài khoản mới, {preview.existingAccounts} đã có tài khoản, {preview.alreadyInClass} đã trong lớp).
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="h-8 px-3 rounded-lg border border-outline-variant text-xs"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={confirmMutation.isPending}
              onClick={() => confirmMutation.mutate(preview.objectKey)}
              className="h-8 px-4 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90"
            >
              {confirmMutation.isPending ? "Đang nhập…" : "Xác nhận nhập vào lớp"}
            </button>
          </div>
        </div>
      )}

      {importResult && (
        <div className="border border-outline-variant rounded-xl p-3 bg-surface-container-lowest text-xs text-on-surface flex justify-between items-center">
          <span>Nhập thành công: Đã tạo {importResult.created} tài khoản, ghi danh {importResult.enrolled} học sinh.</span>
          <button type="button" onClick={() => setImportResult(null)} className="font-bold underline ml-2">Đóng</button>
        </div>
      )}

      {/* Members Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Teachers */}
        {filter !== "students" && (
          <article className="border border-outline-variant rounded-xl bg-surface-container-lowest p-4">
            <h3 className="font-bold text-on-surface text-sm mb-3">Giáo viên phụ trách</h3>
            <div className="divide-y divide-outline-variant">
              {filteredTeachers.map((x, i) => (
                <div key={x.id} className="flex items-center justify-between py-3 gap-2">
                  <Member name={x.label} meta={i === 0 ? "Giáo viên chính / Chủ nhiệm" : "Giáo viên bộ môn / Hỗ trợ"} avatarUrl={x.avatarUrl} />
                  {session && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Gỡ giáo viên ${x.label} khỏi lớp?`)) {
                          removeTeacherMutation.mutate(x.id);
                        }
                      }}
                      className="px-2 py-1 text-xs text-error font-semibold hover:bg-error-container/30 rounded"
                    >
                      Gỡ
                    </button>
                  )}
                </div>
              ))}
              {!filteredTeachers.length && (
                <p className="py-6 text-center text-xs text-on-surface-variant">Chưa có giáo viên.</p>
              )}
            </div>
          </article>
        )}

        {/* Students */}
        {filter !== "teachers" && (
          <article className="border border-outline-variant rounded-xl bg-surface-container-lowest p-4">
            <h3 className="font-bold text-on-surface text-sm mb-3">Học sinh trong lớp</h3>
            <div className="divide-y divide-outline-variant max-h-[75vh] overflow-y-auto thin-scrollbar pr-1 overscroll-contain">
              {filteredStudents.map(x => (
                <div key={x.id} className="flex items-center justify-between py-2.5 gap-2">
                  <Member
                    name={x.full_name}
                    meta={x.username ? `Mã HS: ${x.username}` : "Học sinh"}
                    status={x.status}
                    avatarUrl={x.avatar_url}
                  />
                  {session && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Xóa học sinh ${x.full_name} khỏi lớp này?`)) {
                          removeStudentMutation.mutate(x.id);
                        }
                      }}
                      className="px-2 py-1 text-xs text-error font-semibold hover:bg-error-container/30 rounded"
                    >
                      Gỡ
                    </button>
                  )}
                </div>
              ))}
              {!filteredStudents.length && (
                <p className="py-6 text-center text-xs text-on-surface-variant">Chưa có học sinh nào trong lớp.</p>
              )}
            </div>
          </article>
        )}
      </div>

      {/* Modal Thêm học sinh */}
      {showAddStudentModal && (
        <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowAddStudentModal(false); }}>
          <section role="dialog" aria-modal="true" className="dialog-card !max-w-lg">
            <header className="flex justify-between items-center mb-3">
              <h3 className="text-base font-bold text-on-surface">Thêm học sinh vào lớp</h3>
              <button onClick={() => setShowAddStudentModal(false)} className="text-xl">×</button>
            </header>

            {/* Mode selector */}
            <div className="flex gap-2 mb-3 border-b border-outline-variant pb-2">
              <button
                type="button"
                onClick={() => setStudentAddMode("existing")}
                className={`text-xs font-semibold pb-1 border-b-2 ${
                  studentAddMode === "existing" ? "border-primary text-primary" : "border-transparent text-on-surface-variant"
                }`}
              >
                Chọn từ tài khoản có sẵn
              </button>
              <button
                type="button"
                onClick={() => setStudentAddMode("new")}
                className={`text-xs font-semibold pb-1 border-b-2 ${
                  studentAddMode === "new" ? "border-primary text-primary" : "border-transparent text-on-surface-variant"
                }`}
              >
                Tạo mới học sinh
              </button>
            </div>

            {studentAddMode === "existing" ? (
              <div className="flex flex-col gap-3">
                <input
                  placeholder="Tìm học sinh theo tên hoặc mã..."
                  value={candidateSearch}
                  onChange={e => setCandidateSearch(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-outline-variant text-sm text-on-surface"
                />
                <div className="max-h-60 overflow-y-auto divide-y divide-outline-variant border border-outline-variant rounded-lg p-2">
                  {candidates.map(c => (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 p-2 rounded cursor-pointer ${
                        pickedCandidateId === c.id ? "bg-primary-container/30" : "hover:bg-surface-container-low"
                      }`}
                    >
                      <input
                        type="radio"
                        name="candidate"
                        checked={pickedCandidateId === c.id}
                        onChange={() => setPickedCandidateId(c.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-on-surface">{c.full_name}</p>
                        <p className="text-xs text-on-surface-variant">{c.username} · {c.email || "Không có email"}</p>
                      </div>
                    </label>
                  ))}
                  {!candidates.length && (
                    <p className="py-4 text-center text-xs text-on-surface-variant">Không có học sinh phù hợp.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
                  Họ và tên *
                  <input
                    required
                    value={newStudentDraft.fullName}
                    onChange={e => setNewStudentDraft({ ...newStudentDraft, fullName: e.target.value })}
                    className="h-9 px-3 rounded-lg border border-outline-variant text-sm text-on-surface"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
                  Tên đăng nhập (Username) *
                  <input
                    required
                    value={newStudentDraft.username}
                    onChange={e => setNewStudentDraft({ ...newStudentDraft, username: e.target.value })}
                    className="h-9 px-3 rounded-lg border border-outline-variant text-sm text-on-surface"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
                  Email *
                  <input
                    type="email"
                    required
                    value={newStudentDraft.email}
                    onChange={e => setNewStudentDraft({ ...newStudentDraft, email: e.target.value })}
                    className="h-9 px-3 rounded-lg border border-outline-variant text-sm text-on-surface"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
                  Mật khẩu khởi tạo *
                  <input
                    type="password"
                    required
                    value={newStudentDraft.password}
                    onChange={e => setNewStudentDraft({ ...newStudentDraft, password: e.target.value })}
                    className="h-9 px-3 rounded-lg border border-outline-variant text-sm text-on-surface"
                  />
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant mt-4">
              <button
                type="button"
                onClick={() => setShowAddStudentModal(false)}
                className="h-8 px-3 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface-variant"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={
                  addStudentMutation.isPending ||
                  (studentAddMode === "existing"
                    ? !pickedCandidateId
                    : !newStudentDraft.fullName || !newStudentDraft.username || !newStudentDraft.password)
                }
                onClick={() => addStudentMutation.mutate()}
                className="h-8 px-4 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {addStudentMutation.isPending ? "Đang thêm…" : "Thêm vào lớp"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Modal Phân công giáo viên */}
      {showAddTeacherModal && (
        <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowAddTeacherModal(false); }}>
          <section role="dialog" aria-modal="true" className="dialog-card !max-w-md">
            <header className="flex justify-between items-center mb-3">
              <h3 className="text-base font-bold text-on-surface">Phân công giáo viên vào lớp</h3>
              <button onClick={() => setShowAddTeacherModal(false)} className="text-xl">×</button>
            </header>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
                Chọn giáo viên
                <select
                  value={pickedTeacherId}
                  onChange={e => setPickedTeacherId(Number(e.target.value))}
                  className="h-9 px-3 rounded-lg border border-outline-variant text-sm text-on-surface"
                >
                  <option value={0}>-- Chọn giáo viên --</option>
                  {teacherUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.fullName} ({u.username})</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant mt-4">
              <button
                type="button"
                onClick={() => setShowAddTeacherModal(false)}
                className="h-8 px-3 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface-variant"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!pickedTeacherId || addTeacherMutation.isPending}
                onClick={() => addTeacherMutation.mutate()}
                className="h-8 px-4 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {addTeacherMutation.isPending ? "Đang phân công…" : "Xác nhận phân công"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function Member({
  name, meta, status, avatarUrl,
}: {
  name: string; meta: string; status?: string; avatarUrl?: string | null;
}) {
  const initials = name.split(/\s+/).slice(-2).map(x => x[0]).join("").toUpperCase();
  return (
    <div className="flex items-center gap-3">
      <span className="w-9 h-9 rounded-full bg-primary-container text-primary flex items-center justify-center text-sm font-bold overflow-hidden shrink-0">
        {avatarUrl ? <img src={avatarUrl} alt={`Ảnh đại diện ${name}`} className="w-full h-full object-cover" /> : initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-on-surface truncate">{name}</p>
        <p className="text-xs text-on-surface-variant">{meta}</p>
      </div>
      {status && (
        <span className={`text-xs font-semibold shrink-0 ${status === "ACTIVE" ? "text-secondary" : "text-on-surface-variant"}`}>
          {status === "ACTIVE" ? "Đang học" : status}
        </span>
      )}
    </div>
  );
}

// ─── 3. ClassMaterialsTab ─────────────────────────────────────────────────────

export function ClassMaterialsTab({
  session, classId, scheduleId,
}: {
  session: AuthSession;
  classId: number;
  scheduleId?: number;
}) {
  const qc = useQueryClient();
  const [browsing, setBrowsing] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [librarySource, setLibrarySource] = useState("");
  const [attachAs, setAttachAs] = useState<ClassRequirement>("TU_CHON");

  const hocLieuQuery = useQuery({
    queryKey: ["class-hoc-lieu", session.accessToken, classId, scheduleId],
    queryFn: () => getClassHocLieu(session, classId, scheduleId),
  });

  const docsQuery = useQuery({
    queryKey: ["class-documents", session.accessToken, classId],
    queryFn: () => getClassDocuments(session, classId),
  });

  const libraryQuery = useQuery({
    queryKey: ["class-document-library", session.accessToken, classId, librarySearch, librarySource],
    queryFn: () => getClassDocumentLibrary(session, classId, {
      search: librarySearch || undefined,
      source: librarySource || undefined,
    }),
    enabled: browsing,
  });

  const [selectedLibIds, setSelectedLibIds] = useState<Set<number>>(new Set());
  const [selectedAttIds, setSelectedAttIds] = useState<Set<number>>(new Set());

  const invalidateDocs = () => Promise.all([
    qc.invalidateQueries({ queryKey: ["class-documents"] }),
    qc.invalidateQueries({ queryKey: ["class-hoc-lieu"] }),
  ]);

  const attachMutation = useMutation({
    mutationFn: (documentId: number) => attachClassDocument(session, classId, { documentId, requirement: attachAs }),
    onSuccess: invalidateDocs,
  });

  const updateRequirementMutation = useMutation({
    mutationFn: ({ id, requirement }: { id: number; requirement: ClassRequirement }) =>
      updateClassDocument(session, classId, id, { requirement }),
    onSuccess: invalidateDocs,
  });

  const detachMutation = useMutation({
    mutationFn: (id: number) => detachClassDocument(session, classId, id),
    onSuccess: invalidateDocs,
  });

  const bulkAttachMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => attachClassDocument(session, classId, { documentId: id, requirement: attachAs })));
    },
    onSuccess: () => {
      setSelectedLibIds(new Set());
      invalidateDocs();
    },
  });

  const bulkDetachMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => detachClassDocument(session, classId, id)));
    },
    onSuccess: () => {
      setSelectedAttIds(new Set());
      invalidateDocs();
    },
  });

  const bulkUpdateReqMutation = useMutation({
    mutationFn: async ({ ids, requirement }: { ids: number[]; requirement: ClassRequirement }) => {
      await Promise.all(ids.map(id => updateClassDocument(session, classId, id, { requirement })));
    },
    onSuccess: () => {
      setSelectedAttIds(new Set());
      invalidateDocs();
    },
  });

  if (hocLieuQuery.isError) {
    return (
      <div role="alert" className="api-error">
        {hocLieuQuery.error.message}
        <button onClick={() => void hocLieuQuery.refetch()}>Thử lại</button>
      </div>
    );
  }

  if (hocLieuQuery.isLoading && !scheduleId) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-40 rounded-xl bg-surface-container animate-pulse" />
        <div className="h-40 rounded-xl bg-surface-container animate-pulse" />
      </div>
    );
  }

  const attachedDocs = docsQuery.data ?? [];
  const library = libraryQuery.data ?? [];

  const unattachedDocs = useMemo(() => library.filter(row => !row.attached), [library]);
  const allUnattachedSelected = unattachedDocs.length > 0 && unattachedDocs.every(row => selectedLibIds.has(row.id));
  const toggleSelectAllLibrary = () => {
    setSelectedLibIds(allUnattachedSelected ? new Set() : new Set(unattachedDocs.map(row => row.id)));
  };
  const toggleSelectLibrary = (id: number) => {
    setSelectedLibIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAttached = (id: number) => {
    setSelectedAttIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Attach action bar */}
      {!scheduleId && (
        <div className="flex items-center justify-between gap-3 flex-wrap bg-surface-container-lowest p-3 rounded-xl border border-outline-variant">
          <div>
            <h4 className="text-sm font-bold text-on-surface">Tài liệu & Học liệu của lớp</h4>
            <p className="text-xs text-on-surface-variant">
              {attachedDocs.length} tài liệu đã gắn vào lớp · Quản lý quyền đọc và tài liệu bắt buộc cho học sinh
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBrowsing(v => !v)}
            className="h-8 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold flex items-center gap-1 hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-[16px]">{browsing ? "close" : "add"}</span>
            {browsing ? "Đóng kho tài liệu" : "Gắn tài liệu vào lớp"}
          </button>
        </div>
      )}

      {/* Kho tài liệu browsing drawer */}
      {browsing && !scheduleId && (
        <div className="border border-outline-variant rounded-xl bg-surface-container-lowest overflow-hidden p-3 flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              placeholder="Tìm tài liệu theo tiêu đề..."
              value={librarySearch}
              onChange={e => setLibrarySearch(e.target.value)}
              className="h-8 px-3 rounded-lg border border-outline-variant text-xs text-on-surface flex-1 min-w-[200px]"
            />
            <select
              value={librarySource}
              onChange={e => setLibrarySource(e.target.value)}
              className="h-8 px-3 rounded-lg border border-outline-variant text-xs text-on-surface"
            >
              <option value="">Tất cả nguồn</option>
              <option value="KHO_CHUNG">Kho chung cấp trường</option>
              <option value="RIENG">Tài liệu riêng của tôi</option>
            </select>
            <select
              value={attachAs}
              onChange={e => setAttachAs(e.target.value as ClassRequirement)}
              className="h-8 px-3 rounded-lg border border-outline-variant text-xs text-on-surface"
            >
              <option value="TU_CHON">Gắn dạng Tự chọn</option>
              <option value="BAT_BUOC">Gắn dạng Bắt buộc</option>
            </select>
          </div>

          {unattachedDocs.length > 0 && (
            <div className="px-2 py-1.5 bg-surface-container-low/60 rounded-lg flex items-center justify-between gap-2 text-xs flex-wrap">
              <label className="flex items-center gap-1.5 font-medium text-on-surface cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-outline-variant text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                  checked={allUnattachedSelected}
                  onChange={toggleSelectAllLibrary}
                />
                <span>Chọn tất cả chưa gắn ({unattachedDocs.length})</span>
              </label>
              {selectedLibIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-primary">Đã chọn {selectedLibIds.size}</span>
                  <button
                    type="button"
                    disabled={bulkAttachMutation.isPending}
                    onClick={() => bulkAttachMutation.mutate([...selectedLibIds])}
                    className="px-2.5 py-1 rounded bg-primary text-on-primary font-semibold hover:opacity-90 transition-opacity"
                  >
                    {bulkAttachMutation.isPending ? "Đang gắn…" : `Gắn ${selectedLibIds.size} (${attachAs === "BAT_BUOC" ? "Bắt buộc" : "Tự chọn"})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLibIds(new Set())}
                    className="text-on-surface-variant hover:underline"
                  >
                    Bỏ chọn
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="max-h-60 overflow-y-auto divide-y divide-outline-variant">
            {libraryQuery.isLoading && <p className="py-4 text-center text-xs text-on-surface-variant">Đang tải kho tài liệu…</p>}
            {!libraryQuery.isLoading && !library.length && (
              <p className="py-4 text-center text-xs text-on-surface-variant">Không có tài liệu nào khớp.</p>
            )}
            {library.map(row => (
              <div key={row.id} className={`flex items-center justify-between gap-3 py-2 px-1 hover:bg-surface-container-low transition-colors ${selectedLibIds.has(row.id) ? "bg-primary/5" : ""}`}>
                <div className="flex items-center gap-2 min-w-0">
                  {!row.attached ? (
                    <input
                      type="checkbox"
                      className="rounded border-outline-variant text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer shrink-0"
                      checked={selectedLibIds.has(row.id)}
                      onChange={() => toggleSelectLibrary(row.id)}
                    />
                  ) : (
                    <span className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{row.title}</p>
                    <p className="text-xs text-on-surface-variant">
                      {row.source === "KHO_CHUNG" ? "Kho chung" : "Tài liệu riêng"} · {row.doc_type}
                      {row.taxonomy_title && ` · ${row.taxonomy_title}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={row.attached || attachMutation.isPending}
                  onClick={() => attachMutation.mutate(row.id)}
                  className={`h-7 px-2.5 rounded text-xs font-semibold transition-colors ${
                    row.attached
                      ? "text-on-surface-variant bg-surface-container"
                      : "bg-primary text-on-primary hover:opacity-90"
                  }`}
                >
                  {row.attached ? "Đã gắn" : "Gắn"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danh sách tài liệu riêng của lớp (với nút đổi Bắt buộc / Tự chọn, Gỡ) */}
      {!scheduleId && attachedDocs.length > 0 && (
        <article className="border border-outline-variant rounded-xl bg-surface-container-lowest p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h4 className="text-sm font-bold text-on-surface">Tài liệu đã gắn cho lớp ({attachedDocs.length})</h4>
          </div>

          {selectedAttIds.size > 0 && (
            <div className="p-2.5 mb-3 rounded-lg bg-primary-container text-on-primary-container flex flex-wrap items-center gap-2 text-xs shadow-sm">
              <strong className="font-semibold">Đã chọn {selectedAttIds.size} tài liệu</strong>
              <button
                type="button"
                disabled={bulkUpdateReqMutation.isPending}
                onClick={() => bulkUpdateReqMutation.mutate({ ids: [...selectedAttIds], requirement: "BAT_BUOC" })}
                className="h-6 px-2 rounded bg-white text-on-surface font-semibold hover:bg-white/90 shadow-sm"
              >
                Đổi sang Bắt buộc
              </button>
              <button
                type="button"
                disabled={bulkUpdateReqMutation.isPending}
                onClick={() => bulkUpdateReqMutation.mutate({ ids: [...selectedAttIds], requirement: "TU_CHON" })}
                className="h-6 px-2 rounded bg-white text-on-surface font-semibold hover:bg-white/90 shadow-sm"
              >
                Đổi sang Tự chọn
              </button>
              <button
                type="button"
                disabled={bulkDetachMutation.isPending}
                onClick={() => {
                  if (confirm(`Gỡ ${selectedAttIds.size} tài liệu đã chọn khỏi lớp?`)) {
                    bulkDetachMutation.mutate([...selectedAttIds]);
                  }
                }}
                className="h-6 px-2 rounded bg-white text-error border border-error/30 font-semibold hover:bg-error-container shadow-sm"
              >
                {bulkDetachMutation.isPending ? "Đang gỡ…" : "Gỡ khỏi lớp"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedAttIds(new Set())}
                className="hover:underline ml-auto"
              >
                Bỏ chọn
              </button>
            </div>
          )}

          <div className="divide-y divide-outline-variant">
            {attachedDocs.map(doc => (
              <div key={doc.id} className={`flex items-center justify-between gap-3 py-2.5 ${selectedAttIds.has(doc.id) ? "bg-primary/5" : ""}`}>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    className="rounded border-outline-variant text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer shrink-0"
                    checked={selectedAttIds.has(doc.id)}
                    onChange={() => toggleSelectAttached(doc.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => void openDocumentFile(session, doc.file_url, doc.title)}
                      className="text-sm font-semibold text-on-surface hover:text-primary text-left truncate block max-w-full"
                    >
                      {doc.title}
                    </button>
                    <p className="text-xs text-on-surface-variant">
                      {doc.doc_type} · {doc.source === "KHO_CHUNG" ? "Kho chung" : "Riêng giáo viên"}
                      {doc.note && ` · ${doc.note}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => updateRequirementMutation.mutate({
                      id: doc.id,
                      requirement: doc.requirement === "BAT_BUOC" ? "TU_CHON" : "BAT_BUOC",
                    })}
                    className={`px-2 py-0.5 rounded text-xs font-bold transition-colors ${
                      doc.requirement === "BAT_BUOC" ? "bg-primary-container text-primary" : "bg-surface-container text-on-surface-variant"
                    }`}
                    title="Bấm để đổi chế độ Bắt buộc / Tự chọn"
                  >
                    {doc.requirement === "BAT_BUOC" ? "Bắt buộc" : "Tự chọn"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void openDocumentFile(session, doc.file_url, doc.title)}
                    className="h-7 px-2 text-xs font-semibold text-primary hover:underline"
                  >
                    Xem
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Gỡ tài liệu "${doc.title}" khỏi lớp?`)) {
                        detachMutation.mutate(doc.id);
                      }
                    }}
                    className="h-7 px-2 text-xs font-semibold text-error hover:bg-error-container/30 rounded"
                  >
                    Gỡ
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      )}

      {/* Grouped view: Theo nội dung & Riêng lớp */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DocumentGroup
          title="Tài liệu theo bài học / chuyên đề"
          rows={hocLieuQuery.data?.theoNoiDung ?? []}
          session={session}
          empty="Chưa có tài liệu theo nội dung."
        />
        <DocumentGroup
          title="Tài liệu riêng theo lớp"
          rows={hocLieuQuery.data?.riengLop ?? []}
          session={session}
          empty="Chưa có tài liệu riêng của lớp."
        />
      </div>
    </div>
  );
}

function groupByChapter(rows: HocLieuItem[]) {
  const chapters = new Map<string, { title: string; lessons: Map<string, { title: string | null; rows: HocLieuItem[] }> }>();
  for (const x of rows) {
    const ck = x.chuongId == null ? "chung" : String(x.chuongId);
    if (!chapters.has(ck)) chapters.set(ck, { title: x.chuongTen ?? "Tài liệu chung", lessons: new Map() });
    const lessons = chapters.get(ck)!.lessons;
    const lk = x.baiId == null ? "chung" : String(x.baiId);
    if (!lessons.has(lk)) lessons.set(lk, { title: x.baiTen ?? null, rows: [] });
    lessons.get(lk)!.rows.push(x);
  }
  return [...chapters.entries()].map(([key, c]) => ({
    key, title: c.title, lessons: [...c.lessons.entries()].map(([k, l]) => ({ key: k, ...l })),
  }));
}

export function DocumentGroup({
  title, rows, session, empty,
}: {
  title: string; rows: HocLieuItem[]; session: AuthSession; empty: string;
}) {
  const [error, setError] = useState("");
  const groups = groupByChapter(rows);

  const item = (x: HocLieuItem) => (
    <button
      key={x.id}
      disabled={!x.fileUrl}
      onClick={() => {
        setError("");
        if (x.fileUrl) {
          void openDocumentFile(session, x.fileUrl, x.tieuDe).catch(reason =>
            setError(reason instanceof Error ? reason.message : "Không thể mở tài liệu.")
          );
        }
      }}
      className="w-full flex items-start justify-between gap-3 py-2 text-left hover:text-primary focus-visible:outline-primary disabled:opacity-50 disabled:hover:text-inherit"
    >
      <span className="min-w-0">
        <b title={x.tieuDe} className="block text-sm line-clamp-2 break-words">{x.tieuDe}</b>
        <small className="block mt-0.5 text-xs text-on-surface-variant">
          {x.loaiNguon === "DOCUMENT" ? "Tài liệu" : x.loaiNguon === "VIDEO" ? "Video" : "Bài giao"}
          {x.docType && x.docType !== "VIDEO" ? ` · ${x.docType}` : ""}
        </small>
      </span>
      <span className="shrink-0 text-xs font-semibold text-primary">{x.fileUrl ? "Xem" : "Chưa có tệp"}</span>
    </button>
  );

  return (
    <article className="min-w-0 border border-outline-variant rounded-xl bg-surface-container-lowest p-4">
      <h3 className="font-bold text-on-surface text-sm">{title} <span className="font-normal text-on-surface-variant">({rows.length})</span></h3>
      {error && <p role="alert" className="p-3 mt-3 rounded-lg bg-error-container text-error text-xs">{error}</p>}
      <div className="mt-2 flex flex-col gap-3">
        {groups.map(c => (
          <section key={c.key} className="min-w-0">
            <h4 className="text-xs font-bold text-on-surface pt-2 uppercase tracking-wide text-primary">{c.title}</h4>
            {c.lessons.map(l => (
              <div key={l.key} className="min-w-0 pl-3 border-l border-outline-variant mt-1">
                {l.title && <p className="text-xs font-semibold text-on-surface-variant pt-1">{l.title}</p>}
                <div className="divide-y divide-outline-variant">{l.rows.map(item)}</div>
              </div>
            ))}
          </section>
        ))}
        {!rows.length && <p className="py-5 text-xs text-on-surface-variant text-center">{empty}</p>}
      </div>
    </article>
  );
}

// ─── 4. ClassProgressTab ──────────────────────────────────────────────────────

export function ClassProgressTab({
  progress, schedule,
}: {
  progress?: ClassScheduleProgress;
  schedule: ClassScheduleRow[];
}) {
  if (!progress) return <Empty text="Chưa có dữ liệu tiến độ." />;
  const label = progress.lech === 0 ? "Đúng tiến độ"
    : progress.lech < 0 ? `Chậm ${Math.abs(progress.lech)} buổi`
    : `Nhanh ${progress.lech} buổi`;
  const current = schedule.find(x => x.status !== "COMPLETED" && x.status !== "CANCELLED") ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <article className="border border-outline-variant rounded-xl bg-surface-container-lowest p-5">
        <h3 className="font-bold text-on-surface text-sm mb-3">So sánh tiến độ học tập</h3>
        <dl className="divide-y divide-outline-variant">
          {[
            ["Theo kế hoạch", `Buổi ${progress.theoKeHoach}`],
            ["Thực tế đã dạy", `Buổi ${progress.thucTe}`],
            ["Chênh lệch", `${progress.lech > 0 ? "+" : ""}${progress.lech} buổi`],
            ["Tổng số buổi của khóa", `${progress.tongBuoi} buổi`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-2.5 text-sm">
              <dt className="text-on-surface-variant">{k}</dt>
              <dd className="font-bold text-on-surface data-tabular">{v}</dd>
            </div>
          ))}
        </dl>
        <span className={`status-chip inline-block mt-4 px-3 py-1.5 text-xs font-bold ${
          progress.lech === 0 ? "bg-secondary-container text-secondary"
            : progress.lech < 0 ? "bg-error-container text-error"
            : "bg-primary-container text-primary"
        }`}>
          {label}
        </span>
      </article>

      <article className="border border-outline-variant rounded-xl bg-surface-container-lowest p-5">
        <h3 className="font-bold text-on-surface text-sm mb-3">Buổi học tiếp theo</h3>
        {current ? (
          <div className="rounded-xl bg-primary text-on-primary p-5">
            <p className="text-xs font-bold uppercase tracking-wider opacity-80">Nội dung tiếp theo</p>
            <h4 className="text-base font-bold mt-2">{sessionTitle(current) || `Buổi ${current.seq}`}</h4>
            <p className="text-xs mt-2 opacity-80">
              Buổi {current.seq} {current.scheduledDate && `· ${dateVi(current.scheduledDate)}`}
              {periodLabel(current) ? ` · ${periodLabel(current)}` : ""}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-on-surface-variant">Lớp đã hoàn thành toàn bộ lịch học.</p>
        )}
      </article>
    </div>
  );
}

