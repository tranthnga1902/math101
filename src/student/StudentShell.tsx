import { useState, type ReactNode } from "react";
import type { AuthSession } from "../api";

export type StudentTab = "today" | "classes" | "lessons" | "videos" | "textbooks" | "materials" | "exercises" | "assignments" | "profile" | "settings" | "fees";

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

const navSections: Array<{ label?: string; items: Array<{ key: StudentTab; label: string; icon: string }> }> = [
  { items: [{ key: "today", label: "Trang chủ", icon: "home" }] },
  { label: "Chương trình học", items: [
    { key: "lessons", label: "Tổng quan", icon: "account_tree" },
    { key: "videos", label: "Video", icon: "smart_display" },
    { key: "textbooks", label: "Sách giáo khoa", icon: "auto_stories" },
    { key: "materials", label: "Tài liệu", icon: "description" },
    { key: "exercises", label: "Bài tập chương trình", icon: "edit_note" },
  ] },
  { label: "Phiếu bài tập", items: [
    { key: "assignments", label: "Được giao & đã làm", icon: "assignment" },
  ] },
  { label: "Cá nhân", items: [
    { key: "classes", label: "Lớp của em", icon: "school" },
    { key: "fees", label: "Học phí", icon: "payments" },
    { key: "profile", label: "Kết quả học tập", icon: "monitoring" },
    { key: "settings", label: "Cài đặt", icon: "settings" },
  ] },
];
const tabs = navSections.flatMap((section) => section.items);

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeTab = tabs.find((item) => item.key === tab);
  const primaryMobileTabs = tabs.filter((item) => ["today", "lessons", "assignments", "profile"].includes(item.key));

  const changeTab = (nextTab: StudentTab) => {
    setMobileMenuOpen(false);
    onTabChange(nextTab);
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex">
      <aside className="hidden md:flex w-68 shrink-0 flex-col border-r border-outline-variant bg-surface-bright sticky top-0 h-screen">
        <div className="px-5 py-6 border-b border-outline-variant">
          <span className="text-lg font-bold text-primary">MATH10</span>
          <p className="text-xs text-on-surface-variant mt-1">Toán 10 · Học sinh</p>
        </div>

        <nav aria-label="Điều hướng học sinh" className="flex-1 px-3 py-4 space-y-5 overflow-y-auto thin-scrollbar">
          {navSections.map((section, index) => (
            <section key={section.label ?? `primary-${index}`} className="space-y-1">
              {section.label && <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">{section.label}</p>}
              {section.items.map((item) => {
                const active = tab === item.key;
                return (
                    <button key={item.key} type="button" onClick={() => changeTab(item.key)}
                    className={`w-full flex items-center gap-3 px-4 h-10 rounded-lg text-sm font-medium transition-colors ${active ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"}`}>
                    <span className={`material-symbols-outlined text-[20px] ${active ? "fill" : ""}`}>{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
            </section>
          ))}
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

        <main className="w-full px-4 sm:px-6 md:px-8 py-6 md:py-8 pb-24 md:pb-10 space-y-6">
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

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/35" onClick={() => setMobileMenuOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Tất cả mục học tập"
            className="absolute bottom-[4.25rem] left-3 right-3 rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-xl p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">Tất cả mục học tập</h2>
              <button type="button" aria-label="Đóng" onClick={() => setMobileMenuOpen(false)} className="w-9 h-9 rounded-full hover:bg-surface-container">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {tabs.filter((item) => !primaryMobileTabs.some((primary) => primary.key === item.key)).map((item) => (
                <button key={item.key} type="button" onClick={() => changeTab(item.key)}
                  className={`min-h-14 rounded-xl px-3 py-2 flex items-center gap-3 text-left text-sm font-medium ${tab === item.key ? "bg-primary-container text-on-primary-container" : "bg-surface-container-low text-on-surface"}`}>
                  <span className="material-symbols-outlined text-[21px]">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-container-lowest border-t border-outline-variant pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {primaryMobileTabs.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => changeTab(item.key)}
                className={`min-w-0 flex flex-col items-center gap-1 py-2 text-[11px] font-medium whitespace-nowrap ${
                  active ? "text-primary" : "text-on-surface-variant"
                }`}
              >
                <span className={`material-symbols-outlined text-[22px] ${active ? "fill" : ""}`}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
          <button type="button" onClick={() => setMobileMenuOpen((open) => !open)}
            className={`min-w-0 flex flex-col items-center gap-1 py-2 text-[11px] font-medium ${mobileMenuOpen || !primaryMobileTabs.some((item) => item.key === tab) ? "text-primary" : "text-on-surface-variant"}`}>
            <span className="material-symbols-outlined text-[22px]">apps</span>
            <span>Thêm</span>
          </button>
        </div>
      </div>
    </div>
  );
}
