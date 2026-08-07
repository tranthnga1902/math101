import React, { useState } from 'react';

interface HeaderProps {
  onToggleMobileSidebar: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenNotifications: () => void;
  unreadCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileSidebar,
  searchQuery,
  onSearchChange,
  onOpenNotifications,
  unreadCount = 2
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  return (
    <>
      <header className="bg-[#faf8ff] border-b border-[#c3c6d7] h-[56px] flex justify-between items-center px-6 shrink-0 z-30 relative select-none">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className="xl:hidden p-2 -ml-2 text-[#131b2e] hover:bg-[#e2e7ff] rounded-full transition-colors cursor-pointer"
            title="Mở menu"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="text-xl text-[#004ac6] font-bold hidden md:block">
            Quản trị THPT
          </div>
          <div className="text-lg text-[#004ac6] font-bold md:hidden">
            QT THPT
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative hidden sm:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#434655] pointer-events-none text-[20px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm kiếm..."
              className="h-10 pl-10 pr-4 w-64 bg-[#f2f3ff] border border-[#c3c6d7] rounded-lg text-sm text-[#131b2e] placeholder-[#434655] focus:outline-none focus:ring-2 focus:ring-[#0053db] focus:border-transparent transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenNotifications}
              className="p-2 text-[#434655] hover:text-[#004ac6] hover:bg-[#e2e7ff] rounded-full transition-colors relative cursor-pointer"
              title="Thông báo"
            >
              <span className="material-symbols-outlined">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#ba1a1a] rounded-full ring-2 ring-[#faf8ff] animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="p-2 text-[#434655] hover:text-[#004ac6] hover:bg-[#e2e7ff] rounded-full transition-colors hidden sm:block cursor-pointer"
              title="Trợ giúp & Hướng dẫn"
            >
              <span className="material-symbols-outlined">help_outline</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="ml-2 w-9 h-9 rounded-full overflow-hidden border border-[#c3c6d7] hover:ring-2 hover:ring-[#0053db] transition-all cursor-pointer focus:outline-none"
                title="Hồ sơ quản trị viên"
              >
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80"
                  alt="Admin Avatar"
                  className="w-full h-full object-cover"
                />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-[#c3c6d7] rounded-lg shadow-lg py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2 border-b border-[#c3c6d7]">
                    <p className="text-sm font-semibold text-[#131b2e]">Trần Văn Admin</p>
                    <p className="text-xs text-[#434655]">admin@thpt.edu.vn</p>
                    <span className="mt-1 inline-block text-[10px] bg-[#e2e7ff] text-[#004ac6] px-2 py-0.5 rounded font-medium">
                      Quản trị Ban Giám Hiệu
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProfileMenu(false)}
                    className="w-full px-4 py-2 text-left text-sm text-[#434655] hover:bg-[#f2f3ff] flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">person</span>
                    Hồ sơ cá nhân
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProfileMenu(false)}
                    className="w-full px-4 py-2 text-left text-sm text-[#434655] hover:bg-[#f2f3ff] flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">domain</span>
                    Thông tin Trường THPT
                  </button>
                  <div className="border-t border-[#c3c6d7] my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      alert('Đã đăng xuất hệ thống thành công!');
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-[#ba1a1a] hover:bg-[#ffdad6] flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-[#c3c6d7] animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg text-[#004ac6] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#004ac6]">help_outline</span>
                Hướng dẫn Quản trị Lớp học
              </h3>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="text-[#434655] hover:bg-[#f2f3ff] p-1 rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-3 text-sm text-[#434655]">
              <p>
                <strong>1. Chọn lớp học:</strong> Bấm vào hàng tương ứng trong bảng để xem danh sách học sinh, nhiệm vụ và cấu hình chi tiết ở bảng điều khiển bên phải.
              </p>
              <p>
                <strong>2. Tạo lớp mới:</strong> Bấm nút <strong>+ Tạo lớp</strong> trên góc phải toolbar.
              </p>
              <p>
                <strong>3. Gán giáo viên:</strong> Nhấp nút <em>Gán giáo viên</em> đối với các lớp chưa có GV phụ trách (như 10A3).
              </p>
              <p>
                <strong>4. Import danh sách học sinh:</strong> Sử dụng công cụ Import danh sách để thêm nhiều học sinh bằng file Excel/CSV.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-[#2563eb] text-white rounded-lg text-sm font-medium hover:bg-[#004ac6] transition-colors cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
