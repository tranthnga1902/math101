import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, KeyRound, LockKeyhole, MoreHorizontal, Pencil, Search, Trash2, Upload, UserPlus, X } from "lucide-react";
import { confirmUserImport, createUser, deleteUser, disableUser, downloadUserImportTemplate, getClasses, getEnrollments, getGrades, getMetadata, getUsersPage, resetUserPassword, setUserLocked, updateUser, uploadUserImport, type AuthSession, type MetadataOption, type UserAccount, type UserAccountInput, type UserImportPreview } from "../api";
import type { components } from "../api/types";
import "./user-accounts.css";

type UserStatus = components["schemas"]["UserRequest"]["status"];
type ImportRow = components["schemas"]["UserImportRow"];
const fallbackRoles:MetadataOption[]=[{value:"ADMIN",label:"Quản trị viên"},{value:"TEACHER",label:"Giáo viên"},{value:"STUDENT",label:"Học sinh"}];
const fallbackStatuses:MetadataOption[]=[{value:"ACTIVE",label:"Đang hoạt động"},{value:"LOCKED",label:"Đã khóa"},{value:"INACTIVE",label:"Tạm ngưng"},{value:"ARCHIVED",label:"Đã xóa"}];
const emptyForm=(roles:MetadataOption[],statuses:MetadataOption[]):UserAccountInput=>({username:"",email:"",fullName:"",phone:"",roleCode:roles[0]?.value??"",status:(statuses[0]?.value??"ACTIVE") as UserStatus,password:""});
const formatError=(reason:unknown,fallback:string)=>reason instanceof Error?reason.message:fallback;
const USERS_QUERY_KEY="admin-users-page";
const USERS_PAGE_SIZE=20;

export function UserAccountsPage({session}:{session:AuthSession}) {
 const queryClient=useQueryClient();
 const [page,setPage]=useState(0);
 const [search,setSearch]=useState(""),[roleCode,setRoleCode]=useState(""),[status,setStatus]=useState("");
 const [form,setForm]=useState<UserAccountInput>(()=>emptyForm(fallbackRoles,fallbackStatuses)),[editing,setEditing]=useState<UserAccount|null>(null),[selected,setSelected]=useState<UserAccount|null>(null),[panelOpen,setPanelOpen]=useState(false),[importOpen,setImportOpen]=useState(false);

 const metadataQuery=useQuery({queryKey:["admin-metadata-roles-statuses",session.accessToken],queryFn:()=>getMetadata(session)});
 const roles=metadataQuery.data?.roles.length?metadataQuery.data.roles:fallbackRoles;
 const statuses=metadataQuery.data?.userStatuses.length?metadataQuery.data.userStatuses:fallbackStatuses;
 const roleLabels=useMemo(()=>Object.fromEntries(roles.map(x=>[x.value,x.label])),[roles]);
 const statusLabels=useMemo(()=>Object.fromEntries(statuses.map(x=>[x.value,x.label])),[statuses]);

 const usersQuery=useQuery({queryKey:[USERS_QUERY_KEY,session.accessToken,search,roleCode,status,page],queryFn:()=>getUsersPage(session,{search,roleCode,status,page,size:USERS_PAGE_SIZE})});
 const rows=(usersQuery.data?.content??[]) as UserAccount[];
 const totalPages=usersQuery.data?.totalPages??0;
 const totalElements=usersQuery.data?.totalElements??0;
 const loading=usersQuery.isLoading;
 const invalidateUsers=()=>queryClient.invalidateQueries({queryKey:[USERS_QUERY_KEY]});

 const saveMutation=useMutation({
  mutationFn:(payload:{id?:number;input:UserAccountInput})=>payload.id?updateUser(session,payload.id,payload.input):createUser(session,payload.input),
  onSuccess:()=>{setPanelOpen(false);void invalidateUsers()},
 });
 const lockMutation=useMutation({
  mutationFn:(row:UserAccount)=>setUserLocked(session,row.id,row.status!=="LOCKED"),
  onSuccess:()=>void invalidateUsers(),
 });
 const disableMutation=useMutation({
  mutationFn:(row:UserAccount)=>disableUser(session,row.id),
  onSuccess:()=>void invalidateUsers(),
 });
 const deleteMutation=useMutation({mutationFn:(row:UserAccount)=>deleteUser(session,row.id),onSuccess:()=>{setSelected(null);void invalidateUsers()}});
 const resetMutation=useMutation({mutationFn:({row,password}:{row:UserAccount;password:string})=>resetUserPassword(session,row.id,password)});

 const error=usersQuery.isError?formatError(usersQuery.error,"Không thể tải danh sách tài khoản")
  :saveMutation.isError?formatError(saveMutation.error,"Không thể lưu tài khoản")
  :lockMutation.isError?formatError(lockMutation.error,"Không thể đổi trạng thái")
  :disableMutation.isError?formatError(disableMutation.error,"Không thể vô hiệu hóa")
  :deleteMutation.isError?formatError(deleteMutation.error,"Không thể xóa tài khoản")
  :resetMutation.isError?formatError(resetMutation.error,"Không thể đặt lại mật khẩu")
  :"";

 const setFilter=(setter:(value:string)=>void)=>(value:string)=>{setter(value);setPage(0)};
 const openCreate=()=>{setEditing(null);setForm(emptyForm(roles,statuses));setPanelOpen(true)};
 const openEdit=(row:UserAccount)=>{setEditing(row);setForm({username:row.username,email:row.email,fullName:row.fullName,phone:row.phone??"",roleCode:row.roleCode,status:row.status,password:""});setPanelOpen(true)};
 const save=(event:React.FormEvent)=>{event.preventDefault();saveMutation.mutate({id:editing?.id,input:{...form,password:form.password||undefined}})};
 const toggleLock=(row:UserAccount)=>lockMutation.mutate(row);
 const disable=(row:UserAccount)=>{if(!confirm(`Vô hiệu hóa tài khoản ${row.username}?`))return;disableMutation.mutate(row)};
 const remove=(row:UserAccount)=>{if(!confirm(`Xóa tài khoản ${row.username}? Thao tác này không thể hoàn tác.`))return;deleteMutation.mutate(row)};
 const resetPassword=(row:UserAccount)=>{const password=prompt(`Nhập mật khẩu mới cho ${row.username} (tối thiểu 8 ký tự):`);if(!password)return;if(password.length<8){alert("Mật khẩu phải có ít nhất 8 ký tự.");return}resetMutation.mutate({row,password},{onSuccess:()=>alert("Đã đặt lại mật khẩu.")})};
 const filtered=Boolean(search||roleCode||status),clearFilters=()=>{setSearch("");setRoleCode("");setStatus("");setPage(0)};
 return <section className="accounts-page">
  <header className="accounts-heading"><div><p>QUẢN TRỊ HỆ THỐNG</p><h1>Tài khoản</h1><span>Quản lý người dùng, phân quyền và trạng thái truy cập hệ thống.</span></div><div><button className="secondary-action" onClick={()=>setImportOpen(true)}><Upload size={17}/>Import Excel</button><button className="primary-action" onClick={openCreate}><UserPlus size={17}/>Thêm tài khoản</button></div></header>
  {error&&<div className="accounts-error"><AlertTriangle size={18}/><span>{error}</span><button onClick={()=>void usersQuery.refetch()}>Thử lại</button></div>}
  <div className="accounts-card"><div className="accounts-filters"><label><Search size={17}/><input aria-label="Tìm tài khoản" placeholder="Tìm username, email, họ tên" value={search} onChange={e=>setFilter(setSearch)(e.target.value)}/></label><select aria-label="Lọc vai trò" value={roleCode} onChange={e=>setFilter(setRoleCode)(e.target.value)}><option value="">Mọi vai trò</option>{roles.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select><select aria-label="Lọc trạng thái" value={status} onChange={e=>setFilter(setStatus)(e.target.value)}><option value="">Mọi trạng thái</option>{statuses.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select>{filtered&&<button onClick={clearFilters}>Xóa bộ lọc</button>}<span>{totalElements.toLocaleString("vi-VN")} tài khoản</span></div>
   <div className="accounts-table-wrap"><table><thead><tr><th className="index-column">STT</th><th>Họ và tên</th><th>Tài khoản</th><th>Vai trò</th><th>Trạng thái</th><th>Ngày tạo</th><th className="actions-column">Thao tác</th></tr></thead><tbody>{loading&&Array.from({length:7}).map((_,i)=><tr className="skeleton-row" key={i}><td colSpan={7}><span/></td></tr>)}{!loading&&rows.map((row,index)=><tr className={selected?.id===row.id?"selected-account-row":""} key={row.id} onClick={()=>setSelected(row)}><td className="index-column">{page*USERS_PAGE_SIZE+index+1}</td><td><button className="account-name-button">{row.fullName}</button><small>{row.phone||"Chưa có số điện thoại"}</small></td><td><span>@{row.username}</span><small>{row.email}</small></td><td>{roleLabels[row.roleCode]??row.roleCode}</td><td><span className={`status-chip status-${row.status.toLowerCase()}`}>{statusLabels[row.status]??row.status}</span></td><td className="numeric">{row.createdAt?new Intl.DateTimeFormat("vi-VN").format(new Date(row.createdAt)):"—"}</td><td className="actions-column" onClick={e=>e.stopPropagation()}><button title="Chỉnh sửa" onClick={()=>openEdit(row)}><Pencil size={16}/></button><button onClick={()=>toggleLock(row)}>{row.status==="LOCKED"?"Mở khóa":"Khóa"}</button></td></tr>)}</tbody></table></div>
   {!loading&&!rows.length&&<div className="accounts-empty"><h2>{filtered?"Không có kết quả phù hợp":"Chưa có tài khoản"}</h2><p>{filtered?"Thử thay đổi từ khóa hoặc xóa bộ lọc hiện tại.":"Thêm tài khoản đầu tiên hoặc import danh sách từ Excel."}</p>{filtered?<button className="secondary-action" onClick={clearFilters}>Xóa bộ lọc</button>:<button className="primary-action" onClick={openCreate}>Thêm tài khoản</button>}</div>}
   <footer className="accounts-pagination"><span>Trang {Math.min(page+1,Math.max(totalPages,1))}/{Math.max(totalPages,1)}</span><div><button aria-label="Trang trước" disabled={page===0} onClick={()=>setPage(x=>x-1)}><ChevronLeft size={17}/></button><button aria-label="Trang sau" disabled={page+1>=totalPages} onClick={()=>setPage(x=>x+1)}><ChevronRight size={17}/></button></div></footer>
  </div>{selected&&<AccountDetail session={session} account={selected} roleLabel={roleLabels[selected.roleCode]??selected.roleCode} statusLabel={statusLabels[selected.status]??selected.status} onClose={()=>setSelected(null)} onEdit={()=>openEdit(selected)} onLock={()=>toggleLock(selected)} onReset={()=>resetPassword(selected)} onDisable={()=>disable(selected)} onDelete={()=>remove(selected)}/>} {panelOpen&&<AccountPanel form={form} setForm={setForm} editing={editing} roles={roles} statuses={statuses} onClose={()=>setPanelOpen(false)} onSubmit={save}/>} {importOpen&&<ImportDialog session={session} roleLabels={roleLabels} onClose={()=>setImportOpen(false)} onImported={invalidateUsers}/>}
 </section>;
}

function AccountDetail({session,account,roleLabel,statusLabel,onClose,onEdit,onLock,onReset,onDisable,onDelete}:{session:AuthSession;account:UserAccount;roleLabel:string;statusLabel:string;onClose:()=>void;onEdit:()=>void;onLock:()=>void;onReset:()=>void;onDisable:()=>void;onDelete:()=>void}){
 const [menuOpen,setMenuOpen]=useState(false);
 const roleInfo=useQuery({queryKey:["account-role-info",session.accessToken,account.id,account.roleCode],enabled:account.roleCode==="STUDENT"||account.roleCode==="TEACHER",queryFn:async()=>{const [classes,grades]=await Promise.all([getClasses(session),getGrades(session)]);const kind=account.roleCode==="STUDENT"?"class-students":"class-teachers";const links=await Promise.all(classes.map(async classroom=>({classroom,items:await getEnrollments(session,kind,classroom.id)})));const assigned=links.filter(x=>x.items.some(item=>item.userId===account.id)).map(x=>x.classroom);return {classes:assigned,grades:new Map(grades.map(grade=>[grade.id,grade]))}}});
 const initial=account.fullName.trim().split(/\s+/).slice(-2).map(x=>x[0]).join("").toUpperCase();
 const date=(value?:string)=>value?new Intl.DateTimeFormat("vi-VN").format(new Date(value)):"Chưa cập nhật";
 const current=new Date(),startYear=current.getMonth()>=7?current.getFullYear():current.getFullYear()-1,schoolYear=`${startYear}–${startYear+1}`;
 const classes=roleInfo.data?.classes??[],gradeNames=[...new Set(classes.map(x=>roleInfo.data?.grades.get(x.gradeId)?.gradeNumber).filter(Boolean))].join(", ");
 return <div className="accounts-overlay account-detail-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><aside className="account-detail" aria-label="Chi tiết tài khoản">
  <header className="account-detail-title"><div><p>CHI TIẾT TÀI KHOẢN</p><h2>{account.fullName}</h2></div><div className="detail-head-actions"><div className="account-more"><button aria-label="Thêm thao tác" onClick={()=>setMenuOpen(x=>!x)}><MoreHorizontal size={20}/></button>{menuOpen&&<div className="account-more-menu"><button onClick={onLock}><LockKeyhole size={16}/>{account.status==="LOCKED"?"Mở khóa tài khoản":"Khóa tài khoản"}</button><button onClick={onReset}><KeyRound size={16}/>Đặt lại mật khẩu</button><button onClick={onDisable}><LockKeyhole size={16}/>Vô hiệu hóa</button><button className="delete" onClick={onDelete}><Trash2 size={16}/>Xóa tài khoản</button></div>}</div><button aria-label="Đóng" onClick={onClose}><X size={20}/></button></div></header>
  <div className="account-detail-scroll"><section className="account-identity"><div className="account-avatar">{initial||"?"}</div><h3>{account.fullName}</h3><p>{roleLabel}</p><span className={`status-chip status-${account.status.toLowerCase()}`}><i/>{statusLabel}</span></section>
   <DetailSection title="Thông tin tài khoản"><DetailItem label="Mã tài khoản" value={`${account.roleCode==="STUDENT"?"HS":account.roleCode==="TEACHER"?"GV":"AD"}${String(account.id).padStart(6,"0")}`}/><DetailItem label="Tên đăng nhập" value={account.username}/><DetailItem label="Email" value={account.email}/><DetailItem label="Số điện thoại" value={account.phone||"Chưa cập nhật"}/><DetailItem label="Ngày sinh" value="Chưa cập nhật"/><DetailItem label="Giới tính" value="Chưa cập nhật"/><DetailItem label="Ngày tạo tài khoản" value={date(account.createdAt)}/><DetailItem label="Lần đăng nhập gần nhất" value="Chưa cập nhật"/></DetailSection>
   {(account.roleCode==="STUDENT"||account.roleCode==="TEACHER")&&<DetailSection title={account.roleCode==="STUDENT"?"Thông tin học tập":"Thông tin công tác"}>{roleInfo.isLoading?<p className="role-info-loading">Đang tải thông tin phân công…</p>:account.roleCode==="STUDENT"?<><DetailItem label="Khối" value={gradeNames||"Chưa phân lớp"}/><DetailItem label="Lớp" value={classes.map(x=>x.name).join(", ")||"Chưa phân lớp"}/><DetailItem label="Năm học" value={schoolYear}/></>:<><DetailItem label="Bộ môn" value="Chưa cập nhật"/><DetailItem label="Lớp phụ trách" value={classes.map(x=>x.name).join(", ")||"Chưa phân công"}/><DetailItem label="Năm học" value={schoolYear}/></>}</DetailSection>}
  </div><footer className="account-detail-footer"><button className="primary-action" onClick={onEdit}><Pencil size={17}/>Chỉnh sửa thông tin</button><button className="secondary-action" onClick={onReset}><KeyRound size={17}/>Đặt lại mật khẩu</button><button className="secondary-action lock-action" onClick={onLock}><LockKeyhole size={17}/>{account.status==="LOCKED"?"Mở khóa tài khoản":"Khóa tài khoản"}</button></footer>
 </aside></div>;
}

function DetailSection({title,children}:{title:string;children:React.ReactNode}){return <section className="account-info-section"><h4>{title}</h4><dl>{children}</dl></section>}
function DetailItem({label,value}:{label:string;value:string}){return <div><dt>{label}</dt><dd>{value}</dd></div>}

function AccountPanel({form,setForm,editing,roles,statuses,onClose,onSubmit}:{form:UserAccountInput;setForm:(x:UserAccountInput)=>void;editing:UserAccount|null;roles:MetadataOption[];statuses:MetadataOption[];onClose:()=>void;onSubmit:(e:React.FormEvent)=>void}){
 return <div className="accounts-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><aside className="account-panel"><header><div><p>{editing?"CHỈNH SỬA":"TẠO MỚI"}</p><h2>{editing?editing.fullName:"Thêm tài khoản"}</h2></div><button aria-label="Đóng" onClick={onClose}><X size={19}/></button></header><form onSubmit={onSubmit}><label>Username<input required pattern="[a-zA-Z0-9._-]+" maxLength={80} value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/></label><label>Email<input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Họ và tên<input required maxLength={120} value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})}/></label><label>Điện thoại<input maxLength={30} value={form.phone??""} onChange={e=>setForm({...form,phone:e.target.value})}/></label><div className="form-columns"><label>Vai trò<select value={form.roleCode} onChange={e=>setForm({...form,roleCode:e.target.value})}>{roles.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label><label>Trạng thái<select value={form.status} onChange={e=>setForm({...form,status:e.target.value as UserStatus})}>{statuses.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label></div><label>{editing?"Mật khẩu mới (không bắt buộc)":"Mật khẩu khởi tạo"}<input type="password" minLength={8} required={!editing} value={form.password??""} onChange={e=>setForm({...form,password:e.target.value})}/></label><footer><button type="button" className="secondary-action" onClick={onClose}>Hủy</button><button className="primary-action">{editing?"Lưu thay đổi":"Tạo tài khoản"}</button></footer></form></aside></div>;
}

function ImportDialog({session,roleLabels,onClose,onImported}:{session:AuthSession;roleLabels:Record<string,string>;onClose:()=>void;onImported:()=>Promise<unknown>}){
 const [step,setStep]=useState<1|2|3>(1),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState<UserImportPreview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[result,setResult]=useState("");const rows=(preview?.rows??[]) as ImportRow[];
 const friendlyError=(reason:unknown)=>{const message=reason instanceof Error?reason.message:"Không thể đọc file";return message==="Failed to fetch"?"Không thể kết nối máy chủ. Vui lòng kiểm tra backend đã được cập nhật và thử lại.":message};
 const upload=async()=>{if(!file)return;setBusy(true);setError("");try{setPreview(await uploadUserImport(session,file));setStep(2)}catch(reason){setError(friendlyError(reason))}finally{setBusy(false)}};
 const confirmImport=async()=>{if(!preview?.objectKey)return;setBusy(true);setError("");try{const next=await confirmUserImport(session,preview.objectKey);setResult(`Đã tạo ${next.created??0} tài khoản, bỏ qua ${next.skipped??0} dòng.`);setStep(3);await onImported()}catch(reason){setError(reason instanceof Error?reason.message:"Import thất bại")}finally{setBusy(false)}};
 const labels=useMemo(()=>["Tải file","Xem trước","Xác nhận"],[]);
 return <div className="accounts-overlay"><section className="import-dialog">
  <header><div><p>IMPORT TÀI KHOẢN</p><h2>Nhập danh sách từ Excel</h2></div><button aria-label="Đóng" onClick={onClose}><X size={19}/></button></header>
  <ol className="import-steps">{labels.map((label,i)=><li className={step>=i+1?"active":""} key={label}><span>{step>i+1?<CheckCircle2 size={14}/>:i+1}</span><em>{label}</em></li>)}</ol>
  {error&&<div className="accounts-error"><AlertTriangle size={17}/><span>{error}</span></div>}
  {step===1&&<div className="import-upload">
   <div className="import-upload-icon"><Upload size={24}/></div><h3>Chọn file Excel</h3><p>Định dạng .xlsx · tối đa 1.000 dòng · dung lượng tối đa 10 MB</p>
   <label className="file-picker"><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e=>{setFile(e.target.files?.[0]??null);setError("")}}/><span>{file?"Đổi file":"Chọn file .xlsx"}</span></label>
   {file&&<div className="selected-file"><CheckCircle2 size={18}/><span><b>{file.name}</b><small>{(file.size/1024).toLocaleString("vi-VN",{maximumFractionDigits:0})} KB</small></span></div>}
   <div className="import-requirements"><b>Các cột bắt buộc</b><span>username · email · fullName · roleCode · password</span></div>
   <div className="import-upload-actions"><button type="button" className="secondary-action" onClick={()=>void downloadUserImportTemplate(session)}>Tải file mẫu</button><button type="button" className="primary-action" disabled={!file||busy} onClick={()=>void upload()}>{busy?"Đang tải lên…":"Tải lên và xem trước"}</button></div>
  </div>}
  {step===2&&<><div className="import-summary"><span><b>{preview?.totalRows??0}</b>Tổng dòng</span><span className="valid"><b>{preview?.validRows??0}</b>Hợp lệ</span><span className="invalid"><b>{preview?.invalidRows??0}</b>Cần sửa</span></div><div className="import-preview"><table><thead><tr><th>Dòng</th><th>Họ tên</th><th>Tài khoản</th><th>Vai trò</th><th>Kết quả</th></tr></thead><tbody>{rows.map(row=><tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.fullName}</td><td><b>{row.username}</b><small>{row.email}</small></td><td>{roleLabels[row.roleCode??""]??row.roleCode}</td><td>{row.errors?.length?<span className="row-errors">{row.errors.join(", ")}</span>:<span className="row-valid"><CheckCircle2 size={15}/>Hợp lệ</span>}</td></tr>)}</tbody></table></div><footer><button className="secondary-action" onClick={()=>setStep(1)}>Chọn file khác</button><button className="primary-action" disabled={busy||!preview?.validRows} onClick={()=>void confirmImport()}>{busy?"Đang import…":`Import ${preview?.validRows??0} tài khoản`}</button></footer></>}
  {step===3&&<div className="import-finished"><CheckCircle2 size={42}/><h3>Import hoàn tất</h3><p>{result}</p><button className="primary-action" onClick={onClose}>Đóng</button></div>}
 </section></div>;
}
