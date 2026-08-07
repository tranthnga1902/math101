import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import katex from "katex";
import QRCode from "qrcode";
import {useReactToPrint} from "react-to-print";
import { AlertTriangle, BookOpen, BookOpenCheck, CheckCircle, ChevronDown, ChevronRight, CircleAlert, ClipboardList, Clock3, Database, Filter, FileText, GraduationCap, Home, KeyRound, LibraryBig, Lock, LogOut, Menu, MoreVertical, PlayCircle, Plus, Search, Settings, UserRound, X } from "lucide-react";
import "katex/dist/katex.min.css";
import { MainLayout } from "./layout/MainLayout";
import { PdfThumbnail } from "./PdfThumbnail";
import { UserAccountsPage } from "./admin/UserAccountsPage";
import { TextbookManagement } from "./admin/TextbookManagement";
import { DocumentManagement } from "./admin/DocumentManagement";
import { TopicManagement } from "./admin/TopicManagement";
import { AuditManagement } from "./admin/AuditManagement";
import { StudentExperience } from "./student/StudentExperience";
import {
  createCourse,
  deleteCourse,
  changePassword,
  createChapter,
  createLesson,
  createUser,
  deleteChapter,
  deleteLesson,
  reorderChapters,reorderLessons,
  getCourses,
  getChapters,
  getLessons,
  getAdminStats,
  getAuditLogs,
  getMetadata,
  getUsers,
  getStudentProgress,
  login,
  normalizeRole,
  markLessonProgress,
  updateCourse,
  updateChapter,
  updateLesson,
  updateUser,
  setUserLocked,
  deleteUser,
  resetUserPassword,
  getAvailableStudents,
  getSubjects,createSubject,updateSubject,deleteSubject,getGrades,createGrade,updateGrade,deleteGrade,
  getTopics,saveTopic,deleteTopic,getProblemTypes,saveProblemType,deleteProblemType,getProblems,saveProblem,deleteProblem,
  getHints,saveHint,getSolutions,saveSolution,getWorksheets,saveWorksheet,
  attachWorksheetToLesson,
  getMyCourses,
  getMyAssignments,
  markAssignment,
  getPublicProblem,
  markProblemProgress,
  getClasses,getClassesPage,createClass,updateClass,deleteClass,getTeacherStats,getTeacherClasses,getGradebook,getClassResults,
  getResources,saveResource,deleteResource,uploadFile,
  reorderResources,
  getEnrollments,addEnrollment,removeEnrollment,getAssignments,saveAssignment,
  getDocuments,openDocumentFile,openLessonDocumentFile,uploadDocument,updateDocument,deleteDocument,getLessonDocuments,getLessonDocumentQuestions,addLessonDocumentQuestion,deleteLessonDocumentQuestion,recordLessonDocumentStudy,submitLessonDocumentQuiz,attachLessonDocument,updateLessonDocument,deleteLessonDocument,moveLessonDocument,
  getTextbooks,getTextbook,openTextbookInBrowser,getAdminTextbooks,uploadTextbook,updateTextbook,setTextbookPageOffset,publishTextbook,hideTextbook,
  downloadFile,
  deleteHint,reorderHints,deleteSolution,reorderSolutions,
  type AuthSession,
  type Course,
  type CourseInput,
  type Chapter,
  type ChapterInput,
  type Lesson,
  type LessonInput,
  type UserAccount,
  type UserAccountInput,
  type AdminStats,
  type AuditLog,
  type Progress,
  type Subject,type Grade,
  type Topic,type ProblemType,type Problem,type Hint,type SolutionStep,type Worksheet,
  type StudentCourse,
  type StudentAssignment,
  type PublicProblem,
  type Classroom,type ClassroomInput,type TeacherStats,type GradebookRow,type ClassResult,
  type LessonResource,
  type DocumentItem,type TextbookItem,type LessonDocument,type LessonDocumentQuestion,
  type Enrollment,type Assignment,type Metadata,type MetadataOption,
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
  const logout=()=>{localStorage.removeItem("math10.session");setSession(null)};
  if(publicSlug)return <PublicProblemPage slug={publicSlug} session={session}/>;
  if (!session) return <LoginPage onLogin={acceptSession} />;
  return <AppShell session={session} onLogout={logout} />;
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

function LoginPage({ onLogin }: { onLogin: (session: AuthSession) => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const next = await login(identifier, password);
      onLogin(next);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-intro">
        <div className="brand"><span className="brand-mark">M10</span><span><b>MATH10</b><small>HÀNH TRÌNH</small></span></div>
        <p className="eyebrow">TOÁN 10 · API-FIRST</p>
        <h1>Học tập và quản lý lớp bằng dữ liệu thật.</h1>
        <p>Frontend kết nối trực tiếp với Spring Boot API; dữ liệu được lưu trên PostgreSQL staging.</p>
        <ul>
          <li>JWT và phân quyền Student/Teacher</li>
          <li>Tiến độ bài học được đồng bộ</li>
          <li>Khóa học được quản lý qua API</li>
        </ul>
      </section>
      <section className="auth-card">
        <p className="eyebrow">ĐĂNG NHẬP</p>
        <h2>Tiếp tục vào MATH10</h2>
        <form className="live-form" onSubmit={submit}>
          <label>Username hoặc email<input type="text" required value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" /></label>
          <label>Mật khẩu<input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
          {error && <div className="api-error">{error}</div>}
          <button className="primary" disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập →"}</button>
        </form>
      </section>
    </main>
  );
}

function AppShell({ session, onLogout }: { session: AuthSession; onLogout: () => void }) {
  const [passwordOpen,setPasswordOpen]=useState(false);
  if (session.role === "teacher") return (
    <MainLayout session={session} onLogout={onLogout} onChangePassword={()=>setPasswordOpen(true)}>
      {activeSection => <>
        <TeacherDashboard session={session} activeSection={activeSection} />
        {passwordOpen&&<ChangePasswordDialog session={session} onClose={()=>setPasswordOpen(false)}/>}
      </>}
    </MainLayout>
  );
  if (session.role === "admin") return (
    <AdminShell session={session} onLogout={onLogout} onChangePassword={()=>setPasswordOpen(true)}>
      {activeSection => <>
        <AdminDashboard session={session} activeSection={activeSection} />
        {passwordOpen&&<ChangePasswordDialog session={session} onClose={()=>setPasswordOpen(false)}/>}
      </>}
    </AdminShell>
  );
  return (
    <StudentExperience session={session} onLogout={onLogout} />
  );
}

function AdminShell({session,children,onLogout,onChangePassword}:{session:AuthSession;children:(activeSection:string)=>React.ReactNode;onLogout:()=>void;onChangePassword:()=>void}) {
 const [active,setActive]=useState("overview");
 const [profileOpen,setProfileOpen]=useState(false);
 const items=[
  ["overview","Tổng quan",Home],
  ["users","Tài khoản",UserRound],
  ["classes","Lớp học",CheckCircle],
  ["textbooks","Sách giáo khoa",GraduationCap],
  ["documents","Tài liệu",FileText],
  ["topics","Chuyên đề",ClipboardList],
  ["audit","Nhật ký",ClipboardList],
  ["settings","Cài đặt",Settings],
 ] as const;
 return <div className="teacher-shell admin-shell">
  <aside className="teacher-sidebar admin-full-sidebar">
   <div className="sidebar-brand"><span className="brand-mark">M10</span><span className="sidebar-brand-copy"><b>MATH10</b><small>ADMIN</small></span></div>
   <nav aria-label="Điều hướng quản trị">{items.map(([id,label,Icon])=><section key={id}><button className={active===id?"active":""} onClick={()=>{setActive(id);window.scrollTo({top:0,behavior:"smooth"})}}><span><Icon size={18}/></span><b>{label}</b></button></section>)}</nav>
  </aside>
  <div className="teacher-main">
   <header className="teacher-topbar">
    <div className="global-search"><b>Quản trị hệ thống</b></div>
    <div className="teacher-top-actions">
     <div className="top-menu">
      <button className="profile-trigger" aria-expanded={profileOpen} aria-haspopup="menu" onClick={()=>setProfileOpen(value=>!value)}>
       <span>{(session.email[0]||"A").toUpperCase()}</span>
       <b>{session.email}</b>
       <ChevronDown size={14} aria-hidden="true"/>
      </button>
      {profileOpen&&<div className="top-dropdown profile-dropdown" role="menu">
       <button role="menuitem" onClick={()=>{setProfileOpen(false);onChangePassword()}}><KeyRound size={15}/>Đổi mật khẩu</button>
       <button role="menuitem" onClick={()=>{setProfileOpen(false);onLogout()}}><LogOut size={15}/>Đăng xuất</button>
      </div>}
     </div>
    </div>
   </header>
   {children(active)}
  </div>
 </div>;
}

function AdminDashboard({session,activeSection}:{session:AuthSession;activeSection:string}) {
  const metadata=useMetadata(session);
  const statsQuery=useQuery({queryKey:["admin-stats",session.accessToken],queryFn:()=>getAdminStats(session)});
  const logsQuery=useQuery({queryKey:["admin-audit-logs",session.accessToken],queryFn:()=>getAuditLogs(session)});
  const stats=statsQuery.data??null;
  const logs=logsQuery.data??[];
  const error=statsQuery.isError?messageOf(statsQuery.error):logsQuery.isError?messageOf(logsQuery.error):"";
  return <div className="page live-dashboard admin-page-section">
      {error&&<div className="api-error">{error}</div>}
      {activeSection==="overview"&&<>
        <PageHeading eyebrow="QUẢN TRỊ HỆ THỐNG" title="Tổng quan" text="Theo dõi nhanh người dùng, lớp học, khóa học và nội dung đã xuất bản." />
        <section className="stat-grid">{stats&&[["Người dùng",stats.totalUsers],["Giáo viên",stats.teachers],["Học sinh",stats.students],["Lớp học",stats.classes],["Khóa học",stats.courses],["Khóa đã publish",stats.publishedCourses],["Bài toán publish",stats.publishedProblems]].map(([label,value])=><article key={label}><small>{label}</small><b>{value}</b></article>)}</section>
        <section className="admin-overview-grid"><article className="audit-panel"><h2>Phân bổ tài khoản</h2>{stats&&<div className="admin-distribution">{[["Giáo viên",stats.teachers],["Học sinh",stats.students],["Khác",Math.max(0,stats.totalUsers-stats.teachers-stats.students)]].map(([label,value])=><div key={label}><span><b>{label}</b><small>{Number(value).toLocaleString("vi-VN")}</small></span><progress max={Math.max(stats.totalUsers,1)} value={Number(value)}/></div>)}</div>}</article><article className="audit-panel"><h2>Hoạt động gần đây</h2>{logs.slice(0,6).map(log=><div className="audit-row" key={log.id}><b>{log.action}</b><span>{log.targetType}{log.targetId?` #${log.targetId}`:""}</span><small>{new Date(log.createdAt).toLocaleString("vi-VN")}</small></div>)}{!logs.length&&<EmptyState text="Chưa có hoạt động hệ thống."/>}</article></section>
      </>}
      {activeSection==="users"&&<>
        <UserAccountsPage session={session}/>
      </>}
      {activeSection==="textbooks"&&<TextbookManagement session={session}/>} 
      {activeSection==="documents"&&<DocumentManagement session={session}/>} 
      {activeSection==="topics"&&<TopicManagement session={session}/>} 
      {activeSection==="classes"&&<AdminClasses session={session}/>} 
      {activeSection==="audit"&&<AuditManagement session={session}/>} 
      {activeSection==="settings"&&<AdminSystemSettings session={session} metadata={metadata}/>}
  </div>;
}

function AdminSystemSettings({session,metadata}:{session:AuthSession;metadata:Metadata|null}) {
 const groups:[keyof Metadata,string][]=[["roles","Vai trò người dùng"],["userStatuses","Trạng thái tài khoản"],["classStatuses","Trạng thái lớp học"],["courseStatuses","Trạng thái khóa học"],["publishStatuses","Trạng thái xuất bản"],["documentTypes","Loại tài liệu"],["documentAudiences","Phạm vi tài liệu"]];
 return <><PageHeading eyebrow="HỆ THỐNG" title="Cài đặt hệ thống" text="Thông tin cấu hình đang được backend áp dụng cho tài khoản quản trị."/><section className="admin-settings-grid"><article className="audit-panel"><h2>Tài khoản quản trị</h2><dl className="settings-details"><div><dt>Email</dt><dd>{session.email}</dd></div><div><dt>Vai trò</dt><dd>{session.role}</dd></div><div><dt>Mã người dùng</dt><dd>{session.userId}</dd></div></dl></article>{groups.map(([key,title])=><article className="audit-panel" key={key}><h2>{title}</h2><div className="settings-options">{metadataOptions(metadata,key).map(option=><span key={option.value}><b>{option.label}</b><code>{option.value}</code></span>)}{!metadataOptions(metadata,key).length&&<small>Backend chưa khai báo dữ liệu.</small>}</div></article>)}</section></>;
}

function AdminClasses({session}:{session:AuthSession}){
 const metadata=useMetadata(session);
 const queryClient=useQueryClient();
 const [form,setForm]=useState({code:"",name:"",gradeId:0,status:""}),[editing,setEditing]=useState<number|null>(null),[selected,setSelected]=useState<Classroom|null>(null);
 const [search,setSearch]=useState(""),[gradeId,setGradeId]=useState(0),[status,setStatus]=useState(""),[formOpen,setFormOpen]=useState(false);
 const classesQuery=useQuery({queryKey:["admin-classes",session.accessToken,search,gradeId,status],queryFn:async()=>{const [page,nextGrades]=await Promise.all([getClassesPage(session,{search,gradeId:gradeId||undefined,status,size:100}),getGrades(session)]);const next=(page.content??[]) as Classroom[];const assignments=await Promise.all(next.map(async row=>[row.id,(await getEnrollments(session,"class-teachers",row.id)).map(item=>item.label).join(", ")] as const));return {rows:next,grades:nextGrades,teacherNames:Object.fromEntries(assignments) as Record<number,string>}}});
 const rows=classesQuery.data?.rows??[],grades=classesQuery.data?.grades??[],teacherNames=classesQuery.data?.teacherNames??{};
 const invalidate=()=>queryClient.invalidateQueries({queryKey:["admin-classes"]});
 const createMutation=useMutation({mutationFn:(input:ClassroomInput)=>createClass(session,input),onSuccess:invalidate});
 const updateMutation=useMutation({mutationFn:({id,input}:{id:number;input:ClassroomInput})=>updateClass(session,id,input),onSuccess:invalidate});
 const deleteMutation=useMutation({mutationFn:(id:number)=>deleteClass(session,id),onSuccess:invalidate});
 useEffect(()=>{const data=classesQuery.data;if(!data)return;setSelected(current=>current?data.rows.find(x=>x.id===current.id)??null:null);if(!form.gradeId&&data.grades[0])setForm(x=>({...x,gradeId:data.grades[0].id}))},[classesQuery.data]);
 useEffect(()=>{if(!editing)setForm(x=>({...x,status:x.status||firstMetadataValue(metadata,"classStatuses")}))},[editing,metadata]);
 const error=classesQuery.isError?messageOf(classesQuery.error):createMutation.isError?messageOf(createMutation.error):updateMutation.isError?messageOf(updateMutation.error):deleteMutation.isError?messageOf(deleteMutation.error):"";
 const reset=()=>{setEditing(null);setForm({code:"",name:"",gradeId:grades[0]?.id||0,status:firstMetadataValue(metadata,"classStatuses")});setFormOpen(false)};
 const save=async(e:React.FormEvent)=>{e.preventDefault();try{editing?await updateMutation.mutateAsync({id:editing,input:form as ClassroomInput}):await createMutation.mutateAsync(form as ClassroomInput);reset()}catch{/* lỗi đã có trong mutation state */}};
 const edit=(row:Classroom)=>{setEditing(row.id);setForm({code:row.code,name:row.name,gradeId:row.gradeId,status:row.status});setFormOpen(true)};
 const archive=async(row:Classroom)=>{if(!confirm(`Xóa lớp “${row.name}”? Dữ liệu lịch sử vẫn được giữ lại.`))return;try{await deleteMutation.mutateAsync(row.id);if(selected?.id===row.id)setSelected(null)}catch{/* lỗi đã có trong mutation state */}};
 const gradeName=(id:number)=>grades.find(x=>x.id===id)?.name??`Khối ${id}`,statusName=(value:string)=>metadataOptions(metadata,"classStatuses").find(x=>x.value===value)?.label??value;
 return <section className={`classroom-module ${selected?"has-detail":""}`}><div className="classroom-master"><header className="classroom-heading"><div><p>QUẢN TRỊ HỆ THỐNG</p><h1>Danh sách lớp học</h1><span>Quản lý và theo dõi tiến độ các lớp khối 10.</span></div><div><button className="secondary-action" onClick={()=>alert("Chức năng import lớp cần API kiểm tra và xác nhận ba bước; hệ thống chưa ghi dữ liệu giả.")}>Import danh sách học sinh</button><button className="primary-action" onClick={()=>{reset();setFormOpen(true)}}>+ Tạo lớp</button></div></header>{error&&<div className="accounts-error"><span>{error}</span><button onClick={()=>void classesQuery.refetch()}>Thử lại</button></div>}<div className="classroom-card"><div className="classroom-filters"><input aria-label="Tìm lớp" placeholder="Tìm kiếm lớp học, giáo viên…" value={search} onChange={e=>setSearch(e.target.value)}/><select value={gradeId} onChange={e=>setGradeId(Number(e.target.value))}><option value={0}>Tất cả khối</option>{grades.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Mọi trạng thái</option>{metadataOptions(metadata,"classStatuses").map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></div><div className="classroom-table-wrap"><table><thead><tr><th>Mã lớp</th><th>Năm học</th><th>Khối</th><th>Giáo viên</th><th>Học sinh</th><th>Khóa học</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{rows.map(row=><tr className={selected?.id===row.id?"selected":""} key={row.id} onClick={()=>setSelected(row)}><td><b>{row.code}</b><small>{row.name}</small></td><td className="numeric">{new Date(row.createdAt??Date.now()).getFullYear()}–{new Date(row.createdAt??Date.now()).getFullYear()+1}</td><td>{gradeName(row.gradeId)}</td><td className="class-teacher-name">{teacherNames[row.id]||<button className="assign-teacher" onClick={event=>{event.stopPropagation();setSelected(row)}}>Chưa phân công</button>}</td><td className="numeric">{row.studentCount}</td><td className="numeric">{row.courseCount}</td><td><span className={`status-chip status-${row.status.toLowerCase()}`}>{statusName(row.status)}</span></td><td className="class-actions"><button onClick={e=>{e.stopPropagation();edit(row)}}>Sửa</button><button className="danger-link" onClick={e=>{e.stopPropagation();void archive(row)}}>Xóa</button></td></tr>)}</tbody></table>{!rows.length&&<EmptyState text="Không có lớp phù hợp với bộ lọc."/>}</div><footer>{rows.length.toLocaleString("vi-VN")} lớp học</footer></div></div>{selected&&<ClassEnrollmentPanel session={session} classroom={selected} onClose={()=>setSelected(null)}/>} {formOpen&&<div className="accounts-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)reset()}}><aside className="account-panel"><header><div><p>{editing?"CHỈNH SỬA LỚP":"TẠO LỚP MỚI"}</p><h2>{editing?form.name:"Thông tin lớp học"}</h2></div><button onClick={reset}>×</button></header><form onSubmit={save}><label>Mã lớp<input required maxLength={30} value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></label><label>Tên lớp<input required maxLength={120} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Khối<select value={form.gradeId} onChange={e=>setForm({...form,gradeId:Number(e.target.value)})}>{grades.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Trạng thái<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{metadataOptions(metadata,"classStatuses").map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label><footer><button type="button" className="secondary-action" onClick={reset}>Hủy</button><button className="primary-action">{editing?"Lưu thay đổi":"Tạo lớp"}</button></footer></form></aside></div>}</section>;
}

function ClassEnrollmentPanel({session,classroom,onClose}:{session:AuthSession;classroom:Classroom;onClose:()=>void}){
 const queryClient=useQueryClient();
 const [teacherId,setTeacherId]=useState(0),[studentId,setStudentId]=useState(0),[courseId,setCourseId]=useState(0);
 const [tab,setTab]=useState<"students"|"assignments"|"settings">("students"),[search,setSearch]=useState("");
 const ENROLLMENT_QUERY_KEY=["class-enrollment",session.accessToken,classroom.id];
 const enrollmentQuery=useQuery({queryKey:ENROLLMENT_QUERY_KEY,queryFn:async()=>{const [t,st,c,u,allCourses,g]=await Promise.all([getEnrollments(session,"class-teachers",classroom.id),getEnrollments(session,"class-students",classroom.id),getEnrollments(session,"class-courses",classroom.id),getUsers(session),getCourses(session),getGradebook(session,classroom.id)]);return {teachers:t,students:st,assignedCourses:c,users:u,courses:allCourses,gradebook:g}}});
 const teachers=enrollmentQuery.data?.teachers??[],students=enrollmentQuery.data?.students??[],assignedCourses=enrollmentQuery.data?.assignedCourses??[];
 const users=enrollmentQuery.data?.users??[],courses=enrollmentQuery.data?.courses??[],gradebook=enrollmentQuery.data?.gradebook??[];
 const invalidate=()=>queryClient.invalidateQueries({queryKey:ENROLLMENT_QUERY_KEY});
 const addMutation=useMutation({mutationFn:({type,id}:{type:"class-teachers"|"class-students"|"class-courses";id:number})=>addEnrollment(session,type,{classId:classroom.id,...(type==="class-courses"?{courseId:id}:{userId:id})}),onSuccess:invalidate});
 const removeMutation=useMutation({mutationFn:({type,id}:{type:"class-teachers"|"class-students"|"class-courses";id:number})=>removeEnrollment(session,type,id),onSuccess:invalidate});
 const error=enrollmentQuery.isError?messageOf(enrollmentQuery.error):addMutation.isError?messageOf(addMutation.error):removeMutation.isError?messageOf(removeMutation.error):"";
 const add=(type:"class-teachers"|"class-students"|"class-courses",id:number)=>{if(!id)return;addMutation.mutate({type,id})};
 const progress=new Map<number,{sum:number;count:number}>();gradebook.forEach(row=>{const value=progress.get(row.student_id)??{sum:0,count:0};value.sum+=Number(row.completion_percent)||0;value.count+=1;progress.set(row.student_id,value)});
 const visibleStudents=students.filter(x=>x.label.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")));
 return <aside className="class-detail-panel"><header><div><h2>{classroom.name}</h2><span>{classroom.code} · {classroom.status}</span></div><button aria-label="Đóng panel" onClick={onClose}>×</button></header><nav><button className={tab==="students"?"active":""} onClick={()=>setTab("students")}>Học sinh <b>{students.length}</b></button><button className={tab==="assignments"?"active":""} onClick={()=>setTab("assignments")}>Phân công</button><button className={tab==="settings"?"active":""} onClick={()=>setTab("settings")}>Cài đặt</button></nav>{error&&<div className="accounts-error">{error}</div>}{tab==="students"&&<div className="class-detail-content"><div className="detail-toolbar"><input placeholder="Tìm học sinh…" value={search} onChange={e=>setSearch(e.target.value)}/><select value={studentId} onChange={e=>setStudentId(Number(e.target.value))}><option value={0}>Chọn học sinh để thêm</option>{users.filter(x=>x.roleCode==="STUDENT"&&!students.some(s=>s.userId===x.id)).map(x=><option key={x.id} value={x.id}>{x.fullName}</option>)}</select><button className="primary-action" disabled={!studentId} onClick={()=>void add("class-students",studentId)}>Thêm học sinh</button></div><div className="detail-table"><table><thead><tr><th>STT</th><th>Họ và tên</th><th>Tiến độ</th><th>Thao tác</th></tr></thead><tbody>{visibleStudents.map((row,index)=>{const p=progress.get(row.userId??0),percent=p?Math.round(p.sum/Math.max(p.count,1)):0;return <tr key={row.id}><td className="numeric">{index+1}</td><td><b>{row.label}</b><small>{users.find(x=>x.id===row.userId)?.username??"—"}</small></td><td><div className="student-progress"><span style={{width:`${Math.min(percent,100)}%`}}/><b>{percent}%</b></div></td><td><button onClick={()=>removeMutation.mutate({type:"class-students",id:row.id})}>Gỡ</button></td></tr>})}</tbody></table>{!visibleStudents.length&&<EmptyState text="Chưa có học sinh phù hợp."/>}</div></div>}{tab==="assignments"&&<div className="class-detail-content assignment-groups"><article><h3>Giáo viên phụ trách</h3><div className="detail-add"><select value={teacherId} onChange={e=>setTeacherId(Number(e.target.value))}><option value={0}>Chọn giáo viên</option>{users.filter(x=>x.roleCode==="TEACHER"&&!teachers.some(t=>t.userId===x.id)).map(x=><option key={x.id} value={x.id}>{x.fullName}</option>)}</select><button onClick={()=>void add("class-teachers",teacherId)}>Phân công</button></div>{teachers.map(x=><div className="assignment-row" key={x.id}><b>{x.label}</b><button onClick={()=>removeMutation.mutate({type:"class-teachers",id:x.id})}>Gỡ</button></div>)}</article><article><h3>Khóa học</h3><div className="detail-add"><select value={courseId} onChange={e=>setCourseId(Number(e.target.value))}><option value={0}>Chọn khóa học</option>{courses.filter(x=>!assignedCourses.some(c=>c.courseId===x.id)).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><button onClick={()=>void add("class-courses",courseId)}>Gán khóa</button></div>{assignedCourses.map(x=><div className="assignment-row" key={x.id}><b>{x.label}</b><button onClick={()=>removeMutation.mutate({type:"class-courses",id:x.id})}>Gỡ</button></div>)}</article></div>}{tab==="settings"&&<div className="class-detail-content privacy-note"><h3>Quyền riêng tư</h3><p>Quản trị viên chỉ xem tiến độ tổng hợp. Câu trả lời cá nhân và ghi chú riêng của giáo viên không được hiển thị.</p><h3>Dữ liệu lớp</h3><dl><div><dt>Giáo viên</dt><dd>{teachers.length}</dd></div><div><dt>Học sinh</dt><dd>{students.length}</dd></div><div><dt>Khóa học</dt><dd>{assignedCourses.length}</dd></div></dl></div>}</aside>;
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

 function TextbookCover({fileUrl,accessToken,title}:{fileUrl:string;accessToken?:string;title:string}){
 if(!fileUrl){
  return <div className="flex h-[132px] w-[96px] shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-center text-[10px] font-medium text-slate-400">Chưa có<br/>file</div>;
 }
 const absoluteUrl=/^https?:\/\//i.test(fileUrl)?fileUrl:`${(import.meta.env.VITE_API_BASE_URL as string|undefined)??""}${fileUrl}`;
 return <PdfThumbnail fileUrl={absoluteUrl} accessToken={accessToken}/>;
}

return (
  <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
   <div className="flex gap-4 p-5">
    <TextbookCover fileUrl={fileUrl} accessToken={accessToken} title={title}/>
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

function ChangePasswordDialog({session,onClose}:{session:AuthSession;onClose:()=>void}) {
  const [currentPassword,setCurrentPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [error,setError]=useState("");
  const [success,setSuccess]=useState(false);
  const [busy,setBusy]=useState(false);
  const submit=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setError("");try{await changePassword(session,currentPassword,newPassword,confirmPassword);setSuccess(true)}catch(reason){setError(messageOf(reason))}finally{setBusy(false)}};
  return <div className="dialog-backdrop"><section className="dialog-card"><div className="panel-head"><h2>Đổi mật khẩu</h2><button onClick={onClose}>Đóng</button></div>{success?<div className="success-state">Đổi mật khẩu thành công. Hãy dùng mật khẩu mới ở lần đăng nhập tiếp theo.</div>:<form className="live-form" onSubmit={submit}><label>Mật khẩu hiện tại<input type="password" required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label><label>Mật khẩu mới<input type="password" minLength={8} required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label><label>Xác nhận mật khẩu mới<input type="password" minLength={8} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>{error&&<div className="api-error">{error}</div>}<button className="primary" disabled={busy}>{busy?"Đang lưu…":"Đổi mật khẩu"}</button></form>}</section></div>;
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
    await openLessonDocumentFile(session,lesson.id,doc);
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

function SafeLessonContent({html}:{html:string}){
 const safe=useMemo(()=>{const template=document.createElement("template");template.innerHTML=html;template.content.querySelectorAll("script,style,iframe,object,embed,form").forEach(node=>node.remove());template.content.querySelectorAll<HTMLElement>("*").forEach(node=>{for(const attribute of Array.from(node.attributes)){const name=attribute.name.toLowerCase(),value=attribute.value.trim().toLowerCase();if(name.startsWith("on")||((name==="href"||name==="src")&&value.startsWith("javascript:")))node.removeAttribute(attribute.name)}});return template.innerHTML},[html]);
 return <div className="lesson-html" dangerouslySetInnerHTML={{__html:safe}}/>;
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
  const [gradeStudent,setGradeStudent]=useState<number|null>(null);
  const [gradebookClassId,setGradebookClassId]=useState<number|null>(null);
  const [contentTab,setContentTab]=useState<"courses"|"textbooks"|"problems"|"results">("problems");

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
  const gradebookQuery=useQuery({queryKey:["teacher-gradebook-select",session.accessToken,gradebookClassId],queryFn:()=>getGradebook(session,gradebookClassId as number),enabled:gradebookClassId!=null});
  const gradebook=gradebookQuery.data??[];
  const invalidateDashboard=()=>queryClient.invalidateQueries({queryKey:["teacher-dashboard"]});
  const createMutation=useMutation({mutationFn:(input:CourseInput)=>createCourse(session,input),onSuccess:invalidateDashboard});
  const updateMutation=useMutation({mutationFn:({id,input}:{id:number;input:CourseInput})=>updateCourse(session,id,input),onSuccess:invalidateDashboard});
  const deleteMutation=useMutation({mutationFn:(id:number)=>deleteCourse(session,id),onSuccess:invalidateDashboard});
  const saving=createMutation.isPending||updateMutation.isPending;
  const error=dashboardQuery.isError?messageOf(dashboardQuery.error):gradebookQuery.isError?messageOf(gradebookQuery.error):createMutation.isError?messageOf(createMutation.error):updateMutation.isError?messageOf(updateMutation.error):deleteMutation.isError?messageOf(deleteMutation.error):"";

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

  return (
    <div className="page live-dashboard teacher-page-section">
      {error && <div className="api-error">{error}</div>}

      {activeSection === "teacher-overview" && <>
        <div id="teacher-overview" data-teacher-section data-search="Dashboard giáo viên" className="section-anchor" />
        {unfinished&&<section className="overview-resume"><div><AlertTriangle size={19}/><span>Bạn có tiến độ đang theo dõi ở <b>{unfinished.title}</b> · {unfinished.className}</span></div><span>{unfinished.completion_percent}% hoàn thành</span></section>}
        <header className="overview-welcome"><h1>Chào {session.email.split("@")[0]}</h1><p>{new Intl.DateTimeFormat("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit"}).format(new Date())}. Tổng quan công việc và tiến độ các lớp đang phụ trách.</p></header>
        <section className="overview-metrics"><article><small>Lớp phụ trách</small><b>{teacherStats?.classes??classes.length}</b><span>{classes.reduce((sum,item)=>sum+item.studentCount,0).toLocaleString("vi-VN")} học sinh</span></article><article><small>Nhiệm vụ đang mở</small><b>{openAssignments.length}</b><span>{overviewAssignments.length} nhiệm vụ tất cả</span></article><article><small>Bài đang thực hiện</small><b>{pendingSubmissions.length}</b><span>Từ dữ liệu sổ điểm</span></article><article className="attention"><small>Cần chú ý</small><b>{teacherStats?.studentsBelow50??attentionStudents.length}</b><span>Học sinh tiến độ dưới 50%</span></article></section>
        <section className="overview-columns"><div><h2>Cần xử lý hôm nay</h2><div className="overview-task-list">{dueTasks.map(item=>{const due=new Date(item.dueAt!),overdue=due.getTime()<Date.now();return <article key={item.id}><Clock3 size={18}/><div><b>{item.title}</b><small>{item.className} · {overdue?"Đã quá hạn":"Hạn"} {due.toLocaleString("vi-VN")}</small></div><span className={overdue?"overdue":""}>{overdue?"Quá hạn":"Đang mở"}</span></article>})}{pendingSubmissions.slice(0,3).map(row=><article key={`progress-${row.student_id}-${row.assignment_id}`}><ClipboardList size={18}/><div><b>{row.title}</b><small>{row.full_name} · {row.className} · tiến độ {row.completion_percent}%</small></div><span>Chờ hoàn thành</span></article>)}{!dueTasks.length&&!pendingSubmissions.length&&<EmptyState text="Không có công việc cần xử lý."/>}</div></div><div><h2>Học sinh cần chú ý</h2><div className="attention-students">{attentionStudents.slice(0,4).map(student=><article key={student.id}><header><UserRound size={18}/><div><b>{student.name}</b><small>{student.className} · @{student.username}</small></div><strong>{student.average}%</strong></header><p>Tiến độ trung bình đang dưới ngưỡng 50%.</p><div className="attention-progress"><span style={{width:`${Math.max(0,Math.min(100,student.average))}%`}}/></div></article>)}{!attentionStudents.length&&<EmptyState text="Không có học sinh cần chú ý."/>}</div></div></section>
      </>}

      {activeSection === "teacher-content" && <>
        <div className="stitch-page-title"><div><h1>Nội dung học</h1><p>Quản lý chương trình, sách giáo khoa và ngân hàng câu hỏi.</p></div><button className="primary" onClick={()=>{setContentTab("problems");setTimeout(()=>document.getElementById("problem-create")?.scrollIntoView({behavior:"smooth",block:"start"}),0)}}>+ Tạo câu hỏi</button></div>
        <nav className="content-tabs"><button className={contentTab==="courses"?"active":""} onClick={()=>setContentTab("courses")}>Chương trình</button><button className={contentTab==="textbooks"?"active":""} onClick={()=>setContentTab("textbooks")}>Sách giáo khoa</button><button className={contentTab==="problems"?"active":""} onClick={()=>setContentTab("problems")}>Ngân hàng câu hỏi</button><button className={contentTab==="results"?"active":""} onClick={()=>setContentTab("results")}>Kết quả các lớp</button></nav>
        {contentTab==="courses"&&<section className="live-grid teacher-live"><article><h2>{editingId ? "Cập nhật khóa học" : "Tạo khóa học"}</h2><form id="course-create" className="live-form" onSubmit={save}><label>Mã khóa học<input required maxLength={50} value={form.code} onChange={event=>setForm({...form,code:event.target.value})}/></label><label>Tên khóa học<input required maxLength={255} value={form.name} onChange={event=>setForm({...form,name:event.target.value})}/></label><label>Mô tả<textarea value={form.description} onChange={event=>setForm({...form,description:event.target.value})}/></label><label>Trạng thái<select required value={form.status} onChange={event=>setForm({...form,status:event.target.value})}>{metadataOptions(metadata,"courseStatuses").map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label><div className="live-actions"><button className="primary" disabled={saving}>{saving?"Đang lưu…":"Lưu"}</button>{editingId&&<button type="button" onClick={()=>{setEditingId(null);setForm(emptyCourse(metadata))}}>Hủy</button>}</div></form></article><article><h2>Chương trình ({courses.length})</h2>{courses.map(course=><div className="live-row" key={course.id}><div><small>{course.code}</small><b>{course.name}</b><span>{course.status}</span></div><div className="row-actions"><button onClick={()=>setSelectedCourse(course)}>Nội dung</button><button onClick={()=>edit(course)}>Sửa</button></div></div>)}{!dashboardQuery.isLoading&&!courses.length&&<EmptyState text="Chưa có chương trình học."/>}</article></section>}
        {contentTab==="textbooks"&&<TextbookStudentView session={session}/>} 
        {contentTab==="problems"&&<MathWorkspace session={session}/>} 
        {contentTab==="results"&&<ClassResultsView session={session}/>}
        {selectedCourse&&<CurriculumManager session={session} course={selectedCourse} onClose={()=>setSelectedCourse(null)}/>} 
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

      {activeSection === "teacher-textbooks" && <>
        <div id="teacher-textbooks" data-teacher-section data-search="Sách giáo khoa" className="section-anchor" />
        <PageHeading eyebrow="SÁCH GIÁO KHOA" title="Sách giáo khoa" text="Xem và đọc sách giáo khoa Toán 10." />
        <TextbookStudentView session={session}/>
      </>}

      {activeSection === "teacher-classes" && <>
        <div id="teacher-classes" data-teacher-section data-search="Danh sách lớp học sinh" className="section-anchor" />
        <TeacherClassManager session={session} classes={classes} onChanged={invalidateDashboard}/>
      </>}

      {activeSection === "teacher-gradebook" && <>
        <div id="teacher-gradebook" data-teacher-section data-search="Sổ điểm Gradebook" className="section-anchor" />
        <PageHeading eyebrow="LỚP HỌC" title="Sổ điểm" text="Xem tiến độ và kết quả học tập theo từng lớp." />
        {classes.length>0?<GradebookMatrix classes={classes} rows={gradebook} selectedStudent={gradeStudent} onSelectStudent={setGradeStudent} onSelectClass={async id=>{setGradebookClassId(id);setGradeStudent(null)}}/>:<EmptyState text="Chưa có lớp học để xem sổ điểm."/>}
      </>}

      {activeSection === "teacher-grading" && <TeacherGradingView session={session} classes={classes} />}
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
        <PageHeading eyebrow="HỆ THỐNG" title="Cài đặt" text="Quản lý thông tin tài khoản và tùy chọn không gian làm việc." />
        <section className="teacher-settings-grid"><article><h2>Thông tin tài khoản</h2><dl><div><dt>Tài khoản</dt><dd>{session.email}</dd></div><div><dt>Vai trò</dt><dd>Giáo viên</dd></div><div><dt>Mã người dùng</dt><dd>#{session.userId}</dd></div></dl><p>Mật khẩu và đăng xuất được quản lý trong menu tài khoản ở góc trên bên phải.</p></article><article><h2>Tùy chọn hiển thị</h2><div className="settings-choice"><span><b>Ngôn ngữ</b><small>Tiếng Việt</small></span><span><b>Môn học</b><small>Toán 10</small></span><span><b>Giao diện</b><small>Sáng · Theo chuẩn Stitch</small></span></div></article><article><h2>Quyền riêng tư</h2><p>Dữ liệu lớp và tiến độ học sinh chỉ được lấy qua API có phân quyền giáo viên. Ứng dụng không truy cập trực tiếp cơ sở dữ liệu hoặc kho tài liệu.</p></article></section>
      </>}
    </div>
  );
}

type TeacherOperationMode = "grading" | "reports" | "tasks" | "notifications";

function TeacherGradingView({session,classes}:{session:AuthSession;classes:Classroom[]}) {
 const [classId,setClassId]=useState(classes[0]?.id??0),[selected,setSelected]=useState<GradebookRow|null>(null),[search,setSearch]=useState(""),[status,setStatus]=useState("IN_PROGRESS");
 const gradebookQuery=useQuery({queryKey:["teacher-grading",session.accessToken,classId],queryFn:()=>getGradebook(session,classId),enabled:!!classId});
 const rows=gradebookQuery.data??[];
 const loading=gradebookQuery.isLoading;
 const error=gradebookQuery.isError?messageOf(gradebookQuery.error):"";
 useEffect(()=>{if(!classes.some(item=>item.id===classId))setClassId(classes[0]?.id??0)},[classes,classId]);
 const filtered=rows.filter(row=>(!status||row.status===status)&&(!search||`${row.full_name} ${row.username} ${row.title}`.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"))));
 const inProgress=rows.filter(row=>row.status==="IN_PROGRESS").length,completed=rows.filter(row=>row.status==="COMPLETED").length,notOpened=rows.filter(row=>row.status!=="IN_PROGRESS"&&row.status!=="COMPLETED").length;
 const selectedClass=classes.find(item=>item.id===classId);
 return <section className="teacher-operation-page grading-workspace"><header className="grading-heading"><div><h1>Hàng đợi chấm bài</h1><p>{selectedClass?.name??"Chọn lớp để xem bài"}</p></div><select value={classId} onChange={e=>setClassId(Number(e.target.value))}>{classes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></header><section className="grading-metrics"><article><small>Đang thực hiện</small><b>{inProgress}</b><span>lượt bài cần theo dõi</span></article><article><small>Chưa mở</small><b>{notOpened}</b><span>lượt bài chưa bắt đầu</span></article><article><small>Đã hoàn thành</small><b>{completed}</b><span>lượt bài</span></article></section><div className="grading-filters"><input placeholder="Tìm học sinh hoặc bài tập…" value={search} onChange={e=>setSearch(e.target.value)}/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tất cả trạng thái</option><option value="IN_PROGRESS">Đang thực hiện</option><option value="COMPLETED">Đã hoàn thành</option><option value="NOT_OPENED">Chưa mở</option></select><span>{filtered.length} lượt bài</span></div>{error&&<div className="api-error">{error}</div>}{loading?<p>Đang tải hàng đợi…</p>:<div className="grading-table"><table><thead><tr><th>Học sinh</th><th>Bài tập</th><th>Tiến độ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{filtered.map(row=><tr key={`${row.student_id}-${row.assignment_id}`}><td><span className="student-initial">{row.full_name.split(/\s+/).slice(-2).map(part=>part[0]).join("").toUpperCase()}</span><div><b>{row.full_name}</b><small>@{row.username}</small></div></td><td>{row.title}</td><td><div className="grading-progress"><span style={{width:`${Math.max(0,Math.min(100,row.completion_percent))}%`}}/></div><small>{row.completion_percent}%</small></td><td><span className={`status-chip status-${row.status.toLowerCase()}`}>{row.status==="COMPLETED"?"Đã hoàn thành":row.status==="IN_PROGRESS"?"Đang làm":"Chưa mở"}</span></td><td><button onClick={()=>setSelected(row)}>Xem chi tiết</button></td></tr>)}</tbody></table>{!filtered.length&&<EmptyState text="Không có lượt bài phù hợp bộ lọc."/>}</div>}{selected&&<div className="dialog-backdrop"><section className="dialog-card grading-detail"><div className="panel-head"><div><p className="eyebrow">CHI TIẾT BÀI LÀM</p><h2>{selected.full_name}</h2></div><button onClick={()=>setSelected(null)}>Đóng</button></div><dl><div><dt>Bài tập</dt><dd>{selected.title}</dd></div><div><dt>Lớp</dt><dd>{selectedClass?.name}</dd></div><div><dt>Trạng thái</dt><dd>{selected.status==="COMPLETED"?"Đã hoàn thành":selected.status==="IN_PROGRESS"?"Đang thực hiện":"Chưa mở"}</dd></div><div><dt>Tiến độ</dt><dd>{selected.completion_percent}%</dd></div></dl><div className="grading-api-note"><AlertTriangle size={18}/><p>Chưa thể nhập điểm: API hiện chưa cung cấp bài nộp đính kèm, rubric và endpoint lưu điểm. Màn hình không tạo dữ liệu chấm giả.</p></div></section></div>}</section>
}

function TeacherWorksheetView({session,classes}:{session:AuthSession;classes:Classroom[]}) {
 const queryClient=useQueryClient();
 const [search,setSearch]=useState(""),[qrFilter,setQrFilter]=useState(""),[preview,setPreview]=useState<Worksheet|null>(null),[assigning,setAssigning]=useState<Worksheet|null>(null);
 const [form,setForm]=useState({classId:classes[0]?.id??0,title:"",dueAt:""});
 const classIdsKey=classes.map(item=>item.id).join(",");
 const worksheetsQuery=useQuery({queryKey:["teacher-worksheets",session.accessToken,classIdsKey],queryFn:async()=>{const [sheets,...classAssignments]=await Promise.all([getWorksheets(session),...classes.map(async classroom=>(await getAssignments(session,classroom.id)).map(item=>({...item,className:classroom.name})))]);return {rows:sheets as Worksheet[],assignments:(classAssignments as (Assignment&{className:string})[][]).flat()}}});
 const rows=worksheetsQuery.data?.rows??[],assignments=worksheetsQuery.data?.assignments??[],loading=worksheetsQuery.isLoading;
 const assignMutation=useMutation({mutationFn:(input:Parameters<typeof saveAssignment>[1])=>saveAssignment(session,input),onSuccess:()=>queryClient.invalidateQueries({queryKey:["teacher-worksheets"]})});
 const error=worksheetsQuery.isError?messageOf(worksheetsQuery.error):assignMutation.isError?messageOf(assignMutation.error):"";
 useEffect(()=>{if(!classes.some(item=>item.id===form.classId))setForm(value=>({...value,classId:classes[0]?.id??0}))},[classes,form.classId]);
 const filtered=rows.filter(item=>(!search||item.name.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")))&&(!qrFilter||(qrFilter==="QR"?item.showQr:!item.showQr)));
 const assignedClasses=(worksheetId:number)=>Array.from(new Set(assignments.filter(item=>item.worksheetId===worksheetId).map(item=>item.className)));
 const assign=async(e:React.FormEvent)=>{e.preventDefault();if(!assigning)return;try{await assignMutation.mutateAsync({classId:form.classId,lessonId:null,worksheetId:assigning.id,title:form.title||assigning.name,dueAt:form.dueAt||null,status:"PUBLISHED"});setAssigning(null)}catch{/* lỗi đã có trong mutation state */}};
 const goCreate=()=>window.dispatchEvent(new CustomEvent("math10:navigate",{detail:"teacher-content"}));
 return <section className="worksheet-manager"><header><div><h1>Quản lý Phiếu & Đề</h1><p>Tạo, xem trước, in và giao phiếu bài tập cho lớp.</p></div><button className="primary" onClick={goCreate}>＋ Tạo phiếu mới</button></header><div className="worksheet-filters"><input placeholder="Tìm tên phiếu…" value={search} onChange={e=>setSearch(e.target.value)}/><select value={qrFilter} onChange={e=>setQrFilter(e.target.value)}><option value="">Tất cả loại</option><option value="QR">Phiếu in có QR</option><option value="NO_QR">Phiếu không QR</option></select><span>{filtered.length} phiếu</span></div>{error&&<div className="api-error">{error}</div>}{loading?<p>Đang tải phiếu…</p>:<div className="worksheet-table"><table><thead><tr><th>Tên phiếu</th><th>Loại</th><th>Bố cục</th><th>Số câu</th><th>Đã giao</th><th>Thao tác</th></tr></thead><tbody>{filtered.map(item=>{const assigned=assignedClasses(item.id);return <tr key={item.id}><td><b>{item.name}</b><small>Phiếu #{item.id}</small></td><td><span className="worksheet-kind">{item.showQr?"Phiếu in có QR":"Phiếu in"}</span></td><td>{item.columnsCount} cột{item.showStudentFields?" · Có ô học sinh":""}</td><td className="numeric">{item.items.length}</td><td>{assigned.length?assigned.join(", "):<i>Chưa giao</i>}</td><td><div><button onClick={()=>setPreview(item)}>Xem / In</button><button className="primary" disabled={!classes.length} onClick={()=>{setAssigning(item);setForm(value=>({...value,title:item.name}))}}>Giao bài</button></div></td></tr>})}</tbody></table>{!filtered.length&&<EmptyState text="Không có phiếu phù hợp bộ lọc."/>}</div>}{preview&&<WorksheetPreview sheet={preview} onClose={()=>setPreview(null)}/>} {assigning&&<div className="dialog-backdrop"><section className="dialog-card"><div className="panel-head"><div><p className="eyebrow">GIAO PHIẾU</p><h2>{assigning.name}</h2></div><button onClick={()=>setAssigning(null)}>Đóng</button></div><form className="live-form" onSubmit={assign}><label>Lớp học<select required value={form.classId} onChange={e=>setForm({...form,classId:Number(e.target.value)})}>{classes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Tên nhiệm vụ<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>Hạn nộp<input type="datetime-local" value={form.dueAt} onChange={e=>setForm({...form,dueAt:e.target.value})}/></label><button className="primary">Giao phiếu</button></form></section></div>}</section>
}

function TeacherTaskView({session,classes}:{session:AuthSession;classes:Classroom[]}) {
 const queryClient=useQueryClient();
 const [classFilter,setClassFilter]=useState(0),[statusFilter,setStatusFilter]=useState(""),[search,setSearch]=useState(""),[open,setOpen]=useState(false);
 const [form,setForm]=useState({classId:classes[0]?.id??0,title:"",worksheetId:0,dueAt:"",status:"PUBLISHED"});
 const classIdsKey=classes.map(item=>item.id).join(",");
 const tasksQuery=useQuery({queryKey:["teacher-tasks",session.accessToken,classIdsKey],queryFn:async()=>{const [sheets,...byClass]=await Promise.all([getWorksheets(session),...classes.map(async classroom=>{const [assignments,gradebook]=await Promise.all([getAssignments(session,classroom.id),getGradebook(session,classroom.id)]);return assignments.map(item=>{const related=gradebook.filter(row=>row.assignment_id===item.id);return {...item,className:classroom.name,completed:related.filter(row=>row.status==="COMPLETED").length,total:related.length}})})]);return {worksheets:sheets as Worksheet[],rows:(byClass as (Assignment&{className:string;completed:number;total:number})[][]).flat()}}});
 const rows=tasksQuery.data?.rows??[],worksheets=tasksQuery.data?.worksheets??[],loading=tasksQuery.isLoading;
 const saveMutation=useMutation({mutationFn:(input:Parameters<typeof saveAssignment>[1])=>saveAssignment(session,input),onSuccess:()=>queryClient.invalidateQueries({queryKey:["teacher-tasks"]})});
 const error=tasksQuery.isError?messageOf(tasksQuery.error):saveMutation.isError?messageOf(saveMutation.error):"";
 useEffect(()=>{if(!classes.some(item=>item.id===form.classId))setForm(value=>({...value,classId:classes[0]?.id??0}))},[classes,form.classId]);
 const save=async(e:React.FormEvent)=>{e.preventDefault();try{await saveMutation.mutateAsync({classId:form.classId,lessonId:null,worksheetId:form.worksheetId||null,title:form.title,dueAt:form.dueAt||null,status:form.status});setOpen(false);setForm({classId:classes[0]?.id??0,title:"",worksheetId:0,dueAt:"",status:"PUBLISHED"})}catch{/* lỗi đã có trong mutation state */}};
 const filtered=rows.filter(item=>(!classFilter||item.classId===classFilter)&&(!statusFilter||item.status===statusFilter)&&(!search||item.title.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"))));
 return <section className="teacher-operation-page task-workspace"><header className="task-heading"><div><h1>Quản lý Nhiệm vụ</h1><p>Giao bài tập, kiểm tra và theo dõi tiến độ học sinh.</p></div><button className="primary" onClick={()=>setOpen(true)}>＋ Tạo nhiệm vụ</button></header><div className="task-filters"><input placeholder="Tìm nhiệm vụ…" value={search} onChange={e=>setSearch(e.target.value)}/><select value={classFilter} onChange={e=>setClassFilter(Number(e.target.value))}><option value={0}>Tất cả các lớp</option>{classes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">Tất cả trạng thái</option><option value="PUBLISHED">Đang mở</option><option value="DRAFT">Chưa giao</option><option value="HIDDEN">Đã đóng</option></select><span>{filtered.length} nhiệm vụ</span></div>{error&&<div className="api-error">{error}</div>}{loading?<p>Đang tải nhiệm vụ…</p>:<div className="task-table"><table><thead><tr><th>Tên nhiệm vụ</th><th>Loại</th><th>Lớp</th><th>Hạn nộp</th><th>Tiến độ nộp</th><th>Trạng thái</th></tr></thead><tbody>{filtered.map(item=>{const percent=item.total?Math.round(item.completed*100/item.total):0,due=item.dueAt?new Date(item.dueAt):null,overdue=Boolean(due&&due.getTime()<Date.now());return <tr key={item.id}><td><b>{item.title}</b><small>#{item.id}</small></td><td><span className="task-type">{item.worksheetId?"Phiếu bài tập":"Bài học"}</span></td><td>{item.className}</td><td className={overdue?"task-overdue":""}>{due?due.toLocaleString("vi-VN"):"Không giới hạn"}</td><td><div className="task-progress"><div><span style={{width:`${percent}%`}}/></div><small>{item.completed}/{item.total}</small></div></td><td><span className={`status-chip status-${item.status.toLowerCase()}`}>{item.status==="PUBLISHED"?"Đang mở":item.status==="DRAFT"?"Chưa giao":"Đã đóng"}</span></td></tr>})}</tbody></table>{!filtered.length&&<EmptyState text="Không có nhiệm vụ phù hợp bộ lọc."/>}</div>}{open&&<div className="dialog-backdrop"><section className="dialog-card task-dialog"><div className="panel-head"><div><p className="eyebrow">TẠO NHIỆM VỤ</p><h2>Giao phiếu bài tập</h2></div><button onClick={()=>setOpen(false)}>Đóng</button></div><form className="live-form" onSubmit={save}><label>Lớp học<select required value={form.classId} onChange={e=>setForm({...form,classId:Number(e.target.value)})}>{classes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Tên nhiệm vụ<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>Phiếu bài tập<select required value={form.worksheetId} onChange={e=>setForm({...form,worksheetId:Number(e.target.value)})}><option value={0}>Chọn phiếu…</option>{worksheets.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Hạn nộp<input type="datetime-local" value={form.dueAt} onChange={e=>setForm({...form,dueAt:e.target.value})}/></label><label>Trạng thái<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="PUBLISHED">Giao ngay</option><option value="DRAFT">Lưu nháp</option></select></label><div className="live-actions"><button type="button" onClick={()=>setOpen(false)}>Hủy</button><button className="primary">Tạo nhiệm vụ</button></div></form></section></div>}</section>
}

function TeacherOperationsView({session,classes,mode}:{session:AuthSession;classes:Classroom[];mode:TeacherOperationMode}) {
 const [classId,setClassId]=useState(classes[0]?.id??0);
 useEffect(()=>{if(!classes.some(item=>item.id===classId))setClassId(classes[0]?.id??0)},[classes,classId]);
 const operationsQuery=useQuery({queryKey:["teacher-operations",session.accessToken,classId],queryFn:async()=>{const [assignments,rows]=await Promise.all([getAssignments(session,classId),getGradebook(session,classId)]);return {assignments,rows}},enabled:!!classId});
 const assignments=operationsQuery.data?.assignments??[],rows=operationsQuery.data?.rows??[],loading=operationsQuery.isLoading;
 const error=operationsQuery.isError?messageOf(operationsQuery.error):"";
 const selectedClass=classes.find(item=>item.id===classId);
 const completed=rows.filter(row=>row.status==="COMPLETED").length;
 const inProgress=rows.filter(row=>row.status==="IN_PROGRESS").length;
 const average=rows.length?Math.round(rows.reduce((sum,row)=>sum+(Number(row.completion_percent)||0),0)/rows.length):0;
 const overdue=assignments.filter(item=>item.dueAt&&new Date(item.dueAt).getTime()<Date.now()&&item.status!=="COMPLETED");
 const upcoming=assignments.filter(item=>item.dueAt&&new Date(item.dueAt).getTime()>=Date.now()).sort((a,b)=>new Date(a.dueAt!).getTime()-new Date(b.dueAt!).getTime());
 const heading={grading:["CHẤM BÀI","Chấm bài","Theo dõi bài nộp và mức độ hoàn thành của học sinh theo lớp."],reports:["BÁO CÁO","Báo cáo học tập","Tổng hợp tiến độ thực tế từ sổ điểm của lớp."],tasks:["CÔNG VIỆC","Nhiệm vụ","Các đầu việc cần xử lý dựa trên hạn giao bài và tiến độ lớp."],notifications:["HỆ THỐNG","Thông báo","Những cập nhật cần chú ý từ lớp học và bài tập."]}[mode];
 return <section className="teacher-operation-page"><PageHeading eyebrow={heading[0]} title={heading[1]} text={heading[2]}/><div className="operation-toolbar"><label>Lớp học<select value={classId} onChange={e=>setClassId(Number(e.target.value))}>{classes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><span>{selectedClass?`${selectedClass.studentCount} học sinh · ${selectedClass.code}`:"Chưa có lớp học"}</span></div>{error&&<div className="api-error">{error}</div>}{loading&&<p>Đang tải dữ liệu…</p>}
 {mode==="reports"&&(()=>{const studentStats=Array.from(new Map(rows.map(row=>[row.student_id,{id:row.student_id,name:row.full_name,username:row.username,items:rows.filter(item=>item.student_id===row.student_id)}])).values()).map(student=>({...student,average:Math.round(student.items.reduce((sum,item)=>sum+(Number(item.completion_percent)||0),0)/student.items.length)})).sort((a,b)=>a.average-b.average);const attention=studentStats.filter(student=>student.average<50);const assignmentStats=assignments.map(item=>{const related=rows.filter(row=>row.assignment_id===item.id),done=related.filter(row=>row.status==="COMPLETED").length,started=related.filter(row=>row.status==="IN_PROGRESS").length;return {...item,total:related.length,done,started,percent:related.length?Math.round(done*100/related.length):0}}).sort((a,b)=>a.percent-b.percent);return <div className="report-dashboard"><div className="report-metrics"><article><small>Tỉ lệ hoàn thành</small><b>{average}%</b><div className="report-meter"><span style={{width:`${average}%`}}/></div></article><article><small>Lượt bài đã hoàn thành</small><b>{completed}</b><span>{rows.length?`${Math.round(completed*100/rows.length)}% tổng lượt bài`:'Chưa có dữ liệu'}</span></article><article><small>Đang thực hiện</small><b>{inProgress}</b><span>{assignments.length} nhiệm vụ trong lớp</span></article><article className="risk"><small>Cần xem lại</small><b>{attention.length}</b><span>Học sinh có tiến độ dưới 50%</span></article></div><div className="report-chart-grid"><section className="report-card"><header><h2>Tiến độ theo nhiệm vụ</h2><span>{assignmentStats.length} nhiệm vụ</span></header>{assignmentStats.length?<div className="report-bars">{assignmentStats.map(item=><div key={item.id}><div className="report-bar-label"><span title={item.title}>{item.title}</span><b>{item.percent}%</b></div><div className="report-bar-track"><span className={item.percent<50?'low':''} style={{width:`${item.percent}%`}}/></div><small>{item.done}/{item.total} hoàn thành · {item.started} đang làm</small></div>)}</div>:<EmptyState text="Lớp chưa có nhiệm vụ để lập báo cáo."/>}</section><section className="report-card"><header><h2>Phân bố tiến độ học sinh</h2><span>{studentStats.length} học sinh có dữ liệu</span></header><div className="report-distribution">{[{label:'Tốt',min:80,color:'good'},{label:'Đang tiến bộ',min:50,color:'medium'},{label:'Cần chú ý',min:0,color:'low'}].map((bucket,index)=>{const upper=index===0?101:index===1?80:50,count=studentStats.filter(student=>student.average>=bucket.min&&student.average<upper).length,percent=studentStats.length?Math.round(count*100/studentStats.length):0;return <div key={bucket.label}><span className={bucket.color}/><div><b>{bucket.label}</b><small>{bucket.min}{index===0?'+':index===1?'–79':'–49'}%</small></div><strong>{count}</strong><em>{percent}%</em></div>})}</div></section></div><div className="report-table-grid"><section className="report-card"><header><h2>Nhiệm vụ cần xem lại</h2><span>Xếp theo tỉ lệ hoàn thành</span></header><div className="report-table"><table><thead><tr><th>Nhiệm vụ</th><th>Đã xong</th><th>Tỉ lệ</th><th>Nhận định</th></tr></thead><tbody>{assignmentStats.slice(0,5).map(item=><tr key={item.id}><td><b>{item.title}</b><small>#{item.id}</small></td><td>{item.done}/{item.total}</td><td><strong className={item.percent<50?'danger':''}>{item.percent}%</strong></td><td>{item.percent<50?'Cần hỗ trợ thêm':item.percent<80?'Đang tiến triển':'Tiến độ tốt'}</td></tr>)}</tbody></table></div>{!assignmentStats.length&&<EmptyState text="Chưa có nhiệm vụ để phân tích."/>}</section><section className="report-card risk-list"><header><h2><AlertTriangle size={19}/> Học sinh cần xem lại</h2><span>Tiến độ dưới 50%</span></header>{attention.slice(0,6).map(student=><article key={student.id}><span className="student-initial">{student.name.split(/\s+/).slice(-2).map(part=>part[0]).join('').toUpperCase()}</span><div><b>{student.name}</b><small>@{student.username} · {student.items.filter(item=>item.status==="COMPLETED").length}/{student.items.length} lượt bài hoàn thành</small></div><strong>{student.average}%</strong></article>)}{!attention.length&&<EmptyState text="Không có học sinh nào dưới ngưỡng cần chú ý."/>}</section></div></div>})()}
 {mode==="grading"&&<section className="audit-panel"><div className="panel-head"><div><p className="eyebrow">BÀI NỘP THEO TIẾN ĐỘ</p><h2>{selectedClass?.name??"Chọn lớp"}</h2></div></div>{rows.length?<div className="operation-table"><table><thead><tr><th>Học sinh</th><th>Bài tập</th><th>Trạng thái</th><th>Hoàn thành</th></tr></thead><tbody>{rows.map(row=><tr key={`${row.student_id}-${row.assignment_id}`}><td><b>{row.full_name}</b><small>@{row.username}</small></td><td>{row.title}</td><td><span className={`status-chip status-${row.status.toLowerCase()}`}>{row.status==="COMPLETED"?"Đã hoàn thành":row.status==="IN_PROGRESS"?"Đang làm":"Chưa mở"}</span></td><td>{row.completion_percent}%</td></tr>)}</tbody></table></div>:<EmptyState text="Chưa có bài nộp trong lớp này."/>}</section>}
 {mode==="tasks"&&<section className="operation-feed"><h2>Việc cần làm</h2>{overdue.map(item=><article className="urgent" key={item.id}><span>Quá hạn</span><div><b>Kiểm tra tiến độ: {item.title}</b><small>Hạn {new Date(item.dueAt!).toLocaleString("vi-VN")} · {selectedClass?.name}</small></div></article>)}{upcoming.map(item=><article key={item.id}><span>Sắp tới</span><div><b>Theo dõi: {item.title}</b><small>Hạn {new Date(item.dueAt!).toLocaleString("vi-VN")} · {selectedClass?.name}</small></div></article>)}{!overdue.length&&!upcoming.length&&<EmptyState text="Không có nhiệm vụ theo hạn bài tập."/>}</section>}
 {mode==="notifications"&&<section className="operation-feed"><h2>Cập nhật mới nhất</h2>{overdue.map(item=><article className="urgent" key={`due-${item.id}`}><span>Cần chú ý</span><div><b>Bài “{item.title}” đã quá hạn</b><small>{selectedClass?.name} · Hạn {new Date(item.dueAt!).toLocaleString("vi-VN")}</small></div></article>)}{average<50&&rows.length>0&&<article><span>Tiến độ</span><div><b>Tiến độ trung bình của lớp đang dưới 50%</b><small>{selectedClass?.name} · Hiện tại {average}%</small></div></article>}{completed>0&&<article><span>Hoàn thành</span><div><b>{completed} lượt bài đã hoàn thành</b><small>Dữ liệu cập nhật từ sổ điểm</small></div></article>}{!overdue.length&&!(average<50&&rows.length)&&!completed&&<EmptyState text="Hiện chưa có thông báo mới."/>}</section>}
 </section>
}

function GradebookMatrix({classes,rows,selectedStudent,onSelectStudent,onSelectClass}:{classes:Classroom[];rows:GradebookRow[];selectedStudent:number|null;onSelectStudent:(id:number|null)=>void;onSelectClass:(id:number)=>Promise<void>}){
 const students=Array.from(new Map(rows.map(row=>[row.student_id,{id:row.student_id,name:row.full_name,username:row.username}])).values());
 const assignments=Array.from(new Map(rows.map(row=>[row.assignment_id,{id:row.assignment_id,title:row.title}])).values());
 const icon=(status:string)=>status==="COMPLETED"?"✓":status==="IN_PROGRESS"?"●":"○";
 const label=(status:string)=>status==="COMPLETED"?"Đã xong":status==="IN_PROGRESS"?"Đang làm":"Chưa mở";
 return <section className="audit-panel gradebook"><div className="panel-head"><div><p className="eyebrow">SỔ ĐIỂM TIẾN ĐỘ</p><h2>Học sinh × Bài tập</h2></div><div className="gradebook-class-tabs">{classes.map(item=><button key={item.id} onClick={()=>void onSelectClass(item.id)}>{item.name}</button>)}</div></div>{rows.length?<div className="gradebook-scroll"><table className="gradebook-matrix"><thead><tr><th>Học sinh</th>{assignments.map(item=><th key={item.id} title={item.title}>{item.title}</th>)}</tr></thead><tbody>{students.map(student=><tr key={student.id}><th><button onClick={()=>onSelectStudent(student.id)}>{student.name}<small>@{student.username}</small></button></th>{assignments.map(assignment=>{const row=rows.find(item=>item.student_id===student.id&&item.assignment_id===assignment.id);return <td key={assignment.id}><span className={`progress-icon ${(row?.status||"NOT_OPENED").toLowerCase()}`} title={`${label(row?.status||"NOT_OPENED")} · ${row?.completion_percent||0}%`}>{icon(row?.status||"NOT_OPENED")}</span></td>})}</tr>)}</tbody></table></div>:<EmptyState text="Chọn lớp để xem sổ điểm tiến độ."/>}{selectedStudent&&<div className="student-grade-detail"><div className="panel-head"><h3>Chi tiết · {rows.find(x=>x.student_id===selectedStudent)?.full_name}</h3><button onClick={()=>onSelectStudent(null)}>Đóng</button></div>{rows.filter(x=>x.student_id===selectedStudent).map(x=><div className="live-row" key={x.assignment_id}><b>{x.title}</b><span>{label(x.status)} · {x.completion_percent}%</span></div>)}</div>}</section>
}

function TeacherClassManager({session,classes,onChanged}:{session:AuthSession;classes:Classroom[];onChanged:()=>Promise<void>}){
 const metadata=useMetadata(session);
 const queryClient=useQueryClient();
 const [editing,setEditing]=useState<Classroom|null>(null),[form,setForm]=useState({code:"",name:"",gradeId:0,status:""}),[formOpen,setFormOpen]=useState(false);
 const gradesQuery=useQuery({queryKey:["teacher-class-manager-grades",session.accessToken],queryFn:()=>getGrades(session)});
 const grades=gradesQuery.data??[];
 const classIdsKey=classes.map(item=>item.id).join(",");
 const metricsQuery=useQuery({queryKey:["teacher-class-manager-metrics",session.accessToken,classIdsKey],queryFn:async()=>{const values=await Promise.all(classes.map(async classroom=>{const [assignments,book]=await Promise.all([getAssignments(session,classroom.id),getGradebook(session,classroom.id)]);const byStudent=Array.from(new Set(book.map(row=>row.student_id))).map(id=>{const own=book.filter(row=>row.student_id===id);return own.length?own.reduce((sum,row)=>sum+(Number(row.completion_percent)||0),0)/own.length:0});return [classroom.id,{openTasks:assignments.filter(item=>item.status==="PUBLISHED").length,average:book.length?Math.round(book.reduce((sum,row)=>sum+(Number(row.completion_percent)||0),0)/book.length):0,attention:byStudent.filter(value=>value<50).length}] as const}));return Object.fromEntries(values) as Record<number,{openTasks:number;average:number;attention:number}>},enabled:classes.length>0});
 const metrics=metricsQuery.data??{};
 const invalidateMetrics=()=>queryClient.invalidateQueries({queryKey:["teacher-class-manager-metrics"]});
 const createMutation=useMutation({mutationFn:(input:ClassroomInput)=>createClass(session,input),onSuccess:async()=>{invalidateMetrics();await onChanged()}});
 const updateMutation=useMutation({mutationFn:({id,input}:{id:number;input:ClassroomInput})=>updateClass(session,id,input),onSuccess:async()=>{invalidateMetrics();await onChanged()}});
 const deleteMutation=useMutation({mutationFn:(id:number)=>deleteClass(session,id),onSuccess:async()=>{invalidateMetrics();await onChanged()}});
 const error=gradesQuery.isError?messageOf(gradesQuery.error):metricsQuery.isError?messageOf(metricsQuery.error):createMutation.isError?messageOf(createMutation.error):updateMutation.isError?messageOf(updateMutation.error):deleteMutation.isError?messageOf(deleteMutation.error):"";
 useEffect(()=>{if(grades[0])setForm(value=>({...value,gradeId:value.gradeId||grades[0].id}))},[grades]);
 useEffect(()=>{if(!editing)setForm(current=>({...current,status:current.status||firstMetadataValue(metadata,"classStatuses")}))},[editing,metadata]);
 const reset=()=>{setEditing(null);setFormOpen(false);setForm({code:"",name:"",gradeId:grades[0]?.id||0,status:firstMetadataValue(metadata,"classStatuses")})};
  const save=async(e:React.FormEvent)=>{e.preventDefault();try{if(editing)await updateMutation.mutateAsync({id:editing.id,input:form as ClassroomInput});else await createMutation.mutateAsync(form as ClassroomInput);reset()}catch{/* lỗi đã có trong mutation state */}};
 return <section className="teacher-class-manager"><header className="teacher-class-heading"><div><h1>Danh sách lớp học</h1><p>Quản lý và theo dõi tiến độ học tập của các lớp Khối 10.</p></div><button className="primary" onClick={()=>{reset();setFormOpen(true)}}>＋ Thêm lớp học</button></header>{error&&<div className="api-error">{error}</div>}<div className="teacher-class-grid">{classes.map(item=>{const stat=metrics[item.id]??{openTasks:0,average:0,attention:0};return <article key={item.id}><header><div><h3>{item.name}</h3><small>{item.code} · {grades.find(grade=>grade.id===item.gradeId)?.name??`Khối #${item.gradeId}`}</small></div><button onClick={()=>{setEditing(item);setForm({code:item.code,name:item.name,gradeId:item.gradeId,status:item.status});setFormOpen(true)}}>•••</button></header><dl><div><dt>Sĩ số</dt><dd>{item.studentCount}</dd></div><div><dt>Nhiệm vụ mở</dt><dd>{stat.openTasks}</dd></div><div><dt>Tiến độ TB</dt><dd>{stat.average}%</dd></div><div className="attention"><dt>Cần chú ý</dt><dd>{stat.attention} hs</dd></div></dl><footer><span className={`status-chip status-${item.status.toLowerCase()}`}>{item.status}</span><button className="danger-link" onClick={()=>{if(confirm(`Xóa lớp “${item.name}”?`))deleteMutation.mutate(item.id)}}>Xóa</button></footer></article>})}</div>{!classes.length&&<EmptyState text="Chưa có lớp học."/>}{formOpen&&<div className="dialog-backdrop"><section className="dialog-card"><div className="panel-head"><div><p className="eyebrow">{editing?"CHỈNH SỬA LỚP":"THÊM LỚP HỌC"}</p><h2>{editing?editing.name:"Lớp học mới"}</h2></div><button onClick={reset}>Đóng</button></div><form className="live-form" onSubmit={save}><label>Mã lớp<input required placeholder="Ví dụ: 10A1" value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></label><label>Tên lớp<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Khối<select required value={form.gradeId} onChange={e=>setForm({...form,gradeId:Number(e.target.value)})}>{grades.map(grade=><option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></label><label>Trạng thái<select required value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{metadataOptions(metadata,"classStatuses").map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label><div className="live-actions"><button type="button" onClick={reset}>Hủy</button><button className="primary">{editing?"Lưu thay đổi":"Tạo lớp"}</button></div></form></section></div>}</section>
}

function TeacherRoster({session,classes}:{session:AuthSession;classes:Classroom[]}){
 const queryClient=useQueryClient();
 const [classId,setClassId]=useState(classes[0].id),[studentId,setStudentId]=useState(0),[search,setSearch]=useState("");
 const [progress,setProgress]=useState<{name:string;items:Progress[]}|null>(null);
 const rosterQuery=useQuery({queryKey:["teacher-roster",session.accessToken,classId,search],queryFn:async()=>{const [enrolled,candidates]=await Promise.all([getEnrollments(session,"class-students",classId),getAvailableStudents(session,search)]);return {students:enrolled,available:candidates}}});
 const students=rosterQuery.data?.students??[],available=rosterQuery.data?.available??[];
 const invalidate=()=>queryClient.invalidateQueries({queryKey:["teacher-roster"]});
 const addMutation=useMutation({mutationFn:(id:number)=>addEnrollment(session,"class-students",{classId,userId:id}),onSuccess:invalidate});
 const removeMutation=useMutation({mutationFn:(id:number)=>removeEnrollment(session,"class-students",id),onSuccess:invalidate});
 return <section className="audit-panel"><div className="panel-head"><h2>Học sinh trong lớp</h2><select value={classId} onChange={e=>setClassId(Number(e.target.value))}>{classes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div><div className="filter-bar roster-add"><input placeholder="Tìm học sinh" value={search} onChange={e=>setSearch(e.target.value)}/><select value={studentId} onChange={e=>setStudentId(Number(e.target.value))}><option value={0}>Chọn học sinh…</option>{available.map(x=><option key={x.id} value={x.id}>{x.fullName} (@{x.username})</option>)}</select><button onClick={()=>{if(studentId)addMutation.mutate(studentId)}}>Thêm vào lớp</button></div>{students.map(x=><div className="live-row" key={x.id}><b>{x.label}</b><div className="row-actions"><button onClick={async()=>{if(x.userId)setProgress({name:x.label,items:await getStudentProgress(session,x.userId)})}}>Tiến độ</button><button onClick={async()=>{if(!x.userId)return;const password=prompt(`Mật khẩu mới cho ${x.label}`);if(password)await resetUserPassword(session,x.userId,password)}}>Reset mật khẩu</button><button onClick={()=>removeMutation.mutate(x.id)}>Gỡ khỏi lớp</button></div></div>)}{progress&&<div className="student-grade-detail"><div className="panel-head"><h3>Tiến độ bài học · {progress.name}</h3><button onClick={()=>setProgress(null)}>Đóng</button></div>{progress.items.map(x=><div className="live-row" key={x.id}><b>Bài học #{x.lessonId}</b><span>{x.completedAt?"Đã hoàn thành":x.openedAt?"Đang học":"Chưa mở"} · {x.completionPercent}%</span></div>)}{!progress.items.length&&<EmptyState text="Học sinh chưa có tiến độ bài học."/>}</div>}</section>
}

function MathWorkspace({session}:{session:AuthSession}){
 const metadata=useMetadata(session);
 const queryClient=useQueryClient();
 const [selectedTopic,setSelectedTopic]=useState<Topic|null>(null),[selectedType,setSelectedType]=useState<ProblemType|null>(null),[selectedProblem,setSelectedProblem]=useState<Problem|null>(null);
 const [typeDraft,setTypeDraft]=useState({name:"",recognitionSigns:"",generalMethod:"",solutionOutline:"",commonMistakes:""}),[typeEdit,setTypeEdit]=useState<number|null>(null),[statement,setStatement]=useState("");
 const [difficulty,setDifficulty]=useState(""),[examPart,setExamPart]=useState("");
 const [problemKind,setProblemKind]=useState(""),[similarIds,setSimilarIds]=useState({easier:"",equivalent:"",harder:""});
 const [hintText,setHintText]=useState(""),[solution,setSolution]=useState({title:"",contentLatex:""}),[chosen,setChosen]=useState<number[]>([]);
 const [preview,setPreview]=useState<Worksheet|null>(null);
 const [difficultyFilter,setDifficultyFilter]=useState(""),[statusFilter,setStatusFilter]=useState(""),[problemSearch,setProblemSearch]=useState(""),[sheetOpen,setSheetOpen]=useState(false);
 const [bankTab,setBankTab]=useState<"topics"|"types"|"problems">("topics");
 const [sheetDraft,setSheetDraft]=useState({name:"Phiếu bài tập Toán 10",columnsCount:1,showQr:true,showStudentFields:true});
 const topicsQuery=useQuery({queryKey:["math-topics",session.accessToken],queryFn:()=>getTopics(session)});
 const worksheetsQuery=useQuery({queryKey:["math-worksheets",session.accessToken],queryFn:()=>getWorksheets(session)});
 const typesQuery=useQuery({queryKey:["math-types",session.accessToken,selectedTopic?.id],queryFn:()=>getProblemTypes(session,selectedTopic!.id),enabled:!!selectedTopic,placeholderData:previous=>previous});
 const problemsQuery=useQuery({queryKey:["math-problems",session.accessToken,selectedType?.id],queryFn:()=>getProblems(session,selectedType!.id),enabled:!!selectedType,placeholderData:previous=>previous});
 const hintsSolutionsQuery=useQuery({queryKey:["math-hints-solutions",session.accessToken,selectedProblem?.id],queryFn:async()=>{const [a,b]=await Promise.all([getHints(session,selectedProblem!.id),getSolutions(session,selectedProblem!.id)]);return {hints:a,solutions:b}},enabled:!!selectedProblem&&selectedProblem.problemKind!=="EXAM"});
 const topics=topicsQuery.data??[],worksheets=worksheetsQuery.data??[],types=typesQuery.data??[],problems=problemsQuery.data??[];
 const hints=hintsSolutionsQuery.data?.hints??[],solutions=hintsSolutionsQuery.data?.solutions??[];
 const invalidateTypes=()=>queryClient.invalidateQueries({queryKey:["math-types"]});
 const invalidateProblems=()=>queryClient.invalidateQueries({queryKey:["math-problems"]});
 const invalidateHintsSolutions=()=>queryClient.invalidateQueries({queryKey:["math-hints-solutions"]});
 const invalidateWorksheets=()=>queryClient.invalidateQueries({queryKey:["math-worksheets"]});
 const saveTypeMutation=useMutation({mutationFn:(input:{topicId:number;editId:number|null;draft:typeof typeDraft})=>saveProblemType(session,{topicId:input.topicId,...input.draft},input.editId||undefined),onSuccess:invalidateTypes});
 const deleteTypeMutation=useMutation({mutationFn:(id:number)=>deleteProblemType(session,id),onSuccess:invalidateTypes});
 const saveProblemMutation=useMutation({mutationFn:(input:{payload:Parameters<typeof saveProblem>[1];id?:number})=>saveProblem(session,input.payload,input.id),onSuccess:invalidateProblems});
 const addHintMutation=useMutation({mutationFn:(input:Parameters<typeof saveHint>[1])=>saveHint(session,input),onSuccess:invalidateHintsSolutions});
 const reorderHintsMutation=useMutation({mutationFn:(input:{problemId:number;ids:number[]})=>reorderHints(session,input.problemId,input.ids),onSuccess:invalidateHintsSolutions});
 const deleteHintMutation=useMutation({mutationFn:(id:number)=>deleteHint(session,id),onSuccess:invalidateHintsSolutions});
 const addSolutionMutation=useMutation({mutationFn:(input:Parameters<typeof saveSolution>[1])=>saveSolution(session,input),onSuccess:invalidateHintsSolutions});
 const reorderSolutionsMutation=useMutation({mutationFn:(input:{problemId:number;ids:number[]})=>reorderSolutions(session,input.problemId,input.ids),onSuccess:invalidateHintsSolutions});
 const deleteSolutionMutation=useMutation({mutationFn:(id:number)=>deleteSolution(session,id),onSuccess:invalidateHintsSolutions});
 const createSheetMutation=useMutation({mutationFn:(input:Parameters<typeof saveWorksheet>[1])=>saveWorksheet(session,input),onSuccess:invalidateWorksheets});
 const error=topicsQuery.isError?messageOf(topicsQuery.error):worksheetsQuery.isError?messageOf(worksheetsQuery.error):typesQuery.isError?messageOf(typesQuery.error):problemsQuery.isError?messageOf(problemsQuery.error):hintsSolutionsQuery.isError?messageOf(hintsSolutionsQuery.error):saveTypeMutation.isError?messageOf(saveTypeMutation.error):deleteTypeMutation.isError?messageOf(deleteTypeMutation.error):saveProblemMutation.isError?messageOf(saveProblemMutation.error):addHintMutation.isError?messageOf(addHintMutation.error):reorderHintsMutation.isError?messageOf(reorderHintsMutation.error):deleteHintMutation.isError?messageOf(deleteHintMutation.error):addSolutionMutation.isError?messageOf(addSolutionMutation.error):reorderSolutionsMutation.isError?messageOf(reorderSolutionsMutation.error):deleteSolutionMutation.isError?messageOf(deleteSolutionMutation.error):createSheetMutation.isError?messageOf(createSheetMutation.error):"";
 useEffect(()=>{setDifficulty(current=>current||firstMetadataValue(metadata,"problemDifficulties"));setProblemKind(current=>current||firstMetadataValue(metadata,"problemKinds"));setExamPart(current=>current||firstMetadataValue(metadata,"examParts"))},[metadata]);
 const chooseTopic=(x:Topic)=>{setSelectedTopic(x);setSelectedType(null);setSelectedProblem(null)};
 const chooseType=(x:ProblemType)=>{setSelectedType(x);setSelectedProblem(null)};
 const chooseProblem=(x:Problem)=>{setSelectedProblem(x)};
 const createNewType=async(e:React.FormEvent)=>{e.preventDefault();if(!selectedTopic)return;try{await saveTypeMutation.mutateAsync({topicId:selectedTopic.id,editId:typeEdit,draft:typeDraft});setTypeDraft({name:"",recognitionSigns:"",generalMethod:"",solutionOutline:"",commonMistakes:""});setTypeEdit(null)}catch{/* lỗi đã có trong mutation state */}};
 const createNewProblem=async(e:React.FormEvent)=>{e.preventDefault();if(!selectedType||!difficulty||!problemKind)return;try{await saveProblemMutation.mutateAsync({payload:{problemTypeId:selectedType.id,statementLatex:statement,contentHtml:statement,difficulty,status:firstMetadataValue(metadata,"publishStatuses"),problemKind:problemKind as "PRACTICE"|"EXAM",examPart:examPart||null,easierProblemId:similarIds.easier?Number(similarIds.easier):null,equivalentProblemId:similarIds.equivalent?Number(similarIds.equivalent):null,harderProblemId:similarIds.harder?Number(similarIds.harder):null}});setStatement("");setExamPart(firstMetadataValue(metadata,"examParts"));setSimilarIds({easier:"",equivalent:"",harder:""})}catch{/* lỗi đã có trong mutation state */}};
 const addHint=async(e:React.FormEvent)=>{e.preventDefault();if(!selectedProblem)return;try{await addHintMutation.mutateAsync({problemId:selectedProblem.id,contentLatex:hintText,orderIndex:hints.length+1});setHintText("")}catch{/* lỗi đã có trong mutation state */}};
 const addSolution=async(e:React.FormEvent)=>{e.preventDefault();if(!selectedProblem)return;try{await addSolutionMutation.mutateAsync({problemId:selectedProblem.id,title:solution.title,contentLatex:solution.contentLatex,orderIndex:solutions.length+1});setSolution({title:"",contentLatex:""})}catch{/* lỗi đã có trong mutation state */}};
 const moveHint=async(index:number,delta:number)=>{if(!selectedProblem)return;const a=[...hints],to=index+delta;if(to<0||to>=a.length)return;[a[index],a[to]]=[a[to],a[index]];try{await reorderHintsMutation.mutateAsync({problemId:selectedProblem.id,ids:a.map(x=>x.id)})}catch{/* lỗi đã có trong mutation state */}};
 const moveSolution=async(index:number,delta:number)=>{if(!selectedProblem)return;const a=[...solutions],to=index+delta;if(to<0||to>=a.length)return;[a[index],a[to]]=[a[to],a[index]];try{await reorderSolutionsMutation.mutateAsync({problemId:selectedProblem.id,ids:a.map(x=>x.id)})}catch{/* lỗi đã có trong mutation state */}};
 const createSheet=async(e:React.FormEvent)=>{e.preventDefault();if(!chosen.length)return;try{await createSheetMutation.mutateAsync({...sheetDraft,problemIds:chosen});setChosen([]);setSheetOpen(false)}catch{/* lỗi đã có trong mutation state */}};
 const editType=(x:ProblemType)=>{setTypeEdit(x.id);setTypeDraft({name:x.name,recognitionSigns:x.recognitionSigns||"",generalMethod:x.generalMethod||"",solutionOutline:x.solutionOutline||"",commonMistakes:x.commonMistakes||""})};
 const editProblem=async(x:Problem)=>{const text=window.prompt("Đề bài LaTeX",x.statementLatex);if(!text)return;const easier=window.prompt("ID bài dễ hơn (để trống nếu không có)",x.easierProblemId?.toString()||"");if(easier===null)return;const equivalent=window.prompt("ID bài tương đương (để trống nếu không có)",x.equivalentProblemId?.toString()||"");if(equivalent===null)return;const harder=window.prompt("ID bài khó hơn (để trống nếu không có)",x.harderProblemId?.toString()||"");if(harder===null)return;try{await saveProblemMutation.mutateAsync({payload:{problemTypeId:x.problemTypeId,statementLatex:text,contentHtml:x.contentHtml||text,difficulty:x.difficulty,status:x.status,problemKind:x.problemKind,examPart:x.examPart,easierProblemId:easier?Number(easier):null,equivalentProblemId:equivalent?Number(equivalent):null,harderProblemId:harder?Number(harder):null},id:x.id})}catch{/* lỗi đã có trong mutation state */}};
 const moveChosen=(index:number,delta:number)=>{const a=[...chosen],to=index+delta;if(to<0||to>=a.length)return;[a[index],a[to]]=[a[to],a[index]];setChosen(a)};
 const filteredProblems=problems.filter(x=>(!difficultyFilter||x.difficulty===difficultyFilter)&&(!statusFilter||x.status===statusFilter)&&(!problemSearch||`${x.publicCode} ${x.statementLatex}`.toLocaleLowerCase("vi").includes(problemSearch.toLocaleLowerCase("vi"))));
 return <section id="teacher-problems" data-teacher-section data-search="Ngân hàng bài toán Problems" className={`curriculum-panel math-workspace ${selectedProblem?"has-problem-detail":""}`}><div className="panel-head math-bank-head"><div><p className="eyebrow">NGÂN HÀNG CÂU HỎI</p><h2>Quản lý câu hỏi</h2><small>{filteredProblems.length} câu đang hiển thị · {problems.filter(x=>x.status==="PUBLISHED").length} đã xuất bản</small></div><button className="primary" disabled={!selectedType} onClick={()=>document.getElementById("problem-create")?.scrollIntoView({behavior:"smooth"})}>＋ Tạo câu hỏi</button></div>{error&&<div className="api-error">{error}</div>}
 <div className="math-columns">
  <nav className="bank-tabs" role="tablist">
    <button role="tab" aria-selected={bankTab==="topics"} className={bankTab==="topics"?"active":""} onClick={()=>setBankTab("topics")}>Chủ đề <small>{topics.length}</small></button>
    <button role="tab" aria-selected={bankTab==="types"} className={bankTab==="types"?"active":""} disabled={!selectedTopic} onClick={()=>setBankTab("types")}>Dạng toán <small>{types.length}</small></button>
    <button role="tab" aria-selected={bankTab==="problems"} className={bankTab==="problems"?"active":""} disabled={!selectedType} onClick={()=>setBankTab("problems")}>Bài toán <small>{filteredProblems.length}</small></button>
  </nav>
  {bankTab==="topics"&&<div className="bank-panel"><h3>Chủ đề</h3><p className="muted-copy">Chủ đề do Admin cấu hình.</p>{topics.map(x=><div className="bank-row topic-choice" key={x.id}><button className={`stack-choice ${selectedTopic?.id===x.id?"selected":""}`} onClick={()=>{chooseTopic(x);setBankTab("types")}}>{x.name}</button></div>)}</div>}
  {bankTab==="types"&&<div className="bank-panel"><h3>Dạng toán</h3>{selectedTopic&&<form className="live-form type-form" onSubmit={createNewType}><label>Tên dạng<input required value={typeDraft.name} onChange={e=>setTypeDraft({...typeDraft,name:e.target.value})}/></label><label>Dấu hiệu nhận biết<textarea value={typeDraft.recognitionSigns} onChange={e=>setTypeDraft({...typeDraft,recognitionSigns:e.target.value})}/></label><label>Phương pháp chung<textarea value={typeDraft.generalMethod} onChange={e=>setTypeDraft({...typeDraft,generalMethod:e.target.value})}/></label><label>Các bước giải<textarea value={typeDraft.solutionOutline} onChange={e=>setTypeDraft({...typeDraft,solutionOutline:e.target.value})}/></label><label>Lỗi thường gặp<textarea value={typeDraft.commonMistakes} onChange={e=>setTypeDraft({...typeDraft,commonMistakes:e.target.value})}/></label><button className="primary">{typeEdit?"Cập nhật":"Thêm dạng"}</button></form>}{types.map(x=><div className="bank-row" key={x.id}><button className={`stack-choice ${selectedType?.id===x.id?"selected":""}`} onClick={()=>{chooseType(x);setBankTab("problems")}}>{x.name}</button><button onClick={()=>editType(x)}>Sửa</button><button onClick={()=>deleteTypeMutation.mutate(x.id)}>Xóa</button></div>)}</div>}
  {bankTab==="problems"&&<div className="bank-panel problem-bank-pane">
   <div className="problem-bank-title"><div><h3>Bài toán</h3><p>Chọn dạng toán để tạo và quản lý nội dung.</p></div>{selectedType&&<button className="primary" onClick={()=>document.getElementById("problem-create")?.scrollIntoView({behavior:"smooth"})}>＋ Tạo bài toán mới</button>}</div>
   {selectedType&&<form id="problem-create" className="live-form problem-create-form" onSubmit={createNewProblem}>
    <label>Đề bài LaTeX<textarea required value={statement} onChange={e=>setStatement(e.target.value)} placeholder={"Giải phương trình $x^2-4=0$"}/></label>
    <label>Phân loại<select required value={problemKind} onChange={e=>setProblemKind(e.target.value)}>{metadataOptions(metadata,"problemKinds").map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label>Mức độ<select required value={difficulty} onChange={e=>setDifficulty(e.target.value)}>{metadataOptions(metadata,"problemDifficulties").map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label>Phần đề thi<select value={examPart} onChange={e=>setExamPart(e.target.value)}><option value="">Chưa gắn</option>{metadataOptions(metadata,"examParts").map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    {problemKind==="PRACTICE"&&<div className="similar-id-fields"><label>ID dễ hơn<input type="number" min="1" value={similarIds.easier} onChange={e=>setSimilarIds({...similarIds,easier:e.target.value})}/></label><label>ID tương đương<input type="number" min="1" value={similarIds.equivalent} onChange={e=>setSimilarIds({...similarIds,equivalent:e.target.value})}/></label><label>ID khó hơn<input type="number" min="1" value={similarIds.harder} onChange={e=>setSimilarIds({...similarIds,harder:e.target.value})}/></label></div>}
    <button className="primary">Lưu bài toán</button>
   </form>}
   <div className="problem-filter-bar"><input placeholder="Tìm theo mã câu, nội dung..." value={problemSearch} onChange={e=>setProblemSearch(e.target.value)}/><select value={difficultyFilter} onChange={e=>setDifficultyFilter(e.target.value)}><option value="">Mọi độ khó</option>{metadataOptions(metadata,"problemDifficulties").map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">Mọi trạng thái</option>{metadataOptions(metadata,"publishStatuses").map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select><span>{filteredProblems.length} câu</span></div>
   <div className="problem-table"><div className="problem-table-header"><span></span><span>Mã câu</span><span>Trích đề</span><span>Dạng bài</span><span>Độ khó</span><span>Tình trạng</span><span>Thao tác</span></div>{filteredProblems.map(x=><article id={`problem-${x.id}`} data-search={`${x.publicCode} ${x.statementLatex}`} className={`problem-table-row ${selectedProblem?.id===x.id?"selected":""}`} key={x.id}><label><input type="checkbox" checked={chosen.includes(x.id)} disabled={x.problemKind!=="PRACTICE"} onChange={()=>setChosen(chosen.includes(x.id)?chosen.filter(id=>id!==x.id):[...chosen,x.id])}/></label><code>{x.publicCode}</code><button className="problem-excerpt" onClick={()=>chooseProblem(x)}><b>{x.statementLatex}</b><small>{x.contentHtml?.replace(/<[^>]+>/g,"").slice(0,90)||"Chưa có mô tả bổ sung"}</small></button><span>{selectedType?.name||"—"}</span><span><i className="difficulty-badge">{x.difficulty}</i></span><span><i className={`status-badge ${x.status.toLowerCase()}`}>{x.status}</i></span><div><button onClick={()=>void editProblem(x)}>Sửa</button><button onClick={()=>saveProblemMutation.mutate({payload:{problemTypeId:x.problemTypeId,statementLatex:x.statementLatex,contentHtml:x.contentHtml,difficulty:x.difficulty,status:x.status==="PUBLISHED"?"DRAFT":"PUBLISHED",problemKind:x.problemKind,examPart:x.examPart,easierProblemId:x.easierProblemId,equivalentProblemId:x.equivalentProblemId,harderProblemId:x.harderProblemId},id:x.id})}>{x.status==="PUBLISHED"?"Ẩn":"Xuất bản"}</button></div></article>)}</div>
   {selectedType&&!filteredProblems.length&&<EmptyState text="Không có bài toán phù hợp bộ lọc."/>}
  </div>}
 </div>
 {selectedProblem?.problemKind==="PRACTICE"&&<aside className="problem-detail-drawer"><header><div><small>CHI TIẾT CÂU HỎI</small><h3>{selectedProblem.publicCode}</h3></div><button onClick={()=>setSelectedProblem(null)}>×</button></header><section><small>NỘI DUNG</small><div className="problem-detail-math" dangerouslySetInnerHTML={{__html:katex.renderToString(selectedProblem.statementLatex.replace(/^\$|\$$/g,""),{throwOnError:false,displayMode:true})}}/></section><section><small>LỜI GIẢI & GỢI Ý</small><article><h3>Gợi ý</h3><form className="compact-form" onSubmit={addHint}><input required value={hintText} onChange={e=>setHintText(e.target.value)} placeholder="Nội dung LaTeX"/><button>Thêm</button></form>{hints.map((x,i)=><div className="ordered-row" key={x.id}><p>{x.orderIndex}. {x.contentLatex}</p><button onClick={()=>void moveHint(i,-1)}>↑</button><button onClick={()=>void moveHint(i,1)}>↓</button><button onClick={()=>deleteHintMutation.mutate(x.id)}>Xóa</button></div>)}</article><article><h3>Các bước lời giải</h3><form className="compact-form" onSubmit={addSolution}><input required value={solution.title} onChange={e=>setSolution({...solution,title:e.target.value})} placeholder="Tiêu đề bước"/><input required value={solution.contentLatex} onChange={e=>setSolution({...solution,contentLatex:e.target.value})} placeholder="Nội dung LaTeX"/><button>Thêm</button></form>{solutions.map((x,i)=><div className="ordered-row" key={x.id}><p><b>{x.orderIndex}. {x.title}</b><br/>{x.contentLatex}</p><button onClick={()=>void moveSolution(i,-1)}>↑</button><button onClick={()=>void moveSolution(i,1)}>↓</button><button onClick={()=>deleteSolutionMutation.mutate(x.id)}>Xóa</button></div>)}</article>{!hints.length&&!solutions.length&&<div className="missing-solution"><AlertTriangle size={28}/><b>Câu hỏi này chưa có lời giải chi tiết.</b></div>}</section></aside>}
 {chosen.length>0&&<div className="problem-selection-bar"><span>Đã chọn <b>{chosen.length}</b> câu</span><button className="primary" onClick={()=>setSheetOpen(true)}>Thêm vào phiếu</button><button onClick={()=>setChosen([])}>Bỏ chọn</button></div>}
 <div className="worksheet-list"><h3>Phiếu vừa tạo</h3>{worksheets.map(x=><button key={x.id} onClick={()=>setPreview(x)}><b>{x.name}</b><span>{x.items.length} câu · {x.columnsCount} cột · Xem/In A4</span></button>)}</div>
 {preview&&<WorksheetPreview sheet={preview} onClose={()=>setPreview(null)}/>}
 {sheetOpen&&<div className="dialog-backdrop"><section className="dialog-card"><div className="panel-head"><h2>Cấu hình phiếu</h2><button onClick={()=>setSheetOpen(false)}>Đóng</button></div><form className="live-form" onSubmit={createSheet}><label>Tên phiếu<input required value={sheetDraft.name} onChange={e=>setSheetDraft({...sheetDraft,name:e.target.value})}/></label><label>Số cột<select value={sheetDraft.columnsCount} onChange={e=>setSheetDraft({...sheetDraft,columnsCount:Number(e.target.value)})}><option value={1}>1 cột</option><option value={2}>2 cột</option></select></label><label className="check-label"><input type="checkbox" checked={sheetDraft.showQr} onChange={e=>setSheetDraft({...sheetDraft,showQr:e.target.checked})}/> Hiện QR từng câu</label><label className="check-label"><input type="checkbox" checked={sheetDraft.showStudentFields} onChange={e=>setSheetDraft({...sheetDraft,showStudentFields:e.target.checked})}/> Hiện ô Họ tên/Lớp</label><div className="chosen-order"><b>Thứ tự câu hỏi</b>{chosen.map((id,i)=>{const p=problems.find(x=>x.id===id);return <div key={id}><span>{i+1}. {p?.publicCode||`Bài #${id}`}</span><button type="button" onClick={()=>moveChosen(i,-1)}>↑</button><button type="button" onClick={()=>moveChosen(i,1)}>↓</button></div>})}</div><button className="primary">Tạo phiếu từ {chosen.length} câu</button></form></section></div>}
 </section>
}

function AssignmentManager({session,classes}:{session:AuthSession;classes:Classroom[]}){
 const queryClient=useQueryClient();
 const [classId,setClassId]=useState(classes[0].id);
 const [form,setForm]=useState({title:"",worksheetId:0,dueAt:"",status:"PUBLISHED"});
 const dataQuery=useQuery({queryKey:["assignment-manager",session.accessToken,classId],queryFn:async()=>{const [w,a]=await Promise.all([getWorksheets(session),getAssignments(session,classId)]);return {worksheets:w,rows:a}}});
 const worksheets=dataQuery.data?.worksheets??[],rows=dataQuery.data?.rows??[];
 const saveMutation=useMutation({mutationFn:(input:Parameters<typeof saveAssignment>[1])=>saveAssignment(session,input),onSuccess:()=>queryClient.invalidateQueries({queryKey:["assignment-manager"]})});
 const error=dataQuery.isError?messageOf(dataQuery.error):saveMutation.isError?messageOf(saveMutation.error):"";
 const save=async(e:React.FormEvent)=>{e.preventDefault();try{await saveMutation.mutateAsync({classId,lessonId:null,worksheetId:form.worksheetId,title:form.title,dueAt:form.dueAt||null,status:form.status});setForm({title:"",worksheetId:0,dueAt:"",status:"PUBLISHED"})}catch{/* lỗi đã có trong mutation state */}};
 return <section className="audit-panel"><h2>Giao phiếu bài tập</h2>{error&&<div className="api-error">{error}</div>}<form className="compact-form assignment-form" onSubmit={save}><select value={classId} onChange={e=>setClassId(Number(e.target.value))}>{classes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><input required placeholder="Tên bài giao" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><select required value={form.worksheetId} onChange={e=>setForm({...form,worksheetId:Number(e.target.value)})}><option value={0}>Chọn phiếu…</option>{worksheets.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><input type="datetime-local" value={form.dueAt} onChange={e=>setForm({...form,dueAt:e.target.value})}/><button className="primary">Giao bài</button></form>{rows.map(x=><div className="live-row" key={x.id}><div><b>{x.title}</b><small>{x.status} · {x.dueAt?new Date(x.dueAt).toLocaleString("vi-VN"):"Không hạn"}</small></div><span>Phiếu #{x.worksheetId}</span></div>)}</section>
}

function WorksheetPreview({sheet,onClose}:{sheet:Worksheet;onClose:()=>void}){
 const ref=useRef<HTMLDivElement>(null),[codes,setCodes]=useState<Record<number,string>>({});
 useEffect(()=>{void Promise.all(sheet.items.map(async x=>[x.id,await QRCode.toDataURL(`${location.origin}/q/${x.qrSlug}`,{width:120,margin:1})] as const)).then(rows=>setCodes(Object.fromEntries(rows)))},[sheet]);
 const print=useReactToPrint({contentRef:ref,documentTitle:sheet.name});
 return <div className="dialog-backdrop"><section className="worksheet-dialog"><div className="panel-head no-print"><h2>Xem trước phiếu</h2><div><button onClick={onClose}>Đóng</button><button className="primary" onClick={()=>print()}>In / Xuất PDF</button></div></div><div ref={ref} className={`worksheet-page columns-${sheet.columnsCount}`}><header><h1>{sheet.name}</h1>{sheet.showStudentFields&&<p>Họ và tên: .................................................... &nbsp; Lớp: ....................</p>}</header><div className="worksheet-problems">{sheet.items.map((x,i)=><article key={x.id}><div><b>Câu {i+1}. <small>{x.publicCode}</small></b><span dangerouslySetInnerHTML={{__html:katex.renderToString(x.statementLatex.replace(/^\$|\$$/g,""),{throwOnError:false,displayMode:true})}}/></div>{sheet.showQr&&codes[x.id]&&<img src={codes[x.id]} alt={`QR câu ${i+1}`}/>}</article>)}</div></div></section></div>;
}

const chapterDraft = (courseId: number, orderIndex: number, status = ""): ChapterInput => ({ courseId, title: "", orderIndex, status });
const lessonDraft = (chapterId: number, orderIndex: number, status = ""): LessonInput => ({ chapterId, title: "", publicCode: "", summary: "", contentHtml: "", orderIndex, status });

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
        <h3>Chương ({chapters.length})</h3>
        <form className="compact-form" onSubmit={saveChapter}><input required placeholder="Tên chương" value={chapterForm.title} onChange={e => setChapterForm({...chapterForm,title:e.target.value})}/><input required min="1" type="number" value={chapterForm.orderIndex} onChange={e => setChapterForm({...chapterForm,orderIndex:Number(e.target.value)})}/><select required value={chapterForm.status} onChange={e=>setChapterForm({...chapterForm,status:e.target.value})}>{metadataOptions(metadata,"publishStatuses").filter(option=>option.value!=="ARCHIVED").map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select><button className="primary">{chapterEdit?"Cập nhật":"Thêm"}</button></form>
        {chapters.map((chapter,index)=><div className={`content-item content-actions ${selectedChapter?.id===chapter.id?"selected":""}`} key={chapter.id}><button className="content-main" onClick={()=>chooseChapter(chapter)}><span>{chapter.orderIndex}</span><div><b>{chapter.title}</b><small>{chapter.status}</small></div></button><button onClick={()=>void moveChapter(index,-1)}>↑</button><button onClick={()=>void moveChapter(index,1)}>↓</button><button onClick={()=>{setChapterEdit(chapter.id);setChapterForm({courseId:chapter.courseId,title:chapter.title,orderIndex:chapter.orderIndex,status:chapter.status})}}>Sửa</button><button className="danger-link" onClick={()=>void removeChapter(chapter)}>Xóa</button></div>)}
      </div>
      <div>
        <h3>{selectedChapter?`Bài học · ${selectedChapter.title}`:"Chọn một chương"}</h3>
        {selectedChapter&&<><form className="compact-form lesson-form" onSubmit={saveLesson}><input required placeholder="Tên bài học" value={lessonForm.title} onChange={e=>setLessonForm({...lessonForm,title:e.target.value})}/><input placeholder="Public code" value={lessonForm.publicCode} onChange={e=>setLessonForm({...lessonForm,publicCode:e.target.value})}/><input required min="1" type="number" value={lessonForm.orderIndex} onChange={e=>setLessonForm({...lessonForm,orderIndex:Number(e.target.value)})}/><select required value={lessonForm.status} onChange={e=>setLessonForm({...lessonForm,status:e.target.value})}>{metadataOptions(metadata,"publishStatuses").filter(option=>option.value!=="ARCHIVED").map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select><textarea className="lesson-content-editor" placeholder="Nội dung HTML/Markdown kết hợp LaTeX…" value={lessonForm.contentHtml} onChange={e=>setLessonForm({...lessonForm,contentHtml:e.target.value,summary:e.target.value.replace(/<[^>]+>/g,"").slice(0,500)})}/><button className="primary">{lessonEdit?"Cập nhật":"Thêm"}</button>{lessonEdit&&<small className="autosave-status">{autoSaveState}</small>}</form>{lessons.map((lesson,index)=><div className="content-item lesson-actions" key={lesson.id}><div className="content-main"><span>{lesson.orderIndex}</span><div><b>{lesson.title}</b><small>{lesson.status} {lesson.publicCode&&`· ${lesson.publicCode}`}</small></div></div><button onClick={()=>setDocumentLesson(lesson)}>Tài liệu</button><button onClick={()=>setResourceLesson(lesson)}>Khối nội dung</button><button onClick={()=>setWorksheetLesson(lesson)}>Gắn phiếu</button><button onClick={()=>void moveLesson(index,-1)}>↑</button><button onClick={()=>void moveLesson(index,1)}>↓</button><button onClick={()=>{setLessonEdit(lesson.id);setLessonForm({chapterId:lesson.chapterId,title:lesson.title,publicCode:lesson.publicCode||"",summary:lesson.summary||"",contentHtml:lesson.contentHtml||"",orderIndex:lesson.orderIndex,status:lesson.status})}}>Sửa</button><button className="danger-link" onClick={()=>void removeLesson(lesson)}>Xóa</button></div>)}</>}
      </div>
    </div>
    {resourceLesson&&<ResourceManager session={session} lesson={resourceLesson} onClose={()=>setResourceLesson(null)}/>}
    {documentLesson&&<LessonDocumentManager session={session} lesson={documentLesson} onClose={()=>setDocumentLesson(null)}/>}
    {worksheetLesson&&<LessonWorksheetManager session={session} lesson={worksheetLesson} onClose={()=>setWorksheetLesson(null)}/>}
  </section>;
}

function LessonDocumentManager({session,lesson,onClose}:{session:AuthSession;lesson:Lesson;onClose:()=>void}) {
 const metadata=useMetadata(session);
 const queryClient=useQueryClient();
 const [documentId,setDocumentId]=useState(0),[teacherNote,setTeacherNote]=useState(""),[startPage,setStartPage]=useState(""),[required,setRequired]=useState(true),[editing,setEditing]=useState<LessonDocument|null>(null);
 const [quizDoc,setQuizDoc]=useState<LessonDocument|null>(null);
 const [questionDraft,setQuestionDraft]=useState({questionText:"",optionA:"",optionB:"",optionC:"",optionD:"",correctOption:"A",explanation:""});
 const dataQuery=useQuery({queryKey:["lesson-documents",session.accessToken,lesson.id],queryFn:async()=>{const [docs,attached]=await Promise.all([getDocuments(session),getLessonDocuments(session,lesson.id)]);return {library:docs,rows:attached}}});
 const library=dataQuery.data?.library??[],rows=dataQuery.data?.rows??[];
 const questionsQuery=useQuery({queryKey:["lesson-document-questions",session.accessToken,lesson.id,quizDoc?.id],queryFn:()=>getLessonDocumentQuestions(session,lesson.id,quizDoc!.id),enabled:!!quizDoc});
 const questions=questionsQuery.data??[];
 const invalidateDocs=()=>queryClient.invalidateQueries({queryKey:["lesson-documents"]});
 const invalidateQuestions=()=>queryClient.invalidateQueries({queryKey:["lesson-document-questions"]});
 const submitMutation=useMutation({mutationFn:(input:{editingId:number|null;documentId:number;payload:{required:boolean;teacherNote:string;startPage:number|null}})=>input.editingId?updateLessonDocument(session,lesson.id,input.editingId,input.payload):attachLessonDocument(session,lesson.id,{documentId:input.documentId,...input.payload}),onSuccess:invalidateDocs});
 const moveMutation=useMutation({mutationFn:(input:{id:number;direction:"UP"|"DOWN"})=>moveLessonDocument(session,lesson.id,input.id,input.direction),onSuccess:invalidateDocs});
 const removeMutation=useMutation({mutationFn:(id:number)=>deleteLessonDocument(session,lesson.id,id),onSuccess:invalidateDocs});
 const saveQuestionMutation=useMutation({mutationFn:(input:{documentId:number;draft:typeof questionDraft})=>addLessonDocumentQuestion(session,lesson.id,input.documentId,input.draft),onSuccess:invalidateQuestions});
 const removeQuestionMutation=useMutation({mutationFn:(input:{documentId:number;questionId:number})=>deleteLessonDocumentQuestion(session,lesson.id,input.documentId,input.questionId),onSuccess:invalidateQuestions});
 const error=dataQuery.isError?messageOf(dataQuery.error):questionsQuery.isError?messageOf(questionsQuery.error):submitMutation.isError?messageOf(submitMutation.error):moveMutation.isError?messageOf(moveMutation.error):removeMutation.isError?messageOf(removeMutation.error):saveQuestionMutation.isError?messageOf(saveQuestionMutation.error):removeQuestionMutation.isError?messageOf(removeQuestionMutation.error):"";
 useEffect(()=>{if(library[0])setDocumentId(current=>current||library[0].id)},[library]);
 const reset=()=>{setEditing(null);setTeacherNote("");setStartPage("");setRequired(true)};
 const startEdit=(row:LessonDocument)=>{setEditing(row);setTeacherNote(row.teacherNote||"");setStartPage(row.startPage?String(row.startPage):"");setRequired(row.required)};
 const payload=()=>({required,teacherNote,startPage:startPage?Number(startPage):null});
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(!editing&&!documentId)return;try{await submitMutation.mutateAsync({editingId:editing?.id??null,documentId,payload:payload()});reset()}catch{/* lỗi đã có trong mutation state */}};
 const move=async(id:number,direction:"UP"|"DOWN")=>{try{await moveMutation.mutateAsync({id,direction})}catch{/* lỗi đã có trong mutation state */}};
 const remove=async(row:LessonDocument)=>{if(!confirm(`Gỡ tài liệu “${row.title}” khỏi bài học?`))return;try{await removeMutation.mutateAsync(row.id)}catch{/* lỗi đã có trong mutation state */}};
 const openQuiz=(row:LessonDocument)=>{setQuizDoc(row)};
 const saveQuestion=async(e:React.FormEvent)=>{e.preventDefault();if(!quizDoc)return;try{await saveQuestionMutation.mutateAsync({documentId:quizDoc.id,draft:questionDraft});setQuestionDraft({questionText:"",optionA:"",optionB:"",optionC:"",optionD:"",correctOption:"A",explanation:""})}catch{/* lỗi đã có trong mutation state */}};
 const removeQuestion=async(questionId:number)=>{if(!quizDoc)return;try{await removeQuestionMutation.mutateAsync({documentId:quizDoc.id,questionId})}catch{/* lỗi đã có trong mutation state */}};
 const label=(key:keyof Metadata,value:string)=>metadataOptions(metadata,key).find(option=>option.value===value)?.label||value;
 return <div className="dialog-backdrop"><section className="dialog-card resource-dialog lesson-document-manager"><div className="panel-head"><div><p className="eyebrow">TÀI LIỆU BÀI HỌC</p><h2>{lesson.title}</h2></div><button onClick={onClose}>Đóng</button></div>{error&&<div className="api-error">{error}</div>}<form className="live-form lesson-document-form" onSubmit={submit}>{!editing&&<label>Chọn từ thư viện<select required value={documentId} onChange={e=>setDocumentId(Number(e.target.value))}><option value={0}>Chọn tài liệu...</option>{library.map(item=><option key={item.id} value={item.id}>{item.title} · {label("documentTypes",item.docType)}</option>)}</select></label>}<label>Trang bắt đầu<input type="number" min="1" placeholder="Ví dụ: 6" value={startPage} onChange={e=>setStartPage(e.target.value)}/></label><label>Ghi chú của giáo viên<input placeholder="Ví dụ: Đọc trang 6-12" value={teacherNote} onChange={e=>setTeacherNote(e.target.value)}/></label><label className="check-label"><input type="checkbox" checked={required} onChange={e=>setRequired(e.target.checked)}/> Bắt buộc</label><button className="primary">{editing?"Cập nhật":"Thêm tài liệu vào bài"}</button>{editing&&<button type="button" onClick={reset}>Hủy</button>}</form><div className="lesson-document-list">{rows.map((row,index)=><article key={row.id}><div><span>{row.docType==="VIDEO"?<PlayCircle size={18}/>:<FileText size={18}/>}</span><div><b>{row.displayOrder}. {row.title}</b><small>{label("documentTypes",row.docType)} · {label("documentAudiences",row.audience)} · {row.required?"Bắt buộc":"Tham khảo"}{row.startPage?` · Trang ${row.startPage}`:""}</small>{row.teacherNote&&<p>{row.teacherNote}</p>}</div></div><div className="row-actions"><button disabled={index===0} onClick={()=>void move(row.id,"UP")}>Lên</button><button disabled={index===rows.length-1} onClick={()=>void move(row.id,"DOWN")}>Xuống</button><button onClick={()=>startEdit(row)}>Sửa</button><button onClick={()=>void openQuiz(row)}>Câu hỏi</button><button onClick={()=>void openDocumentFile(session,row.fileUrl,row.title,row.startPage)}>Xem</button><button className="danger-link" onClick={()=>void remove(row)}>Gỡ</button></div></article>)}</div>{quizDoc&&<section className="document-question-panel"><div className="panel-head"><div><p className="eyebrow">KIỂM TRA NHANH</p><h3>{quizDoc.title}</h3></div><button onClick={()=>setQuizDoc(null)}>Đóng</button></div><form className="compact-form document-question-form" onSubmit={saveQuestion}><input required placeholder="Câu hỏi" value={questionDraft.questionText} onChange={e=>setQuestionDraft({...questionDraft,questionText:e.target.value})}/><input required placeholder="A" value={questionDraft.optionA} onChange={e=>setQuestionDraft({...questionDraft,optionA:e.target.value})}/><input required placeholder="B" value={questionDraft.optionB} onChange={e=>setQuestionDraft({...questionDraft,optionB:e.target.value})}/><input required placeholder="C" value={questionDraft.optionC} onChange={e=>setQuestionDraft({...questionDraft,optionC:e.target.value})}/><input required placeholder="D" value={questionDraft.optionD} onChange={e=>setQuestionDraft({...questionDraft,optionD:e.target.value})}/><select value={questionDraft.correctOption} onChange={e=>setQuestionDraft({...questionDraft,correctOption:e.target.value})}><option value="A">Đáp án A</option><option value="B">Đáp án B</option><option value="C">Đáp án C</option><option value="D">Đáp án D</option></select><button className="primary">Thêm câu hỏi</button></form>{questions.map(question=><div className="live-row" key={question.id}><div><b>{question.displayOrder}. {question.questionText}</b><small>Đáp án đúng: {question.correctOption}</small></div><button className="danger-link" onClick={()=>void removeQuestion(question.id)}>Xóa</button></div>)}</section>}{!rows.length&&<EmptyState text="Bài học này chưa có tài liệu."/>}</section></div>
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
 const metadata=useMetadata(session);
 const queryClient=useQueryClient();
 const [title,setTitle]=useState(""),[url,setUrl]=useState(""),[type,setType]=useState(""),[file,setFile]=useState<File|null>(null),[editing,setEditing]=useState<LessonResource|null>(null);
 const rowsQuery=useQuery({queryKey:["lesson-resources",session.accessToken,lesson.id],queryFn:()=>getResources(session,lesson.id)});
 const rows=rowsQuery.data??[];
 const invalidate=()=>queryClient.invalidateQueries({queryKey:["lesson-resources"]});
 const saveMutation=useMutation({mutationFn:async(input:{title:string;type:string;url:string;file:File|null;editing:LessonResource|null;orderIndex:number})=>{let fileAssetId:null|number=input.editing?.fileAssetId||null;if(input.file)fileAssetId=(await uploadFile(session,input.file)).id;return saveResource(session,{lessonId:lesson.id,type:input.type,title:input.title,externalUrl:input.type==="VIDEO"?input.url:"",fileAssetId,textContent:input.type==="TEXT"?input.url:"",orderIndex:input.orderIndex},input.editing?.id)},onSuccess:invalidate});
 const reorderMutation=useMutation({mutationFn:(ids:number[])=>reorderResources(session,ids),onSuccess:invalidate});
 const deleteMutation=useMutation({mutationFn:(id:number)=>deleteResource(session,id),onSuccess:invalidate});
 const error=rowsQuery.isError?messageOf(rowsQuery.error):saveMutation.isError?messageOf(saveMutation.error):reorderMutation.isError?messageOf(reorderMutation.error):deleteMutation.isError?messageOf(deleteMutation.error):"";
 useEffect(()=>{setType(current=>current||firstMetadataValue(metadata,"resourceTypes"))},[metadata]);
 const save=async(e:React.FormEvent)=>{e.preventDefault();try{await saveMutation.mutateAsync({title,type,url,file,editing,orderIndex:editing?.orderIndex||rows.length+1});setTitle("");setUrl("");setFile(null);setEditing(null)}catch{/* lỗi đã có trong mutation state */}};
 const edit=(x:LessonResource)=>{setEditing(x);setTitle(x.title);setType(x.type);setUrl(x.type==="TEXT"?x.textContent:x.externalUrl||"");setFile(null)};
 const move=async(index:number,delta:number)=>{const a=[...rows],to=index+delta;if(to<0||to>=a.length)return;[a[index],a[to]]=[a[to],a[index]];try{await reorderMutation.mutateAsync(a.map(x=>x.id))}catch{/* lỗi đã có trong mutation state */}};
 return <div className="dialog-backdrop"><section className="dialog-card resource-dialog"><div className="panel-head"><h2>Tài liệu · {lesson.title}</h2><button onClick={onClose}>Đóng</button></div>{error&&<div className="api-error">{error}</div>}<form className="live-form" onSubmit={save}><label>Loại<select required value={type} onChange={e=>setType(e.target.value)}>{metadataOptions(metadata,"resourceTypes").map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>Tên tài liệu<input required value={title} onChange={e=>setTitle(e.target.value)}/></label>{type==="VIDEO"?<label>YouTube/Drive URL<input type="url" required value={url} onChange={e=>setUrl(e.target.value)}/></label>:type!=="TEXT"?<label>File PDF/Image<input type="file" accept=".pdf,image/png,image/jpeg,image/webp" required={!editing?.fileAssetId} onChange={e=>setFile(e.target.files?.[0]||null)}/></label>:<label>Nội dung<input value={url} onChange={e=>setUrl(e.target.value)}/></label>}<button className="primary">{editing?"Cập nhật":"Thêm tài liệu"}</button></form>{rows.map((x,i)=><div className="live-row" key={x.id}><div><b>{x.title}</b><small>{x.type} · {x.externalUrl||`File #${x.fileAssetId}`}</small></div><div className="row-actions"><button onClick={()=>void move(i,-1)}>↑</button><button onClick={()=>void move(i,1)}>↓</button><button onClick={()=>edit(x)}>Sửa</button><button onClick={()=>deleteMutation.mutate(x.id)}>Xóa</button></div></div>)}</section></div>
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

function CurriculumWorkspace({session,metadata}:{session:AuthSession;metadata:Metadata|null}){
 const queryClient=useQueryClient();
 const coursesQuery=useQuery({queryKey:["curriculum-courses",session.accessToken],queryFn:()=>getCourses(session)});
 const courses=coursesQuery.data??[];
 const [selectedCourseId,setSelectedCourseId]=useState<number|null>(null);
 const [selectedChapterId,setSelectedChapterId]=useState<number|null>(null);
 const [selectedLessonId,setSelectedLessonId]=useState<number|null>(null);
 const [expandedChapters,setExpandedChapters]=useState<Set<number>>(new Set());
 const [treeSearch,setTreeSearch]=useState("");
 const [detailTab,setDetailTab]=useState<"overview"|"questions"|"documents"|"results">("overview");
 const [showNewCourseForm,setShowNewCourseForm]=useState(false);
 const [showNewChapterForm,setShowNewChapterForm]=useState(false);
 const [showNewLessonForm,setShowNewLessonForm]=useState(false);
 const [editingCourse,setEditingCourse]=useState<Course|null>(null);
 const [editingChapter,setEditingChapter]=useState<Chapter|null>(null);
 const [editingLesson,setEditingLesson]=useState<Lesson|null>(null);
 const [courseDraft,setCourseDraft]=useState<CourseInput>({code:"",name:"",description:"",status:"ACTIVE"});
 const [chapterDraft,setChapterDraft]=useState<ChapterInput>({courseId:0,title:"",orderIndex:1,status:"DRAFT"});
 const [lessonDraft,setLessonDraft]=useState<LessonInput>({chapterId:0,title:"",publicCode:"",summary:"",contentHtml:"",orderIndex:1,status:"DRAFT"});

 // Auto-select first course / chapter / lesson
 useEffect(()=>{
  if(selectedCourseId===null&&courses.length>0){setSelectedCourseId(courses[0].id);setCourseDraft(emptyCourse(metadata));}
 },[courses,selectedCourseId,metadata]);
 useEffect(()=>{setSelectedChapterId(null);setSelectedLessonId(null);setExpandedChapters(new Set());},[selectedCourseId]);

 const selectedCourse=courses.find(x=>x.id===selectedCourseId)||null;

 const chaptersQuery=useQuery({queryKey:["workspace-chapters",session.accessToken,selectedCourseId],queryFn:()=>getChapters(session,selectedCourseId!),enabled:!!selectedCourseId});
 const chapters=chaptersQuery.data??[];
 useEffect(()=>{
  if(selectedChapterId===null&&chapters.length>0){setSelectedChapterId(chapters[0].id);setChapterDraft({courseId:selectedCourseId!,title:"",orderIndex:chapters.length+1,status:firstMetadataValue(metadata,"publishStatuses")||"DRAFT"});}
  if(selectedChapterId!==null&&!chapters.some(x=>x.id===selectedChapterId)){setSelectedChapterId(null);setSelectedLessonId(null);}
 },[chapters,selectedChapterId,selectedCourseId,metadata]);

 const lessonsQuery=useQuery({queryKey:["workspace-lessons",session.accessToken,selectedChapterId],queryFn:()=>getLessons(session,selectedChapterId!),enabled:!!selectedChapterId});
 const lessons=lessonsQuery.data??[];
 useEffect(()=>{
  if(selectedLessonId===null&&lessons.length>0){setSelectedLessonId(lessons[0].id);setLessonDraft({chapterId:selectedChapterId!,title:"",publicCode:"",summary:"",contentHtml:"",orderIndex:lessons.length+1,status:firstMetadataValue(metadata,"publishStatuses")||"DRAFT"});}
  if(selectedLessonId!==null&&!lessons.some(x=>x.id===selectedLessonId)){setSelectedLessonId(null);}
 },[lessons,selectedLessonId,selectedChapterId,metadata]);

 const allLessonsQuery=useQuery({queryKey:["workspace-all-lessons",session.accessToken,chapters.map(x=>x.id)],queryFn:async()=>{
  const result=await Promise.all(chapters.map(async chapter=>[chapter.id,await getLessons(session,chapter.id)] as const));
  return Object.fromEntries(result) as Record<number,Lesson[]>;
 },enabled:chapters.length>0});

 const topicsQuery=useQuery({queryKey:["workspace-topics",session.accessToken],queryFn:()=>getTopics(session)});
 const topics=topicsQuery.data??[];
 const selectedChapter=chapters.find(x=>x.id===selectedChapterId)||null;
 const selectedLesson=lessons.find(x=>x.id===selectedLessonId)||null;

 const courseStatusOptions=metadataOptions(metadata,"courseStatuses");
 const publishStatusOptions=metadataOptions(metadata,"publishStatuses");
 const statusLabel=(value:string)=>publishStatusOptions.find(option=>option.value===value)?.label||value;
 const courseStatusLabel=(value:string)=>courseStatusOptions.find(option=>option.value===value)?.label||value;

 const invalidateAll=()=>{queryClient.invalidateQueries({queryKey:["workspace-chapters"]});queryClient.invalidateQueries({queryKey:["workspace-lessons"]});queryClient.invalidateQueries({queryKey:["workspace-all-lessons"]});queryClient.invalidateQueries({queryKey:["curriculum-courses"]});};

 const saveCourse=async(e:React.FormEvent)=>{e.preventDefault();try{if(editingCourse){await updateCourse(session,editingCourse.id,courseDraft)}else{await createCourse(session,courseDraft)}setCourseDraft(emptyCourse(metadata));setEditingCourse(null);setShowNewCourseForm(false);invalidateAll();}catch{}};
 const saveChapter=async(e:React.FormEvent)=>{e.preventDefault();if(!selectedCourseId)return;try{if(editingChapter){await updateChapter(session,editingChapter.id,chapterDraft)}else{await createChapter(session,{...chapterDraft,courseId:selectedCourseId})}setChapterDraft({courseId:selectedCourseId,title:"",orderIndex:chapters.length+2,status:firstMetadataValue(metadata,"publishStatuses")||"DRAFT"});setEditingChapter(null);setShowNewChapterForm(false);invalidateAll();}catch{}};
 const saveLesson=async(e:React.FormEvent)=>{e.preventDefault();if(!selectedChapterId)return;try{if(editingLesson){await updateLesson(session,editingLesson.id,lessonDraft)}else{await createLesson(session,{...lessonDraft,chapterId:selectedChapterId})}setLessonDraft({chapterId:selectedChapterId,title:"",publicCode:"",summary:"",contentHtml:"",orderIndex:lessons.length+2,status:firstMetadataValue(metadata,"publishStatuses")||"DRAFT"});setEditingLesson(null);setShowNewLessonForm(false);invalidateAll();}catch{}};

 const removeCourse=async(course:Course)=>{const count=await getChapters(session,course.id).catch(()=>[]);if(count.length>0){alert(`Khóa học "${course.name}" còn ${count.length} chương. Xóa hết chương trước.`);return;}if(!window.confirm(`Xóa khóa học "${course.name}"?`))return;try{await deleteCourse(session,course.id);setSelectedCourseId(null);invalidateAll();}catch{}};
 const removeChapter=async(chapter:Chapter)=>{const items=await getLessons(session,chapter.id).catch(()=>[]);if(items.length>0){alert(`Chương "${chapter.title}" còn ${items.length} bài học. Xóa hết bài học trước.`);return;}if(!window.confirm(`Xóa chương "${chapter.title}"?`))return;try{await deleteChapter(session,chapter.id);setSelectedChapterId(null);invalidateAll();}catch{}};
 const removeLesson=async(lesson:Lesson)=>{if(!window.confirm(`Xóa bài học "${lesson.title}"?`))return;try{await deleteLesson(session,lesson.id);setSelectedLessonId(null);invalidateAll();}catch{}};

 const toggleChapter=(id:number)=>setExpandedChapters(prev=>{const next=new Set(prev);next.has(id)?next.delete(id):next.add(id);return next;});
 const moveChapter=async(index:number,delta:number)=>{const copy=[...chapters];const target=index+delta;if(target<0||target>=copy.length)return;[copy[index],copy[target]]=[copy[target],copy[index]];try{await reorderChapters(session,copy.map(x=>x.id));queryClient.invalidateQueries({queryKey:["workspace-chapters"]});}catch{}};
 const moveLesson=async(chapterId:number,index:number,delta:number)=>{const items=(allLessonsQuery.data?.[chapterId]??[]).slice();const target=index+delta;if(target<0||target>=items.length)return;[items[index],items[target]]=[items[target],items[index]];try{await reorderLessons(session,items.map(x=>x.id));queryClient.invalidateQueries({queryKey:["workspace-all-lessons"]});queryClient.invalidateQueries({queryKey:["workspace-lessons"]});}catch{}};

 const error=coursesQuery.isError?messageOf(coursesQuery.error):chaptersQuery.isError?messageOf(chaptersQuery.error):lessonsQuery.isError?messageOf(lessonsQuery.error):topicsQuery.isError?messageOf(topicsQuery.error):"";

 const matchesTree=(text:string)=>!treeSearch.trim()||text.toLocaleLowerCase("vi").includes(treeSearch.trim().toLocaleLowerCase("vi"));

 const breadcrumb=useMemo(()=>{
  const list:{label:string;onClick?:()=>void}[]=[];
  if(selectedCourse){list.push({label:selectedCourse.name,onClick:()=>{}});}
  if(selectedChapter){list.push({label:`Chương ${selectedChapter.orderIndex}: ${selectedChapter.title}`,onClick:()=>setSelectedLessonId(null)});}
  if(selectedLesson){list.push({label:selectedLesson.title});}
  return list;
 },[selectedCourse,selectedChapter,selectedLesson]);

 // Approximate problem count: count topics that have at least one lesson whose name matches (data-driven, not hard-coded)
 const questionCountForLesson=useMemo(()=>{
  if(!selectedLesson)return 0;
  return topics.filter(topic=>selectedLesson.title&&topic.name&&selectedLesson.title.toLocaleLowerCase("vi").includes(topic.name.toLocaleLowerCase("vi").slice(0,4))).length;
 },[topics,selectedLesson]);

 return <section className="curriculum-workspace">
  {error&&<div className="api-error">{error}</div>}
  <div className="cw-shell">
   <aside className="cw-tree">
    <header className="cw-tree-header">
     <div>
      <p className="eyebrow">CẤU TRÚC CHƯƠNG TRÌNH</p>
      <h3>{selectedCourse?.name||"Chưa có khóa học"}</h3>
      <small>{chapters.length} chương · {chapters.reduce((sum,c)=>sum+((allLessonsQuery.data?.[c.id]||[]).length),0)} bài học</small>
     </div>
     <div className="cw-tree-actions">
      <button title="Lọc" aria-label="Lọc"><Filter size={15}/></button>
      <button title="Thêm mới" aria-label="Thêm mới" onClick={()=>{setShowNewCourseForm(v=>!v);setShowNewChapterForm(false);setShowNewLessonForm(false);}}><Plus size={15}/></button>
     </div>
    </header>
    <div className="cw-tree-search"><Search size={14}/><input placeholder="Tìm trong chương trình…" value={treeSearch} onChange={e=>setTreeSearch(e.target.value)}/></div>

    {showNewCourseForm&&<form className="cw-quick-form" onSubmit={saveCourse}>
     <input required placeholder="Mã khóa học" maxLength={50} value={courseDraft.code} onChange={e=>setCourseDraft({...courseDraft,code:e.target.value})}/>
     <input required placeholder="Tên khóa học" maxLength={255} value={courseDraft.name} onChange={e=>setCourseDraft({...courseDraft,name:e.target.value})}/>
     <textarea placeholder="Mô tả" value={courseDraft.description} onChange={e=>setCourseDraft({...courseDraft,description:e.target.value})}/>
     <select value={courseDraft.status} onChange={e=>setCourseDraft({...courseDraft,status:e.target.value})}>{courseStatusOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>
     <div><button className="primary" type="submit">Lưu khóa học</button><button type="button" onClick={()=>{setShowNewCourseForm(false);setEditingCourse(null);setCourseDraft(emptyCourse(metadata));}}>Hủy</button></div>
    </form>}

    <div className="cw-tree-courses">
     {courses.map(course=><div key={course.id} className={`cw-course-chip ${selectedCourseId===course.id?"active":""}`}><button onClick={()=>{setSelectedCourseId(course.id);setShowNewCourseForm(false);}}><span><BookOpen size={13}/></span><b>{course.name}</b><small>{courseStatusLabel(course.status)}</small></button><button className="cw-chip-remove" title="Xóa" onClick={()=>void removeCourse(course)}>×</button></div>)}
     {!courses.length&&!coursesQuery.isLoading&&<p className="muted-copy">Chưa có khóa học nào.</p>}
    </div>

    {selectedCourseId&&showNewChapterForm&&<form className="cw-quick-form" onSubmit={saveChapter}>
     <input required placeholder="Tên chương" value={chapterDraft.title} onChange={e=>setChapterDraft({...chapterDraft,title:e.target.value})}/>
     <input required type="number" min="1" placeholder="Thứ tự" value={chapterDraft.orderIndex} onChange={e=>setChapterDraft({...chapterDraft,orderIndex:Number(e.target.value)})}/>
     <select value={chapterDraft.status} onChange={e=>setChapterDraft({...chapterDraft,status:e.target.value})}>{publishStatusOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>
     <div><button className="primary" type="submit">{editingChapter?"Cập nhật":"Thêm chương"}</button><button type="button" onClick={()=>{setShowNewChapterForm(false);setEditingChapter(null);}}>Hủy</button></div>
    </form>}

    <div className="cw-tree-list">
     {chapters.length===0&&!chaptersQuery.isLoading&&selectedCourseId&&<p className="muted-copy">Chưa có chương. Nhấn + để thêm.</p>}
     {chapters.filter(chapter=>matchesTree(chapter.title)).map(chapter=>{
      const isExpanded=expandedChapters.has(chapter.id)||selectedChapterId===chapter.id;
      const chapterLessons=(allLessonsQuery.data?.[chapter.id]??[]).filter(lesson=>matchesTree(lesson.title));
      return <div key={chapter.id} className={`cw-chapter ${selectedChapterId===chapter.id?"active":""}`}>
       <div className="cw-chapter-row">
        <button className="cw-chevron" onClick={()=>toggleChapter(chapter.id)} aria-label={isExpanded?"Thu gọn":"Mở rộng"}>{isExpanded?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</button>
        <button className="cw-chapter-main" onClick={()=>{setSelectedChapterId(chapter.id);setSelectedLessonId(null);}}>
         <span className="cw-icon"><LibraryBig size={13}/></span>
         <div><b>Chương {chapter.orderIndex}: {chapter.title}</b><small>{statusLabel(chapter.status)} · {chapterLessons.length} bài</small></div>
        </button>
        <div className="cw-row-actions">
         <button onClick={()=>void moveChapter(chapters.indexOf(chapter),-1)} title="Lên">↑</button>
         <button onClick={()=>void moveChapter(chapters.indexOf(chapter),1)} title="Xuống">↓</button>
         <button onClick={()=>{setEditingChapter(chapter);setChapterDraft({courseId:chapter.courseId,title:chapter.title,orderIndex:chapter.orderIndex,status:chapter.status});setShowNewChapterForm(true);}} title="Sửa">Sửa</button>
         <button className="danger-link" onClick={()=>void removeChapter(chapter)} title="Xóa">×</button>
        </div>
       </div>
       {isExpanded&&<div className="cw-lessons">
        {chapterLessons.map((lesson,index)=><div key={lesson.id} className={`cw-lesson ${selectedLessonId===lesson.id?"active":""}`}>
         <button className="cw-lesson-main" onClick={()=>{setSelectedChapterId(chapter.id);setSelectedLessonId(lesson.id);}}>
          <span className="cw-dot" aria-hidden="true"/>
          <div><b>{lesson.title}</b><small>{lesson.publicCode?`#${lesson.publicCode} · `:""}{statusLabel(lesson.status)}</small></div>
         </button>
         <div className="cw-row-actions">
          <button onClick={()=>void moveLesson(chapter.id,index,-1)} title="Lên">↑</button>
          <button onClick={()=>void moveLesson(chapter.id,index,1)} title="Xuống">↓</button>
          <button onClick={()=>{setEditingLesson(lesson);setLessonDraft({chapterId:lesson.chapterId,title:lesson.title,publicCode:lesson.publicCode||"",summary:lesson.summary||"",contentHtml:lesson.contentHtml||"",orderIndex:lesson.orderIndex,status:lesson.status});setShowNewLessonForm(true);setSelectedChapterId(chapter.id);setSelectedLessonId(lesson.id);}} title="Sửa">Sửa</button>
          <button className="danger-link" onClick={()=>void removeLesson(lesson)} title="Xóa">×</button>
         </div>
        </div>)}
        {selectedChapterId===chapter.id&&showNewLessonForm&&<form className="cw-quick-form cw-quick-form-inline" onSubmit={saveLesson}>
         <input required placeholder="Tên bài học" value={lessonDraft.title} onChange={e=>setLessonDraft({...lessonDraft,title:e.target.value})}/>
         <input placeholder="Public code" value={lessonDraft.publicCode} onChange={e=>setLessonDraft({...lessonDraft,publicCode:e.target.value})}/>
         <input required type="number" min="1" placeholder="Thứ tự" value={lessonDraft.orderIndex} onChange={e=>setLessonDraft({...lessonDraft,orderIndex:Number(e.target.value)})}/>
         <select value={lessonDraft.status} onChange={e=>setLessonDraft({...lessonDraft,status:e.target.value})}>{publishStatusOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>
         <div><button className="primary" type="submit">{editingLesson?"Cập nhật":"Thêm bài học"}</button><button type="button" onClick={()=>{setShowNewLessonForm(false);setEditingLesson(null);}}>Hủy</button></div>
        </form>}
        <button className="cw-add-row" onClick={()=>{setShowNewChapterForm(false);setShowNewCourseForm(false);setShowNewLessonForm(true);setSelectedChapterId(chapter.id);setSelectedLessonId(null);setLessonDraft({chapterId:chapter.id,title:"",publicCode:"",summary:"",contentHtml:"",orderIndex:(allLessonsQuery.data?.[chapter.id]||[]).length+1,status:firstMetadataValue(metadata,"publishStatuses")||"DRAFT"});setEditingLesson(null);}}><Plus size={13}/> Thêm bài học</button>
       </div>}
      </div>;
     })}
     {selectedCourseId&&!showNewChapterForm&&<button className="cw-add-row cw-add-chapter" onClick={()=>{setShowNewCourseForm(false);setShowNewLessonForm(false);setShowNewChapterForm(true);setEditingChapter(null);setChapterDraft({courseId:selectedCourseId,title:"",orderIndex:chapters.length+1,status:firstMetadataValue(metadata,"publishStatuses")||"DRAFT"});}}><Plus size={13}/> Thêm chương</button>}
    </div>
   </aside>

   <main className="cw-detail">
    {selectedLesson? <>
     <nav className="cw-breadcrumb" aria-label="Breadcrumb">{breadcrumb.map((item,index)=><span key={index}><button disabled={!item.onClick||index===breadcrumb.length-1} onClick={item.onClick}>{item.label}</button>{index<breadcrumb.length-1&&<span className="cw-breadcrumb-sep">›</span>}</span>)}</nav>
     <header className="cw-detail-head">
      <div>
       <small className="eyebrow">CHỦ ĐỀ HỌC</small>
       <h1>{selectedLesson.title}</h1>
       <p>Thuộc {selectedCourse?.name} · {selectedChapter?`Chương ${selectedChapter.orderIndex}: ${selectedChapter.title}`:""}</p>
      </div>
      <div className="cw-detail-actions">
       <button onClick={()=>window.dispatchEvent(new CustomEvent("math10:navigate",{detail:"teacher-worksheets"}))} className="cw-btn-outline"><ClipboardList size={15}/> Soạn phiếu</button>
       <button onClick={()=>window.dispatchEvent(new CustomEvent("math10:navigate",{detail:"teacher-tasks"}))} className="cw-btn-primary"><Plus size={15}/> Tạo nhiệm vụ</button>
       <button className="cw-icon-btn" title="Thao tác khác" aria-label="Thao tác khác"><MoreVertical size={16}/></button>
      </div>
     </header>
     <section className="cw-info-cards">
      <article><div className="cw-info-icon"><BookOpen size={18}/></div><small>TRANG SGK</small><b>{selectedLesson.publicCode?`#${selectedLesson.publicCode}`:"Chưa gắn mã"}</b></article>
      <article><div className="cw-info-icon cw-info-icon-green"><Clock3 size={18}/></div><small>THỜI LƯỢNG</small><b>—</b><small className="cw-info-sub">Cập nhật sau</small></article>
      <article><div className="cw-info-icon cw-info-icon-orange"><Database size={18}/></div><small>SỐ CÂU HỎI NH</small><b>{questionCountForLesson} chủ đề</b><small className="cw-info-sub">{topics.length} chủ đề Toán đang có</small></article>
      <article><div className="cw-info-icon cw-info-icon-blue"><BookOpenCheck size={18}/></div><small>TÀI LIỆU LIÊN KẾT</small><b>{selectedLesson.contentHtml?"Đã nội dung":"Chưa có"}</b><small className="cw-info-sub">{selectedLesson.summary?"Đã có tóm tắt":"Chưa có tóm tắt"}</small></article>
     </section>
     <article className="cw-description">
      <header><CircleAlert size={16}/><h3>Mô tả chuyên đề</h3></header>
      <div>{selectedLesson.summary||selectedLesson.contentHtml?.replace(/<[^>]+>/g,"").slice(0,400)||"Chưa có mô tả cho bài học này. Bổ sung ở khung bên trái."}</div>
     </article>
     <nav className="cw-detail-tabs" role="tablist">
      <button role="tab" aria-selected={detailTab==="overview"} className={detailTab==="overview"?"active":""} onClick={()=>setDetailTab("overview")}>Tổng quan</button>
      <button role="tab" aria-selected={detailTab==="questions"} className={detailTab==="questions"?"active":""} onClick={()=>setDetailTab("questions")}>Câu hỏi</button>
      <button role="tab" aria-selected={detailTab==="documents"} className={detailTab==="documents"?"active":""} onClick={()=>setDetailTab("documents")}>Tài liệu</button>
      <button role="tab" aria-selected={detailTab==="results"} className={detailTab==="results"?"active":""} onClick={()=>setDetailTab("results")}>Kết quả lớp</button>
     </nav>
     {detailTab==="overview"&&<section className="cw-overview">
      <ClassResultsView session={session}/>
     </section>}
     {detailTab==="questions"&&<section className="cw-questions">
      <p className="muted-copy">Các chủ đề Toán có thể gắn với bài học này. Mở tab <b>Ngân hàng câu hỏi</b> ở trên để tạo câu hỏi cho từng chủ đề.</p>
      <div className="cw-topic-grid">{topics.map(topic=><article key={topic.id}><b>{topic.name}</b><small>{topic.description||"Chưa có mô tả"}</small></article>)}</div>
     </section>}
     {detailTab==="documents"&&<section className="cw-documents">
      <p className="muted-copy">Quản lý tài liệu trong mục <b>Sách giáo khoa</b> hoặc qua nút <b>Tài liệu</b> của từng bài học trong cây chương trình.</p>
      {selectedLesson.contentHtml&&<article className="cw-lesson-preview" dangerouslySetInnerHTML={{__html:katex.renderToString(selectedLesson.contentHtml.replace(/^\$|\$$/g,""),{throwOnError:false,displayMode:false})}}/>}
     </section>}
     {detailTab==="results"&&<section className="cw-results"><ClassResultsView session={session}/></section>}
    </> : <div className="cw-empty"><h2>Chọn một bài học</h2><p>Bấm vào node trong cây chương trình bên trái để xem chi tiết, câu hỏi và kết quả các lớp.</p></div>}
   </main>
  </div>
 </section>;
}

function messageOf(reason: unknown) {
  return reason instanceof Error ? reason.message : "Đã xảy ra lỗi không xác định";
}
