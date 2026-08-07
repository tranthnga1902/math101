import { useState } from "react";
import {
  Bell,
  BarChart3,
  ChevronLeft,
  CheckSquare,
  ClipboardCheck,
  FileText,
  Home,
  LibraryBig,
  Settings,
  BookOpenCheck,
} from "lucide-react";

type SidebarProps = {
  active: string;
  onNavigate: (target: string) => void;
};

const groups = [
  { label: "TỔNG QUAN", items: [{ id: "teacher-overview", icon: Home, label: "Dashboard" }] },
  { label: "NỘI DUNG HỌC", items: [
    { id: "teacher-content", icon: BookOpenCheck, label: "Nội dung học" },
    { id: "teacher-worksheets", icon: FileText, label: "Phiếu bài tập" },
  ]},
  { label: "LỚP HỌC", items: [
    { id: "teacher-classes", icon: LibraryBig, label: "Danh sách lớp" },
    { id: "teacher-grading", icon: ClipboardCheck, label: "Chấm bài" },
    { id: "teacher-reports", icon: BarChart3, label: "Báo cáo" },
  ]},
  { label: "HỆ THỐNG", items: [
    { id: "teacher-tasks", icon: CheckSquare, label: "Nhiệm vụ" },
    { id: "teacher-notifications", icon: Bell, label: "Thông báo" },
    { id: "teacher-settings", icon: Settings, label: "Cài đặt" },
  ]},
];

export function Sidebar({ active, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`teacher-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-brand">
        <span className="brand-mark">M10</span>
        <span className="sidebar-brand-copy"><b>MATH10</b><small>TEACHER</small></span>
        <button aria-label="Thu gọn menu" onClick={() => setCollapsed(value => !value)}><ChevronLeft size={17} /></button>
      </div>
      <nav aria-label="Điều hướng giáo viên">
        {groups.map(group => <section key={group.label}>
            <small>{group.label}</small>
            {group.items.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={active === item.id ? "active" : ""}
                  title={item.label}
                  onClick={() => onNavigate(item.id)}
                >
                  <span aria-hidden="true"><Icon size={17} /></span>
                  <b>{item.label}</b>
                </button>
              );
            })}
        </section>)}
      </nav>
    </aside>
  );
}
