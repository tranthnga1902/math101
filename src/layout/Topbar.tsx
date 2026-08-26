import { ChevronDown, KeyRound, LogOut, Plus, Search } from "lucide-react";
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
  { label: "Soạn câu hỏi", target: "problem-create" },
  { label: "Tạo phiếu và đề", target: "teacher-worksheets" },
  { label: "Tạo nhiệm vụ", target: "teacher-tasks" },
  { label: "Quản lý lớp", target: "teacher-classes" },
];

export function Topbar({ session, active, onNavigate, onChangePassword, onLogout }: TopbarProps) {
  const [query, setQuery] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const pageTitle = TEACHER_NAV.find(item => item.id === active)?.label ?? "Không gian giáo viên";

  const suggestions = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("vi");
    if (!term) return [];
    return Array.from(document.querySelectorAll<HTMLElement>("[data-search]"))
      .filter(node => (node.dataset.search || node.textContent || "").toLocaleLowerCase("vi").includes(term))
      .slice(0, 6)
      .map(node => ({ id: node.id, label: node.dataset.search || node.textContent?.trim() || "Kết quả" }));
  }, [query]);

  const pick = (target: string) => {
    onNavigate(target);
    setQuery("");
  };

  return (
    <header className="sticky top-0 z-30 h-14 bg-surface border-b border-base flex items-center justify-between gap-4 px-6">
      <h1 className="text-xl font-bold text-base truncate">{pageTitle}</h1>
      <div className="flex items-center gap-3">
        <div className="relative w-80">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm mã bài, lớp hoặc học sinh..." aria-label="Tìm kiếm toàn cục" className="w-full h-9 pl-9 pr-3 rounded-lg bg-header border border-base text-sm text-base placeholder:text-muted outline-none focus:ring-2 focus:ring-primary" />
          {query && <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-surface border border-base rounded-lg p-1.5 shadow-lg z-50">
            {suggestions.map(item => <button key={item.id} onClick={() => pick(item.id)} className="block w-full text-left px-3 py-2 rounded-md text-sm hover:bg-header">{item.label}</button>)}
            {!suggestions.length && <p className="px-3 py-2 text-xs text-muted">Không tìm thấy trong dữ liệu đang hiển thị.</p>}
          </div>}
        </div>

        <div className="relative shrink-0">
          <button type="button" onClick={() => setQuickOpen(value => !value)} className="h-9 px-3 rounded-lg bg-primary text-white text-sm font-semibold flex items-center gap-1.5 hover:bg-primary-hover">
            <Plus size={18} aria-hidden="true" /> Tạo nhanh
          </button>
          {quickOpen && <div className="absolute top-[calc(100%+8px)] right-0 w-56 bg-surface border border-base rounded-lg p-1.5 shadow-lg z-50">
            {quickTargets.map(item => <button key={item.target} onClick={() => { pick(item.target); setQuickOpen(false); }} className="block w-full text-left px-3 py-2 rounded-md text-sm hover:bg-header">{item.label}</button>)}
          </div>}
        </div>

        <div className="relative shrink-0">
          <button type="button" onClick={() => setProfileOpen(value => !value)} aria-expanded={profileOpen} className="h-9 pl-1.5 pr-2.5 rounded-lg flex items-center gap-2 hover:bg-header">
            <span className="w-7 h-7 rounded-full bg-primary-subtle text-primary flex items-center justify-center text-xs font-bold shrink-0">{(session.email[0] || "G").toUpperCase()}</span>
            <span className="text-sm font-medium text-base max-w-40 truncate">{session.email}</span>
            <ChevronDown size={16} className="text-muted" aria-hidden="true" />
          </button>
          {profileOpen && <div className="absolute top-[calc(100%+8px)] right-0 w-52 bg-surface border border-base rounded-lg p-1.5 shadow-lg z-50">
            <button onClick={onChangePassword} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-header text-left"><KeyRound size={18} /> Đổi mật khẩu</button>
            <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-danger-subtle hover:text-danger text-left"><LogOut size={18} /> Đăng xuất</button>
          </div>}
        </div>
      </div>
    </header>
  );
}
