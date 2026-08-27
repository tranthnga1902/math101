import type { AuthSession, StudentAssignment, StudentCourse } from "../api";

const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export function formatVietnameseDate(date: Date): string {
  const weekday = WEEKDAYS[date.getDay()];
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${weekday} ${day}/${month}`;
}

export function buildGreeting(session: AuthSession, fallbackName = "em"): string {
  const displayName = session.email.split("@")[0] ?? fallbackName;
  return `Chào ${displayName} — ${formatVietnameseDate(new Date())}`;
}

export function avatarInitials(session: AuthSession): string {
  const source = session.email.split("@")[0] ?? "?";
  const letters = source.replace(/[^a-zA-ZÀ-ỹ]/g, "");
  if (!letters) return source.slice(0, 2).toUpperCase();
  return letters.slice(0, 2).toUpperCase();
}

export function dueDateLabel(value: string | null): { text: string; urgent: boolean } {
  if (!value) return { text: "Không giới hạn", urgent: false };
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return { text: "Không giới hạn", urgent: false };
  const diffMs = due.getTime() - Date.now();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  if (diffHours <= 0) return { text: "Quá hạn", urgent: true };
  if (diffHours < 24) return { text: `Còn ${diffHours} giờ`, urgent: true };
  const days = Math.ceil(diffHours / 24);
  return { text: `Hạn ${due.toLocaleDateString("vi-VN")} (${days} ngày)`, urgent: false };
}

export type FlatLesson = {
  course: StudentCourse;
  chapter: StudentCourse["chapters"][number];
  lesson: StudentCourse["chapters"][number]["lessons"][number];
};

export function flattenLessons(courses: StudentCourse[]): FlatLesson[] {
  return courses.flatMap((course) =>
    course.chapters.flatMap((chapter) =>
      chapter.lessons.map((lesson) => ({ course, chapter, lesson })),
    ),
  );
}

export function assignmentKind(item: StudentAssignment): "worksheet" | "lesson" {
  return item.worksheetId ? "worksheet" : "lesson";
}

/**
 * Học sinh mở được bài này không, nộp được không, và vì sao không.
 *
 * Đây là bản chiếu của luật server (`AssignmentWindow`) để màn hình không mời học sinh bấm vào
 * thứ chắc chắn bị từ chối. Server vẫn là nơi chặn thật — sửa ở đây không mở được cửa nào.
 */
export function assignmentGate(item: StudentAssignment): {
  label: string; urgent: boolean; canView: boolean; canSubmit: boolean; note: string;
} {
  const state = item.state ?? "OPEN";
  const returned = item.gradingStatus === "RETURNED";
  const outOfAttempts = item.attemptsLeft !== null && item.attemptsLeft <= 0;
  const canView = state === "OPEN" || state === "LATE_OPEN" || state === "CLOSED";
  const canSubmit = (state === "OPEN" || state === "LATE_OPEN") && !returned && !outOfAttempts;

  if (state === "SCHEDULED") {
    const openAt = item.openAt ? new Date(item.openAt).toLocaleString("vi-VN") : "";
    return { label: openAt ? `Mở lúc ${openAt}` : "Chưa tới giờ mở", urgent: false, canView, canSubmit, note: "Chưa tới giờ mở bài" };
  }
  if (state === "CLOSED") {
    return { label: "Đã đóng", urgent: false, canView, canSubmit, note: item.dueAt ? "Đã quá hạn nộp" : "Bài đã đóng" };
  }

  const due = dueDateLabel(item.dueAt);
  const label = state === "LATE_OPEN" ? "Quá hạn — còn nhận muộn" : due.text;
  const note = returned ? "Đã trả điểm"
    : outOfAttempts ? "Đã hết lượt nộp"
    : item.attemptsLeft === null ? "Nộp lại thoải mái"
    : `Còn ${item.attemptsLeft} lượt nộp`;
  return { label, urgent: state === "LATE_OPEN" || due.urgent, canView, canSubmit, note };
}

export function formatPercent(value: number): string {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}