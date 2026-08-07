import { useMemo, useState } from "react";
import type { AuthSession } from "../api";
import { TEACHER_NAV } from "./Sidebar";

type TopbarProps = {
  session: AuthSession;
  active: string;
  onNavigate: (target: string) => void;
  onChangePassword: () => void;
  onLogout: () => void;
};

const quickTargets = [
  { label: "Tạo bài toán", target: "problem-create" },
  { label: "Tạo phiếu bài tập", target: "teacher-problems" },
  { label: "Quản lý nội dung học", target: "teacher-content" },
  { label: "Quản lý lớp", target: "teacher-classes" },
];

export function Topbar({ session, active, onNavigate, onChangePassword, onLogout }: TopbarProps) {
  const [query, setQuery] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const pageTitle = TEACHER_NAV.find(item => item.id === active)?.label ?? "Bảng điều khiển giáo viên";

  const suggestions = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("vi");
    if (!term) return [];
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-search]"));
    return nodes
      .filter(node => (node.dataset.search || node.textContent || "").toLocaleLowerCase("vi").includes(term))
      .slice(0, 6)
      .map(node => ({ id: node.id, label: node.dataset.search || node.textContent?.trim() || "Kết quả" }));
  }, [query]);

  const pick = (target: string) => {
    onNavigate(target);
    setQuery("");
  };

  return (
    <header className="sticky top-0 z-30 h-14 bg-surface-container-lowest border-b border-outline-variant flex items-center justify-between gap-4 px-6">
      <h1 className="text-xl font-bold text-on-surface truncate">{pageTitle}</h1>
      <div className="flex items-center gap-3">
        <div className="relative w-64 lg:w-80">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
            search
          </span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Tìm mã bài, khóa học, học sinh..."
            aria-label="Tìm kiếm toàn cục"
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface-container-low border-none text-sm text-on-surface placeholder:text-on-surface-variant outline-none focus:ring-2 focus:ring-primary"
          />
          {query && (
            <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-surface-container-lowest border border-outline-variant rounded-lg p-1.5 shadow-lg z-50">
              {suggestions.map(item => (
                <button
                  key={item.id}
                  onClick={() => pick(item.id)}
                  className="block w-full text-left px-3 py-2 rounded-md text-sm hover:bg-surface-container-low"
                >
                  {item.label}
                </button>
              ))}
              {!suggestions.length && (
                <p className="px-3 py-2 text-xs text-on-surface-variant">Không tìm thấy trong dữ liệu đang hiển thị.</p>
              )}
            </div>
          )}
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setQuickOpen(value => !value)}
            className="h-9 px-3 rounded-lg bg-primary text-on-primary text-sm font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Tạo nhanh
          </button>
          {quickOpen && (
            <div className="absolute top-[calc(100%+8px)] right-0 w-56 bg-surface-container-lowest border border-outline-variant rounded-lg p-1.5 shadow-lg z-50">
              {quickTargets.map(item => (
                <button
                  key={item.target}
                  onClick={() => { pick(item.target); setQuickOpen(false); }}
                  className="block w-full text-left px-3 py-2 rounded-md text-sm hover:bg-surface-container-low"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setProfileOpen(value => !value)}
            className="h-9 pl-1.5 pr-2.5 rounded-lg flex items-center gap-2 hover:bg-surface-container-low transition-colors"
          >
            <span className="w-7 h-7 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-xs font-bold shrink-0">
              {(session.email[0] || "G").toUpperCase()}
            </span>
            <span className="text-sm font-medium text-on-surface max-w-[160px] truncate hidden lg:inline">
              {session.email}
            </span>
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">expand_more</span>
          </button>
          {profileOpen && (
            <div className="absolute top-[calc(100%+8px)] right-0 w-52 bg-surface-container-lowest border border-outline-variant rounded-lg p-1.5 shadow-lg z-50">
              <button
                onClick={onChangePassword}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-surface-container-low text-left"
              >
                <span className="material-symbols-outlined text-[18px]">key</span> Đổi mật khẩu
              </button>
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-error-container hover:text-on-error-container text-left"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span> Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
