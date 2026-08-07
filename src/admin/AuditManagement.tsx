import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuditLogs, getUsers, type AuditLog, type AuthSession, type UserAccount } from "../api";
import "./audit-management.css";

const actionLabel: Record<string, string> = {
  CREATE: "Tạo mới", UPDATE: "Cập nhật", DELETE: "Xóa", LOGIN: "Đăng nhập",
  IMPORT: "Nhập dữ liệu", PUBLISH: "Xuất bản",
};
const targetLabel: Record<string, string> = {
  USER: "Tài khoản", CLASS: "Lớp học", DOCUMENT: "Tài liệu", COURSE: "Khóa học",
  TOPIC: "Chuyên đề", LESSON: "Bài học", TEXTBOOK: "Sách giáo khoa",
};

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

  const logsQuery = useQuery({ queryKey: ["audit-logs", session.accessToken], queryFn: () => getAuditLogs(session) });
  const usersQuery = useQuery({ queryKey: ["audit-log-users", session.accessToken], queryFn: () => getUsers(session) });
  const logs = logsQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const error = logsQuery.isError ? (logsQuery.error instanceof Error ? logsQuery.error.message : "Không thể tải nhật ký")
    : usersQuery.isError ? (usersQuery.error instanceof Error ? usersQuery.error.message : "Không thể tải nhật ký")
    : "";

  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const targets = useMemo(() => [...new Set(logs.map((log) => log.targetType).filter(Boolean))], [logs]);
  const roles = useMemo(() => [...new Set(users.map((user) => user.roleCode))], [users]);
  const visible = useMemo(() => logs.filter((log) => {
    const user = log.actorUserId ? userMap.get(log.actorUserId) : null;
    const recent = range === "all" || Date.now() - new Date(log.createdAt).getTime() <= Number(range) * 86_400_000;
    const searchable = `${log.action} ${log.targetType} ${log.targetId ?? ""} ${user?.fullName ?? "Hệ thống"}`.toLocaleLowerCase("vi");
    return recent
      && (!actor || String(log.actorUserId ?? "") === actor)
      && (!role || user?.roleCode === role)
      && (!target || log.targetType === target)
      && (!objectId || String(log.targetId ?? "").includes(objectId))
      && searchable.includes(search.toLocaleLowerCase("vi"));
  }), [actor, logs, objectId, range, role, search, target, userMap]);
  const sentence = (log: AuditLog) => `${actionLabel[log.action] ?? log.action} ${targetLabel[log.targetType] ?? log.targetType}${log.targetId ? ` #${log.targetId}` : ""}`;

  return <section className="audit-page">
    <div className="audit-filters">
      <select value={range} onChange={(event) => setRange(event.target.value)}>
        <option value="1">Hôm nay</option><option value="7">7 ngày qua</option><option value="30">30 ngày qua</option><option value="all">Tất cả thời gian</option>
      </select>
      <select value={actor} onChange={(event) => setActor(event.target.value)}>
        <option value="">Người thực hiện</option>{users.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
      </select>
      <select value={role} onChange={(event) => setRole(event.target.value)}>
        <option value="">Vai trò</option>{roles.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <select value={target} onChange={(event) => setTarget(event.target.value)}>
        <option value="">Loại thao tác</option>{targets.map((item) => <option key={item} value={item}>{targetLabel[item] ?? item}</option>)}
      </select>
      <input placeholder="Đối tượng…" value={objectId} onChange={(event) => setObjectId(event.target.value)} />
      <input className="audit-search" placeholder="Tìm kiếm nhật ký…" value={search} onChange={(event) => setSearch(event.target.value)} />
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
    </table><footer>Hiển thị {visible.length}/{logs.length} kết quả · Nhật ký được lưu theo chính sách hệ thống</footer></div>
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
