import { useEffect,useState } from "react";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { Calculator,Info,Landmark } from "lucide-react";
import { financeRequest,type AuthSession } from "../api";
import { SkeletonTable } from "../admin/components/AdminSkeleton";
import { money,type FeePolicy,type PaymentAccount } from "./types";
import "./finance.css";

export function CourseFeePolicy({session,courseId}:{session:AuthSession;courseId:number}) {
 const client=useQueryClient();
 const policy=useQuery({queryKey:["finance","policy",session.accessToken,courseId],queryFn:()=>financeRequest<FeePolicy|null>(session,`/courses/${courseId}/policy`)});
 const accounts=useQuery({queryKey:["finance","accounts",session.accessToken],queryFn:()=>financeRequest<PaymentAccount[]>(session,"/accounts")});
 const [form,setForm]=useState({paymentAccountId:"",calculation:"PER_SESSION",unitPrice:"150000",discountAmount:"0",installments:"1",firstDueDate:"",periodMonths:"1",bankQr:true,cash:false});
 const [notice,setNotice]=useState("");
 useEffect(()=>{const p=policy.data;if(p)setForm({paymentAccountId:String(p.payment_account_id),calculation:p.calculation,unitPrice:String(p.unit_price),discountAmount:String(p.discount_amount),installments:String(p.installments),firstDueDate:p.first_due_date,periodMonths:String(p.period_months),bankQr:p.bank_qr,cash:p.cash});},[policy.data]);
 const save=useMutation({mutationFn:()=>financeRequest(session,`/courses/${courseId}/policy`,"PUT",{...form,paymentAccountId:Number(form.paymentAccountId),unitPrice:Number(form.unitPrice),discountAmount:Number(form.discountAmount),installments:Number(form.installments),periodMonths:Number(form.periodMonths)}),onSuccess:async()=>{setNotice("Đã lưu. Khoản thu đã lập giữ nguyên số tiền và tài khoản.");await client.invalidateQueries({queryKey:["finance"]});}});
 const generate=useMutation({mutationFn:()=>financeRequest<number>(session,`/courses/${courseId}/fees`,"POST"),onSuccess:async count=>{setNotice(`Đã tạo ${count} khoản thu nháp cho học sinh đã ghi danh. Xác nhận khoản thu trong Tài chính để học sinh nhìn thấy.`);await client.invalidateQueries({queryKey:["finance"]});}});
 if(policy.isPending||accounts.isPending)return <SkeletonTable rows={4} columns={2}/>;
 const error=policy.error||accounts.error||save.error||generate.error;
 const selected=accounts.data?.find(a=>a.id===Number(form.paymentAccountId));
 const p=policy.data;
 const total=p?p.unit_price*(p.calculation==="PER_SESSION"?p.session_count:1)-p.discount_amount:0;
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
    </div>
   </section>
   <section className="fee-card">
    <h3 className="fee-card-title"><Info size={15}/>Hệ thống tự tính</h3>
    {p?<div className="cw-clean-table-wrap"><table className="cw-clean-table"><tbody>
     <tr><td className="fee-key">Số buổi của khóa</td><td><b>{p.session_count} buổi</b></td></tr>
     <tr><td className="fee-key">Học phí sau giảm</td><td><b className="fee-total">{money(total)}</b></td></tr>
     <tr><td className="fee-key">Chia thành</td><td><b>{p.installments} kỳ</b></td></tr>
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
  </div>
  <div className="fee-actions">
   <button type="button" className="cw-btn-outline" disabled={!p||generate.isPending||save.isPending} onClick={()=>generate.mutate()}>Lập khoản thu cho học sinh đã ghi danh</button>
   <button type="submit" className="cw-btn-primary" disabled={save.isPending||(!form.bankQr&&!form.cash)}>Lưu chính sách</button>
  </div>
 </form>;
}
