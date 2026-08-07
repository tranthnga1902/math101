import React, { useState } from 'react';
import { SchoolClass, Teacher } from '../../types';

interface CreateClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newClass: Omit<SchoolClass, 'id' | 'openTasksCount' | 'progressPercent'>) => void;
  teachers: Teacher[];
}

export const CreateClassModal: React.FC<CreateClassModalProps> = ({
  isOpen,
  onClose,
  onSave,
  teachers
}) => {
  const [name, setName] = useState('');
  const [academicYear, setAcademicYear] = useState('2023-2024');
  const [teacherId, setTeacherId] = useState('');
  const [studentCount, setStudentCount] = useState(40);
  const [grade, setGrade] = useState(10);
  const [room, setRoom] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const selectedTeacher = teachers.find((t) => t.id === teacherId);

    onSave({
      name: name.trim(),
      academicYear,
      teacherId: teacherId || undefined,
      teacherName: selectedTeacher ? selectedTeacher.name : undefined,
      studentCount: Number(studentCount) || 0,
      status: teacherId ? 'ĐANG HỌC' : 'CHỜ K/G',
      grade: Number(grade) || 10,
      room: room.trim() || undefined
    });

    setName('');
    setTeacherId('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 select-none">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-[#c3c6d7] animate-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#c3c6d7]">
          <h3 className="font-semibold text-lg text-[#004ac6] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6]">add_box</span>
            Tạo Lớp Học Mới
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
          <div>
            <label className="block text-[#434655] font-semibold mb-1">
              Tên Lớp (VD: 10A7, 10A8) <span className="text-[#ba1a1a]">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Nhập tên lớp..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 px-3 border border-[#c3c6d7] rounded text-sm text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#0053db]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#434655] font-semibold mb-1">
                Khối lớp
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value))}
                className="w-full h-9 px-2 border border-[#c3c6d7] rounded text-sm text-[#131b2e]"
              >
                <option value={10}>Khối 10</option>
                <option value={11}>Khối 11</option>
                <option value={12}>Khối 12</option>
              </select>
            </div>

            <div>
              <label className="block text-[#434655] font-semibold mb-1">
                Năm học
              </label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full h-9 px-2 border border-[#c3c6d7] rounded text-sm text-[#131b2e]"
              >
                <option value="2023-2024">2023-2024</option>
                <option value="2024-2025">2024-2025</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[#434655] font-semibold mb-1">
              Giáo viên phụ trách
            </label>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full h-9 px-3 border border-[#c3c6d7] rounded text-sm text-[#131b2e]"
            >
              <option value="">-- Chưa gán (Trạng thái: CHỜ K/G) --</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.subject})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#434655] font-semibold mb-1">
                Sĩ số dự kiến
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={studentCount}
                onChange={(e) => setStudentCount(Number(e.target.value))}
                className="w-full h-9 px-3 border border-[#c3c6d7] rounded text-sm text-[#131b2e]"
              />
            </div>
            <div>
              <label className="block text-[#434655] font-semibold mb-1">
                Phòng học
              </label>
              <input
                type="text"
                placeholder="VD: Phòng 207"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-full h-9 px-3 border border-[#c3c6d7] rounded text-sm text-[#131b2e]"
              />
            </div>
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
              className="px-4 py-2 bg-[#004ac6] text-white rounded text-xs font-semibold hover:bg-[#2563eb]"
            >
              Tạo lớp ngay
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
