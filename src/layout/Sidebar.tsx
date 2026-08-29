import {
  Bell,
  BookOpen,
  Calculator,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Home,
  Settings,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

type SidebarProps = {
  active: string;
  onNavigate: (target: string) => void;
};

type NavItem = { id: string; icon: LucideIcon; label: string };

const MAIN_NAV: NavItem[] = [
  { id: "teacher-overview", icon: Home, label: "Trang chủ" },
  { id: "teacher-content", icon: BookOpen, label: "Nội dung học" },
  { id: "teacher-documents", icon: FileText, label: "Tài liệu của tôi" },
  { id: "teacher-pipeline", icon: Calculator, label: "Tạo phiếu từ file" },
  { id: "teacher-worksheets", icon: FileText, label: "Phiếu và đề" },
  { id: "teacher-tasks", icon: ClipboardList, label: "Nhiệm vụ" },
  { id: "teacher-grading", icon: ClipboardCheck, label: "Chấm bài" },
  { id: "teacher-classes", icon: Users, label: "Lớp học" },
  { id: "teacher-reports", icon: TrendingUp, label: "Báo cáo" },
  { id: "teacher-notifications", icon: Bell, label: "Thông báo" },
];

const SETTINGS_ITEM: NavItem = { id: "teacher-settings", icon: Settings, label: "Cài đặt" };

export const TEACHER_NAV: NavItem[] = [...MAIN_NAV, SETTINGS_ITEM];

function NavButton({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={`w-full flex items-center gap-3 px-4 h-11 rounded-lg text-sm transition-colors ${
        isActive
          ? "font-bold text-primary bg-primary-subtle"
          : "font-normal text-muted hover:bg-header hover:text-base"
      }`}
    >
      <Icon size={20} aria-hidden="true" />
      {item.label}
    </button>
  );
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-base bg-surface sticky top-0 h-screen">
      <div className="px-5 py-4 flex items-center gap-3 min-h-14 border-b border-base">
        <div className="w-10 h-10 rounded-lg bg-primary text-white flex items-center justify-center shrink-0">
          <Calculator size={22} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-base leading-tight truncate">MathQR</p>
          <p className="text-xs text-muted truncate">Không gian giáo viên</p>
        </div>
      </div>
      <nav aria-label="Điều hướng giáo viên" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto thin-scrollbar">
        {MAIN_NAV.map(item => (
          <NavButton key={item.id} item={item} isActive={active === item.id} onClick={() => onNavigate(item.id)} />
        ))}
      </nav>
      <div className="px-3 pb-5 pt-2 border-t border-base">
        <NavButton item={SETTINGS_ITEM} isActive={active === SETTINGS_ITEM.id} onClick={() => onNavigate(SETTINGS_ITEM.id)} />
      </div>
    </aside>
  );
}
