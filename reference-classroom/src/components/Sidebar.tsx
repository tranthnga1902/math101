import React from 'react';
import { NavigationTab } from '../types';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isMobileOpen,
  onCloseMobile
}) => {
  const navItems: { id: NavigationTab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Tổng quan', icon: 'dashboard' },
    { id: 'accounts', label: 'Tài khoản', icon: 'group' },
    { id: 'classes', label: 'Lớp học', icon: 'school' },
    { id: 'textbooks', label: 'SGK', icon: 'menu_book' },
    { id: 'documents', label: 'Tài liệu', icon: 'description' },
    { id: 'topics', label: 'Chuyên đề', icon: 'subject' },
    { id: 'logs', label: 'Nhật ký', icon: 'history' },
  ];

  const sidebarContent = (
    <nav className="bg-[#f2f3ff] border-r border-[#c3c6d7] h-full w-[240px] flex flex-col py-4 px-3 gap-2 shrink-0 select-none">
      <div className="px-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#2563eb] flex items-center justify-center text-[#eeefff] font-semibold text-lg shadow-sm">
            V
          </div>
          <div className="overflow-hidden">
            <h1 className="font-semibold text-base text-[#004ac6] truncate leading-tight">
              Quản trị Học vụ
            </h1>
            <p className="text-xs text-[#434655] truncate">Hệ thống THPT</p>
          </div>
        </div>
      </div>

      <ul className="flex flex-col gap-1 flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 h-10 rounded-lg text-sm transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-[#2563eb] text-[#eeefff] font-semibold shadow-sm'
                    : 'text-[#434655] hover:bg-[#e2e7ff] active:scale-95'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  data-weight={isActive ? 'fill' : undefined}
                >
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto pt-4 border-t border-[#c3c6d7]">
        <button
          type="button"
          onClick={() => {
            onSelectTab('settings');
            onCloseMobile();
          }}
          className={`w-full flex items-center gap-3 px-3 h-10 rounded-lg text-sm transition-all duration-150 cursor-pointer ${
            currentTab === 'settings'
              ? 'bg-[#2563eb] text-[#eeefff] font-semibold'
              : 'text-[#434655] hover:bg-[#e2e7ff] active:scale-95'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
          <span className="truncate">Cài đặt</span>
        </button>
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <div className="hidden xl:block fixed left-0 top-0 h-full z-40">
        {sidebarContent}
      </div>

      {/* Mobile drawer overlay */}
      {isMobileOpen && (
        <div className="xl:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
