import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { closeExam, createExam, deleteExam, getCourseInstances, getExams, getPipelineWorksheets, getTeacherClasses, publishExam, updateExam, type AuthSession, type Exam, type SoanKiThi } from "../api";

/**
 * Kì thi của admin và của giáo viên là cùng một màn hình, chỉ khác tầm với: admin ra đề chung cho
 * khóa, giáo viên ra đề cho lớp mình. Tách thành hai component thì hai bên sẽ trôi lệch từng chút,
 * mà yêu cầu lại là "tương tự nhau".
 *
 * Phát hành không phải là đổi một chữ trạng thái: kì thi rơi xuống thành bài giao ở từng lớp, nên
 * học sinh làm bằng màn làm bài sẵn có và giáo viên chấm bằng màn chấm sẵn có.
 */

const RONG = (scope: "COURSE" | "CLASS"): SoanKiThi => ({
  scope, title: "", description: "", worksheetVersionId: null, durationMinutes: 45,
  openAt: null, dueAt: null, maxAttempts: 1, latePolicy: "REJECT", answerReveal: "AFTER_RETURN", countsInGradebook: true,
});

/** Input datetime-local nói "2026-09-18T07:30"; backend nhận LocalDateTime nên cắt/ghép chuỗi là đủ. */
const choInput = (x: string | null | undefined) => (x ? x.slice(0, 16) : "");
const choApi = (x: string) => (x ? `${x}:00` : null);

const NHAN_TRANG_THAI: Record<string, string> = { DRAFT: "Bản nháp", PUBLISHED: "Đang mở", CLOSED: "Đã đóng" };

export function ExamManager({ session, scope }: { session: AuthSession; scope: "COURSE" | "CLASS" }) {
  const qc = useQueryClient();
  const khoa = scope === "COURSE";
  const [draft, setDraft] = useState<SoanKiThi>(RONG(scope));
  const [dangSua, setDangSua] = useState<number | null>(null);

  const dsKiThi = useQuery({ queryKey: ["exams", scope], queryFn: () => getExams(session, scope) });
  const dsDe = useQuery({ queryKey: ["pipeline-worksheets"], queryFn: () => getPipelineWorksheets(session) });
  // Chỉ khóa/lớp mới cần tra; hỏi cả hai thì vai giáo viên sẽ ăn 403 ở endpoint admin.
  const dsKhoa = useQuery({ queryKey: ["course-instances"], queryFn: () => getCourseInstances(session), enabled: khoa });
  const dsLop = useQuery({ queryKey: ["teacher-classes"], queryFn: () => getTeacherClasses(session), enabled: !khoa });

  // Đề còn nháp thì sửa được, mà sửa sau khi thi thì đề đã nộp khác đề đang xem — backend cũng chặn.
  const deDung = useMemo(() => (dsDe.data ?? []).filter(d => d.version_status === "PUBLISHED"), [dsDe.data]);

  const lamMoi = () => { void qc.invalidateQueries({ queryKey: ["exams", scope] }); };
  const thoi = () => { setDraft(RONG(scope)); setDangSua(null); };
  // Input datetime-local thiếu giây; ghép lại ở đúng một chỗ trước khi rời màn hình.
  const guiDi = (): SoanKiThi => ({ ...draft, openAt: choApi(draft.openAt ?? ""), dueAt: choApi(draft.dueAt ?? "") });
  const luu = useMutation({
    mutationFn: () => (dangSua ? updateExam(session, dangSua, guiDi()) : createExam(session, guiDi())),
    onSuccess: () => { thoi(); lamMoi(); },
  });
  const phatHanh = useMutation({ mutationFn: (id: number) => publishExam(session, id), onSuccess: lamMoi });
  const dong = useMutation({ mutationFn: (id: number) => closeExam(session, id), onSuccess: lamMoi });
  const xoa = useMutation({ mutationFn: (id: number) => deleteExam(session, id), onSuccess: () => { thoi(); lamMoi(); } });

  const sua = (e: Exam) => {
    setDangSua(e.id);
    setDraft({
      scope, courseInstanceId: e.courseInstanceId, classId: e.classId, title: e.title, description: e.description ?? "",
      worksheetVersionId: e.worksheetVersionId, durationMinutes: e.durationMinutes, openAt: choInput(e.openAt), dueAt: choInput(e.dueAt),
      maxAttempts: e.maxAttempts, latePolicy: e.latePolicy, answerReveal: e.answerReveal, countsInGradebook: e.countsInGradebook,
    });
  };

  const capNhat = (x: Partial<SoanKiThi>) => setDraft(cu => ({ ...cu, ...x }));
  const loi = (dsKiThi.error || luu.error || phatHanh.error || dong.error || xoa.error) as Error | null;
  const thieuNoi = khoa ? !draft.courseInstanceId : !draft.classId;

  return <section className="space-y-5">
    <header>
      <h1 className="text-2xl font-bold">{khoa ? "Kì thi của khóa" : "Kì thi của lớp"}</h1>
      <p className="text-sm text-on-surface-variant">
        {khoa
          ? "Một kì thi chung cho cả khóa. Phát hành xong, mỗi lớp của khóa nhận đúng một bài kiểm tra theo lịch của lớp mình."
          : "Kì thi riêng cho một lớp bạn dạy. Phát hành xong, lớp nhận một bài kiểm tra và làm bằng màn làm bài quen thuộc."}
      </p>
    </header>

    {loi && <div className="api-error">{loi.message}</div>}

    <div className="grid gap-5 lg:grid-cols-[minmax(0,400px)_1fr]">
      <form className="card space-y-3 p-4" onSubmit={ev => { ev.preventDefault(); luu.mutate(); }}>
        <h2 className="text-lg font-semibold">{dangSua ? "Sửa kì thi" : "Tạo kì thi"}</h2>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">{khoa ? "Khóa" : "Lớp"}</span>
          {khoa
            ? <select className="input w-full" value={draft.courseInstanceId ?? ""} onChange={e => capNhat({ courseInstanceId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">— Chọn khóa —</option>
                {(dsKhoa.data ?? []).map(k => <option key={k.id} value={k.id}>{k.name} · {k.school_year}</option>)}
              </select>
            : <select className="input w-full" value={draft.classId ?? ""} onChange={e => capNhat({ classId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">— Chọn lớp —</option>
                {(dsLop.data ?? []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Tên kì thi</span>
          <input className="input w-full" value={draft.title} onChange={e => capNhat({ title: e.target.value })} placeholder="Kiểm tra giữa kì I" />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Mô tả</span>
          <textarea className="input w-full" rows={2} value={draft.description ?? ""} onChange={e => capNhat({ description: e.target.value })} />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Đề thi</span>
          <select className="input w-full" value={draft.worksheetVersionId ?? ""} onChange={e => capNhat({ worksheetVersionId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">— Chọn đề đã phát hành —</option>
            {deDung.map(d => <option key={d.worksheet_version_id} value={d.worksheet_version_id}>{d.name} · bản {d.version_no} · {d.item_count} câu</option>)}
          </select>
          {!deDung.length && !dsDe.isLoading && <span className="mt-1 block text-xs text-on-surface-variant">Chưa có đề nào được phát hành. Sang màn Tạo đề để ghép và phát hành một bản đề trước.</span>}
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Thời lượng (phút)</span>
            <input type="number" min={0} className="input w-full" value={draft.durationMinutes ?? ""} onChange={e => capNhat({ durationMinutes: e.target.value ? Number(e.target.value) : null })} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Số lần làm</span>
            <input type="number" min={1} className="input w-full" value={draft.maxAttempts ?? 1} onChange={e => capNhat({ maxAttempts: Number(e.target.value) || 1 })} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Mở lúc</span>
            <input type="datetime-local" className="input w-full" value={choInput(draft.openAt)} onChange={e => capNhat({ openAt: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Hạn nộp</span>
            <input type="datetime-local" className="input w-full" value={choInput(draft.dueAt)} onChange={e => capNhat({ dueAt: e.target.value })} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Nộp muộn</span>
            <select className="input w-full" value={draft.latePolicy ?? "REJECT"} onChange={e => capNhat({ latePolicy: e.target.value })}>
              <option value="REJECT">Quá hạn là đóng</option>
              <option value="ACCEPT">Nhận muộn, nguyên điểm</option>
              <option value="PENALTY">Nhận muộn, có trừ</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Hiện đáp án</span>
            <select className="input w-full" value={draft.answerReveal ?? "AFTER_RETURN"} onChange={e => capNhat({ answerReveal: e.target.value })}>
              <option value="AFTER_RETURN">Sau khi trả bài</option>
              <option value="AFTER_SUBMIT">Ngay sau khi nộp</option>
              <option value="IMMEDIATE">Ngay khi làm</option>
            </select>
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.countsInGradebook ?? true} onChange={e => capNhat({ countsInGradebook: e.target.checked })} />
          <span>Tính vào sổ điểm</span>
        </label>

        <div className="flex gap-2 pt-1">
          <button type="submit" className="btn-primary" disabled={luu.isPending || !draft.title.trim() || thieuNoi || !draft.worksheetVersionId}>
            {luu.isPending ? "Đang lưu…" : dangSua ? "Lưu thay đổi" : "Tạo kì thi"}
          </button>
          {dangSua && <button type="button" className="btn-ghost" onClick={thoi}>Thôi</button>}
        </div>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-surface-variant text-left">
            <tr>
              <th className="px-3 py-2">Kì thi</th>
              <th className="px-3 py-2">{khoa ? "Khóa" : "Lớp"}</th>
              <th className="px-3 py-2">Đề</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Lớp nhận</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {dsKiThi.isLoading && <tr><td className="px-3 py-4 text-on-surface-variant" colSpan={6}>Đang tải…</td></tr>}
            {!dsKiThi.isLoading && !(dsKiThi.data ?? []).length && <tr><td className="px-3 py-4 text-on-surface-variant" colSpan={6}>Chưa có kì thi nào.</td></tr>}
            {(dsKiThi.data ?? []).map(e => <tr key={e.id} className="border-t border-outline-variant">
              <td className="px-3 py-2">
                <div className="font-medium">{e.title}</div>
                {e.durationMinutes ? <div className="text-xs text-on-surface-variant">{e.durationMinutes} phút</div> : null}
              </td>
              <td className="px-3 py-2">{e.courseName ?? e.className ?? "—"}</td>
              <td className="px-3 py-2">{e.worksheetTitle ?? "—"}</td>
              <td className="px-3 py-2">{NHAN_TRANG_THAI[e.status] ?? e.status}</td>
              {/* Hai số khác nhau: chạm tới mấy lớp, và đã thật sự rơi xuống mấy lớp. */}
              <td className="px-3 py-2">{e.assignmentCount}/{e.classCount}</td>
              <td className="space-x-2 whitespace-nowrap px-3 py-2 text-right">
                <button className="btn-ghost" onClick={() => sua(e)}>Sửa</button>
                {e.status !== "CLOSED" && <button className="btn-primary" disabled={phatHanh.isPending || !e.worksheetVersionId} onClick={() => phatHanh.mutate(e.id)}>
                  {e.status === "PUBLISHED" ? "Phát hành lại" : "Phát hành"}
                </button>}
                {e.status === "PUBLISHED" && <button className="btn-ghost" disabled={dong.isPending} onClick={() => dong.mutate(e.id)}>Đóng</button>}
                <button className="btn-ghost text-error" onClick={() => { if (confirm(`Xoá kì thi "${e.title}"? Các bài kiểm tra đã phát hành sẽ bị đóng.`)) xoa.mutate(e.id); }}>Xoá</button>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  </section>;
}
