import React from 'react';

export const AuditLogsView: React.FC = () => {
  const logs = [
    { time: '10:42:15 - 03/08/2026', user: 'Trần Văn Admin', action: 'Gán giáo viên Trần Thị B cho Lớp 10A2', type: 'UPDATE' },
    { time: '09:30:00 - 03/08/2026', user: 'Nguyễn Văn A', action: 'Tạo nhiệm vụ mới: Bài tập Đại số Chuyên đề 1 cho Lớp 10A1', type: 'CREATE' },
    { time: '08:15:22 - 03/08/2026', user: 'Trần Văn Admin', action: 'Import thành công 4 học sinh mới vào Lớp 10A2', type: 'IMPORT' },
    { time: '16:20:00 - 02/08/2026', user: 'Trần Văn Admin', action: 'Tạo lớp học mới 10A6 (Khối 10, Năm học 2023-2024)', type: 'CREATE' },
    { time: '14:05:10 - 02/08/2026', user: 'Lê Văn C', action: 'Cập nhật tiến độ học tập Lớp 10A4 đạt 92%', type: 'UPDATE' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#131b2e] mb-1">
          Nhật ký Thao tác & Biến động Học vụ
        </h2>
        <p className="text-sm text-[#434655]">
          Ghi nhận toàn bộ lịch sử thay đổi thông tin lớp học, sĩ số học sinh và phân công giảng dạy.
        </p>
      </div>

      <div className="border border-[#c3c6d7] rounded-lg bg-white overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-[#f2f3ff] border-b border-[#c3c6d7] text-[#434655]">
              <th className="p-3 font-semibold">Thời gian</th>
              <th className="p-3 font-semibold">Người thực hiện</th>
              <th className="p-3 font-semibold">Nội dung thao tác</th>
              <th className="p-3 font-semibold text-center">Loại biến động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c3c6d7] text-[#131b2e]">
            {logs.map((log, idx) => (
              <tr key={idx} className="hover:bg-[#faf8ff]">
                <td className="p-3 font-mono text-[#434655]">{log.time}</td>
                <td className="p-3 font-semibold text-[#004ac6]">{log.user}</td>
                <td className="p-3">{log.action}</td>
                <td className="p-3 text-center">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#e2e7ff] text-[#004ac6]">
                    {log.type}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
