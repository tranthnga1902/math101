import type { components } from "./api/types";

export type CourseClassLink={id:number;name:string;code:string;status:string;start_date:string|null;student_count:number};
export const getCourseClasses=(s:AuthSession,id:number)=>request<CourseClassLink[]>(`/admin/course-instances/${id}/delivery-sessions/classes`,{},s.accessToken);

import { openDocumentViewer } from "./components/documentViewerStore";
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
/**
 * Khung "Ä‘ang há»c" cÃ³ hai hÃ¬nh dáº¡ng: cÃ³ chÆ°Æ¡ng, hoáº·c chá»‰ cÃ³ ká»³ nghá»‰ â€” khÃ³a Ä‘ang nghá»‰ mÃ  lá»‹ch khÃ´ng
 * xáº¿p chÆ°Æ¡ng nÃ o cho khoáº£ng Ä‘Ã³. NÃªn cÃ¡c trÆ°á»ng chÆ°Æ¡ng pháº£i lÃ  nullable: khai chÃºng lÃ  number thÃ¬
 * mÃ¹ng ba Táº¿t mÃ n hÃ¬nh in "ChÆ°Æ¡ng null" mÃ  TypeScript khÃ´ng hÃ© rÄƒng cÃ¢u nÃ o.
 *
 * `current` lÃ  "hÃ´m nay Ä‘ang há»c chÆ°Æ¡ng nÃ y" nÃªn trong ká»³ nghá»‰ luÃ´n false; `onBreak` nÃ³i vÃ¬ sao
 * false, Ä‘á»ƒ mÃ n hÃ¬nh phÃ¢n biá»‡t Ä‘Æ°á»£c ngÃ y nghá»‰ vá»›i khÃ³a chÆ°a xáº¿p lá»‹ch.
 */
export type ProgramSchedule = {
  id: number | null; courseId: number | null; courseCode: string | null; courseName: string | null;
  chapterId: number | null; chapterTitle: string | null; chapterOrder: number | null;
  startsOn: string | null; endsOn: string | null; status: "ACTIVE" | "INACTIVE" | null; current: boolean;
  onBreak: boolean; breakReason: string | null; breakEndsOn: string | null;
};
export type ProgramChapterTime = { chapter_id:number; title:string; order_index:number; starts_on:string|null; ends_on:string|null; time_group:"CURRENT"|"UPCOMING"|"PAST" };
// TÃªn dáº£i do cÃ¢u truy váº¥n Ä‘áº·t, khÃ´ng pháº£i do mÃ n hÃ¬nh suy ra: thá»© tá»± hiá»ƒn thá»‹ vÃ  tÃªn dáº£i pháº£i
// cÃ¹ng má»™t nguá»“n, khÃ´ng thÃ¬ hai bÃªn trÃ´i khá»i nhau mÃ  cháº³ng ai bÃ¡o.
export type ProgramBand = "TUAN_NAY"|"SAP_TOI"|"TUONG_LAI"|"LUON_HIEN"|"DA_HOC";
export type ProgramResource = { id:number; lesson_id:number|null; noi_den_loai:"HE_THONG"|"MACH"|"BAI"|"TIET"|"CHUYEN_DE"; neo:number|null; lop_id:number|null; exercise_type_id:number|null; resource_type:"VIDEO"|"DOCUMENT"|"EXERCISE"|"SPECIAL_TOPIC"; resource_ref_id:number; title:string; order_index:number; status:string; audience:string; tuan:number|null; dai:ProgramBand; chapter_id:number|null; chapter_title:string|null; chapter_order:number|null; video_url?:string|null; thumbnail_url?:string|null; duration_seconds?:number|null; file_url?:string|null; doc_type?:string|null };
export type SharedTeacherResource={id:number;owner_teacher_id:number;lesson_id:number|null;exercise_type_id:number|null;resource_type:string;title:string;description:string|null;external_url:string|null;teacher_name:string;class_name:string;available_from:string|null;available_until:string|null};
export type SourceDocument={id:number;title:string;file_type:"PDF"|"DOCX"|"TEX"|"TXT";original_filename:string;status:string;failure_reason:string|null;question_count:number;page_count:number;quality_label:string;warning_count:number;pipeline_stage:string;created_at:string};
export type MathFragment={id:number;raw_value:string;latex_value:string;ast_json:unknown;order_index:number;status:string;confidence:number;review_decision:string};
export type ExtractedQuestion={id:number;source_document_id:number;start_block_id:number;end_block_id:number;source_start:number;source_end:number;question_type:string;question_text:string;option_a:string|null;option_b:string|null;option_c:string|null;option_d:string|null;answer_text:string|null;solution_text:string|null;confidence:number;status:"DETECTED"|"REVIEWED"|"REJECTED";transform_level:"LEVEL_0"|"LEVEL_1"|"LEVEL_2"|"LEVEL_3";math_signature:string;signature_confidence:number;question_intent:string;intent_confidence:number;math_parse_valid:boolean;structure_valid:boolean;transformable:boolean;transform_block_reason:string|null;math_fragments:MathFragment[]};
export type DocumentBlock={id:number;block_type:string;raw_content:string;normalized_content:string;order_index:number;page_number:number};
export type ParsingQuality={status:string;pages:number;blocks:number;questions:number;mathQuestions:number;answeredQuestions:number;textCoverage:number;questionConfidence:number;mathConfidence:number;warnings:number;label:string;stage:string;parser:string};
export type QuestionVariant={id:number;source_question_id:number;transformation_type:string;content:string;answer:string|null;solution:string|null;options_json:Record<string,string>;rule_code:string|null;validation_status:"VALID"|"INVALID"|"REVIEW_REQUIRED";teacher_accepted:boolean};
export type BatchTransformResult={selected:number;succeeded:number;failed:number;variants:QuestionVariant[];failures:Array<{questionId:number;reason:string}>};
export type PipelineWorksheet={id:number;name:string;status:string;worksheet_version_id:number;version_no:number;version_status:string;item_count:number};
export type Lesson = { id: number; chapterId: number; title: string; publicCode: string; summary: string; contentHtml: string; orderIndex: number; status: string };
export type LessonInput = Omit<Lesson, "id">;
type GeneratedUser = components["schemas"]["UserResponse"];
export type UserAccount = Required<Pick<GeneratedUser, "id" | "username" | "email" | "fullName" | "roleCode" | "status">> & Pick<GeneratedUser, "phone" | "createdAt" | "updatedAt">;
export type UserAccountInput = components["schemas"]["UserRequest"];
export type UserPage = components["schemas"]["PageUserResponse"];
export type UserImportPreview = components["schemas"]["UserImportPreviewResponse"];
export type UserImportResult = components["schemas"]["UserImportResult"];
export type MyProfile={id:number;code:string;username:string;email:string;fullName:string;phone:string|null;roleCode:string;status:string;createdAt:string|null;lastLoginAt:string|null;dateOfBirth:string|null;gender:string|null;address:string|null;avatarUrl:string|null;grade:number|null;classes:string[];academicYear:string|null;subject:string|null;permissionGroup:string|null;department:string|null};
export type AdminStats = { totalUsers: number; teachers: number; students: number; classes: number; courses: number; publishedCourses: number; publishedProblems: number };
export type AdminCalendarEvent={kind:"EXAM"|"ASSIGNMENT_DUE"|"COURSE_START"|"COURSE_END";source_id:number;event_date:string;event_at:string;title:string;class_name:string|null;priority:number};
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
/**
 * `status` lÃ  DRAFT hay PUBLISHED: chá»‰ phiáº¿u Ä‘Ã£ phÃ¡t hÃ nh má»›i giao Ä‘Æ°á»£c. `contentSnapshot` khÃ¡c
 * rá»—ng nghÄ©a lÃ  cÃ¢u do xÆ°á»Ÿng ná»™i dung dá»±ng nÃªn vÃ  sá»­a háº¹p Ä‘Æ°á»£c ngay trÃªn phiáº¿u Ä‘Ã£ phÃ¡t hÃ nh.
 */
export type WorksheetItem = { id:number; problemId:number; orderIndex:number; publicCode:string; qrSlug:string; statementLatex:string; difficulty:string; contentSnapshot:string|null; answerSnapshot:string|null };
export type Worksheet = { id:number; name:string; columnsCount:number; showQr:boolean; showStudentFields:boolean; createdBy:number; lessonId:number|null; status:string; items:WorksheetItem[] };
export type WorksheetImportIssue={severity:"ERROR"|"WARNING";message:string};
export type WorksheetImportQuestion={questionNo:number;statement:string;optionA:string;optionB:string;optionC:string;optionD:string;correctOption:string|null;answerSource:"BOLD_UNDERLINE"|"ANSWER_TABLE"|"INLINE_MARKER"|"NONE";confidence:number;issues:WorksheetImportIssue[]};
export type WorksheetImportPreview={fileName:string;totalQuestions:number;errorCount:number;warningCount:number;questions:WorksheetImportQuestion[]};
export type StudentCourse={id:number;code:string;name:string;description:string;status:string;chapters:{id:number;title:string;orderIndex:number;lessons:{id:number;title:string;summary:string;contentHtml:string;orderIndex:number;status:string;progressStatus:string;openedAt:string|null;completedAt:string|null;completionPercent:number;locked:boolean;resources:{id:number;type:string;title:string;externalUrl:string;fileAssetId:number|null;textContent:string;orderIndex:number}[];worksheets:{id:number;name:string}[]}[]}[]};
export type PublicProblem={problem:Problem;problemType:ProblemType;hints:Hint[];solutions:SolutionStep[];similar:{relation:"EASIER"|"EQUIVALENT"|"HARDER";problem:Problem}[]};
type GeneratedClassroom=components["schemas"]["ClassroomResponse"];
/** CÃ¡c trÆ°á»ng cá»§a module Lá»›p há»c khai bÃ¡o tay vÃ¬ src/api/types.ts chá»‰ sinh láº¡i Ä‘Æ°á»£c khi backend Ä‘ang cháº¡y (npm run gen:api). */
export type Classroom=Required<Pick<GeneratedClassroom,"id"|"code"|"name"|"gradeId"|"status"|"teacherCount"|"studentCount"|"courseCount">>&Pick<GeneratedClassroom,"createdAt"|"updatedAt">&{description?:string|null;createdBy?:number|null;curriculumCount?:number;documentCount?:number;startDate?:string|null};
export type ClassroomInput=Omit<components["schemas"]["ClassroomRequest"],"status">&{status:string;description?:string|null;startDate?:string|null};
export type ClassroomPage=components["schemas"]["PageClassroomResponse"];
export type TeacherStats={classes:number;studentsBelow50:number;worksheets:number};
export type ClassResult={classId:number;className:string;classCode:string;teacherName:string|null;status:string;diemTb:number;hoanThanh:number;tiLe:number};
export type GradebookRow={student_id:number;full_name:string;username:string;assignment_id:number;title:string;assignment_status:string;due_at:string|null;progress_id:number|null;status:string;completion_percent:number;score:number|null;max_score:number|null;grading_status:string;submitted_at:string|null;returned_at:string|null;graded_items:number};
/** Bá»‘n nhÃ³m ná»™i dung â€” trÃ¹ng Ä‘Ãºng danh sÃ¡ch trong rÃ ng buá»™c CHECK cá»§a CSDL. */
export type ContentGroup="THEORY"|"PRACTICE"|"ASSESSMENT"|"REFERENCE";
/** null nghÄ©a lÃ  chÆ°a ai phÃ¢n loáº¡i, khÃ´ng pháº£i "Tham kháº£o" â€” Ä‘á»«ng hiá»ƒn thá»‹ thay báº±ng nhÃ³m máº·c Ä‘á»‹nh. */
export type DocumentItem={id:number;title:string;docType:string;audience:string;fileUrl:string;gradeId:number|null;chapterId:number|null;status:string;subjectId:number|null;totalPages:number|null;basePageOffset:number|null;createdAt:string;thumbnailUrl:string|null;folderId:number|null;contentMarkdown:string|null;taxonomyNodeId:number|null;contentGroup:ContentGroup|null;fileFormat:FileFormat|null};
/** "Mở bằng gì" — khác docType ("ấn phẩm gì"). Null với tài liệu cũ không đoán được đuôi. */
export type FileFormat="WORD"|"EXCEL"|"POWERPOINT"|"PDF"|"VIDEO"|"SCORM"|"XAPI";
export type ContentGroupCounts={theoNhom:Record<ContentGroup,number>;chuaPhanLoai:number};
export type DocumentFolder={id:number;name:string;documentCount:number;createdAt:string};
export type TextbookItem={id:number;title:string;docType:string;audience:string;gradeId:number|null;subjectId:number|null;status:string;totalPages:number|null;basePageOffset:number;fileUrl:string;thumbnailUrl:string|null;createdAt:string};
export type TextbookDetail={id:number;title:string;docType:string;audience:string;gradeId:number|null;subjectId:number|null;status:string;totalPages:number|null;basePageOffset:number;fileUrl:string;pageMappings:{pdfPage:number;bookPageLabel:string|null;pageType:string;chapterTitle:string|null;lessonTitle:string|null}[]};
export type TextbookOpen={documentId:number;title:string;fileUrl:string;pdfPage:number;totalPages:number|null};
export type LessonDocument={id:number;lessonId:number;documentId:number;title:string;docType:string;audience:string;fileUrl:string;required:boolean;teacherNote:string|null;startPage:number|null;displayOrder:number;thumbnailUrl?:string|null};
export type DocumentOpen={lessonDocumentId:number;title:string;fileUrl:string;startPage:number|null};
export type LessonDocumentQuestion={id:number;lessonDocumentId:number;questionText:string;optionA:string;optionB:string;optionC:string;optionD:string;correctOption:string|null;explanation:string|null;displayOrder:number};
export type LessonDocumentProgress={id:number;lessonDocumentId:number;studentId:number;status:string;openedAt:string|null;lastOpenedAt:string|null;openCount:number;totalSeconds:number;quizScore:number|null;completedAt:string|null};
export type FileAsset={id:number;fileName:string;fileUrl:string;mimeType:string;fileSize:number};
export type Enrollment={id:number;classId:number;userId:number|null;courseInstanceId:number|null;label:string;avatarUrl?:string|null;username?:string|null;status?:string|null};
/** KhÃ³a: láº§n triá»ƒn khai má»™t chÆ°Æ¡ng trÃ¬nh trong má»™t nÄƒm há»c. Lá»‹ch dáº¡y náº±m á»Ÿ Ä‘Ã¢y, lá»›p gáº¯n vÃ o Ä‘Ã¢y. */
export type CourseInstance={id:number;template_id:number;name:string;school_year:string;starts_on:string;ends_on:string;status:string;template_name:string};
/** Tráº¡ng thÃ¡i vÃ²ng Ä‘á»i do server tÃ­nh tá»« giá» má»Ÿ / háº¡n ná»™p / chÃ­nh sÃ¡ch muá»™n â€” client khÃ´ng tá»± suy ra. */
export type AssignmentState="DRAFT"|"SCHEDULED"|"OPEN"|"LATE_OPEN"|"CLOSED";
/** REJECT: quÃ¡ háº¡n lÃ  Ä‘Ã³ng. ACCEPT: nháº­n muá»™n nguyÃªn Ä‘iá»ƒm. PENALTY: nháº­n muá»™n nhÆ°ng trá»« pháº§n trÄƒm. */
export type LatePolicy="REJECT"|"ACCEPT"|"PENALTY";
export type TaskKind="BAI_TAP"|"BAI_KIEM_TRA"|"LUYEN_TU_DO";
export type AnswerReveal="AFTER_SUBMIT"|"AFTER_RETURN"|"IMMEDIATE";
/**
 * `dueAt` rá»—ng mÃ  `anchorPeriodId` cÃ³ nghÄ©a lÃ  chÆ°a suy ra Ä‘Æ°á»£c háº¡n â€” khi Ä‘Ã³ `dueReason` nÃ³i vÃ¬ sao,
 * vÃ  mÃ n hÃ¬nh pháº£i in Ä‘Ãºng cÃ¢u áº¥y chá»© khÃ´ng Ä‘Æ°á»£c Ä‘oÃ¡n má»™t ngÃ y.
 */
export type Assignment={id:number;classId:number;lessonId:number|null;worksheetId:number|null;documentId:number|null;title:string;openAt:string|null;dueAt:string|null;status:string;state:AssignmentState;requirement:ClassRequirement;maxAttempts:number;latePolicy:LatePolicy;latePenaltyPercent:number;publishScoreAt:string|null;createdBy:number;anchorPeriodId:number|null;anchorPeriodLabel:string|null;dueBufferMinutes:number|null;dueReason:string|null;taskKind:TaskKind;answerReveal:AnswerReveal;countsInGradebook:boolean;targetScope:"CLASS"|"SELECTED";studentIds:number[]};
/** Báº¯t buá»™c thÃ¬ vÃ o sá»• Ä‘iá»ƒm; tá»± chá»n chá»‰ tÃ­nh má»©c Ä‘á»™ tá»± giÃ¡c, khÃ´ng trá»™n vÃ o Ä‘iá»ƒm. */
export type ClassRequirement="BAT_BUOC"|"TU_CHON";
export type ClassProgramResource={id:number;resourceType:"DOCUMENT"|"VIDEO";resourceRefId:number;title:string;docType?:string|null;audience?:string|null;status?:string|null;fileUrl?:string|null;required?:boolean;startPage?:number|null;teacherNote?:string|null;totalPages?:number|null;isClassSpecific?:boolean};
export type ClassProgramLesson={id:number;chapterId:number;courseId:number;title:string;orderIndex:number;status?:string|null;totalPeriods?:number|null;lessonKind?:string|null;documents:ClassProgramResource[]};
export type ClassProgramChapter={id:number;courseId:number;title:string;orderIndex:number;status?:string|null;lessons:ClassProgramLesson[]};
export type ClassProgramCourse={courseInstanceId:number;courseInstanceName:string;schoolYear?:string|null;instanceStatus?:string|null;programId:number;programName:string;programCode?:string|null;templateId?:number|null;templateName?:string|null;totalChapters:number;totalLessons:number;totalDocuments:number;chapters:ClassProgramChapter[];commonDocuments:ClassProgramResource[]};
export type ClassProgramCurriculumResponse={classId:number;courses:ClassProgramCourse[]};
export type ClassCurriculumItem={id:number;taxonomy_node_id:number;order_no:number;note:string|null;created_at:string;title:string;depth:number;slug:string;parent_title:string|null;document_count:number};
export type ClassDocumentItem={id:number;document_id:number;requirement:ClassRequirement;note:string|null;attached_at:string;title:string;doc_type:string;file_url:string;thumbnail_url:string|null;total_pages:number|null;owner_id:number|null;has_markdown:boolean;source:"KHO_CHUNG"|"RIENG";owner_name:string|null;taxonomy_title:string|null;attached_by_name:string|null};
export type ClassLibraryDocument={id:number;title:string;doc_type:string;file_url:string;thumbnail_url:string|null;total_pages:number|null;owner_id:number|null;taxonomy_node_id:number|null;created_at:string;source:"KHO_CHUNG"|"RIENG";taxonomy_title:string|null;attached:boolean};
export type ClassStudentProgressRow={student_id:number;full_name:string;username:string|null;required_total:number;required_submitted:number;required_avg_score:number|null;optional_total:number;optional_submitted:number;last_submitted_at:string|null};
export type SubmissionLogRow={id:number;assignment_id:number;title:string;student_id:number;full_name:string;username:string|null;action:"SUBMITTED"|"GRADED"|"RETURNED";requirement:ClassRequirement;score:number|null;note:string|null;created_at:string;actor_id:number|null;actor_name:string|null};
export type RosterStudent={id:number;student_id:number;joined_at:string;full_name:string;username:string|null;email:string;phone:string|null;status:string;avatar_url:string|null;date_of_birth:string|null;gender:string|null};
export type RosterCandidate={id:number;full_name:string;username:string|null;email:string};
export type RosterRowStatus="TAO_MOI"|"CO_SAN"|"DA_TRONG_LOP"|"LOI";
export type RosterImportRow={rowNumber:number;username:string;email:string;fullName:string;phone:string;matchedUserId:number|null;status:RosterRowStatus;errors:string[]};
export type RosterImportPreview={objectKey:string;total:number;newAccounts:number;existingAccounts:number;alreadyInClass:number;invalid:number;rows:RosterImportRow[]};
export type RosterImportResult={created:number;enrolled:number;skipped:number;errors:string[]};
export type MyClass={id:number;code:string;name:string;status:string;description:string|null;grade_name:string|null;teacher_names:string|null;student_count:number;curriculum_count:number;document_count:number;required_total:number;required_submitted:number;required_avg_score:number|null;optional_total:number;optional_submitted:number};
/** ChÆ°a tá»›i giá» má»Ÿ thÃ¬ server xoÃ¡ tráº¯ng worksheet/document â€” chá»‰ cÃ²n cÃ¡i tÃªn bÃ i. */
export type MyClassTask={id:number;title:string;open_at:string|null;due_at:string|null;status:string;state:AssignmentState;requirement:ClassRequirement;lesson_id:number|null;worksheet_id:number|null;document_id:number|null;worksheet_name:string|null;document_title:string|null;document_file_url:string|null;document_doc_type:string|null;grading_status:string;completion_percent:number;opened_at:string|null;submitted_at:string|null;graded_at:string|null;returned_at:string|null;score:number|null;max_score:number|null;teacher_feedback:string|null;attempts_left:number|null;attempt_no:number;submitted_late:boolean;max_attempts:number;late_policy:LatePolicy;late_penalty_percent:number;publish_score_at:string|null};
export type AdminClassOverviewRow={id:number;code:string;name:string;grade_id:number;status:string;description:string|null;start_date:string|null;created_at:string;grade_name:string|null;created_by_name:string|null;created_by_role:string|null;teacher_names:string|null;teacher_count:number;student_count:number;course_count:number;curriculum_count:number;document_count:number;required_total:number;optional_total:number;submission_count:number;last_submitted_at:string|null};
/**
 * `attemptsLeft` null nghÄ©a lÃ  khÃ´ng giá»›i háº¡n lÆ°á»£t ná»™p. ChÆ°a tá»›i giá» má»Ÿ thÃ¬ `items` rá»—ng.
 *
 * `essay` do server quyáº¿t, Ä‘á»«ng suy láº¡i tá»« `optionA..D`: Ä‘á» nháº­p tá»« PDF in bá»‘n phÆ°Æ¡ng Ã¡n ngay
 * trong `statementLatex` nÃªn bá»‘n cá»™t Ä‘Ã³ trá»‘ng mÃ  cÃ¢u váº«n lÃ  tráº¯c nghiá»‡m.
 */
export type StudentAssignment={id:number;title:string;openAt:string|null;dueAt:string|null;status:string;state:AssignmentState;lessonId:number|null;worksheetId:number|null;worksheetName:string;progressStatus:string;completionPercent:number;gradingStatus:string;score:number|null;maxScore:number|null;attemptsLeft:number|null;submittedLate:boolean;items:{problemId:number;orderIndex:number;publicCode:string;qrSlug:string;statementLatex:string;difficulty:string;optionA:string|null;optionB:string|null;optionC:string|null;optionD:string|null;essay:boolean}[]};
/**
 * Äiá»ƒm vÃ  nháº­n xÃ©t cá»§a má»™t cÃ¢u. DÃ¹ng chung cho báº£ng cháº¥m cá»§a giÃ¡o viÃªn vÃ  báº£ng káº¿t quáº£ cá»§a há»c
 * sinh â€” khÃ¡c nhau á»Ÿ chá»— Ä‘Æ°á»ng tráº£ vá» cho há»c sinh **luÃ´n Ä‘á»ƒ trá»‘ng `correctOption`**.
 */
export type SubmissionItemView={problemId:number;orderNo:number;publicCode:string|null;statement:string|null;essay:boolean;correctOption:string|null;studentAnswer:string|null;score:number|null;maxScore:number|null;feedback:string|null};
/** `rawScore` lÃ  Ä‘iá»ƒm bÃ i lÃ m trÆ°á»›c khi trá»« muá»™n; `score` lÃ  Ä‘iá»ƒm cuá»‘i cÃ¹ng. `items` rá»—ng khi Ä‘iá»ƒm chÆ°a cÃ´ng bá»‘. */
export type AssignmentResult={assignmentId:number;studentId:number;gradingStatus:string;completionPercent:number;submittedAt:string|null;gradedAt:string|null;returnedAt:string|null;score:number|null;maxScore:number|null;correctCount:number|null;totalQuestions:number|null;teacherFeedback:string|null;answers:Record<number,string>;state:AssignmentState;openAt:string|null;dueAt:string|null;attemptsLeft:number|null;submittedLate:boolean;rawScore:number|null;items:SubmissionItemView[]};
/** Báº£ng cháº¥m chi tiáº¿t má»™t bÃ i ná»™p. `conThieu` > 0 nghÄ©a lÃ  cÃ²n cÃ¢u tá»± luáº­n chÆ°a cho Ä‘iá»ƒm. */
export type SubmissionGradingSheet={submissionId:number;assignmentId:number;studentId:number;studentName:string|null;gradingStatus:string;teacherFeedback:string|null;maxScoreMoiCau:number|null;items:SubmissionItemView[];daCham:number;tongSoCau:number;conThieu:number;rawScore:number|null;score:number|null;submittedLate:boolean};
/** `score` null nghÄ©a lÃ  bá» cháº¥m cÃ¢u Ä‘Ã³, Ä‘Æ°a vá» chÆ°a cháº¥m â€” khÃ´ng pháº£i cho 0 Ä‘iá»ƒm. */
export type ItemScoreInput={problemId:number;score:number|null;feedback:string|null};
export type TeacherSubmission={id:number;assignment_id:number;title:string;student_id:number;full_name:string;username:string;submitted_at:string;graded_at:string|null;returned_at:string|null;score:number|null;max_score:number;correct_count:number|null;total_questions:number|null;teacher_feedback:string|null;grading_status:string;answer_json:string;attempt_no:number;submitted_late:boolean;raw_score:number|null;due_at:string|null;late_policy:LatePolicy;late_penalty_percent:number};
/** `missingAnswerKey` lÃ  Ä‘á» chÆ°a nháº­p Ä‘Ã¡p Ã¡n Ä‘Ãºng â€” khi Ä‘Ã³ `correct` vÃ  `rate` lÃ  null, khÃ´ng pháº£i 0. */
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

// KhÃ´ng request nÃ o Ä‘Æ°á»£c phÃ©p treo vÃ´ thá»i háº¡n â€” náº¿u khÃ´ng, nÃºt báº¥m/spinner
// Ä‘á»©ng hÃ¬nh mÃ£i khi máº¡ng cháº­m hoáº·c backend khÃ´ng pháº£n há»“i, khiáº¿n UI "cáº£m giÃ¡c" bá»‹ Ä‘Æ¡.
const DEFAULT_TIMEOUT_MS = 20_000; // gá»i API JSON thÃ´ng thÆ°á»ng
const FILE_TIMEOUT_MS = 60_000; // táº£i/má»Ÿ file (PDF, áº£nhâ€¦)
const UPLOAD_TIMEOUT_MS = 120_000; // upload file lÃªn server/storage

function isAbortOrTimeout(err: unknown): boolean {
  return err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError");
}

/**
 * Bá»c 1 lá»i gá»i fetch báº±ng timeout; biáº¿n lá»—i abort/timeout thÃ nh thÃ´ng bÃ¡o tiáº¿ng Viá»‡t dá»… hiá»ƒu.
 * Náº¿u cÃ³ `externalSignal` (vd React Query há»§y khi component unmount/queryKey Ä‘á»•i), káº¿t há»£p cáº£
 * hai Ä‘á»ƒ request váº«n bá»‹ há»§y Ä‘Ãºng lÃºc mÃ  váº«n giá»¯ giá»›i háº¡n thá»i gian chá».
 */
async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>, externalSignal?: AbortSignal | null): Promise<T> {
  const timeout = AbortSignal.timeout(ms);
  const signal = externalSignal ? AbortSignal.any([timeout, externalSignal]) : timeout;
  try {
    return await run(signal);
  } catch (err) {
    if (isAbortOrTimeout(err) && !externalSignal?.aborted) throw new Error("YÃªu cáº§u quÃ¡ thá»i gian chá», vui lÃ²ng thá»­ láº¡i");
    throw err;
  }
}

function decodeJwt(token: string) {
  const encoded = token.split(".")[1];
  if (!encoded) throw new Error("Token Ä‘Äƒng nháº­p khÃ´ng há»£p lá»‡");
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(decodeURIComponent(escape(atob(normalized)))) as { sub: number; email: string; role: string };
}

export function normalizeRole(value: string | undefined | null): AuthSession["role"] {
  const role = String(value ?? "").trim().toUpperCase().replace(/^ROLE_/, "");
  if (role === "STUDENT") return "student";
  if (role === "TEACHER") return "teacher";
  if (role === "ADMIN") return "admin";
  throw new Error("Vai trÃ² tÃ i khoáº£n khÃ´ng Ä‘Æ°á»£c há»— trá»£");
}

export function financeRequest<T>(session:AuthSession,path:string,method="GET",body?:unknown):Promise<T>{
 return request<T>(`/finance${path}`,{method,...(body===undefined?{}:{body:JSON.stringify(body)})},session.accessToken);
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  return withTimeout(DEFAULT_TIMEOUT_MS, async signal => {
    const headers = new Headers(options.headers);
    if (!(options.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${API_BASE_URL}/api${path}`, {
      ...options,
      signal,
      headers,
    });
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!response.ok || !payload?.success) throw new Error(payload?.message || `API tráº£ vá» lá»—i ${response.status}`);
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

/** Thá»i Ä‘iá»ƒm access token háº¿t háº¡n (mili-giÃ¢y epoch); 0 nghÄ©a lÃ  khÃ´ng Ä‘á»c Ä‘Æ°á»£c háº¡n. */
export function accessTokenExpiresAt(token: string): number {
  try {
    const exp = (decodeJwt(token) as { exp?: number }).exp;
    return exp ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/** Äá»•i refresh token láº¥y cáº·p token má»›i. MÃ¡y chá»§ xoay vÃ²ng: token cÅ© cháº¿t ngay sau lÆ°á»£t gá»i nÃ y. */
export async function refreshSession(session: AuthSession): Promise<AuthSession> {
  return toSession(await request<TokenResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: session.refreshToken ?? "" }),
  }));
}

/**
 * Thu há»“i phiÃªn á»Ÿ phÃ­a mÃ¡y chá»§. KhÃ´ng cáº§n access token cÃ²n háº¡n.
 * Nuá»‘t lá»—i: máº¥t máº¡ng hay token Ä‘Ã£ cháº¿t thÃ¬ ngÆ°á»i dÃ¹ng váº«n pháº£i Ä‘Äƒng xuáº¥t Ä‘Æ°á»£c khá»i mÃ¡y nÃ y.
 */
export async function logoutSession(session: AuthSession): Promise<void> {
  try {
    await request<void>("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: session.refreshToken ?? "" }) });
  } catch {
    /* bá» qua */
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
export function getAdminCalendarEvents(session:AuthSession,from:string,to:string){
  const params=new URLSearchParams({from,to});
  return request<AdminCalendarEvent[]>(`/admin/calendar-events?${params}`,{},session.accessToken);
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
export const getMyProfile=(s:AuthSession)=>request<MyProfile>("/me/profile",{},s.accessToken);
export const updateMyProfile=(s:AuthSession,input:{fullName:string;email:string;phone:string;dateOfBirth:string|null;gender:string;avatarUrl:string|null})=>request<MyProfile>("/me/profile",{method:"PUT",body:JSON.stringify(input)},s.accessToken);

export async function uploadUserImport(session: AuthSession, file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await withTimeout(UPLOAD_TIMEOUT_MS, signal => fetch(`${API_BASE_URL}/api/users/import/upload`, {
    method: "POST", headers: {Authorization: `Bearer ${session.accessToken}`}, body: form, signal,
  }));
  const payload = await response.json().catch(() => null) as ApiEnvelope<UserImportPreview> | null;
  if (!response.ok || !payload?.success) throw new Error(payload?.message || `KhÃ´ng thá»ƒ táº£i file (${response.status})`);
  return payload.data;
}

export const confirmUserImport=(session:AuthSession,objectKey:string)=>request<UserImportResult>("/users/import/confirm",{method:"POST",body:JSON.stringify({objectKey})},session.accessToken);
export async function downloadUserImportTemplate(session:AuthSession){
 const response=await withTimeout(FILE_TIMEOUT_MS, signal=>fetch(`${API_BASE_URL}/api/users/import/template`,{headers:{Authorization:`Bearer ${session.accessToken}`},signal}));
 if(!response.ok)throw new Error("KhÃ´ng thá»ƒ táº£i file máº«u");
 const url=URL.createObjectURL(await response.blob());const link=document.createElement("a");link.href=url;link.download="user-import-template.xlsx";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export type AuditLogFilter = {
  actorUserId?: string; actorRole?: string; targetType?: string; targetId?: string; action?: string;
  days?: string; page?: number; size?: number;
};
export type AuditLogPage = { items: AuditLog[]; total: number; page: number; pages: number };

/**
 * Lá»c Ä‘áº·t á»Ÿ mÃ¡y chá»§ chá»© khÃ´ng á»Ÿ trÃ¬nh duyá»‡t. Nháº­t kÃ½ nay ghi cáº£ bÃ i giao, cháº¥m Ä‘iá»ƒm, thÃ nh viÃªn
 * lá»›p vÃ  tÃ i liá»‡u, nÃªn 50 dÃ²ng má»›i nháº¥t chá»‰ lÃ  vÃ i phÃºt hoáº¡t Ä‘á»™ng â€” lá»c trÃªn táº­p Ä‘Ã³ sáº½ bÃ¡o "khÃ´ng
 * cÃ³ káº¿t quáº£" cho nhá»¯ng viá»‡c tháº­t sá»± Ä‘Ã£ xáº£y ra, tá»©c lÃ  nÃ³i dá»‘i ngÆ°á»i Ä‘i tra nháº­t kÃ½.
 */
export async function getAuditLogs(session: AuthSession, filter: AuditLogFilter = {}): Promise<AuditLogPage> {
  // KhÃ´ng gá»­i tham sá»‘ sort: mÃ¡y chá»§ Ä‘Ã£ Ä‘áº·t máº·c Ä‘á»‹nh "createdAt desc, id desc", vÃ  tham sá»‘ sort cá»§a
  // lá»i gá»i sáº½ Ä‘Ã¨ lÃªn máº·c Ä‘á»‹nh Ä‘Ã³ â€” gá»­i "createdAt,desc" lÃ  bá» máº¥t khoÃ¡ phá»¥ id, khiáº¿n nhá»¯ng dÃ²ng
  // ghi cÃ¹ng má»™t lÃºc (cháº¥m láº¡i cáº£ lá»›p, nháº­p danh sÃ¡ch) nháº£y giá»¯a cÃ¡c trang.
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
/** CÃ¢y chá»‰ Ä‘á»c cho giÃ¡o viÃªn â€” chá»‰ gá»“m má»¥c Ä‘ang hoáº¡t Ä‘á»™ng, khÃ´ng kÃ¨m thao tÃ¡c chá»‰nh sá»­a nÃ o. */
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
export async function parseWorksheetDocx(s:AuthSession,file:File){const form=new FormData();form.append("file",file);const response=await withTimeout(UPLOAD_TIMEOUT_MS,signal=>fetch(`${API_BASE_URL}/api/worksheets/import/docx`,{method:"POST",headers:{Authorization:`Bearer ${s.accessToken}`},body:form,signal}));const payload=await response.json().catch(()=>null) as ApiEnvelope<WorksheetImportPreview>|null;if(!response.ok||!payload?.success)throw new Error(payload?.message||`KhÃ´ng thá»ƒ bÃ³c Ä‘á» (${response.status})`);return payload.data}
export async function parseWorksheetFile(s:AuthSession,file:File){const extension=file.name.toLowerCase().endsWith(".pdf")?"pdf":"docx";const form=new FormData();form.append("file",file);const response=await withTimeout(UPLOAD_TIMEOUT_MS,signal=>fetch(`${API_BASE_URL}/api/worksheets/import/${extension}`,{method:"POST",headers:{Authorization:`Bearer ${s.accessToken}`},body:form,signal}));const payload=await response.json().catch(()=>null) as ApiEnvelope<WorksheetImportPreview>|null;if(!response.ok||!payload?.success)throw new Error(payload?.message||`KhÃ´ng thá»ƒ bÃ³c Ä‘á» (${response.status})`);return payload.data}
export const publishWorksheetImport=(s:AuthSession,input:{name:string;problemTypeId:number;questions:{statement:string;optionA:string;optionB:string;optionC:string;optionD:string;correctOption:string}[]})=>request<Worksheet>("/worksheets/import/publish",{method:"POST",body:JSON.stringify(input)},s.accessToken);
export const getMyCourses=(s:AuthSession)=>request<StudentCourse[]>("/student/courses",{},s.accessToken);
export type HomNayTienDoLop={trangThai:"ON_TRACK"|"BEHIND"|"AHEAD";theoKeHoach:number;thucTe:number;lech:number;canhBao:boolean};
export type HomNayData={trangThai:string;khoaId:number|null;tenKhoa:string|null;tienDoLop:HomNayTienDoLop|null};
export const getHomNay=(s:AuthSession)=>request<HomNayData>("/student/hom-nay",{},s.accessToken);
export const getCurrentProgramChapter=(s:AuthSession,courseId:number,at?:string)=>{const p=new URLSearchParams({courseId:String(courseId)});if(at)p.set("at",at);return request<ProgramSchedule|null>(`/program-schedules/current?${p}`,{},s.accessToken)};
export const getProgramChaptersByTime=(s:AuthSession,programId:number)=>request<ProgramChapterTime[]>(`/programs/${programId}/chapters-by-time`,{},s.accessToken);
export const getProgramResources=(s:AuthSession,programId:number,type?:ProgramResource["resource_type"])=>request<ProgramResource[]>(`/programs/${programId}/resources${type?`?type=${type}`:""}`,{},s.accessToken);
export const getSourceDocuments=(s:AuthSession)=>request<SourceDocument[]>("/teacher/content-pipeline/sources",{},s.accessToken);
export async function uploadSourceDocument(s:AuthSession,title:string,file:File){const form=new FormData();form.append("title",title);form.append("file",file);const response=await fetch(`${API_BASE_URL}/api/teacher/content-pipeline/sources`,{method:"POST",headers:{Authorization:`Bearer ${s.accessToken}`},body:form});const payload=await response.json() as ApiEnvelope<SourceDocument>;if(!response.ok||!payload.success)throw new Error(payload.message);return payload.data;}
export const getExtractedQuestions=(s:AuthSession,id:number)=>request<ExtractedQuestion[]>(`/teacher/content-pipeline/sources/${id}/questions`,{},s.accessToken);
export const reviewExtractedQuestion=(s:AuthSession,id:number,x:Partial<ExtractedQuestion>&{status:string})=>request<ExtractedQuestion>(`/teacher/content-pipeline/questions/${id}/review`,{method:"PUT",body:JSON.stringify({questionText:x.question_text,optionA:x.option_a,optionB:x.option_b,optionC:x.option_c,optionD:x.option_d,answerText:x.answer_text,solutionText:x.solution_text,status:x.status})},s.accessToken);
export const getSourceBlocks=(s:AuthSession,id:number)=>request<DocumentBlock[]>(`/teacher/content-pipeline/sources/${id}/blocks`,{},s.accessToken);
export const getParsingQuality=(s:AuthSession,id:number)=>request<ParsingQuality>(`/teacher/content-pipeline/sources/${id}/quality`,{},s.accessToken);
export const correctQuestionBoundary=(s:AuthSession,id:number,x:{action:string;startBlockId?:number;endBlockId?:number})=>request<ExtractedQuestion>(`/teacher/content-pipeline/questions/${id}/boundary`,{method:"PUT",body:JSON.stringify(x)},s.accessToken);
export const reviewMathFragment=(s:AuthSession,id:number,latex:string,decision:"ACCEPTED"|"EDITED"|"KEEP_TEXT")=>request<MathFragment>(`/teacher/content-pipeline/math-fragments/${id}/review`,{method:"PUT",body:JSON.stringify({latex,decision})},s.accessToken);
export const getQuestionVariants=(s:AuthSession,id:number)=>request<QuestionVariant[]>(`/teacher/content-pipeline/questions/${id}/variants`,{},s.accessToken);
export const createQuestionVariant=(s:AuthSession,id:number,x:Record<string,string|number>)=>request<QuestionVariant>(`/teacher/content-pipeline/questions/${id}/variants`,{method:"POST",body:JSON.stringify(x)},s.accessToken);
export const batchTransformQuestions=(s:AuthSession,questionIds:number[])=>request<BatchTransformResult>("/teacher/content-pipeline/variants/batch",{method:"POST",body:JSON.stringify({questionIds})},s.accessToken);
export const getQuestionTransformations=(s:AuthSession,id:number)=>request<Array<{id:number;rule_code:string;validation_result:unknown;created_at:string}>>(`/teacher/content-pipeline/questions/${id}/transformations`,{},s.accessToken);
export const acceptQuestionVariant=(s:AuthSession,id:number)=>request<QuestionVariant>(`/teacher/content-pipeline/variants/${id}/accept`,{method:"PUT"},s.accessToken);
export const getPipelineWorksheets=(s:AuthSession)=>request<PipelineWorksheet[]>("/teacher/content-pipeline/worksheets",{},s.accessToken);
export const composePipelineWorksheet=(s:AuthSession,title:string,items:Array<{questionId:number;variantId?:number;content?:string}>)=>request<PipelineWorksheet>("/teacher/content-pipeline/worksheets",{method:"POST",body:JSON.stringify({title,items})},s.accessToken);
export const publishPipelineWorksheet=(s:AuthSession,id:number)=>request<PipelineWorksheet>(`/teacher/content-pipeline/worksheet-versions/${id}/publish`,{method:"POST"},s.accessToken);
export const clonePipelineWorksheet=(s:AuthSession,id:number)=>request<PipelineWorksheet>(`/teacher/content-pipeline/worksheet-versions/${id}/clone`,{method:"POST"},s.accessToken);
export async function exportPipelineWorksheet(s:AuthSession,id:number,format:"pdf"|"docx"){const response=await fetch(`${API_BASE_URL}/api/teacher/content-pipeline/worksheet-versions/${id}/export/${format}`,{headers:{Authorization:`Bearer ${s.accessToken}`}});if(!response.ok)throw new Error(`KhÃ´ng thá»ƒ export (${response.status})`);const url=URL.createObjectURL(await response.blob()),a=document.createElement("a");a.href=url;a.download=`worksheet-v${id}.${format}`;a.click();URL.revokeObjectURL(url);}
export const getSharedTeacherResources=(s:AuthSession,lessonId?:number)=>request<SharedTeacherResource[]>(`/student/teacher-resources${lessonId?`?lessonId=${lessonId}`:""}`,{},s.accessToken);
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
/** Một dòng = một lớp × một khóa admin đã phân; lớp chưa gắn khóa có các trường khóa/chương trình null. */
export type AssignedCourse = { classId:number; classCode:string; className:string; classStatus:string; courseInstanceId:number|null; courseInstanceName:string|null; schoolYear:string|null; startsOn:string|null; endsOn:string|null; courseInstanceStatus:string|null; programId:number|null; programCode:string|null; programName:string|null };
export const getAssignedCourses=(s:AuthSession)=>request<AssignedCourse[]>("/teacher/assigned-courses",{},s.accessToken);
export const getTeacherClasses=(s:AuthSession)=>request<Classroom[]>("/teacher/classes",{},s.accessToken);
export const getClassResults=(s:AuthSession)=>request<ClassResult[]>("/teacher/class-results",{},s.accessToken);
export const getGradebook=(s:AuthSession,classId:number)=>request<GradebookRow[]>(`/teacher/gradebook?classId=${classId}`,{},s.accessToken);
export const getTeacherSubmissions=(s:AuthSession,classId:number)=>request<TeacherSubmission[]>(`/teacher/submissions?classId=${classId}`,{},s.accessToken);
export const gradeSubmission=(s:AuthSession,id:number,score:number,feedback:string)=>request<void>(`/teacher/submissions/${id}/grade`,{method:"PUT",body:JSON.stringify({score,feedback})},s.accessToken);
export const returnSubmission=(s:AuthSession,id:number)=>request<void>(`/teacher/submissions/${id}/return`,{method:"PATCH"},s.accessToken);
export const getItemAnalysis=(s:AuthSession,assignmentId:number)=>request<ItemAnalysis[]>(`/teacher/submissions/assignments/${assignmentId}/analysis`,{},s.accessToken);
export const regradeAssignment=(s:AuthSession,assignmentId:number)=>request<{updated:number;skipped:number}>(`/teacher/submissions/assignments/${assignmentId}/regrade`,{method:"POST"},s.accessToken);
export const getSubmissionItems=(s:AuthSession,id:number)=>request<SubmissionGradingSheet>(`/teacher/submissions/${id}/items`,{},s.accessToken);
/** Gá»­i Ä‘Æ°á»£c tá»«ng pháº§n: chá»‰ mang nhá»¯ng cÃ¢u vá»«a cháº¥m, server tá»± biáº¿t cÃ²n thiáº¿u bao nhiÃªu cÃ¢u. */
export const gradeSubmissionItems=(s:AuthSession,id:number,items:ItemScoreInput[],feedback:string|null)=>request<SubmissionGradingSheet>(`/teacher/submissions/${id}/grade-items`,{method:"PUT",body:JSON.stringify({items,feedback})},s.accessToken);
/**
 * Há»c liá»‡u cá»§a má»™t bÃ i, Ä‘i qua luá»“ng ná»™i dung.
 *
 * NÄƒm hÃ m dÆ°á»›i thay cho `/resources` cÅ©. Báº£ng cÅ© giá»¯ ná»™i dung náº±m ngay trong dÃ²ng gáº¯n vÃ  khÃ´ng cÃ³
 * cá»™t tráº¡ng thÃ¡i láº«n cá»™t Ä‘á»‘i tÆ°á»£ng, nÃªn má»i thá»© ghi vÃ o Ä‘Ã³ vá»«a máº¥t cá»­a Ä‘á»c cuá»‘i cÃ¹ng: gá»i nháº§m
 * Ä‘Æ°á»ng thÃ¬ admin báº¥m lÆ°u, tháº¥y há»c liá»‡u trong danh sÃ¡ch cá»§a mÃ¬nh, vÃ  há»c sinh khÃ´ng bao giá» tháº¥y.
 */
// Kiá»ƒu riÃªng chá»© khÃ´ng dÃ¹ng láº¡i ProgramResource: Ä‘Æ°á»ng theo bÃ i tráº£ vá» `pr.*` thuáº§n, khÃ´ng cÃ³
// chapter_id/starts_on/time_group mÃ  Ä‘Æ°á»ng theo chÆ°Æ¡ng trÃ¬nh ghÃ©p thÃªm. Khai thá»«a á»Ÿ Ä‘Ã¢y lÃ  má»i
// ngÆ°á»i sau Ä‘á»c má»™t cá»™t luÃ´n undefined mÃ  trÃ¬nh biÃªn dá»‹ch váº«n gáº­t.
export type LessonProgramResource={id:number;lesson_id:number;resource_type:"VIDEO"|"DOCUMENT"|"EXERCISE"|"SPECIAL_TOPIC";resource_ref_id:number;title:string;order_index:number;status:string;audience:string;lesson_attachment?:boolean};
export const getLessonResources=(s:AuthSession,lessonId:number)=>request<LessonProgramResource[]>(`/lessons/${lessonId}/program-resources`,{},s.accessToken);
export type NewResourceInput={resourceType:"VIDEO"|"DOCUMENT";title:string;videoUrl?:string;fileAssetId?:number|null;textContent?:string;orderIndex:number;status:string;audience:string};
export const addLessonResource=(s:AuthSession,lessonId:number,x:NewResourceInput)=>request<LessonProgramResource>(`/admin/lessons/${lessonId}/resources/new`,{method:"POST",body:JSON.stringify(x)},s.accessToken);
/** Chá»‰ sá»­a Ä‘Æ°á»£c tÃªn, tráº¡ng thÃ¡i vÃ  Ä‘á»‘i tÆ°á»£ng: tá»‡p vÃ  Ä‘Æ°á»ng dáº«n náº±m trong kho, sá»­a á»Ÿ mÃ n kho. */
export const updateLessonResource=(s:AuthSession,id:number,x:{title:string;status:string;audience:string})=>request<LessonProgramResource>(`/admin/program-resources/${id}`,{method:"PUT",body:JSON.stringify(x)},s.accessToken);
export const deleteLessonResource=(s:AuthSession,id:number)=>request<void>(`/admin/program-resources/${id}`,{method:"DELETE"},s.accessToken);
export const reorderLessonResources=(s:AuthSession,lessonId:number,rows:{id:number;orderIndex:number}[])=>request<void>(`/admin/lessons/${lessonId}/resources/reorder`,{method:"PUT",body:JSON.stringify(rows)},s.accessToken);
export async function uploadFile(s:AuthSession,file:File){const form=new FormData();form.append("file",file);const response=await withTimeout(UPLOAD_TIMEOUT_MS,signal=>fetch(`${API_BASE_URL}/api/files`,{method:"POST",headers:{Authorization:`Bearer ${s.accessToken}`},body:form,signal}));const payload=await response.json() as ApiEnvelope<FileAsset>;if(!response.ok||!payload.success)throw new Error(payload.message||"Táº£i file tháº¥t báº¡i");return payload.data}
export async function downloadFile(s:AuthSession,id:number,title:string){const response=await withTimeout(FILE_TIMEOUT_MS,signal=>fetch(`${API_BASE_URL}/api/files/${id}/download`,{headers:{Authorization:`Bearer ${s.accessToken}`},signal}));if(!response.ok)throw new Error(`KhÃ´ng thá»ƒ táº£i file (${response.status})`);const blob=await response.blob();if(!blob.size)return;const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=title;a.click();URL.revokeObjectURL(url)}
export const getEnrollments=(s:AuthSession,type:"class-teachers"|"class-students"|"class-courses",classId:number)=>request<Enrollment[]>(`/enrollments/${type}?classId=${classId}`,{},s.accessToken);
export const addEnrollment=(s:AuthSession,type:"class-teachers"|"class-students"|"class-courses",x:{classId:number;userId?:number;courseInstanceId?:number})=>request<void>(`/enrollments/${type}`,{method:"POST",body:JSON.stringify(x)},s.accessToken);
export const getCourseInstances=(s:AuthSession)=>request<CourseInstance[]>("/admin/course-instances",{},s.accessToken);
export type AcademicBreak={id:number;course_instance_id:number;starts_on:string;ends_on:string;reason:string};
export const getAcademicBreaks=(s:AuthSession,courseInstanceId:number)=>request<AcademicBreak[]>(`/admin/course-instances/${courseInstanceId}/breaks`,{},s.accessToken);
export const addAcademicBreak=(s:AuthSession,courseInstanceId:number,x:{startsOn:string;endsOn:string;reason:string})=>request<AcademicBreak>(`/admin/course-instances/${courseInstanceId}/breaks`,{method:"POST",body:JSON.stringify(x)},s.accessToken);
export const removeAcademicBreak=(s:AuthSession,id:number)=>request<void>(`/admin/academic-breaks/${id}`,{method:"DELETE"},s.accessToken);
export type ProgramTemplate={id:number;program_id:number;name:string;description:string|null;status:string};
export const getProgramTemplates=(s:AuthSession)=>request<ProgramTemplate[]>("/admin/program-templates",{},s.accessToken);
export const createProgramTemplate=(s:AuthSession,x:{programId:number;name:string;description:string;status:string})=>request<ProgramTemplate>("/admin/program-templates",{method:"POST",body:JSON.stringify(x)},s.accessToken);
export const createCourseInstance=(s:AuthSession,x:{templateId:number;name:string;schoolYear:string;startsOn:string;endsOn:string;status:string})=>request<CourseInstance>("/admin/course-instances",{method:"POST",body:JSON.stringify(x)},s.accessToken);
export const updateCourseInstance=(s:AuthSession,id:number,x:{templateId:number;name:string;schoolYear:string;startsOn:string;endsOn:string;status:string})=>request<CourseInstance>(`/admin/course-instances/${id}`,{method:"PUT",body:JSON.stringify(x)},s.accessToken);
export const deleteCourseInstance=(s:AuthSession,id:number)=>request<void>(`/admin/course-instances/${id}`,{method:"DELETE"},s.accessToken);

// ====================== PPCT Config API ======================
export type PpctThamSo={so_tuan:number;tuan_ky_1:number;tiet_mot_tuan:number};
export type PpctMachConfig={id:number;ma_mach:string;ten_mach:string;thu_tu:number;bat_dau_tuan:number|null;ket_thuc_tuan:number|null;so_tiet_mot_tuan:number};
export type PpctTuanDacBiet={id:number;tuan_so:number;loai:"HDTN"|"ON_TAP"|"KIEM_TRA";ma_mach:string|null;nhan:string|null};
export type PpctTuKhoa={id:number;ma_mach:string;tu_khoa:string};
export const getPpctConfig=(s:AuthSession,programId:number)=>request<PpctThamSo|null>(`/admin/programs/${programId}/ppct-config`,{},s.accessToken);
export const savePpctConfig=(s:AuthSession,programId:number,x:PpctThamSo)=>request<PpctThamSo>(`/admin/programs/${programId}/ppct-config`,{method:"PUT",body:JSON.stringify(x)},s.accessToken);
export const getPpctMachConfig=(s:AuthSession,programId:number)=>request<PpctMachConfig[]>(`/admin/programs/${programId}/mach-config`,{},s.accessToken);
export const savePpctMachConfig=(s:AuthSession,programId:number,ds:{maMach:string;tenMach:string;batDauTuan:number;ketThucTuan:number;soTietMotTuan:number}[])=>request<PpctMachConfig[]>(`/admin/programs/${programId}/mach-config`,{method:"PUT",body:JSON.stringify(ds)},s.accessToken);
export const getPpctTuanDacBiet=(s:AuthSession,programId:number)=>request<PpctTuanDacBiet[]>(`/admin/programs/${programId}/tuan-dac-biet`,{},s.accessToken);
export const savePpctTuanDacBiet=(s:AuthSession,programId:number,ds:{tuanSo:number;loai:string;maMach:string|null;nhan:string|null}[])=>request<PpctTuanDacBiet[]>(`/admin/programs/${programId}/tuan-dac-biet`,{method:"PUT",body:JSON.stringify(ds)},s.accessToken);
export const getPpctTuKhoa=(s:AuthSession,programId:number)=>request<PpctTuKhoa[]>(`/admin/programs/${programId}/tu-khoa`,{},s.accessToken);
export const savePpctTuKhoa=(s:AuthSession,programId:number,maMach:string,tuKhoa:string[])=>request<PpctTuKhoa[]>(`/admin/programs/${programId}/tu-khoa/${maMach}`,{method:"PUT",body:JSON.stringify(tuKhoa)},s.accessToken);
export const seedProgramStrands=(s:AuthSession,programId:number)=>request<{soMach:number;soTiet:number;soTuan:number}>(`/admin/programs/${programId}/strands/seed`,{method:"POST"},s.accessToken);
// ====================== Nháº­p PPCT tháº­t (PP-7) â€” PDF hoáº·c Excel, má»™t Ä‘Æ°á»ng ======================
// Máº¡ch + tiáº¿t hiá»‡n cÃ³ cá»§a chÆ°Æ¡ng trÃ¬nh. KhÃ³a snake_case y nhÆ° cÃ¢u select á»Ÿ ProgramStrandController
// (envelope khÃ´ng camelCase hoÃ¡) â€” `tuan_dau`/`tuan_cuoi` rá»—ng khi máº¡ch chÆ°a cÃ³ tiáº¿t nÃ o.
export type ProgramStrandInfo={id:number;code:string;name:string;order_index:number;so_tiet:number;tuan_dau:number|null;tuan_cuoi:number|null};
export type PpctRow={chiSo:number;maMach:string;tenMach:string;soTiet:number;tuan:number;hocKy:number;phanLoai:string;tieuDe:string;lessonId:number|null;lessonTitle:string|null;doTinCay:"CAO"|"VUA"|"THAP";canhBao:string[]};
export type PpctPreview={objectKey:string;trangThai:"SAN_SANG"|"UNSUPPORTED_SCAN";soTuan:number;soTiet:number;soMach:number;dong:PpctRow[];soHopLe:number;soLoi:number;thongDiep:string};
export const getProgramStrands=(s:AuthSession,programId:number)=>request<ProgramStrandInfo[]>(`/programs/${programId}/strands`,{},s.accessToken);
export type ProgramPeriodInfo={id:number;strand_id:number;strand_code:string;strand_name:string;strand_order:number;period_no:number;week_no:number;term:number;lesson_id:number|null;title:string|null;period_kind:string;source:string};
export const getProgramWeek=(s:AuthSession,programId:number,weekNo:number)=>request<ProgramPeriodInfo[]>(`/programs/${programId}/weeks/${weekNo}`,{},s.accessToken);
// Cửa ghi chung cho 6 nơi đến (xem ProgramContentController.phanPhoi) — dùng để gắn tài liệu/video có sẵn
// vào bất kỳ nơi đến nào ngoài BAI, thứ mà đường /admin/lessons/{id}/resources cũ không làm được.
export type PhanPhoiInput={noiDenLoai:"HE_THONG"|"MACH"|"TIET"|"BAI"|"CHUYEN_DE";neo?:number|null;lessonId?:number|null;lopId?:number|null;resourceType:"VIDEO"|"DOCUMENT"|"EXERCISE"|"SPECIAL_TOPIC";resourceRefId:number;title:string;orderIndex?:number|null;status?:string|null;audience:string};
export const phanPhoi=(s:AuthSession,x:PhanPhoiInput)=>request<ProgramResource>("/admin/phan-phoi",{method:"POST",body:JSON.stringify(x)},s.accessToken);
// Multipart theo khuÃ´n raw-fetch (khÃ´ng set Content-Type), UPLOAD_TIMEOUT_MS vÃ¬ backend cÃ²n tÃ¡ch PDF.
export async function uploadPpctPreview(s:AuthSession,programId:number,file:File){
  const form=new FormData();form.append("file",file);
  const response=await withTimeout(UPLOAD_TIMEOUT_MS,signal=>fetch(`${API_BASE_URL}/api/admin/programs/${programId}/ppct/preview`,{
    method:"POST",headers:{Authorization:`Bearer ${s.accessToken}`},body:form,signal,
  }));
  const payload=await response.json().catch(()=>null) as ApiEnvelope<PpctPreview>|null;
  if(!response.ok||!payload?.success)throw new Error(payload?.message||`KhÃ´ng Ä‘á»c Ä‘Æ°á»£c tá»‡p PPCT (${response.status})`);
  return payload.data;
}
// `dong` gá»­i cáº£ báº£n Ä‘Ã£ sá»­a; server chá»‰ Ä‘á»c chiSo/maMach/tenMach/soTiet/tuan/hocKy/phanLoai/tieuDe/lessonId.
export const confirmPpct=(s:AuthSession,programId:number,x:{objectKey:string;dong:PpctRow[]})=>request<{soMach:number;soTiet:number;soTuan:number}>(`/admin/programs/${programId}/ppct/confirm`,{method:"POST",body:JSON.stringify(x)},s.accessToken);
// ====================== Lá»‹ch tuáº§n cá»§a khÃ³a â€” nhá»‹p dáº¡y & tá»± tÃ­nh ngÃ y há»c xong (PP-7 Táº¦NG 3) ======================
export type LichTuanDong={id:number|null;soTuan:number|null;batDau:string;ketThuc:string;nghi:boolean;nhanNghi:string|null;suaTay:boolean};
export type LichTuanKetQua={
  tuan:LichTuanDong[];soTuan:number;soTuanNghi:number;soTuanBoQua:number;ngayDau:string|null;ngayCuoi:string|null;
  nhipMoiTuan:number|null;soTuanCanThiet:number;soTuanKhaDung:number|null;ngayHoanThanhDuKien:string|null;canhBao:string|null;
  ngayKetThucKhoaDaCapNhat?:string;baiGiaoDaDoi?:number;
};
export type LichTuanYeuCau={ngayBatDau?:string;tuTuan?:number;tietMoiTuan?:number};
export function xemTruocLichTuan(s:AuthSession,khoaId:number,x:LichTuanYeuCau={}){
  const q=new URLSearchParams();
  if(x.ngayBatDau)q.set("ngayBatDau",x.ngayBatDau);
  if(x.tuTuan!=null)q.set("tuTuan",String(x.tuTuan));
  if(x.tietMoiTuan!=null)q.set("tietMoiTuan",String(x.tietMoiTuan));
  const qs=q.toString();
  return request<LichTuanKetQua>(`/admin/course-instances/${khoaId}/weeks/preview${qs?`?${qs}`:""}`,{},s.accessToken);
}
export const sinhLichTuan=(s:AuthSession,khoaId:number,x:LichTuanYeuCau)=>request<LichTuanKetQua>(`/admin/course-instances/${khoaId}/weeks`,{method:"POST",body:JSON.stringify({ngayBatDau:x.ngayBatDau||undefined,tuTuan:x.tuTuan,tietMoiTuan:x.tietMoiTuan})},s.accessToken);
// ====================== PPCT Cáº¥u trÃºc (auto-import) ======================
export type CauTrucBai={tenBai:string;thuTu:number;tuanBatDau:number;soTiet:number;maMach:string};
export type CauTrucChuong={tenChuong:string;thuTu:number;bai:CauTrucBai[]};
export type ImportResult={soTaoMoiChuong:number;soCapNhatChuong:number;soTaoMoiBai:number;soCapNhatBai:number;tongChuong:number;tongBai:number};
export const previewCauTruc=(s:AuthSession,programId:number,file:File):Promise<{success:boolean;data:CauTrucChuong[];message:string}>=> {
  const fd=new FormData();fd.append("file",file);
  return fetch(`${API_BASE_URL}/api/admin/programs/${programId}/cau-truc/preview`,{method:"POST",headers:{Authorization:`Bearer ${s.accessToken}`},body:fd}).then(r=>r.json());
};
export const confirmCauTruc=(s:AuthSession,programId:number,ds:CauTrucChuong[])=>request<ImportResult>(`/admin/programs/${programId}/cau-truc/confirm`,{method:"POST",body:JSON.stringify(ds)},s.accessToken);
export type ProgramImportIssue={row:number;column:string;code:string;message:string};
export type ProgramImportRow={row:number;namespace?:string;strandCode:string;strandName:string;semester:number;periodNo:number;weekNo:number;chapterNumeral:string;chapterName:string;lessonName:string;kind:string;inferredBy?:string};
export type ProgramImportLesson={name:string;normalizedName:string;kind:string;totalPeriods:number;firstWeek:number;lastWeek:number;periods:ProgramImportRow[];inferredBy?:string};
export type ProgramImportChapter={numeral:string;name:string;totalPeriods:number;lessons:ProgramImportLesson[]};
export type ProgramImportStrand={code:string;name:string;totalPeriods:number;chapters:ProgramImportChapter[]};
export type ProgramImportPreview={previewToken:string;info:{code:string;name:string;subject:string;grade:number;totalPeriods:number;totalWeeks:number;version:number};derived:{strands:ProgramImportStrand[];chapterCount:number;lessonCount:number;periodCount:number};errors:ProgramImportIssue[];warnings:ProgramImportIssue[]};
export type ProgramImportConfirm={courseId:number;created:{strands:number;chapters:number;lessons:number;periods:number}};
export type ProgramImportColumnSample={index:number;header:string;samples:string[];suggestedField:string};
export type ProgramImportParseResult={parseToken:string;format:string;columns:ProgramImportColumnSample[];suggestedMapping:Record<number,string>;rowCount:number};

export const parseProgramCourse=(s:AuthSession,file?:File|null,pasted?:string)=>{const fd=new FormData();if(file)fd.append("file",file);if(pasted)fd.append("pasted",pasted);return request<ProgramImportParseResult>("/admin/program-courses/import/parse",{method:"POST",body:fd},s.accessToken);};
export const previewProgramCourse=(s:AuthSession,file:File,sourceCourseId?:number)=>{const fd=new FormData();fd.append("file",file);if(sourceCourseId)fd.append("sourceCourseId",String(sourceCourseId));return request<ProgramImportPreview>("/admin/program-courses/import/preview",{method:"POST",body:fd},s.accessToken);};
export const confirmProgramCourse=(s:AuthSession,previewToken:string)=>request<ProgramImportConfirm>("/admin/program-courses/import/confirm",{method:"POST",body:JSON.stringify({previewToken})},s.accessToken);
export const getProgramCourseTree=(s:AuthSession,courseId:number)=>request<ProgramImportPreview["derived"]>(`/admin/program-courses/${courseId}/tree`,{},s.accessToken);
export async function downloadProgramCourseTemplate(s:AuthSession){const response=await fetch(`${API_BASE_URL}/api/admin/program-courses/import/template`,{headers:{Authorization:`Bearer ${s.accessToken}`}});if(!response.ok)throw new Error("KhÃ´ng táº£i Ä‘Æ°á»£c file máº«u PPCT");const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="program-course-import.xlsx";a.click();URL.revokeObjectURL(url);}

// ==================== Lá»‹ch há»c & Máº«u lá»‹ch tuáº§n (G7-G11) ====================
export type ScheduleSlot={id?:number;dayOfWeek:number;startTime:string;durationMin:number;periods:number};
export type ScheduleBreakPeriod={from:string;to:string;note?:string};
export type ScheduleCalculateRequest={startDate:string;totalPeriods:number;breaks?:ScheduleBreakPeriod[]};
export type ScheduleHolidayHit={date:string;name:string;sessionNo:number};
export type ScheduleCalculateResult={weeks:number;sessions:number;endDate:string;lastSessionPeriods:number;holidayHits:ScheduleHolidayHit[];explanation:string};
export type ScheduleReverseRequest={startDate:string;endDate:string;totalPeriods:number};
export type ScheduleReverseResult={requiredSessionsPerWeek:number;explanation:string};
export type ScheduleHoliday={id:number;holidayDate:string;name:string;isDayOff:boolean;year:number;note?:string};

export const getScheduleSlots=(s:AuthSession,classId:number)=>request<ScheduleSlot[]>(`/admin/classes/${classId}/schedule-slots`,{},s.accessToken);
export const updateScheduleSlots=(s:AuthSession,classId:number,slots:ScheduleSlot[])=>request<ScheduleSlot[]>(`/admin/classes/${classId}/schedule-slots`,{method:"PUT",body:JSON.stringify(slots)},s.accessToken);
export const calculateSchedule=(s:AuthSession,classId:number,req:ScheduleCalculateRequest)=>request<ScheduleCalculateResult>(`/admin/classes/${classId}/schedule/calculate`,{method:"POST",body:JSON.stringify(req)},s.accessToken);
export const calculateReverseSchedule=(s:AuthSession,classId:number,req:ScheduleReverseRequest)=>request<ScheduleReverseResult>(`/admin/classes/${classId}/schedule/calculate-reverse`,{method:"POST",body:JSON.stringify(req)},s.accessToken);
export const getHolidays=(s:AuthSession,year?:number)=>request<ScheduleHoliday[]>(`/admin/holidays${year?`?year=${year}`:""}`,{},s.accessToken);

// =============================================================
export const removeEnrollment=(s:AuthSession,type:"class-teachers"|"class-students"|"class-courses",id:number)=>request<void>(`/enrollments/${type}/${id}`,{method:"DELETE"},s.accessToken);
export const getAssignments=(s:AuthSession,classId:number)=>request<Assignment[]>(`/assignments?classId=${classId}`,{},s.accessToken);
export type AssignmentCommon={lessonId:number|null;worksheetId:number|null;documentId?:number|null;title:string;openAt?:string|null;dueAt:string|null;status:string;requirement?:ClassRequirement;maxAttempts?:number;latePolicy?:LatePolicy;latePenaltyPercent?:number;publishScoreAt?:string|null;anchorPeriodId?:number|null;dueBufferMinutes?:number|null;taskKind?:TaskKind;answerReveal?:AnswerReveal;countsInGradebook?:boolean;studentIds?:number[]};
export type AssignmentInput=AssignmentCommon&{classId:number};
/** Nhiá»u lá»›p = N bÃ i giao riÃªng biá»‡t. Nhiá»u lá»›p thÃ¬ `studentIds` pháº£i rá»—ng â€” server tá»« chá»‘i. */
export type AssignmentBatchInput=AssignmentCommon&{classIds:number[]};
export const saveAssignment=(s:AuthSession,x:AssignmentInput,id?:number)=>request<Assignment>(`/assignments${id?`/${id}`:""}`,{method:id?"PUT":"POST",body:JSON.stringify(x)},s.accessToken);
export const deleteAssignment=(s:AuthSession,id:number)=>request<void>(`/assignments/${id}`,{method:"DELETE"},s.accessToken);
export const createAssignmentBatch=(s:AuthSession,x:AssignmentBatchInput)=>request<Assignment[]>("/assignments/batch",{method:"POST",body:JSON.stringify(x)},s.accessToken);
/**
 * Má»™t tiáº¿t cá»§a chÆ°Æ¡ng trÃ¬nh lá»›p Ä‘ang cháº¡y. `week_starts_on`/`week_ends_on` lÃ  ngÃ y cá»§a khÃ³a
 * (`course_weeks`) chá»© khÃ´ng pháº£i ngÃ y cá»§a tiáº¿t â€” buá»•i váº«n khÃ´ng mang ngÃ y. `closed_at` rá»—ng
 * nghÄ©a lÃ  lá»›p chÆ°a há»c xong tiáº¿t nÃ y.
 */
export type ClassPeriod={id:number;period_no:number;week_no:number|null;term:string|null;title:string|null;period_kind:string|null;lesson_id:number|null;strand_id:number;strand_name:string;strand_order:number;week_starts_on:string|null;week_ends_on:string|null;closed_at:string|null;note:string|null;so_bai_neo:number;course_instance_id:number|null};
export type PeriodSuggestion={worksheet_id:number;name:string;resource_id:number;lesson_id:number;lesson_name:string};
export type ClosePeriodResult={closedAt:string;assignmentsOpened:number;suggestions:PeriodSuggestion[]};
export const getClassPeriods=(s:AuthSession,classId:number)=>request<ClassPeriod[]>(`/classes/${classId}/periods`,{},s.accessToken);
export const closeClassPeriod=(s:AuthSession,classId:number,periodId:number,x:{closedAt?:string|null;note?:string|null}={})=>request<ClosePeriodResult>(`/classes/${classId}/periods/${periodId}/close`,{method:"POST",body:JSON.stringify(x)},s.accessToken);
export const reopenClassPeriod=(s:AuthSession,classId:number,periodId:number)=>request<void>(`/classes/${classId}/periods/${periodId}/close`,{method:"DELETE"},s.accessToken);
/** `hanNop` rá»—ng kÃ¨m `lyDoTrong` lÃ  cÃ¢u tráº£ lá»i há»£p lá»‡ â€” in Ä‘Ãºng lÃ½ do áº¥y, khÃ´ng Ä‘oÃ¡n má»™t ngÃ y. */
export type HanTheoBuoi={moLuc:string|null;hanNop:string|null;lyDoTrong:string|null};
export const getPeriodDeadline=(s:AuthSession,classId:number,periodId:number,demPhut?:number|null)=>request<HanTheoBuoi>(`/classes/${classId}/periods/${periodId}/han${demPhut==null?"":`?demPhut=${demPhut}`}`,{},s.accessToken);

// ==================== Phiáº¿u Ä‘Ã£ giao: xem áº£nh hÆ°á»Ÿng, sá»­a háº¹p má»™t cÃ¢u ====================
export type WorksheetImpactRow={assignment_id:number;title:string;class_id:number;class_name:string|null;status:string;open_at:string|null;due_at:string|null;so_da_nop:number};
export const publishWorksheet=(s:AuthSession,id:number)=>request<Worksheet>(`/worksheets/${id}/publish`,{method:"POST"},s.accessToken);
export const cloneWorksheet=(s:AuthSession,id:number)=>request<Worksheet>(`/worksheets/${id}/clone`,{method:"POST"},s.accessToken);
export const getWorksheetImpact=(s:AuthSession,id:number)=>request<WorksheetImpactRow[]>(`/worksheets/${id}/anh-huong`,{},s.accessToken);
export const patchWorksheetItem=(s:AuthSession,itemId:number,x:{contentSnapshot?:string;optionASnapshot?:string;optionBSnapshot?:string;optionCSnapshot?:string;optionDSnapshot?:string;answerSnapshot?:string;solutionSnapshot?:string})=>request<{worksheetId:number;soBaiCanChamLai:number}>(`/worksheets/items/${itemId}`,{method:"PATCH",body:JSON.stringify(x)},s.accessToken);

// ==================== Lá»›p há» c: chÆ°Æ¡ng trÃ¬nh, tÃ i liá»‡u, theo dÃµi ====================
export const getClassProgramCurriculum=(s:AuthSession,classId:number)=>request<ClassProgramCurriculumResponse>(`/classes/${classId}/program-curriculum`,{},s.accessToken);
export const getClassCurriculum=(s:AuthSession,classId:number)=>request<ClassCurriculumItem[]>(`/classes/${classId}/curriculum`,{},s.accessToken);
export const addClassCurriculum=(s:AuthSession,classId:number,taxonomyNodeId:number,note?:string|null)=>request<void>(`/classes/${classId}/curriculum`,{method:"POST",body:JSON.stringify({taxonomyNodeId,note:note??null})},s.accessToken);
export const removeClassCurriculum=(s:AuthSession,classId:number,id:number)=>request<void>(`/classes/${classId}/curriculum/${id}`,{method:"DELETE"},s.accessToken);
export const updateClassCurriculumNote=(s:AuthSession,classId:number,id:number,note?:string|null)=>request<void>(`/classes/${classId}/curriculum/${id}`,{method:"PATCH",body:JSON.stringify({note:note??null})},s.accessToken);
export const updateClassCurriculumItem=(s:AuthSession,classId:number,id:number,patch:{note?:string|null;orderNo?:number|null})=>request<void>(`/classes/${classId}/curriculum/${id}`,{method:"PATCH",body:JSON.stringify(patch)},s.accessToken);
export const getClassDocuments=(s:AuthSession,classId:number)=>request<ClassDocumentItem[]>(`/classes/${classId}/documents`,{},s.accessToken);
/** Má»™t má»¥c há»c liá»‡u Ä‘Ã£ qua LuongNoiDung.hocLieuChoBuoi() â€” fileUrl Ä‘Ã£ qua cá»­a /api/files/{id}/download (moDuocTep), an toÃ n Ä‘á»ƒ Ä‘Æ°a thẳng vÃ o openDocumentFile. */
export type HocLieuItem={id:number;loaiNguon:string;nguonId:number;tieuDe:string;thuTu:number;docType?:string|null;fileUrl?:string|null;chuongId?:number|null;chuongTen?:string|null;chuongThuTu?:number|null;baiId?:number|null;baiTen?:string|null;baiThuTu?:number|null};
export type HocLieuResponse={theoNoiDung:HocLieuItem[];riengLop:HocLieuItem[]};
export const getClassHocLieu=(s:AuthSession,classId:number,scheduleId?:number)=>request<HocLieuResponse>(`/classes/${classId}/hoc-lieu${scheduleId?`?scheduleId=${scheduleId}`:""}`,{},s.accessToken);
export function getClassDocumentLibrary(s:AuthSession,classId:number,f:{search?:string;source?:string;taxonomyNodeId?:number}={}){
 const p=new URLSearchParams();if(f.search)p.set("search",f.search);if(f.source)p.set("source",f.source);if(f.taxonomyNodeId)p.set("taxonomyNodeId",String(f.taxonomyNodeId));
 const query=p.toString();return request<ClassLibraryDocument[]>(`/classes/${classId}/document-library${query?`?${query}`:""}`,{},s.accessToken);
}
export const attachClassDocument=(s:AuthSession,classId:number,x:{documentId:number;requirement:ClassRequirement;note?:string|null})=>request<void>(`/classes/${classId}/documents`,{method:"POST",body:JSON.stringify(x)},s.accessToken);
export const updateClassDocument=(s:AuthSession,classId:number,id:number,x:{requirement?:ClassRequirement;note?:string|null})=>request<void>(`/classes/${classId}/documents/${id}`,{method:"PATCH",body:JSON.stringify(x)},s.accessToken);
export const detachClassDocument=(s:AuthSession,classId:number,id:number)=>request<void>(`/classes/${classId}/documents/${id}`,{method:"DELETE"},s.accessToken);
export const getClassProgress=(s:AuthSession,classId:number)=>request<ClassStudentProgressRow[]>(`/classes/${classId}/progress`,{},s.accessToken);
export function getClassSubmissionLog(s:AuthSession,classId:number,f:{studentId?:number;limit?:number}={}){
 const p=new URLSearchParams();if(f.studentId)p.set("studentId",String(f.studentId));if(f.limit)p.set("limit",String(f.limit));
 const query=p.toString();return request<SubmissionLogRow[]>(`/classes/${classId}/submission-log${query?`?${query}`:""}`,{},s.accessToken);
}

// ==================== Lá»›p há»c: danh sÃ¡ch há»c sinh ====================
export const getClassRoster=(s:AuthSession,classId:number)=>request<RosterStudent[]>(`/classes/${classId}/roster`,{},s.accessToken);
export const getRosterCandidates=(s:AuthSession,classId:number,search:string)=>request<RosterCandidate[]>(`/classes/${classId}/roster/candidates?search=${encodeURIComponent(search)}`,{},s.accessToken);
export const addRosterStudent=(s:AuthSession,classId:number,x:{userId?:number;fullName?:string;username?:string;email?:string;phone?:string;password?:string})=>request<number>(`/classes/${classId}/roster/students`,{method:"POST",body:JSON.stringify(x)},s.accessToken);
export const removeRosterStudent=(s:AuthSession,classId:number,enrollmentId:number)=>request<void>(`/classes/${classId}/roster/students/${enrollmentId}`,{method:"DELETE"},s.accessToken);
export async function uploadClassRoster(s:AuthSession,classId:number,file:File){
 const contentType=file.type||"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
 const presign=await request<{uploadUrl:string;objectKey:string}>(`/classes/${classId}/roster/import/presign`,{method:"POST",body:JSON.stringify({fileName:file.name,contentType})},s.accessToken);
 if(!presign.uploadUrl||!presign.objectKey)throw new Error("API khÃ´ng tráº£ vá» URL táº£i lÃªn");
 const uploaded=await withTimeout(UPLOAD_TIMEOUT_MS,signal=>fetch(presign.uploadUrl,{method:"PUT",headers:{"Content-Type":contentType},body:file,signal}));
 if(!uploaded.ok)throw new Error(`Táº£i file lÃªn R2 tháº¥t báº¡i (${uploaded.status})`);
 return request<RosterImportPreview>(`/classes/${classId}/roster/import/preview`,{method:"POST",body:JSON.stringify({objectKey:presign.objectKey})},s.accessToken);
}
export const confirmClassRoster=(s:AuthSession,classId:number,objectKey:string)=>request<RosterImportResult>(`/classes/${classId}/roster/import/confirm`,{method:"POST",body:JSON.stringify({objectKey})},s.accessToken);
export async function downloadRosterTemplate(s:AuthSession,classId:number){
 const response=await withTimeout(FILE_TIMEOUT_MS,signal=>fetch(`${API_BASE_URL}/api/classes/${classId}/roster/import/template`,{headers:{Authorization:`Bearer ${s.accessToken}`},signal}));
 if(!response.ok)throw new Error("KhÃ´ng thá»ƒ táº£i file máº«u");
 const url=URL.createObjectURL(await response.blob());const link=document.createElement("a");link.href=url;link.download="danh-sach-hoc-sinh.xlsx";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

// ==================== Lá»›p há»c: há»c sinh xem lá»›p cá»§a mÃ¬nh ====================
export const getMyClasses=(s:AuthSession)=>request<MyClass[]>("/student/classes",{},s.accessToken);
export const getMyClassTasks=(s:AuthSession,classId:number)=>request<MyClassTask[]>(`/student/classes/${classId}/tasks`,{},s.accessToken);
export const getMyClassSubmissionLog=(s:AuthSession,classId:number,limit=100)=>request<SubmissionLogRow[]>(`/student/classes/${classId}/submission-log?limit=${limit}`,{},s.accessToken);

// ==================== Lá»›p há»c: Admin xem lá»›p theo giÃ¡o viÃªn phá»¥ trÃ¡ch ====================
export function getAdminClassOverview(s:AuthSession,f:{search?:string;gradeId?:number;status?:string}={}){
 const p=new URLSearchParams();if(f.search)p.set("search",f.search);if(f.gradeId)p.set("gradeId",String(f.gradeId));if(f.status)p.set("status",f.status);
 const query=p.toString();return request<AdminClassOverviewRow[]>(`/admin/class-overview${query?`?${query}`:""}`,{},s.accessToken);
}

// ==================== Vá»‹ trÃ­ há»c gáº§n nháº¥t (ná»n cho nÃºt "Há»c tiáº¿p") ====================
/** LÆ°u á»Ÿ server chá»© khÃ´ng pháº£i localStorage, Ä‘á»ƒ Ä‘á»•i mÃ¡y váº«n há»c tiáº¿p Ä‘Æ°á»£c. */
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
/** Gá»­i null lÃ  gá»¡ phÃ¢n loáº¡i. ÄÆ°á»ng riÃªng chá»© khÃ´ng gá»™p vÃ o updateDocument, vÃ¬ thÃ¢n PUT khÃ´ng mang trÆ°á»ng nÃ y. */
export const setDocumentContentGroup=(s:AuthSession,id:number,contentGroup:ContentGroup|null)=>request<DocumentItem>(`/admin/documents/${id}/content-group`,{method:"PATCH",body:JSON.stringify({contentGroup})},s.accessToken);
export const getContentGroupCounts=(s:AuthSession)=>request<ContentGroupCounts>("/admin/documents/content-groups",{},s.accessToken);
export const getTeacherDocuments=(s:AuthSession)=>request<DocumentItem[]>("/teacher/documents",{},s.accessToken);
/**
 * Má»Ÿ file tÃ i liá»‡u. fileUrl tá»« API luÃ´n lÃ  Ä‘Æ°á»ng dáº«n tÆ°Æ¡ng Ä‘á»‘i tá»›i endpoint cÃ³ xÃ¡c thá»±c
 * (/api/documents/{id}/content.pdf) nÃªn pháº£i fetch kÃ¨m token rá»“i má»›i má»Ÿ blob â€” má»Ÿ tháº³ng
 * URL lÃ  máº¥t header Authorization, vÃ  Ä‘Ã³ chÃ­nh lÃ  chá»— trÆ°á»›c Ä‘Ã¢y bá» qua kiá»ƒm quyá»n.
 * Chá»‰ VIDEO má»›i cÃ²n lÃ  URL tuyá»‡t Ä‘á»‘i (link ngoÃ i), má»Ÿ tháº³ng Ä‘Æ°á»£c.
 */
export async function openDocumentFile(s:AuthSession,fileUrl:string,title:string,startPage?:number|null){
 openDocumentViewer({session:s,fileUrl,title,startPage});
}
/** Đường cũ: mở file ở tab mới của trình duyệt (nút "Mở tab mới"/tải về trong trình xem). */
export async function openDocumentFileInNewTab(s:AuthSession,fileUrl:string,title:string,startPage?:number|null){
 const pageHash=startPage&&startPage>0?`#page=${startPage}`:"";
 if(/^https?:\/\//i.test(fileUrl)){window.open(`${fileUrl}${pageHash}`,"_blank","noreferrer");return}
 const response=await withTimeout(FILE_TIMEOUT_MS,signal=>fetch(`${API_BASE_URL}${fileUrl}`,{headers:{Authorization:`Bearer ${s.accessToken}`},signal}));
 if(!response.ok)throw new Error(`KhÃ´ng thá»ƒ má»Ÿ tÃ i liá»‡u (${response.status})`);
 const blob=await response.blob();if(!blob.size)return;
 const objectUrl=URL.createObjectURL(blob);const url=`${objectUrl}${pageHash}`;const win=window.open(url,"_blank","noreferrer");
 if(!win){const a=document.createElement("a");a.href=url;a.download=title;a.click()}
 setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
}
/** URL byte PDF cho trÃ¬nh xem trong app (PdfViewer tá»± fetch kÃ¨m Authorization). */
/** Tải byte file (kèm token) về object URL để phát video tải lên trong thẻ video. Nhớ revoke khi đóng. */
export async function fetchDocumentObjectUrl(s:AuthSession,fileUrl:string){
 const response=await fetch(`${API_BASE_URL}${fileUrl}`,{headers:{Authorization:`Bearer ${s.accessToken}`}});
 if(!response.ok)throw new Error(`Không thể mở tài liệu (${response.status})`);
 return URL.createObjectURL(await response.blob());
}
export const documentContentUrl=(id:number)=>`${API_BASE_URL}/api/documents/${id}/content`;
export const lessonDocumentContentUrl=(lessonId:number,id:number)=>`${API_BASE_URL}/api/lessons/${lessonId}/documents/${id}/content`;
export async function openLessonDocumentFile(s:AuthSession,lessonId:number,document:LessonDocument){
 const allowed=await request<DocumentOpen>(`/lessons/${lessonId}/documents/${document.id}/open`,{},s.accessToken);
 return openDocumentFile(s,allowed.fileUrl,allowed.title||document.title,allowed.startPage);
}
export async function uploadDocument(s:AuthSession,x:{title:string;docType:string;audience:string;gradeId?:number|null;taxonomyNodeId?:number|null;file?:File|null;videoUrl?:string|null;folderId?:number|null}){
 const form=new FormData();form.append("title",x.title);form.append("docType",x.docType);form.append("audience",x.audience);if(x.gradeId)form.append("gradeId",String(x.gradeId));if(x.taxonomyNodeId)form.append("taxonomyNodeId",String(x.taxonomyNodeId));if(x.file)form.append("file",x.file);if(x.videoUrl)form.append("videoUrl",x.videoUrl);if(x.folderId)form.append("folderId",String(x.folderId));
 const response=await withTimeout(UPLOAD_TIMEOUT_MS,signal=>fetch(`${API_BASE_URL}/api/admin/documents`,{method:"POST",headers:{Authorization:`Bearer ${s.accessToken}`},body:form,signal}));
 const payload=await response.json() as ApiEnvelope<DocumentItem>;if(!response.ok||!payload.success)throw new Error(payload.message||"Táº£i tÃ i liá»‡u tháº¥t báº¡i");return payload.data;
}
export async function uploadTeacherDocument(s:AuthSession,x:{title:string;docType:string;audience:string;gradeId?:number|null;chapterId?:number|null;file?:File|null;videoUrl?:string|null}){
 const form=new FormData();form.append("title",x.title);form.append("docType",x.docType);form.append("audience",x.audience);if(x.gradeId)form.append("gradeId",String(x.gradeId));if(x.chapterId)form.append("chapterId",String(x.chapterId));if(x.file)form.append("file",x.file);if(x.videoUrl)form.append("videoUrl",x.videoUrl);
 const response=await withTimeout(UPLOAD_TIMEOUT_MS,signal=>fetch(`${API_BASE_URL}/api/teacher/documents`,{method:"POST",headers:{Authorization:`Bearer ${s.accessToken}`},body:form,signal}));
 const payload=await response.json() as ApiEnvelope<DocumentItem>;if(!response.ok||!payload.success)throw new Error(payload.message||"Táº£i tÃ i liá»‡u tháº¥t báº¡i");return payload.data;
}
export const updateTeacherDocument=(s:AuthSession,id:number,x:{title:string;docType:string;audience:string;gradeId?:number|null;chapterId?:number|null})=>request<DocumentItem>(`/teacher/documents/${id}`,{method:"PUT",body:JSON.stringify(x)},s.accessToken);
export const archiveTeacherDocument=(s:AuthSession,id:number)=>request<DocumentItem>(`/teacher/documents/${id}/archive`,{method:"PATCH"},s.accessToken);
export const restoreTeacherDocument=(s:AuthSession,id:number)=>request<DocumentItem>(`/teacher/documents/${id}/restore`,{method:"PATCH"},s.accessToken);
export type AdminDocumentFolder={id:number;name:string;parentId:number|null;documentCount:number;createdAt:string};
export const getAdminDocumentFolders=(s:AuthSession)=>request<AdminDocumentFolder[]>("/admin/document-folders",{},s.accessToken);
export const createAdminDocumentFolder=(s:AuthSession,name:string,parentId:number|null)=>request<AdminDocumentFolder>("/admin/document-folders",{method:"POST",body:JSON.stringify({name,parentId})},s.accessToken);
export const renameAdminDocumentFolder=(s:AuthSession,id:number,name:string)=>request<AdminDocumentFolder>(`/admin/document-folders/${id}`,{method:"PUT",body:JSON.stringify({name})},s.accessToken);
export const moveAdminDocumentFolder=(s:AuthSession,id:number,parentId:number|null)=>request<AdminDocumentFolder>(`/admin/document-folders/${id}/parent`,{method:"PATCH",body:JSON.stringify({parentId})},s.accessToken);
export const deleteAdminDocumentFolder=(s:AuthSession,id:number)=>request<void>(`/admin/document-folders/${id}`,{method:"DELETE"},s.accessToken);
export const moveAdminDocuments=(s:AuthSession,documentIds:number[],folderId:number|null)=>request<number>("/admin/document-folders/documents",{method:"PATCH",body:JSON.stringify({documentIds,folderId})},s.accessToken);
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
 openDocumentViewer({session:s,fileUrl:info.fileUrl,title:info.title,startPage:info.pdfPage});
}
/** Mở tài liệu dùng chung: gói SCORM/xAPI trả về đường khởi chạy có token. */
export async function launchDocumentPackage(s:AuthSession,fileUrl:string){
 const path=fileUrl.replace(/^\/api/,"").replace(/\/content(\.[^/?#]*)?([?#].*)?$/,"/package/launch");
 const data=await request<{launchUrl:string}>(path,{method:"POST"},s.accessToken);
 return `${API_BASE_URL}${data.launchUrl}`;
}
export async function getAdminTextbooks(s:AuthSession){return request<TextbookItem[]>(`/admin/documents/textbooks`,{},s.accessToken)}
export async function uploadTextbook(s:AuthSession,x:{title:string;docType:string;audience:string;gradeId?:number|null;subjectId?:number|null;basePageOffset?:number;file:File}){
 const form=new FormData();form.append("title",x.title);form.append("docType",x.docType);form.append("audience",x.audience);
 if(x.gradeId)form.append("gradeId",String(x.gradeId));if(x.subjectId)form.append("subjectId",String(x.subjectId));
 if(x.basePageOffset)form.append("basePageOffset",String(x.basePageOffset));form.append("file",x.file);
 const response=await withTimeout(UPLOAD_TIMEOUT_MS,signal=>fetch(`${API_BASE_URL}/api/admin/documents/textbooks`,{method:"POST",headers:{Authorization:`Bearer ${s.accessToken}`},body:form,signal}));
 const payload=await response.json() as ApiEnvelope<TextbookItem>;if(!response.ok||!payload.success)throw new Error(payload.message||"Upload sÃ¡ch tháº¥t báº¡i");return payload.data;
}
export const updateTextbook=(s:AuthSession,id:number,x:{title:string;docType:string;audience:string;gradeId?:number|null;subjectId?:number|null;totalPages?:number|null;basePageOffset?:number})=>request<TextbookItem>(`/admin/documents/textbooks/${id}`,{method:"PUT",body:JSON.stringify(x)},s.accessToken);
export const publishTextbook=(s:AuthSession,id:number)=>request<TextbookItem>(`/admin/documents/textbooks/${id}/publish`,{method:"PATCH"},s.accessToken);
export const hideTextbook=(s:AuthSession,id:number)=>request<TextbookItem>(`/admin/documents/textbooks/${id}/hide`,{method:"PATCH"},s.accessToken);
// ====================== Káº¿ hoáº¡ch giáº£ng dáº¡y (Teaching Plans) ======================
export type TeachingPlan = {
  id: number; course_id: number; course_name: string; template_id: number | null;
  name: string; description: string | null; total_weeks: number; total_periods: number;
  status: string; item_count: number;
};
export type TeachingPlanInput = {
  courseId: number; name: string; description?: string;
  totalWeeks?: number; totalPeriods?: number; status?: string;
};

export const getTeachingPlans = (s: AuthSession, courseId?: number) =>
  request<TeachingPlan[]>(`/admin/teaching-plans${courseId ? `?courseId=${courseId}` : ''}`, {}, s.accessToken);
export const getTeachingPlan = (s: AuthSession, id: number) =>
  request<TeachingPlan>(`/admin/teaching-plans/${id}`, {}, s.accessToken);
export const createTeachingPlan = (s: AuthSession, x: TeachingPlanInput) =>
  request<TeachingPlan>('/admin/teaching-plans', { method: 'POST', body: JSON.stringify(x) }, s.accessToken);
export const updateTeachingPlan = (s: AuthSession, id: number, x: TeachingPlanInput) =>
  request<TeachingPlan>(`/admin/teaching-plans/${id}`, { method: 'PUT', body: JSON.stringify(x) }, s.accessToken);
export const getTeachingPlanItems = (s: AuthSession, planId: number) =>
  request<any[]>(`/admin/teaching-plans/${planId}/items`, {}, s.accessToken);

// ====================== Lá»‹ch tuáº§n cá»§a khÃ³a há»c (Course Weekly Schedule) ======================
export type WeeklySlot = { id: number; day_of_week: string; period_count: number; order_index: number };
export type WeeklySlotInput = { dayOfWeek: string; periodCount: number };

export const getCourseWeeklySchedule = (s: AuthSession, khoaId: number) =>
  request<WeeklySlot[]>(`/admin/course-instances/${khoaId}/weekly-schedule`, {}, s.accessToken);
export const saveCourseWeeklySchedule = (s: AuthSession, khoaId: number, slots: WeeklySlotInput[]) =>
  request<WeeklySlot[]>(`/admin/course-instances/${khoaId}/weekly-schedule`, { method: 'PUT', body: JSON.stringify(slots) }, s.accessToken);

// ====================== NgÃ y nghá»‰ cá»§a khÃ³a há»c (Course Holidays) ======================
export type CourseHoliday = {
  id: number; course_instance_id: number; starts_on: string; ends_on: string;
  type: string; name: string; description: string | null;
};
export type CourseHolidayInput = { startsOn: string; endsOn: string; name: string; type?: string; description?: string };

export const getCourseHolidays = (s: AuthSession, khoaId: number) =>
  request<CourseHoliday[]>(`/admin/course-instances/${khoaId}/holidays`, {}, s.accessToken);
export const addCourseHoliday = (s: AuthSession, khoaId: number, x: CourseHolidayInput) =>
  request<CourseHoliday>(`/admin/course-instances/${khoaId}/holidays`, { method: 'POST', body: JSON.stringify(x) }, s.accessToken);
export const removeCourseHoliday = (s: AuthSession, id: number) =>
  request<void>(`/admin/course-holidays/${id}`, { method: 'DELETE' }, s.accessToken);

// ====================== Lá»‹ch tiáº¿t (Course Sessions) ======================
export type CourseSessionRow = {
  id: number; program_period_id: number; period_title: string; strand_name: string;
  instructional_week_number: number; planned_date: string; planned_order_on_date: number;
  status: string; edited_manually: boolean;
};
export type GeneratePreview = {
  totalSessions: number; projectedEndDate: string | null;
  totalRequired: number; totalAvailable: number; feasible: boolean; warning: string | null;
  manualSessionsPreserved: number; sessions: CourseSessionRow[] | null;
};

export const previewCourseSessions = (s: AuthSession, khoaId: number, teachingPlanId?: number) => {
  const p = teachingPlanId ? `?teachingPlanId=${teachingPlanId}` : '';
  return request<GeneratePreview>(`/admin/course-instances/${khoaId}/sessions/preview${p}`, {}, s.accessToken);
};
export const generateCourseSessions = (s: AuthSession, khoaId: number, teachingPlanId?: number) =>
  request<GeneratePreview>(`/admin/course-instances/${khoaId}/sessions/generate`, {
    method: 'POST', body: JSON.stringify({ keepManual: true, teachingPlanId })
  }, s.accessToken);
export const getCourseSessions = (s: AuthSession, khoaId: number, weekNumber?: number) => {
  const p = weekNumber ? `?weekNumber=${weekNumber}` : '';
  return request<CourseSessionRow[]>(`/course-instances/${khoaId}/sessions${p}`, {}, s.accessToken);
};

// ====================== Tiáº¿n Ä‘á»™ lá»›p (Class Progress) ======================
export type ClassProgressRow = {
  classId: number; className: string; courseInstanceId: number;
  completedPeriodCount: number; plannedPeriodCount: number; lech: number;
  trangThai: 'ON_TRACK' | 'BEHIND' | 'AHEAD';
  lastCompletedSessionId: number | null; lastCompletedDate: string | null;
};
export const getCourseClassProgress = (s: AuthSession, khoaId: number) =>
  request<ClassProgressRow[]>(`/course-instances/${khoaId}/class-progress`, {}, s.accessToken);

// =============================================================
// 3-Tier: Course Delivery Sessions + Class Schedule
// =============================================================

/** Buá»•i há»c cá»§a KhÃ³a â€” khÃ´ng cÃ³ ngÃ y thá»±c (cáº¥p Course). */
export type DeliverySession = {
  id: number; courseInstanceId: number; seq: number;
  sessionType: 'TEACHING' | 'REVIEW' | 'EXAM' | 'ACTIVITY';
  title: string | null; note: string | null; source: 'GENERATED' | 'MANUAL';
  continuation: boolean;
  strandName?: string | null;
  unitCount?: number;
};

/** Káº¿t quáº£ preview/generate delivery sessions. */
export type DeliverySessionUnitRow = {
  id: number | null; programPeriodId: number; orderInSession: number;
  periodNo: number; weekNo: number; title: string | null;
  periodKind: string | null; lessonId: number | null; strandName: string | null;
};
export type DeliverySessionRow = {
  id: number | null; courseInstanceId: number; seq: number;
  sessionType: 'TEACHING' | 'REVIEW' | 'EXAM' | 'ACTIVITY';
  title: string | null; note: string | null; source: string;
  continuation: boolean;
  strandName: string | null;
  units: DeliverySessionUnitRow[];
};
export type DeliveryGenerateResult = {
  totalSessions: number; dryRun: boolean; warnings: string[];
  sessions: DeliverySessionRow[];
};

/** Kết quả GET delivery-sessions — sessions + cấu hình hiện tại của khóa. */
export type SplitPolicy = 'KEEP_LESSON' | 'BALANCED' | 'FIXED_CAPACITY';
export type AssessmentPolicy = 'SEPARATE' | 'MERGE';

export type DeliverySessionsResult = {
  sessions: DeliverySession[];
  unitsPerSession: number | null;
  tietMoiTuan: number | null;
  splitPolicy: SplitPolicy;
  assessmentPolicy: AssessmentPolicy;
};

export type DeliverySessionGenOptions = {
  unitsPerSession?: number;
  splitPolicy?: SplitPolicy;
  assessmentPolicy?: AssessmentPolicy;
};

function normalizeDeliverySession<T extends {sessionType:string;continuation:boolean}>(row:T):T {
 const raw=row as T & Record<string,unknown>;
 return {...row,sessionType:raw.session_type??row.sessionType,continuation:raw.is_continuation??row.continuation,
   courseInstanceId:raw.course_instance_id??raw.courseInstanceId,strandName:raw.strand_name??raw.strandName,unitCount:raw.unit_count??raw.unitCount} as T;
}
export const getDeliverySessions = (s: AuthSession, instanceId: number) =>
  request<DeliverySessionsResult>(`/admin/course-instances/${instanceId}/delivery-sessions`, {}, s.accessToken).then(data=>({...data,sessions:data.sessions.map(normalizeDeliverySession)}));
export const previewDeliverySessions = (s: AuthSession, instanceId: number, opts?: DeliverySessionGenOptions) =>
  request<DeliveryGenerateResult>(`/admin/course-instances/${instanceId}/delivery-sessions/preview`, {
    method: 'POST',
    body: opts != null ? JSON.stringify(opts) : undefined
  }, s.accessToken);
export const generateDeliverySessions = (s: AuthSession, instanceId: number, opts?: DeliverySessionGenOptions) =>
  request<DeliveryGenerateResult>(`/admin/course-instances/${instanceId}/delivery-sessions/generate`, {
    method: 'POST',
    body: opts != null ? JSON.stringify(opts) : undefined
  }, s.accessToken);

/** Chi tiết một buổi kèm danh sách tiết — dùng để mở rộng một hàng buổi trong bảng. */
export type DeliverySessionDetail = {
  id: number; seq: number;
  sessionType: 'TEACHING' | 'REVIEW' | 'EXAM' | 'ACTIVITY';
  title: string | null; note: string | null; source: 'GENERATED' | 'MANUAL';
  continuation: boolean;
  units: DeliverySessionUnitRow[];
};

export const getDeliverySessionDetail = (s: AuthSession, instanceId: number, sessionId: number) =>
  request<DeliverySessionDetail>(`/admin/course-instances/${instanceId}/delivery-sessions/${sessionId}`, {}, s.accessToken).then(data=>({...normalizeDeliverySession(data),units:data.units.map(unit=>{
 const raw=unit as DeliverySessionUnitRow & Record<string,unknown>;
 return {...unit,programPeriodId:Number(raw.program_period_id??unit.programPeriodId),orderInSession:Number(raw.order_in_session??unit.orderInSession),
 periodNo:Number(raw.period_no??unit.periodNo),weekNo:Number(raw.week_no??unit.weekNo),
 periodKind:(raw.period_kind??unit.periodKind) as string|null,lessonId:(raw.lesson_id??unit.lessonId) as number|null,strandName:(raw.strand_name??unit.strandName) as string|null};
 })}));

/** Chuyển một tiết sang buổi khác — cân đối thủ công. Chỉ cho phép cùng mạch (backend tự kiểm tra). */
export const moveDeliverySessionUnit = (s: AuthSession, instanceId: number, unitId: number, targetSessionId: number) =>
  request<void>(`/admin/course-instances/${instanceId}/delivery-sessions/units/${unitId}/move`, {
    method: 'POST',
    body: JSON.stringify({ targetSessionId })
  }, s.accessToken);

/** Thêm một buổi trống mới — chèn sau afterSessionId (bỏ trống → đầu danh sách). */
export type InsertDeliverySessionOptions = {
  afterSessionId?: number;
  sessionType?: 'TEACHING' | 'REVIEW' | 'EXAM' | 'ACTIVITY';
  title?: string;
  note?: string;
};
export const insertDeliverySession = (s: AuthSession, instanceId: number, opts?: InsertDeliverySessionOptions) =>
  request<{ id: number }>(`/admin/course-instances/${instanceId}/delivery-sessions`, {
    method: 'POST',
    body: opts != null ? JSON.stringify(opts) : undefined
  }, s.accessToken);

/** Sửa tiêu đề/ghi chú/loại của một buổi — tự chuyển sang "Chỉnh tay" (MANUAL). */
export type UpdateDeliverySessionOptions = {
  title: string | null;
  note: string | null;
  sessionType: 'TEACHING' | 'REVIEW' | 'EXAM' | 'ACTIVITY';
};
export const updateDeliverySession = (s: AuthSession, instanceId: number, sessionId: number, opts: UpdateDeliverySessionOptions) =>
  request<void>(`/admin/course-instances/${instanceId}/delivery-sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify(opts)
  }, s.accessToken);

/** Xóa một buổi — backend chặn nếu buổi còn tiết hoặc còn lớp nào đang dùng trong lịch. */
export const deleteDeliverySession = (s: AuthSession, instanceId: number, sessionId: number) =>
  request<void>(`/admin/course-instances/${instanceId}/delivery-sessions/${sessionId}`, { method: 'DELETE' }, s.accessToken);

/** Má»™t dÃ²ng trong lá»‹ch ngÃ y thá»±c cá»§a Lá»›p (class_schedule). */
export type ClassScheduleRow = {
  id: number; seq: number;
  scheduledDate: string; startTime: string | null;
  status: 'PLANNED' | 'COMPLETED' | 'POSTPONED' | 'CANCELLED';
  taughtBy: number | null; completedAt: string | null;
  editedManually: boolean; isMakeup: boolean;
  note: string | null; sessionType: string; sessionTitle: string | null;
  periodFrom: number | null; periodTo: number | null;
};

export type ClassDayOff={id:number;starts_on:string;ends_on:string;reason:string|null};
export const getClassDaysOff=(s:AuthSession,id:number)=>request<ClassDayOff[]>(`/classes/${id}/schedule/days-off`,{},s.accessToken);
export const addClassDayOff=(s:AuthSession,id:number,input:{startsOn:string;endsOn:string;reason:string})=>request<void>(`/classes/${id}/schedule/days-off`,{method:"POST",body:JSON.stringify(input)},s.accessToken);
export const removeClassDayOff=(s:AuthSession,id:number,dayOffId:number)=>request<void>(`/classes/${id}/schedule/days-off/${dayOffId}`,{method:"DELETE"},s.accessToken);

export type ClassWeeklySlot = {id:number;dayOfWeek:number;startTime:string;durationMin:number;periods:number};

/** Káº¿t quáº£ generate/preview class schedule. */
export type ClassScheduleGenerateResult = {
  totalScheduled: number; projectedEndDate: string | null;
  keptManual: number; warnings: string[];
};

/** Tiáº¿n Ä‘á»™ lá»›p há»c. */
export type ClassScheduleProgress = {
  trangThai: 'ON_TRACK' | 'BEHIND' | 'AHEAD';
  theoKeHoach: number; thucTe: number; lech: number;
  tongBuoi: number; canhBao: boolean; projectedEndDate: string | null;
};

export const getClassSchedule = (s: AuthSession, classId: number) =>
  request<Array<ClassScheduleRow & Record<string, unknown>>>(`/classes/${classId}/schedule`, {}, s.accessToken).then(rows => rows.map(row => ({
    ...row,
    scheduledDate: String(row.scheduled_date ?? row.scheduledDate),
    startTime: (row.start_time ?? row.startTime ?? null) as string | null,
    sessionTitle: (row.session_title ?? row.sessionTitle ?? null) as string | null,
    sessionType: String(row.session_type ?? row.sessionType ?? ""),
    periodFrom: (row.period_from ?? row.periodFrom ?? null) as number | null,
    periodTo: (row.period_to ?? row.periodTo ?? null) as number | null,
  })));
export const getClassWeeklySlots = (s: AuthSession, classId: number) =>
  request<Array<ClassWeeklySlot & Record<string, unknown>>>(`/classes/${classId}/schedule/slots`, {}, s.accessToken).then(rows => rows.map(row => ({
    ...row, dayOfWeek: Number(row.day_of_week ?? row.dayOfWeek),
    startTime: String(row.start_time ?? row.startTime ?? ""),
    durationMin: Number(row.duration_min ?? row.durationMin),
  })));
export const previewClassSchedule = (s: AuthSession, classId: number) =>
  request<ClassScheduleGenerateResult>(`/classes/${classId}/schedule/preview`, {method: 'POST'}, s.accessToken);
export const generateClassSchedule = (s: AuthSession, classId: number) =>
  request<ClassScheduleGenerateResult>(`/classes/${classId}/schedule/generate`, {method: 'POST'}, s.accessToken);
export const regenerateClassSchedule = (s: AuthSession, classId: number) =>
  request<ClassScheduleGenerateResult>(`/classes/${classId}/schedule/regenerate`, {method: 'POST'}, s.accessToken);
export const completeClassSession = (s: AuthSession, classId: number, scheduleId: number) =>
  request<void>(`/classes/${classId}/schedule/${scheduleId}/complete`, {method: 'POST'}, s.accessToken);
export const postponeClassSession = (s: AuthSession, classId: number, scheduleId: number, note?: string) =>
  request<void>(`/classes/${classId}/schedule/${scheduleId}/postpone`, {method: 'POST', body: JSON.stringify({note: note ?? null})}, s.accessToken);

export type UpdateClassScheduleSessionInput = {
  scheduledDate?: string;
  startTime?: string | null;
  status?: 'PLANNED' | 'COMPLETED' | 'POSTPONED' | 'CANCELLED';
  note?: string | null;
  isMakeup?: boolean;
};

export type CreateClassScheduleSessionInput = {
  courseDeliverySessionId?: number;
  seq?: number;
  scheduledDate: string;
  startTime?: string | null;
  note?: string | null;
  isMakeup?: boolean;
};

export const updateClassScheduleSession = (s: AuthSession, classId: number, scheduleId: number, input: UpdateClassScheduleSessionInput) =>
  request<void>(`/classes/${classId}/schedule/${scheduleId}`, {method: 'PATCH', body: JSON.stringify(input)}, s.accessToken);

export const addClassScheduleSession = (s: AuthSession, classId: number, input: CreateClassScheduleSessionInput) =>
  request<{id: number; seq: number}>(`/classes/${classId}/schedule/sessions`, {method: 'POST', body: JSON.stringify(input)}, s.accessToken);

export const deleteClassScheduleSession = (s: AuthSession, classId: number, scheduleId: number) =>
  request<void>(`/classes/${classId}/schedule/${scheduleId}`, {method: 'DELETE'}, s.accessToken);

export const getClassScheduleProgress = (s: AuthSession, classId: number) =>
  request<ClassScheduleProgress>(`/classes/${classId}/schedule/progress`, {}, s.accessToken);
