import type { components } from "./api/types";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export type ApiEnvelope<T> = { success: boolean; code: number; message: string; data: T };
export type AuthSession = {
  accessToken: string; refreshToken: string; expiresInSeconds: number;
  userId: number; email: string; role: "student" | "teacher" | "admin";
};
export type Progress = {
  id: number; studentId: number; lessonId: number|null; worksheetId:number|null; status:string; openedAt: string | null;
  completedAt: string | null; completionPercent: number;
};
export type Course = { id: number; code: string; name: string; description: string; status: string };
export type CourseInput = Omit<Course, "id">;
export type Chapter = { id: number; courseId: number; title: string; orderIndex: number; status: string };
export type ChapterInput = Omit<Chapter, "id">;
export type Lesson = { id: number; chapterId: number; title: string; publicCode: string; summary: string; contentHtml: string; orderIndex: number; status: string };
export type LessonInput = Omit<Lesson, "id">;
type GeneratedUser = components["schemas"]["UserResponse"];
export type UserAccount = Required<Pick<GeneratedUser, "id" | "username" | "email" | "fullName" | "roleCode" | "status">> & Pick<GeneratedUser, "phone" | "createdAt" | "updatedAt">;
export type UserAccountInput = components["schemas"]["UserRequest"];
export type UserPage = components["schemas"]["PageUserResponse"];
export type UserImportPreview = components["schemas"]["UserImportPreviewResponse"];
export type UserImportResult = components["schemas"]["UserImportResult"];
export type AdminStats = { totalUsers: number; teachers: number; students: number; classes: number; courses: number; publishedCourses: number; publishedProblems: number };
export type AuditLog = { id: number; actorUserId: number | null; action: string; targetType: string; targetId: number | null; ipAddress: string | null; oldData: string | null; newData: string | null; createdAt: string };
export type Subject = { id:number; code:string; name:string };
export type Grade = { id:number; code:string; gradeNumber:number; name:string };
export type Topic = { id:number; name:string; description:string };
export type ProblemType = { id:number; topicId:number; name:string; recognitionSigns:string; generalMethod:string; solutionOutline:string; commonMistakes:string };
export type Problem = { id:number; problemTypeId:number; publicCode:string; qrSlug:string|null; statementLatex:string; contentHtml:string; difficulty:string; status:string; problemKind:"PRACTICE"|"EXAM"; examPart:string|null; easierProblemId:number|null; equivalentProblemId:number|null; harderProblemId:number|null };
export type Hint = { id:number; problemId:number; contentLatex:string; orderIndex:number };
export type SolutionStep = { id:number; problemId:number; title:string; contentLatex:string; orderIndex:number };
export type Worksheet = { id:number; name:string; columnsCount:number; showQr:boolean; showStudentFields:boolean; createdBy:number; lessonId:number|null; items:{id:number;problemId:number;orderIndex:number;publicCode:string;qrSlug:string;statementLatex:string;difficulty:string}[] };
export type StudentCourse={id:number;code:string;name:string;description:string;status:string;chapters:{id:number;title:string;orderIndex:number;lessons:{id:number;title:string;summary:string;contentHtml:string;orderIndex:number;status:string;progressStatus:string;openedAt:string|null;completedAt:string|null;completionPercent:number;locked:boolean;resources:{id:number;type:string;title:string;externalUrl:string;fileAssetId:number|null;textContent:string;orderIndex:number}[];worksheets:{id:number;name:string}[]}[]}[]};
export type PublicProblem={problem:Problem;problemType:ProblemType;hints:Hint[];solutions:SolutionStep[];similar:{relation:"EASIER"|"EQUIVALENT"|"HARDER";problem:Problem}[]};
type GeneratedClassroom=components["schemas"]["ClassroomResponse"];
export type Classroom=Required<Pick<GeneratedClassroom,"id"|"code"|"name"|"gradeId"|"status"|"teacherCount"|"studentCount"|"courseCount">>&Pick<GeneratedClassroom,"createdAt"|"updatedAt">;
export type ClassroomInput=components["schemas"]["ClassroomRequest"];
export type ClassroomPage=components["schemas"]["PageClassroomResponse"];
export type TeacherStats={classes:number;studentsBelow50:number;worksheets:number};
export type GradebookRow={student_id:number;full_name:string;username:string;assignment_id:number;title:string;status:string;completion_percent:number};
export type LessonResource={id:number;lessonId:number;type:string;title:string;externalUrl:string;fileAssetId:number|null;textContent:string;orderIndex:number};
export type DocumentItem={id:number;title:string;docType:string;audience:string;fileUrl:string;gradeId:number|null;status:string;subjectId:number|null;totalPages:number|null;basePageOffset:number|null;createdAt:string;thumbnailUrl:string|null};
export type TextbookItem={id:number;title:string;docType:string;audience:string;gradeId:number|null;subjectId:number|null;status:string;totalPages:number|null;basePageOffset:number;fileUrl:string;thumbnailUrl:string|null;createdAt:string};
export type TextbookDetail={id:number;title:string;docType:string;audience:string;gradeId:number|null;subjectId:number|null;status:string;totalPages:number|null;basePageOffset:number;fileUrl:string;pageMappings:{pdfPage:number;bookPageLabel:string|null;pageType:string;chapterTitle:string|null;lessonTitle:string|null}[]};
export type TextbookOpen={documentId:number;title:string;fileUrl:string;pdfPage:number;totalPages:number|null};
export type LessonDocument={id:number;lessonId:number;documentId:number;title:string;docType:string;audience:string;fileUrl:string;required:boolean;teacherNote:string|null;startPage:number|null;displayOrder:number};
export type DocumentOpen={lessonDocumentId:number;title:string;fileUrl:string;startPage:number|null};
export type LessonDocumentQuestion={id:number;lessonDocumentId:number;questionText:string;optionA:string;optionB:string;optionC:string;optionD:string;correctOption:string|null;explanation:string|null;displayOrder:number};
export type LessonDocumentProgress={id:number;lessonDocumentId:number;studentId:number;status:string;openedAt:string|null;lastOpenedAt:string|null;openCount:number;totalSeconds:number;quizScore:number|null;completedAt:string|null};
export type FileAsset={id:number;fileName:string;fileUrl:string;mimeType:string;fileSize:number};
export type Enrollment={id:number;classId:number;userId:number|null;courseId:number|null;label:string};
export type Assignment={id:number;classId:number;lessonId:number|null;worksheetId:number|null;title:string;dueAt:string|null;status:string;createdBy:number};
export type StudentAssignment={id:number;title:string;dueAt:string|null;status:string;lessonId:number|null;worksheetId:number|null;worksheetName:string;progressStatus:string;completionPercent:number;items:{problemId:number;orderIndex:number;publicCode:string;qrSlug:string;statementLatex:string;difficulty:string}[]};
export type MetadataOption={value:string;label:string};
export type Metadata={
  roles:MetadataOption[];
  userStatuses:MetadataOption[];
  courseStatuses:MetadataOption[];
  publishStatuses:MetadataOption[];
  classStatuses:MetadataOption[];
  resourceTypes:MetadataOption[];
  problemDifficulties:MetadataOption[];
  problemKinds:MetadataOption[];
  examParts:MetadataOption[];
  documentTypes:MetadataOption[];
  documentAudiences:MetadataOption[];
};
type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  userId?: number;
  email?: string;
  roleCode?: string;
  role?: string;
};

function decodeJwt(token: string) {
  const encoded = token.split(".")[1];
  if (!encoded) throw new Error("Token đăng nhập không hợp lệ");
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(decodeURIComponent(escape(atob(normalized)))) as { sub: number; email: string; role: string };
}

export function normalizeRole(value: string | undefined | null): AuthSession["role"] {
  const role = String(value ?? "").trim().toUpperCase().replace(/^ROLE_/, "");
  if (role === "STUDENT") return "student";
  if (role === "TEACHER") return "teacher";
  if (role === "ADMIN") return "admin";
  throw new Error("Vai trò tài khoản không được hỗ trợ");
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.success) throw new Error(payload?.message || `API trả về lỗi ${response.status}`);
  return payload.data;
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const tokens = await request<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify({ identifier: email, password }) });
  const claims = decodeJwt(tokens.accessToken);
  const role = normalizeRole(tokens.roleCode ?? tokens.role ?? claims.role);
  return { ...tokens, userId: Number(tokens.userId ?? claims.sub), email: tokens.email ?? claims.email, role };
}

export function changePassword(session: AuthSession, currentPassword: string, newPassword: string, confirmPassword: string) {
  return request<void>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
  }, session.accessToken);
}

export function getMetadata(session: AuthSession) {
  return request<Metadata>("/metadata", {}, session.accessToken);
}

export function markLessonProgress(session: AuthSession, lessonId: number, completed = false) {
  return request<Progress>(`/lessons/${lessonId}/progress`, {
    method: "PATCH", body: JSON.stringify({ status: completed ? "COMPLETED" : "IN_PROGRESS" }),
  }, session.accessToken);
}

export function getStudentProgress(session: AuthSession, studentId = session.userId) {
  return request<Progress[]>(`/progress?studentId=${studentId}`, {}, session.accessToken);
}

export async function getCourses(session: AuthSession) {
  const page = await request<{ content: Course[] }>("/courses?page=0&size=100", {}, session.accessToken);
  return page.content;
}

export function createCourse(session: AuthSession, course: CourseInput) {
  return request<Course>("/courses", { method: "POST", body: JSON.stringify(course) }, session.accessToken);
}

export function updateCourse(session: AuthSession, id: number, course: CourseInput) {
  return request<Course>(`/courses/${id}`, { method: "PUT", body: JSON.stringify(course) }, session.accessToken);
}

export function deleteCourse(session: AuthSession, id: number) {
  return request<void>(`/courses/${id}`, { method: "DELETE" }, session.accessToken);
}

export function getChapters(session: AuthSession, courseId: number) {
  return request<Chapter[]>(`/chapters?courseId=${courseId}`, {}, session.accessToken);
}

export function createChapter(session: AuthSession, chapter: ChapterInput) {
  return request<Chapter>("/chapters", { method: "POST", body: JSON.stringify(chapter) }, session.accessToken);
}

export function updateChapter(session: AuthSession, id: number, chapter: ChapterInput) {
  return request<Chapter>(`/chapters/${id}`, { method: "PUT", body: JSON.stringify(chapter) }, session.accessToken);
}

export function deleteChapter(session: AuthSession, id: number) {
  return request<void>(`/chapters/${id}`, { method: "DELETE" }, session.accessToken);
}
export const reorderChapters=(s:AuthSession,ids:number[])=>request<void>("/chapters/reorder",{method:"PATCH",body:JSON.stringify({ids})},s.accessToken);

export function getLessons(session: AuthSession, chapterId: number) {
  return request<Lesson[]>(`/lessons?chapterId=${chapterId}`, {}, session.accessToken);
}

export function createLesson(session: AuthSession, lesson: LessonInput) {
  return request<Lesson>("/lessons", { method: "POST", body: JSON.stringify(lesson) }, session.accessToken);
}

export function updateLesson(session: AuthSession, id: number, lesson: LessonInput) {
  return request<Lesson>(`/lessons/${id}`, { method: "PUT", body: JSON.stringify(lesson) }, session.accessToken);
}

export function deleteLesson(session: AuthSession, id: number) {
  return request<void>(`/lessons/${id}`, { method: "DELETE" }, session.accessToken);
}
export const reorderLessons=(s:AuthSession,ids:number[])=>request<void>("/lessons/reorder",{method:"PATCH",body:JSON.stringify({ids})},s.accessToken);

export function getAdminStats(session: AuthSession) {
  return request<AdminStats>("/admin/dashboard", {}, session.accessToken);
}

export async function getUsers(session: AuthSession, search = "", roleCode = "", status = "") {
  const page = await getUsersPage(session, {search, roleCode, status, page: 0, size: 100});
  return (page.content ?? []) as UserAccount[];
}
export async function getUsersPage(session: AuthSession, filters: {search?: string; roleCode?: string; status?: string; page?: number; size?: number}) {
  const params = new URLSearchParams({ page: String(filters.page ?? 0), size: String(filters.size ?? 20), sort: "fullName,asc" });
  const {search = "", roleCode = "", status = ""} = filters;
  if (search) params.set("search", search);
  if (roleCode) params.set("roleCode", roleCode);
  if (status) params.set("status", status);
  return request<UserPage>(`/users?${params}`, {}, session.accessToken);
}
export async function getAvailableStudents(s:AuthSession,search=""){const p=await request<{content:UserAccount[]}>(`/users/students?search=${encodeURIComponent(search)}`,{},s.accessToken);return p.content}

export function createUser(session: AuthSession, user: UserAccountInput) {
  return request<UserAccount>("/users", { method: "POST", body: JSON.stringify(user) }, session.accessToken);
}

export function updateUser(session: AuthSession, id: number, user: UserAccountInput) {
  return request<UserAccount>(`/users/${id}`, { method: "PUT", body: JSON.stringify(user) }, session.accessToken);
}

export function setUserLocked(session: AuthSession, id: number, locked: boolean) {
  return request<void>(`/users/${id}/${locked ? "lock" : "activate"}`, { method: "PATCH" }, session.accessToken);
}
export const deleteUser=(s:AuthSession,id:number)=>request<void>(`/users/${id}`,{method:"DELETE"},s.accessToken);
export const disableUser=(s:AuthSession,id:number)=>request<void>(`/users/${id}/disable`,{method:"PATCH"},s.accessToken);
export const resetUserPassword=(s:AuthSession,id:number,newPassword:string)=>request<void>(`/users/${id}/reset-password`,{method:"PATCH",body:JSON.stringify({newPassword,confirmPassword:newPassword})},s.accessToken);

export async function uploadUserImport(session: AuthSession, file: File) {
  const presign = await request<components["schemas"]["UserImportPresignResponse"]>("/users/import/presign", {
    method: "POST",
    body: JSON.stringify({fileName: file.name, contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),
  }, session.accessToken);
  if (!presign.uploadUrl || !presign.objectKey) throw new Error("API không trả về URL tải lên");
  const uploaded = await fetch(presign.uploadUrl, {method: "PUT", headers: {"Content-Type": file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}, body: file});
  if (!uploaded.ok) throw new Error(`Tải file lên R2 thất bại (${uploaded.status})`);
  return request<UserImportPreview>("/users/import/preview", {method: "POST", body: JSON.stringify({objectKey: presign.objectKey})}, session.accessToken);
}

export const confirmUserImport=(session:AuthSession,objectKey:string)=>request<UserImportResult>("/users/import/confirm",{method:"POST",body:JSON.stringify({objectKey})},session.accessToken);
export async function downloadUserImportTemplate(session:AuthSession){
 const response=await fetch(`${API_BASE_URL}/api/users/import/template`,{headers:{Authorization:`Bearer ${session.accessToken}`}});
 if(!response.ok)throw new Error("Không thể tải file mẫu");
 const url=URL.createObjectURL(await response.blob());const link=document.createElement("a");link.href=url;link.download="user-import-template.xlsx";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export async function getAuditLogs(session: AuthSession) {
  const page = await request<{ content: AuditLog[] }>("/audit-logs?page=0&size=50&sort=createdAt,desc", {}, session.accessToken);
  return page.content;
}

export const getSubjects=(s:AuthSession)=>request<Subject[]>("/subjects",{},s.accessToken);
export const createSubject=(s:AuthSession,x:Omit<Subject,"id">)=>request<Subject>("/subjects",{method:"POST",body:JSON.stringify(x)},s.accessToken);
export const updateSubject=(s:AuthSession,id:number,x:Omit<Subject,"id">)=>request<Subject>(`/subjects/${id}`,{method:"PUT",body:JSON.stringify(x)},s.accessToken);
export const deleteSubject=(s:AuthSession,id:number)=>request<void>(`/subjects/${id}`,{method:"DELETE"},s.accessToken);
export const getGrades=(s:AuthSession)=>request<Grade[]>("/grades",{},s.accessToken);
export const createGrade=(s:AuthSession,x:Omit<Grade,"id">)=>request<Grade>("/grades",{method:"POST",body:JSON.stringify(x)},s.accessToken);
export const updateGrade=(s:AuthSession,id:number,x:Omit<Grade,"id">)=>request<Grade>(`/grades/${id}`,{method:"PUT",body:JSON.stringify(x)},s.accessToken);
export const deleteGrade=(s:AuthSession,id:number)=>request<void>(`/grades/${id}`,{method:"DELETE"},s.accessToken);

export const getTopics=(s:AuthSession)=>request<Topic[]>("/math/topics",{},s.accessToken);
export const saveTopic=(s:AuthSession,x:Omit<Topic,"id">,id?:number)=>request<Topic>(`/math/topics${id?`/${id}`:""}`,{method:id?"PUT":"POST",body:JSON.stringify(x)},s.accessToken);
export const deleteTopic=(s:AuthSession,id:number)=>request<void>(`/math/topics/${id}`,{method:"DELETE"},s.accessToken);
export const getProblemTypes=(s:AuthSession,topicId:number)=>request<ProblemType[]>(`/math/types?topicId=${topicId}`,{},s.accessToken);
export const saveProblemType=(s:AuthSession,x:Omit<ProblemType,"id">,id?:number)=>request<ProblemType>(`/math/types${id?`/${id}`:""}`,{method:id?"PUT":"POST",body:JSON.stringify(x)},s.accessToken);
export const deleteProblemType=(s:AuthSession,id:number)=>request<void>(`/math/types/${id}`,{method:"DELETE"},s.accessToken);
export const getProblems=(s:AuthSession,typeId:number)=>request<Problem[]>(`/math/problems?problemTypeId=${typeId}`,{},s.accessToken);
export type ProblemInput={problemTypeId:number;publicCode?:string;statementLatex:string;contentHtml?:string;difficulty:string;status:string;problemKind:"PRACTICE"|"EXAM";examPart?:string|null;easierProblemId?:number|null;equivalentProblemId?:number|null;harderProblemId?:number|null};
export const saveProblem=(s:AuthSession,x:ProblemInput,id?:number)=>request<Problem>(`/math/problems${id?`/${id}`:""}`,{method:id?"PUT":"POST",body:JSON.stringify(x)},s.accessToken);
export const deleteProblem=(s:AuthSession,id:number)=>request<void>(`/math/problems/${id}`,{method:"DELETE"},s.accessToken);
export const getHints=(s:AuthSession,id:number)=>request<Hint[]>(`/math/problems/${id}/hints`,{},s.accessToken);
export const saveHint=(s:AuthSession,x:Omit<Hint,"id">,id?:number)=>request<Hint>(`/math/hints${id?`/${id}`:""}`,{method:id?"PUT":"POST",body:JSON.stringify(x)},s.accessToken);
export const deleteHint=(s:AuthSession,id:number)=>request<void>(`/math/hints/${id}`,{method:"DELETE"},s.accessToken);
export const reorderHints=(s:AuthSession,problemId:number,ids:number[])=>request<void>(`/math/problems/${problemId}/hints/reorder`,{method:"PATCH",body:JSON.stringify({ids})},s.accessToken);
export const getSolutions=(s:AuthSession,id:number)=>request<SolutionStep[]>(`/math/problems/${id}/solutions`,{},s.accessToken);
export const saveSolution=(s:AuthSession,x:Omit<SolutionStep,"id">,id?:number)=>request<SolutionStep>(`/math/solutions${id?`/${id}`:""}`,{method:id?"PUT":"POST",body:JSON.stringify(x)},s.accessToken);
export const deleteSolution=(s:AuthSession,id:number)=>request<void>(`/math/solutions/${id}`,{method:"DELETE"},s.accessToken);
export const reorderSolutions=(s:AuthSession,problemId:number,ids:number[])=>request<void>(`/math/problems/${problemId}/solutions/reorder`,{method:"PATCH",body:JSON.stringify({ids})},s.accessToken);
export const getWorksheets=(s:AuthSession)=>request<Worksheet[]>("/worksheets",{},s.accessToken);
export const saveWorksheet=(s:AuthSession,x:{name:string;columnsCount:number;showQr:boolean;showStudentFields:boolean;problemIds:number[]},id?:number)=>request<Worksheet>(`/worksheets${id?`/${id}`:""}`,{method:id?"PUT":"POST",body:JSON.stringify(x)},s.accessToken);
export const attachWorksheetToLesson=(s:AuthSession,worksheetId:number,lessonId:number|null)=>request<Worksheet>(`/worksheets/${worksheetId}/lesson`,{method:"PATCH",body:JSON.stringify({lessonId})},s.accessToken);
export const getMyCourses=(s:AuthSession)=>request<StudentCourse[]>("/student/courses",{},s.accessToken);
export const getMyAssignments=(s:AuthSession)=>request<StudentAssignment[]>("/student/assignments",{},s.accessToken);
export const markAssignment=(s:AuthSession,id:number,completed:boolean)=>request<unknown>(`/assignment-progress/${id}/${completed?"completed":"opened"}`,{method:"PATCH"},s.accessToken);
export const getPublicProblem=(slug:string)=>request<PublicProblem>(`/public/problems/${encodeURIComponent(slug)}`);
export const markProblemProgress=(s:AuthSession,problemId:number,completed:boolean)=>request<{problem_id:number;status:string;opened_at:string;completed_at:string|null}>(`/problem-progress/${problemId}/${completed?"completed":"opened"}`,{method:"PATCH"},s.accessToken);
export async function getClasses(s:AuthSession){const p=await getClassesPage(s,{size:100});return (p.content??[]) as Classroom[]}
export async function getClassesPage(s:AuthSession,f:{search?:string;gradeId?:number;status?:string;page?:number;size?:number}){const p=new URLSearchParams({page:String(f.page??0),size:String(f.size??20),sort:"name,asc"});if(f.search)p.set("search",f.search);if(f.gradeId)p.set("gradeId",String(f.gradeId));if(f.status)p.set("status",f.status);return request<ClassroomPage>(`/classes?${p}`,{},s.accessToken)}
export const createClass=(s:AuthSession,x:ClassroomInput)=>request<Classroom>("/classes",{method:"POST",body:JSON.stringify(x)},s.accessToken);
export const updateClass=(s:AuthSession,id:number,x:ClassroomInput)=>request<Classroom>(`/classes/${id}`,{method:"PUT",body:JSON.stringify(x)},s.accessToken);
export const deleteClass=(s:AuthSession,id:number)=>request<void>(`/classes/${id}`,{method:"DELETE"},s.accessToken);
export const getTeacherStats=(s:AuthSession)=>request<TeacherStats>("/teacher/dashboard",{},s.accessToken);
export const getTeacherClasses=(s:AuthSession)=>request<Classroom[]>("/teacher/classes",{},s.accessToken);
export const getGradebook=(s:AuthSession,classId:number)=>request<GradebookRow[]>(`/teacher/gradebook?classId=${classId}`,{},s.accessToken);
export const getResources=(s:AuthSession,lessonId:number)=>request<LessonResource[]>(`/resources?lessonId=${lessonId}`,{},s.accessToken);
export const saveResource=(s:AuthSession,x:Omit<LessonResource,"id">,id?:number)=>request<LessonResource>(`/resources${id?`/${id}`:""}`,{method:id?"PUT":"POST",body:JSON.stringify(x)},s.accessToken);
export const deleteResource=(s:AuthSession,id:number)=>request<void>(`/resources/${id}`,{method:"DELETE"},s.accessToken);
export const reorderResources=(s:AuthSession,ids:number[])=>request<void>("/resources/reorder",{method:"PATCH",body:JSON.stringify({ids})},s.accessToken);
export async function uploadFile(s:AuthSession,file:File){const form=new FormData();form.append("file",file);const response=await fetch(`${API_BASE_URL}/api/files`,{method:"POST",headers:{Authorization:`Bearer ${s.accessToken}`},body:form});const payload=await response.json() as ApiEnvelope<FileAsset>;if(!response.ok||!payload.success)throw new Error(payload.message||"Tải file thất bại");return payload.data}
export async function downloadFile(s:AuthSession,id:number,title:string){const response=await fetch(`${API_BASE_URL}/api/files/${id}/download`,{headers:{Authorization:`Bearer ${s.accessToken}`}});if(!response.ok)throw new Error(`Không thể tải file (${response.status})`);const blob=await response.blob();if(!blob.size)return;const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=title;a.click();URL.revokeObjectURL(url)}
export const getEnrollments=(s:AuthSession,type:"class-teachers"|"class-students"|"class-courses",classId:number)=>request<Enrollment[]>(`/enrollments/${type}?classId=${classId}`,{},s.accessToken);
export const addEnrollment=(s:AuthSession,type:"class-teachers"|"class-students"|"class-courses",x:{classId:number;userId?:number;courseId?:number})=>request<void>(`/enrollments/${type}`,{method:"POST",body:JSON.stringify(x)},s.accessToken);
export const removeEnrollment=(s:AuthSession,type:"class-teachers"|"class-students"|"class-courses",id:number)=>request<void>(`/enrollments/${type}/${id}`,{method:"DELETE"},s.accessToken);
export const getAssignments=(s:AuthSession,classId:number)=>request<Assignment[]>(`/assignments?classId=${classId}`,{},s.accessToken);
export const saveAssignment=(s:AuthSession,x:{classId:number;lessonId:number|null;worksheetId:number|null;title:string;dueAt:string|null;status:string})=>request<Assignment>("/assignments",{method:"POST",body:JSON.stringify(x)},s.accessToken);
export const getDocuments=(s:AuthSession)=>request<DocumentItem[]>("/documents",{},s.accessToken);
export async function openDocumentFile(s:AuthSession,fileUrl:string,title:string,startPage?:number|null){
 const pageHash=startPage&&startPage>0?`#page=${startPage}`:"";
 if(/^https?:\/\//i.test(fileUrl)){window.open(`${fileUrl}${pageHash}`,"_blank","noreferrer");return}
 const response=await fetch(`${API_BASE_URL}${fileUrl}`,{headers:{Authorization:`Bearer ${s.accessToken}`}});
 if(!response.ok)throw new Error(`Không thể mở tài liệu (${response.status})`);
 const blob=await response.blob();if(!blob.size)return;
 const objectUrl=URL.createObjectURL(blob);const url=`${objectUrl}${pageHash}`;const win=window.open(url,"_blank","noreferrer");
 if(!win){const a=document.createElement("a");a.href=url;a.download=title;a.click()}
 setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
}
export async function openLessonDocumentFile(s:AuthSession,lessonId:number,document:LessonDocument){
 const allowed=await request<DocumentOpen>(`/lessons/${lessonId}/documents/${document.id}/open`,{},s.accessToken);
 return openDocumentFile(s,allowed.fileUrl,allowed.title||document.title,allowed.startPage);
}
export async function uploadDocument(s:AuthSession,x:{title:string;docType:string;audience:string;gradeId?:number|null;file:File}){
 const form=new FormData();form.append("title",x.title);form.append("docType",x.docType);form.append("audience",x.audience);if(x.gradeId)form.append("gradeId",String(x.gradeId));form.append("file",x.file);
 const response=await fetch(`${API_BASE_URL}/api/admin/documents`,{method:"POST",headers:{Authorization:`Bearer ${s.accessToken}`},body:form});
 const payload=await response.json() as ApiEnvelope<DocumentItem>;if(!response.ok||!payload.success)throw new Error(payload.message||"Tải tài liệu thất bại");return payload.data;
}
export const updateDocument=(s:AuthSession,id:number,x:{title:string;docType:string;audience:string;gradeId?:number|null})=>request<DocumentItem>(`/admin/documents/${id}`,{method:"PUT",body:JSON.stringify(x)},s.accessToken);
export const deleteDocument=(s:AuthSession,id:number)=>request<void>(`/admin/documents/${id}`,{method:"DELETE"},s.accessToken);
export const getLessonDocuments=(s:AuthSession,lessonId:number)=>request<LessonDocument[]>(`/lessons/${lessonId}/documents`,{},s.accessToken);
export const getLessonDocumentQuestions=(s:AuthSession,lessonId:number,id:number)=>request<LessonDocumentQuestion[]>(`/lessons/${lessonId}/documents/${id}/questions`,{},s.accessToken);
export const addLessonDocumentQuestion=(s:AuthSession,lessonId:number,id:number,x:{questionText:string;optionA:string;optionB:string;optionC:string;optionD:string;correctOption:string;explanation?:string})=>request<LessonDocumentQuestion>(`/lessons/${lessonId}/documents/${id}/questions`,{method:"POST",body:JSON.stringify(x)},s.accessToken);
export const deleteLessonDocumentQuestion=(s:AuthSession,lessonId:number,id:number,questionId:number)=>request<void>(`/lessons/${lessonId}/documents/${id}/questions/${questionId}`,{method:"DELETE"},s.accessToken);
export const recordLessonDocumentStudy=(s:AuthSession,lessonId:number,id:number,seconds:number)=>request<LessonDocumentProgress>(`/lessons/${lessonId}/documents/${id}/study`,{method:"POST",body:JSON.stringify({seconds})},s.accessToken);
export const submitLessonDocumentQuiz=(s:AuthSession,lessonId:number,id:number,answers:Record<number,string>)=>request<LessonDocumentProgress>(`/lessons/${lessonId}/documents/${id}/quiz-submit`,{method:"POST",body:JSON.stringify({answers})},s.accessToken);
export const attachLessonDocument=(s:AuthSession,lessonId:number,x:{documentId:number;required:boolean;teacherNote:string;startPage?:number|null})=>request<LessonDocument>(`/lessons/${lessonId}/documents`,{method:"POST",body:JSON.stringify(x)},s.accessToken);
export const updateLessonDocument=(s:AuthSession,lessonId:number,id:number,x:{required:boolean;teacherNote:string;startPage?:number|null})=>request<LessonDocument>(`/lessons/${lessonId}/documents/${id}`,{method:"PUT",body:JSON.stringify(x)},s.accessToken);
export const deleteLessonDocument=(s:AuthSession,lessonId:number,id:number)=>request<void>(`/lessons/${lessonId}/documents/${id}`,{method:"DELETE"},s.accessToken);
export const moveLessonDocument=(s:AuthSession,lessonId:number,id:number,direction:"UP"|"DOWN")=>request<LessonDocument>(`/lessons/${lessonId}/documents/${id}/move`,{method:"PATCH",body:JSON.stringify({direction})},s.accessToken);
// ==================== TEXTBOOK (SGK/SBT) ====================
export async function getTextbooks(s:AuthSession,gradeId?:number,subjectId?:number){
 const params=new URLSearchParams();if(gradeId)params.set("gradeId",String(gradeId));if(subjectId)params.set("subjectId",String(subjectId));
 return request<TextbookItem[]>(`/documents/textbooks${params.size?"?"+params:""}`,{},s.accessToken);
}
export async function getTextbook(s:AuthSession,id:number){return request<TextbookDetail>(`/documents/textbooks/${id}`,{},s.accessToken)}
export async function openTextbook(s:AuthSession,id:number,bookPage?:number){
 const params=new URLSearchParams();if(bookPage)params.set("bookPage",String(bookPage));
 return request<TextbookOpen>(`/documents/textbooks/${id}/open${params.size?"?"+params:""}`,{method:"POST"},s.accessToken);
}
export async function openTextbookInBrowser(s:AuthSession,id:number,bookPage?:number){
 const info=await openTextbook(s,id,bookPage);
 const pageHash=info.pdfPage&&info.pdfPage>1?`#page=${info.pdfPage}`:"";
 if(/^https?:\/\//i.test(info.fileUrl)){window.open(`${info.fileUrl}${pageHash}`,"_blank","noreferrer");return}
 const response=await fetch(`${API_BASE_URL}${info.fileUrl}`,{headers:{Authorization:`Bearer ${s.accessToken}`}});
 if(!response.ok)throw new Error(`Không thể mở sách (${response.status})`);
 const blob=await response.blob();if(!blob.size)return;
 const objectUrl=URL.createObjectURL(blob);const url=`${objectUrl}${pageHash}`;const win=window.open(url,"_blank","noreferrer");
 if(!win){const a=document.createElement("a");a.href=url;a.download=info.title;a.click()}
 setTimeout(()=>URL.revokeObjectURL(objectUrl),120000);
}
export async function getAdminTextbooks(s:AuthSession){return request<TextbookItem[]>(`/admin/documents/textbooks`,{},s.accessToken)}
export async function uploadTextbook(s:AuthSession,x:{title:string;docType:string;audience:string;gradeId?:number|null;subjectId?:number|null;basePageOffset?:number;file:File}){
 const form=new FormData();form.append("title",x.title);form.append("docType",x.docType);form.append("audience",x.audience);
 if(x.gradeId)form.append("gradeId",String(x.gradeId));if(x.subjectId)form.append("subjectId",String(x.subjectId));
 if(x.basePageOffset)form.append("basePageOffset",String(x.basePageOffset));form.append("file",x.file);
 const response=await fetch(`${API_BASE_URL}/api/admin/documents/textbooks`,{method:"POST",headers:{Authorization:`Bearer ${s.accessToken}`},body:form});
 const payload=await response.json() as ApiEnvelope<TextbookItem>;if(!response.ok||!payload.success)throw new Error(payload.message||"Upload sách thất bại");return payload.data;
}
export const updateTextbook=(s:AuthSession,id:number,x:{title:string;docType:string;audience:string;gradeId?:number|null;subjectId?:number|null;totalPages?:number|null;basePageOffset?:number})=>request<TextbookItem>(`/admin/documents/textbooks/${id}`,{method:"PUT",body:JSON.stringify(x)},s.accessToken);
export const setTextbookPageOffset=(s:AuthSession,id:number,pdfPageForBookPageOne:number)=>request<TextbookItem>(`/admin/documents/textbooks/${id}/page-offset`,{method:"PATCH",body:JSON.stringify({pdfPageForBookPageOne})},s.accessToken);
export const publishTextbook=(s:AuthSession,id:number)=>request<TextbookItem>(`/admin/documents/textbooks/${id}/publish`,{method:"PATCH"},s.accessToken);
export const hideTextbook=(s:AuthSession,id:number)=>request<TextbookItem>(`/admin/documents/textbooks/${id}/hide`,{method:"PATCH"},s.accessToken);
// ==================== TEXTBOOK MAPPING PROGRESS (resume + history) ====================
export type TextbookMappingProgress = {
  documentId: number;
  pdfPage: number | null;
  pdfAnchor: number | null;
  bookAnchor: number | null;
  zoom: number;
  thumbPage: number;
  updatedAt: string | null;
  exists: boolean;
};
export type TextbookMappingHistoryEntry = {
  id: number;
  pdfPage: number;
  pdfAnchor: number;
  bookAnchor: number;
  action: "GOTO" | "PREV" | "NEXT";
  createdAt: string;
};
export type TextbookMappingHistoryResponse = {
  documentId: number;
  entries: TextbookMappingHistoryEntry[];
  fetchedAt: string;
};

export const getTextbookMappingProgress = (s: AuthSession, documentId: number) =>
  request<TextbookMappingProgress>(`/admin/documents/textbooks/${documentId}/mapping-progress`, {}, s.accessToken);

export const saveTextbookMappingProgress = (
  s: AuthSession,
  documentId: number,
  payload: { pdfPage: number; pdfAnchor: number; bookAnchor: number; zoom: number; thumbPage: number }
) =>
  request<TextbookMappingProgress>(`/admin/documents/textbooks/${documentId}/mapping-progress`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, s.accessToken);

export const getTextbookMappingHistory = (s: AuthSession, documentId: number) =>
  request<TextbookMappingHistoryResponse>(`/admin/documents/textbooks/${documentId}/mapping-progress/history`, {}, s.accessToken);

export const appendTextbookMappingHistory = (
  s: AuthSession,
  documentId: number,
  pdfPage: number,
  pdfAnchor: number,
  bookAnchor: number,
  action: "GOTO" | "PREV" | "NEXT" = "GOTO"
) => {
  const params = new URLSearchParams({
    pdfPage: String(pdfPage),
    pdfAnchor: String(pdfAnchor),
    bookAnchor: String(bookAnchor),
    action,
  });
  return request<TextbookMappingHistoryResponse>(
    `/admin/documents/textbooks/${documentId}/mapping-progress/history?${params}`,
    { method: "POST" },
    s.accessToken
  );
};
