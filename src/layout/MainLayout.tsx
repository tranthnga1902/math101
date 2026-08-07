import { useEffect, useState, type ReactNode } from "react";
import type { AuthSession } from "../api";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import "../teacher/teacher-theme.css";

type MainLayoutProps = {
  session: AuthSession;
  children: ReactNode | ((activeSection: string) => ReactNode);
  onChangePassword: () => void;
  onLogout: () => void;
};

const sectionTargets: Record<string, string> = {
  "course-create": "teacher-content",
  "problem-create": "teacher-content",
  "teacher-courses": "teacher-content",
  "teacher-problems": "teacher-content",
  "teacher-textbooks": "teacher-content",
  "teacher-gradebook": "teacher-classes",
};

const mainSections = new Set([
  "teacher-overview",
  "teacher-content",
  "teacher-courses",
  "teacher-problems",
  "teacher-worksheets",
  "teacher-textbooks",
  "teacher-classes",
  "teacher-gradebook",
  "teacher-grading",
  "teacher-reports",
  "teacher-tasks",
  "teacher-notifications",
  "teacher-students",
  "teacher-settings",
]);

export function MainLayout({ session, children, onChangePassword, onLogout }: MainLayoutProps) {
  const [active, setActive] = useState("teacher-overview");
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const navigate = (target: string) => {
    const nextSection = sectionTargets[target] ?? target;
    setActive(nextSection);
    setPendingTarget(mainSections.has(target) ? null : target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (!pendingTarget) return;
    window.requestAnimationFrame(() => {
      document.getElementById(pendingTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingTarget(null);
    });
  }, [active, pendingTarget]);

  useEffect(() => {
    const listener = (event: Event) => navigate((event as CustomEvent<string>).detail);
    window.addEventListener("math10:navigate", listener);
    return () => window.removeEventListener("math10:navigate", listener);
  });

  return (
    <div className="teacher-app teacher-shell">
      <Sidebar active={active} onNavigate={navigate} />
      <div className="teacher-main">
        <Topbar session={session} active={active} onNavigate={navigate} onChangePassword={onChangePassword} onLogout={onLogout} />
        {typeof children === "function" ? children(active) : children}
      </div>
    </div>
  );
}
