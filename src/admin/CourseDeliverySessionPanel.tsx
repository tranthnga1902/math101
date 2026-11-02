import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AuthSession,
  DeliverySession,
  DeliveryGenerateResult,
  DeliverySessionsResult,
  DeliverySessionDetail,
  SplitPolicy,
  AssessmentPolicy,
  getDeliverySessions,
  previewDeliverySessions,
  generateDeliverySessions,
  getDeliverySessionDetail,
  moveDeliverySessionUnit,
  insertDeliverySession,
  updateDeliverySession,
  deleteDeliverySession,
} from "../api";
import { Play, RotateCcw, Eye, Settings, ChevronRight, ChevronDown, ArrowRightLeft, Plus, Trash2, Save } from "lucide-react";
import { messageOf } from "../lib/errors";
import { CourseSessionsPdf } from "./CourseSessionsPdf";
import { LessonAttachments } from "../components/LessonAttachments";

interface Props {
  session: AuthSession;
  khoaId: number;
  khoaName: string;
}

const TYPE_LABEL: Record<string, string> = {
  TEACHING: "Bài dạy",
  REVIEW: "Ôn tập",
  EXAM: "Kiểm tra",
  ACTIVITY: "Thực hành",
};

const SPLIT_POLICY_LABEL: Record<SplitPolicy, string> = {
  KEEP_LESSON: "Giữ nguyên bài",
  BALANCED: "Cân đối",
  FIXED_CAPACITY: "Cố định",
};

const ASSESSMENT_POLICY_LABEL: Record<AssessmentPolicy, string> = {
  SEPARATE: "Tách riêng",
  MERGE: "Ghép chung",
};

const PERIOD_KIND_LABEL: Record<string, string> = {
  BAI_MOI: "Bài mới",
  ON_TAP: "Ôn tập",
  KIEM_TRA: "Kiểm tra",
  THUC_HANH: "Thực hành",
};

const SESSION_TYPES = ["TEACHING", "REVIEW", "EXAM", "ACTIVITY"] as const;

const ContinuationBadge: React.FC = () => (
  <span
    title="Buổi này chứa phần tiếp theo của bài đã bắt đầu ở buổi trước"
    style={{ display: "inline-block", marginTop: 3, fontSize: 11, fontWeight: 600, color: "#0369a1" }}
  >
    ↳ tiếp từ buổi trước
  </span>
);

/**
 * Panel quản lý buổi học của Khóa (course_delivery_sessions).
 * Buổi học KHÔNG có ngày — dùng chung cho mọi lớp học khóa này.
 */
export const CourseDeliverySessionPanel: React.FC<Props> = ({ session, khoaId, khoaName }) => {
  const queryClient = useQueryClient();
  const [unitsInput, setUnitsInput] = useState<string>("");
  const [splitPolicy, setSplitPolicy] = useState<SplitPolicy | "">("");
  const [assessmentPolicy, setAssessmentPolicy] = useState<AssessmentPolicy | "">("");

  const sessionsQuery = useQuery({
    queryKey: ["course-delivery-sessions", khoaId],
    queryFn: () => getDeliverySessions(session, khoaId),
  });

  const result = sessionsQuery.data as DeliverySessionsResult | undefined;
  const sessions = result?.sessions ?? [];
  const currentUnits = result?.unitsPerSession ?? null;
  const currentSplitPolicy = result?.splitPolicy ?? null;
  const currentAssessmentPolicy = result?.assessmentPolicy ?? null;
  const daSinh = sessions.length > 0;

  useEffect(() => {
    if (currentUnits != null && unitsInput === "") {
      setUnitsInput(String(currentUnits));
    }
  }, [currentUnits]);

  useEffect(() => {
    if (currentSplitPolicy != null && splitPolicy === "") {
      setSplitPolicy(currentSplitPolicy);
    }
  }, [currentSplitPolicy]);

  useEffect(() => {
    if (currentAssessmentPolicy != null && assessmentPolicy === "") {
      setAssessmentPolicy(currentAssessmentPolicy);
    }
  }, [currentAssessmentPolicy]);

  const unitsNum = unitsInput.trim() === "" ? undefined
    : /^\d+$/.test(unitsInput.trim()) ? Number(unitsInput.trim()) : undefined;
  const unitsValid = unitsNum == null || (unitsNum >= 1 && unitsNum <= 20);

  const [preview, setPreview] = useState<DeliveryGenerateResult | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [targetByUnit, setTargetByUnit] = useState<Record<number, number | "">>({});

  const genOptions = {
    unitsPerSession: unitsNum,
    splitPolicy: splitPolicy || undefined,
    assessmentPolicy: assessmentPolicy || undefined,
  };

  const previewMutation = useMutation({
    mutationFn: () => previewDeliverySessions(session, khoaId, genOptions),
    onSuccess: (data) => setPreview(data),
  });

  const generateMutation = useMutation({
    mutationFn: () => generateDeliverySessions(session, khoaId, genOptions),
    onSuccess: () => {
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ["course-delivery-sessions", khoaId] });
    },
  });

  const detailQuery = useQuery({
    queryKey: ["course-delivery-session-detail", khoaId, expandedId],
    queryFn: () => getDeliverySessionDetail(session, khoaId, expandedId as number),
    enabled: expandedId != null,
  });
  const detail = expandedId != null ? (detailQuery.data as DeliverySessionDetail | undefined) : undefined;

  const moveMutation = useMutation({
    mutationFn: ({ unitId, targetSessionId }: { unitId: number; targetSessionId: number }) =>
      moveDeliverySessionUnit(session, khoaId, unitId, targetSessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-delivery-sessions", khoaId] });
      queryClient.invalidateQueries({ queryKey: ["course-delivery-session-detail", khoaId] });
    },
  });

  const toggleExpand = (sessionId: number) => {
    setExpandedId((cur) => (cur === sessionId ? null : sessionId));
  };

  // ── Thêm buổi mới ──
  const [showInsertForm, setShowInsertForm] = useState(false);
  const [insertAfterId, setInsertAfterId] = useState<number | "">("");
  const [insertType, setInsertType] = useState<(typeof SESSION_TYPES)[number]>("TEACHING");
  const [insertTitle, setInsertTitle] = useState("");

  const insertMutation = useMutation({
    mutationFn: () =>
      insertDeliverySession(session, khoaId, {
        afterSessionId: insertAfterId === "" ? undefined : insertAfterId,
        sessionType: insertType,
        title: insertTitle.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-delivery-sessions", khoaId] });
      setShowInsertForm(false);
      setInsertAfterId("");
      setInsertType("TEACHING");
      setInsertTitle("");
    },
  });

  // ── Sửa buổi (trong khối chi tiết đang mở) ──
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editType, setEditType] = useState<(typeof SESSION_TYPES)[number]>("TEACHING");

  useEffect(() => {
    if (detail) {
      setEditTitle(detail.title ?? "");
      setEditNote(detail.note ?? "");
      setEditType(detail.sessionType);
    }
  }, [detail?.id]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateDeliverySession(session, khoaId, expandedId as number, {
        title: editTitle.trim() || null,
        note: editNote.trim() || null,
        sessionType: editType,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-delivery-sessions", khoaId] });
      queryClient.invalidateQueries({ queryKey: ["course-delivery-session-detail", khoaId] });
    },
  });

  // ── Xóa buổi ──
  const deleteMutation = useMutation({
    mutationFn: (sessionId: number) => deleteDeliverySession(session, khoaId, sessionId),
    onSuccess: (_data, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ["course-delivery-sessions", khoaId] });
      setExpandedId((cur) => (cur === sessionId ? null : cur));
    },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <CourseSessionsPdf session={session} khoaId={khoaId} khoaName={khoaName} />
      <style>{`
        .cw-delivery-table-lg .cw-clean-table th{font-size:12.5px;padding:12px 14px}
        .cw-delivery-table-lg .cw-clean-table td{font-size:14.5px;padding:13px 14px}
      `}</style>

      {/* ── Khung cấu hình sinh buổi ── */}
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 18, background: "#fff", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
          <Settings size={15} style={{ color: "var(--primary)" }} />
          Cấu hình quy tắc sinh buổi học
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 16 }}>
          {/* Input units_per_session */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 200, maxWidth: 240 }}>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "#64748b", textTransform: "uppercase" }}>
              Số tiết / buổi <span style={{ fontWeight: 400, textTransform: "none" }}>(units_per_session)</span>
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={unitsInput}
              onChange={(e) => setUnitsInput(e.target.value)}
              placeholder={currentUnits != null ? String(currentUnits) : "Mặc định: 1"}
              style={{ height: 34, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 7, fontSize: 13, background: "#f8fafc", outline: 0 }}
            />
            {currentUnits != null && unitsNum == null && (
              <span style={{ fontSize: 11.5, color: "#b45309" }}>Đang dùng cấu hình: {currentUnits} tiết/buổi</span>
            )}
          </div>

          {/* Cách chia nội dung khi một bài dài hơn units_per_session */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 170, maxWidth: 220 }}>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "#64748b", textTransform: "uppercase" }}>
              Cách chia nội dung
            </label>
            <select
              value={splitPolicy}
              onChange={(e) => setSplitPolicy(e.target.value as SplitPolicy)}
              style={{ height: 34, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 7, fontSize: 13, background: "#f8fafc", outline: 0 }}
            >
              {(["KEEP_LESSON", "BALANCED", "FIXED_CAPACITY"] as SplitPolicy[]).map((p) => (
                <option key={p} value={p}>{SPLIT_POLICY_LABEL[p]}</option>
              ))}
            </select>
          </div>

          {/* Cách xử lý tiết kiểm tra khi gom buổi */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 150, maxWidth: 200 }}>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "#64748b", textTransform: "uppercase" }}>
              Bài kiểm tra
            </label>
            <select
              value={assessmentPolicy}
              onChange={(e) => setAssessmentPolicy(e.target.value as AssessmentPolicy)}
              style={{ height: 34, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 7, fontSize: 13, background: "#f8fafc", outline: 0 }}
            >
              {(["SEPARATE", "MERGE"] as AssessmentPolicy[]).map((p) => (
                <option key={p} value={p}>{ASSESSMENT_POLICY_LABEL[p]}</option>
              ))}
            </select>
          </div>

          {/* Readonly nhịp dạy tuần */}
          {result?.tietMoiTuan != null && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 160, maxWidth: 200 }}>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "#64748b", textTransform: "uppercase" }}>
                Nhịp dạy tuần <span style={{ fontWeight: 400, textTransform: "none" }}>(chỉ đọc)</span>
              </label>
              <div style={{ height: 34, padding: "0 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, background: "#f1f5f9", color: "#64748b", display: "flex", alignItems: "center" }}>
                {result.tietMoiTuan} tiết / tuần
              </div>
            </div>
          )}
        </div>

        {unitsInput && !unitsValid && (
          <div style={{ color: "var(--danger)", fontSize: 12, fontWeight: 600 }}>Nhập số nguyên hợp lệ từ 1 đến 20</div>
        )}

        {/* Nút hành động */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
          <button
            type="button"
            className="cw-btn-outline"
            disabled={previewMutation.isPending || (!!unitsInput && !unitsValid)}
            onClick={() => previewMutation.mutate()}
          >
            <Eye size={14} />
            {previewMutation.isPending ? "Đang tính…" : "Xem trước buổi"}
          </button>

          {!daSinh ? (
            <button
              type="button"
              className="cw-btn-primary"
              disabled={generateMutation.isPending || (!!unitsInput && !unitsValid)}
              onClick={() => generateMutation.mutate()}
            >
              <Play size={14} />
              {generateMutation.isPending ? "Đang sinh…" : "Sinh buổi học"}
            </button>
          ) : (
            <button
              type="button"
              className="cw-btn-outline"
              style={{ borderColor: "#b45309", color: "#b45309", background: "#fffbeb" }}
              disabled={generateMutation.isPending || (!!unitsInput && !unitsValid)}
              onClick={() => {
                if (confirm("Sinh lại buổi học? Buổi đã chỉnh tay (MANUAL) sẽ được giữ nguyên. Các lớp đang dùng lịch dựa trên buổi hiện tại sẽ cần sinh lại lịch.")) {
                  generateMutation.mutate();
                }
              }}
            >
              <RotateCcw size={14} />
              {generateMutation.isPending ? "Đang cập nhật…" : "Sinh lại buổi học"}
            </button>
          )}
        </div>
      </div>

      {/* ── Kết quả xem trước (Preview) ── */}
      {preview && (
        <div style={{ border: "1px solid #bfdbfe", borderRadius: 8, padding: 16, background: "#eff6ff" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#1e40af", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              KẾT QUẢ XEM TRƯỚC BUỔI HỌC
            </span>
            <button
              type="button"
              onClick={() => setPreview(null)}
              style={{ border: 0, background: "transparent", fontSize: 16, color: "#64748b", cursor: "pointer", padding: "0 4px" }}
            >
              ✕
            </button>
          </div>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#1e293b" }}>
            Tổng số buổi sẽ sinh: <b>{preview.totalSessions} buổi</b>
          </p>
          {preview.warnings.length > 0 && (
            <div style={{ marginBottom: 10, color: "#b45309", fontSize: 12 }}>
              {preview.warnings.map((w, idx) => (
                <div key={idx}>⚠️ {w}</div>
              ))}
            </div>
          )}
          {preview.sessions.length > 0 && (
            <div className="cw-clean-table-wrap cw-delivery-table-lg" style={{ maxHeight: 240, overflowY: "auto", background: "#fff" }}>
              <table className="cw-clean-table">
                <thead>
                  <tr>
                    <th style={{ width: 65 }}>BUỔI</th>
                    <th style={{ width: 100 }}>MẠCH</th>
                    <th style={{ width: 110 }}>LOẠI</th>
                    <th>NỘI DUNG</th>
                    <th style={{ width: 80, textAlign: "right" }}>SỐ TIẾT</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sessions.map((row) => (
                    <tr key={row.seq}>
                      <td style={{ fontWeight: 600, color: "#64748b" }}>#{row.seq}</td>
                      <td style={{ color: "#64748b" }}>{row.strandName || "—"}</td>
                      <td><span className="cw-badge cw-badge-draft">{TYPE_LABEL[row.sessionType] || row.sessionType}</span></td>
                      <td>
                        <b>{row.title || `Buổi ${row.seq}`}</b>
                        {row.continuation && <div><ContinuationBadge /></div>}
                      </td>
                      <td style={{ textAlign: "right", color: "#64748b" }}>{row.units.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Danh sách buổi đã sinh ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
            DANH SÁCH BUỔI HỌC CỦA KHÓA ({sessions.length})
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              Không có ngày cụ thể — dùng chung cho mọi lớp
            </span>
            {daSinh && (
              <button
                type="button"
                className="cw-btn-outline"
                style={{ height: 30, padding: "0 10px", fontSize: 12 }}
                onClick={() => setShowInsertForm((v) => !v)}
              >
                <Plus size={13} />
                Thêm buổi
              </button>
            )}
          </div>
        </div>

        {showInsertForm && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 10, padding: 12, border: "1px dashed #cbd5e1", borderRadius: 8, background: "#f8fafc" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Chèn sau buổi</label>
              <select
                value={insertAfterId}
                onChange={(e) => setInsertAfterId(e.target.value ? Number(e.target.value) : "")}
                style={{ height: 32, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12.5, background: "#fff", outline: 0, minWidth: 200 }}
              >
                <option value="">— Đầu danh sách —</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>#{s.seq} — {s.title || `Buổi ${s.seq}`}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Loại buổi</label>
              <select
                value={insertType}
                onChange={(e) => setInsertType(e.target.value as (typeof SESSION_TYPES)[number])}
                style={{ height: 32, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12.5, background: "#fff", outline: 0 }}
              >
                {SESSION_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Tiêu đề (tuỳ chọn)</label>
              <input
                type="text"
                value={insertTitle}
                onChange={(e) => setInsertTitle(e.target.value)}
                placeholder="Vd: Ôn tập giữa kỳ"
                style={{ height: 32, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12.5, minWidth: 200, outline: 0 }}
              />
            </div>
            <button
              type="button"
              className="cw-btn-primary"
              disabled={insertMutation.isPending}
              onClick={() => insertMutation.mutate()}
              style={{ height: 32, padding: "0 12px", fontSize: 12.5 }}
            >
              {insertMutation.isPending ? "Đang thêm…" : "Thêm"}
            </button>
            {insertMutation.isError && (
              <span style={{ fontSize: 12, color: "var(--danger)" }}>{messageOf(insertMutation.error)}</span>
            )}
          </div>
        )}

        {sessionsQuery.isLoading ? (
          <div style={{ padding: "14px 4px", fontSize: 13, color: "#64748b" }}>Đang tải dữ liệu buổi học…</div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: "14px 4px", fontSize: 13, color: "#64748b" }}>
            Chưa có buổi học — cấu hình số tiết/buổi ở trên rồi bấm <b>Sinh buổi học</b>.
          </div>
        ) : (
          <div className="cw-clean-table-wrap cw-delivery-table-lg">
            <table className="cw-clean-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th style={{ width: 70 }}>BUỔI</th>
                  <th style={{ width: 110 }}>MẠCH</th>
                  <th>NỘI DUNG BUỔI HỌC</th>
                  <th style={{ width: 120 }}>LOẠI</th>
                  <th style={{ width: 80, textAlign: "center" }}>SỐ TIẾT</th>
                  <th style={{ width: 110, textAlign: "right" }}>NGUỒN</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((item: DeliverySession) => {
                  const isOpen = expandedId === item.id;
                  const targets = sessions.filter((s) => s.id !== item.id && s.strandName === item.strandName);
                  return (
                    <React.Fragment key={item.id}>
                      <tr>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.id)}
                            title="Xem và chuyển từng tiết"
                            style={{ border: 0, background: "transparent", cursor: "pointer", color: "#64748b", display: "inline-flex", padding: 0 }}
                          >
                            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        </td>
                        <td style={{ fontWeight: 600, color: "#64748b" }}>#{item.seq}</td>
                        <td style={{ color: "#64748b" }}>{item.strandName || "—"}</td>
                        <td>
                          <b style={{ color: "#0f172a" }}>{item.title || `Buổi ${item.seq}`}</b>
                          {item.continuation && <div><ContinuationBadge /></div>}
                        </td>
                        <td>
                          <span className="cw-badge cw-badge-active">
                            {TYPE_LABEL[item.sessionType] || item.sessionType}
                          </span>
                        </td>
                        <td style={{ textAlign: "center", color: "#64748b" }}>{item.unitCount ?? "—"}</td>
                        <td style={{ textAlign: "right" }}>
                          {item.source === "MANUAL" ? (
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: "#b45309" }}>Chỉnh tay</span>
                          ) : (
                            <span style={{ fontSize: 11.5, color: "#94a3b8" }}>Tự sinh</span>
                          )}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            title="Xóa buổi"
                            disabled={deleteMutation.isPending && deleteMutation.variables === item.id}
                            onClick={() => {
                              if (confirm(`Xóa buổi #${item.seq}? Chỉ xóa được nếu buổi rỗng và chưa lớp nào dùng trong lịch.`)) {
                                deleteMutation.mutate(item.id);
                              }
                            }}
                            style={{ border: 0, background: "transparent", cursor: "pointer", color: "#94a3b8", display: "inline-flex", padding: 4 }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                      {deleteMutation.isError && deleteMutation.variables === item.id && (
                        <tr>
                          <td colSpan={8} style={{ padding: "0 16px 8px 44px", background: "#f8fafc" }}>
                            <span style={{ fontSize: 12, color: "var(--danger)" }}>{messageOf(deleteMutation.error)}</span>
                          </td>
                        </tr>
                      )}
                      {isOpen && (
                        <tr>
                          <td colSpan={8} style={{ background: "#f8fafc", padding: "10px 16px 16px 44px" }}>
                            {detailQuery.isLoading || !detail ? (
                              <div style={{ fontSize: 13, color: "#64748b" }}>Đang tải danh sách tiết…</div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 10, paddingBottom: 8, borderBottom: "1px solid #e2e8f0" }}>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Tiêu đề</label>
                                    <input
                                      type="text"
                                      value={editTitle}
                                      onChange={(e) => setEditTitle(e.target.value)}
                                      style={{ height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12.5, minWidth: 200, outline: 0 }}
                                    />
                                  </div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Ghi chú</label>
                                    <input
                                      type="text"
                                      value={editNote}
                                      onChange={(e) => setEditNote(e.target.value)}
                                      style={{ height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12.5, minWidth: 200, outline: 0 }}
                                    />
                                  </div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Loại buổi</label>
                                    <select
                                      value={editType}
                                      onChange={(e) => setEditType(e.target.value as (typeof SESSION_TYPES)[number])}
                                      style={{ height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12.5, background: "#fff", outline: 0 }}
                                    >
                                      {SESSION_TYPES.map((t) => (
                                        <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <button
                                    type="button"
                                    className="cw-btn-outline"
                                    disabled={updateMutation.isPending}
                                    onClick={() => updateMutation.mutate()}
                                    style={{ height: 30, padding: "0 10px", fontSize: 12 }}
                                  >
                                    <Save size={12} />
                                    {updateMutation.isPending ? "Đang lưu…" : "Lưu"}
                                  </button>
                                  {updateMutation.isError && (
                                    <span style={{ fontSize: 12, color: "var(--danger)" }}>{messageOf(updateMutation.error)}</span>
                                  )}
                                </div>
                                {detail.units.map((unit) => {
                                  const unitKey = unit.id ?? unit.programPeriodId;
                                  const chosen = unit.id != null ? (targetByUnit[unit.id] ?? "") : "";
                                  const isMoving = moveMutation.isPending && moveMutation.variables?.unitId === unit.id;
                                  const err = moveMutation.isError && moveMutation.variables?.unitId === unit.id
                                    ? messageOf(moveMutation.error) : "";
                                  return (
                                    <div key={unitKey} style={{ display: "flex", flexDirection: "column", gap: 3, padding: "7px 0", borderBottom: "1px solid #e2e8f0" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <span style={{ fontSize: 12, color: "#94a3b8", width: 100, flexShrink: 0 }}>
                                          Tuần {unit.weekNo} · Tiết {unit.periodNo}
                                        </span>
                                        <span style={{ flex: 1, fontSize: 13.5, color: "#0f172a" }}>
                                          {unit.title || "—"}
                                          {unit.periodKind && (
                                            <span style={{ marginLeft: 6, fontSize: 11, color: "#64748b" }}>
                                              ({PERIOD_KIND_LABEL[unit.periodKind] || unit.periodKind})
                                            </span>
                                          )}
                                        </span>
                                        <select
                                          value={chosen}
                                          onChange={(e) => {
                                            if (unit.id == null) return;
                                            const v = e.target.value ? Number(e.target.value) : "";
                                            setTargetByUnit((cur) => ({ ...cur, [unit.id as number]: v }));
                                          }}
                                          style={{ height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12.5, background: "#fff", outline: 0 }}
                                        >
                                          <option value="">Chuyển đến buổi…</option>
                                          {targets.map((t) => (
                                            <option key={t.id} value={t.id}>#{t.seq} — {t.title || `Buổi ${t.seq}`}</option>
                                          ))}
                                        </select>
                                        <button
                                          type="button"
                                          className="cw-btn-outline"
                                          disabled={!chosen || unit.id == null || (moveMutation.isPending && moveMutation.variables?.unitId === unit.id)}
                                          onClick={() => {
                                            if (unit.id != null && chosen !== "") {
                                              moveMutation.mutate({ unitId: unit.id, targetSessionId: Number(chosen) });
                                            }
                                          }}
                                          style={{ height: 30, padding: "0 10px", fontSize: 12 }}
                                        >
                                          <ArrowRightLeft size={12} />
                                          {isMoving ? "Đang chuyển…" : "Chuyển"}
                                        </button>
                                      </div>
                                      {err && <span style={{ fontSize: 11.5, color: "var(--danger)" }}>{err}</span>}
                                    </div>
                                  );
                                })}
                                {targets.length === 0 && (
                                  <div style={{ fontSize: 12.5, color: "#94a3b8", paddingTop: 4 }}>
                                    Không có buổi khác cùng mạch để chuyển đến.
                                  </div>
                                )}
                                <section className="mt-5 pt-4 border-t border-outline-variant">
                                  <h4 className="text-sm font-semibold text-on-surface mb-3">Tài liệu của buổi học</h4>
                                  <p className="text-xs text-on-surface-variant mb-3">Kế thừa từ các bài học trong buổi. Học sinh chỉ thấy tài liệu đã xuất bản và được phép xem.</p>
                                  {[...new Set(detail.units.map(unit=>unit.lessonId).filter((id):id is number=>id!=null))].map(lessonId=><div key={lessonId} className="mb-4"><LessonAttachments session={session} lessonId={lessonId}/></div>)}
                                  {!detail.units.some(unit=>unit.lessonId!=null)&&<p className="text-sm text-on-surface-variant">Các tiết của buổi chưa được liên kết với bài học.</p>}
                                </section>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
