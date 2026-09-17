import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BookOpen, BookOpenCheck, CalendarRange, CheckCircle, ChevronDown, ChevronRight, ClipboardList, FileText, GraduationCap, Home, KeyRound, LogOut, Settings, UserRound } from "lucide-react";
import {
  getAdminStats, getAuditLogs, getAdminClassOverview, getGrades, getEnrollments, createClass, updateClass, deleteClass,
  getUsers, getCourseInstances, getGradebook, addEnrollment, removeEnrollment,
  type AdminClassOverviewRow, type AuthSession, type Classroom, type ClassroomInput, type Metadata,
} from "../api";
import { AdminClassDetail } from "./AdminClassDetail";
import { useMetadata, metadataOptions, firstMetadataValue } from "../hooks/useMetadata";
import { messageOf } from "../lib/errors";
import { AdminPage } from "./components/AdminPageLayout";
import { AdminTable } from "./components/AdminTable";
import { AdminDrawer } from "./components/AdminDrawer";
import { AdminEmptyState } from "./components/AdminEmptyState";
import { SearchInput, FilterSelect } from "./components/AdminFilterBar";
import { Button } from "../components/ui/button";
import { UserAccountsPage } from "./UserAccountsPage";
import { TextbookManagement } from "./TextbookManagement";
import { DocumentManagement } from "./DocumentManagement";
import { AuditManagement } from "./AuditManagement";
import { AdminClassesPanel } from "./AdminClassesPanel";

export function AdminShell({session,children,onLogout,onChangePassword}:{session:AuthSession;children:(activeSection:string)=>React.ReactNode;onLogout:()=>void;onChangePassword:()=>void}) {
 const [active,setActive]=useState("overview");
 const [profileOpen,setProfileOpen]=useState(false);
 const items=[
  ["overview","Tổng quan",Home],
  ["users","Tài khoản",UserRound],
  ["programs","Chương trình",BookOpenCheck],
  ["course-instances","Khóa học",CalendarRange],
  ["classes","Lớp học",CheckCircle],
  ["textbooks","Sách giáo khoa",GraduationCap],
  ["documents","Tài liệu",FileText],
  ["audit","Nhật ký",ClipboardList],
 ] as const;
 return <div className="teacher-shell admin-shell font-sans">
  <aside className="teacher-sidebar admin-full-sidebar">
   <div className="sidebar-brand"><span className="brand-mark">M10</span><span className="sidebar-brand-copy"><b>MATH10</b><small>ADMIN</small></span></div>
   <nav aria-label="Điều hướng quản trị" className="admin-nav-body">
    <div className="admin-nav-main">
     {items.map(([id,label,Icon])=><section key={id}><button className={active===id?"active":""} aria-current={active===id?"page":undefined} title={label} onClick={()=>{setActive(id);window.scrollTo({top:0,behavior:"smooth"})}}><span><Icon size={18}/></span><b>{label}</b></button></section>)}
    </div>
    <div className="sidebar-bottom">
     <section>
      <button className={active==="settings"?"active":""} aria-current={active==="settings"?"page":undefined} title="Cài đặt" onClick={()=>{setActive("settings");window.scrollTo({top:0,behavior:"smooth"})}}>
       <span><Settings size={18}/></span><b>Cài đặt</b>
      </button>
     </section>
    </div>
   </nav>
  </aside>
  <div className="teacher-main">
   <header className="teacher-topbar">
    {active === "settings" ? (
     <div className="admin-breadcrumb flex items-center gap-2 text-sm">
      <span className="w-7 h-7 rounded-full bg-[#dff3ea] text-[#16845b] flex items-center justify-center flex-none">
       <Settings size={15}/>
      </span>
      <span className="text-[#64748b] font-medium">Cài đặt</span>
      <ChevronRight size={14} className="text-[#94a3b8]"/>
      <span className="font-semibold text-[#0f172a]">Thông tin cá nhân</span>
     </div>
    ) : (
     <div className="global-search"><b className="text-lg font-bold text-gray-800">{items.find(([id]) => id === active)?.[1] || "Quản trị hệ thống"}</b></div>
    )}
    <div className="teacher-top-actions flex items-center gap-3">
     <button className="relative w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors" title="Thông báo" aria-label="Thông báo">
      <Bell size={18}/>
      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
     </button>
     <div className="top-menu">
      <button className="profile-trigger" aria-expanded={profileOpen} aria-haspopup="menu" onClick={()=>setProfileOpen(value=>!value)}>
       <span>{(session.email[0]||"A").toUpperCase()}</span>
       <div className="flex flex-col text-left leading-tight pr-1">
        <b className="text-[13px] text-slate-800 font-semibold">{session.email}</b>
        <span className="text-[11px] text-slate-500 font-normal">Quản trị hệ thống</span>
       </div>
       <ChevronDown size={14} aria-hidden="true" className="text-slate-400"/>
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

export function AdminDashboard({session,activeSection}:{session:AuthSession;activeSection:string}) {
  const metadata=useMetadata(session);
  const statsQuery=useQuery({queryKey:["admin-stats",session.accessToken],queryFn:()=>getAdminStats(session)});
  const logsQuery=useQuery({queryKey:["admin-audit-logs",session.accessToken],queryFn:()=>getAuditLogs(session,{size:6})});
  const stats=statsQuery.data??null;
  const logs=logsQuery.data?.items??[];
  const error=statsQuery.isError?messageOf(statsQuery.error):logsQuery.isError?messageOf(logsQuery.error):"";
  return <div className="page live-dashboard admin-page-section">
      {error&&<div className="mb-4 p-3 rounded-lg bg-error-container text-on-error-container text-sm">{error}</div>}
      {activeSection==="overview"&&<>
        <AdminPage.Header eyebrow="QUẢN TRỊ HỆ THỐNG" title="Tổng quan" description="Theo dõi nhanh người dùng, lớp học, khóa học và nội dung đã xuất bản." />
        <section className="stat-grid grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">{stats&&[["Người dùng",stats.totalUsers],["Giáo viên",stats.teachers],["Học sinh",stats.students],["Lớp học",stats.classes],["Khóa học",stats.courses],["Khóa đã publish",stats.publishedCourses],["Bài toán publish",stats.publishedProblems]].map(([label,value])=><article className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-center" key={label}><small>{label}</small><b className="block mt-1 text-xl">{value}</b></article>)}</section>
        <section className="admin-overview-grid"><article className="audit-panel"><h2>Phân bổ tài khoản</h2>{stats&&<div className="admin-distribution">{[["Giáo viên",stats.teachers],["Học sinh",stats.students],["Khác",Math.max(0,stats.totalUsers-stats.teachers-stats.students)]].map(([label,value])=><div key={label}><span><b>{label}</b><small>{Number(value).toLocaleString("vi-VN")}</small></span><progress max={Math.max(stats.totalUsers,1)} value={Number(value)}/></div>)}</div>}</article><article className="audit-panel"><h2>Hoạt động gần đây</h2>{logs.slice(0,6).map(log=><div className="audit-row" key={log.id}><b>{log.action}</b><span>{log.targetType}{log.targetId?` #${log.targetId}`:""}</span><small>{new Date(log.createdAt).toLocaleString("vi-VN")}</small></div>)}{!logs.length&&<AdminEmptyState title="Chưa có hoạt động hệ thống."/>}</article></section>
      </>}
      {activeSection==="users"&&<>
        <UserAccountsPage session={session}/>
      </>}
      {activeSection==="textbooks"&&<TextbookManagement session={session}/>}
      {activeSection==="documents"&&<DocumentManagement session={session}/>}
      {activeSection==="classes"&&<AdminClassesPanel session={session}/>}
      {activeSection==="audit"&&<AuditManagement session={session}/>}
      {activeSection==="settings"&&<AdminSystemSettings session={session} metadata={metadata}/>}
  </div>;
}

export function AdminSystemSettings({session,metadata}:{session:AuthSession;metadata:Metadata|null}) {
 const groups:[keyof Metadata,string][]=[["roles","Vai trò người dùng"],["userStatuses","Trạng thái tài khoản"],["classStatuses","Trạng thái lớp học"],["courseStatuses","Trạng thái khóa học"],["publishStatuses","Trạng thái xuất bản"],["documentTypes","Loại tài liệu"],["documentAudiences","Phạm vi tài liệu"]];
 return <><AdminPage.Header eyebrow="HỆ THỐNG" title="Cài đặt hệ thống" description="Thông tin cấu hình đang được backend áp dụng cho tài khoản quản trị."/><section className="admin-settings-grid"><article className="audit-panel"><h2>Tài khoản quản trị</h2><dl className="settings-details"><div><dt>Email</dt><dd>{session.email}</dd></div><div><dt>Vai trò</dt><dd>{session.role}</dd></div><div><dt>Mã người dùng</dt><dd>{session.userId}</dd></div></dl></article>{groups.map(([key,title])=><article className="audit-panel" key={key}><h2>{title}</h2><div className="settings-options">{metadataOptions(metadata,key).map(option=><span key={option.value}><b>{option.label}</b><code>{option.value}</code></span>)}{!metadataOptions(metadata,key).length&&<small>Backend chưa khai báo dữ liệu.</small>}</div></article>)}</section></>;
}

/** Dòng tổng quan (snake_case từ SQL) đổi về hình dạng Classroom mà các panel sẵn có đang dùng. */
const asClassroom=(row:AdminClassOverviewRow):Classroom=>({id:row.id,code:row.code,name:row.name,gradeId:row.grade_id,status:row.status as Classroom["status"],teacherCount:Number(row.teacher_count),studentCount:Number(row.student_count),courseCount:Number(row.course_count),createdAt:row.created_at,description:row.description,curriculumCount:Number(row.curriculum_count),documentCount:Number(row.document_count),startDate:row.start_date});
/** Lớp do chính giáo viên lập trong 7 ngày gần đây — đây là cách Admin biết có lớp mới, khớp với dòng audit ghi lúc tạo lớp. */
const isNewTeacherClass=(row:AdminClassOverviewRow)=>row.created_by_role==="TEACHER"&&Date.now()-new Date(row.created_at).getTime()<7*86400000;

export function AdminClasses({session}:{session:AuthSession}){
 const metadata=useMetadata(session);
 const queryClient=useQueryClient();
 const [form,setForm]=useState<ClassroomInput>({code:"",name:"",gradeId:0,status:"",startDate:"",description:""}),[editing,setEditing]=useState<number|null>(null),[selected,setSelected]=useState<Classroom|null>(null);
 const [search,setSearch]=useState(""),[gradeId,setGradeId]=useState(0),[status,setStatus]=useState(""),[formOpen,setFormOpen]=useState(false);
 const [mode,setMode]=useState<"teacher"|"table">("teacher"),[detail,setDetail]=useState<Classroom|null>(null);
 const classesQuery=useQuery({queryKey:["admin-classes",session.accessToken,search,gradeId,status],queryFn:async()=>{const [overview,nextGrades]=await Promise.all([getAdminClassOverview(session,{search,gradeId:gradeId||undefined,status}),getGrades(session)]);return {overview,grades:nextGrades}}});
 const overview=classesQuery.data?.overview??[],grades=classesQuery.data?.grades??[];
 const rows=overview.map(asClassroom),teacherNames=Object.fromEntries(overview.map(row=>[row.id,row.teacher_names??""])) as Record<number,string>;
 /* Gom lớp theo giáo viên phụ trách; nhóm chưa phân công luôn đứng đầu vì đó là việc Admin cần xử lý. */
 const teacherGroups=[...overview.reduce((groups,row)=>{
  const teachers=row.teacher_names?.split(", ").map(name=>name.trim()).filter(Boolean)??[];
  for(const teacher of teachers.length?teachers:[""])groups.set(teacher,[...(groups.get(teacher)??[]),row]);
  return groups;
 },new Map<string,AdminClassOverviewRow[]>()).entries()].sort((a,b)=>a[0]?(b[0]?a[0].localeCompare(b[0],"vi"):1):-1);
 const invalidate=()=>queryClient.invalidateQueries({queryKey:["admin-classes"]});
 const createMutation=useMutation({mutationFn:(input:ClassroomInput)=>createClass(session,input),onSuccess:invalidate});
 const updateMutation=useMutation({mutationFn:({id,input}:{id:number;input:ClassroomInput})=>updateClass(session,id,input),onSuccess:invalidate});
 const deleteMutation=useMutation({mutationFn:(id:number)=>deleteClass(session,id),onSuccess:invalidate});
 useEffect(()=>{const data=classesQuery.data;if(!data)return;setSelected(current=>current?data.overview.map(asClassroom).find(x=>x.id===current.id)??null:null);if(!form.gradeId&&data.grades[0])setForm(x=>({...x,gradeId:data.grades[0].id}))},[classesQuery.data]);
 useEffect(()=>{if(!editing)setForm(x=>({...x,status:x.status||firstMetadataValue(metadata,"classStatuses")}))},[editing,metadata]);
 const error=classesQuery.isError?messageOf(classesQuery.error):createMutation.isError?messageOf(createMutation.error):updateMutation.isError?messageOf(updateMutation.error):deleteMutation.isError?messageOf(deleteMutation.error):"";
  const reset=()=>{setEditing(null);setForm({code:"",name:"",gradeId:grades[0]?.id||0,status:firstMetadataValue(metadata,"classStatuses"),startDate:"",description:""});setFormOpen(false)};
  const save=async(e:React.FormEvent)=>{e.preventDefault();try{editing?await updateMutation.mutateAsync({id:editing,input:form as ClassroomInput}):await createMutation.mutateAsync(form as ClassroomInput);reset()}catch{/* lỗi đã có trong mutation state */}};
  const edit=(row:Classroom)=>{setEditing(row.id);setForm({code:row.code,name:row.name,gradeId:row.gradeId,status:row.status,startDate:row.startDate?row.startDate.slice(0,10):"",description:row.description??""});setFormOpen(true)};
  const archive=async(row:Classroom)=>{if(!confirm(`Xóa lớp “${row.name}”? Dữ liệu lịch sử vẫn được giữ lại.`))return;try{await deleteMutation.mutateAsync(row.id);if(selected?.id===row.id)setSelected(null)}catch{/* lỗi đã có trong mutation state */}};
  const gradeName=(id:number)=>grades.find(x=>x.id===id)?.name??`Khối ${id}`,statusName=(value:string)=>metadataOptions(metadata,"classStatuses").find(x=>x.value===value)?.label??value;
  return <section className={`classroom-module ${selected?"has-detail":""}`}><div className="classroom-master"><AdminPage.Header eyebrow="QUẢN TRỊ HỆ THỐNG" title="Lớp học theo giáo viên phụ trách" description="Ai đang quản lý lớp nào, lớp đã có chương trình học và tài liệu chưa, học sinh nộp bài tới đâu."><div className="class-view-toggle"><button className={mode==="teacher"?"active":""} onClick={()=>setMode("teacher")}>Theo giáo viên</button><button className={mode==="table"?"active":""} onClick={()=>setMode("table")}>Bảng lớp</button></div><Button onClick={()=>{reset();setFormOpen(true)}}>+ Tạo lớp</Button></AdminPage.Header>{error&&<div className="mb-4 p-3 rounded-lg bg-error-container text-on-error-container text-sm flex justify-between items-center"><span>{error}</span><Button variant="outline" size="sm" onClick={()=>void classesQuery.refetch()}>Thử lại</Button></div>}<div className="classroom-card"><AdminPage.Filters><SearchInput placeholder="Tìm kiếm lớp học, giáo viên…" value={search} onChange={setSearch}/><FilterSelect value={gradeId} onChange={e=>setGradeId(Number(e.target.value))}><option value={0}>Tất cả khối</option>{grades.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</FilterSelect><FilterSelect value={status} onChange={e=>setStatus(e.target.value)}><option value="">Mọi trạng thái</option>{metadataOptions(metadata,"classStatuses").map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</FilterSelect></AdminPage.Filters>{mode==="teacher"?<div className="teacher-groups">{teacherGroups.map(([teacher,list])=><article className={`teacher-group ${teacher?"":"unassigned"}`} key={teacher||"__none"}><header><h3>{teacher||"Chưa phân công giáo viên"}</h3><small>{list.length} lớp · {list.reduce((sum,row)=>sum+Number(row.student_count),0)} học sinh</small></header>{list.map(row=><div className="teacher-class-row" key={row.id}><span className="cell-title"><b>{row.name}{isNewTeacherClass(row)&&<span className="new-class-flag">GV vừa lập</span>}</b><small>Mã {row.code} · {row.grade_name??gradeName(row.grade_id)} · {statusName(row.status)}</small></span><span className="cell-metric"><b>{row.student_count}</b>học sinh</span><span className={`cell-metric ${Number(row.curriculum_count)?"":"warn"}`}><b>{row.curriculum_count}</b>mục chương trình</span><span className={`cell-metric ${Number(row.document_count)?"":"warn"}`}><b>{row.document_count}</b>tài liệu</span><span className="cell-metric"><b>{row.required_total}/{row.optional_total}</b>bắt buộc/tự chọn</span><span className="row-actions"><Button variant="outline" size="sm" onClick={()=>setDetail(asClassroom(row))}>Chi tiết</Button><Button variant="outline" size="sm" onClick={()=>setSelected(asClassroom(row))}>Phân công</Button><Button variant="outline" size="sm" onClick={()=>edit(asClassroom(row))}>Sửa</Button></span></div>)}</article>)}{!overview.length&&<AdminEmptyState title="Không có lớp phù hợp với bộ lọc."/>}</div>:<div className="classroom-table-wrap"><AdminTable columns={[{key:"code",label:"Mã lớp",render:(r:Classroom)=><div><b>{r.code}</b><br/><small>{r.name}</small></div>},{key:"year",label:"Năm học",render:(r:Classroom)=>`${new Date(r.createdAt??Date.now()).getFullYear()}–${new Date(r.createdAt??Date.now()).getFullYear()+1}`},{key:"grade",label:"Khối",render:(r:Classroom)=>gradeName(r.gradeId)},{key:"teacher",label:"Giáo viên",render:(r:Classroom)=>teacherNames[r.id]||<Button variant="ghost" size="sm" className="text-warn hover:bg-warn/10" onClick={e=>{e.stopPropagation();setSelected(r)}}>Chưa phân công</Button>},{key:"students",label:"Học sinh",render:(r:Classroom)=>r.studentCount},{key:"courses",label:"Khóa học",render:(r:Classroom)=>r.courseCount},{key:"status",label:"Trạng thái",render:(r:Classroom)=><span className={`status-chip status-${r.status.toLowerCase()}`}>{statusName(r.status)}</span>},{key:"actions",label:"Thao tác",render:(r:Classroom)=><div className="flex gap-2"><Button variant="outline" size="sm" onClick={e=>{e.stopPropagation();setDetail(r)}}>Chi tiết</Button><Button variant="outline" size="sm" onClick={e=>{e.stopPropagation();edit(r)}}>Sửa</Button><Button variant="outline" size="sm" className="text-error border-error-container hover:bg-error-container" onClick={e=>{e.stopPropagation();void archive(r)}}>Xóa</Button></div>}]} data={rows} keyExtractor={r=>r.id} onRowClick={setDetail} selectedId={selected?.id} emptyMessage="Không có lớp phù hợp với bộ lọc."/></div>}<footer>{rows.length.toLocaleString("vi-VN")} lớp học · {teacherGroups.filter(([teacher])=>teacher).length} giáo viên phụ trách</footer></div></div>{detail&&<div className="class-detail-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setDetail(null)}}><div><AdminClassDetail session={session} classroom={detail} onClose={()=>setDetail(null)}/></div></div>}{selected&&<ClassEnrollmentPanel session={session} classroom={selected} onClose={()=>setSelected(null)}/>} <AdminDrawer open={formOpen} onClose={reset} size="lg" eyebrow={editing?"CHỈNH SỬA LỚP":"TẠO LỚP MỚI"} title={editing?form.name:"Thông tin lớp học"}><form onSubmit={save} className="flex flex-col gap-4"><label className="flex flex-col gap-1 text-sm font-medium">Mã lớp<input className="h-10 rounded-md border border-outline-variant px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary" required maxLength={30} value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></label><label className="flex flex-col gap-1 text-sm font-medium">Tên lớp<input className="h-10 rounded-md border border-outline-variant px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary" required maxLength={120} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label className="flex flex-col gap-1 text-sm font-medium">Khối<select className="h-10 rounded-md border border-outline-variant px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={form.gradeId} onChange={e=>setForm({...form,gradeId:Number(e.target.value)})}>{grades.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label className="flex flex-col gap-1 text-sm font-medium">Trạng thái<select className="h-10 rounded-md border border-outline-variant px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{metadataOptions(metadata,"classStatuses").map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label><label className="flex flex-col gap-1 text-sm font-medium">Ngày khai giảng / bắt đầu<input type="date" className="h-10 rounded-md border border-outline-variant px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={form.startDate??""} onChange={e=>setForm({...form,startDate:e.target.value})}/></label><label className="flex flex-col gap-1 text-sm font-medium">Mô tả / Ghi chú<textarea rows={3} placeholder="Mô tả, ghi chú cho lớp…" className="rounded-md border border-outline-variant p-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none text-sm" value={form.description??""} onChange={e=>setForm({...form,description:e.target.value})}/></label><div className="flex justify-end gap-3 pt-4 border-t border-outline-variant mt-4"><Button type="button" variant="outline" onClick={reset}>Hủy</Button><Button type="submit">{editing?"Lưu thay đổi":"Tạo lớp"}</Button></div></form></AdminDrawer></section>;
}

export function ClassEnrollmentPanel({session,classroom,onClose}:{session:AuthSession;classroom:Classroom;onClose:()=>void}){
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
 return <AdminDrawer open={true} onClose={onClose} size="md" eyebrow={`${classroom.code} · ${classroom.status}`} title={classroom.name}><div className="class-detail-panel pt-0" style={{position:"static",width:"100%",boxShadow:"none",border:"none"}}><nav><button className={tab==="students"?"active":""} onClick={()=>setTab("students")}>Học sinh <b>{students.length}</b></button><button className={tab==="assignments"?"active":""} onClick={()=>setTab("assignments")}>Phân công</button><button className={tab==="settings"?"active":""} onClick={()=>setTab("settings")}>Cài đặt</button></nav>{error&&<div className="mb-4 p-3 rounded-lg bg-error-container text-on-error-container text-sm">{error}</div>}{tab==="students"&&<div className="class-detail-content"><div className="detail-toolbar"><input placeholder="Tìm học sinh…" value={search} onChange={e=>setSearch(e.target.value)}/><select value={studentId} onChange={e=>setStudentId(Number(e.target.value))}><option value={0}>Chọn học sinh để thêm</option>{users.filter(x=>x.roleCode==="STUDENT"&&!students.some(s=>s.userId===x.id)).map(x=><option key={x.id} value={x.id}>{x.fullName}</option>)}</select><button className="primary-action" disabled={!studentId} onClick={()=>void add("class-students",studentId)}>Thêm học sinh</button></div><div className="detail-table"><table><thead><tr><th>STT</th><th>Họ và tên</th><th>Tiến độ</th><th>Thao tác</th></tr></thead><tbody>{visibleStudents.map((row,index)=>{const p=progress.get(row.userId??0),percent=p?Math.round(p.sum/Math.max(p.count,1)):0;return <tr key={row.id}><td className="numeric">{index+1}</td><td><b>{row.label}</b><small>{users.find(x=>x.id===row.userId)?.username??"—"}</small></td><td><div className="student-progress"><span style={{width:`${Math.min(percent,100)}%`}}/><b>{percent}%</b></div></td><td><button onClick={()=>removeMutation.mutate({type:"class-students",id:row.id})}>Gỡ</button></td></tr>})}</tbody></table>{!visibleStudents.length&&<AdminEmptyState title="Chưa có học sinh phù hợp."/>}</div></div>}{tab==="assignments"&&<div className="class-detail-content assignment-groups"><article><h3>Giáo viên phụ trách</h3><div className="detail-add"><select value={teacherId} onChange={e=>setTeacherId(Number(e.target.value))}><option value={0}>Chọn giáo viên</option>{users.filter(x=>x.roleCode==="TEACHER"&&!teachers.some(t=>t.userId===x.id)).map(x=><option key={x.id} value={x.id}>{x.fullName}</option>)}</select><button onClick={()=>void add("class-teachers",teacherId)}>Phân công</button></div>{teachers.map(x=><div className="assignment-row" key={x.id}><b>{x.label}</b><button onClick={()=>removeMutation.mutate({type:"class-teachers",id:x.id})}>Gỡ</button></div>)}</article><article><h3>Khóa học</h3><div className="detail-add"><select value={courseInstanceId} onChange={e=>setCourseInstanceId(Number(e.target.value))}><option value={0}>Chọn khóa</option>{courses.filter(x=>!assignedCourses.some(c=>c.courseInstanceId===x.id)).map(x=><option key={x.id} value={x.id}>{x.name} · {x.school_year}{x.status==="DRAFT"?" (nháp)":""}</option>)}</select><button onClick={()=>void add("class-courses",courseInstanceId)}>Gán khóa</button></div>{assignedCourses.map(x=><div className="assignment-row" key={x.id}><b>{x.label}</b><button onClick={()=>removeMutation.mutate({type:"class-courses",id:x.id})}>Gỡ</button></div>)}</article></div>}{tab==="settings"&&<div className="class-detail-content privacy-note"><h3>Quyền riêng tư</h3><p>Quản trị viên chỉ xem tiến độ tổng hợp. Câu trả lời cá nhân và ghi chú riêng của giáo viên không được hiển thị.</p><h3>Dữ liệu lớp</h3><dl><div><dt>Giáo viên</dt><dd>{teachers.length}</dd></div><div><dt>Học sinh</dt><dd>{students.length}</dd></div><div><dt>Khóa học</dt><dd>{assignedCourses.length}</dd></div></dl></div>}</div></AdminDrawer>;
}
