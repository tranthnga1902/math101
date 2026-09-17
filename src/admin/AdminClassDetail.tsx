import type { AuthSession, Classroom } from "../api";
import { ClassDetail } from "../teacher/class/ClassDetail";

/** Điểm vào Class Detail dành riêng cho module Lớp học của Admin. */
export function AdminClassDetail(props:{session:AuthSession;classroom:Classroom;onClose:()=>void}){
 return <div className="admin-class-detail"><ClassDetail {...props}/></div>;
}
