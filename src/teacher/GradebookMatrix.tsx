import { useMemo } from "react";
import { type Classroom, type GradebookRow } from "../api";
import { EmptyState } from "../components/common";

/** Khoá ô trong ma trận. Tra ô bằng Map thay vì quét lại mảng cho từng ô — xem ghi chú dưới. */
const cellKey=(studentId:number,assignmentId:number)=>`${studentId}:${assignmentId}`;

const ICON:Record<string,string>={COMPLETED:"✓",IN_PROGRESS:"●",NOT_OPENED:"○"};
const LABEL:Record<string,string>={COMPLETED:"Đã xong",IN_PROGRESS:"Đang làm",NOT_OPENED:"Chưa mở"};
const TONE:Record<string,string>={COMPLETED:"text-secondary",IN_PROGRESS:"text-primary",NOT_OPENED:"text-on-surface-variant/40"};

/** Điểm hiển thị một chữ số thập phân, bỏ đuôi .0 cho gọn cột. */
function diem(value:number){return Number.isInteger(value)?String(value):value.toFixed(1)}

/**
 * Ô sổ điểm. Điểm chỉ hiện khi bài đã chấm xong; bài mới nộp thì hiện dấu chờ chấm chứ không
 * hiện số, vì `score` lúc đó còn trống và một ô trắng trông hệt như "chưa làm bài".
 */
function moTaO(row:GradebookRow|undefined){
 if(!row)return {text:ICON.NOT_OPENED,tone:TONE.NOT_OPENED,title:LABEL.NOT_OPENED};
 const tienDo=`${LABEL[row.status]??row.status} · ${row.completion_percent}%`;
 if(row.score!=null)return {text:diem(Number(row.score)),tone:Number(row.score)>=5?"text-secondary font-semibold":"text-error font-semibold",
  title:`${tienDo} · ${row.grading_status==="RETURNED"?"đã trả bài":"đã chấm"}`};
 if(row.grading_status==="SUBMITTED")return {text:"✎",tone:"text-primary",
  title:row.graded_items>0?`${tienDo} · chấm dở, xong ${row.graded_items} câu`:`${tienDo} · đã nộp, chờ chấm`};
 return {text:ICON[row.status]??ICON.NOT_OPENED,tone:TONE[row.status]??TONE.NOT_OPENED,title:tienDo};
}

export function GradebookMatrix({classes,rows,selectedStudent,onSelectStudent,onSelectClass}:{classes:Classroom[];rows:GradebookRow[];selectedStudent:number|null;onSelectStudent:(id:number|null)=>void;onSelectClass:(id:number)=>Promise<void>}){
 /**
  * Dựng sẵn danh sách học sinh, danh sách bài và bảng tra ô trong **một** lượt duyệt.
  *
  * Bản trước tra từng ô bằng `rows.find(...)` đặt trong hai vòng lặp lồng nhau, tức là
  * học_sinh × bài × dòng phép so sánh. Lớp 45 em với 40 bài là 1800 ô nhân 1800 dòng —
  * hơn ba triệu phép so sánh cho mỗi lần vẽ lại, và vẽ lại xảy ra mỗi lần gõ một chữ vào ô
  * tìm kiếm ở màn hình cha. Map tra thẳng thì còn đúng 1800 lượt.
  */
 const {students,assignments,byCell,average}=useMemo(()=>{
  const students=new Map<number,{id:number;name:string;username:string}>();
  const assignments=new Map<number,{id:number;title:string;closed:boolean}>();
  const byCell=new Map<string,GradebookRow>();
  const diemDaCham=new Map<number,number[]>();
  for(const row of rows){
   if(!students.has(row.student_id))students.set(row.student_id,{id:row.student_id,name:row.full_name,username:row.username});
   if(!assignments.has(row.assignment_id))assignments.set(row.assignment_id,{id:row.assignment_id,title:row.title,closed:row.assignment_status!=="PUBLISHED"});
   byCell.set(cellKey(row.student_id,row.assignment_id),row);
   if(row.score!=null){const list=diemDaCham.get(row.student_id)??[];list.push(Number(row.score));diemDaCham.set(row.student_id,list)}
  }
  const average=new Map<number,number|null>();
  for(const [id,list] of diemDaCham)average.set(id,list.length?list.reduce((sum,x)=>sum+x,0)/list.length:null);
  return {students:[...students.values()],assignments:[...assignments.values()],byCell,average};
 },[rows]);

 const chiTiet=useMemo(()=>selectedStudent?rows.filter(row=>row.student_id===selectedStudent):[],[rows,selectedStudent]);

 return (
  <section className="flex flex-col gap-4">
   <div className="flex items-center justify-between gap-3 flex-wrap">
    <div>
     <p className="text-xs font-semibold text-primary tracking-wide">SỔ ĐIỂM TIẾN ĐỘ</p>
     <h3 className="text-base font-bold text-on-surface">Học sinh × Bài tập</h3>
    </div>
    {classes.length>1 && (
     <div className="flex items-center gap-1.5 flex-wrap">
      {classes.map(item=><button key={item.id} onClick={()=>void onSelectClass(item.id)} className="h-8 px-3 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors">{item.name}</button>)}
     </div>
    )}
   </div>
   {rows.length ? (<>
    {/*
      Bốn tầng dính, thứ tự bắt buộc: góc trên trái (30) > tiêu đề cột (20) > cột tên (10) > ô.
      Bản trước để tiêu đề cột và cột tên cùng z-10; trong DOM tbody đứng sau thead nên khi cuộn
      xuống, cột tên đè lên chính hàng tiêu đề đang dính.
    */}
    <div className="border border-outline-variant rounded-lg overflow-auto max-h-[560px] thin-scrollbar">
     <table className="w-full text-sm border-collapse">
      <thead>
       <tr>
        <th className="sticky top-0 left-0 z-30 bg-surface-container-low text-left px-3 py-2 font-semibold text-on-surface-variant text-xs border-b border-r border-outline-variant min-w-[180px]">Học sinh</th>
        {assignments.map(item=><th key={item.id} title={item.title} className="sticky top-0 z-20 bg-surface-container-low px-3 py-2 font-semibold text-on-surface-variant text-xs border-b border-outline-variant min-w-[120px] max-w-[160px] truncate">{item.title}{item.closed && <span className="ml-1 font-normal text-on-surface-variant/60" title="Đã đóng">·</span>}</th>)}
        <th className="sticky top-0 z-20 bg-surface-container-low px-3 py-2 font-semibold text-on-surface-variant text-xs border-b border-l border-outline-variant min-w-[72px]">TB</th>
       </tr>
      </thead>
      <tbody>
       {students.map(student=>{
        const initials=(student.name||"?").trim().split(/\s+/).filter(Boolean).slice(-2).map(part=>part[0]).join("").toUpperCase();
        const tb=average.get(student.id);
        return (
         <tr key={student.id} className="hover:bg-surface-container-low/60">
          <th className="sticky left-0 z-10 bg-surface-container-lowest text-left px-3 py-2 border-b border-r border-outline-variant font-normal">
           <button onClick={()=>onSelectStudent(student.id)} className="flex items-center gap-2 text-left w-full">
            <span className="w-6 h-6 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-[10px] font-bold shrink-0">{initials||"?"}</span>
            <span className="min-w-0"><span className="block text-sm font-medium text-on-surface truncate">{student.name}</span><span className="block text-[11px] text-on-surface-variant truncate">@{student.username}</span></span>
           </button>
          </th>
          {assignments.map(assignment=>{
           const o=moTaO(byCell.get(cellKey(student.id,assignment.id)));
           return <td key={assignment.id} className="px-3 py-2 border-b border-outline-variant text-center"><span className={`text-base ${o.tone}`} title={o.title}>{o.text}</span></td>;
          })}
          <td className="px-3 py-2 border-b border-l border-outline-variant text-center data-tabular">
           {tb==null?<span className="text-on-surface-variant/40">–</span>:<span className={tb>=5?"font-semibold text-on-surface":"font-semibold text-error"}>{tb.toFixed(1)}</span>}
          </td>
         </tr>
        );
       })}
      </tbody>
     </table>
    </div>
    <p className="text-[11px] text-on-surface-variant">✓ đã xong · ● đang làm · ○ chưa mở · ✎ đã nộp, chờ chấm · số là điểm đã chấm. Cột TB tính trên các bài đã có điểm.</p>
   </>) : <EmptyState text="Lớp này chưa có nhiệm vụ nào nên chưa có dữ liệu sổ điểm."/>}
   {selectedStudent && (
    <div className="border border-outline-variant rounded-lg p-4 bg-surface-container-lowest">
     <div className="flex items-center justify-between mb-3">
      <h4 className="text-sm font-bold text-on-surface">Chi tiết · {chiTiet[0]?.full_name}</h4>
      <button onClick={()=>onSelectStudent(null)} className="text-xs text-on-surface-variant hover:text-on-surface">Đóng</button>
     </div>
     <div className="flex flex-col gap-2">
      {chiTiet.map(x=>{
       const o=moTaO(x);
       return (
        <div key={x.assignment_id} className="flex items-center justify-between gap-3 text-sm">
         <b className="text-on-surface min-w-0 truncate">{x.title}</b>
         <span className="text-on-surface-variant shrink-0">{o.title}</span>
        </div>
       );
      })}
     </div>
    </div>
   )}
  </section>
 );
}
