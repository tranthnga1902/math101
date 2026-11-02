import {useEffect,useMemo,useRef,useState} from "react";
import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import type {PDFDocumentProxy} from "pdfjs-dist";
import {deleteDocument,documentContentUrl,getAdminTextbooks,publishTextbook,uploadTextbook,type AuthSession,type TextbookItem} from "../api";
import {useContentSize,useDragPan,usePdfBaseSize,usePdfDocument,usePdfPageRender,useScrollPages} from "../components/pdfCore";
import {PdfScrollPage} from "../components/PdfScrollPage";
import "./textbook-management.css";
import "./textbook-pdf.css";
import { AuthedImage } from "../lib/authedImage";
import { AdminPage } from "./components/AdminPageLayout";
import { AdminTable } from "./components/AdminTable";
import { AdminEmptyState } from "./components/AdminEmptyState";
import { AdminModal } from "./components/AdminModal";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

const message=(reason:unknown)=>reason instanceof Error?reason.message:"Không thể thực hiện thao tác";
const TEXTBOOKS_QUERY_KEY="admin-textbooks";
const THUMBS_PER_PAGE=40;
const ZOOM_MIN=40,ZOOM_MAX=300;

export function TextbookManagement({session}:{session:AuthSession}){
 const queryClient=useQueryClient();
 const [active,setActive]=useState<TextbookItem|null>(null),[uploadOpen,setUploadOpen]=useState(false);
 const booksQuery=useQuery({queryKey:[TEXTBOOKS_QUERY_KEY,session.accessToken],queryFn:()=>getAdminTextbooks(session)});
 const rows=booksQuery.data??[];
 const invalidate=()=>queryClient.invalidateQueries({queryKey:[TEXTBOOKS_QUERY_KEY]});
 const publishMutation=useMutation({mutationFn:(id:number)=>publishTextbook(session,id),onSuccess:invalidate});
 const deleteMutation=useMutation({mutationFn:(id:number)=>deleteDocument(session,id),onSuccess:invalidate});
 const error=booksQuery.isError?message(booksQuery.error):publishMutation.isError?message(publishMutation.error):deleteMutation.isError?message(deleteMutation.error):"";
 if(active)return <TextbookReader session={session} book={active} onBack={()=>setActive(null)}/>;

 const columns = [
  { key: "thumbnail", label: "Ảnh bìa", render: (book: TextbookItem) => (
    <div className="w-12 h-16 bg-slate-100 rounded overflow-hidden flex items-center justify-center border border-outline-variant">
      <AuthedImage url={book.thumbnailUrl} accessToken={session.accessToken} alt="" fallback={<span className="text-xs text-on-surface-variant">PDF</span>} />
    </div>
  )},
  { key: "title", label: "Tên SGK", render: (book: TextbookItem) => (
    <div><b className="block">{book.title}</b><small className="text-on-surface-variant">{book.docType}</small></div>
  )},
  { key: "volume", label: "Tập", render: (book: TextbookItem) => /tập\s*2/i.test(book.title)?"Tập 2":/tập\s*1/i.test(book.title)?"Tập 1":"—" },
  { key: "pages", label: "Số trang PDF", render: (book: TextbookItem) => book.totalPages ?? "—" },
  { key: "publishStatus", label: "Trạng thái xuất bản", render: (book: TextbookItem) => (
    <div onClick={e=>e.stopPropagation()}>
     {book.status==="PUBLISHED" ? (
      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-[#ecfccb] text-[#3f6212] border border-[#d9f99d]">Đã xuất bản</span>
     ) : (
      <Button variant="outline" size="sm" disabled={publishMutation.isPending} onClick={() => publishMutation.mutate(book.id)}>
       Xuất bản
      </Button>
     )}
    </div>
  )},
  { key: "actions", label: "Thao tác", render: (book: TextbookItem) => (
    <div className="flex items-center gap-2" onClick={e=>e.stopPropagation()}>
     <Button variant="outline" size="sm" onClick={()=>setActive(book)}>Xem sách</Button>
     <Button variant="destructive" size="sm" onClick={()=>{if(confirm(`Xóa sách “${book.title}”? Sách sẽ được gỡ khỏi hệ thống nhưng lịch sử vẫn được bảo toàn.`))deleteMutation.mutate(book.id)}}>
      Xóa
     </Button>
    </div>
  )}
 ];

 return (
  <AdminPage>
   <AdminPage.Header
    eyebrow="QUẢN TRỊ HỆ THỐNG"
    title="Quản lý Sách Giáo Khoa"
    description="Danh sách SGK môn Toán lớp 10 chương trình GDPT 2018."
   >
    <Button onClick={()=>setUploadOpen(true)}>Tải lên SGK</Button>
   </AdminPage.Header>

   {error&&<div className="mb-4 p-3 rounded-lg bg-error-container text-on-error-container text-sm">{error}</div>}

   <AdminPage.Content>
    {rows.length > 0 || booksQuery.isLoading ? (
     <AdminTable<TextbookItem>
      columns={columns}
      data={rows}
      loading={booksQuery.isLoading}
      keyExtractor={book => book.id}
      onRowClick={book => setActive(book)}
      footer={<div className="text-sm text-on-surface-variant">Hiển thị {rows.length} kết quả · Bấm vào một cuốn sách để xem.</div>}
     />
    ) : (
     <AdminEmptyState title="Chưa có sách giáo khoa." description="Hãy tải lên một cuốn sách để bắt đầu." />
    )}
   </AdminPage.Content>

   {uploadOpen&&<UploadBook session={session} onClose={()=>setUploadOpen(false)} onDone={async()=>{setUploadOpen(false);await invalidate()}}/>}
  </AdminPage>
 );
}

function UploadBook({session,onClose,onDone}:{session:AuthSession;onClose:()=>void;onDone:()=>Promise<void>}){
 const [title,setTitle]=useState(""),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(!file)return;setBusy(true);try{await uploadTextbook(session,{title,docType:"SGK",audience:"STUDENT_ALLOWED",file,basePageOffset:1});await onDone()}catch(reason){setError(message(reason));setBusy(false)}};
 return (
  <AdminModal
   open={true}
   onClose={onClose}
   title="Tải lên sách giáo khoa"
   size="md"
   footer={
    <>
     <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Hủy</Button>
     <Button type="submit" form="upload-book-form" disabled={busy}>{busy?"Đang tải…":"Tải lên"}</Button>
    </>
   }
  >
   <form id="upload-book-form" onSubmit={submit} className="space-y-4">
    <div>
     <label className="block text-sm font-medium mb-1 text-on-surface">Tên sách</label>
     <Input required value={title} onChange={e=>setTitle(e.target.value)} className="w-full" />
    </div>
    <div>
     <label className="block text-sm font-medium mb-1 text-on-surface">File PDF</label>
     <Input required type="file" accept="application/pdf" onChange={e=>setFile(e.target.files?.[0]??null)} className="w-full" />
    </div>
    {error&&<div className="mb-4 p-3 rounded-lg bg-error-container text-on-error-container text-sm">{error}</div>}
   </form>
  </AdminModal>
 );
}

/** Xem sách ngay trong admin: danh sách trang bên trái, các trang xếp dọc ở giữa, lăn chuột để lướt trang. */
function TextbookReader({session,book,onBack}:{session:AuthSession;book:TextbookItem;onBack:()=>void}){
 // PDF tải một lần qua backend; mọi trang và ảnh trang nhỏ đều vẽ từ cùng một tài liệu.
 const contentUrl=useMemo(()=>documentContentUrl(book.id),[book.id]);
 const pdfState=usePdfDocument(contentUrl,session.accessToken);
 const pdf=pdfState.pdf;
 const total=pdf?.numPages??book.totalPages??1;
 const [zoom,setZoomRaw]=useState(100);
 const [fitPage,setFitPage]=useState(true);
 const [thumbPage,setThumbPage]=useState(1);
 const [renderError,setRenderError]=useState("");
 const setZoom=(value:number)=>setZoomRaw(Math.max(ZOOM_MIN,Math.min(ZOOM_MAX,Math.round(value))));

 const baseSize=usePdfBaseSize(pdf,setRenderError);

 const viewportRef=useRef<HTMLDivElement|null>(null);
 const box=useContentSize(viewportRef);

 // Một scale chung cho mọi trang. "Vừa trang" = mỗi trang lọt hết chiều cao khung.
 const scale=useMemo(()=>{
  if(!baseSize)return 0;
  if(fitPage){
   if(!box.w||!box.h)return 0;
   return Math.max(0.1,Math.min((box.w-8)/baseSize.width,(box.h-8)/baseSize.height));
  }
  return zoom*7.6/baseSize.width;
 },[baseSize,fitPage,box.w,box.h,zoom]);

 const {page,goTo,pageRef,currentPage}=useScrollPages(viewportRef,total,scale);

 // Lưới trang nhỏ luôn đi theo trang đang xem.
 useEffect(()=>{setThumbPage(Math.ceil(page/THUMBS_PER_PAGE))},[page]);

 // Thoát "Vừa trang" thì zoom tiếp từ mức đang thấy, không nhảy về 100%.
 const zoomBy=(delta:number)=>{
  const from=fitPage&&baseSize?scale*baseSize.width/7.6:zoom;
  setFitPage(false);
  setZoom(Math.round(from/10)*10+delta);
 };
 useDragPan(viewportRef,{onZoom:delta=>zoomBy(delta*10)});

 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{
   if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;
   // Mũi tên lên/xuống để trình duyệt tự cuộn; các phím dưới đây nhảy theo từng trang.
   if(e.key==="ArrowLeft"||e.key==="PageUp"){e.preventDefault();goTo(currentPage()-1)}
   else if(e.key==="ArrowRight"||e.key==="PageDown"){e.preventDefault();goTo(currentPage()+1)}
   else if(e.key==="Home"){e.preventDefault();goTo(1)}
   else if(e.key==="End"){e.preventDefault();goTo(total)}
   else if(e.key==="Escape")onBack();
  };
  window.addEventListener("keydown",onKey);
  return ()=>window.removeEventListener("keydown",onKey);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[total,onBack]);

 const [pageText,setPageText]=useState("1");
 useEffect(()=>{setPageText(String(page))},[page]);

 const thumbPages=Math.max(1,Math.ceil(total/THUMBS_PER_PAGE));
 const thumbStart=(thumbPage-1)*THUMBS_PER_PAGE+1;
 const thumbEnd=Math.min(total,thumbPage*THUMBS_PER_PAGE);
 const thumbGridRef=useRef<HTMLDivElement|null>(null);
 const ready=pdfState.status==="ready"&&!renderError&&baseSize&&scale>0;

 return (
  <section className="mapping-tool">
   <header className="mapping-topbar">
    <button className="mapping-icon-btn" onClick={onBack} aria-label="Quay lại">
     <span className="material-symbols-outlined">arrow_back</span>
    </button>
    <div className="mapping-title">
     <h2>{book.title}</h2>
     <small>Trang {page} / {total}</small>
    </div>
    <div className="mapping-topbar-actions">
     <button className="mapping-btn-ghost" onClick={onBack}>
      <span className="material-symbols-outlined">close</span>Đóng
     </button>
    </div>
   </header>
   <main className="mapping-main textbook-reader">
    <aside className="pdf-thumbs">
     <div className="pdf-thumbs-head">
      <span>Trang</span>
      <small>{thumbStart}–{thumbEnd}</small>
     </div>
     <div className="pdf-thumbs-grid" ref={thumbGridRef}>
      {Array.from({length:Math.max(0,thumbEnd-thumbStart+1)},(_,i)=>thumbStart+i).map(n=>(
       <button className={`pdf-thumb ${n===page?"active":""}`} onClick={()=>goTo(n)} key={n}>
        <PageThumb pdf={pdf} page={n} rootRef={thumbGridRef} active={n===page}/>
        <small>{n}</small>
       </button>
      ))}
     </div>
     {thumbPages>1&&(
      <div className="pdf-thumbs-pager">
       <button disabled={thumbPage<=1} onClick={()=>setThumbPage(t=>Math.max(1,t-1))}>‹</button>
       <span>{thumbPage}/{thumbPages}</span>
       <button disabled={thumbPage>=thumbPages} onClick={()=>setThumbPage(t=>Math.min(thumbPages,t+1))}>›</button>
      </div>
     )}
    </aside>

    <section className="pdf-stage">
     <div className="pdf-toolbar">
      <div className="pdf-toolbar-zoom">
       <button className="mapping-icon-btn" onClick={()=>zoomBy(-10)} aria-label="Thu nhỏ">
        <span className="material-symbols-outlined">zoom_out</span>
       </button>
       <b>{fitPage?"Vừa trang":`${zoom}%`}</b>
       <button className="mapping-icon-btn" onClick={()=>zoomBy(10)} aria-label="Phóng to">
        <span className="material-symbols-outlined">zoom_in</span>
       </button>
       <button className="mapping-icon-btn" onClick={()=>{setFitPage(false);setZoom(100)}} aria-label="Về 100%" title="Về 100%">
        <span className="material-symbols-outlined">fit_screen</span>
       </button>
       <button className="mapping-btn-ghost" aria-pressed={fitPage} title="Mỗi trang lọt hết chiều cao khung"
        onClick={()=>setFitPage(v=>!v)}>Vừa trang</button>
      </div>
      <div className="pdf-toolbar-nav">
       <button className="mapping-icon-btn" disabled={page<=1} onClick={()=>goTo(page-1)} aria-label="Trang trước">
        <span className="material-symbols-outlined">chevron_left</span>
       </button>
       <input className="pdf-page-input" inputMode="numeric" value={pageText} aria-label="Số trang"
        onChange={e=>setPageText(e.target.value)}
        onBlur={()=>{const n=Number(pageText);if(Number.isFinite(n)&&n>=1)goTo(n);else setPageText(String(page))}}
        onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/>
       <span className="pdf-page-counter">/ {total}</span>
       <button className="mapping-icon-btn" disabled={page>=total} onClick={()=>goTo(page+1)} aria-label="Trang sau">
        <span className="material-symbols-outlined">chevron_right</span>
       </button>
      </div>
      <small className="pdf-toolbar-hint">Lăn chuột để lướt trang · Kéo để di chuyển · Ctrl + lăn để zoom</small>
     </div>
     <div className="pdf-viewport pdf-pan pdf-scroll" ref={viewportRef}>
      {pdfState.status==="loading"&&<p className="pdf-state">Đang tải sách…</p>}
      {(pdfState.status==="error"||renderError)&&(
       <p className="pdf-state error"><b>Không hiển thị được trang PDF</b>{pdfState.error||renderError}</p>
      )}
      {ready&&(
       <div className="pdf-pages">
        {Array.from({length:total},(_,i)=>i+1).map(n=>(
         <PdfScrollPage key={n} pdf={pdf} page={n} scale={scale} base={baseSize} rootRef={viewportRef}
          holderRef={pageRef(n)} className="pdf-scroll-page" canvasClassName="pdf-page-canvas" onError={setRenderError}/>
        ))}
       </div>
      )}
     </div>
    </section>
   </main>
  </section>
 );
}

/** Ảnh trang nhỏ, chỉ vẽ khi cuộn tới để sách vài trăm trang không vẽ hết một lượt. */
function PageThumb({pdf,page,rootRef,active}:{pdf:PDFDocumentProxy|null;page:number;rootRef:React.RefObject<HTMLDivElement|null>;active:boolean}){
 const holderRef=useRef<HTMLDivElement|null>(null);
 const canvasRef=useRef<HTMLCanvasElement|null>(null);
 const [visible,setVisible]=useState(false);
 useEffect(()=>{
  const node=holderRef.current;
  if(!node||visible)return;
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))setVisible(true)},{root:rootRef.current,rootMargin:"200px"});
  observer.observe(node);
  return ()=>observer.disconnect();
 },[rootRef,visible]);
 useEffect(()=>{if(active)holderRef.current?.scrollIntoView({block:"nearest"})},[active]);
 usePdfPageRender(visible?pdf:null,page,canvasRef,base=>120/base.width,[]);
 return <div className="pdf-thumb-img" ref={holderRef}>{visible&&pdf&&<canvas ref={canvasRef} className="pdf-thumb-canvas"/>}</div>;
}
