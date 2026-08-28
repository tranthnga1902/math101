import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuditLogs, getUsers, type AuditLog, type AuthSession, type UserAccount } from "../api";
import "./audit-management.css";

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

  return <section className="audit-page">
    <div className="audit-filters">
      <select value={range} onChange={(event) => changeFilter(() => setRange(event.target.value))}>
        <option value="1">Hôm nay</option><option value="7">7 ngày qua</option><option value="30">30 ngày qua</option><option value="all">Tất cả thời gian</option>
      </select>
      <select value={actor} onChange={(event) => changeFilter(() => setActor(event.target.value))}>
        <option value="">Người thực hiện</option>{users.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
      </select>
      <select value={role} onChange={(event) => changeFilter(() => setRole(event.target.value))}>
        <option value="">Vai trò</option>{roles.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <select value={target} onChange={(event) => changeFilter(() => setTarget(event.target.value))}>
        <option value="">Loại đối tượng</option>{targetTypes.map((item) => <option key={item} value={item}>{targetLabel[item]}</option>)}
      </select>
      <input placeholder="Mã đối tượng…" inputMode="numeric" value={objectId}
             onChange={(event) => changeFilter(() => setObjectId(event.target.value.replace(/\D/g, "")))} />
      <input className="audit-search" placeholder="Lọc trong trang này…" value={search} onChange={(event) => setSearch(event.target.value)} />
    </div>
    {error && <div className="api-error">{error}</div>}
    <div className="audit-table"><table>
      <thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Thao tác</th><th>Đối tượng</th><th>Kết quả</th><th>IP</th><th>Chi tiết</th></tr></thead>
      <tbody>{visible.map((log) => {
        const user = log.actorUserId ? userMap.get(log.actorUserId) : null;
        return <tr key={log.id} onClick={() => setSelected(log)}>
          <td>{formatDate(log.createdAt)}</td><td><b>{user?.fullName ?? "Hệ thống"}</b><small>{user?.roleCode ?? "Tác vụ hệ thống"}</small></td>
          <td>{sentence(log)}</td><td>{targetLabel[log.targetType] ?? log.targetType}</td><td><span>Thành công</span></td>
          <td>{log.ipAddress ?? "—"}</td><td><button aria-label="Xem chi tiết">›</button></td>
        </tr>;
      })}</tbody>
    </table><footer className="audit-paging">
      <button disabled={page === 0 || logsQuery.isFetching} onClick={() => setPage(page - 1)}>‹ Trang trước</button>
      <span>
        {logsQuery.isFetching ? "Đang tải…" : `Hiển thị ${visible.length} dòng · trang ${page + 1}/${Math.max(pages, 1)} · ${total} kết quả khớp bộ lọc`}
      </span>
      <button disabled={page + 1 >= pages || logsQuery.isFetching} onClick={() => setPage(page + 1)}>Trang sau ›</button>
    </footer></div>
    {selected && <AuditDetail log={selected} user={selected.actorUserId ? userMap.get(selected.actorUserId) : undefined} sentence={sentence(selected)} onClose={() => setSelected(null)} />}
  </section>;
}

function AuditDetail({ log, user, sentence, onClose }: { log: AuditLog; user?: UserAccount; sentence: string; onClose: () => void }) {
  return <><div className="audit-overlay" onClick={onClose} /><aside className="audit-detail">
    <header><h2>Chi tiết thao tác</h2><button onClick={onClose} aria-label="Đóng">×</button></header>
    <main><section><dl>
      <div><dt>Thời gian</dt><dd>{formatDate(log.createdAt, true)}</dd></div><div><dt>IP Address</dt><dd>{log.ipAddress ?? "—"}</dd></div>
      <div><dt>Người thực hiện</dt><dd>{user?.fullName ?? "Hệ thống"} <span>{user?.roleCode ?? "SYSTEM"}</span></dd></div>
      <div><dt>Thao tác</dt><dd>{sentence}</dd></div>
    </dl></section><h3>So sánh Trước/Sau</h3><div className="audit-diff">
      <div><b>TRƯỚC (OLD)</b><pre>{pretty(parse(log.oldData))}</pre></div><div><b>SAU (NEW)</b><pre>{pretty(parse(log.newData))}</pre></div>
    </div><button className="close-detail" onClick={onClose}>Đóng</button></main>
  </aside></>;
}
