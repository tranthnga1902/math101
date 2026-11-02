export type AdminDestination =
 | {section:"programs";programId:number}
 | {section:"course-instances";courseId:number}
 | {section:"classes";classId:number};

let destination:AdminDestination|null=null;
export const getAdminDestination=()=>destination;
export function navigateAdmin(next:AdminDestination){
 destination=next;
 window.dispatchEvent(new CustomEvent<AdminDestination>("math10:admin-navigation",{detail:next}));
}
