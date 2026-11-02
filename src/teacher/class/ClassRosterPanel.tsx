import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getClassRoster, getRosterCandidates, addRosterStudent, removeRosterStudent,
  uploadClassRoster, confirmClassRoster, downloadRosterTemplate, impersonateStudent,
  type AuthSession, type RosterImportPreview, type RosterImportResult, type RosterRowStatus,
} from "../../api";
import { messageOf } from "../../lib/errors";

const statusLabel: Record<RosterRowStatus, string> = {
  TAO_MOI: "Tạo tài khoản mới",
  CO_SAN: "Đã có tài khoản",
  DA_TRONG_LOP: "Đã ở trong lớp",
  LOI: "Lỗi",
};
const statusTone: Record<RosterRowStatus, string> = {
  TAO_MOI: "bg-primary-container/30 text-primary",
  CO_SAN: "bg-surface-variant text-on-surface-variant",
  DA_TRONG_LOP: "bg-surface-variant text-on-surface-variant",
  LOI: "bg-error-container/40 text-error",
};

const emptyDraft = { fullName: "", username: "", email: "", phone: "", password: "" };

/**
 * Danh sách học sinh của lớp: nhập cả danh sách từ file Excel, và thêm lẻ từng em còn thiếu.
 * Thêm lẻ có hai đường — chọn tài khoản đã có, hoặc tạo tài khoản mới ngay tại đây.
 */
export function ClassRosterPanel({ session, classId }: { session: AuthSession; classId: number }) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [pickedId, setPickedId] = useState(0);
  const [draft, setDraft] = useState(emptyDraft);
  const [preview, setPreview] = useState<RosterImportPreview | null>(null);
  const [result, setResult] = useState<RosterImportResult | null>(null);
  const [notice, setNotice] = useState("");

  const rosterQuery = useQuery({ queryKey: ["class-roster", session.accessToken, classId], queryFn: () => getClassRoster(session, classId) });
  const students = rosterQuery.data ?? [];
  const candidatesQuery = useQuery({
    queryKey: ["class-roster-candidates", session.accessToken, classId, search],
    queryFn: () => getRosterCandidates(session, classId, search),
    enabled: adding && mode === "existing",
  });
  const candidates = candidatesQuery.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["class-roster"] });
  const addMutation = useMutation({
    mutationFn: () => mode === "existing"
      ? addRosterStudent(session, classId, { userId: pickedId })
      : addRosterStudent(session, classId, draft),
    onSuccess: async () => { await invalidate(); setPickedId(0); setDraft(emptyDraft); setNotice("Đã thêm học sinh vào lớp."); },
  });
  const removeMutation = useMutation({ mutationFn: (id: number) => removeRosterStudent(session, classId, id), onSuccess: invalidate });
  // App.tsx cầm phiên đăng nhập, panel này nằm sâu mấy tầng — báo lên bằng sự kiện cửa sổ,
  // đúng lối "math10:admin-navigation" đã dùng sẵn, thay vì xâu prop qua từng tầng.
  const xemHoMutation = useMutation({
    mutationFn: (studentId: number) => impersonateStudent(session, studentId),
    onSuccess: phien => window.dispatchEvent(new CustomEvent("math10:xem-ho", { detail: phien })),
  });
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadClassRoster(session, classId, file),
    onSuccess: data => { setPreview(data); setResult(null); },
  });
  const confirmMutation = useMutation({
    mutationFn: (objectKey: string) => confirmClassRoster(session, classId, objectKey),
    onSuccess: async data => { await invalidate(); setPreview(null); setResult(data); },
  });

  const error = [rosterQuery, addMutation, removeMutation, uploadMutation, confirmMutation, xemHoMutation]
    .map(q => (q.isError ? messageOf(q.error) : "")).find(Boolean) ?? "";
  const canAdd = mode === "existing" ? pickedId > 0 : Boolean(draft.fullName && draft.username && draft.email && draft.password);

  return <section className="flex flex-col gap-4">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h3 className="text-base font-bold text-on-surface">Học sinh trong lớp</h3>
        <p className="text-xs text-on-surface-variant">{students.length} em · nhập từ file danh sách hoặc thêm lẻ từng em còn thiếu</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => void downloadRosterTemplate(session, classId).catch(reason => setNotice(messageOf(reason)))}
          className="h-9 px-3 rounded-lg border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors">Tải file mẫu</button>
        <button onClick={() => fileInput.current?.click()} disabled={uploadMutation.isPending}
          className="h-9 px-3 rounded-lg border border-outline-variant text-sm font-semibold text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-60">
          {uploadMutation.isPending ? "Đang đọc file…" : "Nhập từ file"}
        </button>
        <button onClick={() => { setAdding(v => !v); setNotice(""); }}
          className="h-9 px-3 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity">
          {adding ? "Đóng" : "Thêm học sinh"}
        </button>
      </div>
    </div>
    <input ref={fileInput} type="file" accept=".xlsx,.xls" className="hidden"
      onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) uploadMutation.mutate(file); }} />

    {error && <div className="api-error">{error}</div>}
    {notice && <div className="text-sm text-primary bg-primary-container/20 border border-primary/30 rounded-lg px-3 py-2">{notice}</div>}

    {result && (
      <div className="border border-outline-variant rounded-lg bg-surface-container-low p-3 flex flex-col gap-1">
        <p className="text-sm text-on-surface"><b>Nhập xong.</b> Tạo mới {result.created} tài khoản · thêm vào lớp {result.enrolled} em · bỏ qua {result.skipped} dòng.</p>
        {result.errors.map((line, index) => <p key={index} className="text-xs text-error">{line}</p>)}
        <button onClick={() => setResult(null)} className="self-start text-xs font-semibold text-on-surface-variant hover:text-on-surface mt-1">Ẩn</button>
      </div>
    )}

    {adding && (
      <div className="border border-outline-variant rounded-lg bg-surface-container-lowest p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {([["existing", "Chọn tài khoản có sẵn"], ["new", "Tạo tài khoản mới"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setMode(key)}
              className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${mode === key ? "bg-primary text-on-primary" : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-low"}`}>{label}</button>
          ))}
        </div>
        {mode === "existing" ? (
          <div className="flex items-center gap-2 flex-wrap">
            <input placeholder="Tìm theo tên, username hoặc email" value={search} onChange={e => setSearch(e.target.value)}
              className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface flex-1 min-w-[200px]" />
            <select value={pickedId} onChange={e => setPickedId(Number(e.target.value))}
              className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface min-w-[220px]">
              <option value={0}>Chọn học sinh…</option>
              {candidates.map(row => <option key={row.id} value={row.id}>{row.full_name}{row.username ? ` (@${row.username})` : ""}</option>)}
            </select>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <input placeholder="Họ và tên" value={draft.fullName} onChange={e => setDraft({ ...draft, fullName: e.target.value })} className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface" />
            <input placeholder="Tên đăng nhập" value={draft.username} onChange={e => setDraft({ ...draft, username: e.target.value })} className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface" />
            <input placeholder="Email" type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface" />
            <input placeholder="Số điện thoại (không bắt buộc)" value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface" />
            <input placeholder="Mật khẩu (từ 8 ký tự)" value={draft.password} onChange={e => setDraft({ ...draft, password: e.target.value })} className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface" />
          </div>
        )}
        <button onClick={() => addMutation.mutate()} disabled={!canAdd || addMutation.isPending}
          className="self-start h-9 px-4 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
          {addMutation.isPending ? "Đang thêm…" : "Thêm vào lớp"}
        </button>
      </div>
    )}

    <div className="border border-outline-variant rounded-lg overflow-auto thin-scrollbar">
      <table className="w-full text-sm border-collapse min-w-[640px]">
        <thead>
          <tr className="bg-surface-container-low text-left text-xs text-on-surface-variant">
            <th className="px-3 py-2 font-semibold border-b border-outline-variant">Họ và tên</th>
            <th className="px-3 py-2 font-semibold border-b border-outline-variant">Tài khoản</th>
            <th className="px-3 py-2 font-semibold border-b border-outline-variant">Email</th>
            <th className="px-3 py-2 font-semibold border-b border-outline-variant">Vào lớp</th>
            <th className="px-3 py-2 font-semibold border-b border-outline-variant" />
          </tr>
        </thead>
        <tbody>
          {students.map(row => (
            <tr key={row.id} className="hover:bg-surface-container-low transition-colors">
              <td className="px-3 py-2 border-b border-outline-variant text-on-surface">
                {row.full_name}
                {row.status !== "ACTIVE" && <span className="ml-2 text-[11px] font-semibold text-error">{row.status === "LOCKED" ? "đã khóa" : row.status}</span>}
              </td>
              <td className="px-3 py-2 border-b border-outline-variant text-on-surface-variant">{row.username ? `@${row.username}` : "—"}</td>
              <td className="px-3 py-2 border-b border-outline-variant text-on-surface-variant truncate max-w-[220px]">{row.email}</td>
              <td className="px-3 py-2 border-b border-outline-variant text-on-surface-variant data-tabular">{new Date(row.joined_at).toLocaleDateString("vi-VN")}</td>
              <td className="px-3 py-2 border-b border-outline-variant text-right whitespace-nowrap">
                <button onClick={() => xemHoMutation.mutate(row.id)} disabled={row.status !== "ACTIVE" || xemHoMutation.isPending}
                  title="Mở màn hình đúng như em ấy nhìn thấy (chỉ đọc)"
                  className="px-2.5 py-1 mr-1 text-xs font-semibold text-primary hover:bg-primary-container/30 rounded transition-colors disabled:opacity-50">Xem bằng mắt em</button>
                <button onClick={() => { if (confirm(`Gỡ ${row.full_name} khỏi lớp?`)) removeMutation.mutate(row.id); }}
                  className="px-2.5 py-1 text-xs font-semibold text-error hover:bg-error-container/30 rounded transition-colors">Gỡ</button>
              </td>
            </tr>
          ))}
          {!students.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-on-surface-variant">Lớp chưa có học sinh. Nhập từ file danh sách hoặc thêm lẻ từng em.</td></tr>}
        </tbody>
      </table>
    </div>

    {preview && (
      <div className="dialog-backdrop">
        <section className="dialog-card !max-w-3xl flex flex-col gap-3">
          <div className="panel-head"><h2>Xem trước danh sách</h2><button onClick={() => setPreview(null)}>Đóng</button></div>
          <p className="text-sm text-on-surface-variant px-1">
            {preview.total} dòng · tạo mới {preview.newAccounts} · đã có tài khoản {preview.existingAccounts} · đã ở trong lớp {preview.alreadyInClass} · lỗi {preview.invalid}
          </p>
          <div className="border border-outline-variant rounded-lg overflow-auto thin-scrollbar max-h-[50vh]">
            <table className="w-full text-sm border-collapse min-w-[560px]">
              <thead>
                <tr className="bg-surface-container-low text-left text-xs text-on-surface-variant sticky top-0">
                  <th className="px-3 py-2 font-semibold border-b border-outline-variant">Dòng</th>
                  <th className="px-3 py-2 font-semibold border-b border-outline-variant">Họ và tên</th>
                  <th className="px-3 py-2 font-semibold border-b border-outline-variant">Tài khoản</th>
                  <th className="px-3 py-2 font-semibold border-b border-outline-variant">Tình trạng</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map(row => (
                  <tr key={row.rowNumber}>
                    <td className="px-3 py-2 border-b border-outline-variant text-on-surface-variant data-tabular">{row.rowNumber}</td>
                    <td className="px-3 py-2 border-b border-outline-variant text-on-surface">{row.fullName || "—"}</td>
                    <td className="px-3 py-2 border-b border-outline-variant text-on-surface-variant">{row.username ? `@${row.username}` : row.email || "—"}</td>
                    <td className="px-3 py-2 border-b border-outline-variant">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${statusTone[row.status]}`}>{statusLabel[row.status]}</span>
                      {row.errors.map((line, index) => <span key={index} className="block text-[11px] text-error mt-0.5">{line}</span>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setPreview(null)} className="h-9 px-3 rounded-lg border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors">Hủy</button>
            <button onClick={() => confirmMutation.mutate(preview.objectKey)} disabled={confirmMutation.isPending || preview.newAccounts + preview.existingAccounts === 0}
              className="h-9 px-4 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {confirmMutation.isPending ? "Đang nhập…" : `Nhập ${preview.newAccounts + preview.existingAccounts} em vào lớp`}
            </button>
          </div>
        </section>
      </div>
    )}
  </section>;
}
