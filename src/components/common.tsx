import { useMemo, useState } from "react";
import { changePassword, type AuthSession } from "../api";
import { messageOf } from "../lib/errors";

export function PageHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <section className="simple-hero"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{text}</p></section>;
}

export function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

export function SafeLessonContent({html}:{html:string}){
 const safe=useMemo(()=>{const template=document.createElement("template");template.innerHTML=html;template.content.querySelectorAll("script,style,iframe,object,embed,form").forEach(node=>node.remove());template.content.querySelectorAll<HTMLElement>("*").forEach(node=>{for(const attribute of Array.from(node.attributes)){const name=attribute.name.toLowerCase(),value=attribute.value.trim().toLowerCase();if(name.startsWith("on")||((name==="href"||name==="src")&&value.startsWith("javascript:")))node.removeAttribute(attribute.name)}});return template.innerHTML},[html]);
 return <div className="lesson-html" dangerouslySetInnerHTML={{__html:safe}}/>;
}

export function ChangePasswordDialog({session,onClose}:{session:AuthSession;onClose:()=>void}) {
  const [currentPassword,setCurrentPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [error,setError]=useState("");
  const [success,setSuccess]=useState(false);
  const [busy,setBusy]=useState(false);
  const submit=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setError("");try{await changePassword(session,currentPassword,newPassword,confirmPassword);setSuccess(true)}catch(reason){setError(messageOf(reason))}finally{setBusy(false)}};
  return <div className="dialog-backdrop"><section className="dialog-card"><div className="panel-head"><h2>Đổi mật khẩu</h2><button onClick={onClose}>Đóng</button></div>{success?<div className="success-state">Đổi mật khẩu thành công. Hãy dùng mật khẩu mới ở lần đăng nhập tiếp theo.</div>:<form className="live-form" onSubmit={submit}><label>Mật khẩu hiện tại<input type="password" required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label><label>Mật khẩu mới<input type="password" minLength={8} required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label><label>Xác nhận mật khẩu mới<input type="password" minLength={8} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>{error&&<div className="api-error">{error}</div>}<button className="primary" disabled={busy}>{busy?"Đang lưu…":"Đổi mật khẩu"}</button></form>}</section></div>;
}
