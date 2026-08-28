import { useEffect, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { useQuery } from "@tanstack/react-query";
import {
  getMyAssignments,
  getPublicProblem,
  markProblemProgress,
  submitAssignment,
  saveAssignmentAnswers,
  getAssignmentResult,
  type AuthSession,
  type SubmissionItemView,
} from "../api";
import { assignmentGate } from "./format";

/** Trùng với `WorksheetScoring.MAX_DO_DAI_TU_LUAN` bên server — chặn ở đây để em biết trước khi gửi. */
const MAX_DO_DAI_TU_LUAN = 5000;
const TRE_LUU_TU_LUAN = 800;

type WorksheetRunnerProps = {
  session: AuthSession;
  assignmentId: number;
  onBack: () => void;
};

function renderStatement(latex: string): string {
  return katex.renderToString(latex.replace(/^\$|\$$/g, ""), { throwOnError: false, displayMode: false });
}

export function WorksheetRunner({ session, assignmentId, onBack }: WorksheetRunnerProps) {
  const assignmentsQuery = useQuery({
    queryKey: ["student-assignments", session.userId],
    queryFn: () => getMyAssignments(session),
  });
  const assignment = (assignmentsQuery.data ?? []).find((item) => item.id === assignmentId) ?? null;
  const savedQuery=useQuery({queryKey:["assignment-draft",assignmentId],queryFn:()=>getAssignmentResult(session,assignmentId),enabled:Boolean(assignment)});
  const firstProblem = assignment?.items[0] ?? null;
  const [index, setIndex] = useState(0);
  const [answers,setAnswers]=useState<Record<number,string>>({});
  const [submitting,setSubmitting]=useState(false);
  const [submitError,setSubmitError]=useState("");
  const [submitted,setSubmitted]=useState(false);
  const [saveState,setSaveState]=useState<"idle"|"saving"|"saved"|"error">("idle");
  // Bài tự luận gõ tới đâu lưu tới đó thì mỗi phím một lượt gọi API. Chờ ngớt tay rồi mới gửi,
  // và giữ hẹn giờ trong ref để lần gõ sau huỷ được lần trước.
  const henLuu=useRef<number|null>(null);
  useEffect(()=>{if(savedQuery.data?.answers)setAnswers(savedQuery.data.answers)},[savedQuery.data]);
  useEffect(()=>()=>{if(henLuu.current)window.clearTimeout(henLuu.current)},[]);
  const total = assignment?.items.length ?? 0;

  if (assignmentsQuery.error) {
    return (
      <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm">
        {(assignmentsQuery.error as Error).message}
      </div>
    );
  }
  if (!assignment || !firstProblem) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 text-center text-sm text-on-surface-variant">
        Phiếu bài tập không tồn tại hoặc đã hết hạn.
        <div className="mt-4">
          <button type="button" onClick={onBack} className="inline-flex h-10 px-4 rounded-lg bg-primary text-on-primary text-sm font-medium">
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  const problem = assignment.items[index] ?? firstProblem;
  // Hết hạn / hết lượt / đã trả điểm thì màn hình chuyển sang chỉ đọc. Server chặn thật ở
  // saveAnswers lẫn submit; ở đây chỉ để học sinh không gõ một lúc rồi mới biết là không lưu được.
  const gate = assignmentGate(assignment);
  const readOnly = !gate.canSubmit;
  const coChu=(problemId:number)=>(answers[problemId]??"").trim()!=="";
  // Đếm theo câu của đề chứ không đếm số khoá trong `answers`: câu tự luận gõ rồi xoá vẫn để lại
  // một chuỗi rỗng, đếm nó là mở nút Nộp bài cho một bài còn bỏ trống.
  const daTraLoi=assignment.items.filter(item=>coChu(item.problemId)).length;
  const luuNgay=async(problemId:number,answer:string)=>{
    setSaveState("saving");
    try{await saveAssignmentAnswers(session,assignment.id,{[problemId]:answer});setSaveState("saved")}
    catch{setSaveState("error")}
  };
  const goTuLuan=(problemId:number,text:string)=>{
    setAnswers(current=>({...current,[problemId]:text}));
    if(henLuu.current)window.clearTimeout(henLuu.current);
    henLuu.current=window.setTimeout(()=>{void luuNgay(problemId,text)},TRE_LUU_TU_LUAN);
  };
  // Rời ô là gửi luôn, không đợi hết hẹn: bấm sang câu khác rồi đóng tab trong vòng 800ms thì
  // đoạn vừa gõ mất trắng.
  const roiOTuLuan=(problemId:number)=>{
    if(!henLuu.current)return;
    window.clearTimeout(henLuu.current);henLuu.current=null;
    void luuNgay(problemId,answers[problemId]??"");
  };
  const ketQua=savedQuery.data?.items??[];

  return (
    <div className="space-y-4">
      {readOnly && (
        <div className="bg-surface-container-high text-on-surface-variant px-4 py-3 rounded-lg text-sm font-medium">
          Bài này đã khoá ({gate.note.toLowerCase()}) — em vẫn xem lại được đề và bài làm, nhưng không sửa hay nộp lại được.
        </div>
      )}
      <header className="flex items-center justify-between text-xs text-on-surface-variant">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 font-medium hover:text-primary">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span> Quay lại
        </button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-on-surface">{assignment.title}</span>
          <span className="material-symbols-outlined text-[16px]">cloud_done</span>
          Tiến độ: Câu {index + 1}/{total}
        </div>
        <span className="font-medium">{problem.publicCode}</span>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <ProblemCard session={session} slug={problem.qrSlug} problemLatex={problem.statementLatex} options={[problem.optionA,problem.optionB,problem.optionC,problem.optionD]} essay={problem.essay} readOnly={readOnly} answer={answers[problem.problemId]??null} saveState={saveState} onSelect={async option=>{if(readOnly)return;setAnswers(current=>({...current,[problem.problemId]:option}));await luuNgay(problem.problemId,option)}} onEssay={text=>{if(readOnly)return;goTuLuan(problem.problemId,text)}} onEssayBlur={()=>roiOTuLuan(problem.problemId)}/>
        <QuestionNav
          total={total}
          index={index}
          onSelect={setIndex}
          problems={assignment.items}
          answered={assignment.items.map(item=>coChu(item.problemId))}
        />
      </div>

      <footer className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
          className="inline-flex h-11 px-5 items-center gap-2 rounded-lg border border-outline-variant text-sm font-medium disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Câu trước
        </button>
        {index>=total-1?<button type="button" disabled={readOnly||submitting||daTraLoi!==total||submitted} title={daTraLoi===total?undefined:`Còn ${total-daTraLoi} câu chưa trả lời`} onClick={async()=>{setSubmitting(true);setSubmitError("");try{await submitAssignment(session,assignment.id,answers);setSubmitted(true);await Promise.all([assignmentsQuery.refetch(),savedQuery.refetch()])}catch(reason){setSubmitError(reason instanceof Error?reason.message:"Không thể nộp bài")}finally{setSubmitting(false)}}} className="inline-flex h-11 px-5 items-center gap-2 rounded-lg bg-primary text-on-primary text-sm font-medium disabled:opacity-50">{submitting?"Đang nộp…":submitted?"Đã nộp bài":readOnly?"Đã khoá":daTraLoi===total?"Nộp bài":`Còn ${total-daTraLoi} câu`}</button>:<button
          type="button"
          disabled={index >= total - 1}
          onClick={() => setIndex((value) => Math.min(total - 1, value + 1))}
          className="inline-flex h-11 px-5 items-center gap-2 rounded-lg bg-primary text-on-primary text-sm font-medium disabled:opacity-50"
        >
          Câu sau
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>}
      </footer>
      {submitError&&<div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm">{submitError}</div>}
      {submitted&&<div className="bg-secondary-container text-on-secondary-container px-4 py-3 rounded-lg text-sm font-medium">Bài đã được chấm tự động và gửi cho giáo viên. Điểm sẽ hiển thị sau khi giáo viên trả bài.</div>}
      {ketQua.length>0&&<KetQuaTungCau items={ketQua} onSelect={setIndex}/>}
    </div>
  );
}

/**
 * Điểm từng câu sau khi giáo viên đã trả bài. Trước lát này học sinh chỉ nhận về một con số cho
 * cả bài, không có chỗ nào cho biết mất điểm ở câu nào — nhất là với đề tự luận.
 *
 * <p>Không có cột đáp án đúng: server không gửi nó qua đường này.
 */
function KetQuaTungCau({items,onSelect}:{items:SubmissionItemView[];onSelect:(index:number)=>void}){
  const soLe=(value:number|null)=>value==null?"—":Number(value).toLocaleString("vi-VN");
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold border-b border-outline-variant pb-2">Điểm từng câu</h3>
      <div className="space-y-2">
        {items.map(item=>(
          <div key={item.problemId} className="border border-outline-variant rounded-lg p-3 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={()=>onSelect(item.orderNo-1)} className="text-sm font-semibold text-primary hover:underline">
                Câu {item.orderNo}{item.publicCode?` · ${item.publicCode}`:""}
              </button>
              <span className="text-sm font-bold data-tabular">
                {item.score==null?<span className="text-on-surface-variant font-medium">Chưa chấm</span>:`${soLe(item.score)}/${soLe(item.maxScore)}`}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              <span className="font-medium">{item.essay?"Bài làm: ":"Em chọn: "}</span>
              {item.studentAnswer?.trim()||"(bỏ trống)"}
            </p>
            {item.feedback&&<p className="text-sm bg-surface-container rounded p-2"><span className="font-semibold">Nhận xét: </span>{item.feedback}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function ProblemCard({
  session,
  slug,
  problemLatex,
  options,
  essay,
  readOnly,
  answer,
  onSelect,
  onEssay,
  onEssayBlur,
  saveState,
}: {
  session: AuthSession;
  slug: string | null;
  problemLatex: string;
  options:(string|null)[];
  essay:boolean;
  readOnly:boolean;
  answer:string|null;
  onSelect:(option:string)=>Promise<void>;
  onEssay:(text:string)=>void;
  onEssayBlur:()=>void;
  saveState:"idle"|"saving"|"saved"|"error";
}) {
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const selected = essay ? null : answer;

  const problemQuery = useQuery({
    queryKey: ["public-problem", slug],
    queryFn: () => getPublicProblem(slug as string),
    enabled: Boolean(slug),
  });

  const handleSelect = async (option: string) => {
    await onSelect(option);
    setBusy(true);
    try {
      if(slug)await markProblemProgress(session, problemQuery.data?.problem.id ?? 0, false);
    } finally {
      setBusy(false);
    }
  };

  // Câu trắc nghiệm nhập từ PDF in bốn phương án ngay trong đề bài nên `options` rỗng — vẫn phải
  // hiện bốn nút A/B/C/D, vì server đợi A/B/C/D. Chỉ cờ `essay` mới được quyết định điều đó.
  const optionKeys = essay ? [] : ["A", "B", "C", "D"];
  const hint = problemQuery.data?.hints[0]?.contentLatex;
  const daGo = (answer ?? "").length;

  return (
    <section className="lg:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between border-b border-outline-variant pb-3">
        <h2 className="text-lg font-semibold text-primary">Đề bài</h2>
        <span className="text-xs text-on-surface-variant inline-flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">cloud_done</span>
          {saveState==="saving"?"Đang lưu…":saveState==="error"?"Lưu thất bại":"Đã lưu"}
        </span>
      </div>
      <p
        className="text-base leading-relaxed"
        dangerouslySetInnerHTML={{ __html: renderStatement(problemLatex) }}
      />
      {optionKeys.length ? (
        <div className="space-y-2">
          {optionKeys.map((option,optionIndex) => (
            <button
              key={option}
              type="button"
              disabled={readOnly}
              onClick={() => void handleSelect(option)}
              className={`w-full text-left p-3 rounded-lg border flex items-center gap-3 transition-colors disabled:opacity-60 ${
                selected === option
                  ? "border-primary bg-primary-container/20"
                  : "border-outline-variant hover:border-primary/40"
              }`}
            >
              <span
                className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm font-semibold ${
                  selected === option ? "border-primary bg-primary text-on-primary" : "border-outline-variant text-outline"
                }`}
              >
                {option}
              </span>
              <span className="text-sm">{options[optionIndex]||`Lựa chọn ${option}`}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-on-surface" htmlFor="tra-loi-tu-luan">
            Bài làm tự luận
          </label>
          <textarea
            id="tra-loi-tu-luan"
            rows={8}
            disabled={readOnly}
            maxLength={MAX_DO_DAI_TU_LUAN}
            value={answer ?? ""}
            onChange={(event) => onEssay(event.target.value)}
            onBlur={onEssayBlur}
            placeholder="Trình bày lời giải ở đây…"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm leading-relaxed focus:border-primary focus:outline-none disabled:opacity-60"
          />
          <p className="text-xs text-on-surface-variant flex items-center justify-between gap-2">
            <span>Câu này giáo viên chấm tay, không có đáp án tự động.</span>
            <span className="data-tabular">{daGo}/{MAX_DO_DAI_TU_LUAN}</span>
          </p>
        </div>
      )}

      <div className="border-t border-outline-variant pt-4">
        {!revealed ? (
          <button
            type="button"
            disabled={!(answer ?? "").trim() || !slug || busy}
            onClick={() => setRevealed(true)}
            className="inline-flex h-10 px-4 items-center gap-2 rounded-lg bg-primary text-on-primary text-sm font-medium disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            Xem gợi ý
          </button>
        ) : (
          <div className="bg-surface-container-low border border-outline-variant rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">lightbulb</span>
              Gợi ý
            </h4>
            {hint ? (
              <p
                className="text-sm"
                dangerouslySetInnerHTML={{ __html: renderStatement(hint) }}
              />
            ) : (
              <p className="text-sm text-on-surface-variant">Bài này chưa có gợi ý.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * `answered` để học sinh nhìn ra câu nào còn bỏ trống. Cần từ khi có câu tự luận: đề trắc nghiệm
 * thì lướt bốn nút là biết mình đã chọn chưa, còn đề dài có ô gõ chữ thì "còn 3 câu chưa trả lời"
 * mà không chỉ ra câu nào là bắt em dò lại từ đầu.
 */
function QuestionNav({
  total,
  index,
  onSelect,
  problems,
  answered,
}: {
  total: number;
  index: number;
  onSelect: (next: number) => void;
  problems: Array<{ problemId: number; publicCode: string; essay: boolean }>;
  answered: boolean[];
}) {
  return (
    <aside className="lg:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold border-b border-outline-variant pb-2 flex items-center justify-between gap-2">
        <span>Danh sách câu hỏi</span>
        <span className="text-xs font-medium text-on-surface-variant data-tabular">
          {answered.filter(Boolean).length}/{total} đã làm
        </span>
      </h3>
      <div className="grid grid-cols-5 gap-2 thin-scrollbar max-h-80 overflow-y-auto">
        {Array.from({ length: total }).map((_, idx) => {
          const active = idx === index;
          const item = problems[idx];
          const code = item?.publicCode ?? `${idx + 1}`;
          const done = answered[idx] ?? false;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelect(idx)}
              className={`relative h-10 rounded border text-xs font-medium transition-colors ${
                active
                  ? "border-2 border-primary bg-primary-container text-on-primary-container"
                  : done
                    ? "border-primary/50 bg-primary-container/20 hover:border-primary"
                    : "border-outline-variant bg-surface-container-lowest hover:border-primary/40"
              }`}
              title={`${code}${item?.essay ? " · tự luận" : ""}${done ? " · đã làm" : " · chưa làm"}`}
            >
              {idx + 1}
              {item?.essay && <span className="absolute top-0.5 right-1 text-[10px] leading-none text-on-surface-variant">TL</span>}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-on-surface-variant">TL = câu tự luận, giáo viên chấm tay.</p>
    </aside>
  );
}
