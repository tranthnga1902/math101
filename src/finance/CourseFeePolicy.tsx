import { useEffect,useState } from "react";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { Calculator,Info,Landmark,ListOrdered,Users } from "lucide-react";
import { financeRequest,type AuthSession } from "../api";
import { SkeletonTable } from "../admin/components/AdminSkeleton";
import { date,money,planStateLabel,type FeePolicy,type FeePreview,type FeeSyncResult,type PaymentAccount } from "./types";
import "./finance.css";

export function CourseFeePolicy({session,courseId}:{session:AuthSession;courseId:number}) {
 const client=useQueryClient();
 const policy=useQuery({queryKey:["finance","policy",session.accessToken,courseId],queryFn:()=>financeRequest<FeePolicy|null>(session,`/courses/${courseId}/policy`)});
 const accounts=useQuery({queryKey:["finance","accounts",session.accessToken],queryFn:()=>financeRequest<PaymentAccount[]>(session,"/accounts")});
 const preview=useQuery({queryKey:["finance","preview",session.accessToken,courseId],queryFn:()=>financeRequest<FeePreview>(session,`/courses/${courseId}/fees/preview`),enabled:!!policy.data,retry:false});
 const [form,setForm]=useState({paymentAccountId:"",calculation:"PER_SESSION",unitPrice:"150000",discountAmount:"0",installments:"1",firstDueDate:"",periodMonths:"1",prorate:false,bankQr:true,cash:false});
 const [notice,setNotice]=useState("");
 useEffect(()=>{const p=policy.data;if(p)setForm({paymentAccountId:String(p.payment_account_id),calculation:p.calculation,unitPrice:String(p.unit_price),discountAmount:String(p.discount_amount),installments:String(p.installments),firstDueDate:p.first_due_date,periodMonths:String(p.period_months),prorate:p.prorate,bankQr:p.bank_qr,cash:p.cash});},[policy.data]);
 const save=useMutation({mutationFn:()=>financeRequest(session,`/courses/${courseId}/policy`,"PUT",{...form,paymentAccountId:Number(form.paymentAccountId),unitPrice:Number(form.unitPrice),discountAmount:Number(form.discountAmount),installments:Number(form.installments),periodMonths:Number(form.periodMonths)}),onSuccess:async()=>{setNotice("Đã lưu. Khoản thu đã lập giữ nguyên số tiền và tài khoản.");await client.invalidateQueries({queryKey:["finance"]});}});
 const generate=useMutation({mutationFn:(mode:"ADD"|"SYNC")=>financeRequest<FeeSyncResult>(session,`/courses/${courseId}/fees?mode=${mode}`,"POST"),onSuccess:async r=>{setNotice(`Lập mới ${r.added} học sinh · lập lại ${r.rebuilt} · giữ nguyên ${r.unchanged} · đã xác nhận nên bỏ qua ${r.locked}. Tổng ${r.rows} khoản thu nháp — xác nhận trong Tài chính để học sinh nhìn thấy.`);await client.invalidateQueries({queryKey:["finance"]});}});
 if(policy.isPending||accounts.isPending)return <SkeletonTable rows={4} columns={2}/>;
 const error=policy.error||accounts.error||save.error||generate.error;
 const selected=accounts.data?.find(a=>a.id===Number(form.paymentAccountId));
 const p=policy.data;
 const pv=preview.data;
 const total=p?p.unit_price*(p.calculation==="PER_SESSION"?p.session_count:1)-p.discount_amount:0;
 const dirty=!!p&&(String(p.payment_account_id)!==form.paymentAccountId||p.calculation!==form.calculation||String(p.unit_price)!==form.unitPrice||String(p.discount_amount)!==form.discountAmount||String(p.installments)!==form.installments||p.first_due_date!==form.firstDueDate||String(p.period_months)!==form.periodMonths||p.prorate!==form.prorate);
 const set=(k:"calculation"|"unitPrice"|"discountAmount"|"installments"|"firstDueDate"|"periodMonths"|"paymentAccountId")=>(e:{target:{value:string}})=>setForm({...form,[k]:e.target.value});
 return <form className="fee-policy" onSubmit={e=>{e.preventDefault();setNotice("");save.mutate();}}>
  {error&&<p className="finance-error" role="alert">{error.message}</p>}
  {notice&&<p role="status" className="fee-notice">{notice}</p>}
  <div className="fee-grid">
   <section className="fee-card">
    <h3 className="fee-card-title"><Calculator size={15}/>Chính sách học phí</h3>
    <div className="finance-form two-columns">
     <label>Cách tính<select value={form.calculation} onChange={set("calculation")}><option value="PER_SESSION">Theo số buổi của khóa</option><option value="FIXED">Trọn khóa</option></select></label>
     <label>{form.calculation==="PER_SESSION"?"Đơn giá mỗi buổi (₫)":"Học phí trọn khóa (₫)"}<input type="number" min="1" max="999999999999" step="1" required value={form.unitPrice} onChange={set("unitPrice")}/></label>
     <label>Giảm giá tổng cộng (₫)<input type="number" min="0" step="1" required value={form.discountAmount} onChange={set("discountAmount")}/></label>
     <label>Số kỳ thanh toán<input type="number" min="1" max="36" required value={form.installments} onChange={set("installments")}/></label>
     <label>Hạn đóng kỳ đầu<input type="date" required value={form.firstDueDate} onChange={set("firstDueDate")}/></label>
     <label>Khoảng cách giữa hai kỳ (tháng)<input type="number" min="1" max="12" required value={form.periodMonths} onChange={set("periodMonths")}/></label>
     {form.calculation==="PER_SESSION"&&<label className="full finance-check"><input type="checkbox" checked={form.prorate} onChange={e=>setForm({...form,prorate:e.target.checked})}/> Tính theo buổi thực học — học sinh vào lớp giữa chừng chỉ trả những buổi còn lại</label>}
    </div>
   </section>
   <section className="fee-card">
    <h3 className="fee-card-title"><Info size={15}/>Hệ thống tự tính</h3>
    {p?<div className="cw-clean-table-wrap"><table className="cw-clean-table"><tbody>
     <tr><td className="fee-key">Số buổi của khóa</td><td><b>{p.session_count} buổi</b></td></tr>
     <tr><td className="fee-key">Học phí sau giảm</td><td><b className="fee-total">{money(total)}</b></td></tr>
     <tr><td className="fee-key">Chia thành</td><td><b>{p.installments} kỳ</b></td></tr>
     <tr><td className="fee-key">Cách tính buổi</td><td>{p.prorate&&p.calculation==="PER_SESSION"?"Theo buổi lớp còn dạy từ ngày vào lớp":"Đủ số buổi của khóa"}</td></tr>
    </tbody></table></div>:<p className="fee-muted">Chưa lưu chính sách. Lưu xong, hệ thống tính học phí theo số buổi của khóa.</p>}
    <p className="fee-muted">Đổi chính sách không sửa khoản thu đã lập.</p>
   </section>
   <section className="fee-card fee-wide">
    <h3 className="fee-card-title"><Landmark size={15}/>Thanh toán</h3>
    <div className="finance-form two-columns">
     <label className="full">Tài khoản nhận tiền<select required value={form.paymentAccountId} onChange={set("paymentAccountId")}><option value="">Chọn tài khoản đã cấu hình</option>{accounts.data?.filter(a=>a.status==="ACTIVE").map(a=><option value={a.id} key={a.id}>{a.name} · {a.bank_name} · ****{a.account_number.slice(-4)}</option>)}</select></label>
     {!accounts.data?.length&&<p className="full fee-muted">Tạo tài khoản ở Tài chính → Cấu hình thanh toán trước khi lưu chính sách.</p>}
     {selected&&<p className="full fee-payee">Đơn vị nhận: <b>{selected.beneficiary_name}</b> · Chủ tài khoản: <b>{selected.account_holder}</b></p>}
     <label className="finance-check"><input type="checkbox" checked={form.bankQr} onChange={e=>setForm({...form,bankQr:e.target.checked})}/> Chuyển khoản QR</label>
     <label className="finance-check"><input type="checkbox" checked={form.cash} onChange={e=>setForm({...form,cash:e.target.checked})}/> Tiền mặt tại quầy</label>
     <p className="full fee-muted">Thanh toán trực tuyến: chưa kết nối nhà cung cấp.</p>
    </div>
   </section>
   {p&&<section className="fee-card fee-wide">
    <h3 className="fee-card-title"><ListOrdered size={15}/>Bảng chia kỳ dự kiến</h3>
    {dirty&&<p className="fee-muted">Bảng tính theo chính sách đã lưu. Lưu chính sách để xem lại theo số vừa sửa.</p>}
    {preview.isPending?<SkeletonTable rows={3} columns={3}/>:preview.error?<p className="finance-error" role="alert">{preview.error.message}</p>:pv?<>
     <div className="finance-scroll"><table className="finance-table fee-plan-table"><thead><tr><th>Kỳ</th><th>Số tiền</th><th>Hạn đóng</th></tr></thead><tbody>
      {pv.sample.map(i=><tr key={i.no}><td>Kỳ {i.no}</td><td className="fee-amount">{money(i.amount)}</td><td>{date(i.dueDate)}</td></tr>)}
      <tr className="fee-plan-total"><td>Tổng cộng</td><td className="fee-amount">{money(pv.sample.reduce((s,i)=>s+i.amount,0))}</td><td>{pv.courseSessions} buổi · {pv.installments} kỳ</td></tr>
     </tbody></table></div>
     <p className="fee-muted">Chia không hết thì phần lẻ dồn vào kỳ cuối.{pv.prorate&&pv.calculation==="PER_SESSION"?" Học sinh vào lớp muộn có bảng riêng ở dưới.":""}</p>
    </>:null}
   </section>}
   {p&&pv&&<section className="fee-card fee-wide">
    <h3 className="fee-card-title"><Users size={15}/>Học sinh trong khóa ({pv.students.length})</h3>
    <p className="fee-muted">Lập mới {pv.newCount} · cần lập lại {pv.changedCount} · đã khớp {pv.unchangedCount} · đã xác nhận nên giữ nguyên {pv.lockedCount}.</p>
    {pv.students.length?<div className="finance-scroll"><table className="finance-table"><thead><tr><th>Học sinh</th><th>Lớp</th><th>Vào lớp</th><th>Buổi tính tiền</th><th>Học phí</th><th>Trạng thái</th></tr></thead><tbody>
     {pv.students.map(s=><tr key={s.studentId}>
      <td>{s.studentName}</td>
      <td>{s.className??"—"}</td>
      <td>{date(s.joinedOn)}</td>
      <td>{s.sessions}{s.sessions<pv.courseSessions&&<small>thay vì {pv.courseSessions}</small>}</td>
      <td className="fee-amount">{money(s.total)}</td>
      <td><span className="finance-status" data-plan={s.state}>{planStateLabel[s.state]}</span>{s.note&&<small>{s.note}</small>}</td>
     </tr>)}
    </tbody></table></div>:<p className="fee-muted">Chưa có học sinh nào trong các lớp học khóa này.</p>}
   </section>}
  </div>
  <div className="fee-actions">
   <button type="button" className="cw-btn-outline" disabled={!p||generate.isPending||save.isPending||(!!pv&&pv.changedCount===0&&pv.newCount===0)} onClick={()=>{setNotice("");generate.mutate("SYNC");}}>Lập lại theo lớp hiện tại{pv?` (${pv.newCount+pv.changedCount})`:""}</button>
   <button type="button" className="cw-btn-outline" disabled={!p||generate.isPending||save.isPending||(!!pv&&pv.newCount===0)} onClick={()=>{setNotice("");generate.mutate("ADD");}}>Lập khoản thu cho học sinh mới{pv?` (${pv.newCount})`:""}</button>
   <button type="submit" className="cw-btn-primary" disabled={save.isPending||(!form.bankQr&&!form.cash)}>Lưu chính sách</button>
  </div>
 </form>;
}
