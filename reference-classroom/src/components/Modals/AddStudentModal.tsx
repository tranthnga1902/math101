import React, { useState } from 'react';
import { Student } from '../../types';

interface AddStudentModalProps {
  isOpen: boolean;
  classNameTitle: string;
  onClose: () => void;
  onSave: (newStudent: Omit<Student, 'id' | 'stt'>) => void;
  nextStt: number;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({
  isOpen,
  classNameTitle,
  onClose,
  onSave,
  nextStt
}) => {
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [gender, setGender] = useState<'Nam' | 'Nữ'>('Nam');
  const [dob, setDob] = useState('2008-05-15');
  const [parentPhone, setParentPhone] = useState('');
  const [email, setEmail] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const autoId = studentId.trim() || `HS${classNameTitle.replace(/\s+/g, '')}-${String(nextStt).padStart(3, '0')}`;

    onSave({
      name: name.trim(),
      studentId: autoId,
      classId: '',
      status: 'ACTIVE',
      progressPercent: 50,
      gender,
      dob,
      parentPhone,
      email
    });

    setName('');
    setStudentId('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 select-none">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-[#c3c6d7] animate-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#c3c6d7]">
          <h3 className="font-semibold text-lg text-[#004ac6] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6]">person_add</span>
            Thêm Học Sinh Vào Lớp {classNameTitle}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[#434655] hover:bg-[#f2f3ff] p-1 rounded-full cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-[#434655] font-semibold mb-1">
              Họ và Tên học sinh <span className="text-[#ba1a1a]">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Nhập đầy đủ họ tên..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 px-3 border border-[#c3c6d7] rounded text-sm text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#0053db]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#434655] font-semibold mb-1">
                Mã học sinh (Tự động nếu trống)
              </label>
              <input
                type="text"
                placeholder={`HS${classNameTitle}-${String(nextStt).padStart(3, '0')}`}
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full h-9 px-3 border border-[#c3c6d7] rounded text-sm text-[#131b2e] font-mono"
              />
            </div>
            <div>
              <label className="block text-[#434655] font-semibold mb-1">
                Giới tính
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as 'Nam' | 'Nữ')}
                className="w-full h-9 px-2 border border-[#c3c6d7] rounded text-sm text-[#131b2e]"
              >
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#434655] font-semibold mb-1">
                Ngày sinh
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full h-9 px-2 border border-[#c3c6d7] rounded text-sm text-[#131b2e]"
              />
            </div>
            <div>
              <label className="block text-[#434655] font-semibold mb-1">
                SĐT Phụ huynh
              </label>
              <input
                type="tel"
                placeholder="09xx xxx xxx"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                className="w-full h-9 px-3 border border-[#c3c6d7] rounded text-sm text-[#131b2e]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#434655] font-semibold mb-1">
              Email học sinh
            </label>
            <input
              type="email"
              placeholder="hocsinh@thpt.edu.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-9 px-3 border border-[#c3c6d7] rounded text-sm text-[#131b2e]"
            />
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
              Thêm học sinh
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
