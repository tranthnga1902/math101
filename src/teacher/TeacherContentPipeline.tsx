import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import katex from "katex";
import { ocrPdfToMarkdown, type OcrProgress } from "../lib/pdfOcr";
import { acceptQuestionVariant, batchTransformQuestions, composePipelineWorksheet, correctQuestionBoundary, createQuestionVariant, exportPipelineWorksheet, getExtractedQuestions, getParsingQuality, getPipelineWorksheets, getQuestionVariants, getSourceBlocks, getSourceDocuments, napVanBanOcr, publishPipelineWorksheet, reviewExtractedQuestion, reviewMathFragment, uploadSourceDocument, type AuthSession, type BatchTransformResult, type ExtractedQuestion, type MathFragment, type SourceDocument } from "../api";

export function TeacherContentPipeline({session}:{session:AuthSession}){
 const qc=useQueryClient(),[sourceId,setSourceId]=useState<number|null>(null),[selected,setSelected]=useState<number[]>([]),[title,setTitle]=useState("Phiếu từ tài liệu"),[file,setFile]=useState<File|null>(null),[uploadTitle,setUploadTitle]=useState(""),[batchResult,setBatchResult]=useState<BatchTransformResult|null>(null);
 const sources=useQuery({queryKey:["pipeline-sources"],queryFn:()=>getSourceDocuments(session)});
 const questions=useQuery({queryKey:["pipeline-questions",sourceId],queryFn:()=>getExtractedQuestions(session,sourceId!),enabled:!!sourceId});
 const blocks=useQuery({queryKey:["pipeline-blocks",sourceId],queryFn:()=>getSourceBlocks(session,sourceId!),enabled:!!sourceId});
 const quality=useQuery({queryKey:["pipeline-quality",sourceId],queryFn:()=>getParsingQuality(session,sourceId!),enabled:!!sourceId});
 const worksheets=useQuery({queryKey:["pipeline-worksheets"],queryFn:()=>getPipelineWorksheets(session)});
 const refresh=()=>{void qc.invalidateQueries({queryKey:["pipeline-questions",sourceId]});void qc.invalidateQueries({queryKey:["pipeline-blocks",sourceId]});void qc.invalidateQueries({queryKey:["pipeline-quality",sourceId]})};
 // Giữ lại chính file vừa tải khi máy chủ báo đây là bản scan: OCR chạy ở trình duyệt, mà file thì
 // đang nằm sẵn trong tay trình duyệt — bắt tải ngược từ R2 về chỉ để đọc lại là đi đường vòng.
 const [scanFile,setScanFile]=useState<{id:number;file:File}|null>(null);
 const upload=useMutation({mutationFn:()=>uploadSourceDocument(session,uploadTitle||file?.name||"Tài liệu",file!),onSuccess:row=>{void qc.invalidateQueries({queryKey:["pipeline-sources"]});setSourceId(row.id);setScanFile(row.status==="UNSUPPORTED_SCAN"&&file?{id:row.id,file}:null);setFile(null)}});
 const compose=useMutation({mutationFn:()=>composePipelineWorksheet(session,title,selected.map(questionId=>({questionId}))),onSuccess:()=>{setSelected([]);void qc.invalidateQueries({queryKey:["pipeline-worksheets"]})}});
 const batch=useMutation({mutationFn:()=>batchTransformQuestions(session,selected),onSuccess:r=>{setBatchResult(r);selected.forEach(id=>void qc.invalidateQueries({queryKey:["pipeline-variants",id]}))}});
 const scan=(sources.data??[]).find(d=>d.id===sourceId&&d.status==="UNSUPPORTED_SCAN")??null;
 const error=(sources.error||questions.error||blocks.error||quality.error||worksheets.error||upload.error||compose.error) as Error|null;
 return <section className="space-y-5">
  <header><h1 className="text-2xl font-bold">Tạo phiếu từ tài liệu</h1><p className="text-sm text-on-surface-variant">Upload → kiểm tra nguồn → đối chiếu → sửa ranh giới → duyệt LaTeX → tạo phiếu.</p></header>
  {error&&<div className="api-error">{error.message}</div>}
  <form onSubmit={e=>{e.preventDefault();if(file)upload.mutate()}} className="grid gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 md:grid-cols-[1fr_1fr_auto]"><input value={uploadTitle} onChange={e=>setUploadTitle(e.target.value)} placeholder="Tên tài liệu" className="h-10 rounded-lg border px-3"/><input type="file" required accept=".pdf,.docx,.tex,.txt" onChange={e=>setFile(e.target.files?.[0]??null)} className="h-10 rounded-lg border p-1.5"/><button disabled={upload.isPending} className="rounded-lg bg-primary px-4 text-on-primary">{upload.isPending?"Đang phân tích…":"Upload & phân tích"}</button></form>
  {quality.data&&<div className="grid gap-2 rounded-xl border bg-surface-container-lowest p-4 sm:grid-cols-4"><b>Chất lượng: {quality.data.label}</b><span>{quality.data.pages} trang · {quality.data.questions} câu</span><span>{quality.data.mathQuestions} câu có công thức</span><span>{quality.data.warnings} cảnh báo</span></div>}
  <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
   <aside className="rounded-xl border bg-surface-container-lowest p-3"><h2 className="mb-2 font-semibold">Tài liệu gốc</h2>{(sources.data??[]).map(d=><button key={d.id} onClick={()=>setSourceId(d.id)} className={`mb-2 w-full rounded-lg border p-3 text-left ${sourceId===d.id?"border-primary bg-primary-container/20":""}`}><b className="block">{d.title}</b><small>{d.file_type} · {d.status} · {d.question_count} câu</small>{d.status==="UNSUPPORTED_SCAN"&&<span className="mt-1 block text-sm text-error">{d.failure_reason}</span>}</button>)}
    {sourceId&&<div className="mt-4 max-h-[650px] space-y-1 overflow-auto rounded-lg bg-surface-container-low p-2">{(blocks.data??[]).map(b=><div id={`source-block-${b.id}`} key={b.id} className="rounded px-2 py-1 text-sm"><small className="mr-2 text-on-surface-variant">tr.{b.page_number} · {b.order_index}</small>{b.raw_content}</div>)}</div>}
   </aside>
   <main className="space-y-3">{scan&&<OcrScanPanel session={session} source={scan} file={scanFile?.id===scan.id?scanFile.file:null} onDone={()=>{void qc.invalidateQueries({queryKey:["pipeline-sources"]});refresh()}}/>}{(questions.data??[]).map(q=><QuestionReview key={q.id} session={session} question={q} checked={selected.includes(q.id)} onCheck={()=>setSelected(x=>x.includes(q.id)?x.filter(id=>id!==q.id):[...x,q.id])} onChanged={refresh}/>) }{sourceId&&!questions.isLoading&&!(questions.data??[]).length&&<div className="rounded-xl border p-8 text-center">Không có câu trích xuất. Nếu đây là PDF scan, hãy bấm “Nhận dạng chữ rồi bóc tách”.</div>}</main>
  </div>
  <section className="rounded-xl border bg-surface-container-lowest p-4"><h2 className="font-semibold">Thao tác hàng loạt ({selected.length} câu)</h2><div className="mt-3 flex flex-wrap gap-2"><button disabled={!selected.length||batch.isPending} onClick={()=>batch.mutate()} className="rounded-lg border border-primary px-4 text-primary">{batch.isPending?"Đang biến đổi…":"Thay số các câu hỗ trợ"}</button><input value={title} onChange={e=>setTitle(e.target.value)} className="h-10 min-w-64 flex-1 rounded-lg border px-3"/><button disabled={!selected.length||compose.isPending} onClick={()=>compose.mutate()} className="rounded-lg bg-primary px-4 text-on-primary">Tạo phiếu</button></div>{batchResult&&<div className="mt-3 rounded-lg bg-surface-container-low p-3 text-sm"><b>{batchResult.succeeded}/{batchResult.selected} câu biến đổi thành công</b>{batchResult.failures.map(f=><p key={f.questionId}>Câu #{f.questionId}: {f.reason}</p>)}</div>}</section>
  <section className="space-y-2"><h2 className="font-semibold">Phiếu và phiên bản</h2>{(worksheets.data??[]).map(w=><article key={w.id} className="flex flex-wrap items-center gap-2 rounded-xl border bg-surface-container-lowest p-3"><div className="mr-auto"><b>{w.name}</b><small className="block">v{w.version_no} · {w.version_status} · {w.item_count} câu</small></div>{w.version_status==="DRAFT"&&<button onClick={async()=>{await publishPipelineWorksheet(session,w.worksheet_version_id);void qc.invalidateQueries({queryKey:["pipeline-worksheets"]})}} className="rounded border px-3 py-1">Phát hành</button>}<button onClick={()=>void exportPipelineWorksheet(session,w.worksheet_version_id,"pdf")} className="rounded border px-3 py-1">PDF</button><button onClick={()=>void exportPipelineWorksheet(session,w.worksheet_version_id,"docx")} className="rounded border px-3 py-1">DOCX</button></article>)}</section>
 </section>;
}

/**
 * PDF scan: trình duyệt nhận dạng chữ rồi gửi phần chữ lên cho máy chủ chạy lại đúng bộ tách của
 * tài liệu có sẵn chữ. Không có dịch vụ AI ngoài nào ở đây — tesseract chạy bằng WASM tại máy người
 * dùng, nên tài liệu không rời khỏi hệ thống.
 *
 * <p>Nhận dạng vài chục trang mất vài phút và ăn CPU, nên nút phải nói rõ đang tới trang nào; im
 * lặng vài phút thì người dùng sẽ bấm lại lần nữa.
 */
function OcrScanPanel({session,source,file,onDone}:{session:AuthSession;source:SourceDocument;file:File|null;onDone:()=>void}){
 const [chon,setChon]=useState<File|null>(null),[tienDo,setTienDo]=useState<OcrProgress|null>(null),[loi,setLoi]=useState<string|null>(null),[dangChay,setDangChay]=useState(false);
 const nguon=file??chon;
 const chay=async()=>{if(!nguon)return;setDangChay(true);setLoi(null);try{const ket=await ocrPdfToMarkdown({file:nguon,bareText:true,onProgress:setTienDo});await napVanBanOcr(session,source.id,ket.markdown,ket.pages);onDone()}catch(e){setLoi(e instanceof Error?e.message:"Không nhận dạng được")}finally{setDangChay(false);setTienDo(null)}};
 return <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
  <b className="block">PDF scan — chưa có chữ để bóc tách</b>
  <p className="text-sm">Máy sẽ đọc chữ từ ảnh ngay trên trình duyệt (tối đa 40 trang), rồi tách câu như tài liệu thường. Công thức toán thường sai, nhớ đọc lại trước khi cho học sinh làm.</p>
  {!file&&<label className="mt-2 block text-sm">Chọn lại file scan để nhận dạng<input type="file" accept=".pdf" onChange={e=>setChon(e.target.files?.[0]??null)} className="mt-1 block w-full rounded-lg border bg-surface p-1.5"/></label>}
  {loi&&<p className="mt-2 text-sm text-error">{loi}</p>}
  <div className="mt-3 flex items-center gap-3">
   <button disabled={!nguon||dangChay} onClick={()=>void chay()} className="rounded-lg bg-primary px-4 py-2 text-on-primary disabled:opacity-50">{dangChay?"Đang nhận dạng…":"Nhận dạng chữ rồi bóc tách"}</button>
   {tienDo&&<span className="text-sm">{tienDo.phase==="download"?"Đang mở file…":tienDo.phase==="prepare"?"Đang tải bộ nhận dạng…":`Trang ${tienDo.page}/${tienDo.total}`}</span>}
  </div>
 </div>;
}

function QuestionReview({session,question,checked,onCheck,onChanged}:{session:AuthSession;question:ExtractedQuestion;checked:boolean;onCheck:()=>void;onChanged:()=>void}){
 const [draft,setDraft]=useState(question);useEffect(()=>setDraft(question),[question]);
 const variants=useQuery({queryKey:["pipeline-variants",question.id],queryFn:()=>getQuestionVariants(session,question.id)});
 const save=async(status:ExtractedQuestion["status"])=>{await reviewExtractedQuestion(session,question.id,{...draft,status});onChanged()};
 return <article className="rounded-xl border bg-surface-container-lowest p-4"><div className="flex gap-3"><input type="checkbox" checked={checked} disabled={question.status!=="REVIEWED"} onChange={onCheck}/><div className="min-w-0 flex-1">
  <div className="flex flex-wrap gap-2 text-xs"><span className="rounded bg-primary-container px-2 py-1">{question.question_type}</span><span>{Math.round(Number(question.confidence)*100)}%</span><span>{question.status}</span><span className="rounded bg-surface-container px-2 py-1">{question.math_signature} · {Math.round(Number(question.signature_confidence)*100)}%</span><span className="rounded bg-surface-container px-2 py-1">{question.question_intent} · {Math.round(Number(question.intent_confidence)*100)}%</span><button className="text-primary" onClick={()=>document.getElementById(`source-block-${question.start_block_id}`)?.scrollIntoView({behavior:"smooth",block:"center"})}>Xem nguồn dòng {question.source_start}–{question.source_end}</button></div>
  <div className={`mt-2 rounded-lg px-3 py-2 text-sm ${question.transformable?"bg-green-50 text-green-800":"bg-amber-50 text-amber-900"}`}>{question.transformable?"✓ Có thể thay số":"⚠ Không hỗ trợ biến đổi tự động"}{!question.transformable&&question.transform_block_reason&&<span className="block text-xs">{question.transform_block_reason}</span>}</div>
  <textarea value={draft.question_text} onChange={e=>setDraft({...draft,question_text:e.target.value})} className="mt-2 min-h-20 w-full rounded-lg border p-2"/>
  <div className="grid gap-2 sm:grid-cols-2">{(["option_a","option_b","option_c","option_d"] as const).map(k=><input key={k} value={draft[k]??""} onChange={e=>setDraft({...draft,[k]:e.target.value})} placeholder={k.toUpperCase()} className="rounded border px-2 py-1"/>)}</div>
  {(question.math_fragments??[]).map(m=><MathReview key={m.id} session={session} fragment={m} onChanged={onChanged}/>) }
  <div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>void save("REVIEWED")} className="rounded bg-primary px-3 py-1 text-on-primary">Xác nhận câu</button><button onClick={()=>void save("REJECTED")} className="rounded border px-3 py-1">Bỏ qua</button>{question.transformable&&question.status==="REVIEWED"&&<button onClick={async()=>{await createQuestionVariant(session,question.id,{type:"PARAMETER_CHANGE"});void variants.refetch()}} className="rounded border border-primary px-3 py-1 text-primary">Tạo biến thể</button>}<button onClick={async()=>{await correctQuestionBoundary(session,question.id,{action:"MERGE_PREVIOUS"});onChanged()}} className="rounded border px-3 py-1">Gộp với câu trước</button>{question.start_block_id!==question.end_block_id&&<button onClick={async()=>{await correctQuestionBoundary(session,question.id,{action:"SPLIT_AFTER",endBlockId:question.start_block_id});onChanged()}} className="rounded border px-3 py-1">Tách sau đoạn đầu</button>}</div>
  {(variants.data??[]).map(v=><div key={v.id} className="mt-2 rounded-lg border border-outline-variant p-3 text-sm"><div className="flex justify-between gap-2"><b>{v.rule_code??v.transformation_type}</b><span>{v.validation_status}</span></div><p>{v.content}</p><p className="text-on-surface-variant">Đáp án: {v.answer}</p>{v.options_json&&<div className="grid grid-cols-2 gap-1">{Object.entries(v.options_json).map(([k,value])=><span key={k}>{k}. {value}</span>)}</div>}{!v.teacher_accepted&&v.validation_status==="VALID"&&<button onClick={async()=>{await acceptQuestionVariant(session,v.id);void variants.refetch()}} className="mt-2 text-primary">Chấp nhận biến thể</button>}</div>)}
 </div></div></article>;
}

function MathReview({session,fragment,onChanged}:{session:AuthSession;fragment:MathFragment;onChanged:()=>void}){
 const [latex,setLatex]=useState(fragment.latex_value);useEffect(()=>setLatex(fragment.latex_value),[fragment.latex_value]);
 const save=async(decision:"ACCEPTED"|"EDITED"|"KEEP_TEXT")=>{await reviewMathFragment(session,fragment.id,decision==="KEEP_TEXT"?fragment.raw_value:latex,decision);onChanged()};
 return <div className="mt-2 rounded-lg bg-surface-container-low p-3"><div className="grid gap-2 md:grid-cols-3"><code>{fragment.raw_value}</code><input value={latex} onChange={e=>setLatex(e.target.value)} className="rounded border px-2"/><span dangerouslySetInnerHTML={{__html:katex.renderToString(latex,{throwOnError:false})}}/></div><div className="mt-2 flex gap-3 text-xs"><span>Độ tin cậy: {Math.round(fragment.confidence*100)}%</span><button className="text-primary" onClick={()=>void save("ACCEPTED")}>Chấp nhận</button><button className="text-primary" onClick={()=>void save("EDITED")}>Lưu LaTeX sửa</button><button onClick={()=>void save("KEEP_TEXT")}>Giữ text</button></div></div>;
}
