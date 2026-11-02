import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import katex from "katex";
import { getWorksheets, getAssignments, saveAssignment, getWorksheetImpact, patchWorksheetItem, publishWorksheet, cloneWorksheet, regradeAssignment, parseWorksheetFile, publishWorksheetImport, getTopics, getProblemTypes, type AuthSession, type Classroom, type Worksheet, type Assignment, type WorksheetImpactRow, type WorksheetImportPreview, type WorksheetImportQuestion } from "../api";
import { messageOf } from "../lib/errors";
import { EmptyState } from "../components/common";
import { WorksheetPreview } from "./WorksheetPreview";

export function TeacherWorksheetView({session,classes}:{session:AuthSession;classes:Classroom[]}) {
 const queryClient=useQueryClient();
 const [search,setSearch]=useState(""),[qrFilter,setQrFilter]=useState(""),[preview,setPreview]=useState<Worksheet|null>(null),[assigning,setAssigning]=useState<Worksheet|null>(null),[selected,setSelected]=useState<Worksheet|null>(null),[importOpen,setImportOpen]=useState(false);
 const [form,setForm]=useState({classId:classes[0]?.id??0,title:"",dueAt:""});
 const [editItem,setEditItem]=useState<{id:number;content:string;answer:string}|null>(null),[canChamLai,setCanChamLai]=useState(0),[daChamLai,setDaChamLai]=useState<number[]>([]);
 const classIdsKey=classes.map(item=>item.id).join(",");
 const worksheetsQuery=useQuery({queryKey:["teacher-worksheets",session.accessToken,classIdsKey],queryFn:async()=>{const [sheets,...classAssignments]=await Promise.all([getWorksheets(session),...classes.map(async classroom=>(await getAssignments(session,classroom.id)).map(item=>({...item,className:classroom.name})))]);return {rows:sheets as Worksheet[],assignments:(classAssignments as (Assignment&{className:string})[][]).flat()}}});
 const rows=worksheetsQuery.data?.rows??[],assignments=worksheetsQuery.data?.assignments??[],loading=worksheetsQuery.isLoading;
 const assignMutation=useMutation({mutationFn:(input:Parameters<typeof saveAssignment>[1])=>saveAssignment(session,input),onSuccess:()=>queryClient.invalidateQueries({queryKey:["teacher-worksheets"]})});
 /** Phiếu đã giao thì đóng băng: hỏi trước ai đang dùng nó, chứ không để giáo viên biết lúc bấm sửa và nhận một câu từ chối. */
 const impactQuery=useQuery({queryKey:["worksheet-impact",session.accessToken,selected?.id??0],queryFn:()=>getWorksheetImpact(session,selected!.id),enabled:Boolean(selected)});
 const impact:WorksheetImpactRow[]=impactQuery.data??[],daNop=impact.reduce((tong,row)=>tong+row.so_da_nop,0);
 const publishMutation=useMutation({mutationFn:(id:number)=>publishWorksheet(session,id),onSuccess:()=>queryClient.invalidateQueries({queryKey:["teacher-worksheets"]})});
 const cloneMutation=useMutation({mutationFn:(id:number)=>cloneWorksheet(session,id),onSuccess:async ban=>{await queryClient.invalidateQueries({queryKey:["teacher-worksheets"]});setSelected(ban)}});
 /**
  * Ngoại lệ hẹp cho lỗi chính tả hay đáp án sai: chỉ đổi đề và đáp án của <b>một</b> câu, không
  * thêm bớt hay đổi thứ tự. Đổi đáp án thì bài đã nộp vẫn mang điểm chấm theo đáp án cũ — nên
  * phải nói ngay có bao nhiêu bài cần chấm lại và đưa luôn nút chấm, chứ không để con số sai nằm
  * im trong sổ điểm.
  */
 const patchMutation=useMutation({mutationFn:()=>patchWorksheetItem(session,editItem!.id,{contentSnapshot:editItem!.content,answerSnapshot:editItem!.answer}),
  onSuccess:async data=>{setCanChamLai(data.soBaiCanChamLai);setDaChamLai([]);setEditItem(null);await queryClient.invalidateQueries({queryKey:["teacher-worksheets"]});await queryClient.invalidateQueries({queryKey:["worksheet-impact"]})}});
 const regradeMutation=useMutation({mutationFn:(assignmentId:number)=>regradeAssignment(session,assignmentId),onSuccess:(_data,assignmentId)=>setDaChamLai(cu=>[...cu,assignmentId])});
 const canCham=impact.filter(row=>row.so_da_nop>0&&!daChamLai.includes(row.assignment_id));
 const error=[worksheetsQuery,impactQuery,assignMutation,publishMutation,cloneMutation,patchMutation,regradeMutation].map(q=>q.isError?messageOf(q.error):"").find(Boolean)??"";
 useEffect(()=>{if(!classes.some(item=>item.id===form.classId))setForm(value=>({...value,classId:classes[0]?.id??0}))},[classes,form.classId]);
 // Phiếu đang xem là ảnh chụp cục bộ; sửa một câu xong mà không lấy lại thì khung bên phải vẫn in đề cũ.
 useEffect(()=>{if(!selected)return;const moi=rows.find(item=>item.id===selected.id);if(moi!==selected)setSelected(moi??null)},[rows,selected]);
 const filtered=rows.filter(item=>(!search||item.name.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")))&&(!qrFilter||(qrFilter==="QR"?item.showQr:!item.showQr)));
 const assignedClasses=(worksheetId:number)=>Array.from(new Set(assignments.filter(item=>item.worksheetId===worksheetId).map(item=>item.className)));
 const assign=async(e:React.FormEvent)=>{e.preventDefault();if(!assigning)return;try{await assignMutation.mutateAsync({classId:form.classId,lessonId:null,worksheetId:assigning.id,title:form.title||assigning.name,dueAt:form.dueAt||null,status:"PUBLISHED"});setAssigning(null)}catch{/* lỗi đã có trong mutation state */}};
 const goCreate=()=>window.dispatchEvent(new CustomEvent("math10:navigate",{detail:"problem-create"}));
 const difficultyLabel=(value:string)=>value==="EASY"?"Dễ":value==="HARD"?"Khó":"TB";
 const difficultyTone=(value:string)=>value==="EASY"?"bg-secondary-container/30 text-on-secondary-container":value==="HARD"?"bg-error-container/30 text-on-error-container":"bg-tertiary-container/30 text-on-tertiary-container";
 return (
  <section className="flex flex-col gap-4">
   <header className="flex items-center justify-between gap-4 flex-wrap">
    <div>
     <h1 className="text-2xl font-bold text-on-surface">Quản lý Phiếu & Đề</h1>
     <p className="text-sm text-on-surface-variant">Tạo, xem trước, in và giao phiếu bài tập cho lớp.</p>
    </div>
    <div className="flex gap-2"><button onClick={()=>setImportOpen(true)} className="h-9 px-4 rounded-lg border border-primary text-primary text-sm font-semibold flex items-center gap-1.5 hover:bg-primary-container/20"><span className="material-symbols-outlined text-[18px]">upload_file</span> Bóc đề DOCX/PDF</button><button onClick={goCreate} className="h-9 px-4 rounded-lg bg-primary text-on-primary text-sm font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity">
     <span className="material-symbols-outlined text-[18px]">add</span> Chọn câu hỏi để tạo phiếu
    </button></div>
   </header>

   <div className="flex items-center gap-2 flex-wrap">
    <input placeholder="Tìm tên phiếu…" value={search} onChange={e=>setSearch(e.target.value)} className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface flex-1 min-w-[200px]"/>
    <select value={qrFilter} onChange={e=>setQrFilter(e.target.value)} className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface">
     <option value="">Tất cả loại</option>
     <option value="QR">Phiếu in có QR</option>
     <option value="NO_QR">Phiếu không QR</option>
    </select>
    <span className="text-xs text-on-surface-variant">{filtered.length} phiếu</span>
   </div>

   {error && <div className="api-error">{error}</div>}

   <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4 items-start">
    {loading ? <p className="text-sm text-on-surface-variant">Đang tải phiếu…</p> : (
     <div className="border border-outline-variant rounded-lg overflow-hidden">
      <div className="flex flex-col divide-y divide-outline-variant">
       {filtered.map(item=>{
        const assigned=assignedClasses(item.id);
        const isSelected=selected?.id===item.id;
        return (
         <div key={item.id} className={`flex items-center gap-3 p-3 transition-colors ${isSelected?"bg-primary-container/15":"bg-surface-container-lowest hover:bg-surface-container-low"}`}>
          <button onClick={()=>setSelected(item)} className="flex-1 min-w-0 text-left flex items-center gap-3">
           <span className="material-symbols-outlined text-primary text-[22px] shrink-0">description</span>
           <span className="min-w-0">
            <span className="flex items-center gap-2 min-w-0"><span className="text-sm font-medium text-on-surface truncate">{item.name}</span>{item.status!=="PUBLISHED"&&<span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface-variant text-on-surface-variant">Bản nháp</span>}</span>
            <span className="block text-[11px] text-on-surface-variant truncate">Phiếu #{item.id} · {item.showQr?"Có QR":"Không QR"} · {item.columnsCount} cột · {item.items.length} câu · {assigned.length?assigned.join(", "):"Chưa giao"}</span>
           </span>
          </button>
          <div className="flex items-center gap-1 shrink-0">
           <button onClick={()=>setPreview(item)} className="px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary-container/20 rounded transition-colors">Xem / In</button>
           {/* Bản nháp không giao được — giao rồi mới sửa thì học sinh mở ra thấy đề khác đề đã nộp. */}
           {item.status!=="PUBLISHED"
            ? <button disabled={publishMutation.isPending} onClick={()=>publishMutation.mutate(item.id)} className="px-2.5 py-1.5 text-xs font-semibold rounded border border-primary text-primary hover:bg-primary-container/20 transition-colors disabled:opacity-40">Phát hành</button>
            : <button disabled={!classes.length} onClick={()=>{setAssigning(item);setForm(value=>({...value,title:item.name}))}} className="px-2.5 py-1.5 text-xs font-semibold rounded bg-primary text-on-primary hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">Giao bài</button>}
          </div>
         </div>
        );
       })}
      </div>
      {!filtered.length && <EmptyState text="Không có phiếu phù hợp bộ lọc."/>}
     </div>
    )}

    <aside className="border border-outline-variant rounded-lg bg-surface-container-lowest p-4 flex flex-col gap-4 lg:sticky lg:top-[72px]">
     {selected ? <>
      <div className="flex items-start justify-between gap-2">
       <div className="min-w-0">
        <p className="text-xs font-semibold text-primary tracking-wide">CHI TIẾT PHIẾU</p>
        <h2 className="text-base font-bold text-on-surface truncate">{selected.name}</h2>
       </div>
       <button onClick={()=>setSelected(null)} className="shrink-0 w-7 h-7 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors">
        <span className="material-symbols-outlined text-[18px]">close</span>
       </button>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs">
       <div><dt className="text-on-surface-variant">Bố cục</dt><dd className="text-sm font-semibold text-on-surface">{selected.columnsCount} cột</dd></div>
       <div><dt className="text-on-surface-variant">Số câu</dt><dd className="text-sm font-semibold text-on-surface data-tabular">{selected.items.length}</dd></div>
       <div><dt className="text-on-surface-variant">QR nộp bài</dt><dd className="text-sm font-semibold text-on-surface">{selected.showQr?"Có":"Không"}</dd></div>
       <div><dt className="text-on-surface-variant">Ô thông tin học sinh</dt><dd className="text-sm font-semibold text-on-surface">{selected.showStudentFields?"Có":"Không"}</dd></div>
      </dl>
      <p className="text-xs text-on-surface-variant">Đã giao: {assignedClasses(selected.id).length?assignedClasses(selected.id).join(", "):"Chưa giao lớp nào"}</p>

      <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant">
       <p className="text-xs text-on-surface-variant">
        {impact.length
         ?`Đang dùng ở ${impact.length} bài giao${daNop?` · ${daNop} bài đã nộp`:""}. Sửa nội dung phiếu sẽ đổi đề của cả những bài ấy — muốn khác thì nhân bản.`
         :"Chưa bài giao nào dùng phiếu này."}
       </p>
       <div className="flex items-center gap-2 flex-wrap">
        <button onClick={()=>cloneMutation.mutate(selected.id)} disabled={cloneMutation.isPending} className="h-8 px-3 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-50">{cloneMutation.isPending?"Đang nhân bản…":"Nhân bản để sửa"}</button>
        {selected.status!=="PUBLISHED"&&<button onClick={()=>publishMutation.mutate(selected.id)} disabled={publishMutation.isPending} className="h-8 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">Phát hành phiếu</button>}
       </div>
       {canChamLai>0&&canCham.length>0&&(
        <div className="rounded-lg border border-error/40 bg-error-container/20 p-2 flex flex-col gap-1">
         <p className="text-xs font-semibold text-error">{canChamLai} bài đã nộp cần chấm lại</p>
         {canCham.map(row=>(
          <button key={row.assignment_id} onClick={()=>regradeMutation.mutate(row.assignment_id)} disabled={regradeMutation.isPending}
           className="text-left text-[11px] font-semibold text-primary hover:underline disabled:opacity-50">
           Chấm lại «{row.title}» — {row.class_name??`lớp #${row.class_id}`} ({row.so_da_nop} bài)
          </button>
         ))}
        </div>
       )}
       {daChamLai.length>0&&regradeMutation.data&&<p className="text-[11px] text-on-surface-variant">Đã chấm lại {regradeMutation.data.updated} bài, bỏ qua {regradeMutation.data.skipped} bài chưa nộp.</p>}
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant max-h-[420px] overflow-auto thin-scrollbar">
       <p className="text-xs font-semibold text-on-surface-variant tracking-wide">DANH SÁCH CÂU HỎI ({selected.items.length} câu)</p>
       {selected.items.map((item,index)=>{
        const dangSua=editItem?.id===item.id;
        return (
        <div key={item.id} className="p-2.5 rounded border border-outline-variant bg-surface-container-lowest">
         <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-on-surface">Câu {index+1}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${difficultyTone(item.difficulty)}`}>{difficultyLabel(item.difficulty)}</span>
          <span className="text-[10px] text-on-surface-variant">{item.publicCode}</span>
          {/* Chỉ câu do xưởng nội dung dựng nên mới có snapshot để sửa hẹp; câu lấy thẳng từ ngân
              hàng bài thì đường duy nhất là sửa ở ngân hàng hoặc nhân bản phiếu. */}
          {item.contentSnapshot!=null
           ? <button onClick={()=>setEditItem(dangSua?null:{id:item.id,content:item.contentSnapshot??"",answer:item.answerSnapshot??""})} className="ml-auto text-[10px] font-semibold text-primary hover:underline">{dangSua?"Hủy":"Sửa câu"}</button>
           : <span className="ml-auto text-[10px] text-on-surface-variant">từ ngân hàng bài</span>}
         </div>
         {dangSua&&editItem?(
          <div className="flex flex-col gap-1.5">
           <textarea value={editItem.content} onChange={e=>setEditItem({...editItem,content:e.target.value})} className="w-full min-h-16 p-2 rounded border border-outline-variant bg-surface-container-lowest text-xs text-on-surface"/>
           <input value={editItem.answer} onChange={e=>setEditItem({...editItem,answer:e.target.value})} placeholder="Đáp án" className="h-8 px-2 rounded border border-outline-variant bg-surface-container-lowest text-xs text-on-surface"/>
           <div className="flex items-center gap-2 flex-wrap">
            <button onClick={()=>patchMutation.mutate()} disabled={patchMutation.isPending} className="h-8 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">{patchMutation.isPending?"Đang lưu…":"Lưu câu này"}</button>
            <span className="text-[10px] text-on-surface-variant">Chỉ sửa đề và đáp án của câu này; thêm, bớt hay đổi thứ tự thì nhân bản phiếu.</span>
           </div>
          </div>
         ):(<>
          <div className="text-xs text-on-surface [&_.katex]:text-xs" dangerouslySetInnerHTML={{__html:katex.renderToString(item.statementLatex.replace(/^\$|\$$/g,""),{throwOnError:false,displayMode:false})}}/>
          {item.answerSnapshot&&<p className="mt-1 text-[10px] text-on-surface-variant">Đáp án: {item.answerSnapshot}</p>}
         </>)}
        </div>
       )})}
       {!selected.items.length && <p className="text-xs text-on-surface-variant text-center py-4">Phiếu chưa có câu hỏi.</p>}
      </div>
     </> : (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
       <span className="material-symbols-outlined text-on-surface-variant text-[28px]">description</span>
       <p className="text-sm text-on-surface-variant">Chọn một phiếu bên trái để xem danh sách câu hỏi.</p>
      </div>
     )}
    </aside>
   </div>

   {preview && <WorksheetPreview sheet={preview} onClose={()=>setPreview(null)}/>}
   {importOpen&&<ImportDocxDialog session={session} onClose={()=>setImportOpen(false)} onPublished={async()=>{setImportOpen(false);await queryClient.invalidateQueries({queryKey:["teacher-worksheets"]})}}/>}
   {assigning && (
    <div className="dialog-backdrop">
     <section className="dialog-card">
      <div className="panel-head"><div><p className="eyebrow">GIAO PHIẾU</p><h2>{assigning.name}</h2></div><button onClick={()=>setAssigning(null)}>Đóng</button></div>
      <form className="live-form" onSubmit={assign}>
       <label>Lớp học<select required value={form.classId} onChange={e=>setForm({...form,classId:Number(e.target.value)})}>{classes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
       <label>Tên nhiệm vụ<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
       <label>Hạn nộp<input type="datetime-local" value={form.dueAt} onChange={e=>setForm({...form,dueAt:e.target.value})}/></label>
       <button className="primary">Giao phiếu</button>
      </form>
     </section>
    </div>
   )}
  </section>
 );
}

function ImportDocxDialog({session,onClose,onPublished}:{session:AuthSession;onClose:()=>void;onPublished:()=>Promise<void>}){
 const [draft,setDraft]=useState<WorksheetImportPreview|null>(null),[name,setName]=useState(""),[topicId,setTopicId]=useState(0),[typeId,setTypeId]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const topics=useQuery({queryKey:["worksheet-import-topics",session.accessToken],queryFn:()=>getTopics(session)});
 const types=useQuery({queryKey:["worksheet-import-types",session.accessToken,topicId],queryFn:()=>getProblemTypes(session,topicId),enabled:topicId>0});
 useEffect(()=>{if(!topicId&&topics.data?.[0])setTopicId(topics.data[0].id)},[topicId,topics.data]);
 useEffect(()=>{setTypeId(types.data?.[0]?.id??0)},[types.data]);
 const update=(index:number,patch:Partial<WorksheetImportQuestion>)=>setDraft(current=>current?{...current,questions:current.questions.map((q,i)=>i===index?{...q,...patch}:q)}:current);
 const blockers=draft?.questions.filter(q=>!q.statement.trim()||![q.optionA,q.optionB,q.optionC,q.optionD].every(x=>x.trim())||!q.correctOption).length??0;
 const parse=async(file:File)=>{setBusy(true);setError("");try{const next=await parseWorksheetFile(session,file);setDraft(next);setName(file.name.replace(/\.(docx|pdf)$/i,""))}catch(e){setError(messageOf(e))}finally{setBusy(false)}};
 const publish=async()=>{if(!draft||blockers||!typeId)return;setBusy(true);setError("");try{await publishWorksheetImport(session,{name,problemTypeId:typeId,questions:draft.questions.map(q=>({statement:q.statement,optionA:q.optionA,optionB:q.optionB,optionC:q.optionC,optionD:q.optionD,correctOption:q.correctOption!}))});await onPublished()}catch(e){setError(messageOf(e))}finally{setBusy(false)}};
 return <div className="dialog-backdrop"><section className="w-[960px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] overflow-hidden rounded-xl bg-surface-container-lowest flex flex-col shadow-xl"><div className="panel-head"><div><p className="eyebrow">BÓC ĐỀ → DUYỆT → PHÁT HÀNH</p><h2>Nhập đề từ DOCX hoặc PDF</h2></div><button onClick={onClose}>Đóng</button></div>{error&&<div className="api-error mx-5 mt-4">{error}</div>}{!draft?<div className="m-6 p-12 border border-dashed border-outline-variant rounded-xl text-center"><span className="material-symbols-outlined text-[36px] text-primary">upload_file</span><h3 className="font-bold mt-2">Chọn file đề thi .docx hoặc .pdf</h3><p className="text-sm text-on-surface-variant mt-1">PDF cần có lớp văn bản; file scan sẽ cần OCR trước khi nhập.</p><label className="inline-flex mt-5 px-4 h-10 items-center rounded-lg bg-primary text-on-primary font-semibold cursor-pointer"><input className="hidden" type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e=>{const file=e.target.files?.[0];if(file)void parse(file)}}/>{busy?"Đang bóc đề…":"Chọn file đề"}</label></div>:<><div className="px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-3 border-b border-outline-variant"><label className="text-xs text-on-surface-variant">Tên phiếu<input className="block w-full h-9 mt-1 px-3 border border-outline-variant rounded-lg text-sm text-on-surface" value={name} onChange={e=>setName(e.target.value)}/></label><label className="text-xs text-on-surface-variant">Chủ đề<select className="block w-full h-9 mt-1 px-2 border border-outline-variant rounded-lg text-sm" value={topicId} onChange={e=>setTopicId(Number(e.target.value))}>{topics.data?.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label className="text-xs text-on-surface-variant">Dạng toán<select className="block w-full h-9 mt-1 px-2 border border-outline-variant rounded-lg text-sm" value={typeId} onChange={e=>setTypeId(Number(e.target.value))}>{types.data?.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div><div className="px-5 py-3 flex gap-4 text-sm border-b border-outline-variant"><b>{draft.totalQuestions} câu</b><span className={blockers?"text-error":"text-primary"}>{blockers} câu cần sửa</span><span className="text-on-surface-variant">{draft.warningCount} cảnh báo</span></div><div className="p-5 overflow-auto flex flex-col gap-3">{draft.questions.map((q,index)=><article key={`${q.questionNo}-${index}`} className={`p-4 rounded-lg border ${(!q.correctOption||[q.optionA,q.optionB,q.optionC,q.optionD].some(x=>!x.trim()))?"border-error":"border-outline-variant"}`}><div className="flex justify-between gap-3 mb-3"><b>Câu {q.questionNo}</b><span className="text-xs text-on-surface-variant">Tin cậy {Math.round(q.confidence*100)}% · {q.answerSource}</span></div><textarea className="w-full min-h-16 p-2 border border-outline-variant rounded text-sm" value={q.statement} onChange={e=>update(index,{statement:e.target.value})}/><div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">{(["A","B","C","D"] as const).map(letter=>{const key=`option${letter}` as "optionA"|"optionB"|"optionC"|"optionD";return <label key={letter} className={`flex items-center gap-2 p-2 rounded border ${q.correctOption===letter?"border-primary bg-primary-container/10":"border-outline-variant"}`}><input type="radio" name={`answer-${index}`} checked={q.correctOption===letter} onChange={()=>update(index,{correctOption:letter})}/><b>{letter}</b><input className="flex-1 min-w-0 bg-transparent outline-none text-sm" value={q[key]} onChange={e=>update(index,{[key]:e.target.value})}/></label>})}</div>{q.issues.length>0&&<div className="mt-2 text-xs text-error">{q.issues.map(x=>x.message).join(" · ")}</div>}</article>)}</div><footer className="p-4 border-t border-outline-variant flex justify-between items-center"><button className="secondary" onClick={()=>setDraft(null)}>Chọn file khác</button><button className="primary" disabled={busy||blockers>0||!name.trim()||!typeId} onClick={()=>void publish()}>{busy?"Đang phát hành…":blockers?`Còn ${blockers} câu cần sửa`:"Phát hành phiếu đề"}</button></footer></>}</section></div>
}
