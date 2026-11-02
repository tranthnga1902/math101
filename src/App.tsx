import { Fragment, useEffect, useMemo, useState } from "react";
import { AdminFinancePage } from "./finance/AdminFinancePage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import katex from "katex";
import QRCode from "qrcode";
import { ArrowUpDown, Bell, BookOpen, BookOpenCheck, Calculator, CalendarRange, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, ClipboardList, Clock3, Database, FileCheck, Edit, Edit3, Eye, Filter, FileText, GraduationCap, Home, Info, KeyRound, LayoutList, LibraryBig, Lock, LogOut, Menu, MoreVertical, Pencil, PlayCircle, Plus, Printer, Search, Settings, Trash2, Upload, UserRound, Users, X } from "lucide-react";
import "katex/dist/katex.min.css";
import { MainLayout } from "./layout/MainLayout";
import { PdfThumbnail } from "./PdfThumbnail";
import { AttachmentCard, LessonAttachments } from "./components/LessonAttachments";
import { AdminModal } from "./admin/components/AdminModal";
import { AdminDrawer } from "./admin/components/AdminDrawer";
import { SkeletonTable } from "./admin/components/AdminSkeleton";
import { Button } from "./components/ui/button";
import { PdfViewer, isPdfDocument } from "./components/PdfViewer";
import { UserAccountsPage } from "./admin/UserAccountsPage";
import { TextbookManagement } from "./admin/TextbookManagement";
import { DocumentManagement } from "./admin/DocumentManagement";
import { AuditManagement } from "./admin/AuditManagement";
import { PpctCauTrucModal } from "./admin/PpctCauTrucModal";
import { AdminOverview } from "./admin/AdminOverview";
import { getAdminDestination, type AdminDestination } from "./admin/navigation";
import { ClassSchedulePanel } from "./admin/ClassSchedulePanel";
import { CourseDeliverySessionPanel } from "./admin/CourseDeliverySessionPanel";
import { KhoaHocDetailPanel } from "./admin/KhoaHocDetailPanel";
import { StudentExperience } from "./student/StudentExperience";
import { LoginPage } from "./auth/LoginPage";
import { LessonEditorModal, LessonContentRenderer } from "./components/lesson-editor";
import { LessonPreviewModal } from "./admin/components/LessonPreviewModal";
import { ngayDiHocLai, ngayVN } from "./student/format";
import { TeacherDocumentLibrary } from "./teacher/TeacherDocumentLibrary";
import { TeacherSubmissionView } from "./teacher/TeacherSubmissionView";
import { TeacherWorksheetView } from "./teacher/TeacherWorksheetView";
import { DeThiWorkspace } from "./dethi/DeThiWorkspace";
import { ExamManager } from "./exams/ExamManager";
import { TeacherTaskView } from "./teacher/TeacherTaskView";
import { TeacherOperationsView } from "./teacher/TeacherOperationsView";
import { TeacherClassManager } from "./teacher/TeacherClassManager";
import { ClassDetail } from "./teacher/class/ClassDetail";
import { TeacherRoster } from "./teacher/TeacherRoster";
import { ProfileSettings } from "./settings/ProfileSettings";
import { MathWorkspace } from "./teacher/MathWorkspace";
import {
  createCourse,
  deleteCourse,
  changePassword,
  createChapter,
  createLesson,
  deleteChapter,
  deleteLesson,
  reorderChapters,reorderLessons,
  getCourses,
  getCourseInstances,
  getAcademicBreaks,
  addAcademicBreak,
  removeAcademicBreak,
  getProgramTemplates,
  createProgramTemplate,
  createCourseInstance,
  updateCourseInstance,
  deleteCourseInstance,
  getCourseWeeklySchedule,
  saveCourseWeeklySchedule,
  getCourseHolidays,
  addCourseHoliday,
  removeCourseHoliday,
  type GeneratePreview,
  previewCourseSessions,
  generateCourseSessions,
  getChapters,
  getLessons,
  getProgramCourseTree,
  uploadPpctPreview,confirmPpct,getProgramStrands,
  xemTruocLichTuan,sinhLichTuan,
  getAdminStats,
  getAdminCalendarEvents,
  getAuditLogs,
  getMetadata,
  getUsers,
  getStudentProgress,
  login,
  logoutSession,
  refreshSession,
  accessTokenExpiresAt,
  normalizeRole,
  markLessonProgress,
  updateCourse,
  updateChapter,
  updateLesson,
  getGrades,
  getTopics,
  getWorksheets,
  attachWorksheetToLesson,
  getMyCourses,
  getMyAssignments,
  markAssignment,
  getPublicProblem,
  markProblemProgress,
  getClassesPage,getAdminClassOverview,createClass,updateClass,deleteClass,getTeacherStats,getTeacherClasses,getAssignedCourses,getProgramResources,type ProgramResource,getGradebook,getClassResults,
  getLessonResources,addLessonResource,updateLessonResource,deleteLessonResource,uploadFile,
  reorderLessonResources,
  getEnrollments,addEnrollment,removeEnrollment,getAssignments,getClassRoster,addRosterStudent,
  getDocuments,openDocumentFile,openLessonDocumentFile,getLessonDocuments,getLessonDocumentQuestions,addLessonDocumentQuestion,deleteLessonDocumentQuestion,recordLessonDocumentStudy,submitLessonDocumentQuiz,attachLessonDocument,updateLessonDocument,deleteLessonDocument,moveLessonDocument,
  getTextbooks,openTextbookInBrowser,
  downloadFile,
  type AuthSession,
  type Course,
  type CourseInput,
  type Chapter,
  type ChapterInput,
  type Lesson,
  type LessonInput,
  type Progress,
  type StudentCourse,
  type StudentAssignment,
  type AdminClassOverviewRow,type AdminCalendarEvent,type Classroom,type ClassroomInput,
  type Enrollment,type CourseInstance,type RosterStudent,
  type LessonProgramResource,
  type TextbookItem,type LessonDocument,type LessonDocumentQuestion,
  type Metadata,type MetadataOption,type ProgramImportStrand,
  type PpctPreview,type PpctRow,type AssignedCourse,
} from "./api";

function useMetadata(session: AuthSession) {
  const { data } = useQuery({
    queryKey: ["metadata", session.accessToken],
    queryFn: () => getMetadata(session),
    enabled: Boolean(session.accessToken),
    staleTime: 5 * 60 * 1000,
  });
  return data ?? null;
}

const viMetadataLabels: Partial<Record<keyof Metadata, Record<string, string>>> = {
  userStatuses: {
    ACTIVE: "Đang hoạt động",
    LOCKED: "Đã khóa",
    INACTIVE: "Tạm ngưng",
    ARCHIVED: "Đã xóa",
  },
  classStatuses: {
    ACTIVE: "Đang học",
    LOCKED: "Đã khóa",
    ARCHIVED: "Đã xóa",
  },
  courseStatuses: {
    DRAFT: "Nháp",
    PUBLISHED: "Đã xuất bản",
    HIDDEN: "Đã ẩn",
    ARCHIVED: "Đã xóa",
  },
  publishStatuses: {
    DRAFT: "Nháp",
    PUBLISHED: "Đã xuất bản",
    HIDDEN: "Đã ẩn",
    ARCHIVED: "Đã xóa",
  },
};

function metadataOptions(metadata: Metadata | null, key: keyof Metadata): MetadataOption[] {
  const labels = viMetadataLabels[key];
  return (metadata?.[key] ?? []).map(option => ({
    ...option,
    label: labels?.[option.value] ?? option.label,
  }));
}

function firstMetadataValue(metadata: Metadata | null, key: keyof Metadata) {
  return metadataOptions(metadata, key)[0]?.value ?? "";
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(()=>{try{const value=localStorage.getItem("math10.session");if(!value)return null;const saved=JSON.parse(value) as AuthSession & {roleCode?:string};const normalized={...saved,role:normalizeRole(saved.role ?? saved.roleCode)} as AuthSession;localStorage.setItem("math10.session",JSON.stringify(normalized));return normalized}catch{localStorage.removeItem("math10.session");return null}});
  const publicSlug=location.pathname.match(/^\/q\/([A-Za-z0-9]+)$/)?.[1];
  const acceptSession=(next:AuthSession)=>{localStorage.setItem("math10.session",JSON.stringify(next));setSession(next)};
  const forgetSession=()=>{localStorage.removeItem("math10.session");setSession(null)};
  // Đăng xuất phải thu hồi refresh token ở máy chủ, không chỉ xoá localStorage — nếu không thì
  // "đăng xuất" chỉ giấu token đi chứ token vẫn dùng được.
  const logout=()=>{const dangDong=session;forgetSession();if(dangDong)void logoutSession(dangDong)};

  // Access token sống 30 phút và không thu hồi được, nên phải tự đổi lấy bản mới trước khi hết
  // hạn. Chặn trên 25 phút để phiên cũ (token dài ngày, chưa có refresh token) không rơi vào
  // setTimeout quá 2^31 mili-giây — quá ngưỡng đó trình duyệt kích hoạt ngay lập tức.
  useEffect(()=>{
    if(!session?.refreshToken)return;
    const conLai=accessTokenExpiresAt(session.accessToken)-Date.now()-120_000;
    const cho=Math.min(Math.max(conLai,0),25*60_000);
    const hen=setTimeout(()=>{refreshSession(session).then(acceptSession).catch(forgetSession)},cho);
    return ()=>clearTimeout(hen);
  },[session]);

  // Vào/ra phiên xem hộ. Phiên thật nằm riêng một khoá để thoát ra được kể cả khi tải lại trang;
  // nếu ghi đè lên "math10.session" thì đóng tab giữa chừng là mất luôn phiên giáo viên.
  useEffect(()=>{
    const vao=(event:Event)=>{
      const phienXem=(event as CustomEvent<AuthSession>).detail;
      const phienThat=localStorage.getItem("math10.session.real")??localStorage.getItem("math10.session");
      if(phienThat)localStorage.setItem("math10.session.real",phienThat);
      acceptSession(phienXem);
    };
    window.addEventListener("math10:xem-ho",vao);
    return()=>window.removeEventListener("math10:xem-ho",vao);
  },[]);
  const thoatXemHo=()=>{
    const phienThat=localStorage.getItem("math10.session.real");
    localStorage.removeItem("math10.session.real");
    if(!phienThat){forgetSession();return}
    try{acceptSession(JSON.parse(phienThat) as AuthSession)}catch{forgetSession()}
  };

  if(publicSlug)return <PublicProblemPage slug={publicSlug} session={session}/>;
  if (!session) return <LoginPage onLogin={acceptSession} />;
  if(session.impersonating)return <>
    <BangXemHo ten={session.impersonating.studentName} onThoat={thoatXemHo}/>
    <div className="dang-xem-ho"><AppShell session={session} onLogout={thoatXemHo}/></div>
  </>;
  return <AppShell session={session} onLogout={logout} />;
}

/** Dải băng cam dính đầu màn: đang nhìn bằng mắt ai, và đường thoát ra. */
function BangXemHo({ten,onThoat}:{ten:string;onThoat:()=>void}){
 return <div className="bang-xem-ho" role="status">
  <span><b>Đang xem bằng mắt học viên {ten}</b> — chỉ đọc, mọi thao tác ghi đều bị chặn.</span>
  <button type="button" onClick={onThoat}>Thoát khỏi chế độ xem</button>
 </div>;
}

function PublicProblemPage({slug,session}:{slug:string;session:AuthSession|null}){
 const problemQuery=useQuery({queryKey:["public-problem",slug],queryFn:()=>getPublicProblem(slug)});
 const data=problemQuery.data??null;
 const [qr,setQr]=useState(""),[progressStatus,setProgressStatus]=useState(""),[revealedHints,setRevealedHints]=useState(0),[showSolutions,setShowSolutions]=useState(false);
 useEffect(()=>{void QRCode.toDataURL(location.href,{width:240,margin:1}).then(setQr)},[slug]);
 const progressMutation=useMutation({mutationFn:(input:{completed:boolean})=>markProblemProgress(session as AuthSession,data!.problem.id,input.completed)});
 const error=problemQuery.isError?messageOf(problemQuery.error):progressMutation.isError?messageOf(progressMutation.error):"";
 if(error)return <main className="public-problem"><div className="api-error">{error}</div></main>;
 if(!data)return <main className="public-problem">Đang tải bài toán…</main>;
 const math=(value:string)=><span className="latex" dangerouslySetInnerHTML={{__html:katex.renderToString(value.replace(/^\$|\$$/g,""),{throwOnError:false,displayMode:true})}}/>;
 const markOpened=()=>{if(session?.role==="student"&&!progressStatus)progressMutation.mutate({completed:false},{onSuccess:()=>setProgressStatus("IN_PROGRESS")})};
 return <main className="public-problem">
  <header><div className="brand"><span className="brand-mark">M10</span><b>MATH10</b></div><span>{data.problem.publicCode}</span></header>
  <section className="problem-hero"><div><p className="eyebrow">{data.problemType.name} · {data.problem.difficulty}</p><h1>Bài toán</h1>{math(data.problem.statementLatex)}{data.problem.contentHtml&&data.problem.contentHtml!==data.problem.statementLatex&&<SafeLessonContent html={data.problem.contentHtml}/>}</div>{qr&&<a href={qr} download={`${data.problem.publicCode}.png`}><img src={qr} alt={`QR ${data.problem.publicCode}`}/><small>Tải QR PNG</small></a>}</section>
  <section className="public-details">
   <article><h2>Gợi ý</h2>{data.hints.slice(0,revealedHints).map((x,i)=><div className="revealed-hint" key={x.id}><b>Gợi ý {i+1}</b>{math(x.contentLatex)}</div>)}{revealedHints<data.hints.length?<button className="hint-reveal-button" onClick={()=>{setRevealedHints(value=>value+1);markOpened()}}>Xem gợi ý {revealedHints+1}</button>:data.hints.length?<small>Đã mở tất cả gợi ý.</small>:<small>Bài này chưa có gợi ý.</small>}</article>
   <article><h2>Lời giải từng bước</h2>{data.solutions.map(x=><details key={x.id} onToggle={e=>{if(e.currentTarget.open)markOpened()}}><summary>{x.orderIndex}. {x.title}</summary>{math(x.contentLatex)}</details>)}</article>
  </section>
  <section className="problem-completion">{session?.role==="student"?<><button className="primary" disabled={progressStatus==="COMPLETED"} onClick={()=>progressMutation.mutate({completed:true},{onSuccess:()=>setProgressStatus("COMPLETED")})}>{progressStatus==="COMPLETED"?"Đã ghi nhận hoàn thành":"Tôi đã tự giải xong bài này"}</button>{progressStatus==="IN_PROGRESS"&&<small>Tiến độ hiện tại: Đang làm</small>}</>:<a href="/">Đăng nhập Student để lưu tiến độ</a>}</section>
  <section><h2>Làm bài tương tự</h2><div className="similar-grid">{data.similar.map(x=><a key={x.relation} href={`/q/${x.problem.qrSlug}`}><small>{x.relation==="EASIER"?"Dễ hơn":x.relation==="EQUIVALENT"?"Tương đương":"Khó hơn"}</small><b>{x.problem.publicCode}</b><span>{x.problem.difficulty}</span></a>)}</div>{!data.similar.length&&<EmptyState text="Giáo viên chưa chọn bài tương tự."/>}</section>
 </main>;
}


function AppShell({ session, onLogout }: { session: AuthSession; onLogout: () => void }) {
  const [passwordOpen,setPasswordOpen]=useState(false);
  if (session.role === "teacher") return (
    <MainLayout session={session} onLogout={onLogout} onChangePassword={()=>setPasswordOpen(true)}>
      {activeSection => <>
        <TeacherDashboard session={session} activeSection={activeSection} />
        {passwordOpen&&<ChangePasswordDialog session={session} onClose={()=>setPasswordOpen(false)} onLogout={onLogout}/>}
      </>}
    </MainLayout>
  );
  if (session.role === "admin") return (
    <AdminShell session={session} onLogout={onLogout} onChangePassword={()=>setPasswordOpen(true)}>
      {(activeSection, onNavigate) => <>
        <AdminDashboard session={session} activeSection={activeSection} onNavigate={onNavigate} />
        {passwordOpen&&<ChangePasswordDialog session={session} onClose={()=>setPasswordOpen(false)} onLogout={onLogout}/>}
      </>}
    </AdminShell>
  );
  return (
    <StudentExperience session={session} onLogout={onLogout} />
  );
}

function AdminShell({session,children,onLogout,onChangePassword}:{session:AuthSession;children:(activeSection:string,onNavigate:(section:string)=>void)=>React.ReactNode;onLogout:()=>void;onChangePassword:()=>void}) {
 const [active,setActive]=useState("overview");
 useEffect(()=>{const navigate=(event:Event)=>setActive((event as CustomEvent<AdminDestination>).detail.section);window.addEventListener("math10:admin-navigation",navigate);return()=>window.removeEventListener("math10:admin-navigation",navigate)},[]);
 const [profileOpen,setProfileOpen]=useState(false);
 const items=[
  ["overview","Tổng quan",Home],
  ["users","Tài khoản",UserRound],
  ["programs","Chương trình",BookOpenCheck],
  ["course-instances","Khóa học",CalendarRange],
  ["classes","Lớp học",CheckCircle],
  ["textbooks","Sách giáo khoa",GraduationCap],
  ["documents","Tài liệu",FileText],
  ["dethi","Tạo đề",Calculator],
  ["exams","Kì thi",FileCheck],
  ["audit","Nhật ký",ClipboardList],
  ["finance","Tài chính",Database],
 ] as const;

 return <div className="admin-shell flex h-screen w-screen overflow-hidden bg-gray-50 font-sans text-gray-900">
  <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-full shrink-0 z-30">
   <div className="h-20 flex items-center px-6 border-b border-gray-50">
    <div className="flex items-center gap-3">
     <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm">
      M10
     </div>
     <div>
      <h1 className="font-bold text-gray-900 tracking-tight leading-tight text-base m-0">MATH10</h1>
      <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase m-0">Admin</p>
     </div>
    </div>
   </div>

   <nav aria-label="Điều hướng quản trị" className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
    {items.map(([id,label,Icon])=>(
     <button
      key={id}
      type="button"
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer border-0 text-left ${
       active===id
        ? "bg-emerald-50 text-emerald-600 font-semibold"
        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
      onClick={()=>{setActive(id);window.scrollTo({top:0,behavior:"smooth"})}}
     >
      <Icon className="w-5 h-5 shrink-0"/>
      <span>{label}</span>
     </button>
    ))}
   </nav>

   <div className="p-3 border-t border-gray-100">
    <button
     type="button"
     className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer border-0 text-left ${
      active==="settings"
       ? "bg-emerald-50 text-emerald-600 font-semibold"
       : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
     }`}
     onClick={()=>{setActive("settings");window.scrollTo({top:0,behavior:"smooth"})}}
    >
     <Settings className="w-5 h-5 shrink-0"/>
     <span>Cài đặt</span>
    </button>
   </div>
  </aside>

  <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden bg-[#f8fafc]">
   <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-8 shrink-0 z-20">
    <h2 className="text-xl font-bold text-gray-900 m-0">
     {items.find(([id])=>id===active)?.[1]||(active==="settings"?"Cài đặt":"Quản trị hệ thống")}
    </h2>
    <div className="flex items-center gap-6">
     <button
      type="button"
      className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors border-0 bg-transparent cursor-pointer"
      title="Thông báo"
      aria-label="Thông báo"
     >
      <Bell className="w-5 h-5"/>
      <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"/>
     </button>
     <div className="relative">
      <button
       type="button"
       className="flex items-center gap-3 cursor-pointer border-0 bg-transparent p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
       aria-expanded={profileOpen}
       aria-haspopup="menu"
       onClick={()=>setProfileOpen(v=>!v)}
      >
       <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-semibold text-sm">
        {(session.email[0]||"A").toUpperCase()}
       </div>
       <span className="text-sm font-medium text-gray-700">{session.email}</span>
       <ChevronDown className="w-4 h-4 text-gray-400"/>
      </button>
      {profileOpen&&(
       <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50 animate-in fade-in slide-in-from-top-1">
        <button
         type="button"
         className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors text-left"
         onClick={()=>{setProfileOpen(false);onChangePassword()}}
        >
         <KeyRound className="w-4 h-4 text-gray-500"/>
         Đổi mật khẩu
        </button>
        <button
         type="button"
         className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors text-left"
         onClick={()=>{setProfileOpen(false);onLogout()}}
        >
         <LogOut className="w-4 h-4 text-red-500"/>
         Đăng xuất
        </button>
       </div>
      )}
     </div>
    </div>
   </header>
   <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
    {children(active, setActive)}
   </div>
  </div>
 </div>;
}

const localDateKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;

function AdminOverviewCalendar({session}:{session:AuthSession}) {
  const today=new Date();
  const [month,setMonth]=useState(()=>new Date(today.getFullYear(),today.getMonth(),1));
  const visible=useMemo(()=>{
    const first=new Date(month.getFullYear(),month.getMonth(),1);
    const offset=(first.getDay()+6)%7;
    const count=offset+new Date(month.getFullYear(),month.getMonth()+1,0).getDate()>35?42:35;
    return Array.from({length:count},(_,index)=>new Date(month.getFullYear(),month.getMonth(),index-offset+1));
  },[month]);
  const from=localDateKey(visible[0]),to=localDateKey(visible[visible.length-1]);
  const eventsQuery=useQuery({queryKey:["admin-important-calendar",session.accessToken,from,to],queryFn:()=>getAdminCalendarEvents(session,from,to),staleTime:60_000});
  const events=eventsQuery.data??[];
  const monthLabel=new Intl.DateTimeFormat("vi-VN",{month:"long",year:"numeric"}).format(month);
  const move=(step:number)=>setMonth(value=>new Date(value.getFullYear(),value.getMonth()+step,1));
  const eventLabel=(event:AdminCalendarEvent)=>{
    const prefix=event.kind==="EXAM"?"Kiểm tra":event.kind==="ASSIGNMENT_DUE"?"Hạn nộp":event.kind==="COURSE_START"?"Bắt đầu khóa":"Kết thúc khóa";
    return `${prefix} · ${event.title}${event.class_name?` · ${event.class_name}`:""}`;
  };
  const eventClass=(kind:AdminCalendarEvent["kind"])=>kind==="EXAM"?"exam":kind==="ASSIGNMENT_DUE"?"due":kind==="COURSE_START"?"start":"end";
  return <article className="audit-panel admin-calendar-panel">
    <div className="admin-calendar-toolbar">
      <div><h2>Lịch học tập quan trọng</h2><p>Chỉ hiển thị kiểm tra, hạn bài bắt buộc và mốc khóa học đã gán cho lớp.</p></div>
      <div className="admin-calendar-actions"><button type="button" onClick={()=>move(-1)} aria-label="Tháng trước">‹</button><button type="button" onClick={()=>setMonth(new Date(today.getFullYear(),today.getMonth(),1))}>Hôm nay</button><button type="button" onClick={()=>move(1)} aria-label="Tháng sau">›</button></div>
    </div>
    <div className="admin-calendar-legend"><span className="exam">Kiểm tra</span><span className="due">Hạn nộp bắt buộc</span><span className="start">Mốc bắt đầu</span><span className="end">Mốc kết thúc</span></div>
    <strong className="admin-calendar-month">{monthLabel.charAt(0).toUpperCase()+monthLabel.slice(1)}</strong>
    <div className="admin-calendar-weekdays">{["T2","T3","T4","T5","T6","T7","CN"].map(x=><span key={x}>{x}</span>)}</div>
    <div className="admin-calendar-grid">{visible.map(date=>{
      const key=localDateKey(date),inMonth=date.getMonth()===month.getMonth(),isToday=key===localDateKey(today);
      const dayEvents=events.filter(event=>event.event_date===key);
      return <div key={key} className={`admin-calendar-day${inMonth?"":" other-month"}${isToday?" today":""}`}>
        <span className="admin-calendar-number">{date.getDate()}</span>
        <div className="admin-calendar-events">{dayEvents.slice(0,2).map(event=>{const label=eventLabel(event);return <span key={`${event.kind}-${event.source_id}`} className={`admin-calendar-event ${eventClass(event.kind)}`} title={label}>{label}</span>})}{dayEvents.length>2&&<small>+{dayEvents.length-2} sự kiện quan trọng</small>}</div>
      </div>;
    })}</div>
    {eventsQuery.isLoading&&<p className="admin-calendar-empty">Đang tải sự kiện quan trọng…</p>}
    {eventsQuery.isError&&<p className="admin-calendar-empty error">{messageOf(eventsQuery.error)}</p>}
    {!eventsQuery.isLoading&&!eventsQuery.isError&&!events.length&&<p className="admin-calendar-empty">Không có sự kiện quan trọng trong khoảng thời gian này.</p>}
  </article>;
}

function AdminDashboard({session,activeSection,onNavigate}:{session:AuthSession;activeSection:string;onNavigate?:(section:string)=>void}) {
  const metadata=useMetadata(session);
  const statsQuery=useQuery({queryKey:["admin-stats",session.accessToken],queryFn:()=>getAdminStats(session)});
  const logsQuery=useQuery({queryKey:["admin-audit-logs",session.accessToken],queryFn:()=>getAuditLogs(session,{size:6})});
  if(activeSection==="finance")return <AdminFinancePage session={session}/>;
  if(activeSection==="dethi")return <div className="p-6 overflow-auto"><DeThiWorkspace session={session}/></div>;
  if(activeSection==="exams")return <div className="p-6 overflow-auto"><ExamManager session={session} scope="COURSE"/></div>;
  const error=statsQuery.isError?messageOf(statsQuery.error):logsQuery.isError?messageOf(logsQuery.error):"";
  if (activeSection === "programs") {
    return (
      <div className="flex-1 min-h-0 h-full w-full overflow-hidden flex flex-col">
        {error && <div className="api-error">{error}</div>}
        <CurriculumWorkspace session={session} metadata={metadata} />
      </div>
    );
  }

  if (activeSection === "course-instances") {
    return (
      <div className="flex-1 min-h-0 h-full w-full overflow-hidden flex flex-col">
        {error && <div className="api-error">{error}</div>}
        <KhoaHocManagement session={session} />
      </div>
    );
  }

  if (activeSection === "classes") {
    return (
      <div className="flex-1 min-h-0 h-full w-full overflow-hidden flex flex-col">
        {error && <div className="api-error">{error}</div>}
        <AdminClasses session={session} />
      </div>
    );
  }

  if (activeSection === "documents") {
    return (
      <div className="flex-1 min-h-0 h-full w-full overflow-hidden flex flex-col">
        {error && <div className="api-error">{error}</div>}
        <DocumentManagement session={session} />
      </div>
    );
  }

  if (activeSection === "users") {
    return (
      <div className="flex-1 min-h-0 h-full w-full overflow-hidden flex flex-col bg-slate-50">
        {error && <div className="api-error">{error}</div>}
        <UserAccountsPage session={session} />
      </div>
    );
  }

  if (activeSection === "overview") {
    return <AdminOverview session={session} onNavigate={onNavigate} />;
  }

  return (
    <div className="flex-1 min-h-0 h-full w-full overflow-y-auto bg-[#f8fafc] p-6 lg:p-8">
      {error && <div className="api-error mb-4">{error}</div>}
      {activeSection === "textbooks" && <TextbookManagement session={session} />}
      {activeSection === "audit" && <AuditManagement session={session} />}
      {activeSection === "settings" && <AdminSystemSettings session={session} metadata={metadata} />}
    </div>
  );
}

function AdminSystemSettings({session,metadata}:{session:AuthSession;metadata:Metadata|null}) {
 void metadata;
 return <ProfileSettings session={session}/>;
}

/** Dòng tổng quan (snake_case từ SQL) đổi về hình dạng Classroom mà các panel sẵn có đang dùng. */
const asClassroom=(row:AdminClassOverviewRow):Classroom=>({id:row.id,code:row.code,name:row.name,gradeId:row.grade_id,status:row.status as Classroom["status"],teacherCount:Number(row.teacher_count),studentCount:Number(row.student_count),courseCount:Number(row.course_count),createdAt:row.created_at,description:row.description,curriculumCount:Number(row.curriculum_count),documentCount:Number(row.document_count),startDate:row.start_date});
/** Một lớp có thể có nhiều giáo viên. Mỗi giáo viên cần có nhóm riêng thay vì coi chuỗi tên đã nối là một người. */
const groupClassesByTeacher=(rows:AdminClassOverviewRow[])=>[...rows.reduce((groups,row)=>{
 const teachers=row.teacher_names?.split(", ").map(name=>name.trim()).filter(Boolean)??[];
 for(const teacher of teachers.length?teachers:[""])groups.set(teacher,[...(groups.get(teacher)??[]),row]);
 return groups;
},new Map<string,AdminClassOverviewRow[]>()).entries()].sort((a,b)=>a[0]?(b[0]?a[0].localeCompare(b[0],"vi"):1):-1);
/** Lớp do chính giáo viên lập trong 7 ngày gần đây — đây là cách Admin thấy có lớp mới, khớp với dòng audit ghi lúc tạo lớp. */
const isNewTeacherClass=(row:AdminClassOverviewRow)=>row.created_by_role==="TEACHER"&&Date.now()-new Date(row.created_at).getTime()<7*86400000;

function AdminClasses({session}:{session:AuthSession}){
 const metadata=useMetadata(session);
 const queryClient=useQueryClient();
 const [form,setForm]=useState<{code:string;name:string;gradeId:number;status:string;startDate?:string}>({code:"",name:"",gradeId:0,status:"",startDate:""}),[editing,setEditing]=useState<number|null>(null),[selected,setSelected]=useState<Classroom|null>(null);
 const [search,setSearch]=useState(""),[gradeId,setGradeId]=useState(0),[status,setStatus]=useState(""),[formOpen,setFormOpen]=useState(false),[classMenu,setClassMenu]=useState<number|null>(null);
 const [mode,setMode]=useState<"teacher"|"table">("table"),[expandedTeacher,setExpandedTeacher]=useState<string|null>(null);
 const classesQuery=useQuery({queryKey:["admin-classes",session.accessToken,search,gradeId,status],queryFn:async()=>{const [overview,nextGrades]=await Promise.all([getAdminClassOverview(session,{search,gradeId:gradeId||undefined,status}),getGrades(session)]);return {overview,grades:nextGrades}}});
 const overview=classesQuery.data?.overview??[],grades=classesQuery.data?.grades??[];
 useEffect(()=>{const target=getAdminDestination();if(target?.section==="classes"&&classesQuery.data)setSelected(current=>current??classesQuery.data!.overview.map(asClassroom).find(x=>x.id===target.classId)??null)},[classesQuery.data]);
 const rows=overview.map(asClassroom),teacherNames=Object.fromEntries(overview.map(row=>[row.id,row.teacher_names??""])) as Record<number,string>;
 /* Gom lớp theo giáo viên phụ trách; nhóm chưa phân công luôn đứng đầu vì đó là việc Admin cần xử lý. */
 const teacherGroups=groupClassesByTeacher(overview);
 const invalidate=()=>queryClient.invalidateQueries({queryKey:["admin-classes"]});
 const createMutation=useMutation({mutationFn:(input:ClassroomInput)=>createClass(session,input),onSuccess:invalidate});
 const updateMutation=useMutation({mutationFn:({id,input}:{id:number;input:ClassroomInput})=>updateClass(session,id,input),onSuccess:invalidate});
 const deleteMutation=useMutation({mutationFn:(id:number)=>deleteClass(session,id),onSuccess:invalidate});
 useEffect(()=>{const data=classesQuery.data;if(!data)return;setSelected(current=>current?data.overview.map(asClassroom).find(x=>x.id===current.id)??null:null);if(!form.gradeId&&data.grades[0])setForm(x=>({...x,gradeId:data.grades[0].id}))},[classesQuery.data]);
 useEffect(()=>{if(!editing)setForm(x=>({...x,status:x.status||firstMetadataValue(metadata,"classStatuses")}))},[editing,metadata]);
 const error=classesQuery.isError?messageOf(classesQuery.error):createMutation.isError?messageOf(createMutation.error):updateMutation.isError?messageOf(updateMutation.error):deleteMutation.isError?messageOf(deleteMutation.error):"";
 const reset=()=>{setEditing(null);setForm({code:"",name:"",gradeId:grades[0]?.id||0,status:firstMetadataValue(metadata,"classStatuses"),startDate:""});setFormOpen(false)};
 const save=async(e:React.FormEvent)=>{e.preventDefault();try{editing?await updateMutation.mutateAsync({id:editing,input:form as ClassroomInput}):await createMutation.mutateAsync(form as ClassroomInput);reset()}catch{/* lỗi đã có trong mutation state */}};
 const edit=(row:Classroom)=>{setEditing(row.id);setForm({code:row.code,name:row.name,gradeId:row.gradeId,status:row.status,startDate:row.startDate||""});setFormOpen(true)};
 const archive=async(row:Classroom)=>{if(!confirm(`Xóa lớp “${row.name}”? Dữ liệu lịch sử vẫn được giữ lại.`))return;try{await deleteMutation.mutateAsync(row.id);if(selected?.id===row.id)setSelected(null)}catch{/* lỗi đã có trong mutation state */}};
 const gradeName=(id:number)=>grades.find(x=>x.id===id)?.name??`Khối ${id}`,statusName=(value:string)=>metadataOptions(metadata,"classStatuses").find(x=>x.value===value)?.label??value;
 const now=new Date(),schoolYearStart=now.getMonth()>=7?now.getFullYear():now.getFullYear()-1,schoolYear=`${schoolYearStart}–${schoolYearStart+1}`;
  const clrColors=['#176b50','#1d4ed8','#7c3aed','#b45309','#dc2626'];
  return <section className="classroom-module"><header className="clr-page-head"><div className="clr-page-icon"><GraduationCap size={26}/></div><div className="clr-page-title"><h1>Quản lý lớp học</h1><p>Chọn một lớp để xem thông tin, học sinh và phân công giáo viên.</p></div><div className="clr-page-search"><Search size={14}/><input placeholder="Tìm lớp, giáo viên..." value={search} onChange={e=>setSearch(e.target.value)}/></div></header>{error&&<div className="accounts-error" style={{margin:"0 24px"}}><span>{error}</span><button onClick={()=>void classesQuery.refetch()}>Thử lại</button></div>}<div className="clr-body"><aside className="clr-left"><div className="clr-left-head"><span>Danh sách lớp học</span><button className="clr-head-btn" onClick={()=>{reset();setFormOpen(true)}}><Plus size={13}/>Thêm lớp</button></div><div className="clr-left-filters"><select value={gradeId} onChange={e=>setGradeId(Number(e.target.value))}><option value={0}>Tất cả khối</option>{grades.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Mọi trạng thái</option>{metadataOptions(metadata,"classStatuses").map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></div><div className="clr-left-search"><Search size={12}/><input placeholder="Tìm lớp học..." value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="clr-left-count">Tổng {rows.length} lớp học</div><div className="clr-class-list">{rows.map(row=><div className={`clr-class-item ${selected?.id===row.id?"active":""}`} key={row.id} onClick={()=>setSelected(row)}><div className="clr-class-icon" style={{background:clrColors[row.gradeId%clrColors.length]}}>{row.name.replace(/[^A-Z0-9]/gi,"").slice(0,2)||"L"}</div><div className="clr-class-info"><b>{row.name}</b><small>{gradeName(row.gradeId)} · {teacherNames[row.id]||"Chưa phân công"}</small></div><span className={`clr-status-badge ${row.status==="ACTIVE"?"pub":"dft"}`}>{statusName(row.status)}</span><button className="clr-item-dots" onClick={e=>{e.stopPropagation();setClassMenu(classMenu===row.id?null:row.id)}}>⋯</button>{classMenu===row.id&&<div className="clr-item-menu"><button onClick={e=>{e.stopPropagation();setClassMenu(null);edit(row)}}>Sửa</button><button className="danger" onClick={e=>{e.stopPropagation();setClassMenu(null);void archive(row)}}>Xóa</button></div>}</div>)}{!rows.length&&<div className="clr-list-empty">Không có lớp phù hợp.</div>}</div><div className="clr-left-footer">{rows.length} lớp · {teacherGroups.filter(([t])=>t).length} giáo viên phụ trách</div></aside><main className="clr-right">{selected?<AdminClassWorkspace key={selected.id} session={session} classroom={selected} gradeLabel={gradeName(selected.gradeId)} statusLabel={statusName(selected.status)} onClose={()=>setSelected(null)}/>:<div className="clr-no-selection"><div className="clr-no-sel-icon"><GraduationCap size={28}/></div><h3>Chọn một lớp học</h3><p>Chọn lớp từ danh sách bên trái để xem thành viên, chương trình học và tài liệu phân công.</p></div>}</main></div>{formOpen&&<div className="accounts-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)reset()}}><aside className="account-panel"><header><div><p>{editing?"CHỈNH SỬA LỚP":"TẠO LỚP MỚI"}</p><h2>{editing?form.name:"Thông tin lớp học"}</h2></div><button onClick={reset}>×</button></header><form onSubmit={save}><label>Mã lớp<input required maxLength={30} value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></label><label>Tên lớp<input required maxLength={120} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Khối<select value={form.gradeId} onChange={e=>setForm({...form,gradeId:Number(e.target.value)})}>{grades.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Trạng thái<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{metadataOptions(metadata,"classStatuses").map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label><label>Ngày khai giảng (bắt đầu học)<input type="date" value={form.startDate||""} onChange={e=>setForm({...form,startDate:e.target.value})}/></label><footer><button type="button" className="secondary-action" onClick={reset}>Hủy</button><button className="primary-action">{editing?"Lưu thay đổi":"Tạo lớp"}</button></footer></form></aside></div>}</section>;
}

function AdminClassWorkspace(props:{session:AuthSession;classroom:Classroom;gradeLabel:string;statusLabel:string;onClose:()=>void}){
 return <ClassDetail session={props.session} classroom={props.classroom} onClose={props.onClose}
   membersPanel={<ClassEnrollmentPanel {...props} embeddedSection="members"/>}
   setupPanel={<details className="border border-outline-variant rounded-xl bg-surface-container-lowest p-4"><summary className="font-semibold text-primary cursor-pointer">Thiết lập khóa học và thời khóa biểu</summary><ClassEnrollmentPanel {...props} embeddedSection="curriculum"/><ClassSchedulePanel session={props.session} classroom={props.classroom}/></details>}/>;
}

function ClassEnrollmentPanel({session,classroom,gradeLabel,statusLabel,onClose,embeddedSection}:{session:AuthSession;classroom:Classroom;gradeLabel:string;statusLabel:string;onClose:()=>void;embeddedSection?:"members"|"curriculum"}){
 const queryClient=useQueryClient();
 const [section,setSection]=useState<"members"|"curriculum"|"schedule"|"materials">(embeddedSection??"members"),[filter,setFilter]=useState<"all"|"students"|"teachers">("all"),[search,setSearch]=useState("");
 const [addOpen,setAddOpen]=useState(false),[addKind,setAddKind]=useState<"student"|"teacher"|null>(null),[candidateId,setCandidateId]=useState(0),[selectedStudentIds,setSelectedStudentIds]=useState<number[]>([]),[candidateSearch,setCandidateSearch]=useState(""),[rowMenu,setRowMenu]=useState<string|null>(null);
 const [courseDialog,setCourseDialog]=useState(false),[courseSearch,setCourseSearch]=useState(""),[chosenCourses,setChosenCourses]=useState<number[]>([]);
 useEffect(()=>{setAddOpen(false);setAddKind(null);setCandidateId(0);setSelectedStudentIds([]);setCandidateSearch("");setRowMenu(null)},[classroom.id]);
 const key=["class-members",session.accessToken,classroom.id];
 const query=useQuery({queryKey:key,queryFn:async()=>{const [teachers,students,courses,users,allCourses,roster]=await Promise.all([getEnrollments(session,"class-teachers",classroom.id),getEnrollments(session,"class-students",classroom.id),getEnrollments(session,"class-courses",classroom.id),getUsers(session),getCourseInstances(session),getClassRoster(session,classroom.id)]);return {teachers,students,courses,users,allCourses,roster}}});
 const teachers=query.data?.teachers??[],students=query.data?.students??[],courses=query.data?.courses??[],users=query.data?.users??[],allCourses=query.data?.allCourses??[],roster=query.data?.roster??[];
 const invalidate=()=>queryClient.invalidateQueries({queryKey:key});
 const addMutation=useMutation({mutationFn:({kind,ids}:{kind:"student"|"teacher";ids:number[]})=>Promise.all(ids.map(id=>kind==="student"?addRosterStudent(session,classroom.id,{userId:id}):addEnrollment(session,"class-teachers",{classId:classroom.id,userId:id}))),onSuccess:()=>{setCandidateId(0);setSelectedStudentIds([]);setCandidateSearch("");setAddKind(null);setAddOpen(false)},onSettled:()=>void invalidate()});
 const removeMutation=useMutation({mutationFn:({kind,id}:{kind:"student"|"teacher";id:number})=>removeEnrollment(session,kind==="student"?"class-students":"class-teachers",id),onSuccess:()=>{setRowMenu(null);void invalidate()}});
 const assignCourses=useMutation({mutationFn:()=>Promise.all(chosenCourses.map(courseInstanceId=>addEnrollment(session,"class-courses",{classId:classroom.id,courseInstanceId}))),onSuccess:()=>{setCourseDialog(false);setChosenCourses([]);setCourseSearch("");void invalidate()}});
 const removeCourse=useMutation({mutationFn:(id:number)=>removeEnrollment(session,"class-courses",id),onSuccess:()=>void invalidate()});
 const rows=[...students.map((x,index)=>({key:`s-${x.id}`,id:x.id,userId:x.userId,kind:"student" as const,name:x.label,role:"Học sinh",assignment:classroom.name,status:"Hoạt động",isHomeroom:false,index})),...teachers.map((x,index)=>({key:`t-${x.id}`,id:x.id,userId:x.userId,kind:"teacher" as const,name:x.label,role:index===0?"GVCN":"Giáo viên",assignment:index===0?`Chủ nhiệm ${classroom.name}`:"GV bộ môn · Toán",status:"Hoạt động",isHomeroom:index===0,index}))];
 const visible=rows.filter(row=>(filter==="all"||filter==="students"&&row.kind==="student"||filter==="teachers"&&row.kind==="teacher")&&row.name.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")));
 const candidates=users.filter(user=>user.roleCode===(addKind==="student"?"STUDENT":"TEACHER")&&!rows.some(row=>row.userId===user.id));
 const visibleStudentCandidates=candidates.filter(user=>`${user.fullName} ${user.username} ${user.email}`.toLocaleLowerCase("vi").includes(candidateSearch.trim().toLocaleLowerCase("vi")));
 const availableCourses=allCourses.filter(course=>!courses.some(link=>link.courseInstanceId===course.id)&&`${course.name} ${course.template_name}`.toLocaleLowerCase("vi").includes(courseSearch.trim().toLocaleLowerCase("vi")));
 const schoolYear=(()=>{const now=new Date(),year=now.getMonth()>=7?now.getFullYear():now.getFullYear()-1;return `${year}–${year+1}`})();
 const error=query.isError?messageOf(query.error):addMutation.isError?messageOf(addMutation.error):removeMutation.isError?messageOf(removeMutation.error):"";
 const dateOfBirth=(value:string|null)=>{if(!value)return "—";const [year,month,day]=value.slice(0,10).split("-");return year&&month&&day?`${day}/${month}/${year}`:value};
 const genderLabel=(value:string|null)=>{const normalized=value?.trim().toLocaleUpperCase("vi");if(!normalized)return "—";if(["MALE","NAM","M"].includes(normalized))return "Nam";if(["FEMALE","NỮ","NU","F"].includes(normalized))return "Nữ";return value!};
 const printRoster=()=>{const className="printing-class-roster";const cleanup=()=>document.body.classList.remove(className);document.body.classList.add(className);window.addEventListener("afterprint",cleanup,{once:true});try{window.print()}finally{window.setTimeout(cleanup,0)}};
 return <><aside className={embeddedSection?"class-embedded-management":"class-detail-panel class-members-panel"}>{!embeddedSection&&<><header><div><small>CHI TIẾT LỚP</small><h2>{classroom.name}</h2><span>{classroom.code} · {gradeLabel} · {schoolYear}</span><p>{students.length} học sinh · {teachers.length} giáo viên · {statusLabel}</p></div><button aria-label="Đóng panel" onClick={onClose}>×</button></header>
  <nav className="class-section-tabs"><button className={section==="members"?"active":""} onClick={()=>setSection("members")}>Thành viên lớp</button><button className={section==="curriculum"?"active":""} onClick={()=>setSection("curriculum")}>Chương trình học</button><button className={section==="schedule"?"active":""} onClick={()=>setSection("schedule")}>Thời khóa biểu</button><button className={section==="materials"?"active":""} onClick={()=>setSection("materials")}>Học liệu</button></nav></>}
  {error&&<div className="accounts-error">{error}</div>}
  {section==="members"?<div className="class-members-content"><div className="member-filter-tabs"><button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>Tất cả <b>{rows.length}</b></button><button className={filter==="students"?"active":""} onClick={()=>setFilter("students")}>Học sinh <b>{students.length}</b></button><button className={filter==="teachers"?"active":""} onClick={()=>setFilter("teachers")}>Giáo viên <b>{teachers.length}</b></button></div><div className="member-toolbar"><input aria-label="Tìm thành viên" placeholder="Tìm kiếm thành viên..." value={search} onChange={e=>setSearch(e.target.value)}/><button className="roster-print-button" disabled={!roster.length} onClick={printRoster}><Printer size={15}/> In danh sách lớp</button><div className="add-member"><button className="primary-action" onClick={()=>setAddOpen(x=>!x)}><Plus size={15}/> Thêm thành viên</button>{addOpen&&<div className="add-member-menu"><button onClick={()=>{setAddKind("student");setCandidateId(0);setSelectedStudentIds([]);setCandidateSearch("");setAddOpen(false)}}>Thêm học sinh</button><button onClick={()=>{setAddKind("teacher");setCandidateId(0);setSelectedStudentIds([]);setCandidateSearch("");setAddOpen(false)}}>Phân công giáo viên</button></div>}</div></div>
   {addKind==="student"?<section className="member-student-picker"><header><div><b>Thêm học sinh vào {classroom.name}</b><small>Có thể chọn và thêm nhiều học sinh cùng lúc.</small></div><button aria-label="Đóng" onClick={()=>{setAddKind(null);setSelectedStudentIds([]);setCandidateSearch("")}}>×</button></header><label className="member-candidate-search"><Search size={15}/><input autoFocus placeholder="Tìm theo họ tên, tài khoản hoặc email..." value={candidateSearch} onChange={e=>setCandidateSearch(e.target.value)}/></label><div className="member-picker-controls"><label><input type="checkbox" checked={visibleStudentCandidates.length>0&&visibleStudentCandidates.every(user=>selectedStudentIds.includes(user.id))} onChange={e=>setSelectedStudentIds(current=>e.target.checked?[...new Set([...current,...visibleStudentCandidates.map(user=>user.id)])]:current.filter(id=>!visibleStudentCandidates.some(user=>user.id===id)))}/> Chọn tất cả kết quả</label><span>{visibleStudentCandidates.length} học sinh có thể thêm</span></div><div className="member-candidate-list">{visibleStudentCandidates.map(user=><label key={user.id} className={selectedStudentIds.includes(user.id)?"selected":""}><input type="checkbox" checked={selectedStudentIds.includes(user.id)} onChange={()=>setSelectedStudentIds(current=>current.includes(user.id)?current.filter(id=>id!==user.id):[...current,user.id])}/><span><b>{user.fullName}</b><small>{user.username||"Chưa có tài khoản"} · {user.email}</small></span></label>)}{!visibleStudentCandidates.length&&<p>Không còn học sinh phù hợp để thêm.</p>}</div><footer><span>Đã chọn <b>{selectedStudentIds.length}</b> học sinh</span><div><button onClick={()=>{setAddKind(null);setSelectedStudentIds([]);setCandidateSearch("")}}>Hủy</button><button className="primary-action" disabled={!selectedStudentIds.length||addMutation.isPending} onClick={()=>addMutation.mutate({kind:"student",ids:selectedStudentIds})}>{addMutation.isPending?"Đang thêm…":`Thêm ${selectedStudentIds.length||""} học sinh`}</button></div></footer></section>:addKind==="teacher"?<div className="member-add-form"><select value={candidateId} onChange={e=>setCandidateId(Number(e.target.value))}><option value={0}>Chọn giáo viên</option>{candidates.map(user=><option key={user.id} value={user.id}>{user.fullName} · {user.username}</option>)}</select><button disabled={!candidateId||addMutation.isPending} onClick={()=>addMutation.mutate({kind:"teacher",ids:[candidateId]})}>{addMutation.isPending?"Đang thêm…":"Xác nhận"}</button><button onClick={()=>setAddKind(null)}>Hủy</button></div>:null}
   <div className="member-table"><table><thead><tr><th>Tên</th><th>Vai trò</th><th>Phân công / Lớp</th><th>Trạng thái</th><th aria-label="Thao tác"/></tr></thead><tbody>{visible.map(row=><tr key={row.key}><td><b>{row.name}</b><small>{users.find(user=>user.id===row.userId)?.username??"—"}</small></td><td><span className={`member-role ${row.isHomeroom?"homeroom":""}`}>{row.role}</span></td><td>{row.assignment}</td><td><span className="member-active"><i/> {row.status}</span></td><td className="member-row-action"><button aria-label={`Thao tác với ${row.name}`} onClick={()=>setRowMenu(rowMenu===row.key?null:row.key)}>⋯</button>{rowMenu===row.key&&<div className="member-row-menu"><button onClick={()=>alert(`${row.name}\n${row.role}\n${row.assignment}`)}>Xem thông tin</button><button onClick={()=>alert(row.kind==="student"?"Chọn lớp đích tại màn quản lý lớp để chuyển học sinh.":"Có thể cập nhật phân công môn học khi dữ liệu bộ môn được cấu hình.")}>{row.kind==="student"?"Chuyển lớp":"Sửa phân công"}</button><button className="danger" onClick={()=>{if(confirm(`${row.kind==="student"?"Xóa":"Gỡ"} ${row.name} khỏi lớp ${classroom.name}?`))removeMutation.mutate({kind:row.kind,id:row.id})}}>{row.kind==="student"?"Xóa khỏi lớp":"Gỡ khỏi lớp"}</button></div>}</td></tr>)}</tbody></table>{!visible.length&&<p className="member-empty">Không có thành viên phù hợp.</p>}</div></div>:section==="curriculum"?<CourseAssignments courses={courses} allCourses={allCourses} gradeLabel={gradeLabel} onAssign={()=>setCourseDialog(true)} onRemove={id=>{if(confirm("Gỡ khóa học khỏi lớp này?"))removeCourse.mutate(id)}}/>:section==="schedule"?<ClassSchedulePanel session={session} classroom={classroom}/>:<div className="class-section-placeholder"><h3>Học liệu</h3><p>Khu vực này sử dụng dữ liệu của lớp hiện tại.</p></div>}
 </aside><section className="class-roster-print" aria-hidden="true"><header><h1>DANH SÁCH HỌC SINH</h1><p><b>Lớp:</b> {classroom.name} ({classroom.code})</p><p><b>Khối:</b> {gradeLabel} · <b>Năm học:</b> {schoolYear} · <b>Sĩ số:</b> {roster.length}</p></header><table><thead><tr><th>STT</th><th>Họ và tên</th><th>Ngày sinh</th><th>Giới tính</th><th>Lớp học</th></tr></thead><tbody>{roster.map((student:RosterStudent,index:number)=><tr key={student.id}><td>{index+1}</td><td>{student.full_name}</td><td>{dateOfBirth(student.date_of_birth)}</td><td>{genderLabel(student.gender)}</td><td>{classroom.name}</td></tr>)}</tbody></table><footer>Ngày in: {new Date().toLocaleDateString("vi-VN")}</footer></section>{courseDialog&&<div className="course-assign-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setCourseDialog(false)}}><section className="course-assign-dialog"><header><div><small>GÁN KHÓA HỌC CHO LỚP</small><h2>{classroom.name}</h2></div><button aria-label="Đóng" onClick={()=>setCourseDialog(false)}>×</button></header><div className="course-assign-filters"><label>Tìm khóa học<input autoFocus placeholder="Tìm theo tên hoặc mã..." value={courseSearch} onChange={e=>setCourseSearch(e.target.value)}/></label><label>Khối<select><option>{gradeLabel}</option></select></label><label>Môn học<select><option>Tất cả môn</option></select></label></div><div className="course-choice-list">{availableCourses.map(course=><label key={course.id}><input type="checkbox" checked={chosenCourses.includes(course.id)} onChange={()=>setChosenCourses(current=>current.includes(course.id)?current.filter(id=>id!==course.id):[...current,course.id])}/><span><b>{course.name}</b><small>Mã: {course.template_name} · {gradeLabel} · {course.school_year}</small></span></label>)}{!availableCourses.length&&<p>Không có khóa học phù hợp để gán.</p>}</div><footer><button onClick={()=>setCourseDialog(false)}>Hủy</button><button disabled={!chosenCourses.length||assignCourses.isPending} onClick={()=>assignCourses.mutate()}>{assignCourses.isPending?"Đang gán…":"Gán khóa học"}</button></footer></section></div>}</>;
}

function CourseAssignments({courses,allCourses,gradeLabel,onAssign,onRemove}:{courses:Enrollment[];allCourses:CourseInstance[];gradeLabel:string;onAssign:()=>void;onRemove:(id:number)=>void}){
 return <div className="course-assignments"><header><div><h3>Chương trình học</h3><p>{courses.length?`${courses.length} khóa học đang được gán cho lớp.`:"Chưa có chương trình học"}</p></div><button className="primary-action" onClick={onAssign}>+ {courses.length?"Gán thêm":"Gán khóa học"}</button></header>{!courses.length?<div className="course-empty"><h4>Lớp này chưa được gán khóa học nào.</h4><p>Gán khóa học để học sinh có thể truy cập chương trình học.</p><button className="primary-action" onClick={onAssign}>+ Gán khóa học</button></div>:<div className="assigned-course-list">{courses.map(link=>{const course=allCourses.find(item=>item.id===link.courseInstanceId);return <article key={link.id}><div><h4>{course?.name??link.label}</h4><p>{course?.template_name??"Chưa có mã"} · {gradeLabel} · {course?.status==="PUBLISHED"?"Đang áp dụng":course?.status??"Đã gán"}</p><small>{course?.school_year??"Chưa có năm học"}</small></div><div className="assigned-course-actions"><button onClick={()=>alert(`Khóa học: ${course?.name??link.label}`)}>Xem chương trình</button><button onClick={()=>onRemove(link.id)}>Gỡ khỏi lớp</button></div></article>})}</div>}</div>;
}

function LegacyClassEnrollmentPanel({session,classroom,gradeLabel,statusLabel,onClose}:{session:AuthSession;classroom:Classroom;gradeLabel:string;statusLabel:string;onClose:()=>void}){
 const queryClient=useQueryClient();
 const [teacherId,setTeacherId]=useState(0),[studentId,setStudentId]=useState(0),[courseInstanceId,setCourseInstanceId]=useState(0);
 const [tab,setTab]=useState<"students"|"assignments"|"settings">("students"),[search,setSearch]=useState("");
 const ENROLLMENT_QUERY_KEY=["class-enrollment",session.accessToken,classroom.id];
 const enrollmentQuery=useQuery({queryKey:ENROLLMENT_QUERY_KEY,queryFn:async()=>{const [t,st,c,u,allCourses,g]=await Promise.all([getEnrollments(session,"class-teachers",classroom.id),getEnrollments(session,"class-students",classroom.id),getEnrollments(session,"class-courses",classroom.id),getUsers(session),getCourseInstances(session),getGradebook(session,classroom.id)]);return {teachers:t,students:st,assignedCourses:c,users:u,courses:allCourses,gradebook:g}}});
 const teachers=enrollmentQuery.data?.teachers??[],students=enrollmentQuery.data?.students??[],assignedCourses=enrollmentQuery.data?.assignedCourses??[];
 const users=enrollmentQuery.data?.users??[],courses=enrollmentQuery.data?.courses??[],gradebook=enrollmentQuery.data?.gradebook??[];
 const invalidate=()=>queryClient.invalidateQueries({queryKey:ENROLLMENT_QUERY_KEY});
 const addMutation=useMutation({mutationFn:({type,id}:{type:"class-teachers"|"class-students"|"class-courses";id:number})=>addEnrollment(session,type,{classId:classroom.id,...(type==="class-courses"?{courseInstanceId:id}:{userId:id})}),onSuccess:invalidate});
 const removeMutation=useMutation({mutationFn:({type,id}:{type:"class-teachers"|"class-students"|"class-courses";id:number})=>removeEnrollment(session,type,id),onSuccess:invalidate});
 const error=enrollmentQuery.isError?messageOf(enrollmentQuery.error):addMutation.isError?messageOf(addMutation.error):removeMutation.isError?messageOf(removeMutation.error):"";
 const add=(type:"class-teachers"|"class-students"|"class-courses",id:number)=>{if(!id)return;addMutation.mutate({type,id})};
 const progress=new Map<number,{sum:number;count:number}>();gradebook.forEach(row=>{const value=progress.get(row.student_id)??{sum:0,count:0};value.sum+=Number(row.completion_percent)||0;value.count+=1;progress.set(row.student_id,value)});
 const visibleStudents=students.filter(x=>x.label.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")));
 return <aside className="class-detail-panel"><header><div><h2>{classroom.name}</h2><span>{classroom.code} · {classroom.status}</span></div><button aria-label="Đóng panel" onClick={onClose}>×</button></header><nav><button className={tab==="students"?"active":""} onClick={()=>setTab("students")}>Học sinh <b>{students.length}</b></button><button className={tab==="assignments"?"active":""} onClick={()=>setTab("assignments")}>Phân công</button><button className={tab==="settings"?"active":""} onClick={()=>setTab("settings")}>Cài đặt</button></nav>{error&&<div className="accounts-error">{error}</div>}{tab==="students"&&<div className="class-detail-content"><div className="detail-toolbar"><input placeholder="Tìm học sinh…" value={search} onChange={e=>setSearch(e.target.value)}/><select value={studentId} onChange={e=>setStudentId(Number(e.target.value))}><option value={0}>Chọn học sinh để thêm</option>{users.filter(x=>x.roleCode==="STUDENT"&&!students.some(s=>s.userId===x.id)).map(x=><option key={x.id} value={x.id}>{x.fullName}</option>)}</select><button className="primary-action" disabled={!studentId} onClick={()=>void add("class-students",studentId)}>Thêm học sinh</button></div><div className="detail-table"><table><thead><tr><th>STT</th><th>Họ và tên</th><th>Tiến độ</th><th>Thao tác</th></tr></thead><tbody>{visibleStudents.map((row,index)=>{const p=progress.get(row.userId??0),percent=p?Math.round(p.sum/Math.max(p.count,1)):0;return <tr key={row.id}><td className="numeric">{index+1}</td><td><b>{row.label}</b><small>{users.find(x=>x.id===row.userId)?.username??"—"}</small></td><td><div className="student-progress"><span style={{width:`${Math.min(percent,100)}%`}}/><b>{percent}%</b></div></td><td><button onClick={()=>removeMutation.mutate({type:"class-students",id:row.id})}>Gỡ</button></td></tr>})}</tbody></table>{!visibleStudents.length&&<EmptyState text="Chưa có học sinh phù hợp."/>}</div></div>}{tab==="assignments"&&<div className="class-detail-content assignment-groups"><article><h3>Giáo viên phụ trách</h3><div className="detail-add"><select value={teacherId} onChange={e=>setTeacherId(Number(e.target.value))}><option value={0}>Chọn giáo viên</option>{users.filter(x=>x.roleCode==="TEACHER"&&!teachers.some(t=>t.userId===x.id)).map(x=><option key={x.id} value={x.id}>{x.fullName}</option>)}</select><button onClick={()=>void add("class-teachers",teacherId)}>Phân công</button></div>{teachers.map(x=><div className="assignment-row" key={x.id}><b>{x.label}</b><button onClick={()=>removeMutation.mutate({type:"class-teachers",id:x.id})}>Gỡ</button></div>)}</article><article><h3>Khóa học</h3><div className="detail-add"><select value={courseInstanceId} onChange={e=>setCourseInstanceId(Number(e.target.value))}><option value={0}>Chọn khóa</option>{courses.filter(x=>!assignedCourses.some(c=>c.courseInstanceId===x.id)).map(x=><option key={x.id} value={x.id}>{x.name} · {x.school_year}{x.status==="DRAFT"?" (nháp)":""}</option>)}</select><button onClick={()=>void add("class-courses",courseInstanceId)}>Gán khóa</button></div>{assignedCourses.map(x=><div className="assignment-row" key={x.id}><b>{x.label}</b><button onClick={()=>removeMutation.mutate({type:"class-courses",id:x.id})}>Gỡ</button></div>)}</article></div>}{tab==="settings"&&<div className="class-detail-content privacy-note"><h3>Quyền riêng tư</h3><p>Quản trị viên chỉ xem tiến độ tổng hợp. Câu trả lời cá nhân và ghi chú riêng của giáo viên không được hiển thị.</p><h3>Dữ liệu lớp</h3><dl><div><dt>Giáo viên</dt><dd>{teachers.length}</dd></div><div><dt>Học sinh</dt><dd>{students.length}</dd></div><div><dt>Khóa học</dt><dd>{assignedCourses.length}</dd></div></dl></div>}</aside>;
}


type TextbookOffsetSlot = {
 offset: number;
 onChange: (value: number) => void;
 onSave: () => void;
 onCancel: () => void;
};

type TextbookCardProps = {
 title: string;
 fileUrl: string;
 thumbnailUrl?: string | null;
 accessToken?: string;
 totalPages: number | null;
 bookPageStart: number;
 pdfPageStart: number;
 isPublished: boolean;
 canStudentView: boolean;
 status: string;
 typeLabel: string;
 onRead: () => void;
 onMapPage: () => void;
 onEdit: () => void;
 onHide: () => void;
 onShow: () => void;
 onPublish: () => void;
 onDelete: () => void;
 offsetSlot?: TextbookOffsetSlot | null;
 hideSecondary?: boolean;
 hideMeta?: boolean;
};

function TextbookCard({
 title,
 fileUrl,
 thumbnailUrl,
 accessToken,
 totalPages,
 bookPageStart,
 pdfPageStart,
 isPublished,
 canStudentView,
 status,
 typeLabel,
 onRead,
 onMapPage,
 onEdit,
 onHide,
 onShow,
 onPublish,
 onDelete,
 offsetSlot,
 hideSecondary,
 hideMeta,
}: TextbookCardProps) {
 const audienceLabel = canStudentView ? "HS xem" : "Chỉ giáo viên";
 const statusLabel = isPublished ? "Đã xuất bản" : status === "HIDDEN" ? "Đang ẩn" : "Bản nháp";
 const statusStyle = isPublished
  ? "bg-emerald-50 text-emerald-700"
  : status === "HIDDEN"
   ? "bg-slate-100 text-slate-600"
   : "bg-slate-100 text-slate-600";

 function TextbookCover({fileUrl,thumbnailUrl,accessToken,title}:{fileUrl:string;thumbnailUrl?:string|null;accessToken?:string;title:string}){
 if(!fileUrl&&!thumbnailUrl){
  return <div className="flex h-[132px] w-[96px] shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-center text-[10px] font-medium text-slate-400">Chưa có<br/>file</div>;
 }
 // Truyền nguyên đường dẫn API trả về; PdfThumbnail tự ghép API base và gửi token.
 return <PdfThumbnail fileUrl={fileUrl||""} thumbnailUrl={thumbnailUrl} accessToken={accessToken}/>;
}

return (
  <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
   <div className="flex gap-4 p-5">
    <TextbookCover fileUrl={fileUrl} thumbnailUrl={thumbnailUrl} accessToken={accessToken} title={title}/>
    <div className="flex min-w-0 flex-1 flex-col gap-2">
     <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{typeLabel}</span>
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${canStudentView ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{audienceLabel}</span>
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle}`}>{statusLabel}</span>
     </div>
<h3 className="truncate text-lg font-bold text-slate-950">{title}</h3>
    {!hideMeta&&<div className="text-sm text-slate-600">
      {totalPages ? `${totalPages} trang` : "Chưa xác định tổng trang"}
     </div>}
    {!hideMeta&&(offsetSlot
      ? <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
         <label className="text-xs text-slate-600">PDF page cho trang sách 1:</label>
         <input type="number" min={1} value={offsetSlot.offset} onChange={e=>offsetSlot.onChange(Number(e.target.value))} className="h-9 w-24 rounded-md border border-slate-300 px-2 text-sm"/>
         <button onClick={offsetSlot.onSave} className="h-9 rounded-md bg-emerald-700 px-3 text-sm font-medium text-white hover:bg-emerald-800">Lưu</button>
         <button onClick={offsetSlot.onCancel} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Hủy</button>
        </div>
      : <div className="text-sm text-slate-600">
         Khớp trang: <span className="font-semibold text-slate-800">trang {bookPageStart} → PDF page {pdfPageStart}</span>
        </div>
     )}
    </div>
   </div>
   {!hideSecondary&&<div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-4">
    <button onClick={onRead} className="h-11 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">Đọc sách</button>
    <button onClick={onMapPage} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Khớp trang</button>
    <button onClick={onEdit} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Sửa</button>
    {status==="DRAFT"&&<button onClick={onPublish} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Xuất bản</button>}
    {status==="PUBLISHED"&&<button onClick={onHide} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Ẩn sách</button>}
    {status==="HIDDEN"&&<button onClick={onShow} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Hiện lại</button>}
    <button onClick={onDelete} className="h-11 rounded-xl border border-red-200 bg-white px-4 text-sm font-medium text-red-600 hover:bg-red-50">Xóa</button>
   </div>}
  </article>
 );
}

function ChangePasswordDialog({session,onClose,onLogout}:{session:AuthSession;onClose:()=>void;onLogout:()=>void}) {
  const [currentPassword,setCurrentPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [error,setError]=useState("");
  const [success,setSuccess]=useState(false);
  const [busy,setBusy]=useState(false);
  const submit=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setError("");try{await changePassword(session,currentPassword,newPassword,confirmPassword);setSuccess(true)}catch(reason){setError(messageOf(reason))}finally{setBusy(false)}};
  return <div className="dialog-backdrop"><section className="dialog-card"><div className="panel-head"><h2>Đổi mật khẩu</h2><button onClick={onClose}>Đóng</button></div>{success?<div className="success-state"><p>Đổi mật khẩu thành công. Mọi phiên đăng nhập cũ đã bị thu hồi, kể cả trên thiết bị khác.</p><button className="primary" onClick={onLogout}>Đăng nhập lại</button></div>:<form className="live-form" onSubmit={submit}><label>Mật khẩu hiện tại<input type="password" required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label><label>Mật khẩu mới<input type="password" minLength={8} required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label><label>Xác nhận mật khẩu mới<input type="password" minLength={8} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>{error&&<div className="api-error">{error}</div>}<button className="primary" disabled={busy}>{busy?"Đang lưu…":"Đổi mật khẩu"}</button></form>}</section></div>;
}

function StudentDashboard({ session, onLogout, onChangePassword }: { session: AuthSession; onLogout: () => void; onChangePassword: () => void }) {
  const queryClient = useQueryClient();
  const dataQuery = useQuery({ queryKey: ["student-dashboard", session.accessToken], queryFn: async () => {
    const [progress,curriculum,assigned]=await Promise.all([getStudentProgress(session),getMyCourses(session),getMyAssignments(session)]);
    return { items: progress, courses: curriculum, assignments: assigned };
  } });
  const courses = dataQuery.data?.courses ?? [];
  const assignments = dataQuery.data?.assignments ?? [];
  const items = dataQuery.data?.items ?? [];
  const reload = () => queryClient.invalidateQueries({ queryKey: ["student-dashboard"] });
  const saveMutation = useMutation({ mutationFn: (input: { lessonId: number; completed: boolean }) => markLessonProgress(session, input.lessonId, input.completed), onSuccess: reload });
  const error = dataQuery.isError ? messageOf(dataQuery.error) : saveMutation.isError ? messageOf(saveMutation.error) : "";

  const save = async (lessonId:number,completed: boolean) => {
    try {
      await saveMutation.mutateAsync({ lessonId, completed });
    } catch { /* lỗi đã có trong mutation state */ }
  };

  return <StudentMobileExperience session={session} courses={courses} assignments={assignments} items={items} loading={dataQuery.isLoading} saving={saveMutation.isPending} error={error} onLogout={onLogout} onChangePassword={onChangePassword} onReload={reload} onSaveLesson={save} />;
}

function StudentMobileExperience({
  session,
  courses,
  assignments,
  items,
  loading,
  saving,
  error,
  onLogout,
  onChangePassword,
  onReload,
  onSaveLesson,
}: {
  session: AuthSession;
  courses: StudentCourse[];
  assignments: StudentAssignment[];
  items: Progress[];
  loading: boolean;
  saving: boolean;
  error: string;
  onLogout: () => void;
  onChangePassword: () => void;
  onReload: () => Promise<void>;
  onSaveLesson: (lessonId: number, completed: boolean) => Promise<void>;
}) {
  const [tab, setTab] = useState<"home" | "courses" | "textbooks" | "assignments" | "profile">("home");
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const lessons = courses.flatMap(course => course.chapters.flatMap(chapter => chapter.lessons.map(lesson => ({ course, chapter, lesson }))));
  const selectedLesson = selectedLessonId ? lessons.find(item => item.lesson.id === selectedLessonId) ?? null : null;
  const totalLessons = lessons.length;
  const completedLessons = items.filter(item => item.completedAt).length;
  const totalPercent = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const completedAssignments = assignments.filter(item => item.progressStatus === "COMPLETED").length;
  const assignmentPercent = assignments.length ? Math.round((completedAssignments / assignments.length) * 100) : 0;
  const pendingAssignments = assignments.filter(item => item.progressStatus !== "COMPLETED");
  const continueLesson = lessons.find(({ lesson }) => {
    const progress = items.find(item => item.lessonId === lesson.id);
    return progress?.openedAt && !progress.completedAt;
  }) ?? lessons.find(({ lesson }) => !items.find(item => item.lessonId === lesson.id)?.completedAt);
  const nav = [
    { key: "home", label: "Trang chủ", icon: Home },
    { key: "courses", label: "Khóa học", icon: BookOpen },
    { key: "textbooks", label: "Sách GK", icon: GraduationCap },
    { key: "assignments", label: "Bài tập", icon: ClipboardList },
    { key: "profile", label: "Cá nhân", icon: UserRound },
  ] as const;
  const coursePercent = (course: StudentCourse) => {
    const courseLessons = course.chapters.flatMap(chapter => chapter.lessons);
    const done = courseLessons.filter(lesson => items.find(item => item.lessonId === lesson.id)?.completedAt).length;
    return courseLessons.length ? Math.round((done / courseLessons.length) * 100) : 0;
  };
  const markAssignmentDone = (assignmentId: number) => void markAssignment(session, assignmentId, true).then(onReload);
  const markAssignmentOpened = (assignment: StudentAssignment, open: boolean) => {
    if (open && assignment.progressStatus === "NOT_OPENED") void markAssignment(session, assignment.id, false).then(onReload);
  };
  useEffect(() => {
    if (selectedLesson && !selectedLesson.lesson.locked) void onSaveLesson(selectedLesson.lesson.id, false);
  }, [onSaveLesson, selectedLesson?.lesson.id, selectedLesson?.lesson.locked]);
  if (selectedLesson) return <StudentLessonView session={session} courses={courses} assignments={assignments} items={items} saving={saving} active={selectedLesson} onBack={() => setSelectedLessonId(null)} onSelectLesson={setSelectedLessonId} onComplete={async lessonId => { await onSaveLesson(lessonId, true); await onReload(); }} />;
  const renderAssignmentList = () => (
    <section className="student-section">
      <div className="student-section-head"><div><small>Bài tập cần làm</small><h2>Phiếu giao trên lớp</h2></div><span>{pendingAssignments.length} chưa xong</span></div>
      {!assignments.length && <EmptyState text="Chưa có bài tập được giao." />}
      {assignments.map(assignment => (
        <details className="student-assignment-card" key={assignment.id} onToggle={event => markAssignmentOpened(assignment, event.currentTarget.open)}>
          <summary><div><b>{assignment.title}</b><small>{assignment.dueAt ? `Hạn ${new Date(assignment.dueAt).toLocaleString("vi-VN")}` : "Không giới hạn thời gian"}</small></div><span>{assignment.completionPercent}%</span></summary>
          {assignment.worksheetId && <div className="worksheet-problem-list"><h3>{assignment.worksheetName}</h3>{assignment.items.map((problem, index) => (
            <article key={problem.problemId}><small>Câu {index + 1} · {problem.publicCode}</small><span dangerouslySetInnerHTML={{ __html: katex.renderToString(problem.statementLatex.replace(/^\$|\$$/g, ""), { throwOnError: false, displayMode: true }) }} />{problem.qrSlug && <a href={`/q/${problem.qrSlug}`}>Mở gợi ý QR</a>}</article>
          ))}</div>}
          {assignment.lessonId && <p>Bài học #{assignment.lessonId} trong khóa học của bạn.</p>}
          <button className="primary student-wide-button" disabled={assignment.progressStatus === "COMPLETED"} onClick={() => markAssignmentDone(assignment.id)}>{assignment.progressStatus === "COMPLETED" ? "Đã hoàn thành" : "Tôi đã làm xong phiếu này"}</button>
        </details>
      ))}
    </section>
  );
  const renderCourses = () => (
    <section className="student-section">
      <div className="student-section-head"><div><small>Khóa học</small><h2>Nội dung được giao</h2></div><span>{courses.length} khóa</span></div>
      {loading && <p>Đang tải nội dung...</p>}
      {!loading && !courses.length && <EmptyState text="Bạn chưa được gán khóa học nào." />}
      <div className="student-course-list">{courses.map(course => (
        <article key={course.id}><header><div><small>{course.code}</small><h3>{course.name}</h3></div><b>{coursePercent(course)}%</b></header><div className="student-progress-line"><i style={{ width: `${coursePercent(course)}%` }} /></div>
          {course.chapters.map(chapter => <details key={chapter.id}><summary>{chapter.orderIndex}. {chapter.title}</summary>{chapter.lessons.map(lesson => {
            const progress = items.find(item => item.lessonId === lesson.id);
            const done = Boolean(progress?.completedAt);
            const opened = Boolean(progress?.openedAt);
            return <div className={`student-lesson-card ${lesson.locked ? "locked" : ""}`} key={lesson.id}><div><span>{lesson.locked ? <Lock size={14}/> : done ? <CheckCircle size={16}/> : opened ? "●" : "○"}</span><div><b>{lesson.orderIndex}. {lesson.title}</b><p>{lesson.locked ? "Bài học đang khóa." : lesson.summary || "Mở bài học để xem video, bài giảng và tài liệu."}</p>{lesson.worksheets.map(sheet => <div className="attached-worksheet" key={sheet.id}><b>Phiếu cuối bài</b><span>{sheet.name}</span></div>)}</div></div><div><strong>{progress?.completionPercent ?? lesson.completionPercent}%</strong><button disabled={saving || lesson.locked} onClick={() => setSelectedLessonId(lesson.id)}>Vào học</button><button className="primary" disabled={saving || done || lesson.locked} onClick={() => setSelectedLessonId(lesson.id)}>{done ? "Đã xong" : "Học online"}</button></div></div>;
          })}</details>)}
        </article>
      ))}</div>
    </section>
  );

  return <main className="student-app">
    {error && <div className="api-error">{error}</div>}
    <header className="student-header"><div><small>MATH10</small><h1>Chào, {session.email.split("@")[0]}</h1><p>Hôm nay học gọn, làm trên giấy, cần thì quét QR để xem gợi ý.</p></div><button onClick={onLogout}>Đăng xuất</button></header>
    {tab === "home" && <><section className="continue-card"><small>Tiếp tục học</small>{continueLesson ? <><h2>{continueLesson.lesson.title}</h2><p>{continueLesson.course.name} · {continueLesson.chapter.title}</p><div className="student-progress-line"><i style={{ width: `${items.find(item => item.lessonId === continueLesson.lesson.id)?.completionPercent ?? continueLesson.lesson.completionPercent}%` }} /></div><button className="primary student-wide-button" disabled={continueLesson.lesson.locked} onClick={() => setSelectedLessonId(continueLesson.lesson.id)}>Vào học tiếp</button></> : <><h2>Chưa có bài đang học</h2><p>Hãy mở khóa học đầu tiên được giao để bắt đầu.</p></>}</section>{renderAssignmentList()}<section className="student-section"><div className="student-section-head"><div><small>Gợi ý ôn tập</small><h2>Lộ trình học Toán 10</h2></div></div><div className="recommendation-grid"><article><b>120 phút</b><span>{Math.max(0, 100 - totalPercent)}% còn lại</span><p>Học lý thuyết online trước, sau đó làm đề giấy và quét QR đối chiếu.</p></article><article><b>4 phần trọng tâm</b><span>Luyện thi</span><p>Đại số, hình học, bài toán thực tế và câu khó phân loại.</p></article></div></section></>}
    {tab === "courses" && renderCourses()}
    {tab === "assignments" && renderAssignmentList()}
    {tab === "textbooks" && <TextbookStudentView session={session}/>}
    {tab === "profile" && <section className="student-section profile-panel"><div className="student-section-head"><div><small>Cá nhân</small><h2>Tiến độ của em</h2></div></div><div className="profile-progress"><b>{completedLessons}/{totalLessons}</b><span>Bài học đã hoàn thành</span><div className="student-progress-line"><i style={{ width: `${totalPercent}%` }} /></div></div><div className="student-tag-grid"><button>Hàm số bậc hai · {totalPercent}%</button><button>Bài tập giấy · {assignmentPercent}%</button><button>Đang cần ôn · {pendingAssignments.length}</button></div><div className="profile-actions"><button onClick={onChangePassword}>Đổi mật khẩu</button><button onClick={onLogout}>Đăng xuất</button></div></section>}
    <nav className="student-bottom-nav">{nav.map(item => { const Icon = item.icon; return <button key={item.key} className={tab === item.key ? "active" : ""} onClick={() => setTab(item.key)}><Icon size={20} /><span>{item.label}</span></button>; })}</nav>
  </main>;
}

function TextbookStudentView({session}:{session:AuthSession}){
 const booksQuery=useQuery({queryKey:["student-textbooks",session.accessToken],queryFn:()=>getTextbooks(session)});
 const books=booksQuery.data??[];
 const goToPageMutation=useMutation({mutationFn:(input:{id:number;page:number})=>openTextbookInBrowser(session,input.id,input.page)});
 const error=booksQuery.isError?messageOf(booksQuery.error):goToPageMutation.isError?messageOf(goToPageMutation.error):"";
 const [selectedBook,setSelectedBook]=useState<TextbookItem|null>(null);
 const [bookPage,setBookPage]=useState<number|null>(null);
 const openBook=(row:TextbookItem)=>{setSelectedBook(row);setBookPage(1)};
 const goToPage=async()=>{if(!selectedBook||!bookPage)return;try{await goToPageMutation.mutateAsync({id:selectedBook.id,page:bookPage})}catch{/* lỗi đã có trong mutation state */}};
 const docTypeLabel=(v:string)=>v==="SGK"?"Sách giáo khoa":v==="SBT"?"Sách bài tập":v;
 if(booksQuery.isLoading)return<section className="student-section"><p>Đang tải sách…</p></section>;
 if(error)return<section className="student-section"><div className="api-error">{error}</div></section>;
 if(selectedBook)return<section className="student-section textbook-reader">
  <div className="reader-head"><button onClick={()=>setSelectedBook(null)}>← Danh sách</button><b>{selectedBook.title}</b></div>
  {selectedBook.totalPages&&<small>{selectedBook.totalPages} trang · Offset: trang 1 → PDF page {selectedBook.basePageOffset}</small>}
  <div className="reader-nav">
   <label>Nhập trang sách: <input type="number" min={1} max={selectedBook.totalPages||999} value={bookPage||""} onChange={e=>setBookPage(Number(e.target.value))} placeholder="VD: 10"/></label>
   <button className="primary" onClick={goToPage}>Mở trang</button>
  </div>
  <button onClick={()=>void openTextbookInBrowser(session,selectedBook.id)}>Mở toàn bộ sách</button>
  <button onClick={()=>bookPage&&openTextbookInBrowser(session,selectedBook.id,bookPage)}>Mở từ trang {bookPage||1}</button>
 </section>;
 return<section className="student-section textbook-student-view">
   <div className="student-section-head"><div><small>Thư viện</small><h2>Sách giáo khoa</h2></div></div>
   {!books.length&&<EmptyState text="Chưa có sách giáo khoa nào được xuất bản."/>}
   <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{books.map(book=><TextbookCard
    key={book.id}
    title={book.title}
    fileUrl={book.fileUrl}
    thumbnailUrl={book.thumbnailUrl}
    accessToken={session.accessToken}
    totalPages={book.totalPages}
    bookPageStart={1}
    pdfPageStart={book.basePageOffset}
    isPublished={book.status==="PUBLISHED"}
    canStudentView={book.audience==="STUDENT_ALLOWED"}
    status={book.status}
    typeLabel={docTypeLabel(book.docType)}
    onRead={()=>openBook(book)}
    onMapPage={()=>{}}
    onEdit={()=>{}}
    onHide={()=>{}}
    onShow={()=>{}}
    onPublish={()=>{}}
    onDelete={()=>{}}
    hideSecondary
    hideMeta
   />)}</div>
  </section>;
}

type StudentLessonContext = {
  course: StudentCourse;
  chapter: StudentCourse["chapters"][number];
  lesson: StudentCourse["chapters"][number]["lessons"][number];
};

function StudentLessonView({
  session,
  courses,
  assignments,
  items,
  saving,
  active,
  onBack,
  onSelectLesson,
  onComplete,
}: {
  session: AuthSession;
  courses: StudentCourse[];
  assignments: StudentAssignment[];
  items: Progress[];
  saving: boolean;
  active: StudentLessonContext;
  onBack: () => void;
  onSelectLesson: (lessonId: number) => void;
  onComplete: (lessonId: number) => Promise<void>;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [canComplete, setCanComplete] = useState(false);
  const [documentAnswers, setDocumentAnswers] = useState<Record<number, Record<number, string>>>({});
  const [documentQuizResult, setDocumentQuizResult] = useState<Record<number, string>>({});
  const [studyPdf, setStudyPdf] = useState<LessonDocument | null>(null);
  const lesson = active.lesson;
  const docsQuery = useQuery({ queryKey: ["student-lesson-documents", session.accessToken, lesson.id], queryFn: async () => {
    const docs = await getLessonDocuments(session, lesson.id);
    const pairs = await Promise.all(docs.map(async doc => [doc.id, await getLessonDocumentQuestions(session, lesson.id, doc.id)] as const));
    return { docs, questions: Object.fromEntries(pairs) as Record<number, LessonDocumentQuestion[]> };
  } });
  const lessonDocs = docsQuery.data?.docs ?? [];
  const documentQuestions = docsQuery.data?.questions ?? {};
  const documentError = docsQuery.isError ? messageOf(docsQuery.error) : "";
  const submitQuizMutation = useMutation({ mutationFn: (input: { doc: LessonDocument }) => submitLessonDocumentQuiz(session, lesson.id, input.doc.id, documentAnswers[input.doc.id] || {}) });
  const video = lesson.resources.find(resource => resource.type === "VIDEO");
  const files = lesson.resources.filter(resource => resource.type !== "VIDEO");
  const progress = items.find(item => item.lessonId === lesson.id);
  const completed = Boolean(progress?.completedAt || lesson.completedAt);
  const relatedAssignments = assignments.filter(assignment => assignment.lessonId === lesson.id || lesson.worksheets.some(sheet => sheet.id === assignment.worksheetId));
  const courseLessons = active.course.chapters.flatMap(chapter => chapter.lessons);
  const doneCount = courseLessons.filter(row => items.find(item => item.lessonId === row.id)?.completedAt || row.completedAt).length;
  const coursePercent = courseLessons.length ? Math.round((doneCount / courseLessons.length) * 100) : 0;
  const videoUrl = video?.externalUrl ? youtubeEmbed(video.externalUrl) : "";
  const hasDocumentQuiz = lessonDocs.some(doc => (documentQuestions[doc.id] || []).length > 0);
  const documentQuizPassed = !hasDocumentQuiz || lessonDocs.every(doc => !(documentQuestions[doc.id] || []).length || (documentQuizResult[doc.id] || "").includes("Hoàn thành"));
  useEffect(()=>{setCanComplete(false);setDocumentAnswers({});setDocumentQuizResult({})},[lesson.id]);
  const openStudyDocument=async(doc:LessonDocument)=>{
    // PDF xem ngay trong app; định dạng khác (docx…) vẫn đẩy sang tab mới như trước.
    if(isPdfDocument(doc))setStudyPdf(doc);
    else await openLessonDocumentFile(session,lesson.id,doc);
    await recordLessonDocumentStudy(session,lesson.id,doc.id,30).catch(()=>undefined);
  };
  const answerQuestion=(docId:number,questionId:number,value:string)=>setDocumentAnswers(current=>({...current,[docId]:{...(current[docId]||{}),[questionId]:value}}));
  const submitDocumentQuiz=async(doc:LessonDocument)=>{
    try{
      const result=await submitQuizMutation.mutateAsync({doc});
      setDocumentQuizResult(current=>({...current,[doc.id]:result.status==="COMPLETED"?`Đạt ${result.quizScore}% · Hoàn thành`:`${result.quizScore}% · Cần xem lại`}));
    }catch(reason){setDocumentQuizResult(current=>({...current,[doc.id]:messageOf(reason)}))}
  };
  const questionOption=(question:LessonDocumentQuestion,option:"A"|"B"|"C"|"D")=>({A:question.optionA,B:question.optionB,C:question.optionC,D:question.optionD}[option]);
  const onScroll = (event: React.UIEvent<HTMLElement>) => {
    const target = event.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 96) setCanComplete(true);
  };
  const curriculum = (
    <aside className="student-curriculum-sidebar">
      <div className="student-section-head"><div><small>Danh mục bài học</small><h2>{active.course.name}</h2></div><span>{coursePercent}%</span></div>
      {courses.map(course => <details key={course.id} open={course.id === active.course.id}><summary>{course.name}</summary>{course.chapters.map(chapter => <details key={chapter.id} open={chapter.id === active.chapter.id}><summary>{chapter.orderIndex}. {chapter.title}</summary>{chapter.lessons.map(row => {
        const rowProgress = items.find(item => item.lessonId === row.id);
        const rowDone = Boolean(rowProgress?.completedAt || row.completedAt);
        const current = row.id === lesson.id;
        return <button key={row.id} className={`${current ? "active" : ""} ${row.locked ? "locked" : ""}`} disabled={row.locked} onClick={() => { onSelectLesson(row.id); setDrawerOpen(false); }}><span>{row.locked ? <Lock size={15}/> : rowDone ? <CheckCircle size={16}/> : <BookOpen size={16}/>}</span><b>{row.orderIndex}. {row.title}</b></button>;
      })}</details>)}</details>)}
    </aside>
  );

  return <main className="student-lesson-view">
    <header className="student-lesson-topbar"><button onClick={onBack}>←</button><div><small>{active.course.code}</small><h1>{lesson.title}</h1></div><button className="lesson-menu-button" onClick={() => setDrawerOpen(true)}><Menu size={18}/> Danh sách bài học</button></header>
    <section className="student-lesson-grid">
      <article className="student-lesson-main" onScroll={onScroll}>
        <div className="student-progress-line"><i style={{ width: `${coursePercent}%` }} /></div>
        {video && <section className="lesson-video-panel">{videoUrl ? <iframe src={videoUrl} title={video.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <a href={video.externalUrl} target="_blank" rel="noreferrer"><PlayCircle size={42}/><span>{video.title}</span></a>}</section>}
        <section className="lesson-reading-panel">
          <p className="eyebrow">Bài giảng online</p>
          {lesson.contentHtml ? <SafeLessonContent html={lesson.contentHtml} /> : <p>{lesson.summary || "Giáo viên chưa nhập nội dung bài giảng."}</p>}
        </section>
        {(!!lessonDocs.length||documentError) && <section className="lesson-document-steps"><h2>Tài liệu học tập</h2>{documentError&&<div className="api-error">{documentError}</div>}{lessonDocs.map((doc,index)=>{const questions=documentQuestions[doc.id]||[];return <article key={doc.id} className="lesson-document-step"><span>{doc.docType==="VIDEO"?<PlayCircle size={20}/>:<FileText size={20}/>}</span><div><small>Bước {index+1} · {doc.required?"Bắt buộc":"Tham khảo"}{doc.startPage?` · Mở trang ${doc.startPage}`:""}</small><b>{doc.title}</b>{doc.teacherNote&&<p>{doc.teacherNote}</p>}{!!questions.length&&<div className="document-quick-quiz"><b>Kiểm tra nhanh</b>{questions.map(question=><fieldset key={question.id}><legend>{question.displayOrder}. {question.questionText}</legend>{(["A","B","C","D"] as const).map(option=><label key={option}><input type="radio" name={`doc-${doc.id}-q-${question.id}`} checked={(documentAnswers[doc.id]?.[question.id]||"")===option} onChange={()=>answerQuestion(doc.id,question.id,option)}/>{option}. {questionOption(question,option)}</label>)}</fieldset>)}<button type="button" onClick={()=>void submitDocumentQuiz(doc)}>Nộp kiểm tra nhanh</button>{documentQuizResult[doc.id]&&<small>{documentQuizResult[doc.id]}</small>}</div>}</div><button onClick={()=>void openStudyDocument(doc)}>{doc.docType==="SGK"?"Mở SGK Toán 10":"Xem tài liệu"}</button></article>})}</section>}
        {!!files.length && <section className="lesson-file-panel"><h2>Tài liệu của giáo viên</h2>{files.map(resource => <button key={resource.id} onClick={() => resource.fileAssetId ? void downloadFile(session, resource.fileAssetId, resource.title) : resource.externalUrl ? window.open(resource.externalUrl, "_blank", "noreferrer") : undefined}><FileText size={18}/><span>{resource.title}</span><small>{resource.type}</small></button>)}</section>}
        {!!lesson.worksheets.length && <section className="lesson-practice-panel"><h2>Bài tập thực hành</h2>{lesson.worksheets.map(sheet => {
          const assignment = relatedAssignments.find(item => item.worksheetId === sheet.id);
          return <article key={sheet.id}><b>{sheet.name}</b><p>Bài giảng này có phiếu bài tập. Hãy in ra làm bài, sau đó quét mã QR để đối chiếu gợi ý và lời giải.</p>{assignment ? <button onClick={() => window.print()}>Tải/In phiếu PDF</button> : <small>Giáo viên đã gắn phiếu vào bài học; nếu được giao trên lớp, phiếu sẽ xuất hiện trong mục Bài tập.</small>}</article>;
        })}</section>}
        <footer className="lesson-complete-panel"><small>{!documentQuizPassed ? "Hãy đạt kiểm tra nhanh của tài liệu trước khi hoàn thành." : canComplete ? "Đã đến cuối bài. Hệ thống vẫn yêu cầu tối thiểu 1 phút học." : "Cuộn đến cuối bài để mở nút hoàn thành."}</small><button className="primary student-wide-button" disabled={saving || completed || !canComplete || !documentQuizPassed} onClick={() => void onComplete(lesson.id)}>{completed ? "Đã đọc xong" : lessonDocs.length ? "Tôi đã đọc xong" : "Tôi đã học xong bài này"}</button></footer>
      </article>
      {curriculum}
    </section>
    {drawerOpen && <div className="student-curriculum-drawer"><button className="drawer-close" onClick={() => setDrawerOpen(false)}><X size={18}/></button>{curriculum}</div>}
    {studyPdf && <PdfViewer session={session} lessonId={lesson.id} documentId={studyPdf.id} title={studyPdf.title} fileUrl={studyPdf.fileUrl} initialPage={studyPdf.startPage} onClose={() => setStudyPdf(null)} />}
  </main>;
}

function youtubeEmbed(url: string) {
  try {
    const parsed = new URL(url);
    const id = parsed.hostname.includes("youtu.be") ? parsed.pathname.slice(1) : parsed.searchParams.get("v");
    return id ? `https://www.youtube.com/embed/${id}` : url;
  } catch {
    return url;
  }
}

export function renderMathInHtml(raw: string): string {
  if (!raw) return "";
  const isPureLatex = !/<[a-z][\s\S]*>/i.test(raw) && /^\s*\$\$?[\s\S]+\$\$?\s*$/.test(raw);
  if (isPureLatex) {
    const isDisplay = /^\s*\$\$[\s\S]+\$\$\s*$/.test(raw);
    const cleaned = raw.replace(/^\s*\$\$?|\$\$?\s*$/g, "").trim();
    return katex.renderToString(cleaned, { displayMode: isDisplay, throwOnError: false });
  }
  let processed = raw.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return tex;
    }
  });
  return processed.replace(/\$([^\$\n\r]+?)\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return tex;
    }
  });
}

function SafeLessonContent({html, className = "lesson-html"}:{html:string; className?: string}){
 const safe=useMemo(()=>{
   const rendered = renderMathInHtml(html);
   const template=document.createElement("template");
   template.innerHTML=rendered;
   template.content.querySelectorAll("script,style,iframe,object,embed,form").forEach(node=>node.remove());
   template.content.querySelectorAll<HTMLElement>("*").forEach(node=>{
     for(const attribute of Array.from(node.attributes)){
       const name=attribute.name.toLowerCase(),value=attribute.value.trim().toLowerCase();
       if(name.startsWith("on")||((name==="href"||name==="src")&&value.startsWith("javascript:")))node.removeAttribute(attribute.name);
     }
   });
   return template.innerHTML;
 },[html]);
 return <div className={className} dangerouslySetInnerHTML={{__html:safe}}/>;
}

const emptyCourse = (metadata: Metadata | null): CourseInput => ({
  code: "",
  name: "",
  description: "",
  status: firstMetadataValue(metadata, "courseStatuses"),
});

function TeacherDashboard({ session, activeSection }: { session: AuthSession; activeSection: string }) {
  const metadata=useMetadata(session);
  const queryClient=useQueryClient();
  const [form, setForm] = useState<CourseInput>(() => emptyCourse(null));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [gradebookClassId,setGradebookClassId]=useState<number|null>(null);
  const [contentTab,setContentTab]=useState<"courses"|"textbooks"|"problems"|"results">("problems");
  useEffect(()=>{const selectTab=(event:Event)=>{const tab=(event as CustomEvent<string>).detail;if(["courses","textbooks","problems","results"].includes(tab))setContentTab(tab as typeof contentTab)};window.addEventListener("math10:content-tab",selectTab);return()=>window.removeEventListener("math10:content-tab",selectTab)},[]);

  const dashboardQuery=useQuery({queryKey:["teacher-dashboard",session.accessToken],queryFn:async()=>{
    const [nextCourses,stats,nextClasses]=await Promise.all([getCourses(session),getTeacherStats(session),getTeacherClasses(session)]);
    const overview=await Promise.all(nextClasses.map(async classroom=>{const [assignments,progress]=await Promise.all([getAssignments(session,classroom.id),getGradebook(session,classroom.id)]);return {classroom,assignments,progress}}));
    return {
      courses:nextCourses,
      teacherStats:stats,
      classes:nextClasses,
      overviewAssignments:overview.flatMap(item=>item.assignments.map(row=>({...row,className:item.classroom.name}))),
      overviewProgress:overview.flatMap(item=>item.progress.map(row=>({...row,className:item.classroom.name}))),
    };
  }});
  const courses=dashboardQuery.data?.courses??[];
  const teacherStats=dashboardQuery.data?.teacherStats??null;
  const classes=dashboardQuery.data?.classes??[];
  const overviewAssignments=dashboardQuery.data?.overviewAssignments??[];
  const overviewProgress=dashboardQuery.data?.overviewProgress??[];
  const invalidateDashboard=()=>queryClient.invalidateQueries({queryKey:["teacher-dashboard"]});
  const createMutation=useMutation({mutationFn:(input:CourseInput)=>createCourse(session,input),onSuccess:invalidateDashboard});
  const updateMutation=useMutation({mutationFn:({id,input}:{id:number;input:CourseInput})=>updateCourse(session,id,input),onSuccess:invalidateDashboard});
  const deleteMutation=useMutation({mutationFn:(id:number)=>deleteCourse(session,id),onSuccess:invalidateDashboard});
  const saving=createMutation.isPending||updateMutation.isPending;
  const error=dashboardQuery.isError?messageOf(dashboardQuery.error):createMutation.isError?messageOf(createMutation.error):updateMutation.isError?messageOf(updateMutation.error):deleteMutation.isError?messageOf(deleteMutation.error):"";

  useEffect(()=>{if(!editingId)setForm(current=>({...current,status:current.status||firstMetadataValue(metadata,"courseStatuses")}))},[editingId,metadata]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editingId) await updateMutation.mutateAsync({id:editingId,input:form});
      else await createMutation.mutateAsync(form);
      setEditingId(null);
      setForm(emptyCourse(metadata));
    } catch {
      /* lỗi đã có trong mutation state */
    }
  };

  const edit = (course: Course) => {
    setEditingId(course.id);
    setForm({ code: course.code, name: course.name, description: course.description || "", status: course.status });
  };

  const openAssignments=overviewAssignments.filter(item=>item.status!=="COMPLETED");
  const pendingSubmissions=overviewProgress.filter(item=>item.status==="IN_PROGRESS");
  const attentionStudents=Array.from(new Map(overviewProgress.map(row=>[row.student_id,{id:row.student_id,name:row.full_name,username:row.username,className:row.className,rows:overviewProgress.filter(item=>item.student_id===row.student_id)}])).values()).map(student=>({...student,average:student.rows.length?Math.round(student.rows.reduce((sum,row)=>sum+(Number(row.completion_percent)||0),0)/student.rows.length):0})).filter(student=>student.average<50).sort((a,b)=>a.average-b.average);
  const dueTasks=[...openAssignments].filter(item=>item.dueAt).sort((a,b)=>new Date(a.dueAt!).getTime()-new Date(b.dueAt!).getTime()).slice(0,4);
  const unfinished=pendingSubmissions[0];
  const selectedClass=classes.find(item=>item.id===gradebookClassId)??null;

  return (
    <div className="page live-dashboard teacher-page-section">
      {error && <div className="api-error">{error}</div>}

      {activeSection === "teacher-overview" && <>
        <div id="teacher-overview" data-teacher-section data-search="Dashboard giáo viên" className="section-anchor" />
        <div className="flex flex-col gap-6 max-w-7xl">
          {unfinished && (
            <div className="bg-primary-container text-on-primary-container p-4 rounded-lg flex items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <span className="material-symbols-outlined shrink-0">info</span>
                <span className="text-sm font-medium truncate">Có tiến độ đang theo dõi ở <b>{unfinished.title}</b> · {unfinished.className} — {unfinished.completion_percent}% hoàn thành</span>
              </div>
              <button onClick={()=>window.dispatchEvent(new CustomEvent("math10:navigate",{detail:"teacher-classes"}))} className="shrink-0 px-4 py-2 bg-on-primary-container text-primary-container text-xs font-semibold rounded hover:opacity-90 transition-opacity">Xem</button>
            </div>
          )}

          <header>
            <h1 className="text-3xl font-bold text-on-surface mb-1">Chào {session.email.split("@")[0]}</h1>
            <p className="text-sm text-on-surface-variant">{new Intl.DateTimeFormat("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit"}).format(new Date())}. Tổng quan công việc và tiến độ các lớp đang phụ trách.</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 border border-outline-variant rounded-lg bg-surface-container-lowest flex flex-col justify-between h-24">
              <p className="text-xs text-on-surface-variant">Lớp phụ trách</p>
              <p className="text-3xl font-bold text-on-surface data-tabular">{teacherStats?.classes??classes.length}</p>
            </div>
            <div className="p-4 border border-outline-variant rounded-lg bg-surface-container-lowest flex flex-col justify-between h-24">
              <p className="text-xs text-on-surface-variant">Nhiệm vụ đang mở</p>
              <p className="text-3xl font-bold text-on-surface data-tabular">{openAssignments.length}<span className="text-xs font-normal text-on-surface-variant ml-2">{overviewAssignments.length} tất cả</span></p>
            </div>
            <div className="p-4 border border-outline-variant rounded-lg bg-surface-container-lowest flex flex-col justify-between h-24">
              <p className="text-xs text-on-surface-variant">Bài đang thực hiện</p>
              <p className="text-3xl font-bold text-on-surface data-tabular">{pendingSubmissions.length}<span className="text-xs font-normal text-on-surface-variant ml-2">Từ sổ điểm</span></p>
            </div>
            <div className="p-4 border border-error/30 rounded-lg bg-error-container/20 flex flex-col justify-between h-24">
              <p className="text-xs text-on-surface-variant">Cần chú ý</p>
              <p className="text-3xl font-bold text-error data-tabular">{teacherStats?.studentsBelow50??attentionStudents.length}<span className="text-xs font-normal text-on-surface-variant ml-2">tiến độ &lt;50%</span></p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
              <h3 className="text-lg font-bold text-on-surface mb-4 border-b border-outline-variant pb-2">Cần xử lý hôm nay</h3>
              <div className="flex flex-col gap-3">
                {dueTasks.map(item=>{
                  const due=new Date(item.dueAt!),overdue=due.getTime()<Date.now();
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-3 p-3 border border-outline-variant rounded hover:bg-surface-container-low transition-colors">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className={`material-symbols-outlined mt-0.5 shrink-0 ${overdue?"text-error":"text-primary"}`}>{overdue?"warning":"schedule"}</span>
                        <p className="text-sm text-on-surface truncate"><b>{item.title}</b><br/><span className="text-on-surface-variant">{item.className} · {overdue?"Đã quá hạn":"Hạn"} {due.toLocaleString("vi-VN")}</span></p>
                      </div>
                      <button onClick={()=>window.dispatchEvent(new CustomEvent("math10:navigate",{detail:"teacher-tasks"}))} className="shrink-0 px-3 py-1.5 border border-outline-variant text-on-surface text-xs font-semibold rounded hover:bg-surface-variant transition-colors whitespace-nowrap">Xem nhiệm vụ</button>
                    </div>
                  );
                })}
                {pendingSubmissions.slice(0,3).map(row=>(
                  <div key={`progress-${row.student_id}-${row.assignment_id}`} className="flex items-center justify-between gap-3 p-3 border border-outline-variant rounded hover:bg-surface-container-low transition-colors">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="material-symbols-outlined text-primary mt-0.5 shrink-0">edit_note</span>
                      <p className="text-sm text-on-surface truncate"><b>{row.title}</b><br/><span className="text-on-surface-variant">{row.full_name} · {row.className} · tiến độ {row.completion_percent}%</span></p>
                    </div>
                    <button onClick={()=>window.dispatchEvent(new CustomEvent("math10:navigate",{detail:"teacher-grading"}))} className="shrink-0 px-3 py-1.5 bg-primary text-on-primary text-xs font-semibold rounded hover:opacity-90 transition-colors whitespace-nowrap">Chấm ngay</button>
                  </div>
                ))}
                {!dueTasks.length && !pendingSubmissions.length && <p className="text-sm text-on-surface-variant text-center py-8 border border-dashed border-outline-variant rounded">Không có công việc cần xử lý.</p>}
              </div>
            </div>

            <div className="lg:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
              <h3 className="text-lg font-bold text-on-surface mb-4 border-b border-outline-variant pb-2">Học sinh cần chú ý</h3>
              <div className="flex flex-col gap-4">
                {attentionStudents.slice(0,4).map(student=>{
                  const initials=(student.name||"?").trim().split(/\s+/).filter(Boolean).slice(-2).map(part=>part[0]).join("").toUpperCase();
                  return (
                    <div key={student.id} className="flex flex-col gap-2 p-3 border border-error/20 bg-error-container/10 rounded">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-surface-dim flex items-center justify-center text-xs font-medium text-on-surface-variant shrink-0">{initials||"?"}</div>
                        <p className="text-sm text-on-surface truncate">{student.name} <span className="text-on-surface-variant text-xs ml-1">{student.className} · @{student.username}</span></p>
                      </div>
                      <p className="text-xs text-error">Tiến độ trung bình {student.average}% — dưới ngưỡng 50%.</p>
                      <div className="h-1.5 rounded-full bg-surface-variant overflow-hidden mt-1"><span className="block h-full bg-error rounded-full" style={{width:`${Math.max(0,Math.min(100,student.average))}%`}}/></div>
                    </div>
                  );
                })}
                {!attentionStudents.length && <p className="text-sm text-on-surface-variant text-center py-8 border border-dashed border-outline-variant rounded">Không có học sinh cần chú ý.</p>}
              </div>
            </div>
          </div>
        </div>
      </>}

      {activeSection === "teacher-content" && <>
        <div id="teacher-content" data-teacher-section data-search="Nội dung học chương trình sách giáo khoa ngân hàng câu hỏi" className="section-anchor" />
        <div className="flex flex-col gap-4">
          <header className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-on-surface">Nội dung học</h1>
              <p className="text-sm text-on-surface-variant">Khóa và lớp được phân công, sách giáo khoa và ngân hàng câu hỏi.</p>
            </div>
            <button onClick={()=>{setContentTab("problems");setTimeout(()=>document.getElementById("problem-create")?.scrollIntoView({behavior:"smooth",block:"start"}),0)}} className="h-9 px-4 rounded-lg bg-primary text-on-primary text-sm font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity">
              <span className="material-symbols-outlined text-[18px]">add</span> Tạo câu hỏi
            </button>
          </header>

          <nav role="tablist" className="flex items-center gap-6 border-b border-outline-variant">
            {([["courses","Chương trình"],["textbooks","Sách giáo khoa"],["problems","Ngân hàng câu hỏi"],["results","Kết quả các lớp"]] as const).map(([key,label])=>(
              <button key={key} role="tab" aria-selected={contentTab===key} onClick={()=>setContentTab(key)} className={`pb-2.5 text-sm border-b-2 transition-colors -mb-px ${contentTab===key?"border-primary text-primary font-bold":"border-transparent text-on-surface-variant font-medium hover:text-on-surface"}`}>{label}</button>
            ))}
          </nav>

          {contentTab==="courses"&&<AssignedCoursesView session={session}/>}
          {contentTab==="textbooks"&&<TextbookStudentView session={session}/>}
          {contentTab==="problems"&&<MathWorkspace session={session}/>}
          {contentTab==="results"&&<ClassResultsView session={session}/>}
        </div>
        {selectedCourse&&<CurriculumManager session={session} course={selectedCourse} onClose={()=>setSelectedCourse(null)}/>}
      </>}

      {activeSection === "teacher-documents" && <>
        <div id="teacher-documents" data-teacher-section data-search="Tài liệu của tôi giáo viên tải lên" className="section-anchor" />
        <div className="flex flex-col gap-4">
          <header>
            <h1 className="text-2xl font-bold text-on-surface">Tài liệu của tôi</h1>
            <p className="text-sm text-on-surface-variant">Kho tài liệu do bạn tự tải lên, tách riêng khỏi nội dung do Admin phân phối.</p>
          </header>
          <TeacherDocumentLibrary session={session}/>
        </div>
      </>}

      {activeSection === "teacher-courses" && <>
        <PageHeading eyebrow="NỘI DUNG HỌC" title="Khóa học" text="Tạo và cập nhật khóa học trực tiếp qua Spring Boot API." />
        <section id="teacher-courses" data-teacher-section data-search="Khóa học Courses" className="live-grid teacher-live">
          <article>
            <h2>{editingId ? "Cập nhật khóa học" : "Tạo khóa học"}</h2>
            <form id="course-create" className="live-form" onSubmit={save}>
              <label>Mã khóa học<input required maxLength={50} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label>
              <label>Tên khóa học<input required maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label>Mô tả<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              <label>Trạng thái<select required value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{metadataOptions(metadata,"courseStatuses").map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <div className="live-actions">
                <button className="primary" disabled={saving}>{saving ? "Đang lưu…" : "Lưu qua API"}</button>
                {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyCourse(metadata)); }}>Hủy</button>}
              </div>
            </form>
          </article>
          <article>
            <h2>Khóa học ({courses.length})</h2>
            {dashboardQuery.isLoading && <p>Đang tải dữ liệu…</p>}
            {!dashboardQuery.isLoading && courses.length === 0 && <EmptyState text="Chưa có khóa học." />}
            {courses.map((course) => <div className="live-row" key={course.id}><div><small>{course.code}</small><b>{course.name}</b><span>{course.status}</span></div><div className="row-actions"><button onClick={() => setSelectedCourse(course)}>Nội dung</button><button onClick={() => edit(course)}>Sửa</button><button className="danger-link" onClick={()=>{if(confirm(`Xóa khóa học “${course.name}”?`))deleteMutation.mutate(course.id)}}>Xóa</button></div></div>)}
          </article>
        </section>
        {selectedCourse && <CurriculumManager session={session} course={selectedCourse} onClose={() => setSelectedCourse(null)} />}
      </>}

      {activeSection === "teacher-problems" && <MathWorkspace session={session}/>}

      {activeSection === "teacher-worksheets" && <>
        <div id="teacher-worksheets" data-teacher-section data-search="Phiếu bài tập Worksheets" className="section-anchor" />
        <TeacherWorksheetView session={session} classes={classes}/>
      </>}
      {activeSection === "teacher-pipeline" && <DeThiWorkspace session={session}/>}
      {activeSection === "teacher-exams" && <ExamManager session={session} scope="CLASS"/>}

      {activeSection === "teacher-textbooks" && <>
        <div id="teacher-textbooks" data-teacher-section data-search="Sách giáo khoa" className="section-anchor" />
        <PageHeading eyebrow="SÁCH GIÁO KHOA" title="Sách giáo khoa" text="Xem và đọc sách giáo khoa Toán 10." />
        <TextbookStudentView session={session}/>
      </>}

      {activeSection === "teacher-classes" && <>
        <div id="teacher-classes" data-teacher-section data-search="Danh sách lớp học sinh Sổ điểm Gradebook" className="section-anchor" />
        <div className="flex flex-col gap-6 max-w-7xl">
          <TeacherClassManager
            session={session}
            classes={classes}
            onChanged={invalidateDashboard}
            selectedClassId={gradebookClassId}
            onSelectClass={classroom => setGradebookClassId(classroom.id)}
          />

          {selectedClass && <ClassDetail session={session} classroom={selectedClass} onClose={() => setGradebookClassId(null)} />}
        </div>
      </>}

      {activeSection === "teacher-grading" && <TeacherSubmissionView session={session} classes={classes} />}
      {activeSection === "teacher-reports" && <TeacherOperationsView session={session} classes={classes} mode="reports" />}
      {activeSection === "teacher-tasks" && <TeacherTaskView session={session} classes={classes} />}
      {activeSection === "teacher-notifications" && <TeacherOperationsView session={session} classes={classes} mode="notifications" />}

      {activeSection === "teacher-students" && <>
        <div id="teacher-students" data-teacher-section data-search="Học sinh trong lớp" className="section-anchor" />
        <PageHeading eyebrow="HỆ THỐNG" title="Học sinh" text="Xem danh sách học sinh theo lớp." />
        {classes.length>0?<TeacherRoster session={session} classes={classes}/>:<EmptyState text="Chưa có lớp học để xem học sinh."/>}
      </>}

      {activeSection === "teacher-settings" && <>
        <div id="teacher-settings" data-teacher-section data-search="Cài đặt tài khoản" className="section-anchor" />
        <ProfileSettings session={session}/>
        <div className="flex flex-col gap-4" style={{display:"none"}}>
         <header>
          <h1 className="text-2xl font-bold text-on-surface">Cài đặt</h1>
          <p className="text-sm text-on-surface-variant">Quản lý thông tin tài khoản và tùy chọn không gian làm việc.</p>
         </header>
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="border border-outline-variant rounded-lg overflow-hidden bg-surface-container-lowest">
           <div className="px-4 py-3 border-b border-outline-variant"><h2 className="text-sm font-bold text-on-surface">Thông tin tài khoản</h2></div>
           <div className="divide-y divide-outline-variant">
            <div className="flex items-center justify-between gap-4 px-4 py-3"><span className="text-sm text-on-surface-variant">Tài khoản</span><span className="text-sm font-medium text-on-surface truncate">{session.email}</span></div>
            <div className="flex items-center justify-between gap-4 px-4 py-3"><span className="text-sm text-on-surface-variant">Vai trò</span><span className="text-sm font-medium text-on-surface">Giáo viên</span></div>
            <div className="flex items-center justify-between gap-4 px-4 py-3"><span className="text-sm text-on-surface-variant">Mã người dùng</span><span className="text-sm font-medium text-on-surface data-tabular">#{session.userId}</span></div>
           </div>
           <p className="px-4 py-3 text-xs text-on-surface-variant border-t border-outline-variant">Mật khẩu và đăng xuất được quản lý trong menu tài khoản ở góc trên bên phải.</p>
          </section>

          <section className="border border-outline-variant rounded-lg overflow-hidden bg-surface-container-lowest">
           <div className="px-4 py-3 border-b border-outline-variant"><h2 className="text-sm font-bold text-on-surface">Tùy chọn hiển thị</h2></div>
           <div className="divide-y divide-outline-variant">
            <div className="flex items-center justify-between gap-4 px-4 py-3"><span className="text-sm text-on-surface">Ngôn ngữ</span><span className="text-xs text-on-surface-variant">Tiếng Việt</span></div>
            <div className="flex items-center justify-between gap-4 px-4 py-3"><span className="text-sm text-on-surface">Môn học</span><span className="text-xs text-on-surface-variant">Toán 10</span></div>
            <div className="flex items-center justify-between gap-4 px-4 py-3"><span className="text-sm text-on-surface">Giao diện</span><span className="text-xs text-on-surface-variant">Sáng · Theo chuẩn Stitch</span></div>
           </div>
          </section>
         </div>

         <section className="border border-outline-variant rounded-lg p-4 bg-surface-container-lowest flex items-start gap-3">
          <span className="material-symbols-outlined text-primary text-[20px] shrink-0">privacy_tip</span>
          <div>
           <h2 className="text-sm font-bold text-on-surface mb-1">Quyền riêng tư</h2>
           <p className="text-sm text-on-surface-variant">Dữ liệu lớp và tiến độ học sinh chỉ được lấy qua API có phân quyền giáo viên. Ứng dụng không truy cập trực tiếp cơ sở dữ liệu hoặc kho tài liệu.</p>
          </div>
         </section>
        </div>
      </>}
    </div>
  );
}

const chapterDraft = (courseId: number, orderIndex: number, status = ""): ChapterInput => ({ courseId, title: "", orderIndex, status });
const lessonDraft = (chapterId: number, orderIndex: number, status = ""): LessonInput => ({ chapterId, title: "", publicCode: "", summary: "", contentHtml: "", orderIndex, status });

/**
 * Tab "Chương trình" của giáo viên: chỉ những lớp/khóa admin đã phân (quyền lọc ở /teacher/assigned-courses).
 * Chỉ đọc — tạo/sửa chương trình, chương, bài là việc của admin.
 */
function AssignedCoursesView({ session }: { session: AuthSession }) {
 const query=useQuery({queryKey:["teacher-assigned-courses"],queryFn:()=>getAssignedCourses(session)});
 const [viewing,setViewing]=useState<{id:number;name:string}|null>(null);
 const rows=query.data??[];
 const groups=useMemo(()=>{
  const byKey=new Map<string,{instance:AssignedCourse|null;classes:AssignedCourse[]}>();
  for(const row of rows){const key=row.courseInstanceId==null?"none":String(row.courseInstanceId);const g=byKey.get(key)??{instance:row.courseInstanceId==null?null:row,classes:[]};g.classes.push(row);byKey.set(key,g)}
  return [...byKey.values()].sort((a,b)=>(a.instance?0:1)-(b.instance?0:1));
 },[rows]);
 const date=(v:string|null)=>v?new Date(v).toLocaleDateString("vi-VN"):"—";
 const openClass=()=>window.dispatchEvent(new CustomEvent("math10:navigate",{detail:"teacher-classes"}));
 if(query.isLoading)return <p className="text-sm text-on-surface-variant">Đang tải…</p>;
 if(query.isError)return <EmptyState text="Không tải được khóa được phân công."/>;
 if(!rows.length)return <EmptyState text="Bạn chưa được admin phân công lớp nào."/>;
 return <div className="flex flex-col gap-4">
  {groups.map(g=>(
   <article key={g.instance?.courseInstanceId??"none"} className="border border-outline-variant rounded-lg overflow-hidden">
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-outline-variant bg-surface-container-lowest flex-wrap">
     {g.instance?<div className="min-w-0">
      <h2 className="text-sm font-bold text-on-surface truncate">{g.instance.courseInstanceName}</h2>
      <p className="text-[11px] text-on-surface-variant truncate">{g.instance.programName??"Chương trình"}{g.instance.programCode?` (${g.instance.programCode})`:""} · Năm học {g.instance.schoolYear} · {date(g.instance.startsOn)} – {date(g.instance.endsOn)} · {g.instance.courseInstanceStatus}</p>
     </div>:<div><h2 className="text-sm font-bold text-on-surface">Lớp chưa gắn khóa</h2><p className="text-[11px] text-on-surface-variant">Liên hệ admin để gắn khóa cho các lớp này.</p></div>}
     {g.instance?.programId!=null&&<button onClick={()=>setViewing({id:g.instance!.programId!,name:g.instance!.programName??"Chương trình"})} className="px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary-container/20 rounded transition-colors">Xem nội dung</button>}
    </div>
    <div className="divide-y divide-outline-variant">
     {g.classes.map(c=>(
      <div key={`${c.classId}-${c.courseInstanceId}`} className="flex items-center justify-between gap-3 p-3 bg-surface-container-lowest">
       <div className="flex items-center gap-3 min-w-0">
        <span className="material-symbols-outlined text-primary text-[22px] shrink-0">groups</span>
        <div className="min-w-0"><p className="text-sm font-medium text-on-surface truncate">{c.className}</p><p className="text-[11px] text-on-surface-variant truncate">{c.classCode} · {c.classStatus}</p></div>
       </div>
       <button onClick={openClass} className="px-2.5 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low rounded transition-colors">Mở lớp</button>
      </div>
     ))}
    </div>
   </article>
  ))}
  {viewing&&<ProgramContentReadOnly session={session} program={viewing} onClose={()=>setViewing(null)}/>}
 </div>;
}

function ProgramContentReadOnly({ session, program, onClose }: { session: AuthSession; program: {id:number;name:string}; onClose: () => void }) {
 const query=useQuery({queryKey:["program-readonly",program.id],queryFn:async()=>{const chapters=await getChapters(session,program.id);const lessons=await Promise.all(chapters.map(ch=>getLessons(session,ch.id)));return chapters.map((ch,i)=>({chapter:ch,lessons:lessons[i]}))}});
 // Cùng một nguồn với tab Học liệu của lớp và trang học sinh: program_resources đã qua LuongNoiDung.
 const resources=useQuery({queryKey:["program-readonly-resources",session.accessToken,program.id],queryFn:()=>getProgramResources(session,program.id)});
 const [openError,setOpenError]=useState("");
 const rows=(resources.data??[]).filter(r=>r.resource_type==="DOCUMENT"||r.resource_type==="VIDEO");
 const docList=(list:ProgramResource[])=>list.length?<ul className="mt-1 flex flex-col gap-1">{list.map(r=><li key={r.id}><button type="button" disabled={!(r.file_url||r.video_url)} onClick={()=>{const url=r.file_url||r.video_url;setOpenError("");if(url)void openDocumentFile(session,url,r.title).catch(reason=>setOpenError(messageOf(reason)))}} className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:text-on-surface-variant disabled:no-underline"><span className="material-symbols-outlined text-sm">{r.resource_type==="VIDEO"?"smart_display":"description"}</span>{r.title}</button></li>)}</ul>:null;
 const general=rows.filter(r=>r.chapter_id==null);
 return <AdminModal open onClose={onClose} title={`Nội dung: ${program.name}`}>
  {openError&&<p role="alert" className="mb-3 text-sm text-error">{openError}</p>}
  {query.isLoading?<p className="text-sm text-on-surface-variant">Đang tải…</p>:!query.data?.length?<EmptyState text="Chương trình chưa có chương."/>:
  <ol className="flex flex-col gap-3">{general.length>0&&<li><p className="text-sm font-bold text-on-surface">Tài liệu chung</p>{docList(general)}</li>}{query.data.map(({chapter,lessons})=>{const ofChapter=rows.filter(r=>r.chapter_id===chapter.id);const byPeriod=ofChapter.filter(r=>r.lesson_id==null);return (
   <li key={chapter.id}><p className="text-sm font-bold text-on-surface">{chapter.title}</p>
    <ul className="mt-1 ml-4 list-disc text-sm text-on-surface-variant">{lessons.map(l=><li key={l.id}>{l.title}{docList(ofChapter.filter(r=>r.lesson_id===l.id))}</li>)}{!lessons.length&&<li className="list-none -ml-4 text-xs">Chưa có bài.</li>}</ul>
    {byPeriod.length>0&&<div className="ml-4 mt-1"><p className="text-xs font-semibold text-on-surface-variant">Theo tiết</p>{docList(byPeriod)}</div>}
   </li>)})}</ol>}
 </AdminModal>;
}

function CurriculumManager({ session, course, onClose }: { session: AuthSession; course: Course; onClose: () => void }) {
  const metadata=useMetadata(session);
  const queryClient=useQueryClient();
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [chapterForm, setChapterForm] = useState<ChapterInput>(chapterDraft(course.id, 1));
  const [lessonForm, setLessonForm] = useState<LessonInput>(lessonDraft(0, 1));
  const [chapterEdit, setChapterEdit] = useState<number | null>(null);
  const [lessonEdit, setLessonEdit] = useState<number | null>(null);
  const [resourceLesson,setResourceLesson]=useState<Lesson|null>(null);
  const [worksheetLesson,setWorksheetLesson]=useState<Lesson|null>(null);
  const [documentLesson,setDocumentLesson]=useState<Lesson|null>(null);
  const [autoSaveState,setAutoSaveState]=useState("");
  const [bulkImport,setBulkImport]=useState(false);
  const [editorLesson, setEditorLesson] = useState<{ open: boolean; lesson: Lesson | null }>({ open: false, lesson: null });

  const chaptersQuery = useQuery({ queryKey: ["curriculum-chapters", session.accessToken, course.id], queryFn: () => getChapters(session, course.id) });
  const chapters = chaptersQuery.data ?? [];
  const lessonsQuery = useQuery({ queryKey: ["curriculum-lessons", session.accessToken, selectedChapter?.id], queryFn: () => getLessons(session, selectedChapter!.id), enabled: !!selectedChapter });
  const lessons = lessonsQuery.data ?? [];
  const invalidateChapters = () => queryClient.invalidateQueries({ queryKey: ["curriculum-chapters"] });
  const invalidateLessons = () => queryClient.invalidateQueries({ queryKey: ["curriculum-lessons"] });
  const chapterMutation = useMutation({ mutationFn: (input: { id: number | null; payload: ChapterInput }) => input.id ? updateChapter(session, input.id, input.payload) : createChapter(session, input.payload), onSuccess: invalidateChapters });
  const deleteChapterMutation = useMutation({ mutationFn: (id: number) => deleteChapter(session, id), onSuccess: invalidateChapters });
  const reorderChaptersMutation = useMutation({ mutationFn: (ids: number[]) => reorderChapters(session, ids), onSuccess: invalidateChapters });
  const lessonMutation = useMutation({ mutationFn: (input: { id: number | null; payload: LessonInput }) => input.id ? updateLesson(session, input.id, input.payload) : createLesson(session, input.payload), onSuccess: invalidateLessons });
  const deleteLessonMutation = useMutation({ mutationFn: (id: number) => deleteLesson(session, id), onSuccess: invalidateLessons });
  const reorderLessonsMutation = useMutation({ mutationFn: (ids: number[]) => reorderLessons(session, ids), onSuccess: invalidateLessons });
  const error = chaptersQuery.isError ? messageOf(chaptersQuery.error) : lessonsQuery.isError ? messageOf(lessonsQuery.error) : chapterMutation.isError ? messageOf(chapterMutation.error) : deleteChapterMutation.isError ? messageOf(deleteChapterMutation.error) : reorderChaptersMutation.isError ? messageOf(reorderChaptersMutation.error) : lessonMutation.isError ? messageOf(lessonMutation.error) : deleteLessonMutation.isError ? messageOf(deleteLessonMutation.error) : reorderLessonsMutation.isError ? messageOf(reorderLessonsMutation.error) : "";

  useEffect(()=>{const defaultStatus=firstMetadataValue(metadata,"publishStatuses");setChapterForm(current=>({...current,status:current.status||defaultStatus}));setLessonForm(current=>({...current,status:current.status||defaultStatus}))},[metadata]);
  useEffect(()=>{if(!lessonEdit||!lessonForm.title.trim())return;setAutoSaveState("Đang chờ lưu…");const timer=setTimeout(()=>{setAutoSaveState("Đang lưu…");void updateLesson(session,lessonEdit,{...lessonForm,status:lessonForm.status||firstMetadataValue(metadata,"publishStatuses")}).then(()=>setAutoSaveState("Đã tự động lưu bản nháp")).catch(reason=>setAutoSaveState(messageOf(reason)))},900);return()=>clearTimeout(timer)},[lessonEdit,lessonForm,metadata,session]);

  const chooseChapter = (chapter: Chapter) => {
    setSelectedChapter(chapter);
    setLessonForm(lessonDraft(chapter.id, 1, firstMetadataValue(metadata, "publishStatuses")));
    setLessonEdit(null);
  };

  const saveChapter = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await chapterMutation.mutateAsync({ id: chapterEdit, payload: chapterForm });
      setChapterEdit(null); setChapterForm(chapterDraft(course.id, chapters.length + 2, firstMetadataValue(metadata, "publishStatuses")));
    } catch { /* lỗi đã có trong mutation state */ }
  };

  const saveLesson = async (event: React.FormEvent) => {
    event.preventDefault(); if (!selectedChapter) return;
    try {
      await lessonMutation.mutateAsync({ id: lessonEdit, payload: lessonForm });
      setLessonEdit(null); setLessonForm(lessonDraft(selectedChapter.id, lessons.length + 2, firstMetadataValue(metadata, "publishStatuses")));
    } catch { /* lỗi đã có trong mutation state */ }
  };

  const removeChapter = async (chapter: Chapter) => {
    if (!window.confirm(`Xóa chương “${chapter.title}”?`)) return;
    try { await deleteChapterMutation.mutateAsync(chapter.id); if (selectedChapter?.id === chapter.id) setSelectedChapter(null); } catch { /* lỗi đã có trong mutation state */ }
  };
  const removeLesson = async (lesson: Lesson) => {
    if (!selectedChapter || !window.confirm(`Xóa bài “${lesson.title}”?`)) return;
    try { await deleteLessonMutation.mutateAsync(lesson.id); } catch { /* lỗi đã có trong mutation state */ }
  };
  const moveChapter=async(index:number,delta:number)=>{const copy=[...chapters];const target=index+delta;if(target<0||target>=copy.length)return;[copy[index],copy[target]]=[copy[target],copy[index]];try{await reorderChaptersMutation.mutateAsync(copy.map(x=>x.id))}catch{/* lỗi đã có trong mutation state */}};
  const moveLesson=async(index:number,delta:number)=>{if(!selectedChapter)return;const copy=[...lessons];const target=index+delta;if(target<0||target>=copy.length)return;[copy[index],copy[target]]=[copy[target],copy[index]];try{await reorderLessonsMutation.mutateAsync(copy.map(x=>x.id))}catch{/* lỗi đã có trong mutation state */}};

  return <section className="curriculum-panel">
    <div className="panel-head"><div><p className="eyebrow">NỘI DUNG KHÓA HỌC</p><h2>{course.name}</h2></div><button onClick={onClose}>Đóng</button></div>
    {error && <div className="api-error">{error}</div>}
    <div className="curriculum-columns">
      <div>
        <div className="panel-head" style={{marginBottom:8}}><h3 style={{margin:0}}>Chương ({chapters.length})</h3><button type="button" onClick={()=>setBulkImport(true)}>Nhập hàng loạt</button></div>
        <form className="compact-form" onSubmit={saveChapter}><input required placeholder="Tên chương" value={chapterForm.title} onChange={e => setChapterForm({...chapterForm,title:e.target.value})}/><input required min="1" type="number" value={chapterForm.orderIndex} onChange={e => setChapterForm({...chapterForm,orderIndex:Number(e.target.value)})}/><button className="primary">{chapterEdit?"Cập nhật":"Thêm"}</button></form>
        {chapters.map((chapter,index)=><div className={`content-item content-actions ${selectedChapter?.id===chapter.id?"selected":""}`} key={chapter.id}><button className="content-main" onClick={()=>chooseChapter(chapter)}><span>{chapter.orderIndex}</span><div><b>{chapter.title}</b></div></button><button onClick={()=>void moveChapter(index,-1)}>↑</button><button onClick={()=>void moveChapter(index,1)}>↓</button><button onClick={()=>{setChapterEdit(chapter.id);setChapterForm({courseId:chapter.courseId,title:chapter.title,orderIndex:chapter.orderIndex,status:chapter.status})}}>Sửa</button><button className="danger-link" onClick={()=>void removeChapter(chapter)}>Xóa</button></div>)}
      </div>
      <div>
        <div className="flex items-center justify-between" style={{marginBottom:8}}>
          <h3 style={{margin:0}}>{selectedChapter?`Bài học · ${selectedChapter.title}`:"Chọn một chương"}</h3>
          {selectedChapter && (
            <button
              type="button"
              className="primary"
              style={{fontSize:12,padding:"4px 8px"}}
              onClick={()=>setEditorLesson({ open: true, lesson: null })}
            >
              + Soạn bài học khối chuẩn
            </button>
          )}
        </div>
        {selectedChapter&&<><form className="compact-form lesson-form" onSubmit={saveLesson}><input required placeholder="Tên bài học" value={lessonForm.title} onChange={e=>setLessonForm({...lessonForm,title:e.target.value})}/><input placeholder="Public code" value={lessonForm.publicCode} onChange={e=>setLessonForm({...lessonForm,publicCode:e.target.value})}/><input required min="1" type="number" value={lessonForm.orderIndex} onChange={e=>setLessonForm({...lessonForm,orderIndex:Number(e.target.value)})}/><select required value={lessonForm.status} onChange={e=>setLessonForm({...lessonForm,status:e.target.value})}>{metadataOptions(metadata,"publishStatuses").filter(option=>option.value!=="ARCHIVED").map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select><textarea className="lesson-content-editor" placeholder="Nội dung HTML/Markdown kết hợp LaTeX…" value={lessonForm.contentHtml} onChange={e=>setLessonForm({...lessonForm,contentHtml:e.target.value,summary:e.target.value.replace(/<[^>]+>/g,"").slice(0,500)})}/><button className="primary">{lessonEdit?"Cập nhật":"Thêm"}</button>{lessonEdit&&<small className="autosave-status">{autoSaveState}</small>}</form>{lessons.map((lesson,index)=><div className="content-item lesson-actions" key={lesson.id}><div className="content-main"><span>{lesson.orderIndex}</span><div><b>{lesson.title}</b><small>{lesson.status} {lesson.publicCode&&`· ${lesson.publicCode}`}</small></div></div><button onClick={()=>setDocumentLesson(lesson)}>Tài liệu</button><button onClick={()=>setResourceLesson(lesson)}>Khối nội dung</button><button onClick={()=>setWorksheetLesson(lesson)}>Gắn phiếu</button><button onClick={()=>void moveLesson(index,-1)}>↑</button><button onClick={()=>void moveLesson(index,1)}>↓</button><button onClick={()=>setEditorLesson({ open: true, lesson })}>Sửa</button><button className="danger-link" onClick={()=>void removeLesson(lesson)}>Xóa</button></div>)}</>}
      </div>
    </div>
    {resourceLesson&&<ResourceManager session={session} lesson={resourceLesson} onClose={()=>setResourceLesson(null)}/>}
    {documentLesson&&<LessonDocumentManager session={session} lesson={documentLesson} onClose={()=>setDocumentLesson(null)}/>}
    {worksheetLesson&&<LessonWorksheetManager session={session} lesson={worksheetLesson} onClose={()=>setWorksheetLesson(null)}/>}
    {bulkImport&&<BulkChapterImport session={session} course={course} chapters={chapters} metadata={metadata} onDone={invalidateChapters} onClose={()=>setBulkImport(false)}/>}
    {editorLesson.open && selectedChapter && (
      <LessonEditorModal
        isOpen={editorLesson.open}
        onClose={() => setEditorLesson({ open: false, lesson: null })}
        lesson={editorLesson.lesson}
        defaultChapterId={selectedChapter.id}
        chapterTitle={selectedChapter.title}
        courseName={course.name}
        statusOptions={metadataOptions(metadata, "publishStatuses")}
        onSave={async (payload) => {
          if (editorLesson.lesson) {
            await updateLesson(session, editorLesson.lesson.id, payload);
          } else {
            await createLesson(session, payload);
          }
          invalidateLessons();
        }}
      />
    )}
  </section>;
}

type BulkChapterBlock = { title: string; lessons: string[] };
type BulkChapterResult = { title: string; status: "pending" | "creating" | "done" | "error"; error?: string; lessons: { title: string; status: "pending" | "creating" | "done" | "error"; error?: string }[] };

/** Phân tích văn bản dán/nạp file thành cây Chương→Bài. Dòng không có "-" đầu dòng = Chương mới; dòng bắt đầu bằng "-" = Bài thuộc Chương gần nhất. */
function parseBulkChapters(text: string): { blocks: BulkChapterBlock[]; error: string } {
  const blocks: BulkChapterBlock[] = [];
  const lines = text.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("-")) {
      const title = line.slice(1).trim().replace(/^bài\s*\d+[:.]?\s*/i, "");
      if (!title) continue;
      if (!blocks.length) return { blocks: [], error: `Dòng bài học "${line}" xuất hiện trước khi có chương nào.` };
      blocks[blocks.length - 1].lessons.push(title);
    } else {
      const title = line.replace(/^chương\s*\d+[:.]?\s*/i, "");
      blocks.push({ title, lessons: [] });
    }
  }
  return { blocks, error: "" };
}

/** Modal nhập hàng loạt Chương/Bài từ văn bản dán hoặc file .txt/.csv — thay cho việc nhập tay từng dòng qua form. */
function BulkChapterImport({ session, course, chapters, metadata, onDone, onClose }: { session: AuthSession; course: Course; chapters: Chapter[]; metadata: ReturnType<typeof useMetadata>; onDone: () => void; onClose: () => void }) {
  const [text, setText] = useState("");
  const [blocks, setBlocks] = useState<BulkChapterBlock[] | null>(null);
  const [parseError, setParseError] = useState("");
  const [results, setResults] = useState<BulkChapterResult[] | null>(null);
  const [busy, setBusy] = useState(false);

  const loadFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ""));
    reader.readAsText(file);
  };

  const preview = () => {
    const parsed = parseBulkChapters(text);
    setParseError(parsed.error);
    setBlocks(parsed.error ? null : parsed.blocks);
    setResults(null);
  };

  const runImport = async () => {
    if (!blocks || !blocks.length) return;
    setBusy(true);
    const status = firstMetadataValue(metadata, "publishStatuses");
    const progress: BulkChapterResult[] = blocks.map(block => ({ title: block.title, status: "pending", lessons: block.lessons.map(title => ({ title, status: "pending" })) }));
    setResults([...progress]);
    let chapterCount = chapters.length;
    for (let i = 0; i < blocks.length; i++) {
      progress[i].status = "creating"; setResults([...progress]);
      try {
        chapterCount += 1;
        const created = await createChapter(session, { courseId: course.id, title: blocks[i].title, orderIndex: chapterCount, status });
        progress[i].status = "done"; setResults([...progress]);
        for (let j = 0; j < blocks[i].lessons.length; j++) {
          progress[i].lessons[j].status = "creating"; setResults([...progress]);
          try {
            await createLesson(session, { chapterId: created.id, title: blocks[i].lessons[j], publicCode: "", summary: "", contentHtml: "", orderIndex: j + 1, status });
            progress[i].lessons[j].status = "done";
          } catch (reason) {
            progress[i].lessons[j].status = "error"; progress[i].lessons[j].error = messageOf(reason);
          }
          setResults([...progress]);
        }
      } catch (reason) {
        progress[i].status = "error"; progress[i].error = messageOf(reason); setResults([...progress]);
      }
    }
    setBusy(false);
    onDone();
  };

  const totalLessons = blocks ? blocks.reduce((sum, block) => sum + block.lessons.length, 0) : 0;

  return <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="dialog-card resource-dialog">
      <div className="panel-head"><div><p className="eyebrow">CHƯƠNG TRÌNH HỌC</p><h2>Nhập hàng loạt Chương/Bài</h2></div><button onClick={onClose} disabled={busy}>Đóng</button></div>
      <p>Mỗi dòng không có gạch đầu dòng là một <b>Chương</b> mới (có thể ghi "Chương 1: ..."). Dòng bắt đầu bằng "-" là <b>Bài học</b> thuộc chương phía trên gần nhất (có thể ghi "- Bài 1: ...").</p>
      <label>Nạp từ file .txt/.csv (tùy chọn)<input type="file" accept=".txt,.csv,text/plain,text/csv" onChange={e => loadFile(e.target.files?.[0] || null)} disabled={busy} /></label>
      <textarea rows={10} placeholder={"Chương 1: Số tự nhiên\n- Bài 1: Khái niệm số tự nhiên\n- Bài 2: Phép cộng\nChương 2: Phân số\n- Bài 1: Khái niệm phân số"} value={text} onChange={e => setText(e.target.value)} disabled={busy} style={{ width: "100%", fontFamily: "inherit" }} />
      <div className="row-actions"><button type="button" onClick={preview} disabled={busy || !text.trim()}>Xem trước</button></div>
      {parseError && <div className="api-error">{parseError}</div>}
      {blocks && !results && <>
        <p><b>{blocks.length}</b> chương, <b>{totalLessons}</b> bài sẽ được tạo:</p>
        {blocks.map((block, index) => <div className="live-row" key={index}><div><b>{block.title || <i>(chưa có tên)</i>}</b><small>{block.lessons.length} bài</small></div></div>)}
        <div className="row-actions"><button className="primary" onClick={() => void runImport()} disabled={busy || !blocks.length}>{busy ? "Đang tạo…" : `Tạo ${blocks.length} chương, ${totalLessons} bài`}</button></div>
      </>}
      {results && <>
        {results.map((block, index) => <div key={index}>
          <div className="live-row"><div><b>{block.status === "done" ? "✓ " : block.status === "error" ? "✗ " : block.status === "creating" ? "… " : ""}{block.title}</b>{block.error && <small className="api-error">{block.error}</small>}</div></div>
          {block.lessons.map((lesson, lessonIndex) => <div className="live-row" key={lessonIndex} style={{ paddingLeft: 20 }}><div><span>{lesson.status === "done" ? "✓ " : lesson.status === "error" ? "✗ " : lesson.status === "creating" ? "… " : ""}{lesson.title}</span>{lesson.error && <small className="api-error">{lesson.error}</small>}</div></div>)}
        </div>)}
        {!busy && <div className="row-actions"><button className="primary" onClick={onClose}>Xong, đóng lại</button></div>}
      </>}
    </section>
  </div>;
}

function LessonDocumentManager({session,lesson,onClose}:{session:AuthSession;lesson:Lesson;onClose:()=>void}) {
 const metadata=useMetadata(session);
 const queryClient=useQueryClient();
 const [documentId,setDocumentId]=useState(0),[teacherNote,setTeacherNote]=useState(""),[startPage,setStartPage]=useState(""),[required,setRequired]=useState(true),[editing,setEditing]=useState<LessonDocument|null>(null);
 const [quizDoc,setQuizDoc]=useState<LessonDocument|null>(null);
 const [pdfRow,setPdfRow]=useState<LessonDocument|null>(null);
 const [openError,setOpenError]=useState("");
 const [questionDraft,setQuestionDraft]=useState({questionText:"",optionA:"",optionB:"",optionC:"",optionD:"",correctOption:"A",explanation:""});
 const dataQuery=useQuery({queryKey:["lesson-documents",session.accessToken,lesson.id],queryFn:async()=>{const [docs,attached]=await Promise.all([getDocuments(session),getLessonDocuments(session,lesson.id)]);return {library:docs,rows:attached}}});
 const rows=dataQuery.data?.rows??[];
 const library=(dataQuery.data?.library??[]).filter(item=>item.status!=="HIDDEN"&&!rows.some(row=>row.documentId===item.id));
 const questionsQuery=useQuery({queryKey:["lesson-document-questions",session.accessToken,lesson.id,quizDoc?.id],queryFn:()=>getLessonDocumentQuestions(session,lesson.id,quizDoc!.id),enabled:!!quizDoc});
 const questions=questionsQuery.data??[];
 const invalidateDocs=()=>queryClient.invalidateQueries();
 const invalidateQuestions=()=>queryClient.invalidateQueries({queryKey:["lesson-document-questions"]});
 const submitMutation=useMutation({mutationFn:(input:{editingId:number|null;documentId:number;payload:{required:boolean;teacherNote:string;startPage:number|null}})=>input.editingId?updateLessonDocument(session,lesson.id,input.editingId,input.payload):attachLessonDocument(session,lesson.id,{documentId:input.documentId,...input.payload}),onSuccess:invalidateDocs});
 const moveMutation=useMutation({mutationFn:(input:{id:number;direction:"UP"|"DOWN"})=>moveLessonDocument(session,lesson.id,input.id,input.direction),onSuccess:invalidateDocs});
 const removeMutation=useMutation({mutationFn:(id:number)=>deleteLessonDocument(session,lesson.id,id),onSuccess:invalidateDocs});
 const saveQuestionMutation=useMutation({mutationFn:(input:{documentId:number;draft:typeof questionDraft})=>addLessonDocumentQuestion(session,lesson.id,input.documentId,input.draft),onSuccess:invalidateQuestions});
 const removeQuestionMutation=useMutation({mutationFn:(input:{documentId:number;questionId:number})=>deleteLessonDocumentQuestion(session,lesson.id,input.documentId,input.questionId),onSuccess:invalidateQuestions});
 const error=dataQuery.isError?messageOf(dataQuery.error):questionsQuery.isError?messageOf(questionsQuery.error):submitMutation.isError?messageOf(submitMutation.error):moveMutation.isError?messageOf(moveMutation.error):removeMutation.isError?messageOf(removeMutation.error):saveQuestionMutation.isError?messageOf(saveQuestionMutation.error):removeQuestionMutation.isError?messageOf(removeQuestionMutation.error):"";
 useEffect(()=>{setDocumentId(current=>library.some(item=>item.id===current)?current:library[0]?.id??0)},[library]);
 const reset=()=>{setEditing(null);setTeacherNote("");setStartPage("");setRequired(true)};
 const startEdit=(row:LessonDocument)=>{setEditing(row);setTeacherNote(row.teacherNote||"");setStartPage(row.startPage?String(row.startPage):"");setRequired(row.required)};
 const payload=()=>({required,teacherNote,startPage:startPage?Number(startPage):null});
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(submitMutation.isPending||(!editing&&!documentId))return;try{await submitMutation.mutateAsync({editingId:editing?.id??null,documentId,payload:payload()});reset()}catch{/* lỗi đã có trong mutation state */}};
 const move=async(id:number,direction:"UP"|"DOWN")=>{try{await moveMutation.mutateAsync({id,direction})}catch{/* lỗi đã có trong mutation state */}};
 const remove=async(row:LessonDocument)=>{if(!confirm(`Gỡ tài liệu “${row.title}” khỏi bài học?`))return;try{await removeMutation.mutateAsync(row.id)}catch{/* lỗi đã có trong mutation state */}};
 const openQuiz=(row:LessonDocument)=>{setQuizDoc(row)};
 /** PDF xem ngay trong app; định dạng khác (docx…) vẫn đẩy sang tab mới như trước. */
 const viewDoc=(row:LessonDocument)=>{setOpenError("");if(isPdfDocument(row))setPdfRow(row);else void openDocumentFile(session,row.fileUrl,row.title,row.startPage).catch(reason=>setOpenError(messageOf(reason)))};
 const saveQuestion=async(e:React.FormEvent)=>{e.preventDefault();if(!quizDoc)return;try{await saveQuestionMutation.mutateAsync({documentId:quizDoc.id,draft:questionDraft});setQuestionDraft({questionText:"",optionA:"",optionB:"",optionC:"",optionD:"",correctOption:"A",explanation:""})}catch{/* lỗi đã có trong mutation state */}};
 const removeQuestion=async(questionId:number)=>{if(!quizDoc)return;try{await removeQuestionMutation.mutateAsync({documentId:quizDoc.id,questionId})}catch{/* lỗi đã có trong mutation state */}};
 const label=(key:keyof Metadata,value:string)=>metadataOptions(metadata,key).find(option=>option.value===value)?.label||value;
 return <><AdminModal open onClose={onClose} title={`Tài liệu bài học · ${lesson.title}`} size="xl">
 <div className="attachment-manager">
 <p className="text-sm text-on-surface-variant">Tài liệu của bài học được dùng trong các khóa học và lớp học thuộc chương trình. Học sinh chỉ thấy tài liệu đã xuất bản và được phép xem.</p>
 {(error||openError)&&<div className="attachment-error" role="alert">{error||openError}</div>}
 <form className="attachment-form" onSubmit={submit}>
 {!editing&&<label>Chọn từ thư viện<select required value={documentId} onChange={e=>setDocumentId(Number(e.target.value))}><option value={0}>Chọn tài liệu chưa gắn...</option>{library.map(item=><option key={item.id} value={item.id}>{item.title} · {label("documentTypes",item.docType)}{item.status!=="PUBLISHED"?" · Chưa xuất bản":""}</option>)}</select></label>}
 <label>Trang bắt đầu<input type="number" min="1" placeholder="Ví dụ: 6" value={startPage} onChange={e=>setStartPage(e.target.value)}/></label>
 <label className="attachment-note-field">Ghi chú của giáo viên<input placeholder="Ví dụ: Đọc trang 6–12 trước buổi học" value={teacherNote} onChange={e=>setTeacherNote(e.target.value)}/></label>
 <label className="check-label"><input type="checkbox" checked={required} onChange={e=>setRequired(e.target.checked)}/> Bắt buộc</label>
 <div className="attachment-form-footer"><Button disabled={submitMutation.isPending||(!editing&&!documentId)}>{submitMutation.isPending?"Đang lưu…":editing?"Lưu thay đổi":"Thêm tài liệu"}</Button>{editing&&<Button variant="outline" type="button" onClick={reset}>Hủy chỉnh sửa</Button>}</div>
 </form>
 {dataQuery.isPending?<SkeletonTable rows={3} columns={2}/>:<div className="attachment-panel"><p className="attachment-count">{rows.length} tài liệu đã gắn</p>{rows.map((row,index)=><AttachmentCard key={row.id} row={row} accessToken={session.accessToken} actions={<>
 <button disabled={index===0||moveMutation.isPending} aria-label={`Đưa ${row.title} lên`} onClick={()=>void move(row.id,"UP")}>Lên</button>
 <button disabled={index===rows.length-1||moveMutation.isPending} aria-label={`Đưa ${row.title} xuống`} onClick={()=>void move(row.id,"DOWN")}>Xuống</button>
 <button onClick={()=>startEdit(row)}>Sửa</button><button onClick={()=>void openQuiz(row)}>Câu hỏi</button><button onClick={()=>viewDoc(row)}>Xem</button><button disabled={removeMutation.isPending} className="danger-link" onClick={()=>void remove(row)}>Gỡ</button>
 </>}/>)}{!rows.length&&!dataQuery.isError&&<div className="attachment-empty"><FileText size={28}/><p>Bài học này chưa có tài liệu.</p><small>Chọn tài liệu từ thư viện phía trên để bắt đầu.</small></div>}</div>}
 {quizDoc&&<section className="document-question-panel"><div className="panel-head"><div><p className="eyebrow">KIỂM TRA NHANH</p><h3>{quizDoc.title}</h3></div><button onClick={()=>setQuizDoc(null)}>Đóng</button></div><form className="compact-form document-question-form" onSubmit={saveQuestion}><input required placeholder="Câu hỏi" value={questionDraft.questionText} onChange={e=>setQuestionDraft({...questionDraft,questionText:e.target.value})}/><input required placeholder="A" value={questionDraft.optionA} onChange={e=>setQuestionDraft({...questionDraft,optionA:e.target.value})}/><input required placeholder="B" value={questionDraft.optionB} onChange={e=>setQuestionDraft({...questionDraft,optionB:e.target.value})}/><input required placeholder="C" value={questionDraft.optionC} onChange={e=>setQuestionDraft({...questionDraft,optionC:e.target.value})}/><input required placeholder="D" value={questionDraft.optionD} onChange={e=>setQuestionDraft({...questionDraft,optionD:e.target.value})}/><select value={questionDraft.correctOption} onChange={e=>setQuestionDraft({...questionDraft,correctOption:e.target.value})}><option value="A">Đáp án A</option><option value="B">Đáp án B</option><option value="C">Đáp án C</option><option value="D">Đáp án D</option></select><button className="primary">Thêm câu hỏi</button></form>{questions.map(question=><div className="live-row" key={question.id}><div><b>{question.displayOrder}. {question.questionText}</b><small>Đáp án đúng: {question.correctOption}</small></div><button className="danger-link" onClick={()=>void removeQuestion(question.id)}>Xóa</button></div>)}</section>}</div></AdminModal>{pdfRow&&<PdfViewer session={session} lessonId={lesson.id} documentId={pdfRow.id} title={pdfRow.title} fileUrl={pdfRow.fileUrl} initialPage={pdfRow.startPage} onClose={()=>setPdfRow(null)}/>}</>
}
function LessonWorksheetManager({session,lesson,onClose}:{session:AuthSession;lesson:Lesson;onClose:()=>void}){
 const queryClient=useQueryClient();
 const worksheetsQuery=useQuery({queryKey:["lesson-worksheet-manager",session.accessToken],queryFn:()=>getWorksheets(session)});
 const worksheets=worksheetsQuery.data??[];
 const attachMutation=useMutation({mutationFn:(input:{sheetId:number;lessonId:number|null})=>attachWorksheetToLesson(session,input.sheetId,input.lessonId),onSuccess:()=>queryClient.invalidateQueries({queryKey:["lesson-worksheet-manager"]})});
 const error=worksheetsQuery.isError?messageOf(worksheetsQuery.error):attachMutation.isError?messageOf(attachMutation.error):"";
 return <div className="dialog-backdrop"><section className="dialog-card resource-dialog"><div className="panel-head"><div><p className="eyebrow">CUỐI BÀI HỌC</p><h2>Phiếu bài tập · {lesson.title}</h2></div><button onClick={onClose}>Đóng</button></div>{error&&<div className="api-error">{error}</div>}<p>Chọn phiếu để hiển thị ở cuối bài học. Một phiếu chỉ gắn với một bài học tại một thời điểm.</p>{worksheets.map(sheet=><div className="live-row" key={sheet.id}><div><b>{sheet.name}</b><small>{sheet.items.length} câu {sheet.lessonId===lesson.id?"· Đang gắn với bài này":sheet.lessonId?`· Đang gắn bài #${sheet.lessonId}`:"· Chưa gắn"}</small></div><button onClick={()=>attachMutation.mutate({sheetId:sheet.id,lessonId:sheet.lessonId===lesson.id?null:lesson.id})}>{sheet.lessonId===lesson.id?"Gỡ khỏi bài":"Gắn vào cuối bài"}</button></div>)}{!worksheets.length&&<EmptyState text="Chưa có phiếu bài tập để gắn."/>}</section></div>
}

function ResourceManager({session,lesson,onClose}:{session:AuthSession;lesson:Lesson;onClose:()=>void}){
 const queryClient=useQueryClient();
 // Ba lựa chọn của người soạn, hai loại của luồng nội dung: tệp và đoạn văn đều thành tài liệu.
 // Danh sách này không lấy từ metadata "resourceTypes" nữa — sáu giá trị ở đó tả bảng cũ, bảng
 // giờ không còn cửa đọc nào, nên chọn trúng một giá trị ở đó là gắn vào chỗ không ai đọc.
 const kieu=[["FILE","Tệp PDF / ảnh"],["VIDEO","Video"],["TEXT","Đoạn văn bản"]] as const;
 const [title,setTitle]=useState(""),[url,setUrl]=useState(""),[type,setType]=useState<"FILE"|"VIDEO"|"TEXT">("FILE"),[file,setFile]=useState<File|null>(null);
 const [status,setStatus]=useState("PUBLISHED"),[audience,setAudience]=useState("STUDENT_ALLOWED"),[editing,setEditing]=useState<LessonProgramResource|null>(null);
 const rowsQuery=useQuery({queryKey:["lesson-resources",session.accessToken,lesson.id],queryFn:()=>getLessonResources(session,lesson.id)});
 // Dòng lesson_attachment do trigger đồng bộ từ ô "tài liệu của bài" sinh ra: đã hiện ở ô đó rồi,
 // hiện lại ở đây là trùng, và sửa/xoá ở đây thì trigger ghi đè lại ngay lần sửa tài liệu kế tiếp.
 const rows=(rowsQuery.data??[]).filter(x=>!x.lesson_attachment);
 const invalidate=()=>queryClient.invalidateQueries({queryKey:["lesson-resources"]});
 // Tải tệp lên trước rồi mới gắn: hai lượt gọi, nhưng lượt đầu chỉ sinh ra một tệp trong kho tệp,
 // không sinh ra học liệu mồ côi. Việc dựng nội dung và trỏ vào nó thì server làm trong một giao dịch.
 const saveMutation=useMutation({mutationFn:async()=>{
  if(editing)return updateLessonResource(session,editing.id,{title,status,audience});
  const fileAssetId=file?(await uploadFile(session,file)).id:null;
  return addLessonResource(session,lesson.id,{resourceType:type==="VIDEO"?"VIDEO":"DOCUMENT",title,
   videoUrl:type==="VIDEO"?url:undefined,fileAssetId:type==="FILE"?fileAssetId:undefined,
   textContent:type==="TEXT"?url:undefined,orderIndex:rows.length+1,status,audience});
 },onSuccess:invalidate});
 const reorderMutation=useMutation({mutationFn:(a:LessonProgramResource[])=>reorderLessonResources(session,lesson.id,a.map((x,i)=>({id:x.id,orderIndex:i+1}))),onSuccess:invalidate});
 const deleteMutation=useMutation({mutationFn:(id:number)=>deleteLessonResource(session,id),onSuccess:invalidate});
 const error=rowsQuery.isError?messageOf(rowsQuery.error):saveMutation.isError?messageOf(saveMutation.error):reorderMutation.isError?messageOf(reorderMutation.error):deleteMutation.isError?messageOf(deleteMutation.error):"";
 const thoi=()=>{setEditing(null);setTitle("");setUrl("");setFile(null);setStatus("PUBLISHED");setAudience("STUDENT_ALLOWED")};
 const save=async(e:React.FormEvent)=>{e.preventDefault();try{await saveMutation.mutateAsync();thoi()}catch{/* lỗi đã có trong mutation state */}};
 const edit=(x:LessonProgramResource)=>{setEditing(x);setTitle(x.title);setStatus(x.status);setAudience(x.audience);setUrl("");setFile(null)};
 const move=async(index:number,delta:number)=>{const a=[...rows],to=index+delta;if(to<0||to>=a.length)return;[a[index],a[to]]=[a[to],a[index]];try{await reorderMutation.mutateAsync(a)}catch{/* lỗi đã có trong mutation state */}};
 return <div className="dialog-backdrop"><section className="dialog-card resource-dialog"><div className="panel-head"><h2>Tài liệu · {lesson.title}</h2><button onClick={onClose}>Đóng</button></div>{error&&<div className="api-error">{error}</div>}<form className="live-form" onSubmit={save}>
  {!editing&&<label>Loại<select required value={type} onChange={e=>setType(e.target.value as typeof type)}>{kieu.map(([value,nhan])=><option key={value} value={value}>{nhan}</option>)}</select></label>}
  <label>Tên tài liệu<input required value={title} onChange={e=>setTitle(e.target.value)}/></label>
  {!editing&&(type==="VIDEO"?<label>YouTube/Drive URL<input type="url" required value={url} onChange={e=>setUrl(e.target.value)}/></label>
   :type==="FILE"?<label>File PDF/Image<input type="file" accept=".pdf,image/png,image/jpeg,image/webp" required onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
   :<label>Nội dung<input required value={url} onChange={e=>setUrl(e.target.value)}/></label>)}
  <label>Trạng thái<select value={status} onChange={e=>setStatus(e.target.value)}><option value="PUBLISHED">Đã xuất bản</option><option value="DRAFT">Bản nháp</option></select></label>
  <label>Phát cho<select value={audience} onChange={e=>setAudience(e.target.value)}><option value="STUDENT_ALLOWED">Học sinh và giáo viên</option><option value="TEACHER_ONLY">Chỉ giáo viên</option></select></label>
  <button className="primary">{editing?"Cập nhật":"Thêm tài liệu"}</button>{editing&&<button type="button" onClick={thoi}>Thôi</button>}
 </form>
 {editing&&<p className="hint">Đang sửa dòng gắn: đổi được tên, trạng thái và người đọc. Tệp và đường dẫn nằm trong kho, sửa ở màn kho tài liệu.</p>}
 {rows.map((x,i)=><div className="live-row" key={x.id}><div><b>{x.title}</b><small>{x.resource_type} · {x.status==="PUBLISHED"?"đã xuất bản":"nháp"} · {x.audience==="TEACHER_ONLY"?"chỉ giáo viên":"học sinh đọc được"}</small></div><div className="row-actions"><button onClick={()=>void move(i,-1)}>↑</button><button onClick={()=>void move(i,1)}>↓</button><button onClick={()=>edit(x)}>Sửa</button><button onClick={()=>deleteMutation.mutate(x.id)}>Xóa</button></div></div>)}
 {!rows.length&&<EmptyState text="Bài này chưa có học liệu nào."/>}</section></div>
}

function PageHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <section className="simple-hero"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{text}</p></section>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

function ClassResultsView({ session }: { session: AuthSession }) {
  const query = useQuery({
    queryKey: ["teacher-class-results", session.accessToken],
    queryFn: () => getClassResults(session),
  });
  const results = query.data ?? [];
  const updatedAt = new Date().toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

  const getStatusConfig = (status: string) => {
    if (status === "Đạt") return { label: "Đạt", color: "secondary", icon: "check_circle", bg: "bg-secondary/10", text: "text-secondary" };
    if (status === "Cần dạy lại") return { label: "Cần dạy lại", color: "tertiary", icon: "warning", bg: "bg-tertiary/10", text: "text-tertiary" };
    return { label: "Chưa có dữ liệu", color: "on-surface-variant", icon: "trending_up", bg: "bg-surface-variant", text: "text-on-surface-variant" };
  };

  const getGradeColor = (grade: number) => {
    if (grade >= 5.0) return "text-secondary";
    if (grade > 0) return "text-tertiary-container";
    return "";
  };

  return (
    <section className="class-results-view">
      <div className="class-results-header">
        <h2>Kết quả các lớp (Đánh giá gần nhất)</h2>
        <span className="updated-time">Cập nhật: {updatedAt}</span>
      </div>
      <div className="class-results-table-wrap">
        {query.isLoading ? (
          <div className="loading-rows">
            {[1, 2, 3].map(i => <div key={i} className="loading-row" />)}
          </div>
        ) : results.length === 0 ? (
          <EmptyState text="Chưa có dữ liệu kết quả lớp học." />
        ) : (
          <table className="class-results-table">
            <thead>
              <tr>
                <th>Lớp</th>
                <th>Giáo viên</th>
                <th>Điểm TB</th>
                <th>Hoàn thành</th>
                <th className="text-right">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {results.map(row => {
                const status = getStatusConfig(row.status);
                return (
                  <tr key={row.classId}>
                    <td className="font-semibold">{row.className}</td>
                    <td className="text-on-surface-variant">{row.teacherName ?? "—"}</td>
                    <td className={`font-bold ${getGradeColor(row.diemTb)}`}>{row.diemTb.toFixed(1)}</td>
                    <td>
                      <div className="completion-cell">
                        <div className="completion-bar">
                          <div className="completion-fill" style={{ width: `${Math.min(100, Math.max(0, row.hoanThanh))}%` }} />
                        </div>
                        <span>{row.hoanThanh}%</span>
                      </div>
                    </td>
                    <td className="text-right">
                      <span className={`chip ${status.bg} ${status.text}`}>
                        <span className="material-symbols-outlined chip-icon">{status.icon}</span>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

const BANG_TRANG_THAI_KHOA=[["DRAFT","Nháp"],["ACTIVE","Đang chạy"],["ARCHIVED","Lưu trữ"]] as const;
const nhanTrangThaiKhoa=(v:string)=>BANG_TRANG_THAI_KHOA.find(([x])=>x===v)?.[1]??v;

function ThongSo({nhan,gt}:{nhan:string;gt:string}){
 return <div style={{border:"1px solid var(--line)",borderRadius:8,padding:"10px 12px"}}>
  <div style={{fontSize:11,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.04em"}}>{nhan}</div>
  <div style={{fontSize:15,fontWeight:700,marginTop:2}}>{gt}</div>
 </div>;
}

/**
 * PP-7 TẦNG 3 — admin chọn nhịp dạy (số tiết mỗi tuần) cho một khóa; hệ thống tự tính số tuần
 * cần và ngày dự kiến học xong, cảnh báo nếu lệch ngày kết thúc khóa. Để trống ô nhịp = theo SGK
 * (max week_no của chương trình) — không nén cũng không giãn.
 *
 * Xem trước không đụng gì. "Sinh lịch tuần" ghi `course_instances.tiet_moi_tuan`, dựng lại
 * `course_weeks`, và (nếu có nhịp) cập nhật `ends_on` + neo lại bài giao theo buổi mới — luật ở
 * máy chủ (`CourseWeekController`), panel chỉ hiện lại câu trả lời.
 */
function NhipDayPanel({session,khoaId,ketThucKhoa}:{session:AuthSession;khoaId:number;ketThucKhoa:string}){
 const queryClient=useQueryClient();
 const [nhipDraft,setNhipDraft]=useState("");
 const nhipRaw=nhipDraft.trim();
 const nhipNum=/^\d+$/.test(nhipRaw)?Number(nhipRaw):null;
 const nhipHopLe=nhipNum!=null&&nhipNum>=1&&nhipNum<=20;
 const yeuCau:{tietMoiTuan?:number}=nhipNum!=null&&nhipNum>=1&&nhipNum<=20?{tietMoiTuan:nhipNum}:{};

 const xemQuery=useQuery({
  queryKey:["nhip-xem",session.accessToken,khoaId,nhipHopLe?nhipNum:"sgk"],
  queryFn:()=>xemTruocLichTuan(session,khoaId,yeuCau),
 });
 const kq=xemQuery.data;

 const [loi,setLoi]=useState("");
 const [xong,setXong]=useState<{ketThuc?:string;baiGiao?:number}|null>(null);
 useEffect(()=>{setXong(null);setLoi("");setNhipDraft("");},[khoaId]);

 const sinh=useMutation({
  mutationFn:()=>sinhLichTuan(session,khoaId,yeuCau),
  onSuccess:r=>{
   setLoi("");setXong({ketThuc:r.ngayKetThucKhoaDaCapNhat,baiGiao:r.baiGiaoDaDoi});
   void queryClient.invalidateQueries({queryKey:["admin-course-instances"]});
   void queryClient.invalidateQueries({queryKey:["nhip-xem"]});
  },
  onError:(e:Error)=>setLoi(e.message),
 });

 return <div className="km-table-box" style={{marginTop:16}}>
  <div className="km-table-title-row">
   <span className="km-label-caps">NHỊP DẠY & DỰ KIẾN HỌC XONG</span>
   <span className="km-table-hint">Chọn số tiết mỗi tuần; hệ thống tự tính số tuần cần và ngày học xong. Để trống = theo SGK.</span>
  </div>

  <div style={{display:"flex",gap:16,alignItems:"flex-end",flexWrap:"wrap",padding:"4px 0 12px"}}>
   <label style={{display:"grid",gap:4,fontSize:12,color:"var(--muted)"}}>
    Số tiết mỗi tuần
    <input type="number" min={1} max={20} className="km-input-date" style={{width:120}}
     placeholder="Theo SGK" value={nhipDraft} onChange={e=>setNhipDraft(e.target.value)}/>
   </label>
   {nhipRaw&&!nhipHopLe&&<span style={{fontSize:12,color:"#dc2626"}}>Nhập số nguyên 1–20.</span>}
  </div>

  {xemQuery.isLoading?<div className="km-empty-msg">Đang tính…</div>
   :xemQuery.isError?<div className="km-form-error">{messageOf(xemQuery.error)}</div>
   :kq?<>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
     <ThongSo nhan="Nhịp áp dụng" gt={kq.nhipMoiTuan?`${kq.nhipMoiTuan} tiết/tuần`:"Theo SGK"}/>
     <ThongSo nhan="Số tuần cần" gt={`${kq.soTuanCanThiet} tuần`}/>
     <ThongSo nhan="Dự kiến học xong" gt={kq.ngayHoanThanhDuKien?ngayVN(kq.ngayHoanThanhDuKien):"—"}/>
     <ThongSo nhan="Khóa kết thúc" gt={ngayVN(ketThucKhoa)}/>
     {kq.soTuanKhaDung!=null&&<ThongSo nhan="Số tuần khả dụng" gt={`${kq.soTuanKhaDung} tuần`}/>}
    </div>

    {kq.canhBao&&<div className="km-form-error" style={{marginTop:12}}>{kq.canhBao}</div>}
    {xong&&<div className="km-form-success" style={{marginTop:12}}>
     Đã sinh lại lịch tuần.{xong.ketThuc?` Ngày kết thúc khóa cập nhật thành ${ngayVN(xong.ketThuc)}.`:""}{xong.baiGiao?` ${xong.baiGiao} bài giao được neo lại theo buổi mới.`:""}
    </div>}
    {loi&&<div className="km-form-error" style={{marginTop:12}}>{loi}</div>}

    <div className="km-table-footer">
     <button type="button" className="km-btn-primary" disabled={sinh.isPending||(!!nhipRaw&&!nhipHopLe)}
      onClick={()=>{if(window.confirm("Sinh lại toàn bộ lịch tuần của khóa theo nhịp này? Bài giao đang neo theo buổi sẽ được cập nhật."))sinh.mutate();}}>
      {sinh.isPending?"Đang sinh…":"Sinh lịch tuần theo nhịp"}
     </button>
    </div>
   </>:null}
 </div>;
}


/**
 * LichTietPanel — Cấu hình lịch tiết học cho một khóa học triển khai.
 *
 * 3 sub-section:
 * 1. Lịch học trong tuần (thứ + số tiết/buổi)
 * 2. Ngày nghỉ riêng của khóa
 * 3. Preview và sinh lịch tiết
 */
const DAYS_OF_WEEK:[string,string][]=[
 ["MONDAY","Thứ Hai"],["TUESDAY","Thứ Ba"],["WEDNESDAY","Thứ Tư"],
 ["THURSDAY","Thứ Năm"],["FRIDAY","Thứ Sáu"],["SATURDAY","Thứ Bảy"],["SUNDAY","Chủ Nhật"]
];

function LichTietPanel({session,khoaId,khoaName}:{session:AuthSession;khoaId:number;khoaName:string}){
 const queryClient=useQueryClient();

 // --- Lịch tuần ---
 const slotsQ=useQuery({queryKey:["course-weekly-schedule",khoaId],queryFn:()=>getCourseWeeklySchedule(session,khoaId)});
 const [selectedDays,setSelectedDays]=useState<Record<string,number>>({});
 useEffect(()=>{
  if(slotsQ.data){
   const m:Record<string,number>={};
   slotsQ.data.forEach((s: any)=>{m[s.day_of_week]=s.period_count;});
   setSelectedDays(m);
  }
 },[slotsQ.data]);
 const saveSlotsM=useMutation({
  mutationFn:()=>saveCourseWeeklySchedule(session,khoaId,Object.entries(selectedDays).map(([d,c])=>({dayOfWeek:d,periodCount:c}))),
  onSuccess:()=>{void queryClient.invalidateQueries({queryKey:["course-weekly-schedule",khoaId]})},
 });

 // --- Ngày nghỉ ---
 const holidaysQ=useQuery({queryKey:["course-holidays",khoaId],queryFn:()=>getCourseHolidays(session,khoaId)});
 const [ngayNghiDraft,setNgayNghiDraft]=useState({name:"",startsOn:"",endsOn:"",type:"HOLIDAY"});
 const [loiNghi,setLoiNghi]=useState("");
 const addHolidayM=useMutation({
  mutationFn:()=>addCourseHoliday(session,khoaId,ngayNghiDraft),
  onSuccess:()=>{setNgayNghiDraft({name:"",startsOn:"",endsOn:"",type:"HOLIDAY"});setLoiNghi("");void queryClient.invalidateQueries({queryKey:["course-holidays",khoaId]})},
  onError:(e:Error)=>setLoiNghi(e.message),
 });
 const removeHolidayM=useMutation({
  mutationFn:(id:number)=>removeCourseHoliday(session,id),
  onSuccess:()=>{void queryClient.invalidateQueries({queryKey:["course-holidays",khoaId]})},
 });

 // --- Preview & Sinh lịch ---
 const [preview,setPreview]=useState<GeneratePreview|null>(null);
 const [previewLoading,setPreviewLoading]=useState(false);
 const [generateMsg,setGenerateMsg]=useState("");
 const [generateLoading,setGenerateLoading]=useState(false);

 async function doPreview(){
  setPreviewLoading(true);setPreview(null);
  try{const r=await previewCourseSessions(session,khoaId);setPreview(r);}
  catch(e:unknown){alert(e instanceof Error?e.message:"Lỗi xem trước");}
  finally{setPreviewLoading(false);}
 }
 async function doGenerate(){
  if(!confirm("Sinh lịch tiết sẽ xóa tất cả session chưa chỉnh tay và tạo lại. Tiếp tục?"))return;
  setGenerateLoading(true);setGenerateMsg("");
  try{
   const r=await generateCourseSessions(session,khoaId);
   setGenerateMsg(`✅ Đã sinh ${r.totalSessions} tiết. Dự kiến kết thúc: ${r.projectedEndDate??"-"}. ${r.warning??""}`.trim());
  }catch(e:unknown){setGenerateMsg("❌ "+(e instanceof Error?e.message:"Lỗi sinh lịch"));}
  finally{setGenerateLoading(false);}
 }

 return <div style={{display:"flex",flexDirection:"column",gap:24}}>
  <h3 style={{margin:0,fontSize:16,fontWeight:600}}>Lịch tiết học — {khoaName}</h3>

  {/* Section 1: Lịch tuần */}
  <div className="km-table-box">
   <div className="km-table-title-row">
    <span className="km-label-caps">1. LỊCH HỌC TRONG TUẦN</span>
    <span className="km-table-hint">Chọn thứ học và số tiết mỗi buổi (tối đa 10 tiết).</span>
   </div>
   <div style={{display:"flex",flexWrap:"wrap",gap:10,padding:"12px 0"}}>
    {DAYS_OF_WEEK.map(([key,label])=>{
     const checked=key in selectedDays;
     const count=selectedDays[key]??1;
     return <label key={key} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",border:`1px solid ${checked?"#6366f1":"#e5e7eb"}`,borderRadius:8,cursor:"pointer",background:checked?"#eef2ff":"#fff"}}>
      <input type="checkbox" checked={checked} onChange={e=>{
       if(e.target.checked)setSelectedDays({...selectedDays,[key]:1});
       else{const s={...selectedDays};delete s[key];setSelectedDays(s);}
      }}/>
      <span style={{fontWeight:500,fontSize:13}}>{label}</span>
      {checked&&<input type="number" min={1} max={10} value={count} style={{width:44,padding:"2px 4px",border:"1px solid #c7d2fe",borderRadius:4,fontSize:13}} onChange={e=>setSelectedDays({...selectedDays,[key]:Math.max(1,Math.min(10,Number(e.target.value)))})}/>}
      {checked&&<span style={{fontSize:12,color:"#6366f1"}}>tiết</span>}
     </label>;
    })}
   </div>
   <div style={{display:"flex",gap:8,alignItems:"center"}}>
    <button type="button" className="km-btn-primary" disabled={saveSlotsM.isPending||Object.keys(selectedDays).length===0} onClick={()=>saveSlotsM.mutate()}>
     {saveSlotsM.isPending?"Đang lưu…":"Lưu lịch tuần"}
    </button>
    {saveSlotsM.isSuccess&&<span style={{color:"#16a34a",fontSize:13}}>✓ Đã lưu</span>}
   </div>
  </div>

  {/* Section 2: Ngày nghỉ */}
  <div className="km-table-box">
   <div className="km-table-title-row">
    <span className="km-label-caps">2. NGÀY NGHỈ CỦA KHÓA</span>
    <span className="km-table-hint">Thêm ngày nghỉ riêng của khóa này (bổ sung cho academic_breaks đã có).</span>
   </div>
   {holidaysQ.data&&holidaysQ.data.length>0&&<table className="km-schedule-table" style={{marginBottom:12}}>
    <thead><tr><th>Tên</th><th>Từ</th><th>Đến</th><th>Loại</th><th style={{width:60}}></th></tr></thead>
    <tbody>{holidaysQ.data.map((h: any)=><tr key={h.id}>
     <td>{h.name}</td>
     <td>{h.starts_on}</td>
     <td>{h.ends_on}</td>
     <td><span style={{fontSize:12,padding:"2px 6px",borderRadius:4,background:"#fef3c7",color:"#92400e"}}>{h.type}</span></td>
     <td><button type="button" style={{color:"#dc2626",background:"none",border:"none",cursor:"pointer",fontSize:12}} onClick={()=>removeHolidayM.mutate(h.id)}>Xóa</button></td>
    </tr>)}</tbody>
   </table>}
   <div style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"flex-end",marginTop:8}}>
    <div className="km-field" style={{margin:0}}>
     <span className="km-field-label">TÊN NGÀY NGHỈ</span>
     <input className="km-field-input" placeholder="Ví dụ: Tết Nguyên Đán" value={ngayNghiDraft.name} onChange={e=>setNgayNghiDraft({...ngayNghiDraft,name:e.target.value})}/>
    </div>
    <div className="km-field" style={{margin:0}}>
     <span className="km-field-label">TỪ NGÀY</span>
     <input type="date" className="km-field-input" value={ngayNghiDraft.startsOn} onChange={e=>setNgayNghiDraft({...ngayNghiDraft,startsOn:e.target.value})}/>
    </div>
    <div className="km-field" style={{margin:0}}>
     <span className="km-field-label">ĐẾN NGÀY</span>
     <input type="date" className="km-field-input" value={ngayNghiDraft.endsOn} onChange={e=>setNgayNghiDraft({...ngayNghiDraft,endsOn:e.target.value})}/>
    </div>
    <button type="button" className="km-btn-primary" disabled={addHolidayM.isPending||!ngayNghiDraft.name||!ngayNghiDraft.startsOn} onClick={()=>addHolidayM.mutate()}>+ Thêm</button>
   </div>
   {loiNghi&&<div className="km-form-error" style={{marginTop:8}}>{loiNghi}</div>}
  </div>

  {/* Section 3: Preview & Sinh lịch */}
  <div className="km-table-box">
   <div className="km-table-title-row">
    <span className="km-label-caps">3. LỊCH TIẾT HỌC</span>
    <span className="km-table-hint">Xem trước trước khi sinh chính thức. Session chỉnh tay sẽ được bảo toàn.</span>
   </div>
   <div style={{display:"flex",gap:10,marginBottom:16}}>
    <button type="button" className="km-btn-primary" style={{background:"#6366f1"}} onClick={doPreview} disabled={previewLoading}>
     {previewLoading?"Đang tính…":"🔍 Xem trước lịch tiết"}
    </button>
    <button type="button" className="km-btn-primary" onClick={doGenerate} disabled={generateLoading}>
     {generateLoading?"Đang sinh…":"⚡ Sinh lịch tiết"}
    </button>
   </div>
   {generateMsg&&<div style={{padding:"8px 12px",borderRadius:6,background:generateMsg.startsWith("✅")?"#f0fdf4":"#fef2f2",color:generateMsg.startsWith("✅")?"#166534":"#991b1b",fontSize:13,marginBottom:12}}>{generateMsg}</div>}
   {preview&&<div style={{fontSize:13}}>
    <div style={{display:"flex",flexWrap:"wrap",gap:16,padding:12,background:"#f8fafc",borderRadius:8,marginBottom:12}}>
     <span>📊 Tổng tiết yêu cầu: <b>{preview.totalRequired}</b></span>
     <span>📅 Tiết khả dụng: <b>{preview.totalAvailable}</b></span>
     <span>✅ Đã sinh: <b>{preview.totalSessions}</b></span>
     <span>🔒 Chỉnh tay (bảo toàn): <b>{preview.manualSessionsPreserved}</b></span>
     {preview.projectedEndDate&&<span>🏁 Dự kiến xong: <b>{preview.projectedEndDate}</b></span>}
     <span style={{color:preview.feasible?"#16a34a":"#dc2626",fontWeight:600}}>
      {preview.feasible?"✅ Đủ thời lượng":"⚠️ Thiếu thời lượng"}
     </span>
    </div>
    {preview.warning&&<div style={{padding:"8px 12px",borderRadius:6,background:"#fffbeb",color:"#92400e",border:"1px solid #fde68a",marginBottom:12}}>{preview.warning}</div>}
    {preview.sessions&&preview.sessions.length>0&&<div>
     <div style={{fontWeight:600,marginBottom:6}}>Xem trước tối đa 300 tiết đầu:</div>
     <div style={{maxHeight:320,overflowY:"auto"}}>
      <table className="km-schedule-table">
       <thead><tr><th>Tuần</th><th>Ngày</th><th>Thứ tự</th><th>Tiết</th><th>Mạch</th></tr></thead>
       <tbody>{preview.sessions.map((s: any,i: number)=><tr key={i} style={s.edited_manually?{background:"#fef3c7"}:{}}>
        <td>{s.instructional_week_number}</td>
        <td>{s.planned_date}</td>
        <td>{s.planned_order_on_date}</td>
        <td style={{fontSize:12}}>{s.period_title||`#${s.program_period_id}`}</td>
        <td style={{fontSize:12}}>{s.strand_name||"-"}</td>
       </tr>)}</tbody>
      </table>
     </div>
    </div>}
   </div>}
  </div>
 </div>;
}

/**
 * "Khóa học" (course_instances) là TẦNG 3 — lần chạy một mẫu chương trình theo năm học, tầng
 * duy nhất có ngày. Lịch chương (program_schedules) neo mỗi chương vào một khoảng ngày của khóa.
 *
 * Mẫu chương trình (program_templates) là điều kiện cần: không có mẫu thì không tạo được khóa.
 * Panel tạo mẫu ở đây chỉ ghi phần khung (chương trình + tên); cấu hình chương của mẫu
 * (program_template_chapters) là việc riêng, lịch chương không đọc tới nó.
 *
 * Luật (ngày ngược, chồng lấp, chương lạ chương trình) để nguyên ở máy chủ — panel chỉ gửi các
 * hàng có đủ hai ngày rồi hiện lại câu trả lời. Chép luật sang đây là có hai bản, bản ở đây mục trước.
 */
function KhoaHocManagement({session}:{session:AuthSession}){
 const queryClient=useQueryClient();
 const [activeTab,setActiveTab]=useState<"khoa"|"mau">("khoa");
 const [treeSearch,setTreeSearch]=useState("");

 const khoaQuery=useQuery({queryKey:["admin-course-instances",session.accessToken],queryFn:()=>getCourseInstances(session)});
 const khoaList=khoaQuery.data??[];
 const mauQuery=useQuery({queryKey:["admin-program-templates",session.accessToken],queryFn:()=>getProgramTemplates(session)});
 const mauList=mauQuery.data??[];
 const ctQuery=useQuery({queryKey:["admin-curriculum-courses",session.accessToken],queryFn:()=>getCourses(session)});
 const ctList=ctQuery.data??[];
 const tenChuongTrinh=(programId:number)=>ctList.find(c=>c.id===programId)?.name??`#${programId}`;

 const [selectedId,setSelectedId]=useState<number|null>(()=>{const target=getAdminDestination();return target?.section==="course-instances"?target.courseId:null});
 const khoa=khoaList.find(x=>x.id===selectedId)||null;

 useEffect(()=>{
  if(selectedId===null&&khoaList.length>0){
   setSelectedId(khoaList[0].id);
  }
 },[khoaList,selectedId]);

 const emptyMauDraft={programId:0,name:"",description:"",status:"DRAFT"};
 const [mauDraft,setMauDraft]=useState(emptyMauDraft);
 const [loiMau,setLoiMau]=useState("");
 const [showMauForm,setShowMauForm]=useState(false);
 const taoMau=useMutation({
  mutationFn:()=>createProgramTemplate(session,{...mauDraft,programId:Number(mauDraft.programId)}),
  onSuccess:()=>{setMauDraft(emptyMauDraft);setLoiMau("");setShowMauForm(false);void queryClient.invalidateQueries({queryKey:["admin-program-templates"]})},
  onError:(e:Error)=>setLoiMau(e.message),
 });

 // Chỉ lưu templateId + name + status — không lưu ngày/năm học (thuộc Class)
 const emptyDraft={templateId:0,name:"",status:"DRAFT"};
 const [draft,setDraft]=useState(emptyDraft);
 const [loiTao,setLoiTao]=useState("");
 const [showKhoaForm,setShowKhoaForm]=useState(false);
 const [editingKhoaId,setEditingKhoaId]=useState<number|null>(null);
 const tao=useMutation({
  mutationFn:()=>createCourseInstance(session,{...draft,templateId:Number(draft.templateId),schoolYear:"",startsOn:"",endsOn:""}),
  onSuccess:(created:CourseInstance)=>{
   setDraft(emptyDraft);setLoiTao("");setShowKhoaForm(false);setEditingKhoaId(null);
   void queryClient.invalidateQueries({queryKey:["admin-course-instances"]});
   if(created?.id)setSelectedId(created.id);
  },
  onError:(e:Error)=>setLoiTao(e.message),
 });
 const sua=useMutation({
  mutationFn:()=>updateCourseInstance(session,editingKhoaId!,{...draft,templateId:Number(draft.templateId),schoolYear:"",startsOn:"",endsOn:""}),
  onSuccess:(updated:CourseInstance)=>{
   setDraft(emptyDraft);setLoiTao("");setShowKhoaForm(false);setEditingKhoaId(null);
   void queryClient.invalidateQueries({queryKey:["admin-course-instances"]});
   if(updated?.id)setSelectedId(updated.id);
  },
  onError:(e:Error)=>setLoiTao(e.message),
 });
 const xoa=useMutation({
  mutationFn:(id:number)=>deleteCourseInstance(session,id),
  onSuccess:(_,deletedId)=>{
   void queryClient.invalidateQueries({queryKey:["admin-course-instances"]});
   if(selectedId===deletedId){
    const remaining=khoaList.filter(x=>x.id!==deletedId);
    setSelectedId(remaining.length>0?remaining[0].id:null);
   }
  },
  onError:(e:Error)=>alert("Không thể xóa khóa học: "+e.message),
 });
 const moTaoKhoa=()=>{
  setEditingKhoaId(null);
  setDraft(emptyDraft);
  setLoiTao("");
  setShowKhoaForm(true);
 };
 const moSuaKhoa=(item:CourseInstance)=>{
  setEditingKhoaId(item.id);
  setDraft({templateId:item.template_id,name:item.name,status:item.status});
  setLoiTao("");
  setShowKhoaForm(true);
 };

 const mau=khoa?mauList.find(x=>x.id===khoa.template_id)||null:null;

 const BADGE_CLASS:Record<string,string>={
  DRAFT:"km-tag-draft",
  ACTIVE:"km-tag-active",
  ARCHIVED:"km-tag-archived"
 };

 return <section className="curriculum-workspace">
  <div className="cw-shell">
   {/* Cột trái: Danh sách khóa học / mẫu chương trình (cw-tree) */}
   <aside className="cw-tree">
    <div className="cw-tree-top">
     <button
      type="button"
      className="cw-prog-add-btn"
      onClick={()=>{
       if(activeTab==="khoa"){ moTaoKhoa(); }
       else { setShowMauForm(true); setLoiMau(""); }
      }}
     >
      <Plus size={15}/> {activeTab==="khoa" ? "Thêm khóa học" : "Thêm mẫu chương trình"}
     </button>
    </div>

    {/* Nút chuyển đổi nhanh Khóa học / Mẫu chương trình */}
    <div style={{display:"flex",padding:"8px 10px 4px",gap:6}}>
     <button
      type="button"
      className={`cw-quick-btn ${activeTab==="khoa"?"active":""}`}
      style={{
       flex:1,
       justifyContent:"center",
       height:30,
       fontWeight:activeTab==="khoa"?700:500,
       borderColor:activeTab==="khoa"?"var(--primary)":"#e2e8f0",
       background:activeTab==="khoa"?"#eef6f2":"#fff",
       color:activeTab==="khoa"?"var(--primary)":"#334155"
      }}
      onClick={()=>setActiveTab("khoa")}
     >
      Khóa học ({khoaList.length})
     </button>
     <button
      type="button"
      className={`cw-quick-btn ${activeTab==="mau"?"active":""}`}
      style={{
       flex:1,
       justifyContent:"center",
       height:30,
       fontWeight:activeTab==="mau"?700:500,
       borderColor:activeTab==="mau"?"var(--primary)":"#e2e8f0",
       background:activeTab==="mau"?"#eef6f2":"#fff",
       color:activeTab==="mau"?"var(--primary)":"#334155"
      }}
      onClick={()=>setActiveTab("mau")}
     >
      Mẫu ({mauList.length})
     </button>
    </div>

    {/* Thanh tìm kiếm */}
    <div className="cw-prog-search-wrap">
     <Search size={13}/>
     <input
      placeholder={activeTab==="khoa"?"Tìm khóa học...":"Tìm mẫu chương trình..."}
      value={treeSearch}
      onChange={e=>setTreeSearch(e.target.value)}
     />
    </div>

    {/* Danh sách các mục */}
    <div className="cw-prog-list">
     {activeTab==="khoa" ? (
      khoaList
       .filter(k=>!treeSearch.trim()||k.name.toLocaleLowerCase("vi").includes(treeSearch.trim().toLocaleLowerCase("vi"))||(k.template_name&&k.template_name.toLocaleLowerCase("vi").includes(treeSearch.trim().toLocaleLowerCase("vi"))))
       .map(x=>{
        const isSelected=x.id===selectedId;
        return <div
         key={x.id}
         className={`cw-prog-item ${isSelected?"active":""}`}
         onClick={()=>setSelectedId(x.id)}
        >
         <div className="cw-prog-icon"><GraduationCap size={16}/></div>
         <div className="cw-prog-info">
          <b>{x.name}</b>
          <small>{x.template_name||"Chưa gán mẫu"}</small>
         </div>
         <span className={`cw-prog-badge ${x.status==="ACTIVE"||x.status==="PUBLISHED"?"pub":"dft"}`}>
          {nhanTrangThaiKhoa(x.status)}
         </span>
         {isSelected&&<CheckCircle size={15} className="cw-prog-check"/>}
        </div>;
       })
     ) : (
      mauList
       .filter(m=>!treeSearch.trim()||m.name.toLocaleLowerCase("vi").includes(treeSearch.trim().toLocaleLowerCase("vi"))||tenChuongTrinh(m.program_id).toLocaleLowerCase("vi").includes(treeSearch.trim().toLocaleLowerCase("vi")))
       .map(m=>{
        const countUsed=khoaList.filter(k=>k.template_id===m.id).length;
        return <div key={m.id} className="cw-prog-item">
         <div className="cw-prog-icon"><BookOpen size={16}/></div>
         <div className="cw-prog-info">
          <b>{m.name}</b>
          <small>{tenChuongTrinh(m.program_id)} · {countUsed} khóa</small>
         </div>
         <span className={`cw-prog-badge ${m.status==="ACTIVE"||m.status==="PUBLISHED"?"pub":"dft"}`}>
          {nhanTrangThaiKhoa(m.status)}
         </span>
        </div>;
       })
     )}
     {activeTab==="khoa"&&!khoaList.length&&<div className="cw-prog-empty">Chưa có khóa học nào</div>}
     {activeTab==="mau"&&!mauList.length&&<div className="cw-prog-empty">Chưa có mẫu nào</div>}
    </div>
   </aside>

   {/* Cột phải: Khung Canvas y hệt Chương trình */}
   {activeTab==="khoa" ? (
    !khoa ? (
     <main className="cw-canvas">
      <div className="cw-empty-state">
       <h3>Chưa chọn khóa học</h3>
       <p>Chọn một khóa học từ danh sách bên trái hoặc bấm &ldquo;Thêm khóa học&rdquo; để bắt đầu.</p>
      </div>
     </main>
    ) : (
     <KhoaHocDetailPanel
      session={session}
      khoa={khoa}
      mauName={khoa.template_name ?? null}
      onEdit={()=>moSuaKhoa(khoa)}
      onDelete={()=>{
       if(confirm(`Bạn có chắc chắn muốn xóa khóa học "${khoa.name}"?`)){
        xoa.mutate(khoa.id);
       }
      }}
     />
    )
   ) : (
    <main className="cw-canvas">
     <div className="cw-canvas-header">
      <div className="cw-canvas-title-area">
       <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.05em",color:"#64748b",textTransform:"uppercase"}}>MẪU CHƯƠNG TRÌNH</div>
       <h1 className="cw-canvas-title">Danh sách mẫu chương trình đào tạo</h1>
       <div className="cw-smart-meta-bar">
        <span className="cw-meta-pill primary">Tổng số: {mauList.length} mẫu</span>
        <span className="cw-meta-dot"/>
        <span>Mỗi khóa học được đóng gói dựa trên một mẫu chương trình định sẵn</span>
       </div>
      </div>
      <div className="cw-canvas-actions">
       <button type="button" className="cw-btn-primary" onClick={()=>{setShowMauForm(true);setLoiMau("");}}>
        <Plus size={14}/> Tạo mẫu chương trình
       </button>
      </div>
     </div>

     <div className="cw-canvas-body">
      <div className="cw-clean-table-wrap">
       <table className="cw-clean-table">
        <thead>
         <tr>
          <th style={{width:60}}>ID</th>
          <th>TÊN MẪU CHƯƠNG TRÌNH</th>
          <th>THUỘC CHƯƠNG TRÌNH GỐC</th>
          <th style={{width:130}}>TRẠNG THÁI</th>
          <th style={{width:150}}>SỐ KHÓA ĐANG DÙNG</th>
         </tr>
        </thead>
        <tbody>
         {mauList.map(m=>{
          const countUsed=khoaList.filter(k=>k.template_id===m.id).length;
          return <tr key={m.id}>
           <td style={{fontWeight:600,color:"#64748b"}}>#{m.id}</td>
           <td><b>{m.name}</b></td>
           <td>{tenChuongTrinh(m.program_id)}</td>
           <td><span className={`cw-badge ${m.status==="ACTIVE"||m.status==="PUBLISHED"?"cw-badge-active":"cw-badge-draft"}`}>{nhanTrangThaiKhoa(m.status)}</span></td>
           <td><span style={{fontWeight:600,color:"var(--primary)"}}>{countUsed} khóa</span></td>
          </tr>;
         })}
         {!mauList.length&&<tr><td colSpan={5} style={{textAlign:"center",padding:28,color:"#94a3b8"}}>Chưa có mẫu nào</td></tr>}
        </tbody>
       </table>
      </div>
     </div>
    </main>
   )}
  </div>


  {/* MODAL TẠO / SỬA KHÓA HỌC */}
  {showKhoaForm&&<div className="km-dialog-overlay" onMouseDown={e=>{if(e.target===e.currentTarget){setShowKhoaForm(false);setEditingKhoaId(null)}}}>
   <div className="km-dialog">
    <div className="km-dialog-head">
     <div>
      <div className="km-eyebrow">{editingKhoaId?"CHỈNH SỬA KHÓA HỌC":"THIẾT LẬP MỚI"}</div>
      <h3 className="km-dialog-title">{editingKhoaId?`Sửa khóa: ${draft.name||"..."}` :"Tạo khóa học"}</h3>
     </div>
     <button type="button" className="km-close-btn" onClick={()=>{setShowKhoaForm(false);setEditingKhoaId(null)}}>✕</button>
    </div>

    <form onSubmit={e=>{e.preventDefault();if(editingKhoaId){sua.mutate()}else{tao.mutate()}}}>
     <div className="km-dialog-body">
      <div className="km-field">
       <span className="km-field-label">MẪU CHƯƠNG TRÌNH</span>
       <select required className="km-field-input" value={draft.templateId} onChange={e=>{setDraft({...draft,templateId:Number(e.target.value)});setLoiTao("")}}>
        <option value={0}>Chọn mẫu chương trình…</option>
        {mauList.map(m=><option key={m.id} value={m.id}>{m.name} · {tenChuongTrinh(m.program_id)}</option>)}
       </select>
      </div>

      <div className="km-field">
       <span className="km-field-label">TÊN KHÓA HỌC</span>
       <input required maxLength={255} className="km-field-input" placeholder="Ví dụ: Toán 10 — Khối sáng" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/>
      </div>

      <div className="km-field">
       <span className="km-field-label">TRẠNG THÁI</span>
       <select className="km-field-input" value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}>
        {BANG_TRANG_THAI_KHOA.map(([v,l])=><option key={v} value={v}>{l}</option>)}
       </select>
      </div>

      {loiTao&&<div className="km-form-error">{loiTao}</div>}
     </div>

     <div className="km-dialog-foot">
      <button type="button" className="km-btn-ghost" onClick={()=>{setShowKhoaForm(false);setDraft(emptyDraft);setEditingKhoaId(null)}}>Hủy</button>
      <button type="submit" className="km-btn-primary" disabled={(editingKhoaId?sua.isPending:tao.isPending)||!mauList.length}>
       {editingKhoaId?(sua.isPending?"Đang lưu…":"Lưu thay đổi"):(tao.isPending?"Đang tạo…":"Tạo khóa học")}
      </button>
     </div>
    </form>
   </div>
  </div>}

  {/* MODAL TẠO MẪU CHƯƠNG TRÌNH */}
  {showMauForm&&<div className="km-dialog-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setShowMauForm(false)}}>
   <div className="km-dialog">
    <div className="km-dialog-head">
     <div>
      <div className="km-eyebrow">THIẾT LẬP MỚI</div>
      <h3 className="km-dialog-title">Tạo mẫu chương trình</h3>
     </div>
     <button type="button" className="km-close-btn" onClick={()=>setShowMauForm(false)}>✕</button>
    </div>

    <form onSubmit={e=>{e.preventDefault();taoMau.mutate()}}>
     <div className="km-dialog-body">
      <div className="km-field">
       <span className="km-field-label">CHƯƠNG TRÌNH GỐC</span>
       <select required className="km-field-input" value={mauDraft.programId} onChange={e=>{setMauDraft({...mauDraft,programId:Number(e.target.value)});setLoiMau("")}}>
        <option value={0}>Chọn chương trình…</option>
        {ctList.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
       </select>
      </div>

      <div className="km-field">
       <span className="km-field-label">TÊN MẪU CHƯƠNG TRÌNH</span>
       <input required maxLength={255} className="km-field-input" placeholder="Ví dụ: Toán 10 — Chuẩn" value={mauDraft.name} onChange={e=>setMauDraft({...mauDraft,name:e.target.value})}/>
      </div>

      <div className="km-field">
       <span className="km-field-label">TRẠNG THÁI</span>
       <select className="km-field-input" value={mauDraft.status} onChange={e=>setMauDraft({...mauDraft,status:e.target.value})}>
        {BANG_TRANG_THAI_KHOA.map(([v,l])=><option key={v} value={v}>{l}</option>)}
       </select>
      </div>

      {loiMau&&<div className="km-form-error">{loiMau}</div>}
     </div>

     <div className="km-dialog-foot">
      <button type="button" className="km-btn-ghost" onClick={()=>{setShowMauForm(false);setMauDraft(emptyMauDraft)}}>Hủy</button>
      <button type="submit" className="km-btn-primary" disabled={taoMau.isPending||!ctList.length}>{taoMau.isPending?"Đang tạo…":"Tạo mẫu chương trình"}</button>
     </div>
    </form>
   </div>
  </div>}

 </section>;
}

/**
 * Kỳ nghỉ gắn vào khóa chứ không vào chương trình: hai khóa của cùng một chương trình vẫn có thể
 * nghỉ khác nhau. Nên panel này bắt chọn khóa trước, không mượn chương trình đang mở ở cây bên trên
 * — mượn thì Admin tưởng đang đặt lịch nghỉ cho khóa mình nhìn thấy, mà thật ra đặt cho cái khác.
 *
 * Việc kiểm tra (ngày ngược, thiếu lý do, nghỉ nằm ngoài khoảng của khóa) để nguyên ở máy chủ và
 * panel chỉ hiện lại câu trả lời: chép luật sang đây là có hai bản luật, và bản ở đây sẽ mục trước.
 */
function KyNghiPanel({session}:{session:AuthSession}){
 const queryClient=useQueryClient();
 const khoaQuery=useQuery({queryKey:["admin-course-instances",session.accessToken],queryFn:()=>getCourseInstances(session)});
 const khoaList=khoaQuery.data??[];
 const [khoaId,setKhoaId]=useState(0);
 const khoa=khoaList.find(x=>x.id===khoaId)||null;
 const [draft,setDraft]=useState({startsOn:"",endsOn:"",reason:""});
 const [loi,setLoi]=useState("");
 const breaksQuery=useQuery({queryKey:["academic-breaks",khoaId],queryFn:()=>getAcademicBreaks(session,khoaId),enabled:khoaId>0});
 const breaks=breaksQuery.data??[];
 const lamMoi=()=>{setLoi("");void queryClient.invalidateQueries({queryKey:["academic-breaks",khoaId]})};
 const them=useMutation({mutationFn:()=>addAcademicBreak(session,khoaId,draft),onSuccess:()=>{setDraft({startsOn:"",endsOn:"",reason:""});lamMoi()},onError:(e:Error)=>setLoi(e.message)});
 const go=useMutation({mutationFn:(id:number)=>removeAcademicBreak(session,id),onSuccess:lamMoi,onError:(e:Error)=>setLoi(e.message)});
 return <section className="live-grid teacher-live">
  <article>
   <h2>Đặt kỳ nghỉ</h2>
   <form className="live-form" onSubmit={event=>{event.preventDefault();them.mutate()}}>
    <label>Khóa<select required value={khoaId} onChange={event=>{setKhoaId(Number(event.target.value));setLoi("")}}>
     <option value={0}>Chọn khóa</option>
     {khoaList.map(x=><option key={x.id} value={x.id}>{x.name} · {x.school_year}</option>)}
    </select></label>
    {/* Nêu sẵn khoảng của khóa: kỳ nghỉ phải nằm trong đó, biết trước thì không phải đoán rồi bị chặn. */}
    {khoa&&<p className="text-sm text-on-surface-variant">Khóa chạy {ngayVN(khoa.starts_on)} – {ngayVN(khoa.ends_on)}.</p>}
    <label>Từ ngày<input required type="date" value={draft.startsOn} onChange={event=>setDraft({...draft,startsOn:event.target.value})}/></label>
    <label>Đến hết ngày<input required type="date" value={draft.endsOn} onChange={event=>setDraft({...draft,endsOn:event.target.value})}/></label>
    {/* Lý do là dòng chữ học sinh đọc trên màn hình "đang nghỉ", nên không để trống được. */}
    <label>Lý do<input required maxLength={200} placeholder="Nghỉ Tết Nguyên đán" value={draft.reason} onChange={event=>setDraft({...draft,reason:event.target.value})}/></label>
    <div className="live-actions"><button className="primary" disabled={!khoaId||them.isPending}>{them.isPending?"Đang lưu…":"Thêm kỳ nghỉ"}</button></div>
    {loi&&<p className="text-sm font-semibold text-error">{loi}</p>}
   </form>
  </article>
  <article>
   <h2>Kỳ nghỉ đã đặt ({breaks.length})</h2>
   {!khoaId&&<EmptyState text="Chọn một khóa để xem kỳ nghỉ."/>}
   {khoaId>0&&breaksQuery.isLoading&&<p>Đang tải dữ liệu…</p>}
   {khoaId>0&&!breaksQuery.isLoading&&!breaks.length&&<EmptyState text="Khóa này chưa đặt kỳ nghỉ nào."/>}
   {breaks.map(x=><div className="live-row" key={x.id}>
    <div><small>{ngayVN(x.starts_on)} – {ngayVN(x.ends_on)}</small><b>{x.reason}</b><span>Học lại {ngayDiHocLai(x.ends_on)}</span></div>
    <div className="row-actions"><button className="danger-link" disabled={go.isPending} onClick={()=>{if(confirm(`Gỡ kỳ nghỉ “${x.reason}”? Những ngày này sẽ tính là ngày học.`))go.mutate(x.id)}}>Gỡ</button></div>
   </div>)}
  </article>
 </section>;
}

function CurriculumWorkspace({session,metadata}:{session:AuthSession;metadata:Metadata|null}){
 const queryClient=useQueryClient();
 const coursesQuery=useQuery({queryKey:["curriculum-courses",session.accessToken],queryFn:()=>getCourses(session)});
 const courses=coursesQuery.data??[];
 const [selectedCourseId,setSelectedCourseId]=useState<number|null>(()=>{const target=getAdminDestination();return target?.section==="programs"?target.programId:null});
 const [expandedChapters,setExpandedChapters]=useState<Set<number>>(new Set());
 const [isNavCollapsed,setIsNavCollapsed]=useState<boolean>(()=>selectedCourseId!==null||window.matchMedia("(max-width: 1023px)").matches);
 useEffect(()=>{
  const media=window.matchMedia("(max-width: 1023px)");
  const collapseOnNarrowScreen=()=>{if(media.matches)setIsNavCollapsed(true);};
  media.addEventListener("change",collapseOnNarrowScreen);
  return ()=>media.removeEventListener("change",collapseOnNarrowScreen);
 },[]);
 const [navSearch,setNavSearch]=useState("");
 const [chapterSearch,setChapterSearch]=useState("");
 const [sortBy,setSortBy]=useState<"order"|"name"|"lessons">("order");
 const [activeMenu,setActiveMenu]=useState<{type:"chapter"|"lesson";id:number}|null>(null);
 const [previewLesson,setPreviewLesson]=useState<Lesson|null>(null);

 const [showNewCourseForm,setShowNewCourseForm]=useState(false);
 const [showNewChapterForm,setShowNewChapterForm]=useState(false);
 const [showNewLessonForm,setShowNewLessonForm]=useState(false);
 const [editingCourse,setEditingCourse]=useState<Course|null>(null);
 const [editingChapter,setEditingChapter]=useState<Chapter|null>(null);
 const [editingLesson,setEditingLesson]=useState<Lesson|null>(null);
 const [courseDraft,setCourseDraft]=useState<CourseInput>({code:"",name:"",description:"",status:"ACTIVE"});
 const [chapterDraft,setChapterDraft]=useState<ChapterInput>({courseId:0,title:"",orderIndex:1,status:"ACTIVE"});
 const [lessonDraft,setLessonDraft]=useState<LessonInput>({chapterId:0,title:"",publicCode:"",summary:"",contentHtml:"",orderIndex:1,status:"PUBLISHED"});
 const [showPpctImportModal,setShowPpctImportModal]=useState(false);
 const [showPhanPhoiTiet,setShowPhanPhoiTiet]=useState(false);
 const [bulkImport,setBulkImport]=useState(false);
 const [documentLesson,setDocumentLesson]=useState<Lesson|null>(null);
 const [worksheetLesson,setWorksheetLesson]=useState<Lesson|null>(null);
 const [resourceLesson,setResourceLesson]=useState<Lesson|null>(null);

 const handleSelectCourse=(courseId:number)=>{
  setSelectedCourseId(courseId);
  setIsNavCollapsed(true); // Lúc chọn rồi thì nhỏ
 };

 const handleDeselectCourse=()=>{
  setSelectedCourseId(null);
  setIsNavCollapsed(false); // Lúc chưa chọn thì to
 };

 // Listen to external admin navigation
 useEffect(()=>{
  const target=getAdminDestination();
  if(target?.section==="programs"&&target.programId&&target.programId!==selectedCourseId){
    setSelectedCourseId(target.programId);
    setIsNavCollapsed(true);
  }
 },[selectedCourseId]);

 const selectedCourse=courses.find(x=>x.id===selectedCourseId)||null;

 const chaptersQuery=useQuery({queryKey:["workspace-chapters",session.accessToken,selectedCourseId],queryFn:()=>getChapters(session,selectedCourseId!),enabled:!!selectedCourseId});
 const chapters=chaptersQuery.data??[];

 const allLessonsQuery=useQuery({queryKey:["workspace-all-lessons",session.accessToken,chapters.map(x=>x.id)],queryFn:async()=>{
  const result=await Promise.all(chapters.map(async chapter=>[chapter.id,await getLessons(session,chapter.id)] as const));
  return Object.fromEntries(result) as Record<number,Lesson[]>;
 },enabled:chapters.length>0});

 const topicsQuery=useQuery({queryKey:["workspace-topics",session.accessToken],queryFn:()=>getTopics(session)});
 const topics=topicsQuery.data??[];

 // Expand Chapter 1 by default when chapters load
 useEffect(()=>{
  if(chapters.length>0&&expandedChapters.size===0){
    setExpandedChapters(new Set([chapters[0].id]));
  }
 },[chapters]);

 // Auto expand matching chapters when searching
 useEffect(()=>{
  if(chapterSearch.trim()&&chapters.length>0){
    const q=chapterSearch.trim().toLocaleLowerCase("vi");
    const matched=new Set<number>();
    chapters.forEach(c=>{
      const cLessons=allLessonsQuery.data?.[c.id]||[];
      if(c.title.toLocaleLowerCase("vi").includes(q)||cLessons.some(l=>l.title.toLocaleLowerCase("vi").includes(q))){
        matched.add(c.id);
      }
    });
    if(matched.size>0){
      setExpandedChapters(prev=>new Set([...prev,...matched]));
    }
  }
 },[chapterSearch,chapters,allLessonsQuery.data]);

 // Click outside listener for more actions menu
 useEffect(()=>{
  if(!activeMenu)return;
  const handleClickOutside=()=>setActiveMenu(null);
  window.addEventListener("click",handleClickOutside);
  return ()=>window.removeEventListener("click",handleClickOutside);
 },[activeMenu]);

 const courseStatusOptions=metadataOptions(metadata,"courseStatuses");
 const publishStatusOptions=metadataOptions(metadata,"publishStatuses");
 const statusLabel=(value:string)=>publishStatusOptions.find(option=>option.value===value)?.label||value;
 const courseStatusLabel=(value:string)=>courseStatusOptions.find(option=>option.value===value)?.label||value;

 const invalidateAll=()=>{
  queryClient.invalidateQueries({queryKey:["workspace-chapters"]});
  queryClient.invalidateQueries({queryKey:["workspace-lessons"]});
  queryClient.invalidateQueries({queryKey:["workspace-all-lessons"]});
  queryClient.invalidateQueries({queryKey:["workspace-ppct-tree"]});
  queryClient.invalidateQueries({queryKey:["curriculum-courses"]});
 };

 const handleUpdateLessonHtml=async(lessonId:number,contentHtml:string,newTitle?:string,newSummary?:string)=>{
  const target=previewLesson?.id===lessonId?previewLesson:null;
  if(!target)return;
  const updated=await updateLesson(session,lessonId,{
   chapterId:target.chapterId,
   title:newTitle&&newTitle.trim()?newTitle.trim():target.title,
   publicCode:target.publicCode||"",
   orderIndex:target.orderIndex,
   status:target.status||"PUBLISHED",
   summary:newSummary!==undefined?newSummary:(target.summary||""),
   contentHtml,
  });
  setPreviewLesson(updated);
  invalidateAll();
 };

 const saveCourse=async(e:React.FormEvent)=>{e.preventDefault();try{if(editingCourse){await updateCourse(session,editingCourse.id,courseDraft)}else{await createCourse(session,courseDraft)}setCourseDraft(emptyCourse(metadata));setEditingCourse(null);setShowNewCourseForm(false);invalidateAll();}catch{}};
 const saveChapter=async(e:React.FormEvent)=>{e.preventDefault();if(!selectedCourseId)return;try{if(editingChapter){await updateChapter(session,editingChapter.id,{...chapterDraft,status:"ACTIVE"})}else{await createChapter(session,{...chapterDraft,courseId:selectedCourseId,status:"ACTIVE"})}setChapterDraft({courseId:selectedCourseId,title:"",orderIndex:chapters.length+2,status:"ACTIVE"});setEditingChapter(null);setShowNewChapterForm(false);invalidateAll();}catch{}};
 const saveLesson=async(e:React.FormEvent)=>{e.preventDefault();if(!editingLesson&&!chapterDraft.courseId&&chapters.length>0)return;try{if(editingLesson){await updateLesson(session,editingLesson.id,{...lessonDraft,status:editingLesson.status||"PUBLISHED"})}else{await createLesson(session,{...lessonDraft,status:"PUBLISHED"})}setLessonDraft({chapterId:0,title:"",publicCode:"",summary:"",contentHtml:"",orderIndex:1,status:"PUBLISHED"});setEditingLesson(null);setShowNewLessonForm(false);invalidateAll();}catch{}};

 const removeCourse=async(course:Course)=>{const count=await getChapters(session,course.id).catch(()=>[]);if(count.length>0){alert(`Chương trình "${course.name}" còn ${count.length} chương. Xóa hết các chương trước.`);return;}if(!window.confirm(`Xóa chương trình "${course.name}"?`))return;try{await deleteCourse(session,course.id);setSelectedCourseId(null);invalidateAll();}catch{}};
 const removeChapter=async(chapter:Chapter)=>{const items=await getLessons(session,chapter.id).catch(()=>[]);if(items.length>0){alert(`Chương "${chapter.title}" còn ${items.length} bài học. Xóa hết bài học trước.`);return;}if(!window.confirm(`Xóa chương "${chapter.title}"?`))return;try{await deleteChapter(session,chapter.id);invalidateAll();}catch{}};
 const removeLesson=async(lesson:Lesson)=>{if(!window.confirm(`Xóa bài học "${lesson.title}"?`))return;try{await deleteLesson(session,lesson.id);if(previewLesson?.id===lesson.id)setPreviewLesson(null);invalidateAll();}catch{}};

 const toggleChapter=(id:number)=>setExpandedChapters(prev=>{const next=new Set(prev);next.has(id)?next.delete(id):next.add(id);return next;});
 const allChaptersExpanded=chapters.length>0&&chapters.every(chapter=>expandedChapters.has(chapter.id));

 const error=coursesQuery.isError?messageOf(coursesQuery.error):chaptersQuery.isError?messageOf(chaptersQuery.error):topicsQuery.isError?messageOf(topicsQuery.error):"";

 const totalLessons=useMemo(()=>{
  return chapters.reduce((sum,ch)=>sum+((allLessonsQuery.data?.[ch.id]||[]).length),0);
 },[chapters,allLessonsQuery.data]);

 const filteredCourses=useMemo(()=>{
  if(!navSearch.trim())return courses;
  const q=navSearch.trim().toLocaleLowerCase("vi");
  return courses.filter(c=>c.name.toLocaleLowerCase("vi").includes(q)||c.code.toLocaleLowerCase("vi").includes(q));
 },[courses,navSearch]);

 const filteredChapters=useMemo(()=>{
  let list=[...chapters];
  if(chapterSearch.trim()){
    const q=chapterSearch.trim().toLocaleLowerCase("vi");
    list=list.filter(c=>{
      const matchChapter=c.title.toLocaleLowerCase("vi").includes(q);
      const cLessons=allLessonsQuery.data?.[c.id]||[];
      const matchLesson=cLessons.some(l=>l.title.toLocaleLowerCase("vi").includes(q)||(l.publicCode&&l.publicCode.toLocaleLowerCase("vi").includes(q)));
      return matchChapter||matchLesson;
    });
  }
  if(sortBy==="name"){
    list.sort((a,b)=>a.title.localeCompare(b.title,"vi"));
  }else if(sortBy==="lessons"){
    list.sort((a,b)=>{
      const countA=(allLessonsQuery.data?.[a.id]||[]).length;
      const countB=(allLessonsQuery.data?.[b.id]||[]).length;
      return countB-countA;
    });
  }else{
    list.sort((a,b)=>a.orderIndex-b.orderIndex);
  }
  return list;
 },[chapters,chapterSearch,sortBy,allLessonsQuery.data]);

 return <div className="curriculum-workspace-container flex flex-row h-full w-full bg-white font-sans text-gray-800 overflow-hidden" style={{ display: "flex", flexDirection: "row", height: "100%", width: "100%" }}>
  {/* InnerSidebar */}
  {isNavCollapsed ? (
   <aside aria-label="Danh sách chương trình" className="program-nav-collapsed w-16 bg-surface border-r border-outline-variant flex flex-col h-full shrink-0 relative z-10">
    <div className="p-2">
     <button
      type="button"
      className="w-full bg-[#187b57] text-white rounded-md py-2 flex items-center justify-center gap-1 hover:bg-[#126345] transition-colors border-0 cursor-pointer"
      title="Thêm chương trình mới"
      aria-label="Thêm chương trình mới"
      onClick={()=>{
       setEditingCourse(null);
       setCourseDraft(emptyCourse(metadata));
       setShowNewCourseForm(true);
      }}
     >
      <Plus size={18} />
     </button>
    </div>
    <div className="flex-1 overflow-y-auto px-2 space-y-1">
     {courses.map(c=>{
      const isActive=selectedCourseId===c.id;
      return (
       <button
        type="button"
        key={c.id}
        title={`${c.name} (${c.code})`}
        aria-label={c.name}
        aria-pressed={isActive}
        onClick={()=>handleSelectCourse(c.id)}
        className={`flex w-full items-center justify-center p-2 rounded-lg cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
         isActive ? 'bg-white shadow-sm border border-emerald-100' : 'hover:bg-white border border-transparent'
        }`}
       >
        <div className={`mt-0.5 p-1.5 rounded-md flex-shrink-0 ${isActive ? 'bg-emerald-50 text-[#187b57]' : 'bg-gray-100 text-gray-500'}`}>
         <BookOpen size={16} />
        </div>
       </button>
      );
     })}
    </div>
    <div className="p-3 border-t border-gray-200 text-center">
     <button
      type="button"
      className="flex flex-col items-center justify-center w-full py-2 text-xs text-gray-500 hover:text-gray-700 border-0 bg-transparent cursor-pointer"
      onClick={()=>setIsNavCollapsed(false)}
      title="Mở rộng danh sách chương trình"
      aria-label="Mở rộng danh sách chương trình"
      aria-expanded={false}
     >
      <div className="bg-white border border-gray-200 rounded-full p-1 mb-1 shadow-sm">
       <ChevronRight size={14} />
      </div>
     </button>
    </div>
   </aside>
  ) : (
   <aside aria-label="Danh sách chương trình" className="program-nav-expanded w-72 bg-white border-r border-gray-200 flex flex-col h-full shrink-0 relative z-10">
    <button type="button" onClick={()=>setIsNavCollapsed(true)} aria-label="Thu gọn danh sách chương trình" aria-expanded={true} title="Thu gọn danh sách chương trình" className="self-end m-2 p-2 rounded-lg text-primary hover:bg-primary-container focus-visible:ring-2 focus-visible:ring-primary"><ChevronLeft size={18}/></button>
    <div className="p-4 space-y-2.5">
     <button
      type="button"
      className="w-full bg-[#187b57] text-white rounded-md py-2 flex items-center justify-center gap-1.5 hover:bg-[#126345] transition-colors border-0 cursor-pointer text-sm font-medium"
      onClick={()=>{
       setEditingCourse(null);
       setCourseDraft(emptyCourse(metadata));
       setShowNewCourseForm(true);
      }}
     >
      <Plus size={16} /> Thêm chương trình
     </button>
     <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
       type="text"
       placeholder="Tìm chương trình..."
       value={navSearch}
       onChange={e=>setNavSearch(e.target.value)}
       className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-md text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#187b57]"
      />
     </div>
    </div>
    <div className="flex-1 overflow-y-auto px-3 space-y-1">
     {filteredCourses.map(c=>{
      const isActive=selectedCourseId===c.id;
      return (
       <div
        key={c.id}
        onClick={()=>handleSelectCourse(c.id)}
        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
         isActive ? 'bg-emerald-50/70 border border-emerald-200 text-[#187b57]' : 'hover:bg-gray-50 border border-transparent text-gray-700'
        }`}
       >
        <div className="flex items-center gap-2.5 min-w-0">
         <div className={`p-1.5 rounded-md flex-shrink-0 ${isActive ? 'bg-white text-[#187b57] shadow-xs' : 'bg-gray-100 text-gray-500'}`}>
          <BookOpen size={16} />
         </div>
         <div className="min-w-0">
          <div className="text-sm font-medium truncate" title={c.name}>{c.name}</div>
          <div className="text-xs text-gray-400 truncate">Mã: {c.code}</div>
         </div>
        </div>
        {isActive && <CheckCircle size={15} className="text-[#187b57] flex-shrink-0" />}
       </div>
      );
     })}
     {!filteredCourses.length && <div className="p-4 text-center text-gray-400 text-xs">Không tìm thấy chương trình phù hợp</div>}
    </div>
    <div className="p-3 border-t border-gray-200 text-center">
     <button
      type="button"
      className="flex flex-col items-center justify-center w-full py-2 text-xs text-gray-500 hover:text-gray-700 border-0 bg-transparent cursor-pointer"
      onClick={()=>setIsNavCollapsed(true)}
     >
      <div className="bg-white border border-gray-200 rounded-full p-1 mb-1 shadow-sm">
       <ChevronLeft size={14} />
      </div>
      Thu gọn danh sách
     </button>
    </div>
   </aside>
  )}

  {/* Main content */}
  <main className="flex-1 h-full overflow-y-auto p-6 lg:p-8 bg-white min-w-0">
   {error && <div className="api-error mb-4">{error}</div>}
   <div className="w-full">
    {!selectedCourse ? (
     <div className="flex flex-col gap-6 p-6 border border-gray-200 rounded-xl bg-white shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
       <div>
        <span className="text-xs font-semibold text-gray-500 tracking-wider uppercase block mb-1">
         QUẢN LÝ CHƯƠNG TRÌNH
        </span>
        <h2 className="text-xl font-bold text-gray-900 m-0">
         Chọn chương trình đào tạo
        </h2>
        <p className="text-xs text-gray-500 mt-1">
         Chọn một chương trình đào tạo bên trái để quản lý chi tiết cấu trúc chương, bài học và phân phối tiết.
        </p>
       </div>
       <button
        type="button"
        className="flex items-center gap-1.5 bg-[#187b57] hover:bg-[#126345] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors border-0 cursor-pointer flex-shrink-0"
        onClick={()=>{
         setEditingCourse(null);
         setCourseDraft(emptyCourse(metadata));
         setShowNewCourseForm(true);
        }}
       >
        <Plus size={16} /> Tạo chương trình mới
       </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
       {courses.map(c => (
        <div
         key={c.id}
         className="p-5 rounded-xl border border-gray-200 bg-white hover:border-[#187b57]/40 hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between group"
         onClick={()=>handleSelectCourse(c.id)}
        >
         <div>
          <div className="flex items-center justify-between gap-2 mb-3">
           <div className="w-10 h-10 rounded-lg bg-emerald-50 text-[#187b57] flex items-center justify-center group-hover:scale-105 transition-transform">
            <BookOpen size={20}/>
           </div>
           <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            {c.status === "ACTIVE" || c.status === "PUBLISHED" ? "Đã xuất bản" : courseStatusLabel(c.status)}
           </span>
          </div>
          <h3 className="text-sm font-bold text-gray-900 group-hover:text-[#187b57] transition-colors line-clamp-2 mb-1">
           {c.name}
          </h3>
          <p className="text-xs text-gray-500 line-clamp-2 mb-3">
           {c.description || "Chương trình dành cho học sinh lớp 10 theo chương trình GDPT mới."}
          </p>
         </div>
         <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-500">
          <span className="text-gray-400 text-[11px]">Mã: {c.code}</span>
          <span className="font-medium text-[#187b57] group-hover:underline inline-flex items-center gap-0.5">
           Quản lý <ChevronRight size={13}/>
          </span>
         </div>
        </div>
       ))}
      </div>
     </div>
    ) : (
     <>
      {/* ContentHeader */}
      <div className="mb-6">
       <div className="text-xs font-semibold text-gray-500 tracking-wider mb-2 uppercase">
        Chương trình đào tạo
       </div>
       <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900 m-0">
         {selectedCourse.name}
        </h1>
        <button
         type="button"
         className="text-sm font-medium text-gray-500 hover:text-[#187b57] inline-flex items-center gap-1 border-0 bg-transparent cursor-pointer p-0 transition-colors"
         onClick={handleDeselectCourse}
         title="Xem danh sách tất cả chương trình"
        >
         <ChevronLeft size={16}/> Đổi chương trình
        </button>
       </div>
       <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-6">
        <div className="flex items-center gap-2">
         Mã khóa: <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-medium">{selectedCourse.code}</span>
        </div>
        <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
        <div>Tổng số chương: <span className="font-semibold text-gray-900">{chapters.length}</span></div>
        <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
        <div>Tổng số bài học: <span className="font-semibold text-gray-900">{totalLessons}</span></div>
        <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
        <div className="flex items-center gap-2">
         Trạng thái: 
         <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
          {selectedCourse.status === "ACTIVE" || selectedCourse.status === "PUBLISHED" ? "Đã xuất bản" : courseStatusLabel(selectedCourse.status)}
         </span>
        </div>
       </div>

       {/* Toolbar */}
       <div className="flex flex-wrap items-center gap-2 justify-end mb-6 border-b border-gray-100 pb-4">
        <button 
         type="button"
         onClick={() => {
          setShowNewChapterForm(true);
          setEditingChapter(null);
          setChapterDraft({courseId:selectedCourse.id,title:"",orderIndex:chapters.length+1,status:"ACTIVE"});
         }}
         className="flex items-center gap-1.5 bg-[#187b57] hover:bg-[#126345] text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors border-0 cursor-pointer"
        >
         <Plus size={16} />
         Thêm chương
        </button>
        <button 
         type="button"
         onClick={() => setBulkImport(true)}
         className="flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer"
        >
         <Upload size={16} className="text-gray-500"/>
         Nạp nhanh
        </button>
        <button 
         type="button"
         onClick={() => setShowPpctImportModal(true)}
         className="flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer"
        >
         <FileText size={16} className="text-gray-500"/>
         PPCT
        </button>
        <button 
         type="button"
         onClick={() => setShowPhanPhoiTiet(true)}
         className="flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer"
        >
         <LayoutList size={16} className="text-gray-500"/>
         Phân phối tiết
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1"></div>
        <button 
         type="button"
         onClick={() => {
          setEditingCourse(selectedCourse);
          setCourseDraft({
           code: selectedCourse.code,
           name: selectedCourse.name,
           description: selectedCourse.description || "",
           status: selectedCourse.status,
          });
          setShowNewCourseForm(true);
         }}
         className="flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer"
        >
         <Edit size={16} className="text-gray-500"/>
         Sửa
        </button>
        <button 
         type="button"
         onClick={() => void removeCourse(selectedCourse)}
         className="flex items-center gap-1.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer"
        >
         <Trash2 size={16} />
         Xóa
        </button>
       </div>

       {/* Info Banner */}
       <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 border-l-4 border-[#187b57] mb-6">
        <div className="text-[#187b57] bg-white p-2 rounded shadow-sm border border-gray-100">
         <BookOpen size={24} />
        </div>
        <div className="flex-1">
         <div className="font-semibold text-gray-900">Môn: {selectedCourse.name}</div>
         <div className="text-sm text-gray-500 mt-1">{selectedCourse.description || "Chương trình dành cho học sinh lớp 10 theo bộ sách Kết nối tri thức với cuộc sống."}</div>
        </div>
        <button 
         type="button"
         onClick={() => {
          setEditingCourse(selectedCourse);
          setCourseDraft({
           code: selectedCourse.code,
           name: selectedCourse.name,
           description: selectedCourse.description || "",
           status: selectedCourse.status,
          });
          setShowNewCourseForm(true);
         }}
         className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 bg-white px-3 py-1.5 rounded-md font-medium cursor-pointer"
        >
         <Info size={16} />
         Xem chi tiết
        </button>
       </div>
      </div>

      {/* DataTable */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm w-full">
       {/* Table Header / Toolbar */}
       <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="font-bold text-gray-800">
         DANH MỤC CÁC CHƯƠNG ({chapters.length})
        </div>
        <div className="flex items-center gap-3">
         <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input 
           type="text" 
           placeholder="Tìm trong chương trình..." 
           value={chapterSearch}
           onChange={e => setChapterSearch(e.target.value)}
           className="pl-9 pr-4 py-1.5 border border-gray-300 rounded-md text-sm w-64 focus:outline-none focus:ring-1 focus:ring-[#187b57] focus:border-[#187b57]"
          />
         </div>
         <button 
          type="button"
          onClick={() => setSortBy(prev => prev === 'order' ? 'name' : prev === 'name' ? 'lessons' : 'order')}
          className="flex items-center gap-2 border border-gray-300 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer bg-white"
         >
          <ArrowUpDown size={16} className="text-gray-500"/>
          Sắp xếp: {sortBy === 'name' ? 'Tên A-Z' : sortBy === 'lessons' ? 'Số bài' : 'Mặc định'}
          <ChevronDown size={14} className="text-gray-400 ml-1" />
         </button>
        </div>
       </div>

       <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-600">
         <thead className="text-xs uppercase bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
          <tr>
           <th className="w-12 px-4 py-3 text-center whitespace-nowrap">
            <button
             type="button"
             onClick={()=>setExpandedChapters(allChaptersExpanded?new Set():new Set(chapters.map(chapter=>chapter.id)))}
             disabled={!chapters.length}
             title={allChaptersExpanded?"Thu gọn tất cả chương":"Mở tất cả chương"}
             aria-label={allChaptersExpanded?"Thu gọn tất cả chương":"Mở tất cả chương"}
             aria-expanded={allChaptersExpanded}
             className="inline-flex items-center justify-center rounded p-1 text-primary transition-colors hover:bg-primary-container focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
             {allChaptersExpanded?<ChevronDown size={18}/>:<ChevronRight size={18}/>}
            </button>
           </th>
           <th className="w-12 px-4 py-3 text-center whitespace-nowrap">#</th>
           <th className="px-4 py-3 whitespace-nowrap">TÊN CHƯƠNG</th>
           <th className="px-4 py-3 text-center whitespace-nowrap">SỐ BÀI HỌC</th>
           <th className="px-4 py-3 text-center whitespace-nowrap">THAO TÁC</th>
          </tr>
         </thead>
         <tbody>
          {filteredChapters.map((row) => {
           const chapterLessons = allLessonsQuery.data?.[row.id] || [];
           const isExpanded = expandedChapters.has(row.id);
           return (
            <Fragment key={row.id}>
             {/* Parent Row */}
             <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-gray-50/50' : ''}`}>
              <td className="px-4 py-3 text-center whitespace-nowrap">
               {chapterLessons.length > 0 ? (
                <button 
                 type="button"
                 onClick={() => toggleChapter(row.id)}
                 className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200 transition-colors border-0 bg-transparent cursor-pointer"
                >
                 {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
               ) : (
                <span className="text-gray-300 p-1 inline-block">
                 <ChevronRight size={18} />
                </span>
               )}
              </td>
              <td className="px-4 py-3 text-center font-medium whitespace-nowrap">{row.orderIndex}</td>
              <td 
               className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap cursor-pointer hover:text-[#187b57]"
               onClick={() => { if (chapterLessons.length > 0) toggleChapter(row.id); }}
              >
               <span className="program-chapter-title" title={row.title}>{row.title}</span>
              </td>
              <td className="px-4 py-3 text-center text-gray-500 font-medium whitespace-nowrap">{chapterLessons.length} bài</td>
              <td className="px-4 py-3 whitespace-nowrap">
               <div className="flex items-center justify-center gap-2 relative">
                <button 
                 type="button"
                 onClick={(e) => {
                  e.stopPropagation();
                  setEditingChapter(row);
                  setChapterDraft({courseId:row.courseId,title:row.title,orderIndex:row.orderIndex,status:"ACTIVE"});
                  setShowNewChapterForm(true);
                 }}
                 className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                >
                 <Edit size={14} /> Sửa
                </button>
                <button 
                 type="button"
                 onClick={(e) => {
                  e.stopPropagation();
                  void removeChapter(row);
                 }}
                 className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 border border-red-200 rounded bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
                >
                 <Trash2 size={14} /> Xóa
                </button>
                <button 
                 type="button"
                 onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu(prev => prev?.type === 'chapter' && prev.id === row.id ? null : { type: 'chapter', id: row.id });
                 }}
                 className="p-1.5 text-gray-400 hover:text-gray-600 border border-gray-200 rounded bg-white hover:bg-gray-50 cursor-pointer"
                >
                 <MoreVertical size={16} />
                </button>
                {activeMenu?.type === "chapter" && activeMenu.id === row.id && (
                 <div
                  className="absolute right-0 top-10 z-30 w-44 rounded-lg bg-white border border-gray-200 shadow-lg py-1 text-left"
                  onClick={e => e.stopPropagation()}
                 >
                  <button
                   type="button"
                   className="w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 text-left border-0 bg-transparent cursor-pointer"
                   onClick={() => {
                    setActiveMenu(null);
                    setShowNewLessonForm(true);
                    setEditingLesson(null);
                    setLessonDraft({chapterId:row.id,title:"",publicCode:"",summary:"",contentHtml:"",orderIndex:chapterLessons.length+1,status:"PUBLISHED"});
                   }}
                  >
                   <Plus size={13}/> Thêm bài học mới
                  </button>
                 </div>
                )}
               </div>
              </td>
             </tr>
             
             {/* Nested Rows */}
             {isExpanded && (!chapterLessons.length ? (
              <tr className="border-b border-gray-50">
               <td className="whitespace-nowrap"></td>
               <td className="whitespace-nowrap"></td>
               <td colSpan={3} className="px-4 py-3 pl-8 text-xs text-gray-400 italic">
                Chương này chưa có bài học.{" "}
                <button
                 type="button"
                 className="text-[#187b57] font-semibold hover:underline bg-transparent border-0 cursor-pointer p-0 ml-1"
                 onClick={() => {
                  setShowNewLessonForm(true);
                  setEditingLesson(null);
                  setLessonDraft({chapterId:row.id,title:"",publicCode:"",summary:"",contentHtml:"",orderIndex:1,status:"PUBLISHED"});
                 }}
                >
                 + Thêm bài học
                </button>
               </td>
              </tr>
             ) : (
              chapterLessons.map((lesson, index) => (
               <tr key={lesson.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                <td className="whitespace-nowrap"></td>
                <td className="whitespace-nowrap"></td>
                <td className="px-4 py-3 pl-8 whitespace-nowrap">
                 <div className="flex items-center gap-3 whitespace-nowrap">
                  <div className="relative flex items-center justify-center">
                   {/* Dotted lines simulation */}
                   <div className="absolute -left-6 top-1/2 w-4 border-t border-dashed border-gray-300"></div>
                   <div className="absolute -left-6 -top-5 h-8 border-l border-dashed border-gray-300"></div>
                   {index === chapterLessons.length - 1 ? (
                    <div className="absolute -left-6 top-1/2 h-full bg-white w-1"></div>
                   ) : (
                    <div className="absolute -left-6 top-1/2 h-full border-l border-dashed border-gray-300"></div>
                   )}
                   <div className="text-gray-400 bg-white p-0.5 rounded z-10 relative">
                    <FileText size={16} />
                   </div>
                  </div>
                  <button
                   type="button"
                   onClick={() => setPreviewLesson(lesson)}
                   title={lesson.title}
                   className="program-lesson-title text-gray-700 font-medium hover:text-[#187b57] text-left border-0 bg-transparent cursor-pointer p-0 whitespace-nowrap"
                  >
                   {lesson.title.startsWith("Bài") ? lesson.title : `Bài ${lesson.orderIndex}. ${lesson.title}`}
                  </button>
                 </div>
                </td>
                <td className="px-4 py-3 text-center text-gray-500 whitespace-nowrap font-medium">{lesson.publicCode ? `${lesson.publicCode} tiết` : "1 tiết"}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                 <div className="flex items-center justify-center gap-2 relative">
                  <button 
                   type="button"
                   onClick={() => setPreviewLesson(lesson)}
                   className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                   <Eye size={14} /> Xem
                  </button>
                  <button 
                   type="button"
                   onClick={() => {
                    setEditingLesson(lesson);
                    setLessonDraft({
                     chapterId: lesson.chapterId,
                     title: lesson.title,
                     publicCode: lesson.publicCode || "",
                     summary: lesson.summary || "",
                     contentHtml: lesson.contentHtml || "",
                     orderIndex: lesson.orderIndex,
                     status: lesson.status,
                    });
                    setShowNewLessonForm(true);
                   }}
                   className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                   <Edit size={14} /> Sửa
                  </button>
                  <button 
                   type="button"
                   onClick={() => void removeLesson(lesson)}
                   className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-red-600 hover:text-red-700 border border-red-200 rounded bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
                  >
                   <Trash2 size={14} /> Xóa
                  </button>
                  <button 
                   type="button"
                   onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenu(prev => prev?.type === 'lesson' && prev.id === lesson.id ? null : { type: 'lesson', id: lesson.id });
                   }}
                   className="p-1 text-gray-400 hover:text-gray-600 border border-gray-200 rounded bg-white hover:bg-gray-50 cursor-pointer"
                  >
                   <MoreVertical size={16} />
                  </button>
                  {activeMenu?.type === "lesson" && activeMenu.id === lesson.id && (
                   <div
                    className="absolute right-0 top-8 z-30 w-48 rounded-lg bg-white border border-gray-200 shadow-lg py-1 text-left"
                    onClick={e => e.stopPropagation()}
                   >
                    <button
                     type="button"
                     className="w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 text-left border-0 bg-transparent cursor-pointer"
                     onClick={() => { setActiveMenu(null); setDocumentLesson(lesson); }}
                    >
                     <FileText size={13}/> Tài liệu đính kèm
                    </button>
                    <button
                     type="button"
                     className="w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 text-left border-0 bg-transparent cursor-pointer"
                     onClick={() => { setActiveMenu(null); setWorksheetLesson(lesson); }}
                    >
                     <ClipboardList size={13}/> Gắn phiếu bài tập
                    </button>
                    <button
                     type="button"
                     className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-left border-0 bg-transparent cursor-pointer"
                     onClick={() => { setActiveMenu(null); setResourceLesson(lesson); }}
                    >
                     <Database size={13}/> Khối học liệu
                    </button>
                    <div className="h-px bg-slate-100 my-1"/>
                    <button
                     type="button"
                     className="w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 text-left border-0 bg-transparent cursor-pointer"
                     onClick={() => { setActiveMenu(null); void removeLesson(lesson); }}
                    >
                     <Trash2 size={13}/> Xóa bài học
                    </button>
                   </div>
                  )}
                 </div>
                </td>
               </tr>
              ))
             ))}
            </Fragment>
           );
          })}
         </tbody>
        </table>
       </div>
      </div>
     </>
    )}
   </div>
  </main>


  {/* KHUNG LỚN CHÍNH XEM BÀI HỌC (TOÀN MÀN HÌNH, CÂY BÊN TRÁI GIỮ NGUYÊN) */}
  {previewLesson && (
   <LessonPreviewModal
    open={Boolean(previewLesson)}
    onClose={()=>setPreviewLesson(null)}
    lesson={previewLesson}
    courseName={selectedCourse?.name}
    chapterTitle={chapters.find(c=>c.id===previewLesson.chapterId)?.title}
    session={session}
    onEditLesson={(l)=>{setPreviewLesson(null);setEditingLesson(l);setLessonDraft({chapterId:l.chapterId,title:l.title,publicCode:l.publicCode||"",summary:l.summary||"",contentHtml:l.contentHtml||"",orderIndex:l.orderIndex,status:l.status});setShowNewLessonForm(true);}}
    onUpdateLessonHtml={handleUpdateLessonHtml}
    onOpenDocuments={(l)=>setDocumentLesson(l)}
    onOpenWorksheets={(l)=>setWorksheetLesson(l)}
    onOpenResources={(l)=>setResourceLesson(l)}
   />
  )}

  {/* MODAL TẠO/SỬA CHƯƠNG TRÌNH */}
  {showNewCourseForm && (
   <div className="km-dialog-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setShowNewCourseForm(false)}}>
    <div className="km-dialog" style={{width:"min(520px, 95vw)"}}>
     <div className="km-dialog-head">
      <div>
       <div className="km-eyebrow">{editingCourse?"CHỈNH SỬA CHƯƠNG TRÌNH":"THIẾT LẬP MỚI"}</div>
       <h3 className="km-dialog-title">{editingCourse?"Cập nhật chương trình":"Tạo chương trình đào tạo mới"}</h3>
      </div>
      <button type="button" className="km-close-btn" onClick={()=>{setShowNewCourseForm(false);setEditingCourse(null);setCourseDraft(emptyCourse(metadata));}}>✕</button>
     </div>
     <form onSubmit={saveCourse}>
      <div className="km-dialog-body">
       <div className="km-field">
        <span className="km-field-label">MÃ CHƯƠNG TRÌNH</span>
        <input required className="km-field-input" placeholder="Ví dụ: TOAN10_KNTT" maxLength={50} value={courseDraft.code} onChange={e=>setCourseDraft({...courseDraft,code:e.target.value})}/>
       </div>
       <div className="km-field">
        <span className="km-field-label">TÊN CHƯƠNG TRÌNH HỌC</span>
        <input required className="km-field-input" placeholder="Ví dụ: Toán 10 — Kết nối tri thức" maxLength={255} value={courseDraft.name} onChange={e=>setCourseDraft({...courseDraft,name:e.target.value})}/>
       </div>
       <div className="km-field">
        <span className="km-field-label">MÔ TẢ TỔNG QUAN</span>
        <textarea className="km-field-input" style={{minHeight:65,resize:"vertical"}} placeholder="Mô tả tóm lược về chương trình học này…" value={courseDraft.description} onChange={e=>setCourseDraft({...courseDraft,description:e.target.value})}/>
       </div>
       <div className="km-field">
        <span className="km-field-label">TRẠNG THÁI XUẤT BẢN</span>
        <select className="km-field-input" value={courseDraft.status} onChange={e=>setCourseDraft({...courseDraft,status:e.target.value})}>
         {courseStatusOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
       </div>
      </div>
      <div className="km-dialog-foot">
       <button type="button" className="km-btn-ghost" onClick={()=>{setShowNewCourseForm(false);setEditingCourse(null);setCourseDraft(emptyCourse(metadata));}}>Hủy</button>
       <button type="submit" className="km-btn-primary">{editingCourse?"Lưu thay đổi":"Tạo chương trình"}</button>
      </div>
     </form>
    </div>
   </div>
  )}

  {/* MODAL TẠO/SỬA CHƯƠNG (ĐÃ LOẠI BỎ HOÀN TOÀN CỘT VÀ QUY TRÌNH XUẤT BẢN CẤP CHƯƠNG) */}
  {showNewChapterForm && (
   <div className="km-dialog-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setShowNewChapterForm(false)}}>
    <div className="km-dialog" style={{width:"min(520px, 95vw)"}}>
     <div className="km-dialog-head">
      <div>
       <div className="km-eyebrow">{editingChapter?"CHỈNH SỬA CHƯƠNG":"THÊM CHƯƠNG MỚI"}</div>
       <h3 className="km-dialog-title">{editingChapter?"Cập nhật chương":"Thêm chương vào chương trình"}</h3>
      </div>
      <button type="button" className="km-close-btn" onClick={()=>{setShowNewChapterForm(false);setEditingChapter(null);}}>✕</button>
     </div>
     <form onSubmit={saveChapter}>
      <div className="km-dialog-body">
       <div className="km-field">
        <span className="km-field-label">TÊN CHƯƠNG</span>
        <input required className="km-field-input" placeholder="Ví dụ: Mệnh đề và tập hợp" value={chapterDraft.title} onChange={e=>setChapterDraft({...chapterDraft,title:e.target.value})}/>
       </div>
       <div className="km-field">
        <span className="km-field-label">THỨ TỰ HIỂN THỊ</span>
        <input required type="number" min="1" className="km-field-input" value={chapterDraft.orderIndex} onChange={e=>setChapterDraft({...chapterDraft,orderIndex:Number(e.target.value)})}/>
       </div>
      </div>
      <div className="km-dialog-foot">
       <button type="button" className="km-btn-ghost" onClick={()=>{setShowNewChapterForm(false);setEditingChapter(null);}}>Hủy</button>
       <button type="submit" className="km-btn-primary">{editingChapter?"Lưu thay đổi":"Thêm chương"}</button>
      </div>
     </form>
    </div>
   </div>
  )}

  {/* MODAL SOẠN THẢO BÀI HỌC (RICH BLOCK EDITOR VỚI TIPTAP) */}
  {showNewLessonForm && (
   <LessonEditorModal
    isOpen={showNewLessonForm}
    onClose={() => {
      setShowNewLessonForm(false);
      setEditingLesson(null);
    }}
    lesson={editingLesson}
    defaultChapterId={lessonDraft.chapterId || (chapters[0]?.id ?? 0)}
    chapterTitle={chapters.find(c => c.id === (editingLesson?.chapterId || lessonDraft.chapterId))?.title}
    courseName={selectedCourse?.name}
    statusOptions={publishStatusOptions}
    onSave={async (payload) => {
      if (editingLesson) {
        await updateLesson(session, editingLesson.id, payload);
      } else {
        await createLesson(session, payload);
      }
      invalidateAll();
    }}
   />
  )}

  {/* Modal nạp hàng loạt Chương/Bài */}
  {bulkImport && selectedCourse && (
   <BulkChapterImport
    session={session}
    course={selectedCourse}
    chapters={chapters}
    metadata={metadata}
    onDone={()=>{setBulkImport(false);invalidateAll();}}
    onClose={()=>setBulkImport(false)}
   />
  )}

  {/* Modal quản lý tài liệu liên kết bài học */}
  {documentLesson && (
   <LessonDocumentManager
    session={session}
    lesson={documentLesson}
    onClose={()=>setDocumentLesson(null)}
   />
  )}

  {/* Modal gắn phiếu bài tập */}
  {worksheetLesson && (
   <LessonWorksheetManager
    session={session}
    lesson={worksheetLesson}
    onClose={()=>setWorksheetLesson(null)}
   />
  )}

  {/* Modal khối nội dung */}
  {resourceLesson && (
   <ResourceManager
    session={session}
    lesson={resourceLesson}
    onClose={()=>setResourceLesson(null)}
   />
  )}

  {/* Modal phân tách PPCT */}
  {selectedCourseId && selectedCourse && (
   <PpctCauTrucModal
    session={session}
    programId={selectedCourseId}
    programName={selectedCourse.name}
    isOpen={showPpctImportModal}
    onClose={()=>setShowPpctImportModal(false)}
    onSuccess={(courseId)=>{invalidateAll();if(courseId)setSelectedCourseId(courseId);}}
   />
  )}

  {/* Modal nhập PPCT thật → phân phối tiết vào mạch (PP-7) */}
  {showPhanPhoiTiet && selectedCourseId && selectedCourse && (
   <PhanPhoiTietDialog
    session={session}
    programId={selectedCourseId}
    programName={selectedCourse.name}
    onClose={()=>setShowPhanPhoiTiet(false)}
    onDone={()=>{setShowPhanPhoiTiet(false);invalidateAll();}}
   />
  )}
 </div>;
}

/**
 * PP-7 — nhập PPCT thật (PDF hoặc Excel, một đường) rồi phân phối tiết vào mạch.
 * Server tách bảng + suy mạch; panel chỉ hiện bản nháp cho admin sửa chỗ máy đoán chưa chắc.
 * Luật ghi (đụng dòng nhập tay, giữ id tiết cũ) ở máy chủ — panel gửi cả hàng đã sửa rồi hiện lại câu trả lời.
 */
function PhanPhoiTietDialog({session,programId,programName,onClose,onDone}:{session:AuthSession;programId:number;programName:string;onClose:()=>void;onDone:()=>void}){
 const strandsQuery=useQuery({queryKey:["ppct-strands",session.accessToken,programId],queryFn:()=>getProgramStrands(session,programId)});
 const strands=strandsQuery.data??[];
 const tongTiet=strands.reduce((n,s)=>n+s.so_tiet,0);
 const tongTuan=strands.reduce((n,s)=>Math.max(n,s.tuan_cuoi??0),0);

 const [draft,setDraft]=useState<PpctPreview|null>(null);
 const [rows,setRows]=useState<PpctRow[]>([]);
 const [daDuyet,setDaDuyet]=useState<Set<number>>(new Set());
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [ketQua,setKetQua]=useState<{soMach:number;soTiet:number;soTuan:number}|null>(null);

 const PHAN_LOAI=[["BAI_MOI","Bài mới"],["ON_TAP","Ôn tập"],["KIEM_TRA","Kiểm tra"],["THUC_HANH","Thực hành"]] as const;

 const machOptions=useMemo(()=>{
  const m=new Map<string,string>();
  for(const s of strands)m.set(s.code,s.name);
  for(const r of draft?.dong??[])if(!m.has(r.maMach))m.set(r.maMach,r.tenMach);
  return [...m.entries()];
 },[strands,draft]);

 const upload=async(file:File)=>{
  setBusy(true);setError("");
  try{
   const preview=await uploadPpctPreview(session,programId,file);
   setDraft(preview);setRows(preview.dong.map(r=>({...r})));setDaDuyet(new Set());setKetQua(null);
  }catch(e){setError(messageOf(e));}finally{setBusy(false);}
 };
 const chonTepKhac=()=>{setDraft(null);setRows([]);setDaDuyet(new Set());setError("");setKetQua(null);};

 const patch=(i:number,p:Partial<PpctRow>)=>setRows(rs=>rs.map((r,idx)=>idx===i?{...r,...p}:r));
 const duyet=(i:number)=>setDaDuyet(s=>{const n=new Set(s);n.add(i);return n;});

 const sig=(r:PpctRow)=>`${r.maMach}|${r.hocKy}|${r.soTiet}`;
 const trung=useMemo(()=>{
  const seen=new Set<string>(),dup=new Set<string>();
  for(const r of rows){const k=sig(r);if(seen.has(k))dup.add(k);seen.add(k);}
  return dup;
 },[rows]);
 const canhBaoCua=(r:PpctRow,i:number)=>{
  const list:string[]=[];
  if(r.canhBao.length>0&&!daDuyet.has(i))list.push(...r.canhBao);
  if(trung.has(sig(r)))list.push(`Trùng tiết ${r.soTiet} (HK${r.hocKy}) trong mạch ${r.maMach}`);
  return list;
 };
 const dongVuong=(r:PpctRow,i:number)=>{
  if(!r.maMach.trim()||!r.tenMach.trim()||!r.tieuDe.trim())return true;
  if(r.soTiet<1||r.tuan<1||r.hocKy<1||r.hocKy>2)return true;
  if(trung.has(sig(r)))return true;
  if(r.canhBao.length>0&&!daDuyet.has(i))return true;
  return false;
 };
 const soVuong=rows.filter((r,i)=>dongVuong(r,i)).length;

 const xacNhan=async()=>{
  if(!draft||soVuong>0)return;
  setBusy(true);setError("");
  try{
   setKetQua(await confirmPpct(session,programId,{objectKey:draft.objectKey,dong:rows}));
  }catch(e){setError(messageOf(e));}finally{setBusy(false);}
 };

 return <div className="dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}>
  <section className="dialog-card resource-dialog" style={{width:"min(1040px,100%)"}}>
   <div className="panel-head"><div><p className="eyebrow">PHÂN PHỐI CHƯƠNG TRÌNH</p><h2>Nhập PPCT · {programName}</h2></div><button onClick={onClose} disabled={busy}>Đóng</button></div>

   {error&&<div className="api-error">{error}</div>}

   {ketQua?(
    <div style={{textAlign:"center",padding:"28px 12px"}}>
     <CheckCircle size={40} style={{color:"#16a34a"}}/>
     <h3 style={{margin:"12px 0 4px"}}>Đã phân phối theo PPCT</h3>
     <p style={{color:"var(--muted)"}}>{ketQua.soMach} mạch · {ketQua.soTiet} tiết · {ketQua.soTuan} tuần</p>
     <div className="row-actions" style={{justifyContent:"center"}}><button className="primary" onClick={onDone}>Xong</button></div>
    </div>
   ):!draft?(
    <>
     <p>Chọn tệp PPCT (Word, PDF hoặc Excel). Hệ thống tự tách bảng, suy mạch cho từng tiết để bạn xem trước và sửa.</p>
     <div className="live-row"><div>
      <b>Phân phối hiện tại</b>
      {strandsQuery.isLoading?<small>Đang tải…</small>
       :strands.length?<small>{strands.length} mạch · {tongTiet} tiết · {tongTuan} tuần</small>
       :<small>Chưa phân phối.</small>}
     </div></div>
     <label style={{display:"inline-flex",marginTop:14,padding:"9px 16px",borderRadius:8,background:"var(--primary)",color:"#fff",fontWeight:600,cursor:busy?"progress":"pointer"}}>
      <input type="file" accept=".docx,.pdf,.xlsx,.xls" style={{display:"none"}} disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.currentTarget.value="";}}/>
      {busy?"Đang đọc tệp…":"Chọn tệp PPCT"}
     </label>
    </>
   ):draft.trangThai==="UNSUPPORTED_SCAN"?(
    <>
     <div className="api-error">{draft.thongDiep}</div>
     <div className="row-actions"><button type="button" onClick={chonTepKhac}>Chọn tệp khác</button></div>
    </>
   ):(
    <>
     <div style={{display:"flex",gap:16,alignItems:"center",fontSize:13,margin:"6px 0 10px"}}>
      <span>{draft.thongDiep}</span>
      <span style={{color:soVuong?"#dc2626":"#16a34a",fontWeight:600}}>{soVuong} dòng cần xử lý</span>
     </div>
     <div style={{overflowX:"auto",border:"1px solid var(--line)",borderRadius:8}}>
      <table className="cw-clean-table" style={{minWidth:900}}>
       <thead><tr>
        <th style={{width:52}}>Tuần</th><th style={{width:48}}>Tiết</th><th style={{width:44}}>HK</th>
        <th style={{width:160}}>Mạch</th><th style={{width:120}}>Phân loại</th><th>Tiêu đề</th><th style={{width:140}}>Máy đoán</th>
       </tr></thead>
       <tbody>
        {rows.map((r,i)=>{
         const cb=canhBaoCua(r,i);
         return <tr key={r.chiSo} style={dongVuong(r,i)?{background:"#fef2f2"}:undefined}>
          <td><input type="number" className="km-input-date" value={r.tuan} onChange={e=>patch(i,{tuan:Number(e.target.value)||0})}/></td>
          <td><input type="number" className="km-input-date" value={r.soTiet} onChange={e=>patch(i,{soTiet:Number(e.target.value)||0})}/></td>
          <td><input type="number" className="km-input-date" value={r.hocKy} onChange={e=>patch(i,{hocKy:Number(e.target.value)||0})}/></td>
          <td><select className="km-input-date" value={r.maMach} onChange={e=>{const c=e.target.value;const n=machOptions.find(([code])=>code===c)?.[1]??c;patch(i,{maMach:c,tenMach:n});duyet(i);}}>
           {machOptions.map(([code,name])=><option key={code} value={code}>{name}</option>)}
          </select></td>
          <td><select className="km-input-date" value={r.phanLoai} onChange={e=>patch(i,{phanLoai:e.target.value})}>
           {PHAN_LOAI.map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select></td>
          <td><input className="km-input-date" value={r.tieuDe} onChange={e=>patch(i,{tieuDe:e.target.value})}/></td>
          <td style={{fontSize:11.5}}>
           <span className={r.doTinCay==="CAO"?"km-time-pill km-time-cur":r.doTinCay==="VUA"?"km-time-pill km-time-up":"km-time-pill km-time-none"}>{r.doTinCay}</span>
           {r.canhBao.length>0&&<label style={{display:"flex",gap:4,marginTop:4,color:"#b45309",alignItems:"center"}}>
            <input type="checkbox" checked={daDuyet.has(i)} onChange={()=>setDaDuyet(s=>{const n=new Set(s);n.has(i)?n.delete(i):n.add(i);return n;})}/> đã kiểm
           </label>}
          </td>
         </tr>;
        })}
       </tbody>
      </table>
     </div>
     {rows.some((r,i)=>canhBaoCua(r,i).length>0)&&<ul style={{margin:"10px 0 0",paddingLeft:18,fontSize:12,color:"#b45309"}}>
      {rows.flatMap((r,i)=>canhBaoCua(r,i).map((c,j)=><li key={`${i}-${j}`}>Tuần {r.tuan} · tiết {r.soTiet}: {c}</li>))}
     </ul>}
     <div className="row-actions">
      <button type="button" onClick={chonTepKhac} disabled={busy}>Chọn tệp khác</button>
      <button className="primary" onClick={()=>void xacNhan()} disabled={busy||soVuong>0}>{busy?"Đang phân phối…":soVuong>0?`Còn ${soVuong} dòng cần xử lý`:"Xác nhận & phân phối"}</button>
     </div>
    </>
   )}
  </section>
 </div>;
}

function PpctStrandTree({strand}:{strand:ProgramImportStrand}){
 const [expanded,setExpanded]=useState(false);
 const [chapters,setChapters]=useState<Set<number>>(new Set());
 return <div className="cw-chapter">
  <div className="cw-chapter-row">
   <button type="button" className="cw-chevron" onClick={()=>setExpanded(x=>!x)}>{expanded?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</button>
   <button type="button" className="cw-chapter-main" onClick={()=>setExpanded(x=>!x)}><span className="cw-icon"><LibraryBig size={14}/></span><span className="cw-chapter-title">{strand.name}</span><span className="cw-count-badge">{strand.totalPeriods} tiết · {strand.chapters.reduce((n,c)=>n+c.lessons.length,0)} bài</span></button>
  </div>
  {expanded&&<div className="cw-lessons">{strand.chapters.map((chapter,index)=>{const opened=chapters.has(index);return <div key={`${chapter.numeral}-${index}`}>
   <div className="cw-chapter-row" style={{paddingLeft:14}}><button type="button" className="cw-chevron" onClick={()=>setChapters(old=>{const next=new Set(old);next.has(index)?next.delete(index):next.add(index);return next})}>{opened?<ChevronDown size={13}/>:<ChevronRight size={13}/>}</button><button type="button" className="cw-chapter-main" onClick={()=>setChapters(old=>{const next=new Set(old);next.has(index)?next.delete(index):next.add(index);return next})}><span className="cw-chapter-title">{chapter.numeral?`Chương ${chapter.numeral} · `:""}{chapter.name||"Không thuộc chương"}</span><span className="cw-count-badge">{chapter.totalPeriods} tiết</span></button></div>
   {opened&&<div className="cw-lessons">{chapter.lessons.map(lesson=><div className="cw-lesson" key={lesson.normalizedName}><div className="cw-lesson-main"><span className="cw-dot"/><span className="cw-lesson-title">{lesson.name}</span><span className="cw-lesson-code">{lesson.totalPeriods} tiết · tuần {lesson.firstWeek===lesson.lastWeek?lesson.firstWeek:`${lesson.firstWeek}–${lesson.lastWeek}`}</span></div></div>)}</div>}
  </div>})}</div>}
 </div>;
}

function messageOf(reason: unknown) {
  return reason instanceof Error ? reason.message : "Đã xảy ra lỗi không xác định";
}
