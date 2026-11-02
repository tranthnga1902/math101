import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getClassProgramCurriculum, getClassCurriculum, addClassCurriculum, removeClassCurriculum,
  updateClassCurriculumNote, updateClassCurriculumItem, getTaxonomyTreeReadOnly,
  getEnrollments, addEnrollment, removeEnrollment, getCourseInstances, openDocumentFile,
  type AuthSession, type TaxonomyNode, type CourseInstance, type Enrollment,
  type ClassProgramCourse, type ClassProgramChapter, type ClassProgramLesson, type ClassProgramResource,
} from "../../api";
import { messageOf } from "../../lib/errors";

const ROOT = 0;
const depthLabel: Record<number, string> = { 1: "Chuyên đề", 2: "Bài", 3: "Dạng" };

function getResourceIcon(docType?: string | null, resType?: string) {
  if (resType === "VIDEO" || docType === "VIDEO") return "smart_display";
  if (docType === "PDF") return "picture_as_pdf";
  if (docType === "DOCX" || docType === "DOC") return "description";
  if (docType === "SLIDE" || docType === "PPTX") return "slideshow";
  return "description";
}

/**
 * Chương trình học của lớp:
 * 1. Chương trình Khóa học & Tài liệu học tập (SGK, SBT, Video, KHBD...) gán cho lớp.
 * 2. Quản lý Khóa học áp dụng cho lớp.
 * 3. Cây chuyên đề bổ sung riêng của lớp.
 */
export function ClassCurriculumPanel({ session, classId }: { session: AuthSession; classId: number }) {
  const queryClient = useQueryClient();
  const [picking, setPicking] = useState(false);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [note, setNote] = useState("");

  // Program curriculum view state
  const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>({});
  const [curriculumSearch, setCurriculumSearch] = useState("");
  const [docError, setDocError] = useState("");

  // Course assign state
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseSearch, setCourseSearch] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<number>(0);

  // Edit curriculum note state
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editNoteValue, setEditNoteValue] = useState("");

  // Drag & drop / reorder state
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  // Queries
  const programCurriculumQuery = useQuery({
    queryKey: ["class-program-curriculum", session.accessToken, classId],
    queryFn: () => getClassProgramCurriculum(session, classId),
  });
  const programData = programCurriculumQuery.data;
  const programCourses = programData?.courses ?? [];

  const listQuery = useQuery({
    queryKey: ["class-curriculum", session.accessToken, classId],
    queryFn: () => getClassCurriculum(session, classId),
  });
  const items = listQuery.data ?? [];

  const coursesQuery = useQuery({
    queryKey: ["class-courses", session.accessToken, classId],
    queryFn: () => getEnrollments(session, "class-courses", classId),
  });
  const assignedCourses = coursesQuery.data ?? [];

  const allCoursesQuery = useQuery({
    queryKey: ["all-course-instances", session.accessToken],
    queryFn: () => getCourseInstances(session),
    enabled: showCourseModal,
  });
  const allCourses = allCoursesQuery.data ?? [];

  const treeQuery = useQuery({
    queryKey: ["teacher-taxonomy-tree", session.accessToken],
    queryFn: () => getTaxonomyTreeReadOnly(session),
    enabled: picking,
  });
  const nodes = treeQuery.data ?? [];

  const childrenByParent = useMemo(() => {
    const map = new Map<number, TaxonomyNode[]>();
    for (const node of nodes) {
      const key = node.parentId ?? ROOT;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(node);
    }
    for (const list of map.values()) list.sort((a, b) => a.orderNo - b.orderNo);
    return map;
  }, [nodes]);
  const chosen = new Set(items.map(item => item.taxonomy_node_id));

  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["class-program-curriculum"] }),
    queryClient.invalidateQueries({ queryKey: ["class-curriculum"] }),
    queryClient.invalidateQueries({ queryKey: ["class-courses"] }),
    queryClient.invalidateQueries({ queryKey: ["class-detail-people"] }),
    queryClient.invalidateQueries({ queryKey: ["cp-people"] }),
  ]);

  // Mutations
  const addMutation = useMutation({
    mutationFn: (nodeId: number) => addClassCurriculum(session, classId, nodeId, note.trim() || null),
    onSuccess: async () => { await invalidate(); setNote(""); },
  });
  const removeMutation = useMutation({
    mutationFn: (id: number) => removeClassCurriculum(session, classId, id),
    onSuccess: invalidate,
  });
  const updateNoteMutation = useMutation({
    mutationFn: ({ id, noteText }: { id: number; noteText: string }) =>
      updateClassCurriculumNote(session, classId, id, noteText.trim() || null),
    onSuccess: async () => {
      await invalidate();
      setEditingItemId(null);
    },
  });

  const assignCourseMutation = useMutation({
    mutationFn: (courseInstanceId: number) =>
      addEnrollment(session, "class-courses", { classId, courseInstanceId }),
    onSuccess: async () => {
      await invalidate();
      setShowCourseModal(false);
      setSelectedCourseId(0);
    },
  });

  const removeCourseMutation = useMutation({
    mutationFn: (enrollmentId: number) =>
      removeEnrollment(session, "class-courses", enrollmentId),
    onSuccess: invalidate,
  });

  const availableCourses = allCourses.filter(c =>
    !assignedCourses.some(ac => ac.courseInstanceId === c.id) &&
    (!courseSearch || `${c.name} ${c.template_name || ""}`.toLocaleLowerCase("vi").includes(courseSearch.trim().toLocaleLowerCase("vi")))
  );

  const error = [programCurriculumQuery, listQuery, coursesQuery, allCoursesQuery, treeQuery, addMutation, removeMutation, updateNoteMutation, assignCourseMutation, removeCourseMutation]
    .map(q => (q.isError ? messageOf(q.error) : "")).find(Boolean) ?? "";

  const toggleChapter = (chapterId: number) => {
    setExpandedChapters(prev => ({
      ...prev,
      [chapterId]: prev[chapterId] === undefined ? false : !prev[chapterId],
    }));
  };

  const expandAllChapters = (expand: boolean) => {
    const next: Record<number, boolean> = {};
    programCourses.forEach(c => {
      c.chapters.forEach(ch => {
        next[ch.id] = expand;
      });
    });
    setExpandedChapters(next);
  };

  const handleOpenDoc = (doc: ClassProgramResource) => {
    setDocError("");
    if (!doc.fileUrl) {
      setDocError(`Tài liệu "${doc.title}" chưa có đường dẫn tệp.`);
      return;
    }
    void openDocumentFile(session, doc.fileUrl, doc.title, doc.startPage).catch(reason => {
      setDocError(messageOf(reason));
    });
  };

  const reorderItems = async (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) return;
    setIsReordering(true);
    const nextList = [...items];
    const [moved] = nextList.splice(fromIndex, 1);
    nextList.splice(toIndex, 0, moved);

    try {
      const updates = nextList.map((item, idx) => {
        const newOrder = idx + 1;
        if (item.order_no !== newOrder) {
          return updateClassCurriculumItem(session, classId, item.id, { orderNo: newOrder });
        }
        return Promise.resolve();
      });
      await Promise.all(updates);
      await invalidate();
    } catch (err) {
      alert("Không thể đổi thứ tự: " + messageOf(err));
      await invalidate();
    } finally {
      setIsReordering(false);
    }
  };

  const searchLower = curriculumSearch.trim().toLowerCase();

  return (
    <section className="flex flex-col gap-6">
      {error && <div className="api-error">{error}</div>}

      {/* ── Section 1: Chương trình Khóa học & Tài liệu học tập ── */}
      <div className="border border-outline-variant rounded-xl bg-surface-container-lowest p-4 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">menu_book</span>
              <h3 className="text-base font-bold text-on-surface">Chương trình Khóa học & Tài liệu học tập</h3>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">
              Phân cấp Chương → Bài học và hiển thị trực tiếp tài liệu liên quan (SGK, SBT, bài giảng, KHBD) từ khóa học
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => expandAllChapters(true)}
              className="h-8 px-2.5 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface hover:bg-surface-container-low transition-colors"
            >
              Mở rộng tất cả
            </button>
            <button
              type="button"
              onClick={() => expandAllChapters(false)}
              className="h-8 px-2.5 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface hover:bg-surface-container-low transition-colors"
            >
              Thu gọn tất cả
            </button>
          </div>
        </div>

        {/* Tìm kiếm bài học / tài liệu */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">search</span>
          <input
            value={curriculumSearch}
            onChange={e => setCurriculumSearch(e.target.value)}
            placeholder="Tìm kiếm bài học hoặc tài liệu đính kèm…"
            className="w-full h-9 pl-9 pr-8 rounded-lg border border-outline-variant bg-surface text-xs text-on-surface focus:outline-none focus:border-primary"
          />
          {curriculumSearch && (
            <button
              type="button"
              onClick={() => setCurriculumSearch("")}
              className="absolute right-2.5 top-2 text-on-surface-variant hover:text-on-surface text-sm"
            >
              ✕
            </button>
          )}
        </div>

        {docError && (
          <div className="p-3 bg-error-container/40 text-error border border-error/20 rounded-lg text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">error</span>
            {docError}
          </div>
        )}

        {programCurriculumQuery.isLoading && (
          <p className="py-6 text-xs text-on-surface-variant text-center">Đang tải chương trình khóa học và tài liệu…</p>
        )}

        {!programCurriculumQuery.isLoading && !programCourses.length && (
          <div className="py-8 px-4 text-center flex flex-col items-center gap-2 border border-dashed border-outline-variant rounded-xl">
            <span className="material-symbols-outlined text-[36px] text-on-surface-variant">school</span>
            <p className="text-sm font-semibold text-on-surface">Lớp chưa có chương trình khóa học</p>
            <p className="text-xs text-on-surface-variant max-w-md">
              Vui lòng gán khóa học ở mục "Khóa học áp dụng cho lớp" bên dưới để đồng bộ toàn bộ bài học và tài liệu chuẩn.
            </p>
            <button
              type="button"
              onClick={() => setShowCourseModal(true)}
              className="mt-2 h-8 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold flex items-center gap-1 hover:opacity-90"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Gán khóa học ngay
            </button>
          </div>
        )}

        {programCourses.map(course => {
          const filteredChapters = course.chapters.map(ch => {
            const matchesChapter = !searchLower || ch.title.toLowerCase().includes(searchLower);
            const filteredLessons = ch.lessons.filter(l => {
              if (matchesChapter) return true;
              if (l.title.toLowerCase().includes(searchLower)) return true;
              return l.documents.some(d => d.title.toLowerCase().includes(searchLower));
            });
            return { ...ch, lessons: filteredLessons, matchesChapter };
          }).filter(ch => ch.lessons.length > 0 || ch.matchesChapter || !searchLower);

          const totalAttachedDocs = course.chapters.reduce((sum, ch) => sum + ch.lessons.reduce((lsum, l) => lsum + l.documents.length, 0), 0);

          return (
            <div key={course.courseInstanceId} className="flex flex-col gap-4 pt-1">
              {/* Thẻ thông tin khóa học */}
              <div className="flex items-center justify-between gap-3 p-3 bg-surface-container rounded-xl border border-outline-variant/60 flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">auto_stories</span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-on-surface truncate">{course.courseInstanceName}</h4>
                    <p className="text-[11px] text-on-surface-variant">
                      {course.programName} {course.schoolYear ? `· Năm học ${course.schoolYear}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant shrink-0">
                  <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-[11px]">
                    {course.chapters.length} chương
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-[11px]">
                    {course.totalLessons} bài học
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-primary-container text-on-primary-container text-[11px] font-semibold">
                    {totalAttachedDocs + course.commonDocuments.length} tài liệu đính kèm
                  </span>
                </div>
              </div>

              {/* Tài liệu dùng chung toàn khóa */}
              {course.commonDocuments.length > 0 && (!searchLower || course.commonDocuments.some(d => d.title.toLowerCase().includes(searchLower))) && (
                <div className="border border-outline-variant rounded-xl bg-surface p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-on-surface">
                    <span className="material-symbols-outlined text-[18px] text-primary">folder_special</span>
                    Tài liệu dùng chung toàn khóa ({course.commonDocuments.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    {course.commonDocuments.filter(d => !searchLower || d.title.toLowerCase().includes(searchLower)).map(doc => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
                            {getResourceIcon(doc.docType, doc.resourceType)}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-on-surface truncate" title={doc.title}>
                              {doc.title}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                doc.audience === "TEACHER_ONLY"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                              }`}>
                                {doc.audience === "TEACHER_ONLY" ? "Chỉ GV" : "GV & HS"}
                              </span>
                              {doc.docType && <span className="text-[10px] text-on-surface-variant uppercase">{doc.docType}</span>}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenDoc(doc)}
                          className="px-2 py-1 text-xs font-semibold text-primary hover:bg-primary-container/20 rounded shrink-0 transition-colors"
                        >
                          Xem
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Danh sách Chương -> Bài học -> Tài liệu */}
              <div className="flex flex-col gap-2.5">
                {filteredChapters.map(chapter => {
                  const isExpanded = expandedChapters[chapter.id] ?? true;
                  const chapterDocCount = chapter.lessons.reduce((sum, l) => sum + l.documents.length, 0);

                  return (
                    <div
                      key={chapter.id}
                      className="border border-outline-variant rounded-xl bg-surface-container-lowest overflow-hidden transition-shadow hover:shadow-xs"
                    >
                      {/* Tiêu đề Chương */}
                      <button
                        type="button"
                        onClick={() => toggleChapter(chapter.id)}
                        className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-surface-container-low transition-colors select-none"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="material-symbols-outlined text-[20px] text-on-surface-variant shrink-0">
                            {isExpanded ? "folder_open" : "folder"}
                          </span>
                          <span className="text-sm font-bold text-on-surface truncate">
                            {chapter.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-on-surface-variant font-medium">
                            {chapter.lessons.length} bài học · {chapterDocCount} tài liệu
                          </span>
                          <span className="material-symbols-outlined text-[18px] text-on-surface-variant transition-transform duration-200" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                            expand_more
                          </span>
                        </div>
                      </button>

                      {/* Nội dung Chương: Các Bài học */}
                      {isExpanded && (
                        <div className="border-t border-outline-variant divide-y divide-outline-variant/60 bg-surface">
                          {chapter.lessons.map(lesson => (
                            <div key={lesson.id} className="p-3 pl-5 flex flex-col gap-2 hover:bg-surface-container-low/40 transition-colors">
                              {/* Tên Bài học */}
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                                    {lesson.orderIndex}
                                  </span>
                                  <p className="text-xs font-bold text-on-surface truncate">
                                    {lesson.title}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
                                  {lesson.totalPeriods != null && (
                                    <span className="px-1.5 py-0.5 rounded bg-surface-container-high">
                                      {lesson.totalPeriods} tiết
                                    </span>
                                  )}
                                  {lesson.lessonKind && (
                                    <span className="px-1.5 py-0.5 rounded bg-surface-container-high">
                                      {lesson.lessonKind}
                                    </span>
                                  )}
                                  <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-semibold">
                                    {lesson.documents.length} tài liệu
                                  </span>
                                </div>
                              </div>

                              {/* Tài liệu đính kèm của Bài học */}
                              {lesson.documents.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 pl-7">
                                  {lesson.documents.map(doc => (
                                    <div
                                      key={doc.id}
                                      className="flex items-center justify-between gap-2 p-2 rounded-lg border border-outline-variant/70 bg-surface-container-lowest hover:border-primary/50 transition-colors"
                                    >
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
                                          {getResourceIcon(doc.docType, doc.resourceType)}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <p className="text-xs font-medium text-on-surface truncate" title={doc.title}>
                                            {doc.title}
                                          </p>
                                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                            {doc.required && (
                                              <span className="text-[10px] px-1 py-0.2 rounded bg-error-container text-on-error-container font-bold">
                                                Bắt buộc
                                              </span>
                                            )}
                                            <span className={`text-[10px] px-1 py-0.2 rounded font-medium ${
                                              doc.audience === "TEACHER_ONLY"
                                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                                            }`}>
                                              {doc.audience === "TEACHER_ONLY" ? "Chỉ GV" : "GV & HS"}
                                            </span>
                                            {doc.startPage && (
                                              <span className="text-[10px] text-on-surface-variant">
                                                Trang {doc.startPage}
                                              </span>
                                            )}
                                            {doc.totalPages && (
                                              <span className="text-[10px] text-on-surface-variant">
                                                ({doc.totalPages} trang)
                                              </span>
                                            )}
                                            {doc.teacherNote && (
                                              <span className="text-[10px] italic text-on-surface-variant truncate max-w-[120px]" title={doc.teacherNote}>
                                                · {doc.teacherNote}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleOpenDoc(doc)}
                                        className="h-7 px-2.5 text-xs font-semibold text-primary hover:bg-primary-container/20 rounded flex items-center gap-1 shrink-0 transition-colors"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                                        Xem
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-on-surface-variant/70 italic pl-7">
                                  Chưa đính kèm tài liệu cho bài học này
                                </p>
                              )}
                            </div>
                          ))}
                          {!chapter.lessons.length && (
                            <p className="p-3 text-xs text-on-surface-variant text-center">Chương chưa có bài học nào.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Section 2: Khóa học áp dụng cho lớp ── */}
      <div className="border border-outline-variant rounded-xl bg-surface-container-lowest p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-on-surface">Khóa học áp dụng cho lớp</h3>
            <p className="text-xs text-on-surface-variant">
              {assignedCourses.length ? `${assignedCourses.length} khóa học đang được gán.` : "Chưa gán khóa học nào cho lớp này."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCourseModal(true)}
            className="h-8 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold flex items-center gap-1 hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            {assignedCourses.length ? "Gán thêm khóa học" : "Gán khóa học cho lớp"}
          </button>
        </div>

        <div className="divide-y divide-outline-variant">
          {assignedCourses.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-on-surface">{c.label}</p>
                <p className="text-xs text-on-surface-variant">
                  {c.courseInstanceId ? `Khóa học #${c.courseInstanceId}` : "Khóa học"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Gỡ khóa học "${c.label}" khỏi lớp này?`)) {
                    removeCourseMutation.mutate(c.id);
                  }
                }}
                className="px-2.5 py-1 text-xs font-semibold text-error hover:bg-error-container/30 rounded transition-colors"
              >
                Gỡ khỏi lớp
              </button>
            </div>
          ))}
          {!assignedCourses.length && (
            <p className="py-4 text-xs text-on-surface-variant text-center">
              Lớp chưa được gán khóa học. Gán khóa học để sinh lịch và đồng bộ tiến độ học.
            </p>
          )}
        </div>
      </div>

      {/* ── Section 3: Chuyên đề bổ sung riêng của lớp ── */}
      <div className="border border-outline-variant rounded-xl bg-surface-container-lowest p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-on-surface">Chuyên đề bổ sung riêng của lớp</h3>
            <p className="text-xs text-on-surface-variant">
              {items.length} mục bổ sung · kéo thả lên xuống hoặc bấm ▲ ▼ để đổi thứ tự
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPicking(v => !v)}
            className="h-8 px-3 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface hover:bg-surface-container-low transition-colors"
          >
            {picking ? "Đóng cây chuyên đề" : "+ Thêm mục từ cây chuyên đề"}
          </button>
        </div>

        {picking && (
          <div className="border border-outline-variant rounded-lg bg-surface-container-lowest overflow-hidden">
            <div className="px-4 py-2.5 border-b border-outline-variant flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-on-surface-variant shrink-0">Ghi chú</span>
              <input
                placeholder="Ví dụ: Dạy tăng cường trong tháng 10 (không bắt buộc)"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="h-8 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-xs text-on-surface flex-1 min-w-[200px]"
              />
            </div>
            <div className="max-h-[40vh] overflow-auto py-1">
              {treeQuery.isLoading && <p className="px-4 py-3 text-xs text-on-surface-variant">Đang tải cây chuyên đề…</p>}
              {!treeQuery.isLoading && !(childrenByParent.get(ROOT) ?? []).length && (
                <p className="px-4 py-3 text-xs text-on-surface-variant">Chưa có nội dung chuyên đề nào.</p>
              )}
              {(childrenByParent.get(ROOT) ?? []).map(node => (
                <TreeRow
                  key={node.id}
                  node={node}
                  level={0}
                  childrenByParent={childrenByParent}
                  expanded={expanded}
                  chosen={chosen}
                  onToggle={id => setExpanded(list => list.includes(id) ? list.filter(v => v !== id) : [...list, id])}
                  onPick={id => addMutation.mutate(id)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="divide-y divide-outline-variant">
          {items.map((item, index) => (
            <div
              key={item.id}
              draggable={!isReordering && editingItemId !== item.id}
              onDragStart={(e) => {
                setDraggingIndex(index);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", `${index}`);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverIndex !== index) {
                  setDragOverIndex(index);
                }
              }}
              onDragEnd={() => {
                setDraggingIndex(null);
                setDragOverIndex(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingIndex !== null && draggingIndex !== index) {
                  void reorderItems(draggingIndex, index);
                }
                setDraggingIndex(null);
                setDragOverIndex(null);
              }}
              className={`flex items-center justify-between gap-3 py-2.5 transition-colors ${
                draggingIndex === index ? "opacity-40 bg-surface-container-low" : ""
              } ${
                dragOverIndex === index && draggingIndex !== index ? "border-t-2 border-primary bg-primary-container/10" : ""
              }`}
            >
              <div className="flex items-start gap-2 min-w-0 flex-1">
                {/* Drag handle & order buttons */}
                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                  <div
                    className="cursor-grab active:cursor-grabbing text-on-surface-variant/70 hover:text-primary p-0.5 flex items-center"
                    title="Kéo thả lên/xuống để đổi thứ tự"
                  >
                    <span className="material-symbols-outlined text-[18px]">drag_indicator</span>
                  </div>
                  <div className="flex flex-col -my-1">
                    <button
                      type="button"
                      disabled={index === 0 || isReordering}
                      onClick={() => void reorderItems(index, index - 1)}
                      className="w-4 h-3 flex items-center justify-center text-[10px] text-on-surface-variant hover:text-primary disabled:opacity-20 transition-colors leading-none"
                      title="Chuyển lên trên"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={index === items.length - 1 || isReordering}
                      onClick={() => void reorderItems(index, index + 1)}
                      className="w-4 h-3 flex items-center justify-center text-[10px] text-on-surface-variant hover:text-primary disabled:opacity-20 transition-colors leading-none"
                      title="Chuyển xuống dưới"
                    >
                      ▼
                    </button>
                  </div>
                  <span className="w-6 h-6 rounded bg-surface-variant text-on-surface-variant flex items-center justify-center text-[11px] font-bold shrink-0 data-tabular">
                    {index + 1}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-on-surface truncate">{item.title}</p>
                  <p className="text-xs text-on-surface-variant truncate">
                    {depthLabel[item.depth] ?? `Cấp ${item.depth}`}
                    {item.parent_title && ` · thuộc ${item.parent_title}`}
                    {` · ${item.document_count} tài liệu`}
                    {item.note && <span className="italic ml-1">· Ghi chú: {item.note}</span>}
                  </p>

                  {/* Inline note editor */}
                  {editingItemId === item.id && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        value={editNoteValue}
                        onChange={e => setEditNoteValue(e.target.value)}
                        placeholder="Nhập ghi chú cho lớp..."
                        className="h-7 px-2 text-xs rounded border border-outline-variant flex-1 max-w-sm"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => updateNoteMutation.mutate({ id: item.id, noteText: editNoteValue })}
                        className="h-7 px-2.5 bg-primary text-on-primary text-xs rounded font-semibold"
                      >
                        Lưu
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingItemId(null)}
                        className="h-7 px-2 text-xs text-on-surface-variant"
                      >
                        Hủy
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setEditingItemId(item.id);
                    setEditNoteValue(item.note || "");
                  }}
                  className="px-2 py-1 text-xs font-semibold text-on-surface-variant hover:text-primary rounded transition-colors"
                >
                  Sửa ghi chú
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Bỏ mục "${item.title}" khỏi chương trình lớp?`)) {
                      removeMutation.mutate(item.id);
                    }
                  }}
                  className="px-2 py-1 text-xs font-semibold text-error hover:bg-error-container/30 rounded transition-colors"
                >
                  Gỡ
                </button>
              </div>
            </div>
          ))}
          {!items.length && <p className="text-xs text-on-surface-variant text-center py-6">Lớp chưa gán mục chuyên đề nào.</p>}
        </div>
      </div>

      {/* Modal Gán khóa học */}
      {showCourseModal && (
        <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowCourseModal(false); }}>
          <section role="dialog" aria-modal="true" className="dialog-card !max-w-md">
            <header className="flex justify-between items-center mb-3">
              <h3 className="text-base font-bold text-on-surface">Gán khóa học cho lớp</h3>
              <button onClick={() => setShowCourseModal(false)} className="text-xl">×</button>
            </header>
            <div className="flex flex-col gap-3">
              <input
                placeholder="Tìm kiếm khóa học..."
                value={courseSearch}
                onChange={e => setCourseSearch(e.target.value)}
                className="h-9 px-3 rounded-lg border border-outline-variant text-sm text-on-surface"
              />
              <div className="max-h-60 overflow-y-auto divide-y divide-outline-variant border border-outline-variant rounded-lg p-2">
                {availableCourses.map(c => (
                  <label
                    key={c.id}
                    className={`flex items-center gap-3 p-2.5 rounded cursor-pointer ${
                      selectedCourseId === c.id ? "bg-primary-container/30" : "hover:bg-surface-container-low"
                    }`}
                  >
                    <input
                      type="radio"
                      name="courseChoice"
                      checked={selectedCourseId === c.id}
                      onChange={() => setSelectedCourseId(c.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-on-surface">{c.name}</p>
                      <p className="text-xs text-on-surface-variant">{c.template_name || "Mã khóa"} · {c.school_year || "Cả năm"}</p>
                    </div>
                  </label>
                ))}
                {!availableCourses.length && (
                  <p className="py-4 text-center text-xs text-on-surface-variant">Không có khóa học phù hợp để gán.</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant mt-3">
              <button
                type="button"
                onClick={() => setShowCourseModal(false)}
                className="h-8 px-3 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface-variant"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!selectedCourseId || assignCourseMutation.isPending}
                onClick={() => assignCourseMutation.mutate(selectedCourseId)}
                className="h-8 px-4 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {assignCourseMutation.isPending ? "Đang gán…" : "Xác nhận gán"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function TreeRow({ node, level, childrenByParent, expanded, chosen, onToggle, onPick }: {
  node: TaxonomyNode; level: number; childrenByParent: Map<number, TaxonomyNode[]>;
  expanded: number[]; chosen: Set<number>; onToggle: (id: number) => void; onPick: (id: number) => void;
}) {
  const children = childrenByParent.get(node.id) ?? [];
  const open = expanded.includes(node.id);
  const already = chosen.has(node.id);
  return <>
    <div className="flex items-center gap-1 px-2 py-1 hover:bg-surface-container-low transition-colors" style={{ paddingLeft: 8 + level * 16 }}>
      <button onClick={() => onToggle(node.id)} disabled={!children.length}
        className="w-5 h-5 shrink-0 flex items-center justify-center text-on-surface-variant disabled:opacity-0">
        <span className="material-symbols-outlined text-[16px]">{open ? "expand_more" : "chevron_right"}</span>
      </button>
      <span className="text-sm text-on-surface truncate flex-1">{node.title}</span>
      <button onClick={() => onPick(node.id)} disabled={already}
        className={`shrink-0 px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${already ? "text-on-surface-variant cursor-default" : "text-primary hover:bg-primary-container/20"}`}>
        {already ? "Đã thêm" : "Thêm"}
      </button>
    </div>
    {open && children.map(child => (
      <TreeRow key={child.id} node={child} level={level + 1} childrenByParent={childrenByParent}
        expanded={expanded} chosen={chosen} onToggle={onToggle} onPick={onPick} />
    ))}
  </>;
}
