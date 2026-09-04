import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAssignments, saveAssignment, deleteAssignment, getWorksheets, getClassDocuments,
  getClasses, getClassPeriods, getPeriodDeadline, getClassRoster, getWorksheetImpact,
  createAssignmentBatch,
  type AuthSession, type Assignment, type AssignmentState, type AnswerReveal, type ClassPeriod,
  type ClassRequirement, type HanTheoBuoi, type LatePolicy, type TaskKind,
} from "../../api";
import { messageOf } from "../../lib/errors";
import { AssignmentAnalysisDialog } from "./AssignmentAnalysisDialog";
import { BO_MAC_DINH, macDinhCua, nhanHienDapAn, nhanLoai } from "./loaiNhiemVu";

type Draft = {
  title: string; source: "worksheet" | "document"; worksheetId: number; documentId: number;
  classIds: number[]; anchorPeriodId: number; dueBufferMinutes: number;
  openAt: string; dueAt: string; status: string;
  taskKind: TaskKind; requirement: ClassRequirement; maxAttempts: number;
  latePolicy: LatePolicy; latePenaltyPercent: number; answerReveal: AnswerReveal;
  countsInGradebook: boolean; publishScoreAt: string; studentIds: number[];
};

const draftRong = (classId: number): Draft => {
  const bo = macDinhCua("BAI_TAP");
  return {
    title: "", source: "worksheet", worksheetId: 0, documentId: 0,
    classIds: [classId], anchorPeriodId: 0, dueBufferMinutes: 120,
    openAt: "", dueAt: "", status: "PUBLISHED",
    taskKind: bo.taskKind, requirement: bo.requirement, maxAttempts: bo.maxAttempts,
    latePolicy: bo.latePolicy, latePenaltyPercent: bo.latePenaltyPercent, answerReveal: bo.answerReveal,
    countsInGradebook: bo.countsInGradebook, publishScoreAt: "", studentIds: [],
  };
};

/** Nhãn trạng thái vòng đời do server tính, không phải cột `status` giáo viên đặt. */
const stateLabel: Record<AssignmentState, string> = {
  DRAFT: "Chưa giao", SCHEDULED: "Chờ tới giờ mở", OPEN: "Đang mở",
  LATE_OPEN: "Quá hạn — còn nhận muộn", CLOSED: "Đã đóng",
};
const stateTone: Record<AssignmentState, string> = {
  DRAFT: "bg-surface-variant text-on-surface-variant",
  SCHEDULED: "border border-outline-variant text-on-surface-variant",
  OPEN: "bg-primary-container/30 text-primary",
  LATE_OPEN: "bg-error-container/30 text-error",
  CLOSED: "bg-surface-variant text-on-surface-variant",
};

/** Chuyển "2026-08-18T14:30" của <input datetime-local> thành ISO có múi giờ để backend đọc đúng. */
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const at = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
};
const moment = (iso: string | null) => (iso ? new Date(iso).toLocaleString("vi-VN") : "");

/**
 * Hai mốc giờ suy từ buổi, viết thành câu. Hạn rỗng thì in đúng lý do server trả về — màn hình
 * không được đoán một ngày, vì con số đoán ra trông y hệt con số thật.
 */
const moTaHan = (han: HanTheoBuoi) => [
  han.moLuc ? `mở ${moment(han.moLuc)}` : "mở khi bấm Hoàn thành buổi",
  han.hanNop ? `hạn ${moment(han.hanNop)}` : `chưa có hạn — ${han.lyDoTrong ?? "lịch khóa chưa tới đó"}`,
].join(" · ");

const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="flex flex-col gap-1">
    <span className="text-[11px] font-semibold text-on-surface-variant">{label}</span>
    {children}
    {hint && <span className="text-[11px] text-on-surface-variant">{hint}</span>}
  </label>
);

const control = "h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface";
const nutPhu = "h-9 px-3 rounded-lg border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors";
const nutChinh = "h-9 px-4 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50";

/**
 * Giao bài cho lớp, ba bước: <b>chọn đề → chọn lớp và buổi → chọn loại nhiệm vụ</b>.
 *
 * <p>Ba bước vì đó là ba câu hỏi khác nhau, và trộn chúng vào một biểu mẫu phẳng là lý do trước
 * đây giáo viên phải tự gõ ngày mở cho từng bài. Cái họ thực sự nói là <em>"nộp trước buổi sau"</em>
 * — bước 2 nhận đúng câu ấy, còn hai mốc giờ do {@code NeoBuoi} suy ra.
 *
 * <p>Xem trước hạn nộp gọi thẳng cửa {@code /periods/{id}/han}, đúng hàm mà lúc lưu server sẽ gọi.
 * Tự tính lại ở đây thì đỡ một lượt mạng, đổi lại có hai luật cùng trả lời "hạn là bao giờ" — và
 * hai luật thì sớm muộn lệch nhau mà không có gì báo.
 *
 * <p>Loại nhiệm vụ chỉ đổ giá trị mặc định; mọi ô vẫn sửa được sau đó, và server không có nhánh
 * nào rẽ theo loại trong luật vòng đời.
 */
export function ClassTaskPanel({ session, classId }: { session: AuthSession; classId: number }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftRong(classId));
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [composing, setComposing] = useState(false);
  const [buoc, setBuoc] = useState<1 | 2 | 3>(1);
  const [timPhieu, setTimPhieu] = useState("");
  const [locTheoTiet, setLocTheoTiet] = useState(false);
  const [chonEm, setChonEm] = useState(false);
  const [analysing, setAnalysing] = useState<Assignment | null>(null);

  const listQuery = useQuery({ queryKey: ["class-assignments", session.accessToken, classId], queryFn: () => getAssignments(session, classId) });
  const rows = listQuery.data ?? [];

  const sourceQuery = useQuery({
    queryKey: ["class-task-sources", session.accessToken, classId],
    queryFn: async () => {
      const [worksheets, documents, classes] = await Promise.all([
        getWorksheets(session), getClassDocuments(session, classId), getClasses(session),
      ]);
      return { worksheets, documents, classes };
    },
    enabled: composing,
  });
  const worksheets = sourceQuery.data?.worksheets ?? [];
  const documents = sourceQuery.data?.documents ?? [];
  const classes = sourceQuery.data?.classes ?? [];
  const tenLop = (id: number) => classes.find(row => row.id === id)?.name ?? `lớp #${id}`;

  // Tiết của từng lớp đang chọn. Hỏi riêng từng lớp vì mỗi lớp chạy khóa riêng — gộp lại thành
  // một danh sách chung sẽ cho neo vào tiết mà lớp kia không có, và bài ấy không bao giờ mở.
  const khoaLop = [...draft.classIds].sort((a, b) => a - b).join(",");
  const periodsQuery = useQuery({
    queryKey: ["class-task-periods", session.accessToken, khoaLop],
    queryFn: () => Promise.all(draft.classIds.map(async id => ({ classId: id, periods: await getClassPeriods(session, id) }))),
    enabled: composing && draft.classIds.length > 0,
  });
  /** Chỉ những tiết mà <b>mọi</b> lớp đang chọn đều học — neo là lời hứa phải giữ được ở cả N lớp. */
  const tietChung = useMemo<ClassPeriod[]>(() => {
    const nhom = periodsQuery.data ?? [];
    if (!nhom.length) return [];
    const [dau, ...conLai] = nhom;
    return dau.periods.filter(tiet => conLai.every(n => n.periods.some(x => x.id === tiet.id)));
  }, [periodsQuery.data]);
  const baiHocCuaLop = useMemo(
    () => new Set((periodsQuery.data ?? []).flatMap(n => n.periods).map(t => t.lesson_id).filter((x): x is number => x != null)),
    [periodsQuery.data]);

  const neo = draft.anchorPeriodId > 0;
  const hanQuery = useQuery({
    queryKey: ["class-task-han", session.accessToken, khoaLop, draft.anchorPeriodId, draft.dueBufferMinutes],
    queryFn: () => Promise.all(draft.classIds.map(async id => ({
      classId: id, han: await getPeriodDeadline(session, id, draft.anchorPeriodId, draft.dueBufferMinutes),
    }))),
    enabled: composing && neo && draft.classIds.length > 0,
  });
  const impactQuery = useQuery({
    queryKey: ["worksheet-impact", session.accessToken, draft.worksheetId],
    queryFn: () => getWorksheetImpact(session, draft.worksheetId),
    enabled: composing && draft.source === "worksheet" && draft.worksheetId > 0,
  });
  const rosterQuery = useQuery({
    queryKey: ["class-roster", session.accessToken, draft.classIds[0]],
    queryFn: () => getClassRoster(session, draft.classIds[0]),
    enabled: chonEm && draft.classIds.length === 1,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["class-assignments"] });
  const than = () => ({
    lessonId: null,
    worksheetId: draft.source === "worksheet" ? draft.worksheetId : null,
    documentId: draft.source === "document" ? draft.documentId : null,
    title: draft.title.trim(),
    // Neo buổi thì hai mốc giờ là kết quả chứ không phải đầu vào — server tính lại và bỏ qua thứ
    // gửi lên. Gửi kèm thì màn hình nói một đằng, bảng một nẻo.
    openAt: neo ? null : toIso(draft.openAt),
    dueAt: neo ? null : toIso(draft.dueAt),
    status: draft.status,
    requirement: draft.requirement,
    anchorPeriodId: neo ? draft.anchorPeriodId : null,
    dueBufferMinutes: draft.dueBufferMinutes,
    taskKind: draft.taskKind,
    answerReveal: draft.answerReveal,
    countsInGradebook: draft.countsInGradebook,
    maxAttempts: draft.maxAttempts,
    latePolicy: draft.latePolicy,
    latePenaltyPercent: draft.latePolicy === "PENALTY" ? draft.latePenaltyPercent : 0,
    publishScoreAt: toIso(draft.publishScoreAt),
    studentIds: draft.studentIds,
  });
  const saveMutation = useMutation({
    mutationFn: async (): Promise<Assignment[]> => {
      if (editing) return [await saveAssignment(session, { ...than(), classId: editing.classId }, editing.id)];
      if (draft.classIds.length === 1) return [await saveAssignment(session, { ...than(), classId: draft.classIds[0] })];
      return createAssignmentBatch(session, { ...than(), classIds: draft.classIds });
    },
    onSuccess: async () => { await invalidate(); reset(); },
  });
  const deleteMutation = useMutation({ mutationFn: (id: number) => deleteAssignment(session, id), onSuccess: invalidate });
  const error = [listQuery, sourceQuery, periodsQuery, hanQuery, rosterQuery, saveMutation, deleteMutation]
    .map(q => (q.isError ? messageOf(q.error) : "")).find(Boolean) ?? "";

  const reset = () => {
    setDraft(draftRong(classId)); setEditing(null); setComposing(false);
    setBuoc(1); setChonEm(false); setTimPhieu(""); setLocTheoTiet(false);
  };
  const edit = (row: Assignment) => {
    setEditing(row); setComposing(true); setBuoc(1); setChonEm(row.targetScope === "SELECTED");
    setDraft({
      title: row.title,
      source: row.documentId ? "document" : "worksheet",
      worksheetId: row.worksheetId ?? 0,
      documentId: row.documentId ?? 0,
      classIds: [row.classId],
      anchorPeriodId: row.anchorPeriodId ?? 0,
      dueBufferMinutes: row.dueBufferMinutes ?? 120,
      openAt: toLocal(row.openAt),
      dueAt: toLocal(row.dueAt),
      status: row.status,
      taskKind: row.taskKind,
      requirement: row.requirement,
      maxAttempts: row.maxAttempts ?? 1,
      latePolicy: row.latePolicy ?? "REJECT",
      latePenaltyPercent: row.latePenaltyPercent ?? 0,
      answerReveal: row.answerReveal,
      countsInGradebook: row.countsInGradebook,
      publishScoreAt: toLocal(row.publishScoreAt),
      studentIds: row.studentIds ?? [],
    });
  };

  const phieuChon = worksheets.find(row => row.id === draft.worksheetId);
  const taiLieuChon = documents.find(row => row.document_id === draft.documentId);
  const tenNguon = draft.source === "worksheet" ? phieuChon?.name : taiLieuChon?.title;
  const phieuNhap = draft.source === "worksheet" && phieuChon != null && phieuChon.status !== "PUBLISHED";
  const daChonNguon = draft.source === "worksheet" ? draft.worksheetId > 0 : draft.documentId > 0;

  const phieuHien = worksheets.filter(row =>
    (!timPhieu || row.name.toLocaleLowerCase("vi").includes(timPhieu.toLocaleLowerCase("vi")))
    && (!locTheoTiet || (row.lessonId != null && baiHocCuaLop.has(row.lessonId))));

  // Cùng bộ điều kiện server sẽ từ chối — báo tại chỗ để giáo viên không phải bấm lưu mới biết.
  const conflict =
    phieuNhap ? "Phiếu còn là bản nháp; phát hành ở màn Quản lý Phiếu & Đề rồi mới giao được."
    : !draft.classIds.length ? "Chọn ít nhất một lớp."
    : draft.classIds.length > 1 && draft.studentIds.length ? "Giao nhiều lớp thì không chọn riêng học sinh được."
    : draft.classIds.length > 1 && draft.source === "document" ? "Tài liệu chỉ giao được cho lớp đã gắn nó."
    : !neo && draft.openAt && draft.dueAt && new Date(draft.openAt) > new Date(draft.dueAt) ? "Giờ mở phải trước hạn nộp."
    : !neo && draft.latePolicy !== "REJECT" && !draft.dueAt ? "Chính sách nộp muộn chỉ có nghĩa khi bài có hạn nộp."
    : draft.latePolicy === "PENALTY" && draft.latePenaltyPercent <= 0 ? "Chọn trừ điểm thì phần trăm trừ phải lớn hơn 0."
    : "";

  const tomTat: string[] = [
    tenNguon ?? "chưa chọn đề",
    `${draft.classIds.length} lớp · ${neo ? tietChung.find(t => t.id === draft.anchorPeriodId)?.title ?? "neo buổi" : "ngày tự đặt"}`,
    nhanLoai[draft.taskKind] + (draft.studentIds.length ? ` · ${draft.studentIds.length} em` : ""),
  ];
  const tieuDeBuoc = ["Chọn đề", "Chọn lớp & buổi", "Loại nhiệm vụ"];

  const doiLoai = (kind: TaskKind) => {
    const bo = macDinhCua(kind);
    setDraft({
      ...draft, taskKind: bo.taskKind, requirement: bo.requirement, maxAttempts: bo.maxAttempts,
      latePolicy: bo.latePolicy, latePenaltyPercent: bo.latePenaltyPercent,
      answerReveal: bo.answerReveal, countsInGradebook: bo.countsInGradebook,
    });
  };
  const doiLop = (id: number, bat: boolean) => setDraft({
    ...draft,
    classIds: bat ? [...draft.classIds, id] : draft.classIds.filter(x => x !== id),
    // Đổi tập lớp thì tiết chung đổi theo; giữ neo cũ lại là giữ một tiết có thể lớp mới không học.
    anchorPeriodId: 0,
    studentIds: [],
  });

  return <section className="flex flex-col gap-4">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h3 className="text-base font-bold text-on-surface">Nhiệm vụ &amp; đề thi</h3>
        <p className="text-xs text-on-surface-variant">
          {rows.filter(row => row.requirement === "BAT_BUOC").length} bắt buộc · {rows.filter(row => row.requirement === "TU_CHON").length} tự chọn
        </p>
      </div>
      <button onClick={() => (composing ? reset() : setComposing(true))} className="h-9 px-3 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity">
        {composing ? "Đóng" : "Giao bài mới"}
      </button>
    </div>

    {error && <div className="api-error">{error}</div>}

    {composing && (
      <div className="border border-outline-variant rounded-lg bg-surface-container-lowest flex flex-col">
        <div className="flex items-stretch divide-x divide-outline-variant border-b border-outline-variant">
          {tieuDeBuoc.map((ten, i) => {
            const so = (i + 1) as 1 | 2 | 3;
            return (
              <button key={ten} onClick={() => setBuoc(so)}
                className={`flex-1 px-3 py-2 text-left transition-colors ${buoc === so ? "bg-primary-container/20" : "hover:bg-surface-container-low"}`}>
                <p className={`text-xs font-bold ${buoc === so ? "text-primary" : "text-on-surface-variant"}`}>{so}. {ten}</p>
                <p className="text-[11px] text-on-surface-variant truncate">{tomTat[i]}</p>
              </button>
            );
          })}
        </div>

        <div className="p-4 flex flex-col gap-3">
          {buoc === 1 && <>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={draft.source} onChange={e => setDraft({ ...draft, source: e.target.value as Draft["source"], worksheetId: 0, documentId: 0 })} className={control}>
                <option value="worksheet">Phiếu bài tập</option>
                <option value="document">Tài liệu của lớp</option>
              </select>
              {draft.source === "worksheet" && <>
                <input placeholder="Tìm tên phiếu…" value={timPhieu} onChange={e => setTimPhieu(e.target.value)} className={`${control} flex-1 min-w-[180px]`} />
                <button onClick={() => setLocTheoTiet(!locTheoTiet)}
                  className={`h-9 px-3 rounded-lg text-xs font-semibold border transition-colors ${locTheoTiet ? "border-primary text-primary bg-primary-container/20" : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low"}`}>
                  Chỉ phiếu gắn với chương trình lớp
                </button>
              </>}
            </div>

            {draft.source === "worksheet" ? (
              <div className="max-h-64 overflow-auto thin-scrollbar flex flex-col divide-y divide-outline-variant border border-outline-variant rounded-lg">
                {phieuHien.map(row => (
                  <button key={row.id} onClick={() => setDraft({ ...draft, worksheetId: row.id, title: draft.title || row.name })}
                    className={`text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors ${draft.worksheetId === row.id ? "bg-primary-container/20" : "hover:bg-surface-container-low"}`}>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-on-surface truncate">{row.name}</span>
                      <span className="block text-xs text-on-surface-variant">{row.items.length} câu{row.lessonId != null && baiHocCuaLop.has(row.lessonId) ? " · gắn với bài học của lớp" : ""}</span>
                    </span>
                    {row.status !== "PUBLISHED" && <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded bg-surface-variant text-on-surface-variant">Bản nháp</span>}
                  </button>
                ))}
                {!phieuHien.length && <p className="text-sm text-on-surface-variant text-center py-6">
                  {locTheoTiet ? "Không có phiếu nào gắn với bài học của lớp — bỏ lọc để xem tất cả." : "Chưa có phiếu nào."}
                </p>}
              </div>
            ) : (
              <Field label="Chọn tài liệu" hint="Chỉ tài liệu đã gắn vào lớp này">
                <select value={draft.documentId} onChange={e => setDraft({ ...draft, documentId: Number(e.target.value), title: draft.title || (documents.find(d => d.document_id === Number(e.target.value))?.title ?? "") })} className={`${control} w-full`}>
                  <option value={0}>Chọn tài liệu…</option>
                  {documents.map(row => <option key={row.id} value={row.document_id}>{row.title}</option>)}
                </select>
              </Field>
            )}

            {draft.source === "document" && !documents.length && (
              <p className="text-xs text-on-surface-variant">Lớp chưa có tài liệu nào — gắn tài liệu ở tab Tài liệu trước khi giao theo tài liệu.</p>
            )}
            {phieuNhap && (
              <p className="text-xs text-error">Phiếu còn là bản nháp. Phát hành nó ở màn Quản lý Phiếu &amp; Đề rồi mới giao được — giao bản nháp rồi sửa thì học sinh mở ra thấy đề khác đề đã nộp.</p>
            )}
            {/* Phiếu đã giao thì đóng băng. Nói trước cái giá ở đây, chứ không để giáo viên biết
                lúc bấm sửa và nhận một câu từ chối. */}
            {Boolean(impactQuery.data?.length) && (
              <p className="text-xs text-on-surface-variant">
                Phiếu này đang dùng ở {impactQuery.data!.length} bài giao
                {impactQuery.data!.reduce((tong, r) => tong + r.so_da_nop, 0) > 0
                  && ` · ${impactQuery.data!.reduce((tong, r) => tong + r.so_da_nop, 0)} bài đã nộp`}
                . Sửa nội dung phiếu sẽ đổi đề của cả những bài ấy — muốn khác thì nhân bản.
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button onClick={() => setBuoc(2)} disabled={!daChonNguon || phieuNhap} className={nutChinh}>Tiếp: chọn lớp &amp; buổi</button>
            </div>
          </>}

          {buoc === 2 && <>
            <Field label="Giao cho lớp nào" hint={editing ? "Sửa bài đã giao thì không đổi lớp được — xoá và giao lại nếu cần." : "Nhiều lớp = nhiều bài giao riêng biệt, mỗi lớp một hạn nộp."}>
              <div className="flex flex-wrap gap-2">
                {classes.map(lop => {
                  const chon = draft.classIds.includes(lop.id);
                  const khoa = Boolean(editing) || (draft.source === "document" && lop.id !== classId);
                  return (
                    <button key={lop.id} disabled={khoa} onClick={() => doiLop(lop.id, !chon)}
                      className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 ${chon ? "border-primary text-primary bg-primary-container/20" : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low"}`}>
                      {lop.name}
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="border-t border-outline-variant pt-3 flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setDraft({ ...draft, anchorPeriodId: tietChung[0]?.id ?? 0 })} disabled={!tietChung.length}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 ${neo ? "border-primary text-primary bg-primary-container/20" : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low"}`}>
                  Neo vào buổi
                </button>
                <button onClick={() => setDraft({ ...draft, anchorPeriodId: 0 })}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-colors ${!neo ? "border-primary text-primary bg-primary-container/20" : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low"}`}>
                  Ngày giờ tự đặt
                </button>
              </div>

              {!tietChung.length && !periodsQuery.isLoading && (
                <p className="text-xs text-on-surface-variant">
                  {draft.classIds.length > 1
                    ? "Các lớp đang chọn không học chung tiết nào — đặt ngày tay, hoặc giao riêng từng lớp để neo buổi."
                    : "Lớp chưa gắn khóa nào của chương trình — đặt ngày tay, hoặc gắn khóa ở phần ghi danh."}
                </p>
              )}

              {neo ? <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Neo vào tiết" hint="Bài mở khi lớp bấm Hoàn thành buổi này">
                    <select value={draft.anchorPeriodId} onChange={e => setDraft({ ...draft, anchorPeriodId: Number(e.target.value) })} className={`${control} w-full`}>
                      {tietChung.map(tiet => (
                        <option key={tiet.id} value={tiet.id}>
                          {tiet.strand_name} · tiết {tiet.period_no}{tiet.title ? ` — ${tiet.title}` : ""}{tiet.closed_at ? " (đã dạy)" : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Đệm trước buổi sau (phút)" hint="Hạn = đầu tuần học kế tiếp trừ đi khoảng này">
                    <input type="number" min={0} max={10080} value={draft.dueBufferMinutes}
                      onChange={e => setDraft({ ...draft, dueBufferMinutes: Number(e.target.value) })} className={`${control} w-full`} />
                  </Field>
                </div>
                <div className="rounded-lg border border-outline-variant bg-surface-container-low/40 px-3 py-2 flex flex-col gap-1">
                  <p className="text-[11px] font-semibold text-on-surface-variant">Xem trước hạn nộp</p>
                  {hanQuery.isLoading && <p className="text-xs text-on-surface-variant">Đang tính…</p>}
                  {(hanQuery.data ?? []).map(dong => (
                    <p key={dong.classId} className="text-xs text-on-surface">
                      <span className="font-semibold">{tenLop(dong.classId)}</span>: {moTaHan(dong.han)}
                    </p>
                  ))}
                </div>
              </> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Giờ mở" hint="Bỏ trống là mở ngay">
                    <input type="datetime-local" value={draft.openAt} onChange={e => setDraft({ ...draft, openAt: e.target.value })} className={`${control} w-full`} />
                  </Field>
                  <Field label="Hạn nộp" hint="Bỏ trống là không giới hạn">
                    <input type="datetime-local" value={draft.dueAt} onChange={e => setDraft({ ...draft, dueAt: e.target.value })} className={`${control} w-full`} />
                  </Field>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button onClick={() => setBuoc(1)} className={nutPhu}>Quay lại</button>
              <button onClick={() => setBuoc(3)} disabled={!draft.classIds.length} className={nutChinh}>Tiếp: loại nhiệm vụ</button>
            </div>
          </>}

          {buoc === 3 && <>
            <div className="flex flex-wrap gap-2">
              {BO_MAC_DINH.map(bo => (
                <button key={bo.taskKind} onClick={() => doiLoai(bo.taskKind)}
                  className={`flex-1 min-w-[180px] text-left px-3 py-2 rounded-lg border transition-colors ${draft.taskKind === bo.taskKind ? "border-primary bg-primary-container/20" : "border-outline-variant hover:bg-surface-container-low"}`}>
                  <span className={`block text-sm font-bold ${draft.taskKind === bo.taskKind ? "text-primary" : "text-on-surface"}`}>{bo.nhan}</span>
                  <span className="block text-[11px] text-on-surface-variant">{bo.moTa}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-on-surface-variant">Ba nút này chỉ đổ giá trị mặc định — mọi ô dưới đây vẫn sửa được.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 border-t border-outline-variant pt-3">
              <Field label="Tên bài giao">
                <input required placeholder="VD: Kiểm tra 15 phút — Hàm số bậc hai" value={draft.title}
                  onChange={e => setDraft({ ...draft, title: e.target.value })} className={`${control} w-full`} />
              </Field>
              <Field label="Cách tính">
                <select value={draft.requirement} onChange={e => setDraft({ ...draft, requirement: e.target.value as ClassRequirement })} className={`${control} w-full`}>
                  <option value="BAT_BUOC">Bắt buộc — vào tỉ lệ nộp</option>
                  <option value="TU_CHON">Tự chọn — chỉ tính tự giác</option>
                </select>
              </Field>
              <Field label="Trạng thái">
                <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })} className={`${control} w-full`}>
                  <option value="PUBLISHED">Đã giao</option>
                  <option value="DRAFT">Chưa giao — học sinh không thấy</option>
                  <option value="COMPLETED">Đã đóng</option>
                </select>
              </Field>
              <Field label="Số lượt nộp" hint={draft.maxAttempts === 0 ? "0 = không giới hạn" : undefined}>
                <input type="number" min={0} max={50} value={draft.maxAttempts}
                  onChange={e => setDraft({ ...draft, maxAttempts: Number(e.target.value) })} className={`${control} w-full`} />
              </Field>
              <Field label="Quá hạn thì sao">
                <select value={draft.latePolicy} onChange={e => setDraft({ ...draft, latePolicy: e.target.value as LatePolicy })} className={`${control} w-full`}>
                  <option value="REJECT">Không nhận nữa</option>
                  <option value="ACCEPT">Vẫn nhận, không trừ điểm</option>
                  <option value="PENALTY">Vẫn nhận, trừ điểm</option>
                </select>
              </Field>
              {draft.latePolicy === "PENALTY" && (
                <Field label="Trừ bao nhiêu phần trăm" hint={`10 điểm nộp muộn còn ${(10 * (100 - draft.latePenaltyPercent) / 100).toFixed(1)}`}>
                  <input type="number" min={1} max={100} value={draft.latePenaltyPercent}
                    onChange={e => setDraft({ ...draft, latePenaltyPercent: Number(e.target.value) })} className={`${control} w-full`} />
                </Field>
              )}
              <Field label="Học sinh thấy đáp án khi nào">
                <select value={draft.answerReveal} onChange={e => setDraft({ ...draft, answerReveal: e.target.value as AnswerReveal })} className={`${control} w-full`}>
                  {(Object.keys(nhanHienDapAn) as AnswerReveal[]).map(muc => <option key={muc} value={muc}>{nhanHienDapAn[muc]}</option>)}
                </select>
              </Field>
              <Field label="Giờ công bố điểm" hint="Bỏ trống thì phải bấm trả từng bài">
                <input type="datetime-local" value={draft.publishScoreAt} onChange={e => setDraft({ ...draft, publishScoreAt: e.target.value })} className={`${control} w-full`} />
              </Field>
              <label className="flex items-center gap-2 self-end pb-1">
                <input type="checkbox" checked={draft.countsInGradebook} onChange={e => setDraft({ ...draft, countsInGradebook: e.target.checked })} className="accent-primary" />
                <span className="text-sm text-on-surface">Tính vào điểm trung bình</span>
              </label>
            </div>

            {/* Giao cho vài em là đường học bù / thi lại. Cả lớp thì không sinh dòng nào, nhờ vậy
                em vào lớp muộn tự có bài và em rời lớp tự rụng — không cần chạy lại gì. */}
            <div className="border-t border-outline-variant pt-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-on-surface-variant">Ai nhận bài</span>
                <span className="text-sm text-on-surface">{draft.studentIds.length ? `${draft.studentIds.length} em được chọn` : "Cả lớp"}</span>
                {draft.classIds.length === 1 ? (
                  <button onClick={() => setChonEm(!chonEm)} className="px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary-container/20 rounded transition-colors">
                    {chonEm ? "Đóng danh sách" : "Chọn học sinh"}
                  </button>
                ) : (
                  <span className="text-[11px] text-on-surface-variant">Giao nhiều lớp thì chỉ giao được cả lớp.</span>
                )}
                {Boolean(draft.studentIds.length) && (
                  <button onClick={() => setDraft({ ...draft, studentIds: [] })} className="px-2.5 py-1 text-xs font-semibold text-on-surface-variant hover:bg-surface-container rounded transition-colors">Trả về cả lớp</button>
                )}
              </div>
              {chonEm && draft.classIds.length === 1 && (
                <div className="max-h-48 overflow-auto thin-scrollbar border border-outline-variant rounded-lg divide-y divide-outline-variant">
                  {(rosterQuery.data ?? []).map(em => {
                    const chon = draft.studentIds.includes(em.student_id);
                    return (
                      <label key={em.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-container-low transition-colors cursor-pointer">
                        <input type="checkbox" checked={chon} className="accent-primary"
                          onChange={e => setDraft({ ...draft, studentIds: e.target.checked ? [...draft.studentIds, em.student_id] : draft.studentIds.filter(x => x !== em.student_id) })} />
                        <span className="text-sm text-on-surface truncate">{em.full_name}</span>
                        <span className="text-xs text-on-surface-variant truncate">{em.username ?? em.email}</span>
                      </label>
                    );
                  })}
                  {!rosterQuery.data?.length && !rosterQuery.isLoading && <p className="text-xs text-on-surface-variant text-center py-4">Lớp chưa có học sinh nào.</p>}
                </div>
              )}
            </div>

            {conflict && <p className="text-xs text-error">{conflict}</p>}

            <div className="flex items-center gap-2 pt-1">
              <button onClick={() => setBuoc(2)} className={nutPhu}>Quay lại</button>
              <button onClick={() => saveMutation.mutate()} disabled={!daChonNguon || !draft.title.trim() || Boolean(conflict) || saveMutation.isPending} className={nutChinh}>
                {saveMutation.isPending ? "Đang lưu…" : editing ? "Cập nhật" : draft.classIds.length > 1 ? `Giao cho ${draft.classIds.length} lớp` : "Giao bài"}
              </button>
              <button onClick={reset} className={nutPhu}>Hủy</button>
            </div>
          </>}
        </div>
      </div>
    )}

    <div className="flex flex-col divide-y divide-outline-variant border border-outline-variant rounded-lg overflow-hidden">
      {rows.map(row => {
        const state = row.state ?? "OPEN";
        const timing = [
          row.anchorPeriodLabel ? `neo vào ${row.anchorPeriodLabel}` : "",
          row.openAt ? `mở ${moment(row.openAt)}` : row.anchorPeriodId ? "mở khi chốt buổi" : "",
          row.dueAt ? `hạn ${moment(row.dueAt)}` : row.dueReason ? `chưa có hạn — ${row.dueReason}` : "không giới hạn hạn nộp",
          row.maxAttempts === 0 ? "nộp lại thoải mái" : `${row.maxAttempts} lượt nộp`,
          row.latePolicy === "PENALTY" ? `muộn trừ ${row.latePenaltyPercent}%` : row.latePolicy === "ACCEPT" ? "nhận muộn" : "",
          row.publishScoreAt ? `công bố điểm ${moment(row.publishScoreAt)}` : "",
          row.countsInGradebook ? "" : "không vào điểm trung bình",
        ].filter(Boolean).join(" · ");
        return (
          <div key={row.id} className="flex items-center justify-between gap-3 p-3 bg-surface-container-lowest hover:bg-surface-container-low transition-colors">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-on-surface truncate">{row.title}</p>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${stateTone[state]}`}>{stateLabel[state] ?? state}</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-surface-variant text-on-surface-variant">{nhanLoai[row.taskKind] ?? row.taskKind}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${row.requirement === "BAT_BUOC" ? "bg-primary-container/30 text-primary" : "bg-surface-variant text-on-surface-variant"}`}>
                  {row.requirement === "BAT_BUOC" ? "Bắt buộc" : "Tự chọn"}
                </span>
                {row.targetScope === "SELECTED" && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-tertiary-container/30 text-on-tertiary-container">Riêng {row.studentIds.length} em</span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant truncate">
                {timing}{row.documentId ? " · theo tài liệu" : row.worksheetId ? " · theo phiếu bài tập" : ""}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* Chỉ phiếu đề mới chấm được từng câu; bài giao theo tài liệu không có đáp án để so. */}
              {row.worksheetId && (
                <button onClick={() => setAnalysing(row)} className="px-2.5 py-1 text-xs font-semibold text-on-surface-variant hover:bg-surface-container rounded transition-colors">Tỉ lệ đúng</button>
              )}
              <button onClick={() => edit(row)} className="px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary-container/20 rounded transition-colors">Sửa</button>
              <button onClick={() => { if (confirm(`Xóa nhiệm vụ "${row.title}"?`)) deleteMutation.mutate(row.id); }}
                className="px-2.5 py-1 text-xs font-semibold text-error hover:bg-error-container/30 rounded transition-colors">Xóa</button>
            </div>
          </div>
        );
      })}
      {!rows.length && <p className="text-sm text-on-surface-variant text-center py-8">Lớp chưa có nhiệm vụ nào.</p>}
    </div>

    {analysing && (
      <AssignmentAnalysisDialog session={session} assignmentId={analysing.id} title={analysing.title} onClose={() => setAnalysing(null)} />
    )}
  </section>;
}
