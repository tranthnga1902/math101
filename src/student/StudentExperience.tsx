import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  changePassword,
  getMyAssignments,
  getMyCourses,
  getStudentProgress,
  getTextbooks,
  openTextbookInBrowser,
  type AuthSession,
} from "../api";
import { StudentShell, type StudentTab } from "./StudentShell";
import { TodayPage } from "./TodayPage";
import { LessonsPage } from "./LessonsPage";
import { LessonDetailPage } from "./LessonDetailPage";
import { AssignmentsPage } from "./AssignmentsPage";
import { WorksheetRunner } from "./WorksheetRunner";
import { avatarInitials, buildGreeting, formatPercent } from "./format";

type StudentExperienceProps = {
  session: AuthSession;
  onLogout: () => void;
};

type Route =
  | { kind: "tab"; tab: StudentTab }
  | { kind: "lesson"; lessonId: number }
  | { kind: "worksheet"; assignmentId: number };

function ChangePasswordDialog({
  session,
  onClose,
}: {
  session: AuthSession;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await changePassword(session, current, next, confirm);
      setMessage("Đổi mật khẩu thành công.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (reason) {
      setMessage((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <form onSubmit={submit} className="bg-surface-container-lowest border border-outline-variant rounded-xl w-full max-w-md p-6 space-y-4">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Đổi mật khẩu</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="w-8 h-8 rounded-full hover:bg-surface-container">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <label className="block text-sm">Mật khẩu hiện tại
          <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-1 w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface" />
        </label>
        <label className="block text-sm">Mật khẩu mới
          <input type="password" required value={next} onChange={(e) => setNext(e.target.value)} className="mt-1 w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface" />
        </label>
        <label className="block text-sm">Nhập lại
          <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface" />
        </label>
        {message && <div className="text-sm text-on-surface">{message}</div>}
        <footer className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg border border-outline-variant text-sm">Huỷ</button>
          <button type="submit" disabled={busy} className="h-10 px-4 rounded-lg bg-primary text-on-primary text-sm font-medium disabled:opacity-50">
            {busy ? "Đang lưu…" : "Lưu"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function ProfileTab({
  session,
  onChangePassword,
  onLogout,
}: {
  session: AuthSession;
  onChangePassword: () => void;
  onLogout: () => void;
}) {
  const courses = useQuery({
    queryKey: ["student-courses", session.userId],
    queryFn: () => getMyCourses(session),
  });
  const progress = useQuery({
    queryKey: ["student-progress", session.userId],
    queryFn: () => getStudentProgress(session),
  });
  const assignments = useQuery({
    queryKey: ["student-assignments", session.userId],
    queryFn: () => getMyAssignments(session),
  });

  const flatLessons = useMemo(() => courses.data?.flatMap((course) => course.chapters.flatMap((chapter) => chapter.lessons)) ?? [], [courses.data]);
  const completedLessons = flatLessons.filter((lesson) => (progress.data ?? []).find((item) => item.lessonId === lesson.id)?.completedAt || lesson.completionPercent >= 100).length;
  const completedAssignments = (assignments.data ?? []).filter((item) => item.progressStatus === "COMPLETED").length;
  const totalLessons = flatLessons.length;
  const percent = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <section className="md:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">Tiến độ của em</h2>
        <div className="grid grid-cols-3 gap-3">
          <article className="bg-surface-container-low rounded-xl p-4">
            <small className="text-xs text-on-surface-variant">Bài đã hoàn thành</small>
            <b className="block text-2xl mt-1">{completedLessons}/{totalLessons}</b>
          </article>
          <article className="bg-surface-container-low rounded-xl p-4">
            <small className="text-xs text-on-surface-variant">Phiếu đã nộp</small>
            <b className="block text-2xl mt-1">{completedAssignments}</b>
          </article>
          <article className="bg-surface-container-low rounded-xl p-4">
            <small className="text-xs text-on-surface-variant">Tỉ lệ hoàn thành</small>
            <b className="block text-2xl mt-1">{formatPercent(percent)}</b>
          </article>
        </div>
        <div>
          <div className="h-1 rounded-full bg-surface-container-highest overflow-hidden">
            <div className="h-full bg-primary" style={{ width: formatPercent(percent) }} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onChangePassword} className="h-10 px-4 rounded-lg border border-outline-variant text-sm font-medium">Đổi mật khẩu</button>
          <button type="button" onClick={onLogout} className="h-10 px-4 rounded-lg border border-outline-variant text-error text-sm font-medium hover:bg-error-container hover:border-error">Đăng xuất</button>
        </div>
      </section>
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 space-y-3">
        <h3 className="text-base font-semibold">Thông tin tài khoản</h3>
        <dl className="text-sm space-y-2">
          <div className="flex justify-between"><dt className="text-on-surface-variant">Email</dt><dd>{session.email}</dd></div>
          <div className="flex justify-between"><dt className="text-on-surface-variant">Vai trò</dt><dd>Học sinh</dd></div>
          <div className="flex justify-between"><dt className="text-on-surface-variant">Mã tài khoản</dt><dd>#{session.userId}</dd></div>
        </dl>
      </section>
    </div>
  );
}

function TextbooksTab({ session }: { session: AuthSession }) {
  const query = useQuery({
    queryKey: ["student-textbooks"],
    queryFn: () => getTextbooks(session),
  });
  const [error, setError] = useState("");
  const openBook = async (id: number) => {
    try {
      await openTextbookInBrowser(session, id);
    } catch (reason) {
      setError((reason as Error).message);
    }
  };

  if (query.error) {
    return (
      <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm">
        {(query.error as Error).message}
      </div>
    );
  }
  const books = query.data ?? [];
  if (!books.length) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 text-center text-sm text-on-surface-variant">
        Thư viện SGK chưa có sách phù hợp với khối của em.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <div className="bg-error-container text-on-error-container px-4 py-2 rounded-lg text-sm">{error}</div>}
      <h2 className="text-lg font-semibold">Sách giáo khoa</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {books.map((book) => (
          <article key={book.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 space-y-3">
            <div className="aspect-[3/4] bg-surface-container rounded-lg overflow-hidden">
              {book.thumbnailUrl ? (
                <img src={book.thumbnailUrl} alt={book.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl">auto_stories</span>
                </div>
              )}
            </div>
            <h3 className="text-base font-semibold">{book.title}</h3>
            <p className="text-xs text-on-surface-variant">
              {book.docType === "SGK" ? "Sách giáo khoa" : book.docType === "SBT" ? "Sách bài tập" : book.docType}
              {book.totalPages ? ` · ${book.totalPages} trang` : ""}
            </p>
            <button
              type="button"
              onClick={() => void openBook(book.id)}
              className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary text-on-primary text-sm font-medium"
            >
              Đọc sách
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

export function StudentExperience({ session, onLogout }: StudentExperienceProps) {
  const [route, setRoute] = useState<Route>({ kind: "tab", tab: "today" });
  const [passwordOpen, setPasswordOpen] = useState(false);

  const tab: StudentTab = route.kind === "tab" ? route.tab : route.kind === "lesson" ? "lessons" : "assignments";

  const openLesson = (lessonId: number) => setRoute({ kind: "lesson", lessonId });
  const openWorksheet = (assignmentId: number) => setRoute({ kind: "worksheet", assignmentId });
  const goTab = (next: StudentTab) => setRoute({ kind: "tab", tab: next });

  return (
    <StudentShell
      session={session}
      tab={tab}
      onTabChange={goTab}
      onLogout={onLogout}
      onChangePassword={() => setPasswordOpen(true)}
      greeting={buildGreeting(session)}
      avatarLabel={avatarInitials(session)}
    >
      {route.kind === "lesson" ? (
        <LessonDetailPage session={session} lessonId={route.lessonId} onBack={() => goTab("lessons")} onOpenLesson={openLesson} />
      ) : route.kind === "worksheet" ? (
        <WorksheetRunner session={session} assignmentId={route.assignmentId} onBack={() => goTab("assignments")} />
      ) : route.tab === "today" ? (
        <TodayPage session={session} onOpenLesson={openLesson} onOpenWorksheet={openWorksheet} onSeeAllAssignments={() => goTab("assignments")} />
      ) : route.tab === "lessons" ? (
        <LessonsPage session={session} onOpenLesson={openLesson} />
      ) : route.tab === "assignments" ? (
        <AssignmentsPage session={session} onOpenLesson={openLesson} onOpenWorksheet={openWorksheet} />
      ) : route.tab === "textbooks" ? (
        <TextbooksTab session={session} />
      ) : (
        <ProfileTab session={session} onChangePassword={() => setPasswordOpen(true)} onLogout={onLogout} />
      )}
      {passwordOpen && <ChangePasswordDialog session={session} onClose={() => setPasswordOpen(false)} />}
    </StudentShell>
  );
}