import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getMyAssignments,
  markAssignment,
  type AuthSession,
  type StudentAssignment,
} from "../api";
import { assignmentKind, dueDateLabel, formatPercent } from "./format";

type AssignmentsPageProps = {
  session: AuthSession;
  onOpenLesson: (lessonId: number) => void;
  onOpenWorksheet: (assignmentId: number) => void;
};

type Tab = "todo" | "submitted" | "graded";

function badge(label: string, urgent: boolean) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
        urgent ? "bg-error-container text-on-error-container" : "bg-surface-container-high text-on-surface-variant"
      }`}
    >
      <span className="material-symbols-outlined text-[14px]">schedule</span>
      {label}
    </span>
  );
}

function RowIcon({ kind }: { kind: "worksheet" | "lesson" }) {
  return (
    <div className="w-12 h-12 rounded-full bg-surface-container text-primary flex items-center justify-center shrink-0">
      <span className="material-symbols-outlined fill">
        {kind === "worksheet" ? "qr_code_scanner" : "computer"}
      </span>
    </div>
  );
}

export function AssignmentsPage({
  session,
  onOpenLesson,
  onOpenWorksheet,
}: AssignmentsPageProps) {
  const { data, refetch, error } = useQuery({
    queryKey: ["student-assignments", session.userId],
    queryFn: () => getMyAssignments(session),
  });
  const [tab, setTab] = useState<Tab>("todo");
  const [busyId, setBusyId] = useState<number | null>(null);

  const groups = useMemo(() => {
    const all = data ?? [];
    return {
      todo: all.filter((item) => item.progressStatus !== "COMPLETED"),
      submitted: all.filter((item) => item.progressStatus !== "NOT_OPENED"),
      graded: all.filter((item) => item.progressStatus === "COMPLETED"),
    } as const;
  }, [data]);

  const visible = tab === "todo" ? groups.todo : tab === "submitted" ? groups.submitted : groups.graded;

  const tabs: Array<{ key: Tab; label: string; count: number }> = [
    { key: "todo", label: "Cần làm", count: groups.todo.length },
    { key: "submitted", label: "Đã mở", count: groups.submitted.length },
    { key: "graded", label: "Đã hoàn thành", count: groups.graded.length },
  ];

  const complete = async (assignment: StudentAssignment) => {
    setBusyId(assignment.id);
    try {
      await markAssignment(session, assignment.id, true);
      await refetch();
    } finally {
      setBusyId(null);
    }
  };

  if (error) {
    return (
      <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm">
        {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Nhiệm vụ của tôi</h2>
          <p className="text-sm text-on-surface-variant">Hoàn thành bài tập để nắm vững kiến thức.</p>
        </div>
        <div className="flex bg-surface-container rounded-lg p-1">
          {tabs.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-all ${
                  active ? "bg-surface text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {item.label}
                <span
                  className={`inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[11px] font-bold ${
                    active ? "bg-error text-on-error" : "bg-surface-variant text-on-surface-variant"
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {!visible.length ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 text-center text-sm text-on-surface-variant">
          {tab === "todo" ? "Không có bài tập nào cần làm." : "Chưa có dữ liệu cho mục này."}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((assignment) => {
            const due = dueDateLabel(assignment.dueAt);
            const kind = assignmentKind(assignment);
            return (
              <article
                key={assignment.id}
                className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4"
              >
                <RowIcon kind={kind} />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">
                      {kind === "worksheet" ? "Phiếu giấy" : "Làm bài online"}
                    </span>
                    {due.urgent && badge(due.text, true)}
                  </div>
                  <h3 className="text-base font-semibold">{assignment.title}</h3>
                  <p className="text-sm text-on-surface-variant">
                    {kind === "worksheet" ? assignment.worksheetName : `Bài học #${assignment.lessonId}`} · {assignment.items.length} câu
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-xs text-on-surface-variant">Tiến độ {formatPercent(assignment.completionPercent)}</span>
                  <div className="flex gap-2">
                    {kind === "worksheet" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onOpenWorksheet(assignment.id)}
                          className="inline-flex h-9 px-3 items-center rounded-md border border-outline-variant text-xs font-medium hover:border-primary hover:text-primary transition-colors"
                        >
                          Làm bài
                        </button>
                        <button
                          type="button"
                          disabled={busyId === assignment.id || assignment.progressStatus === "COMPLETED"}
                          onClick={() => void complete(assignment)}
                          className="inline-flex h-9 px-3 items-center rounded-md bg-primary-container text-on-primary-container text-xs font-medium disabled:opacity-50"
                        >
                          {assignment.progressStatus === "COMPLETED" ? "Đã nộp" : "Đánh dấu hoàn thành"}
                        </button>
                      </>
                    ) : assignment.lessonId ? (
                      <button
                        type="button"
                        onClick={() => onOpenLesson(assignment.lessonId!)}
                        className="inline-flex h-9 px-3 items-center rounded-md bg-primary text-on-primary text-xs font-medium"
                      >
                        Vào học
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}