import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getSubmissionItems, gradeSubmission, gradeSubmissionItems, type AuthSession, type ItemScoreInput, type TeacherSubmission } from "../api";
import { messageOf } from "../lib/errors";

/**
 * Trạng thái của một hộp chấm bài. Có hai màn hình chấm — mục "Chấm và trả điểm" và bảng chấm
 * trong chi tiết lớp — và cả hai chấm chung một bài nộp, nên phần **quyết định chấm đường nào**
 * phải nằm một chỗ. Nếu để mỗi màn hình tự quyết thì chỉ cần một màn hình quên: giáo viên chấm
 * 20 câu tự luận ở màn hình này, mở màn hình kia gõ điểm cả bài, và `PUT /grade` xoá sạch bảng
 * điểm từng câu vừa chấm mà không hỏi.
 *
 * <p>Hai đường loại trừ nhau:
 * <ul>
 *   <li>Đề có câu tự luận → chấm từng câu, tổng do máy cộng lại. Giáo viên không gõ tổng.</li>
 *   <li>Đề toàn trắc nghiệm, hoặc không dựng được bảng chấm (đề thiếu đáp án, bài giao không
 *       phải phiếu đề) → ô điểm cả bài như trước.</li>
 * </ul>
 *
 * <p>Hook chỉ giữ trạng thái và luật; mỗi màn hình tự vẽ lấy giao diện của mình.
 */
export function useGradingSheet(session:AuthSession,submission:TeacherSubmission|null,onSaved:(dong:boolean)=>void|Promise<void>){
 const sheet=useQuery({
  queryKey:["submission-items",submission?.id],
  queryFn:()=>getSubmissionItems(session,submission!.id),
  enabled:Boolean(submission),
  // Bảng chấm hỏng là chuyện của đề (thiếu đáp án), thử lại ba lần cũng ra đúng lỗi đó —
  // chỉ làm giáo viên chờ lâu hơn trước khi thấy ô điểm cả bài.
  retry:false,
 });
 const [scores,setScores]=useState<Record<number,string>>({});
 const [notes,setNotes]=useState<Record<number,string>>({});
 const [feedback,setFeedback]=useState("");
 const [wholeScore,setWholeScore]=useState("");
 // Đổi bài nộp thì nạp lại từ bài mới, đừng để điểm của em trước còn nằm trong ô.
 useEffect(()=>{
  setScores({});setNotes({});
  setFeedback(submission?.teacher_feedback??"");
  setWholeScore(submission?.score==null?"":String(submission.score));
 },[submission]);
 useEffect(()=>{
  const data=sheet.data;if(!data)return;
  const diem:Record<number,string>={},nhanXet:Record<number,string>={};
  data.items.filter(item=>item.essay).forEach(item=>{
   diem[item.problemId]=item.score==null?"":String(item.score);
   nhanXet[item.problemId]=item.feedback??"";
  });
  setScores(diem);setNotes(nhanXet);
  if(data.teacherFeedback!=null)setFeedback(data.teacherFeedback);
 },[sheet.data]);

 const items=useMemo(()=>sheet.data?.items??[],[sheet.data]);
 const tuLuan=useMemo(()=>items.filter(item=>item.essay),[items]);
 const chamTungCau=tuLuan.length>0;
 const conThieu=chamTungCau?tuLuan.filter(item=>(scores[item.problemId]??"").trim()==="").length:0;

 const luuTungCau=useMutation({
  mutationFn:()=>{
   const payload:ItemScoreInput[]=tuLuan.map(item=>{
    const raw=(scores[item.problemId]??"").trim();
    // Ô trống = bỏ chấm câu này, đưa nó về chưa chấm. Không phải 0 điểm: gửi 0 cho một câu chưa
    // đọc tới là chốt tổng thấp hơn thực tế rồi trả cho học sinh.
    return {problemId:item.problemId,score:raw===""?null:Number(raw),feedback:(notes[item.problemId]??"").trim()||null};
   });
   return gradeSubmissionItems(session,submission!.id,payload,feedback.trim()||null);
  },
  // Chấm dở thì giữ hộp mở để chấm tiếp; chấm đủ mới đóng. Nạp lại bảng để dòng tổng phía trên
  // hiện đúng điểm vừa cộng — hộp còn mở thì giáo viên đang nhìn vào con số đó.
  onSuccess:async data=>{await onSaved(data.conThieu===0);sheet.refetch()},
 });
 const luuCaBai=useMutation({
  mutationFn:()=>gradeSubmission(session,submission!.id,Number(wholeScore),feedback.trim()),
  onSuccess:()=>onSaved(true),
 });

 return {
  sheet,items,tuLuan,chamTungCau,conThieu,
  scores,notes,feedback,wholeScore,
  setScore:(problemId:number,value:string)=>setScores(current=>({...current,[problemId]:value})),
  setNote:(problemId:number,value:string)=>setNotes(current=>({...current,[problemId]:value})),
  setFeedback,setWholeScore,
  luu:()=>{if(chamTungCau)luuTungCau.mutate();else luuCaBai.mutate()},
  dangLuu:luuTungCau.isPending||luuCaBai.isPending,
  loi:luuTungCau.isError?messageOf(luuTungCau.error):luuCaBai.isError?messageOf(luuCaBai.error):"",
 };
}
