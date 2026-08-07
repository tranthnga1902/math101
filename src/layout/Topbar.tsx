import { useMemo, useState } from "react";
import { ChevronDown, KeyRound, LogOut, Plus, Search } from "lucide-react";
import type { AuthSession } from "../api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

type TopbarProps = {
  session: AuthSession;
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

export function Topbar({ session, onNavigate, onChangePassword, onLogout }: TopbarProps) {
  const [query, setQuery] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
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
    <header className="teacher-topbar">
      <div className="global-search">
        <Search aria-hidden="true" size={17} />
        <Input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Tìm mã bài, khóa học, học sinh..."
          aria-label="Tìm kiếm toàn cục"
        />
        {query && (
          <div className="search-suggestions">
            {suggestions.map(item => <button key={item.id} onClick={() => pick(item.id)}>{item.label}</button>)}
            {!suggestions.length && <small>Không tìm thấy trong dữ liệu đang hiển thị.</small>}
          </div>
        )}
      </div>
      <div className="teacher-top-actions">
        <div className="top-menu">
          <Button className="quick-create" onClick={() => setQuickOpen(value => !value)}>
            <Plus size={16} aria-hidden="true" /> Tạo nhanh
          </Button>
          {quickOpen && <div className="top-dropdown">{quickTargets.map(item => <button key={item.target} onClick={() => { pick(item.target); setQuickOpen(false); }}>{item.label}</button>)}</div>}
        </div>
        <div className="top-menu">
          <button className="profile-trigger" onClick={() => setProfileOpen(value => !value)}>
            <span>{(session.email[0] || "G").toUpperCase()}</span>
            <b>{session.email}</b>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          {profileOpen && <div className="top-dropdown profile-dropdown"><button onClick={onChangePassword}><KeyRound size={15} /> Đổi mật khẩu</button><button onClick={onLogout}><LogOut size={15} /> Đăng xuất</button></div>}
        </div>
      </div>
    </header>
  );
}
