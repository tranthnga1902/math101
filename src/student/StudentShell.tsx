import type { ReactNode } from "react";
import type { AuthSession } from "../api";

export type StudentTab = "today" | "classes" | "lessons" | "videos" | "textbooks" | "materials" | "topics" | "assignments" | "profile";

type StudentShellProps = {
  session: AuthSession;
  tab: StudentTab;
  onTabChange: (tab: StudentTab) => void;
  onLogout: () => void;
  onChangePassword: () => void;
  greeting: string;
  avatarLabel: string;
  children: ReactNode;
};

const tabs: Array<{ key: StudentTab; label: string; icon: string }> = [
  { key: "today", label: "Hôm nay", icon: "today" },
  { key: "classes", label: "Lớp của em", icon: "school" },
  { key: "lessons", label: "Bài học", icon: "menu_book" },
  { key: "videos", label: "Video", icon: "smart_display" },
  { key: "textbooks", label: "Sách GK", icon: "auto_stories" },
  { key: "materials", label: "Tài liệu", icon: "description" },
  { key: "topics", label: "Chuyên đề", icon: "folder_special" },
  { key: "assignments", label: "Bài tập", icon: "assignment" },
  { key: "profile", label: "Cá nhân", icon: "person" },
];

export function StudentShell({
  session,
  tab,
  onTabChange,
  onLogout,
  onChangePassword,
  greeting,
  avatarLabel,
  children,
}: StudentShellProps) {
  const activeTab = tabs.find((item) => item.key === tab);

  return (
    <div className="min-h-screen bg-surface text-on-surface flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-outline-variant bg-surface-bright sticky top-0 h-screen">
        <div className="px-5 py-6 border-b border-outline-variant">
          <span className="text-lg font-bold text-primary">MATH10</span>
          <p className="text-xs text-on-surface-variant mt-1">Toán 10 · Học sinh</p>
        </div>

        <nav aria-label="Điều hướng học sinh" className="flex-1 px-3 py-4 space-y-1">
          {tabs.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                className={`w-full flex items-center gap-3 px-4 h-11 rounded-full text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary-container text-on-primary-container"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                <span className={`material-symbols-outlined text-[20px] ${active ? "fill" : ""}`}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-outline-variant space-y-1">
          <button
            type="button"
            onClick={onChangePassword}
            className="w-full flex items-center gap-3 px-4 h-11 rounded-full text-sm font-medium text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">lock_reset</span>
            Đổi mật khẩu
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 h-11 rounded-full text-sm font-medium text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            Đăng xuất
          </button>
        </div>

        <div className="px-4 py-4 border-t border-outline-variant flex items-center gap-3">
          <div
            aria-label={avatarLabel}
            className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-sm font-semibold"
          >
            {avatarLabel}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{session.email.split("@")[0]}</p>
            <p className="text-xs text-on-surface-variant truncate">{session.email}</p>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="md:hidden bg-surface-container-lowest border-b border-outline-variant sticky top-0 z-30 flex items-center justify-between h-14 px-4">
          <span className="text-lg font-bold text-primary">MATH10</span>
          <div
            aria-label={avatarLabel}
            className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-sm font-semibold"
          >
            {avatarLabel}
          </div>
        </header>

        <main className="px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-10 space-y-6 max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{greeting}</h1>
              {activeTab && (
                <p className="text-sm text-on-surface-variant mt-1 inline-flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary">{activeTab.icon}</span>
                  {activeTab.label}
                </p>
              )}
            </div>
          </div>
          {children}
        </main>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-container-lowest border-t border-outline-variant">
        <div className="flex overflow-x-auto thin-scrollbar">
          {tabs.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                className={`shrink-0 flex-1 min-w-[4.25rem] flex flex-col items-center gap-1 py-2 text-[11px] font-medium whitespace-nowrap ${
                  active ? "text-primary" : "text-on-surface-variant"
                }`}
              >
                <span className={`material-symbols-outlined text-[22px] ${active ? "fill" : ""}`}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
