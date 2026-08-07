import React from 'react';

export const TextbooksView: React.FC = () => {
  const books = [
    { title: 'Toán học 10 (Tập 1 & 2)', publisher: 'NXB Giáo Dục Việt Nam', series: 'Kết nối tri thức với cuộc sống', code: 'SGK-TOAN10', count: '450 bản' },
    { title: 'Ngữ văn 10 (Tập 1 & 2)', publisher: 'NXB Giáo Dục Việt Nam', series: 'Kết nối tri thức với cuộc sống', code: 'SGK-VAN10', count: '450 bản' },
    { title: 'Tiếng Anh 10 Global Success', publisher: 'NXB Giáo Dục Việt Nam', series: 'Global Success', code: 'SGK-ENG10', count: '420 bản' },
    { title: 'Vật lý 10', publisher: 'NXB Đại học Sư phạm', series: 'Cánh Diều', code: 'SGK-LY10', count: '380 bản' },
    { title: 'Hóa học 10', publisher: 'NXB Giáo Dục Việt Nam', series: 'Chân trời sáng tạo', code: 'SGK-HOA10', count: '390 bản' },
    { title: 'Sinh học 10', publisher: 'NXB Giáo Dục Việt Nam', series: 'Kết nối tri thức', code: 'SGK-SINH10', count: '400 bản' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-[#131b2e] mb-1">
            Danh mục Sách Giáo Khoa (SGK) Khối 10
          </h2>
          <p className="text-sm text-[#434655]">
            Theo dõi sách giáo khoa theo chương trình GDPT 2018 và số lượng phân bổ theo từng lớp.
          </p>
        </div>
        <button
          type="button"
          onClick={() => alert('Đã xuất báo cáo kiểm kê SGK Khối 10!')}
          className="h-10 px-4 rounded-lg bg-[#004ac6] text-white text-xs font-semibold hover:bg-[#2563eb] transition-colors flex items-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          Xuất báo cáo SGK
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {books.map((b, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-[#c3c6d7] shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="p-2 rounded bg-[#e2e7ff] text-[#004ac6] material-symbols-outlined text-[20px]">
                  menu_book
                </span>
                <span className="text-[10px] font-bold bg-[#7cf994] text-[#007230] px-2 py-0.5 rounded">
                  {b.series}
                </span>
              </div>
              <h3 className="font-bold text-base text-[#131b2e] mb-1">{b.title}</h3>
              <p className="text-xs text-[#434655] mb-2">{b.publisher}</p>
            </div>
            <div className="pt-3 border-t border-[#c3c6d7] flex justify-between items-center text-xs">
              <span className="font-mono text-[#434655]">{b.code}</span>
              <span className="font-semibold text-[#004ac6]">{b.count} trong kho</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
