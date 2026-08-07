import React, { useState } from 'react';
import { SchoolClass, Teacher } from '../../types';

interface AssignTeacherModalProps {
  isOpen: boolean;
  schoolClass: SchoolClass | null;
  teachers: Teacher[];
  onClose: () => void;
  onSave: (classId: string, teacherId: string) => void;
}

export const AssignTeacherModal: React.FC<AssignTeacherModalProps> = ({
  isOpen,
  schoolClass,
  teachers,
  onClose,
  onSave
}) => {
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  if (!isOpen || !schoolClass) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId) return;
    onSave(schoolClass.id, selectedTeacherId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 select-none">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-[#c3c6d7] animate-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#c3c6d7]">
          <h3 className="font-semibold text-lg text-[#004ac6] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6]">person_add</span>
            Gán Giáo Viên Cho Lớp {schoolClass.name}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[#434655] hover:bg-[#f2f3ff] p-1 rounded-full cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <p className="text-[#434655]">
            Chọn giáo viên phụ trách chủ nhiệm cho lớp <strong>{schoolClass.name}</strong> (Năm học {schoolClass.academicYear}):
          </p>

          <div>
            <label className="block text-[#434655] font-semibold mb-1">
              Danh sách giáo viên sẵn sàng
            </label>
            <select
              required
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full h-10 px-3 border border-[#c3c6d7] rounded text-sm text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#0053db]"
            >
              <option value="">-- Chọn giáo viên --</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} - Môn: {t.subject} (Đang CN {t.assignedClassesCount} lớp)
                </option>
              ))}
            </select>
          </div>

          <div className="bg-[#f2f3ff] p-3 rounded text-xs text-[#434655]">
            💡 Sau khi gán giáo viên thành công, trạng thái lớp sẽ chuyển sang <strong>ĐANG HỌC</strong> và gửi thông báo đến giáo viên bộ môn.
          </div>

          <div className="mt-6 pt-3 border-t border-[#c3c6d7] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#c3c6d7] rounded text-xs text-[#434655] hover:bg-[#f2f3ff]"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!selectedTeacherId}
              className="px-4 py-2 bg-[#004ac6] text-white rounded text-xs font-semibold hover:bg-[#2563eb] disabled:opacity-50"
            >
              Xác nhận gán giáo viên
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
