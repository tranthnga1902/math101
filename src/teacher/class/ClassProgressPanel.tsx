import { useQuery } from "@tanstack/react-query";
import { getClassProgress, type AuthSession } from "../../api";
import { messageOf } from "../../lib/errors";

const percent = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

/**
 * Sổ điểm của lớp. Hai phần tách hẳn nhau theo đúng cách chấm đã chốt:
 * phần bắt buộc cho ra điểm trung bình 0–10, phần tự chọn chỉ đo mức độ tự giác — không trộn vào điểm.
 */
export function ClassProgressPanel({ session, classId, onViewLog }: { session: AuthSession; classId: number; onViewLog: (studentId: number) => void }) {
  const query = useQuery({ queryKey: ["class-progress", session.accessToken, classId], queryFn: () => getClassProgress(session, classId) });
  const rows = query.data ?? [];

  const graded = rows.filter(row => row.required_avg_score != null);
  const classAverage = graded.length ? graded.reduce((sum, row) => sum + Number(row.required_avg_score), 0) / graded.length : null;
  const diligence = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + percent(row.optional_submitted, row.optional_total), 0) / rows.length)
    : 0;

  return <section className="flex flex-col gap-4">
    <div>
      <h3 className="text-base font-bold text-on-surface">Sổ điểm</h3>
      <p className="text-xs text-on-surface-variant">
        Điểm trung bình lớp {classAverage == null ? "chưa có" : classAverage.toFixed(2)} · mức tự giác trung bình {diligence}%
      </p>
    </div>

    {query.isError && <div className="api-error">{messageOf(query.error)}</div>}

    <div className="border border-outline-variant rounded-lg overflow-auto thin-scrollbar">
      <table className="w-full text-sm border-collapse min-w-[720px]">
        <thead>
          <tr className="bg-surface-container-low text-left text-xs text-on-surface-variant">
            <th className="px-3 py-2 font-semibold border-b border-outline-variant sticky left-0 bg-surface-container-low">Học sinh</th>
            <th className="px-3 py-2 font-semibold border-b border-outline-variant">Bắt buộc đã nộp</th>
            <th className="px-3 py-2 font-semibold border-b border-outline-variant">Điểm trung bình</th>
            <th className="px-3 py-2 font-semibold border-b border-outline-variant">Tự chọn đã làm</th>
            <th className="px-3 py-2 font-semibold border-b border-outline-variant">Nộp gần nhất</th>
            <th className="px-3 py-2 font-semibold border-b border-outline-variant" />
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const requiredRate = percent(row.required_submitted, row.required_total);
            const optionalRate = percent(row.optional_submitted, row.optional_total);
            const score = row.required_avg_score == null ? null : Number(row.required_avg_score);
            return (
              <tr key={row.student_id} className="hover:bg-surface-container-low transition-colors">
                <td className="px-3 py-2 border-b border-outline-variant text-on-surface sticky left-0 bg-surface-container-lowest">
                  {row.full_name}
                  {row.username && <span className="text-on-surface-variant text-xs ml-1">@{row.username}</span>}
                </td>
                <td className="px-3 py-2 border-b border-outline-variant">
                  <span className="text-on-surface data-tabular">{row.required_submitted}/{row.required_total}</span>
                  <span className={`ml-2 text-xs ${requiredRate < 50 ? "text-error" : "text-on-surface-variant"}`}>{requiredRate}%</span>
                </td>
                <td className="px-3 py-2 border-b border-outline-variant">
                  {score == null ? <span className="text-on-surface-variant text-xs">chưa chấm</span>
                    : <span className={`font-semibold data-tabular ${score < 5 ? "text-error" : "text-on-surface"}`}>{score.toFixed(2)}</span>}
                </td>
                <td className="px-3 py-2 border-b border-outline-variant">
                  <span className="text-on-surface data-tabular">{row.optional_submitted}/{row.optional_total}</span>
                  <span className="ml-2 text-xs text-on-surface-variant">{optionalRate}% tự giác</span>
                </td>
                <td className="px-3 py-2 border-b border-outline-variant text-on-surface-variant data-tabular">
                  {row.last_submitted_at ? new Date(row.last_submitted_at).toLocaleString("vi-VN") : "—"}
                </td>
                <td className="px-3 py-2 border-b border-outline-variant text-right">
                  <button onClick={() => onViewLog(row.student_id)} className="px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary-container/20 rounded transition-colors whitespace-nowrap">Nhật ký</button>
                </td>
              </tr>
            );
          })}
          {!rows.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-on-surface-variant">Lớp chưa có học sinh hoặc chưa giao bài nào.</td></tr>}
        </tbody>
      </table>
    </div>
    <p className="text-xs text-on-surface-variant">
      Điểm trung bình chỉ tính các bài <b>bắt buộc</b> đã trả bài. Phần <b>tự chọn</b> đo mức độ tự giác và không cộng vào điểm.
    </p>
  </section>;
}
