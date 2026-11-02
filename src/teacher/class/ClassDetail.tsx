import "./class-detail.css";
import { navigateAdmin } from "../../admin/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, FileEdit, XCircle } from "lucide-react";
import {
  getClassRoster, getClassSchedule, getClassScheduleProgress, getClassWeeklySlots,
  getClassDaysOff, getEnrollments, getGrades, updateClass, deleteClass,
  type AuthSession, type Classroom, type ClassroomInput,
} from "../../api";
import { messageOf } from "../../lib/errors";
import { ClassOverviewTab, ClassSummary } from "./ClassDetailOverview";
import { ClassMaterialsTab, ClassMembersTab, ClassProgressTab, ClassScheduleTab } from "./ClassDetailTabs";
import { ClassCurriculumPanel } from "./ClassCurriculumPanel";
import { ClassTaskPanel } from "./ClassTaskPanel";
import { ClassSessionDetail } from "./ClassSessionDetail";
import { ClassDaysOff } from "../../admin/ClassDaysOff";

type Tab = "overview" | "schedule" | "curriculum" | "members" | "materials" | "tasks" | "progress";

const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Tổng quan" },
  { id: "schedule", label: "Lịch học" },
  { id: "curriculum", label: "Chương trình" },
  { id: "members", label: "Thành viên" },
  { id: "materials", label: "Học liệu" },
  { id: "tasks", label: "Nhiệm vụ" },
  { id: "progress", label: "Tiến độ" },
];

export function ClassDetail({
  session, classroom, onClose, membersPanel, setupPanel,
}: {
  session: AuthSession;
  classroom: Classroom;
  onClose: () => void;
  membersPanel?: React.ReactNode;
  setupPanel?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const [openedSession, setOpenedSession] = useState<number | null>(null);

  // Edit class modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDaysOffModal, setShowDaysOffModal] = useState(false);
  const [currentClass, setCurrentClass] = useState<Classroom>(classroom);
  const [editForm, setEditForm] = useState<ClassroomInput>({
    name: classroom.name,
    code: classroom.code,
    gradeId: classroom.gradeId,
    status: classroom.status,
    startDate: classroom.startDate ? classroom.startDate.slice(0, 10) : "",
    description: classroom.description ?? "",
  });

  const scheduleQuery = useQuery({
    queryKey: ["class-detail-schedule", session.accessToken, currentClass.id],
    queryFn: () => getClassSchedule(session, currentClass.id),
  });
  const progressQuery = useQuery({
    queryKey: ["class-detail-progress", session.accessToken, currentClass.id],
    queryFn: () => getClassScheduleProgress(session, currentClass.id),
  });
  const slotsQuery = useQuery({
    queryKey: ["class-detail-slots", session.accessToken, currentClass.id],
    queryFn: () => getClassWeeklySlots(session, currentClass.id),
  });
  const daysOffQuery = useQuery({
    queryKey: ["class-detail-days-off", session.accessToken, currentClass.id],
    queryFn: () => getClassDaysOff(session, currentClass.id),
  });
  const peopleQuery = useQuery({
    queryKey: ["class-detail-people", session.accessToken, currentClass.id],
    queryFn: async () => {
      const [teachers, students, courses] = await Promise.all([
        getEnrollments(session, "class-teachers", currentClass.id),
        getClassRoster(session, currentClass.id),
        getEnrollments(session, "class-courses", currentClass.id),
      ]);
      return { teachers, students, courses };
    },
  });
  const gradesQuery = useQuery({
    queryKey: ["grades", session.accessToken],
    queryFn: () => getGrades(session),
    enabled: showEditModal,
  });

  const invalidateAll = () => {
    Promise.all([
      qc.invalidateQueries({ queryKey: ["admin-classes-panel"] }),
      qc.invalidateQueries({ queryKey: ["admin-classes"] }),
      qc.invalidateQueries({ queryKey: ["classes"] }),
      qc.invalidateQueries({ queryKey: ["teacher-classes"] }),
      qc.invalidateQueries({ queryKey: ["class-detail-schedule"] }),
      qc.invalidateQueries({ queryKey: ["class-detail-progress"] }),
      qc.invalidateQueries({ queryKey: ["class-detail-slots"] }),
      qc.invalidateQueries({ queryKey: ["class-detail-days-off"] }),
      qc.invalidateQueries({ queryKey: ["class-detail-people"] }),
    ]);
  };

  const updateMutation = useMutation({
    mutationFn: (input: ClassroomInput) => updateClass(session, currentClass.id, input),
    onSuccess: (updated) => {
      setCurrentClass(prev => ({ ...prev, ...updated }));
      invalidateAll();
      setShowEditModal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteClass(session, currentClass.id),
    onSuccess: () => {
      invalidateAll();
      onClose();
    },
  });

  const loading = [scheduleQuery, progressQuery, slotsQuery, peopleQuery].some(x => x.isLoading);
  const error = [scheduleQuery, progressQuery, slotsQuery, peopleQuery, updateMutation, deleteMutation].find(x => x.isError)?.error;
  const schedule = scheduleQuery.data ?? [];
  const slots = slotsQuery.data ?? [];
  const people = peopleQuery.data;
  const course = people?.courses[0];
  const grades = gradesQuery.data ?? [];

  const handleOpenEdit = () => {
    setEditForm({
      name: currentClass.name,
      code: currentClass.code,
      gradeId: currentClass.gradeId,
      status: currentClass.status,
      startDate: currentClass.startDate ? currentClass.startDate.slice(0, 10) : "",
      description: currentClass.description ?? "",
    });
    setShowEditModal(true);
  };

  const handleSaveClass = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(editForm);
  };

  const handleDeleteClass = () => {
    if (confirm(`Xóa lớp "${currentClass.name}"? Dữ liệu lịch sử và các buổi học sẽ được gỡ bỏ.`)) {
      deleteMutation.mutate();
    }
  };

  return (
    <section className="class-detail-page bg-[#f9fafb] p-3 md:p-3.5 flex flex-col gap-2.5">
      {/* Breadcrumb & Actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button 
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Quay lại danh sách lớp
        </button>
        <div className="flex items-center gap-1.5">
          <button 
            type="button"
            onClick={handleOpenEdit}
            className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-300 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
          >
            <FileEdit className="w-3 h-3" /> Chỉnh sửa
          </button>
          <button 
            type="button"
            onClick={handleDeleteClass}
            className="flex items-center gap-1 px-2.5 py-1 bg-white border border-red-200 text-red-600 rounded-md text-xs font-medium hover:bg-red-50 transition-colors shadow-xs cursor-pointer"
          >
            <XCircle className="w-3 h-3" /> Đóng lớp
          </button>
        </div>
      </div>

      {/* Class Header Card & Stats Row */}
      {loading ? <DetailSkeleton /> : (
        <ClassSummary
          classroom={currentClass}
          course={course}
          slots={slots}
          progress={progressQuery.data}
          studentCount={people?.students?.length}
          teacherName={people?.teachers?.map(t => t.label).join(", ") || "Chưa phân công"}
          gradeName={grades.find(g => g.id === currentClass.gradeId)?.name}
        />
      )}

      {error && <div className="api-error">{messageOf(error)}</div>}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4 sm:gap-6 overflow-x-auto thin-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`pb-2 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap cursor-pointer border-0 bg-transparent ${
                tab === t.id
                  ? "text-emerald-600 font-semibold"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
              {tab === t.id && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-600 rounded-t-full" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Panels Content */}
      {loading ? <PanelSkeleton /> : (
        <div>
          {tab === "overview" && (
            <>
              <ClassOverviewTab
                session={session}
                classId={currentClass.id}
                classroom={currentClass}
                course={course}
                slots={slots}
                schedule={schedule}
                progress={progressQuery.data}
                daysOffCount={daysOffQuery.data?.length ?? 0}
                onGoToTab={(target) => setTab(target as Tab)}
                onOpenSessionDetail={(sId) => { setSelectedSession(sId); setOpenedSession(sId); }}
                onEditClass={handleOpenEdit}
                onManageDaysOff={() => setShowDaysOffModal(true)}
              />
              {setupPanel && <div className="mt-6">{setupPanel}</div>}
            </>
          )}

          {tab === "schedule" && (
            <ClassScheduleTab
              session={session}
              classId={currentClass.id}
              slots={slots}
              schedule={schedule}
              projectedEnd={progressQuery.data?.projectedEndDate}
              onSelect={id => { setSelectedSession(id); setOpenedSession(id); }}
            />
          )}

          {tab === "curriculum" && (
            <ClassCurriculumPanel session={session} classId={currentClass.id} />
          )}

          {tab === "members" && (
            membersPanel ?? (
              <ClassMembersTab
                session={session}
                classId={currentClass.id}
                teachers={people?.teachers ?? []}
                students={people?.students ?? []}
              />
            )
          )}

          {tab === "materials" && (
            <div className="space-y-4">
              <label className="text-sm text-gray-700 flex items-center gap-2">
                <span>Buổi học</span>
                <select
                  className="border border-gray-300 rounded-lg p-2 text-sm bg-white"
                  value={selectedSession ?? ""}
                  onChange={e => setSelectedSession(Number(e.target.value) || null)}
                >
                  <option value="">Tất cả học liệu của lớp</option>
                  {schedule.map(row => (
                    <option key={row.id} value={row.id}>
                      Buổi {row.seq} · {row.sessionTitle || row.scheduledDate}
                    </option>
                  ))}
                </select>
              </label>
              <ClassMaterialsTab session={session} classId={currentClass.id} scheduleId={selectedSession ?? undefined} />
            </div>
          )}

          {tab === "tasks" && (
            <ClassTaskPanel session={session} classId={currentClass.id} />
          )}

          {tab === "progress" && (
            <ClassProgressTab progress={progressQuery.data} schedule={schedule} />
          )}
        </div>
      )}

      {/* Session detail / edit modal */}
      {openedSession && schedule.find(row => row.id === openedSession) && (
        <ClassSessionDetail
          session={session}
          classId={currentClass.id}
          row={schedule.find(row => row.id === openedSession)!}
          onClose={() => setOpenedSession(null)}
        />
      )}

      {/* Edit Class Modal */}
      {showEditModal && (
        <div
          className="dialog-backdrop"
          onMouseDown={e => { if (e.target === e.currentTarget) setShowEditModal(false); }}
        >
          <section role="dialog" aria-modal="true" className="dialog-card !max-w-lg">
            <header className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Chỉnh sửa thông tin lớp</h3>
                <p className="text-xs text-gray-500 mt-0.5">Cân chỉnh thông tin chung, ngày bắt đầu và trạng thái</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-xl text-gray-400 hover:text-gray-600">×</button>
            </header>

            <form onSubmit={handleSaveClass} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                  Mã lớp *
                  <input
                    required
                    maxLength={30}
                    value={editForm.code}
                    onChange={e => setEditForm(prev => ({ ...prev, code: e.target.value }))}
                    className="h-9 px-3 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-emerald-500"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                  Khối lớp *
                  <select
                    value={editForm.gradeId}
                    onChange={e => setEditForm(prev => ({ ...prev, gradeId: Number(e.target.value) }))}
                    className="h-9 px-3 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-emerald-500"
                  >
                    {grades.length > 0 ? (
                      grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)
                    ) : (
                      <>
                        <option value={1}>Khối 9</option>
                        <option value={2}>Khối 10</option>
                        <option value={editForm.gradeId}>Khối {editForm.gradeId}</option>
                      </>
                    )}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                Tên lớp *
                <input
                  required
                  maxLength={120}
                  value={editForm.name}
                  onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="h-9 px-3 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-emerald-500"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                  Ngày bắt đầu / Khai giảng
                  <input
                    type="date"
                    value={editForm.startDate ?? ""}
                    onChange={e => setEditForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="h-9 px-3 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-emerald-500"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                  Trạng thái lớp
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value as Classroom["status"] }))}
                    className="h-9 px-3 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ACTIVE">Đang học</option>
                    <option value="INACTIVE">Tạm dừng</option>
                    <option value="COMPLETED">Đã hoàn thành</option>
                    <option value="ARCHIVED">Lưu trữ</option>
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                Mô tả / Ghi chú về lớp
                <textarea
                  rows={3}
                  value={editForm.description ?? ""}
                  placeholder="Nhập mô tả, mục tiêu hoặc ghi chú riêng cho lớp học…"
                  onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  className="p-3 rounded-lg border border-gray-300 text-sm text-gray-900 resize-none focus:outline-none focus:border-emerald-500"
                />
              </label>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDeleteClass}
                  disabled={deleteMutation.isPending}
                  className="text-xs text-red-600 underline hover:opacity-80 transition-opacity"
                >
                  {deleteMutation.isPending ? "Đang xóa lớp…" : "Xóa lớp học này"}
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 mt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="h-8 px-3 rounded-lg border border-gray-300 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="h-8 px-4 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {updateMutation.isPending ? "Đang lưu…" : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Days Off Modal */}
      {showDaysOffModal && (
        <div
          className="dialog-backdrop"
          onMouseDown={e => { if (e.target === e.currentTarget) setShowDaysOffModal(false); }}
        >
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl p-5 max-h-[85vh] overflow-y-auto border border-gray-200">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Quản lý ngày nghỉ riêng của lớp</h3>
                <p className="text-xs text-gray-500 mt-0.5">Thêm các ngày nghỉ đột xuất hoặc kỳ nghỉ riêng cho lớp này</p>
              </div>
              <button onClick={() => setShowDaysOffModal(false)} className="text-xl text-gray-400 hover:text-gray-600">×</button>
            </div>
            <ClassDaysOff session={session} classId={currentClass.id} />
          </div>
        </div>
      )}
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-label="Đang tải thông tin lớp">
      <div className="h-32 rounded-xl bg-gray-100 animate-pulse" />
      <div className="h-32 rounded-xl bg-gray-100 animate-pulse" />
      <div className="h-32 rounded-xl bg-gray-100 animate-pulse" />
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" aria-label="Đang tải nội dung">
      <div className="h-52 rounded-xl bg-gray-100 animate-pulse" />
      <div className="h-52 rounded-xl bg-gray-100 animate-pulse" />
    </div>
  );
}
