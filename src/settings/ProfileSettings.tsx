import {useEffect,useState} from "react";
import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import {getMyProfile,updateMyProfile,type AuthSession} from "../api";
import "./profile-settings.css";

const roles:Record<string,string>={ADMIN:"Quản trị viên",TEACHER:"Giáo viên",STUDENT:"Học sinh"};
const statuses:Record<string,string>={ACTIVE:"Hoạt động",LOCKED:"Đã khóa",INACTIVE:"Tạm ngưng",ARCHIVED:"Đã xóa"};
const show=(value:unknown)=>value===null||value===undefined||value===""?"Chưa cập nhật":String(value);
const date=(value:string|null)=>value?new Intl.DateTimeFormat("vi-VN").format(new Date(value)):"Chưa cập nhật";

export function ProfileSettings({session}:{session:AuthSession}){
 const client=useQueryClient(),[editing,setEditing]=useState(false),[fullName,setFullName]=useState(""),[email,setEmail]=useState(""),[phone,setPhone]=useState(""),[dateOfBirth,setDateOfBirth]=useState(""),[gender,setGender]=useState(""),[avatarUrl,setAvatarUrl]=useState<string|null>(null);
 const query=useQuery({queryKey:["my-profile",session.accessToken],queryFn:()=>getMyProfile(session)}),profile=query.data;
 useEffect(()=>{if(profile){setFullName(profile.fullName);setEmail(profile.email);setPhone(profile.phone??"");setDateOfBirth(profile.dateOfBirth??"");setGender(profile.gender??"");setAvatarUrl(profile.avatarUrl)}},[profile]);
 const save=useMutation({mutationFn:()=>updateMyProfile(session,{fullName,email,phone,dateOfBirth:dateOfBirth||null,gender,avatarUrl}),onSuccess:data=>{client.setQueryData(["my-profile",session.accessToken],data);setEditing(false)}});
 const chooseAvatar=(file?:File)=>{if(!file)return;if(!file.type.startsWith("image/")){alert("Vui lòng chọn tệp ảnh.");return}if(file.size>2*1024*1024){alert("Ảnh đại diện tối đa 2 MB.");return}const reader=new FileReader();reader.onload=()=>setAvatarUrl(String(reader.result));reader.readAsDataURL(file)};
 if(query.isLoading)return <div className="self-profile-state">Đang tải thông tin cá nhân…</div>;
 if(query.isError||!profile)return <div className="self-profile-state error">Không thể tải thông tin cá nhân. <button onClick={()=>void query.refetch()}>Thử lại</button></div>;
 const initials=profile.fullName.trim().split(/\s+/).slice(-2).map(x=>x[0]).join("").toUpperCase();
 const subtitle=profile.roleCode==="STUDENT"&&profile.classes.length?`${roles.STUDENT} · ${profile.classes.join(", ")}`:profile.roleCode==="TEACHER"?`${roles.TEACHER} · Bộ môn ${show(profile.subject)}`:roles[profile.roleCode]??profile.roleCode;
 return <section className="self-profile-page"><header><p>CÀI ĐẶT</p><h1>Thông tin cá nhân</h1><span>Thông tin hồ sơ và tài khoản của bạn trong hệ thống.</span></header>
  <section className="self-profile-hero"><div className="self-avatar">{profile.avatarUrl?<img src={profile.avatarUrl} alt="Ảnh đại diện"/>:initials||"?"}</div><div><h2>{profile.fullName}</h2><p>{subtitle}</p></div><button onClick={()=>setEditing(true)}>Chỉnh sửa thông tin</button></section>
  {save.isError&&<div className="self-profile-state error">{save.error instanceof Error?save.error.message:"Không thể lưu thay đổi"}</div>}
  <div className="self-profile-grid"><ProfileBlock title="Thông tin cá nhân"><Row label="Họ và tên" value={profile.fullName}/><Row label="Ngày sinh" value={show(profile.dateOfBirth)}/><Row label="Giới tính" value={show(profile.gender)}/><Row label="Email" value={profile.email}/><Row label="Số điện thoại" value={show(profile.phone)}/></ProfileBlock>
   {profile.roleCode==="STUDENT"&&<ProfileBlock title="Thông tin học tập"><Row label="Mã học sinh" value={profile.code}/><Row label="Khối" value={show(profile.grade)}/><Row label="Lớp" value={profile.classes.join(", ")||"Chưa phân lớp"}/><Row label="Năm học" value={show(profile.academicYear)}/><Row label="Trạng thái học tập" value="Đang học"/></ProfileBlock>}
   {profile.roleCode==="TEACHER"&&<ProfileBlock title="Thông tin công tác"><Row label="Mã giáo viên" value={profile.code}/><Row label="Bộ môn" value={show(profile.subject)}/><Row label="Lớp phụ trách" value={profile.classes.join(", ")||"Chưa phân công"}/><Row label="Năm học" value={show(profile.academicYear)}/></ProfileBlock>}
   {profile.roleCode==="ADMIN"&&<ProfileBlock title="Thông tin quản trị"><Row label="Mã Admin" value={profile.code}/><Row label="Vai trò" value="System Admin"/><Row label="Nhóm quyền" value={show(profile.permissionGroup)}/><Row label="Đơn vị" value={show(profile.department)}/></ProfileBlock>}
   <ProfileBlock title="Thông tin tài khoản"><Row label="Tên đăng nhập" value={profile.username}/><Row label="Vai trò" value={roles[profile.roleCode]??profile.roleCode}/><Row label="Trạng thái" value={statuses[profile.status]??profile.status} status/><Row label="Ngày tạo" value={date(profile.createdAt)}/><Row label="Lần đăng nhập gần nhất" value={date(profile.lastLoginAt)}/></ProfileBlock></div>
  {editing&&<div className="self-profile-modal" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(false)}}><form onSubmit={e=>{e.preventDefault();save.mutate()}}><header><h2>Chỉnh sửa thông tin cá nhân</h2><button type="button" onClick={()=>setEditing(false)}>×</button></header><div className="avatar-picker"><b>Ảnh đại diện</b><div>{avatarUrl?<img src={avatarUrl} alt="Ảnh đại diện mới"/>:<span>{initials||"?"}</span>}<label><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>chooseAvatar(e.target.files?.[0])}/>Thay ảnh</label></div></div><label>Họ và tên<input required maxLength={120} value={fullName} onChange={e=>setFullName(e.target.value)}/></label><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Số điện thoại<input maxLength={30} value={phone} onChange={e=>setPhone(e.target.value)}/></label><label>Ngày sinh<input type="date" value={dateOfBirth} max={new Date().toISOString().slice(0,10)} onChange={e=>setDateOfBirth(e.target.value)}/></label><label>Giới tính<select value={gender} onChange={e=>setGender(e.target.value)}><option value="">Chưa cập nhật</option><option value="Nam">Nam</option><option value="Nữ">Nữ</option><option value="Khác">Khác</option></select></label><footer><button type="button" onClick={()=>setEditing(false)}>Hủy</button><button disabled={save.isPending}>{save.isPending?"Đang lưu…":"Lưu thay đổi"}</button></footer></form></div>}
 </section>;
}
function ProfileBlock({title,children}:{title:string;children:React.ReactNode}){return <section className="self-profile-block"><h3>{title}</h3><dl>{children}</dl></section>}
function Row({label,value,status=false}:{label:string;value:string;status?:boolean}){return <div><dt>{label}</dt><dd className={status?"profile-status":""}>{status&&<i/>}{value}</dd></div>}

