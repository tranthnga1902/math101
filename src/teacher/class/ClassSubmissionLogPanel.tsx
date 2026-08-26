import { useQuery } from "@tanstack/react-query";
import { getClassRoster, getClassSubmissionLog, type AuthSession } from "../../api";
import { messageOf } from "../../lib/errors";

const actionLabel = { SUBMITTED: "Nộp bài", GRADED: "Đã chấm", RETURNED: "Đã trả bài" } as const;
const actionTone = {
  SUBMITTED: "bg-primary-container/30 text-primary",
  GRADED: "bg-surface-variant text-on-surface-variant",
  RETURNED: "bg-surface-variant text-on-surface-variant",
} as const;

/** Mỗi lần học sinh nộp bài — và mỗi lần giáo viên chấm hoặc trả bài — đều được ghi lại ở đây. */
export function ClassSubmissionLogPanel({ session, classId, studentId, onStudentChange }: {
  session: AuthSession; classId: number; studentId: number | null; onStudentChange: (id: number | null) => void;
}) {
  const rosterQuery = useQuery({ queryKey: ["class-roster", session.accessToken, classId], queryFn: () => getClassRoster(session, classId) });
  const students = rosterQuery.data ?? [];
  const logQuery = useQuery({
    queryKey: ["class-submission-log", session.accessToken, classId, studentId],
    queryFn: () => getClassSubmissionLog(session, classId, { studentId: studentId ?? undefined, limit: 200 }),
  });
  const rows = logQuery.data ?? [];

  return <section className="flex flex-col gap-4">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h3 className="text-base font-bold text-on-surface">Nhật ký nộp bài</h3>
        <p className="text-xs text-on-surface-variant">{rows.length} lượt gần nhất{studentId ? " của học sinh đang chọn" : " của cả lớp"}</p>
      </div>
      <select value={studentId ?? 0} onChange={e => onStudentChange(Number(e.target.value) || null)}
        className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface">
        <option value={0}>Tất cả học sinh</option>
        {students.map(row => <option key={row.student_id} value={row.student_id}>{row.full_name}</option>)}
      </select>
    </div>

    {logQuery.isError && <div className="api-error">{messageOf(logQuery.error)}</div>}

    <div className="flex flex-col divide-y divide-outline-variant border border-outline-variant rounded-lg overflow-hidden">
      {rows.map(row => (
        <div key={row.id} className="flex items-center justify-between gap-3 p-3 bg-surface-container-lowest hover:bg-surface-container-low transition-colors">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${actionTone[row.action]}`}>{actionLabel[row.action]}</span>
              <p className="text-sm text-on-surface truncate">{row.full_name} · {row.title}</p>
            </div>
            <p className="text-xs text-on-surface-variant truncate">
              {new Date(row.created_at).toLocaleString("vi-VN")}
              {` · ${row.requirement === "BAT_BUOC" ? "bắt buộc" : "tự chọn"}`}
              {row.actor_name && row.actor_id !== row.student_id && ` · bởi ${row.actor_name}`}
              {row.note && ` · ${row.note}`}
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-on-surface data-tabular">{row.score == null ? "—" : Number(row.score).toFixed(2)}</span>
        </div>
      ))}
      {!rows.length && <p className="text-sm text-on-surface-variant text-center py-8">Chưa có lượt nộp bài nào được ghi lại.</p>}
    </div>
  </section>;
}
