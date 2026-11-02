import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuditLogs, getUsers, type AuditLog, type AuthSession, type UserAccount } from "../api";
import { AdminPage } from "./components/AdminPageLayout";
import { AdminTable, AdminPagination } from "./components/AdminTable";
import { AdminDrawer } from "./components/AdminDrawer";
import { SearchInput, FilterSelect } from "./components/AdminFilterBar";

const actionLabel: Record<string, string> = {
  CREATE: "Tạo mới", UPDATE: "Cập nhật", DELETE: "Xóa", LOGIN: "Đăng nhập",
  IMPORT: "Nhập dữ liệu", PUBLISH: "Xuất bản", HIDE: "Ẩn đi",
  ARCHIVE: "Đưa vào lưu trữ", RESTORE: "Khôi phục",
  GRADE: "Chấm điểm", RETURN: "Trả bài", REGRADE: "Chấm lại cả lớp",
  ADD_STUDENT: "Thêm học sinh", REMOVE_STUDENT: "Gỡ học sinh", IMPORT_ROSTER: "Nhập danh sách lớp",
  ATTACH_DOCUMENT: "Gắn tài liệu", UPDATE_DOCUMENT: "Sửa tài liệu của lớp", DETACH_DOCUMENT: "Gỡ tài liệu",
};
const targetLabel: Record<string, string> = {
  USER: "Tài khoản", CLASS: "Lớp học", DOCUMENT: "Tài liệu", COURSE: "Khóa học",
  TOPIC: "Chuyên đề", LESSON: "Bài học", TEXTBOOK: "Sách giáo khoa",
  ASSIGNMENT: "Bài giao", SUBMISSION: "Bài nộp", PROBLEM: "Câu hỏi", TAXONOMY: "Cây chuyên đề",
};
// Danh sách cố định, không suy ra từ các dòng đang hiển thị: từ khi lọc chạy dưới CSDL thì trang
// hiện tại không còn đại diện cho toàn bộ nhật ký, lấy nó dựng dropdown sẽ giấu mất chính những
// loại mà người dùng cần lọc ra.
const targetTypes = Object.keys(targetLabel);

function formatDate(value: string, seconds = false) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    ...(seconds ? { second: "2-digit" as const } : {}), hour12: false,
  }).format(new Date(value));
}
function parse(value: string | null) {
  if (!value) return null;
  try { return JSON.parse(value) as unknown; } catch { return value; }
}
function pretty(value: unknown) {
  return value === null ? "Không có dữ liệu" : typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

export function AuditManagement({ session }: { session: AuthSession }) {
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [range, setRange] = useState("30");
  const [actor, setActor] = useState("");
  const [role, setRole] = useState("");
  const [target, setTarget] = useState("");
  const [objectId, setObjectId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // Mọi bộ lọc trừ ô tìm kiếm đều gửi xuống máy chủ; đổi bộ lọc thì phải quay về trang đầu, nếu
  // không sẽ hiện trang 4 của một tập kết quả chỉ còn 1 trang và người dùng thấy bảng trống.
  const filter = { actorUserId: actor, actorRole: role, targetType: target, targetId: objectId.trim(),
    days: range === "all" ? "" : range, page };
  const changeFilter = (apply: () => void) => { apply(); setPage(0); };

  const logsQuery = useQuery({
    queryKey: ["audit-logs", session.accessToken, actor, role, target, objectId.trim(), range, page],
    queryFn: () => getAuditLogs(session, filter),
  });
  const usersQuery = useQuery({ queryKey: ["audit-log-users", session.accessToken], queryFn: () => getUsers(session) });
  const logs = logsQuery.data?.items ?? [];
  const total = logsQuery.data?.total ?? 0;
  const pages = logsQuery.data?.pages ?? 1;
  const users = usersQuery.data ?? [];
  const error = logsQuery.isError ? (logsQuery.error instanceof Error ? logsQuery.error.message : "Không thể tải nhật ký")
    : usersQuery.isError ? (usersQuery.error instanceof Error ? usersQuery.error.message : "Không thể tải nhật ký")
    : "";

  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const roles = useMemo(() => [...new Set(users.map((user) => user.roleCode))], [users]);
  // Ô tìm kiếm là thứ duy nhất còn chạy ở trình duyệt, và chỉ soi trong trang đang mở — nên nhãn
  // của nó nói đúng như vậy thay vì hứa tìm khắp nhật ký.
  const visible = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    if (!keyword) return logs;
    return logs.filter((log) => {
      const user = log.actorUserId ? userMap.get(log.actorUserId) : null;
      return `${log.action} ${log.targetType} ${log.targetId ?? ""} ${user?.fullName ?? "Hệ thống"}`
        .toLocaleLowerCase("vi").includes(keyword);
    });
  }, [logs, search, userMap]);
  const sentence = (log: AuditLog) => `${actionLabel[log.action] ?? log.action} ${targetLabel[log.targetType] ?? log.targetType}${log.targetId ? ` #${log.targetId}` : ""}`;

  const columns = [
    { key: "createdAt", label: "Thời gian", render: (log: AuditLog) => <span className="whitespace-nowrap">{formatDate(log.createdAt)}</span> },
    { key: "actor", label: "Người thực hiện", render: (log: AuditLog) => {
      const user = log.actorUserId ? userMap.get(log.actorUserId) : null;
      return <div><b className="block">{user?.fullName ?? "Hệ thống"}</b><small className="text-on-surface-variant">{user?.roleCode ?? "Tác vụ hệ thống"}</small></div>;
    }},
    { key: "action", label: "Thao tác", render: (log: AuditLog) => sentence(log) },
    { key: "targetType", label: "Đối tượng", render: (log: AuditLog) => targetLabel[log.targetType] ?? log.targetType },
    { key: "result", label: "Kết quả", render: () => <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-[#ecfccb] text-[#3f6212] border border-[#d9f99d]">Thành công</span> },
    { key: "ip", label: "IP", render: (log: AuditLog) => <span className="text-on-surface-variant">{log.ipAddress ?? "—"}</span> },
    { key: "detail", label: "Chi tiết", className: "text-center", sticky: true, render: (log: AuditLog) => (
      <button className="text-lg text-primary hover:text-on-primary-container transition-colors" onClick={(e) => { e.stopPropagation(); setSelected(log); }} aria-label="Xem chi tiết">›</button>
    )},
  ];

  return (
    <AdminPage>
      <AdminPage.Header
        eyebrow="QUẢN TRỊ HỆ THỐNG"
        title="Nhật ký hoạt động"
        description="Theo dõi mọi thay đổi dữ liệu và hành động trong hệ thống."
      />
      <AdminPage.Filters>
        <FilterSelect value={range} onChange={(e) => changeFilter(() => setRange(e.target.value))}>
          <option value="1">Hôm nay</option>
          <option value="7">7 ngày qua</option>
          <option value="30">30 ngày qua</option>
          <option value="all">Tất cả thời gian</option>
        </FilterSelect>
        <FilterSelect value={actor} onChange={(e) => changeFilter(() => setActor(e.target.value))}>
          <option value="">Người thực hiện</option>
          {users.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
        </FilterSelect>
        <FilterSelect value={role} onChange={(e) => changeFilter(() => setRole(e.target.value))}>
          <option value="">Vai trò</option>
          {roles.map((item) => <option key={item} value={item}>{item}</option>)}
        </FilterSelect>
        <FilterSelect value={target} onChange={(e) => changeFilter(() => setTarget(e.target.value))}>
          <option value="">Loại đối tượng</option>
          {targetTypes.map((item) => <option key={item} value={item}>{targetLabel[item]}</option>)}
        </FilterSelect>
        <input
          className="h-10 rounded-lg border border-outline-variant bg-white text-sm px-3 w-32 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          placeholder="Mã đối tượng…" inputMode="numeric" value={objectId}
          onChange={(e) => changeFilter(() => setObjectId(e.target.value.replace(/\D/g, "")))}
        />
        <div className="ml-auto">
          <SearchInput value={search} onChange={setSearch} placeholder="Lọc trong trang này…" debounceMs={0} />
        </div>
      </AdminPage.Filters>

      {error && <div className="mb-4 p-3 rounded-lg bg-error-container text-on-error-container text-sm">{error}</div>}

      <AdminPage.Content>
        <AdminTable<AuditLog>
          columns={columns}
          data={visible}
          loading={logsQuery.isLoading}
          skeletonRows={8}
          keyExtractor={(log) => log.id}
          onRowClick={(log) => setSelected(log)}
          selectedId={selected?.id}
          emptyMessage="Không có nhật ký phù hợp với bộ lọc."
          footer={
            <AdminPagination
              page={page + 1}
              totalPages={Math.max(pages, 1)}
              onPageChange={(p) => setPage(p - 1)}
              totalItems={total}
            />
          }
        />
      </AdminPage.Content>

      <AdminDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        size="sm"
        title="Chi tiết thao tác"
      >
        {selected && <AuditDetailContent log={selected} user={selected.actorUserId ? userMap.get(selected.actorUserId) : undefined} sentence={sentence(selected)} />}
      </AdminDrawer>
    </AdminPage>
  );
}

function AuditDetailContent({ log, user, sentence }: { log: AuditLog; user?: UserAccount; sentence: string }) {
  const items = [
    { label: "Thời gian", value: formatDate(log.createdAt, true) },
    { label: "IP Address", value: log.ipAddress ?? "—" },
    { label: "Người thực hiện", value: <>{user?.fullName ?? "Hệ thống"} <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-primary-container text-on-primary-container">{user?.roleCode ?? "SYSTEM"}</span></> },
    { label: "Thao tác", value: sentence },
  ];
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
        {items.map((item) => (
          <div key={item.label} className="contents">
            <dt className="font-medium text-on-surface-variant">{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant mb-3">So sánh Trước/Sau</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-outline-variant overflow-hidden">
            <div className="bg-slate-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-on-surface-variant border-b border-outline-variant">Trước (OLD)</div>
            <pre className="p-3 text-xs whitespace-pre-wrap break-all max-h-64 overflow-y-auto bg-white">{pretty(parse(log.oldData))}</pre>
          </div>
          <div className="rounded-lg border border-outline-variant overflow-hidden">
            <div className="bg-slate-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-on-surface-variant border-b border-outline-variant">Sau (NEW)</div>
            <pre className="p-3 text-xs whitespace-pre-wrap break-all max-h-64 overflow-y-auto bg-white">{pretty(parse(log.newData))}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
