import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getClassCurriculum, getClassDocuments, getClassRoster, getGradebook, type AuthSession, type Classroom } from "../../api";
import { GradebookMatrix } from "../GradebookMatrix";
import { ClassRosterPanel } from "./ClassRosterPanel";
import { ClassCurriculumPanel } from "./ClassCurriculumPanel";
import { ClassDocumentPanel } from "./ClassDocumentPanel";
import { ClassSessionPanel } from "./ClassSessionPanel";
import { ClassTaskPanel } from "./ClassTaskPanel";
import { ClassProgressPanel } from "./ClassProgressPanel";
import { ClassGradingPanel } from "./ClassGradingPanel";
import { ClassSubmissionLogPanel } from "./ClassSubmissionLogPanel";

type Tab = "roster" | "curriculum" | "sessions" | "documents" | "tasks" | "grading" | "gradebook" | "log";

const tabs: [Tab, string][] = [
  ["roster", "Học sinh"],
  ["curriculum", "Chương trình học"],
  ["sessions", "Buổi học"],
  ["documents", "Tài liệu"],
  ["tasks", "Nhiệm vụ & đề thi"],
  ["grading", "Chấm bài"],
  ["gradebook", "Sổ điểm"],
  ["log", "Nhật ký nộp bài"],
];

/**
 * Toàn bộ chi tiết một lớp cho giáo viên: danh sách học sinh, chương trình học, buổi đã dạy,
 * tài liệu đi kèm, đề thi được giao, chấm bài, sổ điểm và nhật ký nộp bài.
 */
export function ClassDetail({ session, classroom, onClose }: { session: AuthSession; classroom: Classroom; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("roster");
  const [logStudent, setLogStudent] = useState<number | null>(null);
  const [matrixStudent, setMatrixStudent] = useState<number | null>(null);

  const countsQuery = useQuery({
    queryKey: ["class-detail-counts", session.accessToken, classroom.id],
    queryFn: async () => {
      const [roster, curriculum, documents] = await Promise.all([
        getClassRoster(session, classroom.id),
        getClassCurriculum(session, classroom.id),
        getClassDocuments(session, classroom.id),
      ]);
      return { students: roster.length, curriculum: curriculum.length, documents: documents.length };
    },
  });
  const counts = countsQuery.data;
  const gradebookQuery = useQuery({
    queryKey: ["class-gradebook", session.accessToken, classroom.id],
    queryFn: () => getGradebook(session, classroom.id),
    enabled: tab === "gradebook",
  });

  return (
    <section className="border border-outline-variant rounded-lg bg-surface-container-lowest p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-primary tracking-wide">CHI TIẾT LỚP</p>
          <h2 className="text-lg font-bold text-on-surface truncate">{classroom.name}</h2>
          <p className="text-xs text-on-surface-variant">
            Mã {classroom.code}
            {counts && ` · ${counts.students} học sinh · ${counts.curriculum} mục chương trình · ${counts.documents} tài liệu`}
          </p>
        </div>
        <button onClick={onClose} className="shrink-0 h-9 px-3 rounded-lg border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors">
          Đóng chi tiết
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-outline-variant overflow-x-auto thin-scrollbar">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`shrink-0 px-3 h-10 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === id ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "roster" && <ClassRosterPanel session={session} classId={classroom.id} />}
      {tab === "curriculum" && <ClassCurriculumPanel session={session} classId={classroom.id} />}
      {tab === "sessions" && <ClassSessionPanel session={session} classId={classroom.id} />}
      {tab === "documents" && <ClassDocumentPanel session={session} classId={classroom.id} />}
      {tab === "tasks" && <ClassTaskPanel session={session} classId={classroom.id} />}
      {tab === "grading" && <ClassGradingPanel session={session} classId={classroom.id} />}
      {tab === "gradebook" && <>
        <ClassProgressPanel session={session} classId={classroom.id} onViewLog={id => { setLogStudent(id); setTab("log"); }} />
        <GradebookMatrix
          classes={[classroom]}
          rows={gradebookQuery.data ?? []}
          selectedStudent={matrixStudent}
          onSelectStudent={setMatrixStudent}
          onSelectClass={async () => {}}
        />
      </>}
      {tab === "log" && <ClassSubmissionLogPanel session={session} classId={classroom.id} studentId={logStudent} onStudentChange={setLogStudent} />}
    </section>
  );
}
