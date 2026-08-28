import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CheckCircle, ChevronDown, ClipboardList, FileText, GraduationCap, Home, KeyRound, LogOut, Settings, UserRound } from "lucide-react";
import {
  getAdminStats, getAuditLogs, getAdminClassOverview, getGrades, getEnrollments, createClass, updateClass, deleteClass,
  getUsers, getCourses, getGradebook, addEnrollment, removeEnrollment,
  type AdminClassOverviewRow, type AuthSession, type Classroom, type ClassroomInput, type Metadata,
} from "../api";
import { ClassDetail } from "../teacher/class/ClassDetail";
import { useMetadata, metadataOptions, firstMetadataValue } from "../hooks/useMetadata";
import { messageOf } from "../lib/errors";
import { PageHeading, EmptyState } from "../components/common";
import { UserAccountsPage } from "./UserAccountsPage";
import { TextbookManagement } from "./TextbookManagement";
import { DocumentManagement } from "./DocumentManagement";
import { TaxonomyManagement } from "./TaxonomyManagement";
import { AuditManagement } from "./AuditManagement";

export function AdminShell({session,children,onLogout,onChangePassword}:{session:AuthSession;children:(activeSection:string)=>React.ReactNode;onLogout:()=>void;onChangePassword:()=>void}) {
 const [active,setActive]=useState("overview");
 const [profileOpen,setProfileOpen]=useState(false);
 const items=[
  ["overview","Tổng quan",Home],
  ["users","Tài khoản",UserRound],
  ["classes","Lớp học",CheckCircle],
  ["textbooks","Sách giáo khoa",GraduationCap],
  ["documents","Tài liệu",FileText],
  ["topics","Nội dung học",BookOpen],
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

export function AdminDashboard({session,activeSection}:{session:AuthSession;activeSection:string}) {
  const metadata=useMetadata(session);
  const statsQuery=useQuery({queryKey:["admin-stats",session.accessToken],queryFn:()=>getAdminStats(session)});
  const logsQuery=useQuery({queryKey:["admin-audit-logs",session.accessToken],queryFn:()=>getAuditLogs(session,{size:6})});
  const stats=statsQuery.data??null;
  const logs=logsQuery.data?.items??[];
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
      {activeSection==="topics"&&<TaxonomyManagement session={session}/>}
      {activeSection==="classes"&&<AdminClasses session={session}/>}
      {activeSection==="audit"&&<AuditManagement session={session}/>}
      {activeSection==="settings"&&<AdminSystemSettings session={session} metadata={metadata}/>}
  </div>;
}

export function AdminSystemSettings({session,metadata}:{session:AuthSession;metadata:Metadata|null}) {
 const groups:[keyof Metadata,string][]=[["roles","Vai trò người dùng"],["userStatuses","Trạng thái tài khoản"],["classStatuses","Trạng thái lớp học"],["courseStatuses","Trạng thái khóa học"],["publishStatuses","Trạng thái xuất bản"],["documentTypes","Loại tài liệu"],["documentAudiences","Phạm vi tài liệu"]];
 return <><PageHeading eyebrow="HỆ THỐNG" title="Cài đặt hệ thống" text="Thông tin cấu hình đang được backend áp dụng cho tài khoản quản trị."/><section className="admin-settings-grid"><article className="audit-panel"><h2>Tài khoản quản trị</h2><dl className="settings-details"><div><dt>Email</dt><dd>{session.email}</dd></div><div><dt>Vai trò</dt><dd>{session.role}</dd></div><div><dt>Mã người dùng</dt><dd>{session.userId}</dd></div></dl></article>{groups.map(([key,title])=><article className="audit-panel" key={key}><h2>{title}</h2><div className="settings-options">{metadataOptions(metadata,key).map(option=><span key={option.value}><b>{option.label}</b><code>{option.value}</code></span>)}{!metadataOptions(metadata,key).length&&<small>Backend chưa khai báo dữ liệu.</small>}</div></article>)}</section></>;
}

/** Dòng tổng quan (snake_case từ SQL) đổi về hình dạng Classroom mà các panel sẵn có đang dùng. */
const asClassroom=(row:AdminClassOverviewRow):Classroom=>({id:row.id,code:row.code,name:row.name,gradeId:row.grade_id,status:row.status as Classroom["status"],teacherCount:Number(row.teacher_count),studentCount:Number(row.student_count),courseCount:Number(row.course_count),createdAt:row.created_at,description:row.description,curriculumCount:Number(row.curriculum_count),documentCount:Number(row.document_count)});
/** Lớp do chính giáo viên lập trong 7 ngày gần đây — đây là cách Admin biết có lớp mới, khớp với dòng audit ghi lúc tạo lớp. */
const isNewTeacherClass=(row:AdminClassOverviewRow)=>row.created_by_role==="TEACHER"&&Date.now()-new Date(row.created_at).getTime()<7*86400000;

export function AdminClasses({session}:{session:AuthSession}){
 const metadata=useMetadata(session);
 const queryClient=useQueryClient();
 const [form,setForm]=useState({code:"",name:"",gradeId:0,status:""}),[editing,setEditing]=useState<number|null>(null),[selected,setSelected]=useState<Classroom|null>(null);
 const [search,setSearch]=useState(""),[gradeId,setGradeId]=useState(0),[status,setStatus]=useState(""),[formOpen,setFormOpen]=useState(false);
 const [mode,setMode]=useState<"teacher"|"table">("teacher"),[detail,setDetail]=useState<Classroom|null>(null);
 const classesQuery=useQuery({queryKey:["admin-classes",session.accessToken,search,gradeId,status],queryFn:async()=>{const [overview,nextGrades]=await Promise.all([getAdminClassOverview(session,{search,gradeId:gradeId||undefined,status}),getGrades(session)]);return {overview,grades:nextGrades}}});
 const overview=classesQuery.data?.overview??[],grades=classesQuery.data?.grades??[];
 const rows=overview.map(asClassroom),teacherNames=Object.fromEntries(overview.map(row=>[row.id,row.teacher_names??""])) as Record<number,string>;
 /* Gom lớp theo giáo viên phụ trách; nhóm chưa phân công luôn đứng đầu vì đó là việc Admin cần xử lý. */
 const teacherGroups=[...overview.reduce((map,row)=>map.set(row.teacher_names??"",[...(map.get(row.teacher_names??"")??[]),row]),new Map<string,AdminClassOverviewRow[]>()).entries()].sort((a,b)=>a[0]?(b[0]?a[0].localeCompare(b[0],"vi"):1):-1);
 const invalidate=()=>queryClient.invalidateQueries({queryKey:["admin-classes"]});
 const createMutation=useMutation({mutationFn:(input:ClassroomInput)=>createClass(session,input),onSuccess:invalidate});
 const updateMutation=useMutation({mutationFn:({id,input}:{id:number;input:ClassroomInput})=>updateClass(session,id,input),onSuccess:invalidate});
 const deleteMutation=useMutation({mutationFn:(id:number)=>deleteClass(session,id),onSuccess:invalidate});
 useEffect(()=>{const data=classesQuery.data;if(!data)return;setSelected(current=>current?data.overview.map(asClassroom).find(x=>x.id===current.id)??null:null);if(!form.gradeId&&data.grades[0])setForm(x=>({...x,gradeId:data.grades[0].id}))},[classesQuery.data]);
 useEffect(()=>{if(!editing)setForm(x=>({...x,status:x.status||firstMetadataValue(metadata,"classStatuses")}))},[editing,metadata]);
 const error=classesQuery.isError?messageOf(classesQuery.error):createMutation.isError?messageOf(createMutation.error):updateMutation.isError?messageOf(updateMutation.error):deleteMutation.isError?messageOf(deleteMutation.error):"";
 const reset=()=>{setEditing(null);setForm({code:"",name:"",gradeId:grades[0]?.id||0,status:firstMetadataValue(metadata,"classStatuses")});setFormOpen(false)};
 const save=async(e:React.FormEvent)=>{e.preventDefault();try{editing?await updateMutation.mutateAsync({id:editing,input:form as ClassroomInput}):await createMutation.mutateAsync(form as ClassroomInput);reset()}catch{/* lỗi đã có trong mutation state */}};
 const edit=(row:Classroom)=>{setEditing(row.id);setForm({code:row.code,name:row.name,gradeId:row.gradeId,status:row.status});setFormOpen(true)};
 const archive=async(row:Classroom)=>{if(!confirm(`Xóa lớp “${row.name}”? Dữ liệu lịch sử vẫn được giữ lại.`))return;try{await deleteMutation.mutateAsync(row.id);if(selected?.id===row.id)setSelected(null)}catch{/* lỗi đã có trong mutation state */}};
 const gradeName=(id:number)=>grades.find(x=>x.id===id)?.name??`Khối ${id}`,statusName=(value:string)=>metadataOptions(metadata,"classStatuses").find(x=>x.value===value)?.label??value;
 return <section className={`classroom-module ${selected?"has-detail":""}`}><div className="classroom-master"><header className="classroom-heading"><div><p>QUẢN TRỊ HỆ THỐNG</p><h1>Lớp học theo giáo viên phụ trách</h1><span>Ai đang quản lý lớp nào, lớp đã có chương trình học và tài liệu chưa, học sinh nộp bài tới đâu.</span></div><div><div className="class-view-toggle"><button className={mode==="teacher"?"active":""} onClick={()=>setMode("teacher")}>Theo giáo viên</button><button className={mode==="table"?"active":""} onClick={()=>setMode("table")}>Bảng lớp</button></div><button className="primary-action" onClick={()=>{reset();setFormOpen(true)}}>+ Tạo lớp</button></div></header>{error&&<div className="accounts-error"><span>{error}</span><button onClick={()=>void classesQuery.refetch()}>Thử lại</button></div>}<div className="classroom-card"><div className="classroom-filters"><input aria-label="Tìm lớp" placeholder="Tìm kiếm lớp học, giáo viên…" value={search} onChange={e=>setSearch(e.target.value)}/><select value={gradeId} onChange={e=>setGradeId(Number(e.target.value))}><option value={0}>Tất cả khối</option>{grades.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Mọi trạng thái</option>{metadataOptions(metadata,"classStatuses").map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></div>{mode==="teacher"?<div className="teacher-groups">{teacherGroups.map(([teacher,list])=><article className={`teacher-group ${teacher?"":"unassigned"}`} key={teacher||"__none"}><header><h3>{teacher||"Chưa phân công giáo viên"}</h3><small>{list.length} lớp · {list.reduce((sum,row)=>sum+Number(row.student_count),0)} học sinh</small></header>{list.map(row=><div className="teacher-class-row" key={row.id}><span className="cell-title"><b>{row.name}{isNewTeacherClass(row)&&<span className="new-class-flag">GV vừa lập</span>}</b><small>Mã {row.code} · {row.grade_name??gradeName(row.grade_id)} · {statusName(row.status)}</small></span><span className="cell-metric"><b>{row.student_count}</b>học sinh</span><span className={`cell-metric ${Number(row.curriculum_count)?"":"warn"}`}><b>{row.curriculum_count}</b>mục chương trình</span><span className={`cell-metric ${Number(row.document_count)?"":"warn"}`}><b>{row.document_count}</b>tài liệu</span><span className="cell-metric"><b>{row.required_total}/{row.optional_total}</b>bắt buộc/tự chọn</span><span className="row-actions"><button onClick={()=>setDetail(asClassroom(row))}>Chi tiết</button><button onClick={()=>setSelected(asClassroom(row))}>Phân công</button><button onClick={()=>edit(asClassroom(row))}>Sửa</button></span></div>)}</article>)}{!overview.length&&<EmptyState text="Không có lớp phù hợp với bộ lọc."/>}</div>:<div className="classroom-table-wrap"><table><thead><tr><th>Mã lớp</th><th>Năm học</th><th>Khối</th><th>Giáo viên</th><th>Học sinh</th><th>Khóa học</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{rows.map(row=><tr className={selected?.id===row.id?"selected":""} key={row.id} onClick={()=>setSelected(row)}><td><b>{row.code}</b><small>{row.name}</small></td><td className="numeric">{new Date(row.createdAt??Date.now()).getFullYear()}–{new Date(row.createdAt??Date.now()).getFullYear()+1}</td><td>{gradeName(row.gradeId)}</td><td className="class-teacher-name">{teacherNames[row.id]||<button className="assign-teacher" onClick={event=>{event.stopPropagation();setSelected(row)}}>Chưa phân công</button>}</td><td className="numeric">{row.studentCount}</td><td className="numeric">{row.courseCount}</td><td><span className={`status-chip status-${row.status.toLowerCase()}`}>{statusName(row.status)}</span></td><td className="class-actions"><button onClick={e=>{e.stopPropagation();edit(row)}}>Sửa</button><button className="danger-link" onClick={e=>{e.stopPropagation();void archive(row)}}>Xóa</button></td></tr>)}</tbody></table>{!rows.length&&<EmptyState text="Không có lớp phù hợp với bộ lọc."/>}</div>}<footer>{rows.length.toLocaleString("vi-VN")} lớp học · {teacherGroups.filter(([teacher])=>teacher).length} giáo viên phụ trách</footer></div></div>{detail&&<div className="class-detail-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setDetail(null)}}><div><ClassDetail session={session} classroom={detail} onClose={()=>setDetail(null)}/></div></div>}{selected&&<ClassEnrollmentPanel session={session} classroom={selected} onClose={()=>setSelected(null)}/>} {formOpen&&<div className="accounts-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)reset()}}><aside className="account-panel"><header><div><p>{editing?"CHỈNH SỬA LỚP":"TẠO LỚP MỚI"}</p><h2>{editing?form.name:"Thông tin lớp học"}</h2></div><button onClick={reset}>×</button></header><form onSubmit={save}><label>Mã lớp<input required maxLength={30} value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></label><label>Tên lớp<input required maxLength={120} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Khối<select value={form.gradeId} onChange={e=>setForm({...form,gradeId:Number(e.target.value)})}>{grades.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Trạng thái<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{metadataOptions(metadata,"classStatuses").map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label><footer><button type="button" className="secondary-action" onClick={reset}>Hủy</button><button className="primary-action">{editing?"Lưu thay đổi":"Tạo lớp"}</button></footer></form></aside></div>}</section>;
}

export function ClassEnrollmentPanel({session,classroom,onClose}:{session:AuthSession;classroom:Classroom;onClose:()=>void}){
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
