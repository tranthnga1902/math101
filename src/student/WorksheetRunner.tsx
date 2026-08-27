import { useEffect, useState } from "react";
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
} from "../api";
import { assignmentGate } from "./format";

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
  useEffect(()=>{if(savedQuery.data?.answers)setAnswers(savedQuery.data.answers)},[savedQuery.data]);
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
        <ProblemCard session={session} slug={problem.qrSlug} problemLatex={problem.statementLatex} options={[problem.optionA,problem.optionB,problem.optionC,problem.optionD]} selected={answers[problem.problemId]??null} saveState={saveState} onSelect={async option=>{if(readOnly)return;setAnswers(current=>({...current,[problem.problemId]:option}));setSaveState("saving");try{await saveAssignmentAnswers(session,assignment.id,{[problem.problemId]:option});setSaveState("saved")}catch{setSaveState("error")}}}/>
        <QuestionNav
          total={total}
          index={index}
          onSelect={setIndex}
          problems={assignment.items}
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
        {index>=total-1?<button type="button" disabled={readOnly||submitting||Object.keys(answers).length!==total||submitted} onClick={async()=>{setSubmitting(true);setSubmitError("");try{await submitAssignment(session,assignment.id,answers);setSubmitted(true);await assignmentsQuery.refetch()}catch(reason){setSubmitError(reason instanceof Error?reason.message:"Không thể nộp bài")}finally{setSubmitting(false)}}} className="inline-flex h-11 px-5 items-center gap-2 rounded-lg bg-primary text-on-primary text-sm font-medium disabled:opacity-50">{submitting?"Đang nộp…":submitted?"Đã nộp bài":readOnly?"Đã khoá":"Nộp bài"}</button>:<button
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
    </div>
  );
}

function ProblemCard({
  session,
  slug,
  problemLatex,
  options,
  selected,
  onSelect,
  saveState,
}: {
  session: AuthSession;
  slug: string | null;
  problemLatex: string;
  options:(string|null)[];
  selected:string|null;
  onSelect:(option:string)=>Promise<void>;
  saveState:"idle"|"saving"|"saved"|"error";
}) {
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);

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

  const optionKeys = options.some(Boolean) ? ["A", "B", "C", "D"] : [];
  const hint = problemQuery.data?.hints[0]?.contentLatex;

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
              onClick={() => void handleSelect(option)}
              className={`w-full text-left p-3 rounded-lg border flex items-center gap-3 transition-colors ${
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
        <p className="text-sm text-on-surface-variant">Bài tập dạng tự luận — hãy làm trên giấy và quét QR để đối chiếu.</p>
      )}

      <div className="border-t border-outline-variant pt-4">
        {!revealed ? (
          <button
            type="button"
            disabled={!selected || !slug || busy}
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

function QuestionNav({
  total,
  index,
  onSelect,
  problems,
}: {
  total: number;
  index: number;
  onSelect: (next: number) => void;
  problems: Array<{ problemId: number; publicCode: string }>;
}) {
  return (
    <aside className="lg:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold border-b border-outline-variant pb-2">Danh sách câu hỏi</h3>
      <div className="grid grid-cols-5 gap-2 thin-scrollbar max-h-80 overflow-y-auto">
        {Array.from({ length: total }).map((_, idx) => {
          const active = idx === index;
          const code = problems[idx]?.publicCode ?? `${idx + 1}`;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelect(idx)}
              className={`h-10 rounded border text-xs font-medium transition-colors ${
                active
                  ? "border-2 border-primary bg-primary-container text-on-primary-container"
                  : "border-outline-variant bg-surface-container-lowest hover:border-primary/40"
              }`}
              title={code}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
