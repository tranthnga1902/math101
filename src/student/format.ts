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

export function formatPercent(value: number): string {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}