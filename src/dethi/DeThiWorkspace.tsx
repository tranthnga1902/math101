import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import katex from "katex";
import { TeacherContentPipeline } from "../teacher/TeacherContentPipeline";
import { composePipelineWorksheet, getKhoCauHoi, soanCauHoi, suaCauHoi, xoaCauHoi, type AuthSession, type ExtractedQuestion, type KieuCauHoi, type SoanCauHoi } from "../api";

/**
 * Màn tạo đề dùng chung cho admin và giáo viên: cùng một component, vì backend đã mở cùng một
 * đường ống cho cả hai vai.
 *
 * Hai lối vào một kho câu hỏi: nhập từ tài liệu (PDF/Word/scan, máy bóc tách) và soạn thủ công.
 * Chưa có ngân hàng câu hỏi dùng chung, nên kho ở đây là kho riêng của người soạn.
 */

const KIEU: Array<{ ma: KieuCauHoi; ten: string; goiY: string }> = [
  { ma: "MCQ", ten: "Trắc nghiệm A/B/C/D", goiY: "Đáp án là một chữ cái: A, B, C hoặc D" },
  { ma: "DUNG_SAI_4Y", ten: "Đúng/Sai 4 ý", goiY: "Đáp án gồm đúng 4 chữ D hoặc S, ví dụ DSSD" },
  { ma: "TRA_LOI_NGAN", ten: "Trả lời ngắn", goiY: "Đáp án là một số, ví dụ 3,5" },
  { ma: "TU_LUAN", ten: "Tự luận", goiY: "Giáo viên chấm tay, không cần đáp án máy đọc được" },
];

const RONG: SoanCauHoi = { questionType: "MCQ", questionText: "", optionA: "", optionB: "", optionC: "", optionD: "", answerText: "", solutionText: "", maxScore: 1 };

export function DeThiWorkspace({ session }: { session: AuthSession }) {
  const [tab, setTab] = useState<"tailieu" | "thucong">("tailieu");
  return <section className="space-y-5">
    <header>
      <h1 className="text-2xl font-bold">Tạo đề</h1>
      <p className="text-sm text-on-surface-variant">Nhập từ tài liệu để máy bóc tách, hoặc soạn từng câu bằng tay. Câu nào cũng vào chung một kho để ghép đề.</p>
    </header>
    <nav className="flex gap-2 border-b border-outline-variant">
      {([["tailieu", "Nhập từ tài liệu"], ["thucong", "Soạn thủ công"]] as const).map(([ma, ten]) =>
        <button key={ma} onClick={() => setTab(ma)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === ma ? "border-primary text-primary" : "border-transparent text-on-surface-variant"}`}>{ten}</button>)}
    </nav>
    {tab === "tailieu" ? <TeacherContentPipeline session={session} /> : <SoanThuCong session={session} />}
  </section>;
}

function SoanThuCong({ session }: { session: AuthSession }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<SoanCauHoi>(RONG);
  const [dangSua, setDangSua] = useState<number | null>(null);
  const [chon, setChon] = useState<number[]>([]);
  const [tenDe, setTenDe] = useState("Đề soạn tay");
  const kho = useQuery({ queryKey: ["kho-cau-hoi"], queryFn: () => getKhoCauHoi(session) });
  const lamMoi = () => { void qc.invalidateQueries({ queryKey: ["kho-cau-hoi"] }); };
  const luu = useMutation({
    mutationFn: () => dangSua ? suaCauHoi(session, dangSua, draft) : soanCauHoi(session, draft),
    onSuccess: () => { setDraft(RONG); setDangSua(null); lamMoi(); },
  });
  const xoa = useMutation({ mutationFn: (id: number) => xoaCauHoi(session, id), onSuccess: lamMoi });
  const ghep = useMutation({
    mutationFn: () => composePipelineWorksheet(session, tenDe, chon.map(questionId => ({ questionId }))),
    onSuccess: () => { setChon([]); void qc.invalidateQueries({ queryKey: ["pipeline-worksheets"] }); },
  });
  const loi = (kho.error || luu.error || xoa.error || ghep.error) as Error | null;
  const kieu = draft.questionType;

  return <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
    {loi && <div className="api-error lg:col-span-2">{loi.message}</div>}
    <form onSubmit={e => { e.preventDefault(); luu.mutate(); }} className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <h2 className="font-semibold">{dangSua ? `Sửa câu #${dangSua}` : "Câu hỏi mới"}</h2>
      <label className="block text-sm">Kiểu câu
        <select value={kieu} onChange={e => setDraft({ ...draft, questionType: e.target.value as KieuCauHoi, answerText: "" })} className="mt-1 h-10 w-full rounded-lg border px-2">
          {KIEU.map(k => <option key={k.ma} value={k.ma}>{k.ten}</option>)}
        </select>
      </label>
      <label className="block text-sm">Nội dung câu hỏi
        <textarea required value={draft.questionText} onChange={e => setDraft({ ...draft, questionText: e.target.value })} placeholder="Gõ công thức trong $...$ để xem trước" className="mt-1 min-h-24 w-full rounded-lg border p-2" />
      </label>
      <XemTruoc text={draft.questionText} />
      {kieu === "MCQ" && <div className="grid gap-2 sm:grid-cols-2">
        {(["optionA", "optionB", "optionC", "optionD"] as const).map((k, i) =>
          <input key={k} value={draft[k] ?? ""} onChange={e => setDraft({ ...draft, [k]: e.target.value })} placeholder={`Phương án ${"ABCD"[i]}`} className="rounded border px-2 py-1" />)}
      </div>}
      {kieu !== "TU_LUAN" && <label className="block text-sm">Đáp án đúng
        <input required value={draft.answerText ?? ""} onChange={e => setDraft({ ...draft, answerText: e.target.value })} className="mt-1 h-10 w-full rounded-lg border px-2" />
        <small className="text-on-surface-variant">{KIEU.find(k => k.ma === kieu)?.goiY}</small>
      </label>}
      {kieu === "TRA_LOI_NGAN" && <label className="block text-sm">Dung sai cho phép
        <input type="number" step="0.0001" min="0" defaultValue={0.0001}
          onChange={e => setDraft({ ...draft, answerPayload: JSON.stringify({ tolerance: Number(e.target.value) || 0 }) })}
          className="mt-1 h-10 w-full rounded-lg border px-2" />
        <small className="text-on-surface-variant">Chênh lệch trong khoảng này vẫn tính đúng.</small>
      </label>}
      <label className="block text-sm">Lời giải (không bắt buộc)
        <textarea value={draft.solutionText ?? ""} onChange={e => setDraft({ ...draft, solutionText: e.target.value })} className="mt-1 min-h-16 w-full rounded-lg border p-2" />
      </label>
      <label className="block text-sm">Điểm tối đa của câu
        <input type="number" step="0.25" min="0.25" max="10" value={draft.maxScore ?? 1} onChange={e => setDraft({ ...draft, maxScore: Number(e.target.value) })} className="mt-1 h-10 w-full rounded-lg border px-2" />
      </label>
      <div className="flex gap-2">
        <button disabled={luu.isPending} className="rounded-lg bg-primary px-4 py-2 text-on-primary">{luu.isPending ? "Đang lưu…" : dangSua ? "Lưu thay đổi" : "Thêm vào kho"}</button>
        {dangSua && <button type="button" onClick={() => { setDraft(RONG); setDangSua(null); }} className="rounded-lg border px-4 py-2">Huỷ</button>}
      </div>
    </form>

    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
        <b className="mr-auto">Kho câu hỏi ({(kho.data ?? []).length}) · đã chọn {chon.length}</b>
        <input value={tenDe} onChange={e => setTenDe(e.target.value)} className="h-10 min-w-56 rounded-lg border px-3" />
        <button disabled={!chon.length || ghep.isPending} onClick={() => ghep.mutate()} className="rounded-lg bg-primary px-4 py-2 text-on-primary">Ghép thành đề</button>
      </div>
      {(kho.data ?? []).map(q => <TheCauHoi key={q.id} q={q}
        chon={chon.includes(q.id)}
        onChon={() => setChon(x => x.includes(q.id) ? x.filter(i => i !== q.id) : [...x, q.id])}
        onSua={() => { setDangSua(q.id); setDraft(thanhDraft(q)); }}
        onXoa={() => xoa.mutate(q.id)} />)}
      {!kho.isLoading && !(kho.data ?? []).length && <div className="rounded-xl border p-8 text-center text-on-surface-variant">Kho còn trống. Soạn câu đầu tiên ở bên trái, hoặc nhập từ tài liệu.</div>}
    </div>
  </div>;
}

function thanhDraft(q: ExtractedQuestion): SoanCauHoi {
  return {
    questionType: (KIEU.some(k => k.ma === q.question_type) ? q.question_type : "MCQ") as KieuCauHoi,
    questionText: q.question_text, optionA: q.option_a, optionB: q.option_b, optionC: q.option_c, optionD: q.option_d,
    answerText: q.answer_text, solutionText: q.solution_text,
    answerPayload: q.answer_payload ? JSON.stringify(q.answer_payload) : null,
    maxScore: q.max_score == null ? 1 : Number(q.max_score),
  };
}

function TheCauHoi({ q, chon, onChon, onSua, onXoa }: { q: ExtractedQuestion; chon: boolean; onChon: () => void; onSua: () => void; onXoa: () => void }) {
  const ten = KIEU.find(k => k.ma === q.question_type)?.ten ?? q.question_type;
  return <article className="flex gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
    <input type="checkbox" checked={chon} onChange={onChon} className="mt-1" />
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-primary-container px-2 py-1">{ten}</span>
        <span className="rounded bg-surface-container px-2 py-1">{Number(q.max_score ?? 1)} điểm</span>
        <span className="text-on-surface-variant">{q.source_title ? `Từ: ${q.source_title}` : "Soạn tay"}</span>
        <button onClick={onSua} className="ml-auto text-primary">Sửa</button>
        <button onClick={onXoa} className="text-error">Lưu trữ</button>
      </div>
      <XemTruoc text={q.question_text} />
      {q.question_type === "MCQ" && <div className="grid gap-1 text-sm sm:grid-cols-2">
        {([["A", q.option_a], ["B", q.option_b], ["C", q.option_c], ["D", q.option_d]] as const).filter(([, v]) => v).map(([k, v]) => <span key={k}>{k}. {v}</span>)}
      </div>}
      {q.question_type !== "TU_LUAN" && <p className="mt-1 text-sm text-on-surface-variant">Đáp án: <b>{q.answer_text}</b></p>}
    </div>
  </article>;
}

/** Xem trước công thức: mọi đoạn trong $...$ render bằng KaTeX, phần còn lại giữ nguyên chữ. */
function XemTruoc({ text }: { text: string }) {
  const html = useMemo(() => (text || "").split(/\$([^$]+)\$/g)
    .map((phan, i) => i % 2 ? katex.renderToString(phan, { throwOnError: false })
      : phan.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string)))
    .join(""), [text]);
  if (!text) return null;
  return <div className="mt-2 rounded-lg bg-surface-container-low p-2 text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
}
