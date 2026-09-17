import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getChapters,
  getCourses,
  getLessons,
  getProgramStrands,
  getProgramWeek,
  getTaxonomyTree,
  phanPhoi,
  type AuthSession,
  type DocumentItem,
  type PhanPhoiInput,
} from "../api";
import { AdminModal } from "./components/AdminModal";
import { Button } from "../components/ui/button";

const message = (reason: unknown) => reason instanceof Error ? reason.message : "Không thể gắn tài liệu";

type NoiDenLoai = PhanPhoiInput["noiDenLoai"];
const NOI_DEN_OPTIONS: { value: NoiDenLoai; label: string }[] = [
  { value: "BAI", label: "Một bài học cụ thể" },
  { value: "TIET", label: "Một tiết trong lịch tuần" },
  { value: "MACH", label: "Một mạch nội dung" },
  { value: "HE_THONG", label: "Toàn hệ thống (mọi chương trình, mọi lớp)" },
];

/**
 * Gắn 1 tài liệu đã có trong "documents" vào một nơi đến trong chương trình, qua
 * POST /admin/phan-phoi (xem ProgramContentController.phanPhoi/neoCua). Đây là cửa ghi
 * duy nhất vào program_resources cho 5 loại nơi đến — không tự viết SQL insert ở đây.
 */
export function AttachDocumentDialog({ session, document, documents, onClose, onDone }: {
  session: AuthSession;
  document?: DocumentItem | null;
  documents?: DocumentItem[] | null;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const docList = useMemo(() => {
    if (documents && documents.length > 0) return documents;
    if (document) return [document];
    return [];
  }, [document, documents]);

  const isMultiple = docList.length > 1;
  const primaryDoc = docList[0] || ({} as DocumentItem);

  const [noiDenLoai, setNoiDenLoai] = useState<NoiDenLoai>("BAI");
  const [courseId, setCourseId] = useState<number | null>(null);
  const [chapterId, setChapterId] = useState<number | null>(null);
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [strandId, setStrandId] = useState<number | null>(null);
  const [weekNo, setWeekNo] = useState<number | "">("");
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [taxonomyNodeId, setTaxonomyNodeId] = useState<number | null>(null);
  const [title, setTitle] = useState(primaryDoc.title || "");
  const [status, setStatus] = useState("PUBLISHED");
  const [audience, setAudience] = useState(primaryDoc.audience || "TEACHER_ONLY");
  const [error, setError] = useState("");

  const needsCourse = noiDenLoai === "MACH" || noiDenLoai === "TIET" || noiDenLoai === "BAI";
  const coursesQuery = useQuery({ queryKey: ["attach-doc-courses", session.accessToken], queryFn: () => getCourses(session), enabled: needsCourse });
  const strandsQuery = useQuery({ queryKey: ["attach-doc-strands", session.accessToken, courseId], queryFn: () => getProgramStrands(session, courseId as number), enabled: !!courseId && (noiDenLoai === "MACH" || noiDenLoai === "TIET") });
  const chaptersQuery = useQuery({ queryKey: ["attach-doc-chapters", session.accessToken, courseId], queryFn: () => getChapters(session, courseId as number), enabled: !!courseId && noiDenLoai === "BAI" });
  const lessonsQuery = useQuery({ queryKey: ["attach-doc-lessons", session.accessToken, chapterId], queryFn: () => getLessons(session, chapterId as number), enabled: !!chapterId && noiDenLoai === "BAI" });
  const weekQuery = useQuery({ queryKey: ["attach-doc-week", session.accessToken, courseId, weekNo], queryFn: () => getProgramWeek(session, courseId as number, weekNo as number), enabled: !!courseId && noiDenLoai === "TIET" && typeof weekNo === "number" && weekNo > 0 });
  const taxonomyQuery = useQuery({ queryKey: ["attach-doc-taxonomy", session.accessToken], queryFn: () => getTaxonomyTree(session), enabled: noiDenLoai === "CHUYEN_DE" });

  const periodsInWeek = useMemo(() => (weekQuery.data ?? []).filter(p => !strandId || p.strand_id === strandId), [weekQuery.data, strandId]);

  const taxonomyOptions = useMemo(() => {
    const nodes = (taxonomyQuery.data ?? []).filter(n => n.status === "ACTIVE");
    const byParent = new Map<number | null, typeof nodes>();
    for (const n of nodes) byParent.set(n.parentId, [...(byParent.get(n.parentId) ?? []), n]);
    const out: { id: number; label: string }[] = [];
    const walk = (parentId: number | null, depth: number) => {
      for (const n of (byParent.get(parentId) ?? []).sort((a, b) => a.orderNo - b.orderNo)) {
        out.push({ id: n.id, label: `${"— ".repeat(depth)}${n.title}` });
        walk(n.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [taxonomyQuery.data]);

  const resetTargets = () => {
    setCourseId(null); setChapterId(null); setLessonId(null);
    setStrandId(null); setWeekNo(""); setPeriodId(null); setTaxonomyNodeId(null);
  };

  const isStudentAllowedDoc = docList.every(d => d.audience === "STUDENT_ALLOWED");

  const submitMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        docList.map(doc => {
          const input: PhanPhoiInput = {
            noiDenLoai,
            resourceType: "DOCUMENT",
            resourceRefId: doc.id,
            title: isMultiple ? doc.title : (title.trim() || doc.title),
            status,
            audience: isStudentAllowedDoc && audience === "STUDENT_ALLOWED" ? "STUDENT_ALLOWED" : "TEACHER_ONLY",
            neo: noiDenLoai === "MACH" ? strandId : noiDenLoai === "TIET" ? periodId : noiDenLoai === "CHUYEN_DE" ? taxonomyNodeId : null,
            lessonId: noiDenLoai === "BAI" ? lessonId : null,
          };
          return phanPhoi(session, input);
        })
      );
    },
    onSuccess: () => { void onDone(); },
    onError: (reason) => setError(message(reason)),
  });

  const canSubmit = (() => {
    if (!isMultiple && !title.trim()) return false;
    switch (noiDenLoai) {
      case "HE_THONG": return true;
      case "BAI": return !!lessonId;
      case "MACH": return !!strandId;
      case "TIET": return !!periodId;
      case "CHUYEN_DE": return !!taxonomyNodeId;
      default: return false;
    }
  })();

  const modalTitle = isMultiple
    ? `Gắn ${docList.length} tài liệu vào chương trình`
    : `Gắn "${primaryDoc.title || "tài liệu"}" vào chương trình`;

  return (
    <AdminModal open={true} onClose={onClose} title={modalTitle} size="md"
      footer={<><Button variant="outline" onClick={onClose}>Hủy</Button><Button disabled={!canSubmit || submitMutation.isPending || !docList.length} onClick={() => submitMutation.mutate()}>{submitMutation.isPending ? "Đang gắn…" : `Gắn ${isMultiple ? `${docList.length} tài liệu` : "tài liệu"}`}</Button></>}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">Nơi đến</label>
          <select value={noiDenLoai} onChange={event => { setNoiDenLoai(event.target.value as NoiDenLoai); resetTargets(); }} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none bg-white">
            {NOI_DEN_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>

        {noiDenLoai === "HE_THONG" && (
          <p className="text-sm text-on-surface-variant bg-surface-variant rounded-lg p-3">Áp dụng cho mọi chương trình, mọi lớp — không neo vào bài hay mạch nào.</p>
        )}

        {needsCourse && (
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Chương trình</label>
            <select value={courseId ?? ""} onChange={event => { setCourseId(event.target.value ? Number(event.target.value) : null); setChapterId(null); setLessonId(null); setStrandId(null); setWeekNo(""); setPeriodId(null); }} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none bg-white">
              <option value="">— Chọn —</option>
              {(coursesQuery.data ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        {(noiDenLoai === "MACH" || noiDenLoai === "TIET") && courseId && (
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Mạch nội dung</label>
            <select value={strandId ?? ""} onChange={event => { setStrandId(event.target.value ? Number(event.target.value) : null); setPeriodId(null); }} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none bg-white">
              <option value="">— Chọn —</option>
              {(strandsQuery.data ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {noiDenLoai === "TIET" && strandId && (
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Tuần</label>
            <input type="number" min={1} max={35} value={weekNo} onChange={event => { setWeekNo(event.target.value ? Number(event.target.value) : ""); setPeriodId(null); }} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none" />
          </div>
        )}

        {noiDenLoai === "TIET" && strandId && typeof weekNo === "number" && weekNo > 0 && (
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Tiết</label>
            <select value={periodId ?? ""} onChange={event => setPeriodId(event.target.value ? Number(event.target.value) : null)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none bg-white">
              <option value="">— Chọn —</option>
              {periodsInWeek.map(p => <option key={p.id} value={p.id}>{`Tiết ${p.period_no}${p.title ? " — " + p.title : ""}`}</option>)}
            </select>
            {weekQuery.isFetched && periodsInWeek.length === 0 && <small className="text-error block mt-1">Không có tiết nào của mạch này trong tuần đã chọn.</small>}
          </div>
        )}

        {noiDenLoai === "BAI" && courseId && (
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Chương</label>
            <select value={chapterId ?? ""} onChange={event => { setChapterId(event.target.value ? Number(event.target.value) : null); setLessonId(null); }} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none bg-white">
              <option value="">— Chọn —</option>
              {(chaptersQuery.data ?? []).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
        )}

        {noiDenLoai === "BAI" && chapterId && (
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Bài</label>
            <select value={lessonId ?? ""} onChange={event => setLessonId(event.target.value ? Number(event.target.value) : null)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none bg-white">
              <option value="">— Chọn —</option>
              {(lessonsQuery.data ?? []).map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </div>
        )}

        {noiDenLoai === "CHUYEN_DE" && (
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Chuyên đề</label>
            <select value={taxonomyNodeId ?? ""} onChange={event => setTaxonomyNodeId(event.target.value ? Number(event.target.value) : null)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none bg-white">
              <option value="">— Chọn —</option>
              {taxonomyOptions.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </div>
        )}

        {!isMultiple ? (
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Tiêu đề hiển thị</label>
            <input required value={title} onChange={event => setTitle(event.target.value)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none" />
          </div>
        ) : (
          <div className="p-3 bg-surface-variant/40 rounded-lg border border-outline-variant/60 text-xs text-on-surface-variant">
            <strong>Gắn đồng loạt {docList.length} tài liệu:</strong> Mỗi tài liệu sẽ được giữ nguyên tên gốc khi đưa vào chương trình.
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">Phạm vi</label>
          <select value={audience} onChange={event => setAudience(event.target.value)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none bg-white">
            <option value="TEACHER_ONLY">Chỉ giáo viên</option>
            <option value="STUDENT_ALLOWED" disabled={!isStudentAllowedDoc}>Cho phép học sinh</option>
          </select>
          {!isStudentAllowedDoc && <small className="text-on-surface-variant block mt-1">Tài liệu gốc chỉ dành cho giáo viên nên không thể nới rộng hơn khi gắn.</small>}
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">Trạng thái</label>
          <select value={status} onChange={event => setStatus(event.target.value)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none bg-white">
            <option value="PUBLISHED">Công bố ngay</option>
            <option value="DRAFT">Lưu nháp</option>
          </select>
        </div>

        {error && <div className="p-3 rounded-lg bg-error-container text-on-error-container text-sm">{error}</div>}
      </div>
    </AdminModal>
  );
}
