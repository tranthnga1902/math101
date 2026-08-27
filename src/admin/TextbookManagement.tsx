import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import {attachLessonDocument,deleteDocument,getAdminTextbooks,getChapters,getCourses,getLessons,getTextbook,openTextbook,openTextbookInBrowser,publishTextbook,setTextbookPageOffset,uploadTextbook,type AuthSession,type Chapter,type Course,type Lesson,type TextbookDetail,type TextbookItem} from "../api";
import {useMappingAutoSave} from "../hooks/useMappingAutoSave";
import {PdfThumbnail} from "../PdfThumbnail";
import {PdfPageViewer} from "../PdfPageViewer";
import "./textbook-management.css";
import "./textbook-pdf.css";

type BookRow={book:TextbookItem;detail:TextbookDetail|null};
const message=(reason:unknown)=>reason instanceof Error?reason.message:"Không thể thực hiện thao tác";
const TEXTBOOKS_QUERY_KEY="admin-textbooks";

export function TextbookManagement({session}:{session:AuthSession}){
 const queryClient=useQueryClient();
 const [active,setActive]=useState<BookRow|null>(null),[uploadOpen,setUploadOpen]=useState(false);
 const booksQuery=useQuery({queryKey:[TEXTBOOKS_QUERY_KEY,session.accessToken],queryFn:async()=>{const books=await getAdminTextbooks(session);const details=await Promise.all(books.map(book=>getTextbook(session,book.id).catch(()=>null)));return books.map((book,index)=>({book,detail:details[index]}))}});
 const rows=booksQuery.data??[];
 const invalidate=()=>queryClient.invalidateQueries({queryKey:[TEXTBOOKS_QUERY_KEY]});
 const publishMutation=useMutation({mutationFn:(id:number)=>publishTextbook(session,id),onSuccess:invalidate});
 const deleteMutation=useMutation({mutationFn:(id:number)=>deleteDocument(session,id),onSuccess:invalidate});
 const error=booksQuery.isError?message(booksQuery.error):publishMutation.isError?message(publishMutation.error):deleteMutation.isError?message(deleteMutation.error):"";
 if(active)return <TextbookMapping session={session} row={active} onBack={()=>{setActive(null);void invalidate()}}/>;
 return <section className="sgk-page"><header><div><h1>Quản lý Sách Giáo Khoa</h1><p>Danh sách SGK môn Toán lớp 10 chương trình GDPT 2018.</p></div><button className="sgk-primary" onClick={()=>setUploadOpen(true)}>Tải lên SGK</button></header>{error&&<div className="api-error">{error}</div>}<div className="sgk-table"><table><thead><tr><th>Ảnh bìa</th><th>Tên SGK</th><th>Tập</th><th>Số trang PDF</th><th>Trạng thái khớp trang</th><th>Trạng thái xuất bản</th><th>Thao tác</th></tr></thead><tbody>{rows.map(({book,detail})=>{const mapped=detail?.pageMappings.length??0,total=book.totalPages??0,percent=total?Math.min(100,Math.round(mapped/total*100)):0,isMatched=mapped>0||book.basePageOffset>1;return <tr key={book.id} className="sgk-row-clickable" onClick={()=>setActive({book,detail})} title={isMatched?"Bấm để chỉnh sửa khớp trang":"Bấm để khớp trang"}><td><div className="sgk-cover">{book.thumbnailUrl?<img src={book.thumbnailUrl} alt=""/>:<span>PDF</span>}</div></td><td><b>{book.title}</b><small>{book.docType}</small></td><td>{/tập\s*2/i.test(book.title)?"Tập 2":/tập\s*1/i.test(book.title)?"Tập 1":"—"}</td><td className="numeric">{book.totalPages??"—"}</td><td>{isMatched?<span className="sgk-chip matched">{percent&&percent<100?`Khớp một phần (${percent}%)`:"Đã khớp"}</span>:<span className="sgk-chip warning">Chưa khớp</span>}</td><td onClick={e=>e.stopPropagation()}>{book.status==="PUBLISHED"?<span className="sgk-chip published">Đã xuất bản</span>:<button title={!isMatched?"Phải hoàn thành khớp trang trước khi xuất bản.":"Xuất bản sách"} disabled={!isMatched} onClick={()=>publishMutation.mutate(book.id)}>Xuất bản</button>}</td><td className="actions-column" onClick={e=>e.stopPropagation()}><button title="Mở trang khớp trang / chỉnh sửa" onClick={()=>setActive({book,detail})}>{isMatched?"Chỉnh sửa":"Khớp trang"}</button><button className="sgk-delete" onClick={()=>{if(confirm(`Xóa sách “${book.title}”? Sách sẽ được gỡ khỏi hệ thống nhưng lịch sử vẫn được bảo toàn.`))deleteMutation.mutate(book.id)}}>Xóa</button></td></tr>})}</tbody></table><footer>Hiển thị {rows.length} kết quả · Bấm vào một cuốn sách để khớp hoặc chỉnh sửa trang.</footer></div>{!rows.length&&<p className="sgk-empty">Chưa có sách giáo khoa.</p>}{uploadOpen&&<UploadBook session={session} onClose={()=>setUploadOpen(false)} onDone={async()=>{setUploadOpen(false);await invalidate()}}/>}</section>;
}

function UploadBook({session,onClose,onDone}:{session:AuthSession;onClose:()=>void;onDone:()=>Promise<void>}){const [title,setTitle]=useState(""),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");const submit=async(e:React.FormEvent)=>{e.preventDefault();if(!file)return;setBusy(true);try{await uploadTextbook(session,{title,docType:"SGK",audience:"STUDENT_ALLOWED",file,basePageOffset:1});await onDone()}catch(reason){setError(message(reason));setBusy(false)}};return <div className="sgk-overlay"><form className="sgk-modal" onSubmit={submit}><header><h2>Tải lên sách giáo khoa</h2><button type="button" onClick={onClose}>×</button></header><label>Tên sách<input required value={title} onChange={e=>setTitle(e.target.value)}/></label><label>File PDF<input required type="file" accept="application/pdf" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>{error&&<div className="api-error">{error}</div>}<footer><button type="button" onClick={onClose}>Hủy</button><button className="sgk-primary" disabled={busy}>{busy?"Đang tải…":"Tải lên"}</button></footer></form></div>}

function TextbookMapping({session,row,onBack}:{session:AuthSession;row:BookRow;onBack:()=>void}){
 const total=row.book.totalPages??1;
 const mapping=useMappingAutoSave({documentId:row.book.id,session,debounceMs:800});
 const [pdfPage,setPdfPageLocal]=useState<number>(Math.max(1,row.book.basePageOffset));
 const [pdfAnchor,setPdfAnchorLocal]=useState<number>(Math.max(1,row.book.basePageOffset));
 const [bookAnchor,setBookAnchorLocal]=useState<number>(1);
 const [zoom,setZoomLocal]=useState<number>(100);
 const [thumbPage,setThumbPageLocal]=useState<number>(1);
 const [check,setCheck]=useState<string>("");
 const [courseId,setCourseId]=useState<number>(0);
 const [chapterId,setChapterId]=useState<number>(0);
 const [lessonId,setLessonId]=useState<number>(0);
 const [rangeEnd,setRangeEnd]=useState<number|null>(null);
 const [notice,setNotice]=useState<string>("");

 useEffect(()=>{void mapping.loadProgress()},[mapping.loadProgress]);

 const setPdfPage=(next:number|((prev:number)=>number))=>{
  setPdfPageLocal((prev)=>{
   const value=typeof next==="function"?(next as (prev:number)=>number)(prev):next;
   const clamped=Math.max(1,Math.min(total,Math.round(value)));
   mapping.update({pdfPage:clamped});
   return clamped;
  });
 };
 const setPdfAnchor=(n:number)=>{const v=Math.max(1,Math.round(n));setPdfAnchorLocal(v);mapping.update({pdfAnchor:v});};
 const setBookAnchor=(n:number)=>{const v=Math.max(1,Math.round(n));setBookAnchorLocal(v);mapping.update({bookAnchor:v});};
 const setZoom=(next:number|((prev:number)=>number))=>{
  setZoomLocal((prev)=>{
   const value=typeof next==="function"?(next as (prev:number)=>number)(prev):next;
   const clamped=Math.max(60,Math.min(150,Math.round(value)));
   mapping.update({zoom:clamped});
   return clamped;
  });
 };
 const setThumbPage=(next:number|((prev:number)=>number))=>{
  setThumbPageLocal((prev)=>{
   const value=typeof next==="function"?(next as (prev:number)=>number)(prev):next;
   const clamped=Math.max(1,Math.round(value));
   mapping.update({thumbPage:clamped});
   return clamped;
  });
 };

 const offset=Math.max(0,pdfAnchor-bookAnchor);
 const bookPage=Math.max(1,pdfPage-offset);
 const checked=check?Number(check)-offset:null;

 const coursesQuery=useQuery({queryKey:["admin-textbook-courses",session.accessToken],queryFn:()=>getCourses(session)});
 const courses=coursesQuery.data??[];
 useEffect(()=>{if(coursesQuery.data)setCourseId(coursesQuery.data[0]?.id??0)},[coursesQuery.data]);

 const chaptersQuery=useQuery({queryKey:["admin-textbook-chapters",session.accessToken,courseId],queryFn:()=>getChapters(session,courseId),enabled:!!courseId});
 const chapters=chaptersQuery.data??[];
 useEffect(()=>{if(chaptersQuery.data)setChapterId(chaptersQuery.data[0]?.id??0)},[chaptersQuery.data]);

 const lessonsQuery=useQuery({queryKey:["admin-textbook-lessons",session.accessToken,chapterId],queryFn:()=>getLessons(session,chapterId),enabled:!!chapterId});
 const lessons=lessonsQuery.data??[];

 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{
   if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;
   if(e.key==="ArrowLeft")setPdfPage(p=>Math.max(1,p-1));
   else if(e.key==="ArrowRight")setPdfPage(p=>Math.min(total,p+1));
  };
  window.addEventListener("keydown",onKey);
  return ()=>window.removeEventListener("keydown",onKey);
 },[total]);

 const saveOffset=async()=>{await setTextbookPageOffset(session,row.book.id,pdfAnchor);setNotice("Đã lưu công thức khớp trang.");};
 const attach=async()=>{
  if(!lessonId)return;
  await attachLessonDocument(session,lessonId,{documentId:row.book.id,required:true,teacherNote:rangeEnd?`Trang sách ${bookPage}-${Math.max(bookPage,rangeEnd-offset)}`:`Trang sách ${bookPage}`,startPage:bookPage});
  setNotice(rangeEnd?`Đã gắn khoảng trang sách ${bookPage}–${Math.max(bookPage,rangeEnd-offset)}.`:`Đã gắn sách vào bài học.`);
 };
 const fetchPdfUrl=useCallback(async()=>{
  const info=await openTextbook(session,row.book.id,pdfPage>offset?Math.max(1,pdfPage-offset):undefined);
  return info.fileUrl;
 },[session,row.book.id,pdfPage,offset]);

 // "Vừa trang": đo khung trống rồi suy ra bề rộng sao cho cả trang lọt vào khung.
 // Tỉ lệ trang do PdfPageViewer báo về sau lượt vẽ đầu; trước đó tạm dùng A4 dọc.
 const fitBoxRef=useRef<HTMLDivElement|null>(null);
 const [fitPage,setFitPage]=useState(false);
 const [fitBox,setFitBox]=useState<{w:number;h:number}|null>(null);
 const [pageAspect,setPageAspect]=useState(1/1.414);
 useEffect(()=>{
  const node=fitBoxRef.current;
  if(!node||!fitPage)return;
  const observer=new ResizeObserver(entries=>{
   const rect=entries[0]?.contentRect;
   if(rect)setFitBox({w:Math.floor(rect.width),h:Math.floor(rect.height)});
  });
  observer.observe(node);
  return ()=>observer.disconnect();
 },[fitPage]);
 const fitWidth=useMemo(()=>{
  if(!fitPage||!fitBox)return Math.round(zoom*7.6);
  // Trừ 30px: 12px padding mỗi bên của .pdf-canvas-wrap + viền ảnh + bù sai số làm tròn.
  // Thiếu khoản này là trang tràn ra vài pixel, thanh cuộn hiện rồi mất làm khung co giật.
  const room=30;
  return Math.max(120,Math.round(Math.min(fitBox.w-room,(fitBox.h-room)*pageAspect)));
 },[fitPage,fitBox,zoom,pageAspect]);
 const exitFitPage=(action:()=>void)=>{setFitPage(false);action()};
 const mappedCount=useMemo(()=>row.detail?.pageMappings.length??0,[row.detail]);

 return (
  <section className="mapping-tool">
   <header className="mapping-topbar">
    <button className="mapping-icon-btn" onClick={onBack} aria-label="Quay lại">
     <span className="material-symbols-outlined">arrow_back</span>
    </button>
    <div className="mapping-title">
     <h2>{row.book.title}</h2>
     <small>Trang PDF {pdfPage} / {total}{bookPage?` · Trang sách ${bookPage}`:""} · Khớp {mappedCount}/{total} trang</small>
    </div>
    <div className="mapping-topbar-actions">
     <small className="autosave-hint">{mapping.saving?"Đang lưu tiến độ…":mapping.saveError?`Lỗi: ${mapping.saveError}`:"Đã đồng bộ tiến độ"}</small>
     <button className="mapping-btn-ghost" onClick={onBack}>
      <span className="material-symbols-outlined">close</span>Thoát
     </button>
     <button className="mapping-btn-primary" onClick={()=>void saveOffset()}>
      <span className="material-symbols-outlined">save</span>Lưu lại
     </button>
    </div>
   </header>
   <main className="mapping-main">
    <aside className="pdf-thumbs">
     <div className="pdf-thumbs-head">
      <span>Trang PDF</span>
      <small>{thumbPage*40<total?`${(thumbPage-1)*40+1}–${Math.min(thumbPage*40,total)}`:`1–${total}`}</small>
     </div>
     <div className="pdf-thumbs-grid">
      {Array.from({length:Math.min(total,40)},(_,i)=>i+1).map(page=>(
       <button className={`pdf-thumb ${page===pdfPage?"active":""}`} onClick={()=>setPdfPage(page)} key={page}>
        <PdfThumbnail fileUrl={row.book.fileUrl} accessToken={session.accessToken} pageNumber={page} renderScale={0.4} className="pdf-thumb-img"/>
        <small>PDF {page}{page>offset?` · Sách ${page-offset}`:""}</small>
       </button>
      ))}
     </div>
     {total>40&&(
      <div className="pdf-thumbs-pager">
       <button disabled={thumbPage<=1} onClick={()=>setThumbPage(t=>Math.max(1,t-1))}>‹</button>
       <span>{thumbPage}/{Math.ceil(total/40)}</span>
       <button disabled={thumbPage*40>=total} onClick={()=>setThumbPage(t=>t+1)}>›</button>
      </div>
     )}
    </aside>

    <section className="pdf-stage">
     <div className="pdf-toolbar">
      <div className="pdf-toolbar-zoom">
       <button className="mapping-icon-btn" onClick={()=>exitFitPage(()=>setZoom(z=>Math.max(60,z-10)))} aria-label="Thu nhỏ">
        <span className="material-symbols-outlined">zoom_out</span>
       </button>
       <b>{fitPage?"Vừa trang":`${zoom}%`}</b>
       <button className="mapping-icon-btn" onClick={()=>exitFitPage(()=>setZoom(z=>Math.min(150,z+10)))} aria-label="Phóng to">
        <span className="material-symbols-outlined">zoom_in</span>
       </button>
       <button className="mapping-icon-btn" onClick={()=>exitFitPage(()=>setZoom(100))} aria-label="Về 100%" title="Về 100%">
        <span className="material-symbols-outlined">fit_screen</span>
       </button>
       <button className="mapping-btn-ghost" aria-pressed={fitPage} title="Hiện đúng một trang lọt hết vào khung"
        onClick={()=>setFitPage(v=>!v)}>Vừa trang</button>
      </div>
      <div className="pdf-toolbar-nav">
       <button className="mapping-icon-btn" disabled={pdfPage<=1} onClick={()=>setPdfPage(p=>Math.max(1,p-1))} aria-label="Trang trước">
        <span className="material-symbols-outlined">chevron_left</span>
       </button>
       <span className="pdf-page-counter">Trang {pdfPage} / {total}</span>
       <button className="mapping-icon-btn" disabled={pdfPage>=total} onClick={()=>setPdfPage(p=>Math.min(total,p+1))} aria-label="Trang sau">
        <span className="material-symbols-outlined">chevron_right</span>
       </button>
       <input className="pdf-page-input" type="number" min={1} max={total} value={pdfPage} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=1&&n<=total)setPdfPage(Math.round(n))}}/>
      </div>
      <div className="pdf-toolbar-actions">
       <button className="mapping-btn-ghost" onClick={()=>void openTextbookInBrowser(session,row.book.id,bookPage)}>
        <span className="material-symbols-outlined">open_in_new</span>Mở tab mới
       </button>
      </div>
     </div>
     <div className="pdf-viewport">
      <span className="mapped-badge">Trang sách {bookPage}</span>
      <div className="pdf-fit-box" ref={fitBoxRef}>
       <PdfPageViewer key={`${row.book.id}-${pdfPage}-${fitWidth}`} fileUrl={row.book.fileUrl} accessToken={session.accessToken} pageNumber={pdfPage} fitWidth={fitWidth} onResolveUrl={fetchPdfUrl} onPageAspect={setPageAspect} className="pdf-canvas-wrap"/>
      </div>
     </div>
    </section>

    <aside className="mapping-panel">
     <div className="mapping-panel-block">
      <h2>
       <span className="material-symbols-outlined">sync</span>Khớp số trang
      </h2>
      <div className="anchor-grid">
       <label>Mốc Trang PDF<input type="number" min={1} value={pdfAnchor} onChange={e=>setPdfAnchor(Math.max(1,Number(e.target.value)||1))}/></label>
       <b>=</b>
       <label>Mốc Trang Sách<input type="number" min={1} value={bookAnchor} onChange={e=>setBookAnchor(Math.max(1,Number(e.target.value)||1))}/></label>
      </div>
      <p className="formula">Trang Sách = Trang PDF − {offset}</p>
      <label className="quick-check">Kiểm tra nhanh<input type="number" value={check} onChange={e=>setCheck(e.target.value)} placeholder="Nhập số trang PDF"/>{checked!==null&&<output>Sách: {checked}</output>}</label>
     </div>

     <div className="mapping-panel-block">
      <h2>
       <span className="material-symbols-outlined">history</span>Lịch sử khớp trang
      </h2>
      <div className="history-toolbar">
       <button className="mapping-btn-ghost" disabled={!mapping.canPrev} onClick={()=>{mapping.goPrev();void mapping.commitHistory("PREV")}} aria-label="Về trước">
        <span className="material-symbols-outlined">arrow_upward</span>Lên
       </button>
       <button className="mapping-btn-ghost" disabled={!mapping.canNext} onClick={()=>{mapping.goNext();void mapping.commitHistory("NEXT")}} aria-label="Về sau">
        <span className="material-symbols-outlined">arrow_downward</span>Xuống
       </button>
       <button className="mapping-btn-ghost" onClick={()=>void mapping.commitHistory("GOTO")} disabled={mapping.saving} aria-label="Lưu mốc">
        <span className="material-symbols-outlined">bookmark_add</span>Lưu mốc
       </button>
      </div>
      {(mapping.saving||mapping.historyError||mapping.saveError)&&(
       <p className="mapping-notice">
        {mapping.saving?"Đang lưu…":""}
        {mapping.saveError?`Lỗi lưu tiến độ: ${mapping.saveError}`:""}
        {mapping.historyError?`Lỗi lịch sử: ${mapping.historyError}`:""}
       </p>
      )}
      {mapping.history.length===0?(
       <p className="empty-copy">Chưa có lịch sử. Bấm <b>Lưu mốc</b> sau mỗi trang đã khớp để có thể tua lại.</p>
      ):(
       <ol className="history-list">
        {mapping.history.slice().reverse().map((entry,idx)=>{
         const realIndex=mapping.history.length-1-idx;
         const isCurrent=realIndex===mapping.cursor;
         return (
          <li key={entry.id} className={`history-row ${isCurrent?"current":""}`}>
           <button className="history-jump" onClick={()=>{
            if(realIndex===mapping.cursor)return;
            const diff=realIndex-mapping.cursor;
            for(let i=0;i<Math.abs(diff);i++){
             if(diff<0)mapping.goPrev();else mapping.goNext();
            }
            void mapping.commitHistory("GOTO");
           }}>
            <span className="history-action">{entry.action}</span>
            <span className="history-page">PDF {entry.pdfPage} · Sách {Math.max(1,entry.pdfPage-(entry.pdfAnchor-entry.bookAnchor))}</span>
            <small>{new Date(entry.createdAt).toLocaleTimeString("vi-VN")}</small>
           </button>
          </li>
         );
        })}
       </ol>
      )}
     </div>

     <div className="mapping-panel-block">
      <h2>
       <span className="material-symbols-outlined">account_tree</span>Gắn bài học
      </h2>
      <label>Khóa học<select value={courseId} onChange={e=>setCourseId(Number(e.target.value))}>{courses.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
      <label>Chương<select value={chapterId} onChange={e=>setChapterId(Number(e.target.value))}>{chapters.map(x=><option value={x.id} key={x.id}>{x.title}</option>)}</select></label>
      <div className="lesson-tree">
       {lessons.length===0&&<p className="empty-copy">Chọn chương để xem bài học.</p>}
       {lessons.map(x=>(
        <label className={`lesson-row ${lessonId===x.id?"selected":""}`} key={x.id}>
         <input type="radio" checked={lessonId===x.id} onChange={()=>setLessonId(x.id)}/>
         <span>{x.title}</span>
         {lessonId===x.id&&<small>Trang {bookPage}</small>}
        </label>
       ))}
      </div>
      <div className="attach-actions">
       <button className="mapping-btn-primary" disabled={!lessonId} onClick={()=>{setRangeEnd(null);void attach()}}>
        <span className="material-symbols-outlined">push_pin</span>Gắn trang hiện tại ({bookPage})
       </button>
       <div className="attach-range">
        <label>Đến trang PDF<input type="number" min={pdfPage} value={rangeEnd??pdfPage} onChange={e=>setRangeEnd(Math.max(pdfPage,Number(e.target.value)||pdfPage))}/></label>
        <button className="mapping-btn-ghost" disabled={!lessonId} onClick={()=>void attach()}>
         <span className="material-symbols-outlined">library_books</span>Gắn khoảng
        </button>
       </div>
      </div>
     </div>

     {notice&&<p className="mapping-notice">{notice}</p>}
    </aside>
   </main>
  </section>
 );
}
