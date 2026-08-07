import React, { useState } from 'react';
import { SchoolClass, Student, TaskItem, Teacher } from '../types';

interface ClassDetailPanelProps {
  schoolClass: SchoolClass | null;
  students: Student[];
  tasks: TaskItem[];
  teachers: Teacher[];
  onClose: () => void;
  onOpenAddStudent: () => void;
  onOpenImportExcel: () => void;
  onOpenAddTask: () => void;
  onToggleStudentStatus: (studentId: string) => void;
  onToggleTaskStatus: (taskId: string) => void;
  onUpdateClass: (updatedClass: SchoolClass) => void;
  onArchiveClass: (classId: string) => void;
  onDeleteStudent: (studentId: string) => void;
}

export const ClassDetailPanel: React.FC<ClassDetailPanelProps> = ({
  schoolClass,
  students,
  tasks,
  teachers,
  onClose,
  onOpenAddStudent,
  onOpenImportExcel,
  onOpenAddTask,
  onToggleStudentStatus,
  onToggleTaskStatus,
  onUpdateClass,
  onArchiveClass,
  onDeleteStudent
}) => {
  const [activeTab, setActiveTab] = useState<'students' | 'tasks' | 'settings'>('students');
  const [studentSearch, setStudentSearch] = useState('');
  const [editingName, setEditingName] = useState('');
  const [editingYear, setEditingYear] = useState('');
  const [editingTeacherId, setEditingTeacherId] = useState('');
  const [editingRoom, setEditingRoom] = useState('');

  if (!schoolClass) return null;

  // Initialize editing state when class changes
  React.useEffect(() => {
    if (schoolClass) {
      setEditingName(schoolClass.name);
      setEditingYear(schoolClass.academicYear);
      setEditingTeacherId(schoolClass.teacherId || '');
      setEditingRoom(schoolClass.room || '');
    }
  }, [schoolClass]);

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.studentId.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedTeacher = teachers.find((t) => t.id === editingTeacherId);
    onUpdateClass({
      ...schoolClass,
      name: editingName,
      academicYear: editingYear,
      teacherId: editingTeacherId || undefined,
      teacherName: selectedTeacher ? selectedTeacher.name : undefined,
      room: editingRoom,
    });
    alert('Đã cập nhật thông tin lớp học thành công!');
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[640px] bg-white shadow-[0_0_24px_rgba(15,23,42,0.12)] z-40 flex flex-col transition-all duration-300 border-l border-[#c3c6d7] animate-in slide-in-from-right duration-300 select-none">
      {/* Panel Header */}
      <div className="h-[72px] px-6 border-b border-[#c3c6d7] flex items-center justify-between shrink-0 bg-[#ffffff]">
        <div>
          <h3 className="font-semibold text-lg text-[#131b2e] flex items-center gap-2">
            Lớp {schoolClass.name}
            {schoolClass.status === 'ĐANG HỌC' && (
              <span className="inline-flex items-center px-2 h-5 rounded bg-[#7cf994] text-[#007230] text-[10px] font-semibold tracking-wide">
                ĐANG HỌC
              </span>
            )}
            {schoolClass.status === 'CHỜ K/G' && (
              <span className="inline-flex items-center px-2 h-5 rounded bg-[#dae2fd] text-[#434655] text-[10px] font-semibold tracking-wide">
                CHỜ K/G
              </span>
            )}
            {schoolClass.status === 'ĐÃ LƯU TRỮ' && (
              <span className="inline-flex items-center px-2 h-5 rounded bg-[#ffdad6] text-[#93000a] text-[10px] font-semibold tracking-wide">
                ĐÃ LƯU TRỮ
              </span>
            )}
          </h3>
          <p className="text-xs text-[#434655] mt-0.5">
            Năm học: {schoolClass.academicYear} • GV:{' '}
            {schoolClass.teacherName || 'Chưa gán'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-[#434655] hover:bg-[#e2e7ff] rounded-full transition-colors cursor-pointer"
          title="Đóng panel"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* Panel Tabs */}
      <div className="px-6 border-b border-[#c3c6d7] flex gap-6 shrink-0 bg-[#ffffff]">
        <button
          type="button"
          onClick={() => setActiveTab('students')}
          className={`h-12 border-b-2 font-semibold text-xs px-1 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'students'
              ? 'border-[#004ac6] text-[#004ac6]'
              : 'border-transparent text-[#434655] hover:text-[#131b2e]'
          }`}
        >
          Học sinh
          <span className="bg-[#2563eb] text-[#eeefff] py-0.5 px-2 rounded-full text-[10px]">
            {students.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('tasks')}
          className={`h-12 border-b-2 font-semibold text-xs px-1 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'tasks'
              ? 'border-[#004ac6] text-[#004ac6]'
              : 'border-transparent text-[#434655] hover:text-[#131b2e]'
          }`}
        >
          Nhiệm vụ
          <span className="bg-[#e2e7ff] text-[#004ac6] py-0.5 px-2 rounded-full text-[10px]">
            {tasks.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`h-12 border-b-2 font-semibold text-xs px-1 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'settings'
              ? 'border-[#004ac6] text-[#004ac6]'
              : 'border-transparent text-[#434655] hover:text-[#131b2e]'
          }`}
        >
          Cài đặt
        </button>
      </div>

      {/* Panel Body Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#faf8ff]">
        {/* TAB 1: HỌC SINH */}
        {activeTab === 'students' && (
          <div>
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mb-4">
              <div className="relative w-full sm:w-48">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#434655] text-[16px]">
                  search
                </span>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Tìm học sinh..."
                  className="h-8 w-full pl-8 pr-3 bg-[#f2f3ff] border border-[#c3c6d7] rounded text-xs text-[#131b2e] focus:outline-none focus:ring-1 focus:ring-[#0053db]"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={onOpenImportExcel}
                  className="h-8 px-3 rounded border border-[#c3c6d7] bg-white text-[#131b2e] text-[12px] font-semibold hover:bg-[#e2e7ff] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    upload_file
                  </span>
                  Import Excel
                </button>
                <button
                  type="button"
                  onClick={onOpenAddStudent}
                  className="h-8 px-3 rounded bg-[#2563eb] text-white font-semibold text-[12px] hover:bg-[#004ac6] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    add
                  </span>
                  Thêm học sinh
                </button>
              </div>
            </div>

            {/* Students Table */}
            <div className="border border-[#c3c6d7] rounded-lg overflow-hidden bg-white shadow-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f2f3ff] border-b border-[#c3c6d7]">
                    <th className="h-9 px-3 text-[11px] text-[#434655] font-semibold w-10">
                      STT
                    </th>
                    <th className="h-9 px-3 text-[11px] text-[#434655] font-semibold">
                      Họ và Tên
                    </th>
                    <th className="h-9 px-3 text-[11px] text-[#434655] font-semibold">
                      Mã HS
                    </th>
                    <th className="h-9 px-3 text-[11px] text-[#434655] font-semibold text-center">
                      Trạng thái
                    </th>
                    <th className="h-9 px-3 text-[11px] text-[#434655] font-semibold w-24">
                      Tiến độ
                    </th>
                    <th className="h-9 px-2 text-[11px] text-[#434655] font-semibold w-12 text-center">
                      Sửa
                    </th>
                  </tr>
                </thead>
                <tbody className="text-xs text-[#131b2e]">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#434655]">
                        Không có học sinh nào.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st, idx) => (
                      <tr
                        key={st.id}
                        className={`h-10 border-b border-[#c3c6d7] transition-colors ${
                          idx % 2 === 1 ? 'bg-[#f8fafc]' : 'bg-white'
                        } hover:bg-[#dae2fd]`}
                      >
                        <td className="px-3 text-[#434655]">{st.stt || idx + 1}</td>
                        <td className="px-3 font-semibold text-[#131b2e]">
                          {st.name}
                        </td>
                        <td className="px-3 text-[#434655] font-mono">
                          {st.studentId}
                        </td>
                        <td className="px-3 text-center">
                          <button
                            type="button"
                            onClick={() => onToggleStudentStatus(st.id)}
                            className="cursor-pointer inline-block"
                            title={
                              st.status === 'ACTIVE'
                                ? 'Đang học (Bấm để thay đổi)'
                                : 'Đình chỉ (Bấm để thay đổi)'
                            }
                          >
                            <span
                              className={`w-2.5 h-2.5 rounded-full inline-block transition-transform hover:scale-125 ${
                                st.status === 'ACTIVE'
                                  ? 'bg-[#006e2d]'
                                  : 'bg-[#ba1a1a]'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-3">
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-full bg-[#e2e7ff] rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  st.progressPercent < 30
                                    ? 'bg-[#c3c6d7]'
                                    : 'bg-[#004ac6]'
                                }`}
                                style={{ width: `${st.progressPercent}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-[#434655] w-6 font-medium">
                              {st.progressPercent}%
                            </span>
                          </div>
                        </td>
                        <td className="px-2 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Xóa học sinh ${st.name} khỏi lớp ${schoolClass.name}?`)) {
                                onDeleteStudent(st.id);
                              }
                            }}
                            className="text-[#ba1a1a] hover:bg-[#ffdad6] p-1 rounded cursor-pointer"
                            title="Xóa học sinh"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: NHIỆM VỤ */}
        {activeTab === 'tasks' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold text-sm text-[#131b2e]">
                Nhiệm vụ & Bài tập của Lớp {schoolClass.name}
              </h4>
              <button
                type="button"
                onClick={onOpenAddTask}
                className="h-8 px-3 rounded bg-[#2563eb] text-white font-semibold text-[12px] hover:bg-[#004ac6] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Tạo nhiệm vụ
              </button>
            </div>

            <div className="space-y-3">
              {tasks.length === 0 ? (
                <div className="p-8 text-center text-[#434655] bg-white rounded-lg border border-[#c3c6d7]">
                  Chưa có nhiệm vụ nào cho lớp này.
                </div>
              ) : (
                tasks.map((task) => {
                  const percent = Math.round(
                    (task.completedCount / task.totalStudents) * 100
                  );
                  return (
                    <div
                      key={task.id}
                      className="p-4 bg-white border border-[#c3c6d7] rounded-lg shadow-xs hover:border-[#004ac6] transition-all"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-[10px] font-semibold bg-[#e2e7ff] text-[#004ac6] px-2 py-0.5 rounded mr-2">
                            {task.subject}
                          </span>
                          <h5 className="font-semibold text-sm text-[#131b2e] inline-block">
                            {task.title}
                          </h5>
                        </div>
                        <button
                          type="button"
                          onClick={() => onToggleTaskStatus(task.id)}
                          className={`text-xs px-2 py-1 rounded font-semibold cursor-pointer ${
                            task.status === 'COMPLETED'
                              ? 'bg-[#7cf994] text-[#007230]'
                              : 'bg-[#ffdbce] text-[#973400]'
                          }`}
                        >
                          {task.status === 'COMPLETED' ? 'HOÀN THÀNH' : 'ĐANG MỞ'}
                        </button>
                      </div>

                      <div className="flex justify-between items-center text-xs text-[#434655] mt-3">
                        <span>Hạn nộp: {task.dueDate}</span>
                        <span>
                          Đã nộp: <strong>{task.completedCount}</strong>/{task.totalStudents} ({percent}%)
                        </span>
                      </div>

                      <div className="mt-2 h-1.5 w-full bg-[#e2e7ff] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#004ac6]"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CÀI ĐẶT LỚP HỌC */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="space-y-4 bg-white p-5 rounded-lg border border-[#c3c6d7]">
            <h4 className="font-semibold text-sm text-[#131b2e] mb-3 pb-2 border-b border-[#c3c6d7]">
              Cấu hình thông tin Lớp học
            </h4>

            <div>
              <label className="block text-xs font-semibold text-[#434655] mb-1">
                Tên lớp học
              </label>
              <input
                type="text"
                required
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="w-full h-9 px-3 border border-[#c3c6d7] rounded text-sm text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#0053db]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#434655] mb-1">
                Năm học
              </label>
              <select
                value={editingYear}
                onChange={(e) => setEditingYear(e.target.value)}
                className="w-full h-9 px-3 border border-[#c3c6d7] rounded text-sm text-[#131b2e]"
              >
                <option value="2023-2024">2023-2024</option>
                <option value="2024-2025">2024-2025</option>
                <option value="2025-2026">2025-2026</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#434655] mb-1">
                Giáo viên phụ trách (Chủ nhiệm)
              </label>
              <select
                value={editingTeacherId}
                onChange={(e) => setEditingTeacherId(e.target.value)}
                className="w-full h-9 px-3 border border-[#c3c6d7] rounded text-sm text-[#131b2e]"
              >
                <option value="">-- Chưa phân công --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.subject})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#434655] mb-1">
                Phòng học cố định
              </label>
              <input
                type="text"
                value={editingRoom}
                onChange={(e) => setEditingRoom(e.target.value)}
                placeholder="Ví dụ: Phòng 202"
                className="w-full h-9 px-3 border border-[#c3c6d7] rounded text-sm text-[#131b2e]"
              />
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                className="h-9 px-5 bg-[#004ac6] text-white font-semibold text-xs rounded hover:bg-[#2563eb] transition-colors cursor-pointer"
              >
                Lưu thay đổi
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Panel Footer */}
      <div className="p-6 border-t border-[#c3c6d7] bg-[#ffffff] shrink-0">
        <button
          type="button"
          onClick={() => onArchiveClass(schoolClass.id)}
          className={`w-full h-10 rounded-lg border font-semibold text-[13px] transition-colors flex items-center justify-center gap-2 cursor-pointer ${
            schoolClass.status === 'ĐÃ LƯU TRỮ'
              ? 'border-[#006e2d] text-[#006e2d] hover:bg-[#7cf994]/20'
              : 'border-[#ba1a1a] text-[#ba1a1a] hover:bg-[#ffdad6] hover:text-[#93000a]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {schoolClass.status === 'ĐÃ LƯU TRỮ' ? 'unarchive' : 'inventory_2'}
          </span>
          {schoolClass.status === 'ĐÃ LƯU TRỮ'
            ? 'Khôi phục lớp học này'
            : 'Lưu trữ lớp học này'}
        </button>
        <p className="text-[11px] text-center text-[#434655] mt-2">
          Chỉ lưu trữ khi năm học đã kết thúc. Hành động này có thể hoàn tác.
        </p>
      </div>
    </div>
  );
};
