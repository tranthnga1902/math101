import React, { useState } from 'react';
import { TaskItem } from '../../types';

interface AddTaskModalProps {
  isOpen: boolean;
  classNameTitle: string;
  totalStudents: number;
  onClose: () => void;
  onSave: (newTask: Omit<TaskItem, 'id' | 'completedCount'>) => void;
}

export const AddTaskModal: React.FC<AddTaskModalProps> = ({
  isOpen,
  classNameTitle,
  totalStudents,
  onClose,
  onSave
}) => {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Toán học');
  const [dueDate, setDueDate] = useState('2023-10-15');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      classId: '',
      title: title.trim(),
      subject,
      dueDate: dueDate ? dueDate.split('-').reverse().join('/') : '15/10/2023',
      totalStudents,
      status: 'OPEN',
    });

    setTitle('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 select-none">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-[#c3c6d7] animate-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#c3c6d7]">
          <h3 className="font-semibold text-lg text-[#004ac6] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6]">assignment</span>
            Tạo Nhiệm Vụ Mới cho Lớp {classNameTitle}
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
              Tiêu đề nhiệm vụ <span className="text-[#ba1a1a]">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="VD: Bài viết số 2 Ngữ văn, Khảo sát..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-9 px-3 border border-[#c3c6d7] rounded text-sm text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#0053db]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#434655] font-semibold mb-1">
                Bộ môn / Phân loại
              </label>
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
                <option value="Học vụ">Học vụ & Đoàn đội</option>
                <option value="Thư viện">Thư viện SGK</option>
              </select>
            </div>

            <div>
              <label className="block text-[#434655] font-semibold mb-1">
                Hạn chót hoàn thành
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-9 px-2 border border-[#c3c6d7] rounded text-sm text-[#131b2e]"
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
              Tạo nhiệm vụ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
