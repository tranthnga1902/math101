import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  closeClassPeriod, createAssignmentBatch, getClassPeriods, reopenClassPeriod,
  type AuthSession, type ClassPeriod, type ClosePeriodResult, type PeriodSuggestion,
} from "../../api";
import { messageOf } from "../../lib/errors";
import { macDinhCua } from "./loaiNhiemVu";

const ngay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) : "");
const luc = (iso: string | null) => (iso ? new Date(iso).toLocaleString("vi-VN") : "");

/** "2026-08-18T14:30" của <input datetime-local> → ISO có múi giờ, giống hệt ClassTaskPanel. */
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

const control = "h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface";

/**
 * Buổi học của lớp: đã dạy tới đâu, và chốt xong thì giao gì.
 *
 * <p>Đây là chỗ cả luồng giao bài đi qua. Giáo viên nói bằng buổi ("nộp trước buổi sau"), nên nút
 * <b>Hoàn thành buổi N</b> vừa ghi lại một sự kiện đã xảy ra, vừa mở những bài đã neo vào tiết ấy,
 * vừa lôi ra phiếu của bài học để giao ngay tại chỗ — ba việc mà với người dạy là một hành động.
 *
 * <p>Ngày hiện ở đây là ngày của <em>tuần trong lịch khóa</em>, không phải ngày của buổi: buổi
 * không mang ngày, và lớp học bù thứ Bảy không được phép đẩy lịch của mọi lớp khác. Lớp chưa gắn
 * khóa thì danh sách rỗng — đúng, chứ không phải hiện cả chương trình rồi để người đọc tự đoán
 * tiết nào là của lớp mình.
 */
export function ClassSessionPanel({ session, classId }: { session: AuthSession; classId: number }) {
  const queryClient = useQueryClient();
  const [dangChot, setDangChot] = useState<number | null>(null);
  const [gioDay, setGioDay] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [ketQua, setKetQua] = useState<{ periodId: number; data: ClosePeriodResult } | null>(null);
  const [daGiao, setDaGiao] = useState<number[]>([]);

  const listQuery = useQuery({
    queryKey: ["class-periods", session.accessToken, classId],
    queryFn: () => getClassPeriods(session, classId),
  });
  const rows = listQuery.data ?? [];

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["class-periods"] });
    await queryClient.invalidateQueries({ queryKey: ["class-assignments"] });
  };

  const chotMutation = useMutation({
    mutationFn: (periodId: number) =>
      closeClassPeriod(session, classId, periodId, { closedAt: toIso(gioDay), note: ghiChu.trim() || null }),
    onSuccess: async (data, periodId) => {
      setKetQua({ periodId, data });
      setDangChot(null); setGioDay(""); setGhiChu(""); setDaGiao([]);
      await invalidate();
    },
  });
  const boChotMutation = useMutation({
    mutationFn: (periodId: number) => reopenClassPeriod(session, classId, periodId),
    onSuccess: async (_data, periodId) => {
      setKetQua(cu => (cu?.periodId === periodId ? null : cu));
      await invalidate();
    },
  });
  const giaoMutation = useMutation({
    mutationFn: ({ goi, tiet }: { goi: PeriodSuggestion; tiet: ClassPeriod }) => {
      const bo = macDinhCua("BAI_TAP");
      return createAssignmentBatch(session, {
        classIds: [classId],
        lessonId: null,
        worksheetId: goi.worksheet_id,
        title: goi.name,
        // Neo vào tiết vừa chốt: giờ mở là lúc chốt, hạn do lịch khóa quyết định. Không gửi ngày
        // tuyệt đối — gửi rồi server cũng bỏ qua, và để lại thì màn hình nói một đằng, bảng một nẻo.
        anchorPeriodId: tiet.id,
        dueAt: null,
        status: "PUBLISHED",
        requirement: bo.requirement,
        taskKind: bo.taskKind,
        maxAttempts: bo.maxAttempts,
        latePolicy: bo.latePolicy,
        latePenaltyPercent: bo.latePenaltyPercent,
        answerReveal: bo.answerReveal,
        countsInGradebook: bo.countsInGradebook,
      });
    },
    onSuccess: async (_data, bien) => {
      setDaGiao(cu => [...cu, bien.goi.worksheet_id]);
      await invalidate();
    },
  });

  const error = [listQuery, chotMutation, boChotMutation, giaoMutation]
    .map(q => (q.isError ? messageOf(q.error) : "")).find(Boolean) ?? "";

  const daChot = rows.filter(row => row.closed_at).length;
  const tietKe = rows.find(row => !row.closed_at);

  return <section className="flex flex-col gap-4">
    <div>
      <h3 className="text-base font-bold text-on-surface">Buổi học</h3>
      <p className="text-xs text-on-surface-variant">
        {rows.length ? `Đã dạy ${daChot}/${rows.length} buổi` : "Lớp chưa gắn khóa nào của chương trình"}
        {tietKe && ` · tiếp theo: ${tietKe.strand_name} tiết ${tietKe.period_no}`}
      </p>
    </div>

    {error && <div className="api-error">{error}</div>}

    <div className="flex flex-col divide-y divide-outline-variant border border-outline-variant rounded-lg overflow-hidden">
      {rows.map(row => {
        const moTuan = row.week_starts_on
          ? `tuần ${row.week_no} · ${ngay(row.week_starts_on)}–${ngay(row.week_ends_on)}`
          : `tuần ${row.week_no ?? "?"} · khóa chưa xếp lịch`;
        const dongChot = dangChot === row.id;
        const goiY = ketQua?.periodId === row.id ? ketQua.data : null;
        return (
          <div key={row.id} className="bg-surface-container-lowest">
            <div className="flex items-center justify-between gap-3 p-3 hover:bg-surface-container-low transition-colors">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-on-surface truncate">
                    {row.strand_name} · tiết {row.period_no}
                  </p>
                  {row.closed_at
                    ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-primary-container/30 text-primary">Đã dạy</span>
                    : <span className="text-[11px] font-semibold px-2 py-0.5 rounded border border-outline-variant text-on-surface-variant">Chưa dạy</span>}
                  {row.so_bai_neo > 0 && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-surface-variant text-on-surface-variant">
                      {row.so_bai_neo} bài neo vào buổi này
                    </span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant truncate">
                  {row.title || "—"} · {moTuan}
                  {row.closed_at && ` · chốt lúc ${luc(row.closed_at)}`}
                  {row.note && ` · ${row.note}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {row.closed_at ? (
                  <button onClick={() => { if (confirm(`Bỏ chốt buổi ${row.period_no}? Bài đã mở vẫn mở — học sinh đã thấy rồi.`)) boChotMutation.mutate(row.id); }}
                    className="px-2.5 py-1 text-xs font-semibold text-on-surface-variant hover:bg-surface-container rounded transition-colors">
                    Bỏ chốt
                  </button>
                ) : (
                  <button onClick={() => { setDangChot(dongChot ? null : row.id); setGioDay(""); setGhiChu(""); }}
                    className="h-8 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90 transition-opacity">
                    {dongChot ? "Đóng" : `Hoàn thành buổi ${row.period_no}`}
                  </button>
                )}
              </div>
            </div>

            {dongChot && (
              <form onSubmit={event => { event.preventDefault(); chotMutation.mutate(row.id); }}
                className="border-t border-outline-variant px-3 py-3 flex flex-wrap items-end gap-3 bg-surface-container-low/40">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-on-surface-variant">Giờ dạy thật</span>
                  <input type="datetime-local" value={gioDay} onChange={e => setGioDay(e.target.value)} className={control} />
                  <span className="text-[11px] text-on-surface-variant">Bỏ trống là lấy bây giờ</span>
                </label>
                <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
                  <span className="text-[11px] font-semibold text-on-surface-variant">Ghi chú buổi</span>
                  <input value={ghiChu} onChange={e => setGhiChu(e.target.value)} maxLength={500}
                    placeholder="VD: dạy bù tối thứ Bảy" className={`${control} w-full`} />
                </label>
                <button type="submit" disabled={chotMutation.isPending}
                  className="h-9 px-4 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                  {chotMutation.isPending ? "Đang chốt…" : "Chốt buổi"}
                </button>
              </form>
            )}

            {goiY && (
              <div className="border-t border-outline-variant px-3 py-3 flex flex-col gap-2 bg-primary-container/10">
                <p className="text-xs font-semibold text-primary">
                  Đã chốt lúc {luc(goiY.closedAt)}
                  {goiY.assignmentsOpened > 0 && ` · mở ${goiY.assignmentsOpened} bài đã neo vào buổi này`}
                </p>
                {goiY.suggestions.length ? (
                  <div className="flex flex-col gap-1">
                    {goiY.suggestions.map(goi => (
                      <div key={goi.resource_id} className="flex items-center justify-between gap-3 py-1">
                        <p className="text-sm text-on-surface truncate">
                          {goi.name}
                          <span className="text-xs text-on-surface-variant ml-2">{goi.lesson_name}</span>
                        </p>
                        {daGiao.includes(goi.worksheet_id) ? (
                          <span className="text-xs font-semibold text-primary shrink-0">Đã giao</span>
                        ) : (
                          <button onClick={() => giaoMutation.mutate({ goi, tiet: row })} disabled={giaoMutation.isPending}
                            className="shrink-0 h-8 px-3 rounded-lg border border-primary text-primary text-xs font-semibold hover:bg-primary-container/20 transition-colors disabled:opacity-50">
                            Giao phiếu này, hạn trước buổi sau
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant">
                    Bài học của tiết này chưa gắn phiếu bài tập nào — giao tay ở tab Nhiệm vụ &amp; đề thi.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
      {!rows.length && !listQuery.isLoading && (
        <p className="text-sm text-on-surface-variant text-center py-8">
          Lớp chưa gắn khóa nào — gắn khóa ở phần ghi danh trước khi chốt buổi.
        </p>
      )}
    </div>
  </section>;
}
