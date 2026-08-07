type SidebarProps = {
  active: string;
  onNavigate: (target: string) => void;
};

type NavItem = { id: string; icon: string; label: string };

const MAIN_NAV: NavItem[] = [
  { id: "teacher-overview", icon: "home", label: "Trang chủ" },
  { id: "teacher-content", icon: "menu_book", label: "Nội dung học" },
  { id: "teacher-tasks", icon: "assignment", label: "Nhiệm vụ" },
  { id: "teacher-worksheets", icon: "description", label: "Phiếu & Đề" },
  { id: "teacher-grading", icon: "edit_note", label: "Chấm bài" },
  { id: "teacher-classes", icon: "groups", label: "Lớp học" },
  { id: "teacher-reports", icon: "analytics", label: "Báo cáo" },
  { id: "teacher-notifications", icon: "notifications", label: "Thông báo" },
];

const SETTINGS_ITEM: NavItem = { id: "teacher-settings", icon: "settings", label: "Cài đặt" };

// Full 9-item nav (order matches Stitch mockup #1), exported so Topbar can
// resolve the current page's title from the same source of truth.
export const TEACHER_NAV: NavItem[] = [...MAIN_NAV, SETTINGS_ITEM];

function NavButton({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={`w-full flex items-center gap-3 px-4 h-11 rounded-lg text-sm transition-colors ${
        isActive
          ? "font-bold text-primary bg-surface-container-high"
          : "font-normal text-on-surface-variant hover:bg-surface-container-low"
      }`}
    >
      <span className={`material-symbols-outlined text-[20px] ${isActive ? "fill" : ""}`}>{item.icon}</span>
      {item.label}
    </button>
  );
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-outline-variant bg-surface sticky top-0 h-screen">
      <div className="px-5 py-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary text-on-primary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined fill text-[22px]">calculate</span>
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-primary leading-tight truncate">Toán Lớp 10</p>
          <p className="text-[11px] text-on-surface-variant truncate">Hệ thống quản lý học tập</p>
        </div>
      </div>
      <nav aria-label="Điều hướng giáo viên" className="flex-1 px-3 pb-4 space-y-1 overflow-y-auto thin-scrollbar">
        {MAIN_NAV.map(item => (
          <NavButton key={item.id} item={item} isActive={active === item.id} onClick={() => onNavigate(item.id)} />
        ))}
      </nav>
      <div className="px-3 pb-5 pt-2 border-t border-outline-variant">
        <NavButton item={SETTINGS_ITEM} isActive={active === SETTINGS_ITEM.id} onClick={() => onNavigate(SETTINGS_ITEM.id)} />
      </div>
    </aside>
  );
}
