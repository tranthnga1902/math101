import React from 'react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: 'dashboard' },
    { id: 'accounts', label: 'Tài khoản', icon: 'group' },
    { id: 'classes', label: 'Lớp học', icon: 'school' },
    { id: 'sgk', label: 'SGK', icon: 'menu_book' },
    { id: 'documents', label: 'Tài liệu', icon: 'description' },
    { id: 'topics', label: 'Chuyên đề', icon: 'topic' },
    { id: 'logs', label: 'Nhật ký', icon: 'history' },
  ];

  return (
    <nav className="bg-[#ffffff] dark:bg-[#283044] w-[240px] h-screen fixed left-0 top-0 border-r border-[#c3c6d7] dark:border-[#737686] flex flex-col py-6 z-50">
      {/* Admin Profile Header */}
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#2563eb] text-[#eeefff] flex items-center justify-center font-bold text-lg shadow-sm">
          A
        </div>
        <div>
          <div className="text-[20px] leading-[28px] font-bold text-[#004ac6] dark:text-[#b4c5ff]">
            Quản trị Viên
          </div>
          <div className="text-[#434655] text-sm font-normal">Toán lớp 10 - VN</div>
        </div>
      </div>

      {/* Nav Menu */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1 px-3">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left text-base transition-all duration-150 ${
                isActive
                  ? 'text-[#004ac6] dark:text-[#b4c5ff] font-semibold border-r-4 border-[#004ac6] bg-[#f2f3ff] dark:bg-[#dae2fd] opacity-90 shadow-xs'
                  : 'text-[#434655] dark:text-[#c3c6d7] font-normal hover:bg-[#f2f3ff] dark:hover:bg-[#dae2fd]'
              }`}
            >
              <span
                className={`material-symbols-outlined ${isActive ? 'fill' : ''}`}
                style={{ fontSize: '22px' }}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Settings Footer */}
      <div className="px-3 mt-auto">
        <button
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-base transition-colors ${
            activeTab === 'settings'
              ? 'text-[#004ac6] font-semibold bg-[#f2f3ff]'
              : 'text-[#434655] dark:text-[#c3c6d7] font-normal hover:bg-[#f2f3ff]'
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
            settings
          </span>
          <span>Cài đặt</span>
        </button>
      </div>
    </nav>
  );
};
