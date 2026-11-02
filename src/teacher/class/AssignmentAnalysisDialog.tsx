import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getItemAnalysis, regradeAssignment, type AuthSession, type ItemAnalysis } from "../../api";
import { messageOf } from "../../lib/errors";

/**
 * Tỉ lệ đúng từng câu của một phiếu đề, kèm nút chấm lại cả lớp.
 *
 * Đặt cạnh chỗ giao bài vì người sửa đáp án đề chính là người đứng ở đây. Hai việc phải nhìn
 * thấy nhau: sửa đáp án xong mà không chấm lại thì điểm cũ vẫn treo, còn chấm lại khi đề còn
 * câu trống đáp án thì server từ chối — nên trạng thái "đề chưa xong" phải hiện ngay trên nút.
 *
 * Câu chưa nhập đáp án hiện là "chưa có đáp án", không phải "0% đúng". Tô đỏ nhầm chỗ đó là
 * đẩy giáo viên đi sửa một câu vốn không sai.
 */
export function AssignmentAnalysisDialog({ session, assignmentId, title, onClose }:
  { session: AuthSession; assignmentId: number; title: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["assignment-analysis", session.accessToken, assignmentId],
    queryFn: () => getItemAnalysis(session, assignmentId),
  });
  const regrade = useMutation({
    mutationFn: () => regradeAssignment(session, assignmentId),
    // Chấm lại đổi điểm của cả lớp: sổ điểm, hàng chờ chấm và chính bảng này đều cũ ngay lập tức.
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assignment-analysis", session.accessToken, assignmentId] }),
        queryClient.invalidateQueries({ queryKey: ["teacher-submissions"] }),
        queryClient.invalidateQueries({ queryKey: ["class-gradebook"] }),
      ]);
    },
  });

  const rows: ItemAnalysis[] = query.data ?? [];
  const missing = rows.filter(row => row.missingAnswerKey);
  const submissions = rows[0]?.total ?? 0;
  const weak = rows.filter(row => row.warning).length;
  const error = query.isError ? messageOf(query.error) : regrade.isError ? messageOf(regrade.error) : "";

  return <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
    onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-surface-container-lowest border border-outline-variant rounded-xl">
      <div className="p-5 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-primary tracking-wide">TỈ LỆ ĐÚNG TỪNG CÂU</p>
          <h4 className="text-base font-bold text-on-surface truncate">{title}</h4>
          <p className="text-xs text-on-surface-variant">
            {submissions} bài đã nộp · {rows.length} câu{weak ? ` · ${weak} câu cả lớp làm yếu` : ""}
          </p>
        </div>
        <button type="button" onClick={onClose}
          className="shrink-0 h-9 px-3 rounded-lg border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
          Đóng
        </button>
      </div>

      <div className="px-5 flex flex-col gap-3 overflow-y-auto">
        {error && <div className="api-error">{error}</div>}

        {missing.length > 0 && (
          <div className="rounded-lg border border-error/40 bg-error-container/20 p-3 text-xs text-error">
            <p className="font-semibold">Đề còn {missing.length} câu chưa nhập đáp án đúng.</p>
            <p className="text-on-surface-variant">
              Câu {missing.map(row => row.orderNo).join(", ")}. Những câu này không chấm được, và chưa bổ sung
              thì không chấm lại cả lớp được — nếu bỏ qua, mọi học sinh đều bị tính là sai câu đó.
            </p>
          </div>
        )}

        {query.isLoading ? <p className="text-sm text-on-surface-variant py-6 text-center">Đang tải…</p> : (
          <div className="flex flex-col divide-y divide-outline-variant border border-outline-variant rounded-lg overflow-hidden">
            {rows.map(row => (
              <div key={row.problemId} className="flex items-center gap-3 p-2.5 bg-surface-container-lowest">
                <span className="w-7 shrink-0 text-xs font-semibold text-on-surface-variant data-tabular">{row.orderNo}</span>
                <span className="w-24 shrink-0 text-xs text-on-surface-variant truncate">{row.publicCode ?? "—"}</span>
                {row.missingAnswerKey ? (
                  <span className="flex-1 text-xs font-semibold text-error">Chưa có đáp án đúng</span>
                ) : (
                  <>
                    <div className="flex-1 h-2 rounded-full bg-surface-variant overflow-hidden">
                      <div className={`h-full ${row.warning ? "bg-error" : "bg-primary"}`} style={{ width: `${row.rate ?? 0}%` }} />
                    </div>
                    <span className="w-28 shrink-0 text-right text-xs font-semibold text-on-surface data-tabular">
                      {row.correct ?? 0}/{row.total} · {(row.rate ?? 0).toFixed(1)}%
                    </span>
                  </>
                )}
              </div>
            ))}
            {!query.isLoading && !rows.length && <p className="text-sm text-on-surface-variant text-center py-8">Phiếu đề chưa có câu hỏi nào.</p>}
          </div>
        )}
      </div>

      <div className="p-5 pt-3 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-on-surface-variant">
          {regrade.isSuccess && !regrade.isPending
            ? `Đã chấm lại ${regrade.data?.updated ?? 0} bài nộp.`
            : "Sửa đáp án đề xong thì bấm chấm lại, điểm cũ mới được tính theo đáp án mới."}
        </p>
        <button type="button" disabled={regrade.isPending || missing.length > 0 || !rows.length}
          onClick={() => regrade.mutate()}
          title={missing.length > 0 ? "Bổ sung đáp án đúng cho các câu còn thiếu trước đã" : undefined}
          className="h-9 px-4 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
          {regrade.isPending ? "Đang chấm lại…" : "Chấm lại cả lớp"}
        </button>
      </div>
    </div>
  </div>;
}
