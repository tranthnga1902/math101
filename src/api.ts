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
export type TaxonomyNode = {
  id: number;
  parentId: number | null;
  depth: number;
  title: string;
  description: string | null;
  slug: string;
  orderNo: number;
  proposedBy: number | null;
  status: "ACTIVE" | "PENDING" | "MERGED" | "ARCHIVED";
  mergedInto: number | null;
  questionCountShared: number;
  questionCountPrivate: number;
  documentCount: number;
  worksheetCount: number;
  aliases: { id: number; alias: string }[];
};
export type TaxonomyDuplicateSuggestion = { nodeAId: number; nodeATitle: string; nodeBId: number; nodeBTitle: string; similarity: number };
export type TaxonomyArchiveResult = { node: TaxonomyNode; nodesArchivedCount: number; openAssignmentsAffected: number; questionsKept: number };
export type Problem = { id:number; problemTypeId:number; publicCode:string; qrSlug:string|null; statementLatex:string; contentHtml:string; difficulty:string; status:string; problemKind:"PRACTICE"|"EXAM"; examPart:string|null; easierProblemId:number|null; equivalentProblemId:number|null; harderProblemId:number|null;optionA:string|null;optionB:string|null;optionC:string|null;optionD:string|null;correctOption:string|null };
export type Hint = { id:number; problemId:number; contentLatex:string; orderIndex:number };
export type SolutionStep = { id:number; problemId:number; title:string; contentLatex:string; orderIndex:number };
export type Worksheet = { id:number; name:string; columnsCount:number; showQr:boolean; showStudentFields:boolean; createdBy:number; lessonId:number|null; items:{id:number;problemId:number;orderIndex:number;publicCode:string;qrSlug:string;statementLatex:string;difficulty:string}[] };
export type WorksheetImportIssue={severity:"ERROR"|"WARNING";message:string};
export type WorksheetImportQuestion={questionNo:number;statement:string;optionA:string;optionB:string;optionC:string;optionD:string;correctOption:string|null;answerSource:"BOLD_UNDERLINE"|"ANSWER_TABLE"|"INLINE_MARKER"|"NONE";confidence:number;issues:WorksheetImportIssue[]};
export type WorksheetImportPreview={fileName:string;totalQuestions:number;errorCount:number;warningCount:number;questions:WorksheetImportQuestion[]};
export type StudentCourse={id:number;code:string;name:string;description:string;status:string;chapters:{id:number;title:string;orderIndex:number;lessons:{id:number;title:string;summary:string;contentHtml:string;orderIndex:number;status:string;progressStatus:string;openedAt:string|null;completedAt:string|null;completionPercent:number;locked:boolean;resources:{id:number;type:string;title:string;externalUrl:string;fileAssetId:number|null;textContent:string;orderIndex:number}[];worksheets:{id:number;name:string}[]}[]}[]};
export type PublicProblem={problem:Problem;problemType:ProblemType;hints:Hint[];solutions:SolutionStep[];similar:{relation:"EASIER"|"EQUIVALENT"|"HARDER";problem:Problem}[]};
type GeneratedClassroom=components["schemas"]["ClassroomResponse"];
/** Các trường của module Lớp học khai báo tay vì src/api/types.ts chỉ sinh lại được khi backend đang chạy (npm run gen:api). */
export type Classroom=Required<Pick<GeneratedClassroom,"id"|"code"|"name"|"gradeId"|"status"|"teacherCount"|"studentCount"|"courseCount">>&Pick<GeneratedClassroom,"createdAt"|"updatedAt">&{description?:string|null;createdBy?:number|null;curriculumCount?:number;documentCount?:number};
export type ClassroomInput=components["schemas"]["ClassroomRequest"]&{description?:string|null};
export type ClassroomPage=components["schemas"]["PageClassroomResponse"];
export type TeacherStats={classes:number;studentsBelow50:number;worksheets:number};
export type ClassResult={classId:number;className:string;classCode:string;teacherName:string|null;status:string;diemTb:number;hoanThanh:number;tiLe:number};
export type GradebookRow={student_id:number;full_name:string;username:string;assignment_id:number;title:string;status:string;completion_percent:number};
export type LessonResource={id:number;lessonId:number;type:string;title:string;externalUrl:string;fileAssetId:number|null;textContent:string;orderIndex:number};
export type DocumentItem={id:number;title:string;docType:string;audience:string;fileUrl:string;gradeId:number|null;chapterId:number|null;status:string;subjectId:number|null;totalPages:number|null;basePageOffset:number|null;createdAt:string;thumbnailUrl:string|null;folderId:number|null;contentMarkdown:string|null;taxonomyNodeId:number|null};
export type DocumentFolder={id:number;name:string;documentCount:number;createdAt:string};
export type TextbookItem={id:number;title:string;docType:string;audience:string;gradeId:number|null;subjectId:number|null;status:string;totalPages:number|null;basePageOffset:number;fileUrl:string;thumbnailUrl:string|null;createdAt:string};
export type TextbookDetail={id:number;title:string;docType:string;audience:string;gradeId:number|null;subjectId:number|null;status:string;totalPages:number|null;basePageOffset:number;fileUrl:string;pageMappings:{pdfPage:number;bookPageLabel:string|null;pageType:string;chapterTitle:string|null;lessonTitle:string|null}[]};
export type TextbookOpen={documentId:number;title:string;fileUrl:string;pdfPage:number;totalPages:number|null};
export type LessonDocument={id:number;lessonId:number;documentId:number;title:string;docType:string;audience:string;fileUrl:string;required:boolean;teacherNote:string|null;startPage:number|null;displayOrder:number};
export type DocumentOpen={lessonDocumentId:number;title:string;fileUrl:string;startPage:number|null};
export type LessonDocumentQuestion={id:number;lessonDocumentId:number;questionText:string;optionA:string;optionB:string;optionC:string;optionD:string;correctOption:string|null;explanation:string|null;displayOrder:number};
export type LessonDocumentProgress={id:number;lessonDocumentId:number;studentId:number;status:string;openedAt:string|null;lastOpenedAt:string|null;openCount:number;totalSeconds:number;quizScore:number|null;completedAt:string|null};
export type FileAsset={id:number;fileName:string;fileUrl:string;mimeType:string;fileSize:number};
export type Enrollment={id:number;classId:number;userId:number|null;courseId:number|null;label:string};
/** Trạng thái vòng đời do server tính từ giờ mở / hạn nộp / chính sách muộn — client không tự suy ra. */
export type AssignmentState="DRAFT"|"SCHEDULED"|"OPEN"|"LATE_OPEN"|"CLOSED";
/** REJECT: quá hạn là đóng. ACCEPT: nhận muộn nguyên điểm. PENALTY: nhận muộn nhưng trừ phần trăm. */
export type LatePolicy="REJECT"|"ACCEPT"|"PENALTY";
export type Assignment={id:number;classId:number;lessonId:number|null;worksheetId:number|null;documentId:number|null;title:string;openAt:string|null;dueAt:string|null;status:string;state:AssignmentState;requirement:ClassRequirement;maxAttempts:number;latePolicy:LatePolicy;latePenaltyPercent:number;publishScoreAt:string|null;createdBy:number};
/** Bắt buộc thì vào sổ điểm; tự chọn chỉ tính mức độ tự giác, không trộn vào điểm. */
export type ClassRequirement="BAT_BUOC"|"TU_CHON";
export type ClassCurriculumItem={id:number;taxonomy_node_id:number;order_no:number;note:string|null;created_at:string;title:string;depth:number;slug:string;parent_title:string|null;document_count:number};
export type ClassDocumentItem={id:number;document_id:number;requirement:ClassRequirement;note:string|null;attached_at:string;title:string;doc_type:string;file_url:string;thumbnail_url:string|null;total_pages:number|null;owner_id:number|null;has_markdown:boolean;source:"KHO_CHUNG"|"RIENG";owner_name:string|null;taxonomy_title:string|null;attached_by_name:string|null};
export type ClassLibraryDocument={id:number;title:string;doc_type:string;file_url:string;thumbnail_url:string|null;total_pages:number|null;owner_id:number|null;taxonomy_node_id:number|null;created_at:string;source:"KHO_CHUNG"|"RIENG";taxonomy_title:string|null;attached:boolean};
export type ClassProgressRow={student_id:number;full_name:string;username:string|null;required_total:number;required_submitted:number;required_avg_score:number|null;optional_total:number;optional_submitted:number;last_submitted_at:string|null};
export type SubmissionLogRow={id:number;assignment_id:number;title:string;student_id:number;full_name:string;username:string|null;action:"SUBMITTED"|"GRADED"|"RETURNED";requirement:ClassRequirement;score:number|null;note:string|null;created_at:string;actor_id:number|null;actor_name:string|null};
export type RosterStudent={id:number;student_id:number;joined_at:string;full_name:string;username:string|null;email:string;phone:string|null;status:string};
export type RosterCandidate={id:number;full_name:string;username:string|null;email:string};
export type RosterRowStatus="TAO_MOI"|"CO_SAN"|"DA_TRONG_LOP"|"LOI";
export type RosterImportRow={rowNumber:number;username:string;email:string;fullName:string;phone:string;matchedUserId:number|null;status:RosterRowStatus;errors:string[]};
export type RosterImportPreview={objectKey:string;total:number;newAccounts:number;existingAccounts:number;alreadyInClass:number;invalid:number;rows:RosterImportRow[]};
export type RosterImportResult={created:number;enrolled:number;skipped:number;errors:string[]};
export type MyClass={id:number;code:string;name:string;status:string;description:string|null;grade_name:string|null;teacher_names:string|null;student_count:number;curriculum_count:number;document_count:number;required_total:number;required_submitted:number;required_avg_score:number|null;optional_total:number;optional_submitted:number};
/** Chưa tới giờ mở thì server xoá trắng worksheet/document — chỉ còn cái tên bài. */
export type MyClassTask={id:number;title:string;open_at:string|null;due_at:string|null;status:string;state:AssignmentState;requirement:ClassRequirement;lesson_id:number|null;worksheet_id:number|null;document_id:number|null;worksheet_name:string|null;document_title:string|null;document_file_url:string|null;document_doc_type:string|null;grading_status:string;completion_percent:number;opened_at:string|null;submitted_at:string|null;graded_at:string|null;returned_at:string|null;score:number|null;max_score:number|null;teacher_feedback:string|null;attempts_left:number|null;attempt_no:number;submitted_late:boolean;max_attempts:number;late_policy:LatePolicy;late_penalty_percent:number;publish_score_at:string|null};
export type AdminClassOverviewRow={id:number;code:string;name:string;grade_id:number;status:string;description:string|null;created_at:string;grade_name:string|null;created_by_name:string|null;created_by_role:string|null;teacher_names:string|null;teacher_count:number;student_count:number;course_count:number;curriculum_count:number;document_count:number;required_total:number;optional_total:number;submission_count:number;last_submitted_at:string|null};
/** `attemptsLeft` null nghĩa là không giới hạn lượt nộp. Chưa tới giờ mở thì `items` rỗng. */
export type StudentAssignment={id:number;title:string;openAt:string|null;dueAt:string|null;status:string;state:AssignmentState;lessonId:number|null;worksheetId:number|null;worksheetName:string;progressStatus:string;completionPercent:number;gradingStatus:string;score:number|null;maxScore:number|null;attemptsLeft:number|null;submittedLate:boolean;items:{problemId:number;orderIndex:number;publicCode:string;qrSlug:string;statementLatex:string;difficulty:string;optionA:string|null;optionB:string|null;optionC:string|null;optionD:string|null}[]};
/** `rawScore` là điểm bài làm trước khi trừ muộn; `score` là điểm cuối cùng. */
export type AssignmentResult={assignmentId:number;studentId:number;gradingStatus:string;completionPercent:number;submittedAt:string|null;gradedAt:string|null;returnedAt:string|null;score:number|null;maxScore:number|null;correctCount:number|null;totalQuestions:number|null;teacherFeedback:string|null;answers:Record<number,string>;state:AssignmentState;openAt:string|null;dueAt:string|null;attemptsLeft:number|null;submittedLate:boolean;rawScore:number|null};
export type TeacherSubmission={id:number;assignment_id:number;title:string;student_id:number;full_name:string;username:string;submitted_at:string;graded_at:string|null;returned_at:string|null;score:number|null;max_score:number;correct_count:number|null;total_questions:number|null;teacher_feedback:string|null;grading_status:string;answer_json:string;attempt_no:number;submitted_late:boolean;raw_score:number|null;due_at:string|null;late_policy:LatePolicy;late_penalty_percent:number};
/** `missingAnswerKey` là đề chưa nhập đáp án đúng — khi đó `correct` và `rate` là null, không phải 0. */
export type ItemAnalysis={problemId:number;orderNo:number;publicCode:string|null;correct:number|null;total:number;rate:number|null;warning:boolean;missingAnswerKey:boolean};
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

// Không request nào được phép treo vô thời hạn — nếu không, nút bấm/spinner
// đứng hình mãi khi mạng chậm hoặc backend không phản hồi, khiến UI "cảm giác" bị đơ.
const DEFAULT_TIMEOUT_MS = 20_000; // gọi API JSON thông thường
const FILE_TIMEOUT_MS = 60_000; // tải/mở file (PDF, ảnh…)
const UPLOAD_TIMEOUT_MS = 120_000; // upload file lên server/storage

function isAbortOrTimeout(err: unknown): boolean {
  return err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError");
}

/**
 * Bọc 1 lời gọi fetch bằng timeout; biến lỗi abort/timeout thành thông báo tiếng Việt dễ hiểu.
 * Nếu có `externalSignal` (vd React Query hủy khi component unmount/queryKey đổi), kết hợp cả
 * hai để request vẫn bị hủy đúng lúc mà vẫn giữ giới hạn thời gian chờ.
 */
async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>, externalSignal?: AbortSignal | null): Promise<T> {
  const timeout = AbortSignal.timeout(ms);
  const signal = externalSignal ? AbortSignal.any([timeout, externalSignal]) : timeout;
  try {
    return await run(signal);
  } catch (err) {
    if (isAbortOrTimeout(err) && !externalSignal?.aborted) throw new Error("Yêu cầu quá thời gian chờ, vui lòng thử lại");
    throw err;
  }
}

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
  return withTimeout(DEFAULT_TIMEOUT_MS, async signal => {
    const response = await fetch(`${API_BASE_URL}/api${path}`, {
      ...options,
      signal,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    });
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!response.ok || !payload?.success) throw new Error(payload?.message || `API trả về lỗi ${response.status}`);
    return payload.data;
  }, options.signal);
}

function toSession(tokens: TokenResponse): AuthSession {
  const claims = decodeJwt(tokens.accessToken);
  const role = normalizeRole(tokens.roleCode ?? tokens.role ?? claims.role);
  return { ...tokens, userId: Number(tokens.userId ?? claims.sub), email: tokens.email ?? claims.email, role };
}

export async function login(email: string, password: string): Promise<AuthSession> {
  return toSession(await request<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify({ identifier: email, password }) }));
}

/** Thời điểm access token hết hạn (mili-giây epoch); 0 nghĩa là không đọc được hạn. */
export function accessTokenExpiresAt(token: string): number {
  try {
    const exp = (decodeJwt(token) as { exp?: number }).exp;
    return exp ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/** Đổi refresh token lấy cặp token mới. Máy chủ xoay vòng: token cũ chết ngay sau lượt gọi này. */
export async function refreshSession(session: AuthSession): Promise<AuthSession> {
  return toSession(await request<TokenResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: session.refreshToken ?? "" }),
  }));
}

/**
 * Thu hồi phiên ở phía máy chủ. Không cần access token còn hạn.
 * Nuốt lỗi: mất mạng hay token đã chết thì người dùng vẫn phải đăng xuất được khỏi máy này.
 */
export async function logoutSession(session: AuthSession): Promise<void> {
  try {
    await request<void>("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: session.refreshToken ?? "" }) });
  } catch {
    /* bỏ qua */
  }
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
  const form = new FormData();
  form.append("file", file);
  const response = await withTimeout(UPLOAD_TIMEOUT_MS, signal => fetch(`${API_BASE_URL}/api/users/import/upload`, {
    method: "POST", headers: {Authorization: `Bearer ${session.accessToken}`}, body: form, signal,
  }));
  const payload = await response.json().catch(() => null) as ApiEnvelope<UserImportPreview> | null;
  if (!response.ok || !payload?.success) throw new Error(payload?.message || `Không thể tải file (${response.status})`);
  return payload.data;
}

export const confirmUserImport=(session:AuthSession,objectKey:string)=>request<UserImportResult>("/users/import/confirm",{method:"POST",body:JSON.stringify({objectKey})},session.accessToken);
export async function downloadUserImportTemplate(session:AuthSession){
 const response=await withTimeout(FILE_TIMEOUT_MS, signal=>fetch(`${API_BASE_URL}/api/users/import/template`,{headers:{Authorization:`Bearer ${session.accessToken}`},signal}));
 if(!response.ok)throw new Error("Không thể tải file mẫu");
 const url=URL.createObjectURL(await response.blob());const link=document.createElement("a");link.href=url;link.download="user-import-template.xlsx";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export type AuditLogFilter = {
  actorUserId?: string; actorRole?: string; targetType?: string; targetId?: string; action?: string;
  days?: string; page?: number; size?: number;
};
export type AuditLogPage = { items: AuditLog[]; total: number; page: number; pages: number };

/**
 * Lọc đặt ở máy chủ chứ không ở trình duyệt. Nhật ký nay ghi cả bài giao, chấm điểm, thành viên
 * lớp và tài liệu, nên 50 dòng mới nhất chỉ là vài phút hoạt động — lọc trên tập đó sẽ báo "không
 * có kết quả" cho những việc thật sự đã xảy ra, tức là nói dối người đi tra nhật ký.
 */
export async function getAuditLogs(session: AuthSession, filter: AuditLogFilter = {}): Promise<AuditLogPage> {
  // Không gửi tham số sort: máy chủ đã đặt mặc định "createdAt desc, id desc", và tham số sort của
  // lời gọi sẽ đè lên mặc định đó — gửi "createdAt,desc" là bỏ mất khoá phụ id, khiến những dòng
  // ghi cùng một lúc (chấm lại cả lớp, nhập danh sách) nhảy giữa các trang.
  const size = filter.size ?? 50;
  const params = new URLSearchParams({ page: String(filter.page ?? 0), size: String(size) });
  for (const key of ["actorUserId", "actorRole", "targetType", "targetId", "action", "days"] as const) {
    const value = filter[key];
    if (value) params.set(key, value);
  }
  const page = await request<{ content: AuditLog[]; totalElements?: number; totalPages?: number; number?: number }>(
    `/audit-logs?${params}`, {}, session.accessToken);
  return {
    items: page.content, total: page.totalElements ?? page.content.length,
    page: page.number ?? 0, pages: page.totalPages ?? 1,
  };
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

export const getTaxonomyTree=(s:AuthSession,subject?:string)=>request<TaxonomyNode[]>(`/admin/taxonomy/tree${subject?`?subject=${encodeURIComponent(subject)}`:""}`,{},s.accessToken);
export const createTaxonomyNode=(s:AuthSession,x:{title:string;description?:string|null},parentId?:number)=>request<TaxonomyNode>(`/admin/taxonomy/nodes${parentId?`?parentId=${parentId}`:""}`,{method:"POST",body:JSON.stringify(x)},s.accessToken);
export const updateTaxonomyNode=(s:AuthSession,id:number,x:{title:string;description?:string|null})=>request<TaxonomyNode>(`/admin/taxonomy/nodes/${id}`,{method:"PUT",body:JSON.stringify(x)},s.accessToken);
export const reorderTaxonomyNodes=(s:AuthSession,ids:number[],parentId?:number)=>request<void>(`/admin/taxonomy/reorder${parentId?`?parentId=${parentId}`:""}`,{method:"PATCH",body:JSON.stringify({ids})},s.accessToken);
export const addTaxonomyAlias=(s:AuthSession,nodeId:number,alias:string)=>request<TaxonomyNode>(`/admin/taxonomy/nodes/${nodeId}/aliases`,{method:"POST",body:JSON.stringify({alias})},s.accessToken);
export const removeTaxonomyAlias=(s:AuthSession,nodeId:number,aliasId:number)=>request<TaxonomyNode>(`/admin/taxonomy/nodes/${nodeId}/aliases/${aliasId}`,{method:"DELETE"},s.accessToken);
export const archiveTaxonomyNode=(s:AuthSession,id:number)=>request<TaxonomyArchiveResult>(`/admin/taxonomy/nodes/${id}/archive`,{method:"POST"},s.accessToken);
export const archiveTaxonomyBranch=(s:AuthSession,id:number)=>request<TaxonomyArchiveResult>(`/admin/taxonomy/nodes/${id}/archive-branch`,{method:"POST"},s.accessToken);
export const unarchiveTaxonomyNode=(s:AuthSession,id:number)=>request<TaxonomyNode>(`/admin/taxonomy/nodes/${id}/unarchive`,{method:"POST"},s.accessToken);
export const mergeTaxonomyNodes=(s:AuthSession,sourceId:number,targetId:number)=>request<void>(`/admin/taxonomy/merge`,{method:"POST",body:JSON.stringify({sourceId,targetId})},s.accessToken);
export const moveTaxonomyNode=(s:AuthSession,id:number,newParentId:number|null)=>request<TaxonomyNode>(`/admin/taxonomy/nodes/${id}/move${newParentId?`?newParentId=${newParentId}`:""}`,{method:"PATCH"},s.accessToken);
export const deleteTaxonomyNode=(s:AuthSession,id:number)=>request<void>(`/admin/taxonomy/nodes/${id}`,{method:"DELETE"},s.accessToken);
/** Cây chỉ đọc cho giáo viên — chỉ gồm mục đang hoạt động, không kèm thao tác chỉnh sửa nào. */
export const getTaxonomyTreeReadOnly=(s:AuthSession,subject?:string)=>request<TaxonomyNode[]>(`/taxonomy/tree${subject?`?subject=${encodeURIComponent(subject)}`:""}`,{},s.accessToken);
export const getStudentTaxonomyTree=(s:AuthSession,subject?:string)=>request<TaxonomyNode[]>(`/student/taxonomy${subject?`?subject=${encodeURIComponent(subject)}`:""}`,{},s.accessToken);
export const getTaxonomyDuplicates=(s:AuthSession)=>request<TaxonomyDuplicateSuggestion[]>(`/admin/taxonomy/duplicates`,{},s.accessToken);
export const getTaxonomyHistory=(s:AuthSession,id:number)=>request<AuditLog[]>(`/admin/taxonomy/nodes/${id}/history`,{},s.accessToken);
export const getProblems=(s:AuthSession,typeId:number)=>request<Problem[]>(`/math/problems?problemTypeId=${typeId}`,{},s.accessToken);
export type ProblemInput={problemTypeId:number;publicCode?:string;statementLatex:string;contentHtml?:string;difficulty:string;status:string;problemKind:"PRACTICE"|"EXAM";examPart?:string|null;easierProblemId?:number|null;equivalentProblemId?:number|null;harderProblemId?:number|null;optionA?:string|null;optionB?:string|null;optionC?:string|null;optionD?:string|null;correctOption?:string|null};
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
export async function parseWorksheetDocx(s:AuthSession,file:File){const form=new FormData();form.append("file",file);const response=await withTimeout(UPLOAD_TIMEOUT_MS,signal=>fetch(`${API_BASE_URL}/api/worksheets/import/docx`,{method:"POST",headers:{Authorization:`Bearer ${s.accessToken}`},body:form,signal}));const payload=await response.json().catch(()=>null) as ApiEnvelope<WorksheetImportPreview>|null;if(!response.ok||!payload?.success)throw new Error(payload?.message||`Không thể bóc đề (${response.status})`);return payload.data}
export async function parseWorksheetFile(s:AuthSession,file:File){const extension=file.name.toLowerCase().endsWith(".pdf")?"pdf":"docx";const form=new FormData();form.append("file",file);const response=await withTimeout(UPLOAD_TIMEOUT_MS,signal=>fetch(`${API_BASE_URL}/api/worksheets/import/${extension}`,{method:"POST",headers:{Authorization:`Bearer ${s.accessToken}`},body:form,signal}));const payload=await response.json().catch(()=>null) as ApiEnvelope<WorksheetImportPreview>|null;if(!response.ok||!payload?.success)throw new Error(payload?.message||`Không thể bóc đề (${response.status})`);return payload.data}
export const publishWorksheetImport=(s:AuthSession,input:{name:string;problemTypeId:number;questions:{statement:string;optionA:string;optionB:string;optionC:string;optionD:string;correctOption:string}[]})=>request<Worksheet>("/worksheets/import/publish",{method:"POST",body:JSON.stringify(input)},s.accessToken);
export const getMyCourses=(s:AuthSession)=>request<StudentCourse[]>("/student/courses",{},s.accessToken);
export const getMyAssignments=(s:AuthSession)=>request<StudentAssignment[]>("/student/assignments",{},s.accessToken);
export const markAssignment=(s:AuthSession,id:number,completed:boolean)=>request<unknown>(`/assignment-progress/${id}/${completed?"completed":"opened"}`,{method:"PATCH"},s.accessToken);
export const submitAssignment=(s:AuthSession,id:number,answers:Record<number,string>)=>request<AssignmentResult>(`/assignment-progress/${id}/submit`,{method:"POST",body:JSON.stringify({answers})},s.accessToken);
export const saveAssignmentAnswers=(s:AuthSession,id:number,answers:Record<number,string>)=>request<AssignmentResult>(`/assignment-progress/${id}/answers`,{method:"PUT",body:JSON.stringify({answers})},s.accessToken);
export const getAssignmentResult=(s:AuthSession,id:number)=>request<AssignmentResult>(`/assignment-progress/${id}/result`,{},s.accessToken);
export const getPublicProblem=(slug:string)=>request<PublicProblem>(`/public/problems/${encodeURIComponent(slug)}`);
export const markProblemProgress=(s:AuthSession,problemId:number,completed:boolean)=>request<{problem_id:number;status:string;opened_at:string;completed_at:string|null}>(`/problem-progress/${problemId}/${completed?"completed":"opened"}`,{method:"PATCH"},s.accessToken);
export async function getClasses(s:AuthSession){const p=await getClassesPage(s,{size:100});return (p.content??[]) as Classroom[]}
export async function getClassesPage(s:AuthSession,f:{search?:string;gradeId?:number;status?:string;page?:number;size?:number}){const p=new URLSearchParams({page:String(f.page??0),size:String(f.size??20),sort:"name,asc"});if(f.search)p.set("search",f.search);if(f.gradeId)p.set("gradeId",String(f.gradeId));if(f.status)p.set("status",f.status);return request<ClassroomPage>(`/classes?${p}`,{},s.accessToken)}
export const createClass=(s:AuthSession,x:ClassroomInput)=>request<Classroom>("/classes",{method:"POST",body:JSON.stringify(x)},s.accessToken);
export const updateClass=(s:AuthSession,id:number,x:ClassroomInput)=>request<Classroom>(`/classes/${id}`,{method:"PUT",body:JSON.stringify(x)},s.accessToken);
export const deleteClass=(s:AuthSession,id:number)=>request<void>(`/classes/${id}`,{method:"DELETE"},s.accessToken);
export const getTeacherStats=(s:AuthSession)=>request<TeacherStats>("/teacher/dashboard",{},s.accessToken);
export const getTeacherClasses=(s:AuthSession)=>request<Classroom[]>("/teacher/classes",{},s.accessToken);
export const getClassResults=(s:AuthSession)=>request<ClassResult[]>("/teacher/class-results",{},s.accessToken);
export const getGradebook=(s:AuthSession,classId:number)=>request<GradebookRow[]>(`/teacher/gradebook?classId=${classId}`,{},s.accessToken);
export const getTeacherSubmissions=(s:AuthSession,classId:number)=>request<TeacherSubmission[]>(`/teacher/submissions?classId=${classId}`,{},s.accessToken);
export const gradeSubmission=(s:AuthSession,id:number,score:number,feedback:string)=>request<void>(`/teacher/submissions/${id}/grade`,{method:"PUT",body:JSON.stringify({score,feedback})},s.accessToken);
export const returnSubmission=(s:AuthSession,id:number)=>request<void>(`/teacher/submissions/${id}/return`,{method:"PATCH"},s.accessToken);
export const getItemAnalysis=(s:AuthSession,assignmentId:number)=>request<ItemAnalysis[]>(`/teacher/submissions/assignments/${assignmentId}/analysis`,{},s.accessToken);
export const regradeAssignment=(s:AuthSession,assignmentId:number)=>request<{updated:number}>(`/teacher/submissions/assignments/${assignmentId}/regrade`,{method:"POST"},s.accessToken);
export const getResources=(s:AuthSession,lessonId:number)=>request<LessonResource[]>(`/resources?lessonId=${lessonId}`,{},s.accessToken);
export const saveResource=(s:AuthSession,x:Omit<LessonResource,"id">,id?:number)=>request<LessonResource>(`/resources${id?`/${id}`:""}`,{method:id?"PUT":"POST",body:JSON.stringify(x)},s.accessToken);
export const deleteResource=(s:AuthSession,id:number)=>request<void>(`/resources/${id}`,{method:"DELETE"},s.accessToken);
export const reorderResources=(s:AuthSession,ids:number[])=>request<void>("/resources/reorder",{method:"PATCH",body:JSON.stringify({ids})},s.accessToken);
export async function uploadFile(s:AuthSession,file:File){const form=new FormData();form.append("file",file);const response=await withTimeout(UPLOAD_TIMEOUT_MS,signal=>fetch(`${API_BASE_URL}/api/files`,{method:"POST",headers:{Authorization:`Bearer ${s.accessToken}`},body:form,signal}));const payload=await response.json() as ApiEnvelope<FileAsset>;if(!response.ok||!payload.success)throw new Error(payload.message||"Tải file thất bại");return payload.data}
export async function downloadFile(s:AuthSession,id:number,title:string){const response=await withTimeout(FILE_TIMEOUT_MS,signal=>fetch(`${API_BASE_URL}/api/files/${id}/download`,{headers:{Authorization:`Bearer ${s.accessToken}`},signal}));if(!response.ok)throw new Error(`Không thể tải file (${response.status})`);const blob=await response.blob();if(!blob.size)return;const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=title;a.click();URL.revokeObjectURL(url)}
export const getEnrollments=(s:AuthSession,type:"class-teachers"|"class-students"|"class-courses",classId:number)=>request<Enrollment[]>(`/enrollments/${type}?classId=${classId}`,{},s.accessToken);
export const addEnrollment=(s:AuthSession,type:"class-teachers"|"class-students"|"class-courses",x:{classId:number;userId?:number;courseId?:number})=>request<void>(`/enrollments/${type}`,{method:"POST",body:JSON.stringify(x)},s.accessToken);
export const removeEnrollment=(s:AuthSession,type:"class-teachers"|"class-students"|"class-courses",id:number)=>request<void>(`/enrollments/${type}/${id}`,{method:"DELETE"},s.accessToken);
export const getAssignments=(s:AuthSession,classId:number)=>request<Assignment[]>(`/assignments?classId=${classId}`,{},s.accessToken);
export type AssignmentInput={classId:number;lessonId:number|null;worksheetId:number|null;documentId?:number|null;title:string;openAt?:string|null;dueAt:string|null;status:string;requirement?:ClassRequirement;maxAttempts?:number;latePolicy?:LatePolicy;latePenaltyPercent?:number;publishScoreAt?:string|null};
export const saveAssignment=(s:AuthSession,x:AssignmentInput,id?:number)=>request<Assignment>(`/assignments${id?`/${id}`:""}`,{method:id?"PUT":"POST",body:JSON.stringify(x)},s.accessToken);
export const deleteAssignment=(s:AuthSession,id:number)=>request<void>(`/assignments/${id}`,{method:"DELETE"},s.accessToken);

// ==================== Lớp học: chương trình, tài liệu, theo dõi ====================
export const getClassCurriculum=(s:AuthSession,classId:number)=>request<ClassCurriculumItem[]>(`/classes/${classId}/curriculum`,{},s.accessToken);
export const addClassCurriculum=(s:AuthSession,classId:number,taxonomyNodeId:number,note?:string|null)=>request<void>(`/classes/${classId}/curriculum`,{method:"POST",body:JSON.stringify({taxonomyNodeId,note:note??null})},s.accessToken);
export const removeClassCurriculum=(s:AuthSession,classId:number,id:number)=>request<void>(`/classes/${classId}/curriculum/${id}`,{method:"DELETE"},s.accessToken);
export const getClassDocuments=(s:AuthSession,classId:number)=>request<ClassDocumentItem[]>(`/classes/${classId}/documents`,{},s.accessToken);
export function getClassDocumentLibrary(s:AuthSession,classId:number,f:{search?:string;source?:string;taxonomyNodeId?:number}={}){
 const p=new URLSearchParams();if(f.search)p.set("search",f.search);if(f.source)p.set("source",f.source);if(f.taxonomyNodeId)p.set("taxonomyNodeId",String(f.taxonomyNodeId));
 const query=p.toString();return request<ClassLibraryDocument[]>(`/classes/${classId}/document-library${query?`?${query}`:""}`,{},s.accessToken);
}
export const attachClassDocument=(s:AuthSession,classId:number,x:{documentId:number;requirement:ClassRequirement;note?:string|null})=>request<void>(`/classes/${classId}/documents`,{method:"POST",body:JSON.stringify(x)},s.accessToken);
export const updateClassDocument=(s:AuthSession,classId:number,id:number,x:{requirement?:ClassRequirement;note?:string|null})=>request<void>(`/classes/${classId}/documents/${id}`,{method:"PATCH",body:JSON.stringify(x)},s.accessToken);
export const detachClassDocument=(s:AuthSession,classId:number,id:number)=>request<void>(`/classes/${classId}/documents/${id}`,{method:"DELETE"},s.accessToken);
export const getClassProgress=(s:AuthSession,classId:number)=>request<ClassProgressRow[]>(`/classes/${classId}/progress`,{},s.accessToken);
export function getClassSubmissionLog(s:AuthSession,classId:number,f:{studentId?:number;limit?:number}={}){
 const p=new URLSearchParams();if(f.studentId)p.set("studentId",String(f.studentId));if(f.limit)p.set("limit",String(f.limit));
 const query=p.toString();return request<SubmissionLogRow[]>(`/classes/${classId}/submission-log${query?`?${query}`:""}`,{},s.accessToken);
}

// ==================== Lớp học: danh sách học sinh ====================
export const getClassRoster=(s:AuthSession,classId:number)=>request<RosterStudent[]>(`/classes/${classId}/roster`,{},s.accessToken);
export const getRosterCandidates=(s:AuthSession,classId:number,search:string)=>request<RosterCandidate[]>(`/classes/${classId}/roster/candidates?search=${encodeURIComponent(search)}`,{},s.accessToken);
export const addRosterStudent=(s:AuthSession,classId:number,x:{userId?:number;fullName?:string;username?:string;email?:string;phone?:string;password?:string})=>request<number>(`/classes/${classId}/roster/students`,{method:"POST",body:JSON.stringify(x)},s.accessToken);
export const removeRosterStudent=(s:AuthSession,classId:number,enrollmentId:number)=>request<void>(`/classes/${classId}/roster/students/${enrollmentId}`,{method:"DELETE"},s.accessToken);
export async function uploadClassRoster(s:AuthSession,classId:number,file:File){
 const contentType=file.type||"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
 const presign=await request<{uploadUrl:string;objectKey:string}>(`/classes/${classId}/roster/import/presign`,{method:"POST",body:JSON.stringify({fileName:file.name,contentType})},s.accessToken);
 if(!presign.uploadUrl||!presign.objectKey)throw new Error("API không trả về URL tải lên");
 const uploaded=await withTimeout(UPLOAD_TIMEOUT_MS,signal=>fetch(presign.uploadUrl,{method:"PUT",headers:{"Content-Type":contentType},body:file,signal}));
 if(!uploaded.ok)throw new Error(`Tải file lên R2 thất bại (${uploaded.status})`);
 return request<RosterImportPreview>(`/classes/${classId}/roster/import/preview`,{method:"POST",body:JSON.stringify({objectKey:presign.objectKey})},s.accessToken);
}
export const confirmClassRoster=(s:AuthSession,classId:number,objectKey:string)=>request<RosterImportResult>(`/classes/${classId}/roster/import/confirm`,{method:"POST",body:JSON.stringify({objectKey})},s.accessToken);
export async function downloadRosterTemplate(s:AuthSession,classId:number){
 const response=await withTimeout(FILE_TIMEOUT_MS,signal=>fetch(`${API_BASE_URL}/api/classes/${classId}/roster/import/template`,{headers:{Authorization:`Bearer ${s.accessToken}`},signal}));
 if(!response.ok)throw new Error("Không thể tải file mẫu");
 const url=URL.createObjectURL(await response.blob());const link=document.createElement("a");link.href=url;link.download="danh-sach-hoc-sinh.xlsx";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

// ==================== Lớp học: học sinh xem lớp của mình ====================
export const getMyClasses=(s:AuthSession)=>request<MyClass[]>("/student/classes",{},s.accessToken);
export const getMyClassTasks=(s:AuthSession,classId:number)=>request<MyClassTask[]>(`/student/classes/${classId}/tasks`,{},s.accessToken);
export const getMyClassSubmissionLog=(s:AuthSession,classId:number,limit=100)=>request<SubmissionLogRow[]>(`/student/classes/${classId}/submission-log?limit=${limit}`,{},s.accessToken);

// ==================== Lớp học: Admin xem lớp theo giáo viên phụ trách ====================
export function getAdminClassOverview(s:AuthSession,f:{search?:string;gradeId?:number;status?:string}={}){
 const p=new URLSearchParams();if(f.search)p.set("search",f.search);if(f.gradeId)p.set("gradeId",String(f.gradeId));if(f.status)p.set("status",f.status);
 const query=p.toString();return request<AdminClassOverviewRow[]>(`/admin/class-overview${query?`?${query}`:""}`,{},s.accessToken);
}

// ==================== Vị trí học gần nhất (nền cho nút "Học tiếp") ====================
/** Lưu ở server chứ không phải localStorage, để đổi máy vẫn học tiếp được. */
export type LastPosition={userId:number;route:string;context:Record<string,unknown>|null;updatedAt:string};
export const getLastPosition=(s:AuthSession)=>request<LastPosition|null>("/me/last-position",{},s.accessToken);
export const saveLastPosition=(s:AuthSession,route:string,context:Record<string,unknown>)=>request<void>("/me/last-position",{method:"PUT",body:JSON.stringify({route,context})},s.accessToken);

export const getDocuments=(s:AuthSession)=>request<DocumentItem[]>("/documents",{},s.accessToken);
export const getStudentDocuments=(s:AuthSession)=>request<DocumentItem[]>("/documents/student",{},s.accessToken);
export const getStudentExamDocuments=(s:AuthSession)=>request<DocumentItem[]>("/documents/student/exams",{},s.accessToken);
export const convertDocumentToMarkdown=(s:AuthSession,id:number)=>request<DocumentItem>(`/admin/documents/${id}/convert-markdown`,{method:"POST"},s.accessToken);
export const saveDocumentMarkdown=(s:AuthSession,id:number,contentMarkdown:string)=>request<DocumentItem>(`/admin/documents/${id}/markdown`,{method:"PATCH",body:JSON.stringify({contentMarkdown})},s.accessToken);
export const getDocumentsByNode=(s:AuthSession,nodeId:number)=>request<DocumentItem[]>(`/admin/documents/by-node/${nodeId}`,{},s.accessToken);
export const setDocumentTaxonomyNode=(s:AuthSession,id:number,taxonomyNodeId:number|null)=>request<DocumentItem>(`/admin/documents/${id}/taxonomy-node`,{method:"PATCH",body:JSON.stringify({taxonomyNodeId})},s.accessToken);
export const getTeacherDocuments=(s:AuthSession)=>request<DocumentItem[]>("/teacher/documents",{},s.accessToken);
/**
 * Mở file tài liệu. fileUrl từ API luôn là đường dẫn tương đối tới endpoint có xác thực
 * (/api/documents/{id}/content.pdf) nên phải fetch kèm token rồi mới mở blob — mở thẳng
 * URL là mất header Authorization, và đó chính là chỗ trước đây bỏ qua kiểm quyền.
 * Chỉ VIDEO mới còn là URL tuyệt đối (link ngoài), mở thẳng được.
 */
export async function openDocumentFile(s:AuthSession,fileUrl:string,title:string,startPage?:number|null){
 const pageHash=startPage&&startPage>0?`#page=${startPage}`:"";
 if(/^https?:\/\//i.test(fileUrl)){window.open(`${fileUrl}${pageHash}`,"_blank","noreferrer");return}
 const response=await withTimeout(FILE_TIMEOUT_MS,signal=>fetch(`${API_BASE_URL}${fileUrl}`,{headers:{Authorization:`Bearer ${s.accessToken}`},signal}));
 if(!response.ok)throw new Error(`Không thể mở tài liệu (${response.status})`);
 const blob=await response.blob();if(!blob.size)return;
 const objectUrl=URL.createObjectURL(blob);const url=`${objectUrl}${pageHash}`;const win=window.open(url,"_blank","noreferrer");
 if(!win){const a=document.createElement("a");a.href=url;a.download=title;a.click()}
 setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
}
/** URL byte PDF cho trình xem trong app (PdfViewer tự fetch kèm Authorization). */
export const documentContentUrl=(id:number)=>`${API_BASE_URL}/api/documents/${id}/content`;
export const lessonDocumentContentUrl=(lessonId:number,id:number)=>`${API_BASE_URL}/api/lessons/${lessonId}/documents/${id}/content`;
export async function openLessonDocumentFile(s:AuthSession,lessonId:number,document:LessonDocument){
 const allowed=await request<DocumentOpen>(`/lessons/${lessonId}/documents/${document.id}/open`,{},s.accessToken);
 return openDocumentFile(s,allowed.fileUrl,allowed.title||document.title,allowed.startPage);
}
export async function uploadDocument(s:AuthSession,x:{title:string;docType:string;audience:string;gradeId?:number|null;taxonomyNodeId?:number|null;file?:File|null;videoUrl?:string|null}){
 const form=new FormData();form.append("title",x.title);form.append("docType",x.docType);form.append("audience",x.audience);if(x.gradeId)form.append("gradeId",String(x.gradeId));if(x.taxonomyNodeId)form.append("taxonomyNodeId",String(x.taxonomyNodeId));if(x.file)form.append("file",x.file);if(x.videoUrl)form.append("videoUrl",x.videoUrl);
 const response=await withTimeout(UPLOAD_TIMEOUT_MS,signal=>fetch(`${API_BASE_URL}/api/admin/documents`,{method:"POST",headers:{Authorization:`Bearer ${s.accessToken}`},body:form,signal}));
 const payload=await response.json() as ApiEnvelope<DocumentItem>;if(!response.ok||!payload.success)throw new Error(payload.message||"Tải tài liệu thất bại");return payload.data;
}
export async function uploadTeacherDocument(s:AuthSession,x:{title:string;docType:string;audience:string;gradeId?:number|null;chapterId?:number|null;file?:File|null;videoUrl?:string|null}){
 const form=new FormData();form.append("title",x.title);form.append("docType",x.docType);form.append("audience",x.audience);if(x.gradeId)form.append("gradeId",String(x.gradeId));if(x.chapterId)form.append("chapterId",String(x.chapterId));if(x.file)form.append("file",x.file);if(x.videoUrl)form.append("videoUrl",x.videoUrl);
 const response=await withTimeout(UPLOAD_TIMEOUT_MS,signal=>fetch(`${API_BASE_URL}/api/teacher/documents`,{method:"POST",headers:{Authorization:`Bearer ${s.accessToken}`},body:form,signal}));
 const payload=await response.json() as ApiEnvelope<DocumentItem>;if(!response.ok||!payload.success)throw new Error(payload.message||"Tải tài liệu thất bại");return payload.data;
}
export const updateTeacherDocument=(s:AuthSession,id:number,x:{title:string;docType:string;audience:string;gradeId?:number|null;chapterId?:number|null})=>request<DocumentItem>(`/teacher/documents/${id}`,{method:"PUT",body:JSON.stringify(x)},s.accessToken);
export const archiveTeacherDocument=(s:AuthSession,id:number)=>request<DocumentItem>(`/teacher/documents/${id}/archive`,{method:"PATCH"},s.accessToken);
export const restoreTeacherDocument=(s:AuthSession,id:number)=>request<DocumentItem>(`/teacher/documents/${id}/restore`,{method:"PATCH"},s.accessToken);
export const getTeacherDocumentFolders=(s:AuthSession)=>request<DocumentFolder[]>("/teacher/document-folders",{},s.accessToken);
export const createTeacherDocumentFolder=(s:AuthSession,name:string)=>request<DocumentFolder>("/teacher/document-folders",{method:"POST",body:JSON.stringify({name})},s.accessToken);
export const renameTeacherDocumentFolder=(s:AuthSession,id:number,name:string)=>request<DocumentFolder>(`/teacher/document-folders/${id}`,{method:"PUT",body:JSON.stringify({name})},s.accessToken);
export const deleteTeacherDocumentFolder=(s:AuthSession,id:number)=>request<void>(`/teacher/document-folders/${id}`,{method:"DELETE"},s.accessToken);
export const moveTeacherDocument=(s:AuthSession,documentId:number,folderId:number|null)=>request<void>(`/teacher/document-folders/documents/${documentId}`,{method:"PATCH",body:JSON.stringify({folderId})},s.accessToken);
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
 const response=await withTimeout(FILE_TIMEOUT_MS,signal=>fetch(`${API_BASE_URL}${info.fileUrl}`,{headers:{Authorization:`Bearer ${s.accessToken}`},signal}));
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
 const response=await withTimeout(UPLOAD_TIMEOUT_MS,signal=>fetch(`${API_BASE_URL}/api/admin/documents/textbooks`,{method:"POST",headers:{Authorization:`Bearer ${s.accessToken}`},body:form,signal}));
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
