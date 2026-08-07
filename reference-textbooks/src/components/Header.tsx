import React, { useState } from 'react';

interface HeaderProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onOpenNotification?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ searchTerm, setSearchTerm }) => {
  const [language, setLanguage] = useState('Ngôn ngữ');
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  return (
    <header className="bg-[#ffffff] dark:bg-[#283044] h-[56px] w-full fixed top-0 z-40 pl-[240px] border-b border-[#c3c6d7] dark:border-[#737686] flex justify-between items-center px-6">
      <div className="flex items-center gap-4 w-1/3">
        <div className="text-[20px] font-bold text-[#131b2e] dark:text-[#eef0ff]">
          Quản lý Giáo dục
        </div>
      </div>

      {/* Search Input */}
      <div className="flex-1 max-w-md mx-4 hidden md:flex">
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#737686] text-[20px]">
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm SGK, môn học..."
            className="w-full h-10 pl-10 pr-4 rounded bg-[#eaedff] border-none focus:outline-none focus:ring-2 focus:ring-[#004ac6] text-sm text-[#131b2e] placeholder-[#434655] transition-all"
          />
        </div>
      </div>

      {/* Actions & Profile */}
      <div className="flex items-center gap-3">
        <button
          title="Thông báo"
          className="w-10 h-10 rounded-full hover:bg-[#eaedff] dark:hover:bg-[#dae2fd] flex items-center justify-center text-[#434655] transition-colors relative"
        >
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-[#ba1a1a] rounded-full"></span>
        </button>

        <button
          title="Trợ giúp"
          className="w-10 h-10 rounded-full hover:bg-[#eaedff] dark:hover:bg-[#dae2fd] flex items-center justify-center text-[#434655] transition-colors"
        >
          <span className="material-symbols-outlined text-[22px]">help</span>
        </button>

        <div className="h-6 w-px bg-[#c3c6d7] mx-1"></div>

        {/* Language selector */}
        <div className="relative">
          <button
            onClick={() => setShowLangDropdown(!showLangDropdown)}
            className="flex items-center gap-1.5 text-sm text-[#434655] hover:bg-[#eaedff] px-3 py-1.5 rounded transition-colors"
          >
            {language}
            <span className="material-symbols-outlined text-[18px]">expand_more</span>
          </button>

          {showLangDropdown && (
            <div className="absolute right-0 mt-1 w-36 bg-white border border-[#c3c6d7] rounded-lg shadow-lg py-1 z-50 text-sm">
              <button
                onClick={() => {
                  setLanguage('Tiếng Việt');
                  setShowLangDropdown(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-[#f2f3ff] text-[#131b2e] flex items-center justify-between"
              >
                Tiếng Việt {language === 'Tiếng Việt' && '✓'}
              </button>
              <button
                onClick={() => {
                  setLanguage('English');
                  setShowLangDropdown(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-[#f2f3ff] text-[#131b2e] flex items-center justify-between"
              >
                English {language === 'English' && '✓'}
              </button>
            </div>
          )}
        </div>

        {/* Admin Avatar */}
        <div className="w-8 h-8 rounded-full bg-[#dae2fd] overflow-hidden border border-[#c3c6d7] ml-2 cursor-pointer hover:ring-2 hover:ring-[#004ac6] transition-all">
          <img
            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80"
            alt="Admin Profile"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </header>
  );
};
