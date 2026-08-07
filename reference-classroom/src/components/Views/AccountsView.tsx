import React, { useState } from 'react';
import { Teacher } from '../../types';

interface AccountsViewProps {
  teachers: Teacher[];
  onAddTeacher: (t: Omit<Teacher, 'id' | 'assignedClassesCount'>) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({ teachers, onAddTeacher }) => {
  const [activeSubTab, setActiveSubTab] = useState<'teachers' | 'students'>('teachers');
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('Toán học');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    onAddTeacher({
      name: name.trim(),
      subject,
      email: email.trim(),
      phone: phone.trim() || '0900 000 000'
    });
    setName('');
    setEmail('');
    setPhone('');
    setShowAddTeacherModal(false);
    alert('Đã thêm tài khoản giáo viên mới!');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-[#131b2e] mb-1">
            Quản lý Tài khoản & Nhân sự THPT
          </h2>
          <p className="text-sm text-[#434655]">
            Quản lý tài khoản giáo viên, cán bộ học vụ và phân quyền truy cập.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddTeacherModal(true)}
          className="h-10 px-4 rounded-lg bg-[#004ac6] text-white text-xs font-semibold hover:bg-[#2563eb] transition-colors flex items-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Thêm Giáo viên mới
        </button>
      </div>

      {/* Table of teachers */}
      <div className="border border-[#c3c6d7] rounded-lg bg-white overflow-hidden shadow-xs">
        <div className="px-6 py-3 bg-[#f2f3ff] border-b border-[#c3c6d7] flex gap-4">
          <button
            type="button"
            onClick={() => setActiveSubTab('teachers')}
            className={`font-semibold text-xs px-2 py-1 rounded cursor-pointer ${
              activeSubTab === 'teachers' ? 'bg-[#2563eb] text-white' : 'text-[#434655]'
            }`}
          >
            Đội ngũ Giáo viên ({teachers.length})
          </button>
        </div>

        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-[#f8fafc] border-b border-[#c3c6d7] text-xs text-[#434655]">
              <th className="p-3 font-semibold">Họ và Tên</th>
              <th className="p-3 font-semibold">Bộ môn</th>
              <th className="p-3 font-semibold">Email</th>
              <th className="p-3 font-semibold">Số điện thoại</th>
              <th className="p-3 font-semibold text-center">Số lớp Chủ nhiệm</th>
              <th className="p-3 font-semibold text-center">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c3c6d7]">
            {teachers.map((t) => (
              <tr key={t.id} className="hover:bg-[#faf8ff]">
                <td className="p-3 font-semibold text-[#004ac6]">{t.name}</td>
                <td className="p-3">{t.subject}</td>
                <td className="p-3 font-mono text-xs">{t.email}</td>
                <td className="p-3">{t.phone}</td>
                <td className="p-3 text-center font-bold">{t.assignedClassesCount}</td>
                <td className="p-3 text-center">
                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#7cf994] text-[#007230]">
                    ĐANG HOẠT ĐỘNG
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-[#c3c6d7]">
            <h3 className="font-semibold text-lg text-[#004ac6] mb-4 pb-2 border-b border-[#c3c6d7]">
              Thêm Giáo Viên Mới
            </h3>
            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#434655] font-semibold mb-1">Họ tên giáo viên</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-9 px-3 border border-[#c3c6d7] rounded text-sm text-[#131b2e]"
                />
              </div>
              <div>
                <label className="block text-[#434655] font-semibold mb-1">Bộ môn giảng dạy</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full h-9 px-2 border border-[#c3c6d7] rounded text-sm text-[#131b2e]"
                >
                  <option value="Toán học">Toán học</option>
                  <option value="Ngữ văn">Ngữ văn</option>
                  <option value="Tiếng Anh">Tiếng Anh</option>
                  <option value="Vật lý">Vật lý</option>
                  <option value="Hóa học">Hóa học</option>
                  <option value="Sinh học">Sinh học</option>
                  <option value="Lịch sử">Lịch sử</option>
                  <option value="Địa lý">Địa lý</option>
                </select>
              </div>
              <div>
                <label className="block text-[#434655] font-semibold mb-1">Email trường</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-9 px-3 border border-[#c3c6d7] rounded text-sm text-[#131b2e]"
                />
              </div>
              <div>
                <label className="block text-[#434655] font-semibold mb-1">Số điện thoại</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-9 px-3 border border-[#c3c6d7] rounded text-sm text-[#131b2e]"
                />
              </div>
              <div className="pt-3 border-t border-[#c3c6d7] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTeacherModal(false)}
                  className="px-3 py-1.5 border rounded text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#004ac6] text-white rounded text-xs font-semibold"
                >
                  Lưu giáo viên
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
