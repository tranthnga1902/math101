import { useState } from "react";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { financeRequest,type AuthSession } from "../api";
import { Button } from "../components/ui/button";
import { money,date,statusLabel,type StudentFee } from "./types";
import "./finance.css";

export function StudentFeesPage({session}:{session:AuthSession}) {
 const client=useQueryClient();
 const query=useQuery({queryKey:["finance","my-fees",session.accessToken],queryFn:()=>financeRequest<StudentFee[]>(session,"/my-fees"),refetchOnWindowFocus:true});
 return <div className="space-y-5"><header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Học phí của em</h1><p className="text-sm mt-2 text-on-surface-variant">Thông tin khoản cần đóng và xác nhận nhận tiền.</p></div><Button variant="outline" disabled={query.isFetching} onClick={()=>void query.refetch()}>Cập nhật trạng thái</Button></header>
 {query.isPending?<div className="h-60 rounded-xl bg-surface-container animate-pulse" aria-label="Đang tải học phí"/>:query.isError?<p role="alert" className="finance-error">{query.error.message}</p>:!query.data.length?<p className="p-8 text-center rounded-xl border border-outline-variant text-on-surface-variant">Em chưa có khoản học phí được xác nhận.</p>:<div className="grid lg:grid-cols-2 gap-5">{query.data.map(f=><FeeCard key={`${f.id}:${f.outstanding}:${f.pending_confirmation}`} session={session} fee={f} onDone={()=>client.invalidateQueries({queryKey:["finance"]})}/>)}</div>}
 </div>;
}
function FeeCard({session,fee:f,onDone}:{session:AuthSession;fee:StudentFee;onDone:()=>Promise<unknown>}) {
 const [amount,setAmount]=useState(String(f.outstanding)),[note,setNote]=useState(""),[qrError,setQrError]=useState(false);
 const mutation=useMutation({mutationFn:()=>financeRequest(session,`/fees/${f.id}/transactions`,"POST",{amount:Number(amount),method:"BANK_QR",note}),onSuccess:onDone});
 const payable=f.outstanding>0&&!["CANCELLED","DRAFT"].includes(f.status)&&f.account_status==="ACTIVE";
 const valid=Number.isSafeInteger(Number(amount))&&Number(amount)>0&&Number(amount)<=f.outstanding;
 const qr=`https://img.vietqr.io/image/${encodeURIComponent(f.bank_code)}-${encodeURIComponent(f.account_number)}-${encodeURIComponent(f.qr_template)}.png?${new URLSearchParams({amount:String(Number(amount)),addInfo:f.payment_reference,accountName:f.account_holder})}`;
 return <article className="min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 space-y-4">
  <header><h2 className="text-base font-semibold">{f.title}</h2><span className="finance-status mt-3" data-status={f.display_status}>{statusLabel[f.display_status]}</span>{f.pending_confirmation&&<span className="finance-status ml-2">Đang xác nhận chuyển tiền</span>}</header>
  <div className="grid grid-cols-2 gap-3"><div><p className="text-sm text-on-surface-variant">Còn cần đóng</p><b className="block mt-1 text-2xl text-primary">{money(f.outstanding)}</b></div><div><p className="text-sm text-on-surface-variant">Hạn đóng</p><b className="block mt-2">{date(f.due_date)}</b></div></div>
  <p className="text-xs text-on-surface-variant">Tổng khoản thu {money(f.amount)} · Đã xác nhận {money(f.paid_amount)}</p>
  <section className="border-t border-outline-variant pt-4"><h3 className="text-sm font-semibold mb-3">Thanh toán cho</h3><dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm"><dt className="text-on-surface-variant">Đơn vị nhận</dt><dd className="break-words">{f.beneficiary_name}</dd><dt className="text-on-surface-variant">Ngân hàng</dt><dd>{f.bank_name}</dd><dt className="text-on-surface-variant">Số tài khoản</dt><dd className="font-semibold break-all select-all">{f.account_number}</dd><dt className="text-on-surface-variant">Chủ tài khoản</dt><dd className="break-words">{f.account_holder}</dd></dl></section>
  <div className="rounded-lg bg-surface-container-low p-3"><p className="text-xs text-on-surface-variant">Nội dung chuyển khoản duy nhất</p><b className="block mt-1 select-all">{f.payment_reference}</b></div>
  {payable&&f.bank_qr&&!f.pending_confirmation&&<form className="finance-form" onSubmit={e=>{e.preventDefault();mutation.mutate();}}><label>Số tiền chuyển khoản (₫)<input type="number" min="1" max={f.outstanding} step="1" required value={amount} onChange={e=>{setAmount(e.target.value);setQrError(false);}}/></label>
   {valid&&!qrError?<img className="w-60 max-w-full mx-auto rounded-lg" src={qr} alt={`QR chuyển khoản ${money(Number(amount))}, nội dung ${f.payment_reference}`} onError={()=>setQrError(true)}/>:qrError?<p className="text-sm text-on-surface-variant">Chưa tải được QR. Em có thể chuyển khoản theo thông tin ngân hàng và nội dung ở trên.</p>:null}
   <label>Thông tin giao dịch để đối soát<input maxLength={1000} value={note} placeholder="Ví dụ: thời gian chuyển, mã giao dịch ngân hàng" onChange={e=>setNote(e.target.value)}/></label>
   <Button disabled={!valid||mutation.isPending}>Báo đã chuyển khoản</Button><p className="text-xs text-on-surface-variant">Thông báo này gửi yêu cầu đối soát. Khoản học phí chỉ được ghi nhận đã đóng sau khi quản trị xác nhận nhận tiền.</p>
   {mutation.error&&<p role="alert" className="finance-error">{mutation.error.message}</p>}
  </form>}
  {f.pending_confirmation&&<p className="rounded-lg bg-primary-container text-primary p-3 text-sm">Thông tin chuyển khoản đang được kiểm tra. Em không cần gửi lại yêu cầu.</p>}
  {payable&&f.cash&&<p className="text-sm text-on-surface-variant">Em có thể đóng tiền mặt tại quầy của {f.beneficiary_name}. Vui lòng nhận phiếu thu.</p>}
  {f.account_status!=="ACTIVE"&&f.outstanding>0&&<p className="finance-error">Tài khoản nhận tiền đang tạm ngưng. Liên hệ đơn vị thu để được hướng dẫn.</p>}
 </article>;
}
