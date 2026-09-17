/**
 * AdminClassesPanel — Master-detail layout cho quản lý lớp học.
 *
 * LAYOUT:
 *   [ClassNavigator | collapsed: 64px, expanded: 300px]  [ClassDetailPane | flex-1]
 *
 * STATES:
 *   - Chưa chọn lớp: Navigator rộng, Detail = empty state
 *   - Đã chọn lớp:   Navigator tự thu gọn, Detail chiếm phần còn lại
 *   - Người dùng có thể toggle navigator bất kỳ lúc nào
 *
 * DỮ LIỆU: 100% từ API thật — không hardcode.
 */

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminClassOverview, getGrades, getEnrollments, createClass, updateClass, deleteClass,
  getClassSchedule, getClassScheduleProgress, getClassWeeklySlots,
  getClassRoster, getClassHocLieu, completeClassSession, postponeClassSession,
  type AdminClassOverviewRow, type AuthSession, type Classroom, type ClassroomInput,
} from "../api";
import { useMetadata, metadataOptions, firstMetadataValue } from "../hooks/useMetadata";
import { messageOf } from "../lib/errors";
import { AdminDrawer } from "./components/AdminDrawer";
import { AdminEmptyState } from "./components/AdminEmptyState";
import { SearchInput } from "./components/AdminFilterBar";
import { Button } from "../components/ui/button";
import { ClassOverviewTab, ClassSummary, findCurrent } from "../teacher/class/ClassDetailOverview";
import { ClassScheduleTab, ClassMembersTab, ClassMaterialsTab, ClassProgressTab } from "../teacher/class/ClassDetailTabs";
import { ClassEnrollmentPanel } from "./AdminShell";
import { ClassCurriculumPanel } from "../teacher/class/ClassCurriculumPanel";
import { ClassTaskPanel } from "../teacher/class/ClassTaskPanel";
import "../teacher/class/class-detail.css";

// ─── Types ───────────────────────────────────────────────────────────────────

type DetailTab = "overview" | "curriculum" | "schedule" | "members" | "materials" | "tasks" | "progress";

const DETAIL_TABS: { id: DetailTab; label: string; icon: string }[] = [
  { id: "overview",    label: "Tổng quan",   icon: "dashboard" },
  { id: "curriculum",  label: "Chương trình", icon: "menu_book" },
  { id: "schedule",    label: "Lịch học",     icon: "calendar_month" },
  { id: "members",     label: "Thành viên",   icon: "group" },
  { id: "materials",   label: "Học liệu",     icon: "folder_open" },
  { id: "tasks",       label: "Nhiệm vụ",     icon: "assignment" },
  { id: "progress",    label: "Tiến độ",      icon: "trending_up" },
];

const CLASS_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Đang học", INACTIVE: "Tạm dừng", COMPLETED: "Đã hoàn thành", ARCHIVED: "Lưu trữ",
};
const CLASS_STATUS_COLOR: Record<string, string> = {
  ACTIVE: "text-primary bg-primary-container",
  INACTIVE: "text-on-surface-variant bg-surface-container",
  COMPLETED: "text-secondary bg-secondary-container",
  ARCHIVED: "text-on-surface-variant bg-surface-container-high",
};

const asClassroom = (row: AdminClassOverviewRow): Classroom => ({
  id: row.id, code: row.code, name: row.name, gradeId: row.grade_id,
  status: row.status as Classroom["status"],
  teacherCount: Number(row.teacher_count), studentCount: Number(row.student_count),
  courseCount: Number(row.course_count), createdAt: row.created_at,
  description: row.description, curriculumCount: Number(row.curriculum_count),
  documentCount: Number(row.document_count), startDate: row.start_date,
});

// ─── ClassNavigator ───────────────────────────────────────────────────────────

interface NavigatorProps {
  session: AuthSession;
  classes: Classroom[];
  overviewRows: AdminClassOverviewRow[];
  selectedId: number | null;
  onSelect: (cls: Classroom) => void;
  expanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
  search: string;
  onSearch: (v: string) => void;
  isLoading: boolean;
}

function ClassNavigator({
  classes, overviewRows, selectedId, onSelect, expanded, onToggle, onAdd, search, onSearch, isLoading,
}: NavigatorProps) {
  const teacherNames = Object.fromEntries(
    overviewRows.map(r => [r.id, r.teacher_names?.split(", ").filter(Boolean)[0] ?? ""])
  );

  return (
    <div className={`class-navigator${expanded ? " expanded" : " collapsed"}`} aria-label="Danh sách lớp học">
      {/* Navigator header */}
      <div className="class-nav-header">
        <button
          type="button"
          className="class-nav-toggle"
          onClick={onToggle}
          title={expanded ? "Thu gọn danh sách" : "Mở danh sách"}
          aria-expanded={expanded}
        >
          <span className="material-symbols-outlined">
            {expanded ? "menu_open" : "menu"}
          </span>
        </button>
        {expanded && (
          <button
            type="button"
            className="class-nav-add"
            onClick={onAdd}
            title="Tạo lớp mới"
            aria-label="Tạo lớp mới"
          >
            <span className="material-symbols-outlined">add</span>
          </button>
        )}
      </div>

      {/* Search — only when expanded */}
      {expanded && (
        <div className="class-nav-search">
          <SearchInput placeholder="Tìm lớp…" value={search} onChange={onSearch} />
        </div>
      )}

      {/* Class list */}
      <div className="class-nav-list" role="listbox" aria-label="Danh sách lớp">
        {isLoading && (
          <div className="class-nav-loading">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="class-nav-skeleton animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && classes.map(cls => {
          const initials = cls.name.split(/\s+/).slice(-2).map(w => w[0]).join("").toUpperCase().slice(0, 2);
          const isSelected = cls.id === selectedId;
          const teacher = teacherNames[cls.id] ?? "";

          return (
            <button
              key={cls.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={`class-nav-item${isSelected ? " selected" : ""}`}
              onClick={() => onSelect(cls)}
              title={!expanded ? `${cls.name}${teacher ? ` · ${teacher}` : ""}` : undefined}
            >
              {/* Avatar / initials */}
              <span className={`class-nav-avatar${isSelected ? " selected" : ""}`}>
                {initials || cls.code.slice(0, 2).toUpperCase()}
              </span>

              {/* Info — hidden when collapsed */}
              {expanded && (
                <span className="class-nav-info">
                  <span className="class-nav-name">{cls.name}</span>
                  <span className="class-nav-meta">
                    {cls.code}
                    {teacher && ` · ${teacher}`}
                  </span>
                </span>
              )}

              {/* Status dot */}
              {expanded && (
                <span className={`class-nav-dot${cls.status === "ACTIVE" ? " active" : ""}`} />
              )}
            </button>
          );
        })}

        {!isLoading && classes.length === 0 && expanded && (
          <p className="class-nav-empty">Không tìm thấy lớp nào.</p>
        )}
      </div>

      {/* Add button at bottom when collapsed */}
      {!expanded && (
        <div className="class-nav-footer">
          <button
            type="button"
            className="class-nav-item"
            onClick={onAdd}
            title="Tạo lớp mới"
          >
            <span className="class-nav-avatar add">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ClassDetailPane ──────────────────────────────────────────────────────────

interface DetailPaneProps {
  session: AuthSession;
  classroom: Classroom;
  onEdit: () => void;
  onManageMembers: () => void;
  onClose: () => void;
}

function ClassDetailPane({ session, classroom, onEdit, onManageMembers }: DetailPaneProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const tabRef = useRef<HTMLDivElement>(null);

  // Reset tab khi đổi lớp
  useEffect(() => { setActiveTab("overview"); setSelectedSession(null); }, [classroom.id]);

  // ── Data queries (chỉ fetch khi có classroom) ──
  const scheduleQuery = useQuery({
    queryKey: ["cp-schedule", session.accessToken, classroom.id],
    queryFn: () => getClassSchedule(session, classroom.id),
  });
  const progressQuery = useQuery({
    queryKey: ["cp-progress", session.accessToken, classroom.id],
    queryFn: () => getClassScheduleProgress(session, classroom.id),
  });
  const slotsQuery = useQuery({
    queryKey: ["cp-slots", session.accessToken, classroom.id],
    queryFn: () => getClassWeeklySlots(session, classroom.id),
  });
  const peopleQuery = useQuery({
    queryKey: ["cp-people", session.accessToken, classroom.id],
    queryFn: async () => {
      const [teachers, students, courses] = await Promise.all([
        getEnrollments(session, "class-teachers", classroom.id),
        getClassRoster(session, classroom.id),
        getEnrollments(session, "class-courses", classroom.id),
      ]);
      return { teachers, students, courses };
    },
  });

  const schedule = scheduleQuery.data ?? [];
  const slots = slotsQuery.data ?? [];
  const people = peopleQuery.data;
  const course = people?.courses[0];
  const isBaseLoading = scheduleQuery.isLoading || progressQuery.isLoading || slotsQuery.isLoading;

  const qc = useQueryClient();
  const invalidateSchedule = () => Promise.all([
    qc.invalidateQueries({ queryKey: ["cp-schedule", session.accessToken, classroom.id] }),
    qc.invalidateQueries({ queryKey: ["cp-progress", session.accessToken, classroom.id] }),
  ]);

  return (
    <div className="class-detail-pane class-detail-page">
      {/* ── Header ── */}
      <header className="class-detail-pane-header">
        <div className="cdp-header-left">
          <div className="cdp-title-row">
            <h2 className="cdp-class-name">{classroom.name}</h2>
            <span className={`cdp-status-badge status-chip ${CLASS_STATUS_COLOR[classroom.status] ?? ""}`}>
              {CLASS_STATUS_LABEL[classroom.status] ?? classroom.status}
            </span>
          </div>
          <p className="cdp-class-meta">
            Mã lớp: <strong>{classroom.code}</strong>
            {course?.label && (
              <> · Khóa học: <strong>{course.label}</strong></>
            )}
          </p>
        </div>
        <div className="cdp-header-actions">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
            Chỉnh sửa
          </Button>
          <Button size="sm" onClick={onManageMembers}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>group</span>
            Quản lý học sinh
          </Button>
        </div>
      </header>

      {/* ── KPI Summary (chỉ render khi tab overview, tải dữ liệu từ API) ── */}
      {activeTab === "overview" && (
        <div className="cdp-kpi-row">
          {isBaseLoading ? (
            <div className="cdp-kpi-skeleton animate-pulse" />
          ) : (
            <ClassSummary
              classroom={classroom}
              course={course}
              slots={slots}
              progress={progressQuery.data}
            />
          )}
        </div>
      )}

      {/* ── Tab navigation ── */}
      <nav className="cdp-tabs" ref={tabRef} role="tablist" aria-label="Nội dung lớp học">
        {DETAIL_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`cdp-tab${activeTab === tab.id ? " active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="material-symbols-outlined cdp-tab-icon">{tab.icon}</span>
            <span className="cdp-tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* ── Tab content — chỉ render module đang active ── */}
      <div className="cdp-content">
        {activeTab === "overview" && (
          isBaseLoading ? <PanelSkeleton /> : (
            <ClassOverviewTab
              session={session}
              classId={classroom.id}
              classroom={classroom}
              course={course}
              slots={slots}
              schedule={schedule}
              progress={progressQuery.data}
              onGoToTab={(t) => setActiveTab(t as DetailTab)}
              onOpenSessionDetail={(sId) => setSelectedSession(sId)}
              onEditClass={onEdit}
              onManageDaysOff={() => setActiveTab("schedule")}
            />
          )
        )}

        {activeTab === "curriculum" && (
          <ClassCurriculumPanel session={session} classId={classroom.id} />
        )}

        {activeTab === "schedule" && (
          scheduleQuery.isLoading || slotsQuery.isLoading ? <PanelSkeleton /> : (
            <ClassScheduleTab
              session={session}
              classId={classroom.id}
              slots={slots}
              schedule={schedule}
              projectedEnd={progressQuery.data?.projectedEndDate}
              onSelect={id => setSelectedSession(id)}
            />
          )
        )}

        {activeTab === "members" && (
          peopleQuery.isLoading ? <PanelSkeleton /> : (
            <ClassMembersTab
              session={session}
              classId={classroom.id}
              teachers={people?.teachers ?? []}
              students={people?.students ?? []}
            />
          )
        )}

        {activeTab === "materials" && (
          <div className="space-y-3">
            <label className="text-sm text-on-surface">
              Buổi học{" "}
              <select
                className="border border-outline-variant rounded-lg p-2 ml-2 text-sm"
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
            <ClassMaterialsTab session={session} classId={classroom.id} scheduleId={selectedSession ?? undefined} />
          </div>
        )}

        {activeTab === "tasks" && (
          <ClassTaskPanel session={session} classId={classroom.id} />
        )}

        {activeTab === "progress" && (
          progressQuery.isLoading || scheduleQuery.isLoading ? <PanelSkeleton /> : (
            <ClassProgressTab progress={progressQuery.data} schedule={schedule} />
          )
        )}
      </div>
    </div>
  );
}

// ─── Empty Detail State ───────────────────────────────────────────────────────

function DetailEmptyState() {
  return (
    <div className="class-detail-empty-state">
      <span className="material-symbols-outlined">school</span>
      <p>Chọn một lớp để xem chi tiết</p>
    </div>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function PanelSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="h-48 rounded-xl bg-surface-container animate-pulse" />
      <div className="h-48 rounded-xl bg-surface-container animate-pulse" />
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function AdminClassesPanel({ session }: { session: AuthSession }) {
  const metadata = useMetadata(session);
  const queryClient = useQueryClient();

  // ── UI state ──
  const [navExpanded, setNavExpanded] = useState(true);
  const [selectedClass, setSelectedClass] = useState<Classroom | null>(null);
  const [enrollmentClass, setEnrollmentClass] = useState<Classroom | null>(null); // Quản lý học sinh drawer
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<ClassroomInput>({ code: "", name: "", gradeId: 0, status: "", startDate: "", description: "" });

  // ── Filter state ──
  const [search, setSearch] = useState("");

  // ── Data ──
  const classesQuery = useQuery({
    queryKey: ["admin-classes-panel", session.accessToken, search],
    queryFn: async () => {
      const [overview, grades] = await Promise.all([
        getAdminClassOverview(session, { search }),
        getGrades(session),
      ]);
      return { overview, grades };
    },
  });

  const overview = classesQuery.data?.overview ?? [];
  const grades = classesQuery.data?.grades ?? [];
  const rows = overview.map(asClassroom);

  // Sync selectedClass khi data reload
  useEffect(() => {
    if (!classesQuery.data) return;
    setSelectedClass(current =>
      current ? rows.find(x => x.id === current.id) ?? null : null
    );
    if (!form.gradeId && grades[0]) setForm(x => ({ ...x, gradeId: grades[0].id }));
  }, [classesQuery.data]);

  useEffect(() => {
    if (!editing) setForm(x => ({ ...x, status: x.status || firstMetadataValue(metadata, "classStatuses") }));
  }, [editing, metadata]);

  // ── Mutations ──
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-classes-panel"] });
  const createMutation = useMutation({ mutationFn: (input: ClassroomInput) => createClass(session, input), onSuccess: invalidate });
  const updateMutation = useMutation({ mutationFn: ({ id, input }: { id: number; input: ClassroomInput }) => updateClass(session, id, input), onSuccess: invalidate });
  const deleteMutation = useMutation({ mutationFn: (id: number) => deleteClass(session, id), onSuccess: invalidate });

  const error = classesQuery.isError ? messageOf(classesQuery.error)
    : createMutation.isError ? messageOf(createMutation.error)
    : updateMutation.isError ? messageOf(updateMutation.error)
    : deleteMutation.isError ? messageOf(deleteMutation.error) : "";

  const reset = () => {
    setEditing(null);
    setForm({
      code: "",
      name: "",
      gradeId: grades[0]?.id ?? 0,
      status: firstMetadataValue(metadata, "classStatuses"),
      startDate: "",
      description: "",
    });
    setFormOpen(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      editing
        ? await updateMutation.mutateAsync({ id: editing, input: form as ClassroomInput })
        : await createMutation.mutateAsync(form as ClassroomInput);
      reset();
    } catch { /* error handled by mutation state */ }
  };

  const handleSelectClass = (cls: Classroom) => {
    setSelectedClass(cls);
    setNavExpanded(false); // auto-collapse khi chọn lớp
  };

  const handleEdit = () => {
    if (!selectedClass) return;
    setEditing(selectedClass.id);
    setForm({
      code: selectedClass.code,
      name: selectedClass.name,
      gradeId: selectedClass.gradeId,
      status: selectedClass.status,
      startDate: selectedClass.startDate ? selectedClass.startDate.slice(0, 10) : "",
      description: selectedClass.description ?? "",
    });
    setFormOpen(true);
  };

  const handleDeleteSelected = async () => {
    if (!selectedClass) return;
    if (!confirm(`Xóa lớp "${selectedClass.name}"? Dữ liệu lịch sử vẫn được giữ lại.`)) return;
    try {
      await deleteMutation.mutateAsync(selectedClass.id);
      setSelectedClass(null);
      setNavExpanded(true);
    } catch { /* handled */ }
  };

  return (
    <div className="classroom-master-detail">
      {/* ── Error bar ── */}
      {error && (
        <div className="cdp-error-bar">
          <span>{error}</span>
          <button type="button" onClick={() => void classesQuery.refetch()} className="text-sm underline">Thử lại</button>
        </div>
      )}

      {/* ── Master: Class Navigator ── */}
      <ClassNavigator
        session={session}
        classes={rows}
        overviewRows={overview}
        selectedId={selectedClass?.id ?? null}
        onSelect={handleSelectClass}
        expanded={navExpanded}
        onToggle={() => setNavExpanded(v => !v)}
        onAdd={() => { reset(); setFormOpen(true); }}
        search={search}
        onSearch={setSearch}
        isLoading={classesQuery.isLoading}
      />

      {/* ── Detail: Class Detail Pane ── */}
      <main className="class-detail-pane-wrap">
        {selectedClass ? (
          <ClassDetailPane
            session={session}
            classroom={selectedClass}
            onEdit={handleEdit}
            onManageMembers={() => setEnrollmentClass(selectedClass)}
            onClose={() => { setSelectedClass(null); setNavExpanded(true); }}
          />
        ) : (
          <DetailEmptyState />
        )}
      </main>

      {/* ── Drawers & dialogs ── */}

      {/* Quản lý học sinh / phân công */}
      {enrollmentClass && (
        <ClassEnrollmentPanel
          session={session}
          classroom={enrollmentClass}
          onClose={() => setEnrollmentClass(null)}
        />
      )}

      {/* Tạo / Sửa lớp */}
      <AdminDrawer
        open={formOpen}
        onClose={reset}
        size="lg"
        eyebrow={editing ? "CHỈNH SỬA LỚP" : "TẠO LỚP MỚI"}
        title={editing ? form.name : "Thông tin lớp học"}
      >
        <form onSubmit={save} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Mã lớp
            <input
              className="h-10 rounded-md border border-outline-variant px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              required maxLength={30} value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Tên lớp
            <input
              className="h-10 rounded-md border border-outline-variant px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              required maxLength={120} value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Khối
            <select
              className="h-10 rounded-md border border-outline-variant px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              value={form.gradeId}
              onChange={e => setForm({ ...form, gradeId: Number(e.target.value) })}
            >
              {grades.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Trạng thái
            <select
              className="h-10 rounded-md border border-outline-variant px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}
            >
              {metadataOptions(metadata, "classStatuses").map(x => (
                <option key={x.value} value={x.value}>{x.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Ngày khai giảng / bắt đầu
            <input
              type="date"
              className="h-10 rounded-md border border-outline-variant px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              value={form.startDate ?? ""}
              onChange={e => setForm({ ...form, startDate: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Mô tả / Ghi chú
            <textarea
              rows={3}
              placeholder="Nhập mô tả, mục tiêu hoặc ghi chú cho lớp học…"
              className="rounded-md border border-outline-variant p-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none text-sm"
              value={form.description ?? ""}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </label>
          {editing && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="text-sm text-error underline"
              >
                Xóa lớp này
              </button>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant mt-4">
            <Button type="button" variant="outline" onClick={reset}>Hủy</Button>
            <Button type="submit">{editing ? "Lưu thay đổi" : "Tạo lớp"}</Button>
          </div>
        </form>
      </AdminDrawer>
    </div>
  );
}
