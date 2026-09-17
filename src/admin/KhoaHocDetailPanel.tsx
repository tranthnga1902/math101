import { navigateAdmin } from "./navigation";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AuthSession,
  CourseInstance,
  DeliverySessionsResult,
  getDeliverySessions, getCourseClasses, getProgramTemplates, getProgramResources, getChapters, openDocumentFile,
  type Chapter,
} from "../api";
import { Settings, Info, FileText, Users, BarChart2, Edit3, Trash2, Folder, FolderOpen, Search, ChevronDown, ChevronRight } from "lucide-react";
import { CourseDeliverySessionPanel } from "./CourseDeliverySessionPanel";
import { CourseFeePolicy } from "../finance/CourseFeePolicy";
import { SkeletonTable } from "./components/AdminSkeleton";
import { Button } from "../components/ui/button";

function nhanTrangThai(st: string): { label: string; isPub: boolean } {
  const MAP: Record<string, { label: string; isPub: boolean }> = {
    DRAFT:     { label: "Nháp",       isPub: false },
    ACTIVE:    { label: "Đang chạy",  isPub: true  },
    PUBLISHED: { label: "Sẵn sàng",   isPub: true  },
    ARCHIVED:  { label: "Lưu trữ",    isPub: false },
    INACTIVE:  { label: "Tạm dừng",   isPub: false },
  };
  return MAP[st] ?? { label: st, isPub: false };
}

// ------------------------------------------------------------------
// Tab: Tổng quan
// ------------------------------------------------------------------

function TabTongQuan({
  khoa,
  mauName,
  sessionCount,
  unitsPerSession, splitPolicy, assessmentPolicy,
}: {
  khoa: CourseInstance;
  mauName: string | null;
  sessionCount: number | null;
  unitsPerSession: number | null;
  splitPolicy?: string;
  assessmentPolicy?: string;
}) {
  const rules = [
    unitsPerSession != null
      ? `Ưu tiên ${unitsPerSession} tiết / buổi (units_per_session).`
      : "Số tiết/buổi chưa cấu hình — vào tab Nội dung & Buổi học để đặt.",
    assessmentPolicy==="MERGE"?"Bài kiểm tra được ghép chung khi còn chỗ.":"Bài kiểm tra tách thành buổi riêng.",
    splitPolicy==="BALANCED"?"Chia cân đối; có thể cắt bài qua nhiều buổi.":splitPolicy==="FIXED_CAPACITY"?"Mỗi buổi không vượt số tiết mục tiêu; có thể cắt bài.":"Giữ nguyên bài; buổi có thể vượt số tiết mục tiêu.",
    "Buổi ôn tập (ON_TAP), thực hành (THUC_HANH) và dạy bình thường (TEACHING) có type riêng.",
  ];

  const st = nhanTrangThai(khoa.status);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {/* Quy tắc chia buổi */}
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 18, background: "#fff", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
          <Settings size={15} style={{ color: "var(--primary)" }} />
          Quy tắc chia buổi học
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rules.map((rule, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13, color: "#334155", lineHeight: 1.55 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)", marginTop: 6, flexShrink: 0 }} />
              <span>{rule}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hệ thống tự tính */}
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 18, background: "#fff", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
          <Info size={15} style={{ color: "var(--primary)" }} />
          Thông tin hệ thống tự tính
        </div>
        <div className="cw-clean-table-wrap">
          <table className="cw-clean-table">
            <tbody>
              <tr>
                <td style={{ width: 160, color: "#64748b", fontWeight: 500 }}>Mẫu chương trình</td>
                <td><b>{mauName ?? "—"}</b></td>
              </tr>
              <tr>
                <td style={{ color: "#64748b", fontWeight: 500 }}>Đơn vị mỗi buổi</td>
                <td><b>{unitsPerSession != null ? `${unitsPerSession} tiết / buổi` : "Chưa cấu hình"}</b></td>
              </tr>
              <tr>
                <td style={{ color: "#64748b", fontWeight: 500 }}>Tổng số buổi đã sinh</td>
                <td>
                  <b style={{ color: sessionCount != null ? "var(--primary)" : "#64748b" }}>
                    {sessionCount != null ? `${sessionCount} buổi` : "Chưa sinh"}
                  </b>
                </td>
              </tr>
              <tr>
                <td style={{ color: "#64748b", fontWeight: 500 }}>Trạng thái khóa</td>
                <td>
                  <span className={`cw-badge ${st.isPub ? "cw-badge-active" : "cw-badge-draft"}`}>
                    {st.label}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Main Export: KhoaHocDetailPanel as cw-canvas
// ------------------------------------------------------------------

type DetailTab = "overview" | "sessions" | "assessments" | "docs" | "classes" | "fees";

interface Props {
  session: AuthSession;
  khoa: CourseInstance;
  mauName: string | null;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const KhoaHocDetailPanel: React.FC<Props> = ({
  session,
  khoa,
  mauName,
  onEdit,
  onDelete,
}) => {
  const [tab, setTab] = useState<DetailTab>("overview");
  const [materialError, setMaterialError] = useState("");

  // Fetch delivery sessions data
  const sessionsQuery = useQuery({
    queryKey: ["course-delivery-sessions", khoa.id],
    queryFn: () => getDeliverySessions(session, khoa.id),
  });

  const sessionsData = sessionsQuery.data as DeliverySessionsResult | undefined;
  const sessionCount = sessionsData?.sessions?.length ?? null;
  const unitsPerSession = sessionsData?.unitsPerSession ?? null;
  const st = nhanTrangThai(khoa.status);
  const classesQuery=useQuery({queryKey:["course-classes",session.accessToken,khoa.id],queryFn:()=>getCourseClasses(session,khoa.id),enabled:tab==="classes"});
  const templatesQuery=useQuery({queryKey:["program-templates",session.accessToken],queryFn:()=>getProgramTemplates(session),});
  const programId=(khoa as any).course_id || templatesQuery.data?.find(x=>x.id===khoa.template_id)?.program_id;
  const chaptersQuery=useQuery({queryKey:["course-program-chapters",session.accessToken,programId],queryFn:()=>getChapters(session,programId!),enabled:tab==="docs"&&!!programId});
  const resourcesQuery=useQuery({queryKey:["course-program-resources",session.accessToken,programId],queryFn:()=>getProgramResources(session,programId!),enabled:tab==="docs"&&!!programId});
  const [docSearch, setDocSearch] = useState("");
  const [expandedDocsChapters, setExpandedDocsChapters] = useState<Record<number, boolean>>({});

  return (
    <main className="cw-canvas">
      {/* ── Canvas Header (giống hệt CurriculumWorkspace) ── */}
      <div className="cw-canvas-header">
        <div className="cw-canvas-title-area">
          <nav className="cw-canvas-breadcrumb" aria-label="Breadcrumb">
            <span>
              <button type="button" style={{ cursor: "default" }}>Khóa học</button>
              <span className="sep">/</span>
            </span>
            <span>
              <button type="button" className="current">{khoa.name}</button>
            </span>
          </nav>

          <h1 className="cw-canvas-title" title={khoa.name}>{khoa.name}</h1>{programId&&<button className="text-sm text-primary" onClick={()=>navigateAdmin({section:"programs",programId})}>Mở chương trình nguồn</button>}

          <div className="cw-smart-meta-bar">
            <span className="cw-meta-pill primary">Mẫu: {mauName ?? "—"}</span>
            <span className="cw-meta-dot" />
            <span>Đơn vị / buổi: <b>{unitsPerSession != null ? `${unitsPerSession} tiết` : "Chưa cấu hình"}</b></span>
            <span className="cw-meta-dot" />
            <span>Tổng số buổi: <b>{sessionCount != null ? `${sessionCount} buổi` : "Chưa sinh"}</b></span>
            <span className="cw-meta-dot" />
            <span className={`cw-badge ${st.isPub ? "cw-badge-active" : "cw-badge-draft"}`}>
              {st.label}
            </span>
          </div>
        </div>

        <div className="cw-canvas-actions">
          {onEdit && (
            <button type="button" className="cw-btn-outline" onClick={onEdit}>
              <Edit3 size={14} /> Sửa khóa
            </button>
          )}
          {onDelete && (
            <button type="button" className="cw-btn-danger" onClick={onDelete}>
              <Trash2 size={14} /> Xóa khóa
            </button>
          )}
        </div>
      </div>

      {/* ── Notice Lead text (Không có calendar) ── */}
      <p className="cw-lead-text">
        Khóa học chỉ quản lý cách đóng gói nội dung thành các buổi học — không có lịch ngày. Lịch ngày, thứ học, nghỉ lễ và tiến độ thực tế sẽ nằm ở <b>Lớp học</b>.
      </p>

      {/* ── Canvas Tabs ── */}
      <nav className="cw-canvas-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "overview"}
          className={`cw-canvas-tab ${tab === "overview" ? "active" : ""}`}
          onClick={() => setTab("overview")}
        >
          Tổng quan
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "sessions"}
          className={`cw-canvas-tab ${tab === "sessions" ? "active" : ""}`}
          onClick={() => setTab("sessions")}
        >
          Nội dung & Buổi học
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "assessments"}
          className={`cw-canvas-tab ${tab === "assessments" ? "active" : ""}`}
          onClick={() => setTab("assessments")}
        >
          Đánh giá
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "docs"}
          className={`cw-canvas-tab ${tab === "docs" ? "active" : ""}`}
          onClick={() => setTab("docs")}
        >
          Tài liệu
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "classes"}
          className={`cw-canvas-tab ${tab === "classes" ? "active" : ""}`}
          onClick={() => setTab("classes")}
        >
          Lớp đang dùng
        </button>
        <button type="button" role="tab" aria-selected={tab==="fees"} className={`cw-canvas-tab ${tab==="fees"?"active":""}`} onClick={()=>setTab("fees")}>Học phí & thanh toán</button>
      </nav>

      {/* ── Canvas Body ── */}
      <div className="cw-canvas-body">
        {tab === "overview" && (
          <TabTongQuan
            khoa={khoa}
            mauName={mauName}
            sessionCount={sessionCount}
            unitsPerSession={unitsPerSession}
            splitPolicy={sessionsData?.splitPolicy} assessmentPolicy={sessionsData?.assessmentPolicy}
          />
        )}

        {tab === "sessions" && (
          <CourseDeliverySessionPanel session={session} khoaId={khoa.id} khoaName={khoa.name} />
        )}

        {tab === "assessments" && (
          <div className="cw-empty-state" style={{ padding: "48px 16px" }}>
            <BarChart2 size={36} style={{ color: "#94a3b8" }} />
            <h3>Đánh giá của Khóa học</h3>
            <p>Cấu trúc đánh giá áp dụng chung cho mọi lớp học khóa này. Điểm số và bài làm thực tế của từng học sinh nằm ở <b>Lớp học</b>.</p>
          </div>
        )}

        {tab === "fees" && <CourseFeePolicy key={khoa.id} session={session} courseId={khoa.id}/>}
        {tab === "docs" && (
          <section className="border border-outline-variant bg-surface-container-lowest rounded-xl p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-bold text-base text-on-surface">Cấu trúc Học liệu từ Chương trình</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Tài liệu đính kèm được tái cấu trúc theo từng Chương / Bài học của khóa học
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const next: Record<number, boolean> = {};
                    (chaptersQuery.data ?? []).forEach(ch => { next[ch.id] = true; });
                    setExpandedDocsChapters(next);
                  }}
                >
                  Mở rộng tất cả
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExpandedDocsChapters({})}
                >
                  Thu gọn
                </Button>
              </div>
            </div>

            {/* Tìm kiếm tài liệu */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-on-surface-variant" />
              <input
                value={docSearch}
                onChange={e => setDocSearch(e.target.value)}
                placeholder="Tìm kiếm tài liệu học liệu theo tên…"
                className="w-full h-9 pl-9 pr-8 rounded-lg border border-outline-variant bg-surface text-xs text-on-surface focus:outline-none focus:border-primary"
              />
              {docSearch && (
                <button
                  type="button"
                  onClick={() => setDocSearch("")}
                  className="absolute right-2.5 top-2 text-on-surface-variant hover:text-on-surface text-sm"
                >
                  ✕
                </button>
              )}
            </div>

            {(templatesQuery.isLoading || resourcesQuery.isLoading || chaptersQuery.isLoading) && (
              <SkeletonTable rows={3} columns={2} />
            )}
            {(templatesQuery.isError || resourcesQuery.isError || chaptersQuery.isError) && (
              <p role="alert" className="api-error">
                {templatesQuery.error?.message || resourcesQuery.error?.message || chaptersQuery.error?.message}
              </p>
            )}
            {materialError && <p role="alert" className="attachment-error">{materialError}</p>}

            {resourcesQuery.isSuccess && (() => {
              const allDocs = resourcesQuery.data ?? [];
              const searchLower = docSearch.trim().toLowerCase();
              const filteredDocs = searchLower
                ? allDocs.filter(d => d.title.toLowerCase().includes(searchLower))
                : allDocs;

              const commonDocs = filteredDocs.filter(
                d => !d.chapter_id || d.noi_den_loai === "HE_THONG" || d.noi_den_loai === "MACH"
              );

              const chaptersList = chaptersQuery.data ?? [];
              const chaptersToRender = chaptersList.length > 0
                ? chaptersList
                : Array.from(new Set(allDocs.filter(d => d.chapter_id).map(d => d.chapter_id!))).map(chId => {
                    const sample = allDocs.find(d => d.chapter_id === chId);
                    return { id: chId, title: sample?.chapter_title ?? `Chương #${chId}`, order_index: sample?.chapter_order ?? 0, course_id: programId! };
                  });

              return (
                <div className="flex flex-col gap-4">
                  {/* Summary badges */}
                  <div className="flex items-center gap-3 text-xs text-on-surface-variant font-medium p-2.5 bg-surface-container rounded-lg border border-outline-variant/60 flex-wrap">
                    <span>Tổng số: <b>{allDocs.length}</b> tài liệu</span>
                    <span>·</span>
                    <span>Tài liệu dùng chung: <b>{allDocs.filter(d => !d.chapter_id || d.noi_den_loai === "HE_THONG" || d.noi_den_loai === "MACH").length}</b></span>
                    <span>·</span>
                    <span>Theo chương/bài: <b>{allDocs.filter(d => d.chapter_id && d.noi_den_loai !== "HE_THONG" && d.noi_den_loai !== "MACH").length}</b></span>
                  </div>

                  {/* 1. Tài liệu dùng chung toàn khóa */}
                  {commonDocs.length > 0 && (
                    <div className="border border-outline-variant rounded-xl bg-surface p-3 flex flex-col gap-2">
                      <h4 className="text-xs font-bold text-on-surface flex items-center gap-2">
                        <Folder className="text-primary" size={16} />
                        Tài liệu dùng chung toàn khóa ({commonDocs.length})
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                        {commonDocs.map(item => (
                          <article
                            key={item.id}
                            className="flex items-center justify-between gap-3 p-3 border border-outline-variant rounded-xl bg-surface-container-lowest hover:border-primary/40 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileText size={20} className="text-primary shrink-0" aria-hidden="true" />
                              <div className="min-w-0">
                                <h5 title={item.title} className="text-xs font-semibold text-on-surface truncate">
                                  {item.title}
                                </h5>
                                <p className="text-[11px] text-on-surface-variant mt-0.5">
                                  <span className={`px-1.5 py-0.2 rounded font-medium ${
                                    item.audience === "TEACHER_ONLY"
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                                  }`}>
                                    {item.audience === "TEACHER_ONLY" ? "Chỉ giáo viên" : "Học sinh & Giáo viên"}
                                  </span>
                                  {item.doc_type && <span className="ml-1 uppercase text-on-surface-variant">· {item.doc_type}</span>}
                                </p>
                              </div>
                            </div>
                            {(item.file_url || item.video_url) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setMaterialError("");
                                  void openDocumentFile(session, (item.file_url || item.video_url)!, item.title)
                                    .catch(reason => setMaterialError(reason instanceof Error ? reason.message : "Không thể mở học liệu."));
                                }}
                              >
                                Xem tài liệu
                              </Button>
                            )}
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. Tài liệu theo từng Chương */}
                  <div className="flex flex-col gap-3">
                    {chaptersToRender.map(ch => {
                      const chDocs = filteredDocs.filter(d => d.chapter_id === ch.id && d.noi_den_loai !== "HE_THONG" && d.noi_den_loai !== "MACH");
                      const isOpen = expandedDocsChapters[ch.id] ?? true;

                      if (searchLower && chDocs.length === 0) return null;

                      return (
                        <div
                          key={ch.id}
                          className="border border-outline-variant rounded-xl bg-surface-container-lowest overflow-hidden transition-shadow hover:shadow-xs"
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedDocsChapters(prev => ({
                              ...prev,
                              [ch.id]: prev[ch.id] === undefined ? false : !prev[ch.id],
                            }))}
                            className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-surface-container-low transition-colors select-none"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isOpen ? <FolderOpen size={18} className="text-primary shrink-0" /> : <Folder size={18} className="text-on-surface-variant shrink-0" />}
                              <span className="text-sm font-bold text-on-surface truncate">
                                {ch.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-on-surface-variant font-medium">
                                {chDocs.length} tài liệu
                              </span>
                              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </div>
                          </button>

                          {isOpen && (
                            <div className="border-t border-outline-variant p-3 bg-surface">
                              {chDocs.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {chDocs.map(item => (
                                    <article
                                      key={item.id}
                                      className="flex items-center justify-between gap-3 p-3 border border-outline-variant rounded-xl bg-surface-container-lowest hover:border-primary/40 transition-colors"
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <FileText size={20} className="text-primary shrink-0" aria-hidden="true" />
                                        <div className="min-w-0">
                                          <h5 title={item.title} className="text-xs font-semibold text-on-surface truncate">
                                            {item.title}
                                          </h5>
                                          <p className="text-[11px] text-on-surface-variant mt-0.5">
                                            <span className={`px-1.5 py-0.2 rounded font-medium ${
                                              item.audience === "TEACHER_ONLY"
                                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                                            }`}>
                                              {item.audience === "TEACHER_ONLY" ? "Chỉ giáo viên" : "Học sinh & Giáo viên"}
                                            </span>
                                            {item.doc_type && <span className="ml-1 uppercase text-on-surface-variant">· {item.doc_type}</span>}
                                          </p>
                                        </div>
                                      </div>
                                      {(item.file_url || item.video_url) && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setMaterialError("");
                                            void openDocumentFile(session, (item.file_url || item.video_url)!, item.title)
                                              .catch(reason => setMaterialError(reason instanceof Error ? reason.message : "Không thể mở học liệu."));
                                          }}
                                        >
                                          Xem tài liệu
                                        </Button>
                                      )}
                                    </article>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-on-surface-variant/70 italic py-2">
                                  Chưa có tài liệu đính kèm trong chương này.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {!allDocs.length && (
                    <div className="attachment-empty mt-4">
                      <FileText size={28} />
                      <p>Chưa có học liệu.</p>
                      <small>Gắn tài liệu vào bài học trong chương trình để sử dụng ở khóa học này.</small>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>
        )}

        {tab === "classes" && (
          <section className="border border-outline-variant bg-surface-container-lowest rounded-xl p-4"><h3 className="font-bold">Lớp đang sử dụng khóa</h3>
           {classesQuery.isLoading&&<p>Đang tải lớp học…</p>}
           {classesQuery.isError&&<p role="alert" className="api-error">{classesQuery.error.message}</p>}
           {(classesQuery.data??[]).map(row=><div key={row.id} className="flex justify-between gap-3 py-3 border-b border-outline-variant"><div><button className="font-bold text-primary" onClick={()=>navigateAdmin({section:"classes",classId:row.id})}>{row.name}</button><small className="block">{row.code} · {row.start_date||"Chưa đặt ngày bắt đầu"}</small></div><span>{row.student_count} học sinh</span></div>)}
           {classesQuery.isSuccess&&!classesQuery.data.length&&<p>Chưa có lớp sử dụng khóa này.</p>}
          </section>
        )}
      </div>
    </main>
  );
};
