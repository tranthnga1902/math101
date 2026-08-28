import katex from "katex";
import type { SubmissionItemView } from "../api";
import type { useGradingSheet } from "./useGradingSheet";

/**
 * Bảng chấm từng câu, dùng chung cho cả hai hộp chấm. Class ở đây là CSS toàn cục trong
 * `home.css` (`.grading-sheet-*`) chứ không phải Tailwind, nên đặt vào hộp nào cũng ra đúng
 * hình — kể cả hộp Tailwind của bảng chấm trong chi tiết lớp.
 */
export function GradingSheetItems({ state }: { state: ReturnType<typeof useGradingSheet> }) {
 const { items, tuLuan, conThieu, scores, notes, sheet, setScore, setNote } = state;
 return <>
  <div className="grading-sheet-summary">
   <span>Đã chấm <b>{tuLuan.length - conThieu}</b>/{tuLuan.length} câu tự luận</span>
   <span>Điểm tối đa mỗi câu <b>{sheet.data?.maxScoreMoiCau == null ? "—" : Number(sheet.data.maxScoreMoiCau).toLocaleString("vi-VN")}</b></span>
   <span>Tổng hiện tại <b>{sheet.data?.rawScore == null ? "chưa chốt" : Number(sheet.data.rawScore).toLocaleString("vi-VN")}</b>/10</span>
  </div>
  <div className="grading-sheet-items">
   {items.map(item => <ItemRow key={item.problemId} item={item}
     score={scores[item.problemId] ?? ""} note={notes[item.problemId] ?? ""}
     max={sheet.data?.maxScoreMoiCau ?? null}
     onScore={value => setScore(item.problemId, value)}
     onNote={value => setNote(item.problemId, value)} />)}
  </div>
 </>;
}

/** Một dòng trong bảng chấm. Câu trắc nghiệm chỉ để đọc: điểm của nó do đáp án đề quyết định. */
function ItemRow({ item, score, note, max, onScore, onNote }: { item: SubmissionItemView; score: string; note: string; max: number | null; onScore: (value: string) => void; onNote: (value: string) => void }) {
 const de = item.statement ? katex.renderToString(item.statement.replace(/^\$|\$$/g, ""), { throwOnError: false, displayMode: false }) : "";
 return <article className={`grading-sheet-row${item.essay ? " essay" : ""}`}>
  <header>
   <b>Câu {item.orderNo}{item.publicCode ? ` · ${item.publicCode}` : ""}</b>
   <span>{item.essay ? "Tự luận" : `Trắc nghiệm · đáp án ${item.correctOption ?? "—"}`}</span>
  </header>
  {de && <div className="grading-sheet-statement" dangerouslySetInnerHTML={{ __html: de }} />}
  <p className="grading-sheet-answer"><span>Bài làm:</span> {item.studentAnswer?.trim() || "(bỏ trống)"}</p>
  {item.essay ? <div className="grading-sheet-inputs">
   <label>Điểm câu này<input type="number" min="0" max={max ?? undefined} step="0.01" value={score} placeholder="chưa chấm" onChange={event => onScore(event.target.value)} /></label>
   <label>Nhận xét câu này<textarea rows={2} value={note} onChange={event => onNote(event.target.value)} placeholder="Ví dụ: thiếu bước biện luận…" /></label>
  </div> : <p className="grading-sheet-auto">Máy chấm: <b>{item.score == null ? "—" : Number(item.score).toLocaleString("vi-VN")}</b>/{item.maxScore == null ? "—" : Number(item.maxScore).toLocaleString("vi-VN")}</p>}
 </article>;
}
