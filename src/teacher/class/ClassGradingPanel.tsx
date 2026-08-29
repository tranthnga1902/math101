import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTeacherSubmissions, returnSubmission, type AuthSession, type TeacherSubmission } from "../../api";
import { messageOf } from "../../lib/errors";
import { useGradingSheet } from "../useGradingSheet";
import { GradingSheetItems } from "../GradingSheetItems";

const statusLabel: Record<string, { text: string; tone: string }> = {
  SUBMITTED: { text: "Chờ chấm", tone: "bg-primary-container/30 text-primary" },
  GRADED: { text: "Đã chấm", tone: "bg-surface-variant text-on-surface-variant" },
  RETURNED: { text: "Đã trả", tone: "bg-tertiary-container text-on-tertiary-container" },
};

/**
 * Chấm và trả điểm ngay trong lớp, để giáo viên không phải rời chi tiết lớp sang mục khác.
 * Danh sách chỉ có bài BẮT BUỘC — backend đã lọc sẵn, vì bài tự chọn theo cách chấm đã chốt
 * chỉ ghi nhận đã làm chứ không bao giờ ra điểm.
 */
export function ClassGradingPanel({ session, classId }: { session: AuthSession; classId: number }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<TeacherSubmission | null>(null);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["teacher-submissions", session.accessToken, classId],
    queryFn: () => getTeacherSubmissions(session, classId),
  });

  // Chấm hoặc trả điểm đều đẻ ra một dòng nhật ký và đổi sổ điểm, nên làm mới cả ba nơi.
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["teacher-submissions"] }),
      queryClient.invalidateQueries({ queryKey: ["class-submission-log", session.accessToken, classId] }),
      queryClient.invalidateQueries({ queryKey: ["class-gradebook", session.accessToken, classId] }),
    ]);
  };
  const release = useMutation({
    mutationFn: (id: number) => returnSubmission(session, id),
    onSuccess: invalidate,
  });

  const all = query.data ?? [];
  // Lớp 45 em nộp 3 bài là 135 dòng; cuộn tay tìm một em là việc không ai làm nổi hai lần.
  // localeCompare theo "vi" để gõ không dấu vẫn không lệch — so sánh là contains nên chỉ cần
  // hạ chữ hoa theo đúng vùng ngôn ngữ.
  const needle = search.trim().toLocaleLowerCase("vi");
  const rows = all.filter(row =>
    (!filter || row.grading_status === filter) &&
    (!needle || `${row.full_name} ${row.username} ${row.title}`.toLocaleLowerCase("vi").includes(needle)));
  const pending = all.filter(row => row.grading_status === "SUBMITTED").length;
  const graded = all.filter(row => row.grading_status === "GRADED").length;
  const error = query.isError ? messageOf(query.error) : release.isError ? messageOf(release.error) : "";

  return <section className="flex flex-col gap-4">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h3 className="text-base font-bold text-on-surface">Chấm và trả điểm</h3>
        <p className="text-xs text-on-surface-variant">{pending} bài chờ chấm · {graded} bài chờ trả điểm</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm học sinh hoặc bài…"
          className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface min-w-[200px]" />
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface">
          <option value="">Tất cả trạng thái</option>
          <option value="SUBMITTED">Chờ chấm</option>
          <option value="GRADED">Đã chấm</option>
          <option value="RETURNED">Đã trả</option>
        </select>
      </div>
    </div>

    {error && <div className="api-error">{error}</div>}

    {query.isLoading ? <p className="text-sm text-on-surface-variant">Đang tải bài nộp…</p> : (
      <div className="flex flex-col divide-y divide-outline-variant border border-outline-variant rounded-lg overflow-hidden">
        {rows.map(row => {
          const state = statusLabel[row.grading_status] ?? statusLabel.SUBMITTED;
          return (
            <div key={row.id} className="flex items-center justify-between gap-3 p-3 bg-surface-container-lowest hover:bg-surface-container-low transition-colors flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${state.tone}`}>{state.text}</span>
                  <p className="text-sm font-semibold text-on-surface truncate">{row.full_name}</p>
                </div>
                <p className="text-xs text-on-surface-variant truncate">
                  {row.title} · nộp {new Date(row.submitted_at).toLocaleString("vi-VN")}
                  {row.total_questions ? ` · tự động ${row.correct_count ?? 0}/${row.total_questions} câu đúng` : ""}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold text-on-surface data-tabular">
                {row.score == null ? "—" : `${Number(row.score).toFixed(2)}/${row.max_score ?? 10}`}
              </span>
              <div className="shrink-0 flex items-center gap-2">
                <button type="button" onClick={() => setSelected(row)}
                  className="h-9 px-3 rounded-lg border border-outline-variant text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors">
                  Chấm
                </button>
                {row.grading_status === "GRADED" && (
                  <button type="button" disabled={release.isPending} onClick={() => release.mutate(row.id)}
                    className="h-9 px-3 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                    Trả điểm
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!rows.length && <p className="text-sm text-on-surface-variant text-center py-8">Chưa có bài nộp phù hợp.</p>}
      </div>
    )}

    {selected && <GradingDialog session={session} submission={selected}
      onClose={() => setSelected(null)}
      onSaved={async dong => { await invalidate(); if (dong) setSelected(null); }} />}
  </section>;
}

/**
 * Hộp chấm của bảng chấm trong lớp. Luật chọn đường chấm — từng câu hay cả bài — nằm ở
 * {@link useGradingSheet}, dùng chung với hộp chấm ở mục "Chấm và trả điểm": hai màn hình chấm
 * cùng một bài nộp, mà chỉ cần một bên còn gõ điểm cả bài cho đề tự luận là `PUT /grade` xoá
 * sạch bảng điểm từng câu bên kia vừa chấm.
 */
function GradingDialog({ session, submission, onClose, onSaved }: { session: AuthSession; submission: TeacherSubmission; onClose: () => void; onSaved: (dong: boolean) => void | Promise<void> }) {
  const state = useGradingSheet(session, submission, onSaved);
  const { sheet, chamTungCau, conThieu, feedback, wholeScore, setFeedback, setWholeScore, luu, dangLuu, loi } = state;
  const field = "px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface";
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={e => { e.preventDefault(); luu(); }}
        className={`w-full ${chamTungCau ? "max-w-3xl" : "max-w-md"} max-h-[90vh] overflow-auto bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col gap-3`}>
        <div>
          <p className="text-xs font-semibold text-primary tracking-wide">CHẤM BÀI</p>
          <h4 className="text-base font-bold text-on-surface">{submission.full_name}</h4>
          <p className="text-xs text-on-surface-variant">
            {submission.title}
            {submission.total_questions ? ` · tự động đúng ${submission.correct_count ?? 0}/${submission.total_questions}` : ""}
            {submission.submitted_late ? " · nộp muộn" : ""}
          </p>
        </div>
        {sheet.isLoading && <p className="text-sm text-on-surface-variant">Đang tải bảng chấm…</p>}
        {chamTungCau ? <GradingSheetItems state={state} /> : (
          <label className="flex flex-col gap-1 text-sm font-medium text-on-surface">
            Điểm thang 10
            <input required type="number" min="0" max="10" step="0.01" value={wholeScore} onChange={e => setWholeScore(e.target.value)}
              className={`h-10 ${field}`} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium text-on-surface">
          Nhận xét cả bài
          <textarea value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Nhận xét gửi học sinh…" rows={3} className={field} />
        </label>
        {sheet.isError && <p className="text-xs text-on-surface-variant">Không dựng được bảng chấm từng câu ({messageOf(sheet.error)}) — vẫn cho điểm cả bài được.</p>}
        {loi && <p className="text-sm text-error">{loi}</p>}
        {chamTungCau && conThieu > 0 && <p className="text-xs text-on-surface-variant">Còn {conThieu} câu chưa cho điểm. Lưu được, nhưng bài vẫn nằm trong hàng chờ tới khi chấm đủ.</p>}
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose}
            className="h-10 px-4 rounded-lg border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
            Hủy
          </button>
          <button type="submit" disabled={dangLuu}
            className="h-10 px-4 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {dangLuu ? "Đang lưu…" : chamTungCau ? "Lưu điểm từng câu" : "Lưu điểm"}
          </button>
        </div>
      </form>
    </div>
  );
}
