/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ClassListTable } from './components/ClassListTable';
import { ClassDetailPanel } from './components/ClassDetailPanel';
import { CreateClassModal } from './components/Modals/CreateClassModal';
import { AddStudentModal } from './components/Modals/AddStudentModal';
import { ImportExcelModal } from './components/Modals/ImportExcelModal';
import { AssignTeacherModal } from './components/Modals/AssignTeacherModal';
import { AddTaskModal } from './components/Modals/AddTaskModal';
import { NotificationToast } from './components/NotificationToast';

import { DashboardOverview } from './components/Views/DashboardOverview';
import { AccountsView } from './components/Views/AccountsView';
import { TextbooksView } from './components/Views/TextbooksView';
import { AuditLogsView } from './components/Views/AuditLogsView';

import { INITIAL_CLASSES, INITIAL_STUDENTS, INITIAL_TASKS, INITIAL_TEACHERS } from './mockData';
import { NavigationTab, SchoolClass, Student, TaskItem, Teacher } from './types';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('classes');
  const [classes, setClasses] = useState<SchoolClass[]>(INITIAL_CLASSES);
  const [selectedClassId, setSelectedClassId] = useState<string | null>('c2'); // Default to 10A2 as in design mockup
  const [students, setStudents] = useState<Record<string, Student[]>>(INITIAL_STUDENTS);
  const [tasks, setTasks] = useState<Record<string, TaskItem[]>>(INITIAL_TASKS);
  const [teachers, setTeachers] = useState<Teacher[]>(INITIAL_TEACHERS);

  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modals state
  const [isCreateClassOpen, setIsCreateClassOpen] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isImportExcelOpen, setIsImportExcelOpen] = useState(false);
  const [isAssignTeacherOpen, setIsAssignTeacherOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [assignTargetClass, setAssignTargetClass] = useState<SchoolClass | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const selectedClass = classes.find((c) => c.id === selectedClassId) || null;
  const currentClassStudents = selectedClassId ? students[selectedClassId] || [] : [];
  const currentClassTasks = selectedClassId ? tasks[selectedClassId] || [] : [];

  // Handlers
  const handleCreateClass = (
    newClassData: Omit<SchoolClass, 'id' | 'openTasksCount' | 'progressPercent'>
  ) => {
    const newId = `c_${Date.now()}`;
    const newClass: SchoolClass = {
      ...newClassData,
      id: newId,
      openTasksCount: 0,
      progressPercent: 0,
    };
    setClasses((prev) => [newClass, ...prev]);
    setSelectedClassId(newId);
    showToast(`Đã tạo thành công lớp học ${newClass.name}!`);
  };

  const handleAddStudent = (studentData: Omit<Student, 'id' | 'stt'>) => {
    if (!selectedClassId) return;

    const classStudents = students[selectedClassId] || [];
    const nextStt = classStudents.length + 1;
    const newStudent: Student = {
      ...studentData,
      id: `s_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      stt: nextStt,
      classId: selectedClassId,
    };

    const updatedStudentsList = [...classStudents, newStudent];

    setStudents((prev) => ({
      ...prev,
      [selectedClassId]: updatedStudentsList,
    }));

    // Update class student count
    setClasses((prev) =>
      prev.map((c) =>
        c.id === selectedClassId
          ? { ...c, studentCount: updatedStudentsList.length }
          : c
      )
    );

    showToast(`Đã thêm học sinh ${newStudent.name} vào lớp ${selectedClass?.name}`);
  };

  const handleImportExcelDone = (imported: Omit<Student, 'id' | 'stt'>[]) => {
    if (!selectedClassId) return;

    const classStudents = students[selectedClassId] || [];
    let currentCount = classStudents.length;

    const newStudentsList: Student[] = imported.map((imp) => {
      currentCount += 1;
      return {
        ...imp,
        id: `s_imp_${Date.now()}_${currentCount}`,
        stt: currentCount,
        classId: selectedClassId,
      };
    });

    const combined = [...classStudents, ...newStudentsList];

    setStudents((prev) => ({
      ...prev,
      [selectedClassId]: combined,
    }));

    setClasses((prev) =>
      prev.map((c) =>
        c.id === selectedClassId ? { ...c, studentCount: combined.length } : c
      )
    );

    showToast(`Đã import ${imported.length} học sinh vào lớp ${selectedClass?.name}!`);
  };

  const handleAssignTeacher = (classId: string, teacherId: string) => {
    const teacher = teachers.find((t) => t.id === teacherId);
    if (!teacher) return;

    setClasses((prev) =>
      prev.map((c) =>
        c.id === classId
          ? {
              ...c,
              teacherId: teacher.id,
              teacherName: teacher.name,
              status: c.status === 'CHỜ K/G' ? 'ĐANG HỌC' : c.status,
            }
          : c
      )
    );

    setTeachers((prev) =>
      prev.map((t) =>
        t.id === teacherId
          ? { ...t, assignedClassesCount: t.assignedClassesCount + 1 }
          : t
      )
    );

    showToast(`Đã gán GV ${teacher.name} làm GV phụ trách cho lớp!`);
  };

  const handleAddTask = (taskData: Omit<TaskItem, 'id' | 'completedCount'>) => {
    if (!selectedClassId) return;

    const newTask: TaskItem = {
      ...taskData,
      id: `tks_${Date.now()}`,
      classId: selectedClassId,
      completedCount: 0,
    };

    const currentTasks = tasks[selectedClassId] || [];
    setTasks((prev) => ({
      ...prev,
      [selectedClassId]: [newTask, ...currentTasks],
    }));

    setClasses((prev) =>
      prev.map((c) =>
        c.id === selectedClassId
          ? { ...c, openTasksCount: c.openTasksCount + 1 }
          : c
      )
    );

    showToast(`Đã giao nhiệm vụ mới cho lớp ${selectedClass?.name}!`);
  };

  const handleToggleStudentStatus = (studentId: string) => {
    if (!selectedClassId) return;

    setStudents((prev) => ({
      ...prev,
      [selectedClassId]: (prev[selectedClassId] || []).map((st) =>
        st.id === studentId
          ? {
              ...st,
              status: st.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
            }
          : st
      ),
    }));

    showToast('Đã cập nhật trạng thái học sinh.');
  };

  const handleToggleTaskStatus = (taskId: string) => {
    if (!selectedClassId) return;

    setTasks((prev) => ({
      ...prev,
      [selectedClassId]: (prev[selectedClassId] || []).map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: t.status === 'COMPLETED' ? 'OPEN' : 'COMPLETED',
            }
          : t
      ),
    }));

    showToast('Đã cập nhật trạng thái nhiệm vụ.');
  };

  const handleUpdateClass = (updated: SchoolClass) => {
    setClasses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    showToast(`Đã lưu thay đổi thông tin lớp ${updated.name}!`);
  };

  const handleArchiveClass = (classId: string) => {
    setClasses((prev) =>
      prev.map((c) =>
        c.id === classId
          ? {
              ...c,
              status: c.status === 'ĐÃ LƯU TRỮ' ? 'ĐANG HỌC' : 'ĐÃ LƯU TRỮ',
            }
          : c
      )
    );
    showToast('Đã cập nhật trạng thái lưu trữ của lớp học.');
  };

  const handleDeleteStudent = (studentId: string) => {
    if (!selectedClassId) return;

    const updated = (students[selectedClassId] || []).filter(
      (s) => s.id !== studentId
    );
    setStudents((prev) => ({
      ...prev,
      [selectedClassId]: updated,
    }));

    setClasses((prev) =>
      prev.map((c) =>
        c.id === selectedClassId ? { ...c, studentCount: updated.length } : c
      )
    );

    showToast('Đã xóa học sinh khỏi lớp.');
  };

  const handleAddTeacher = (newTeacher: Omit<Teacher, 'id' | 'assignedClassesCount'>) => {
    const t: Teacher = {
      ...newTeacher,
      id: `t_${Date.now()}`,
      assignedClassesCount: 0,
    };
    setTeachers((prev) => [...prev, t]);
  };

  return (
    <div className="bg-[#faf8ff] text-[#131b2e] antialiased flex h-screen overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Wrapper */}
      <div className="flex-1 flex flex-col xl:ml-[240px] w-full min-w-0 transition-all duration-300">
        {/* Header TopBar */}
        <Header
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenNotifications={() => showToast('Hệ thống hoạt động bình thường! Không có cảnh báo khẩn cấp.')}
        />

        {/* Main View Area */}
        <main className="flex-1 overflow-y-auto p-6 flex gap-6 bg-[#ffffff] relative">
          {currentTab === 'classes' && (
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${selectedClassId ? 'xl:pr-[640px]' : ''}`}>
              <ClassListTable
                classes={classes}
                selectedClassId={selectedClassId || undefined}
                onSelectClass={(c) => setSelectedClassId(c.id)}
                onOpenCreateClass={() => setIsCreateClassOpen(true)}
                onOpenImportStudents={() => {
                  if (!selectedClassId && classes.length > 0) {
                    setSelectedClassId(classes[0].id);
                  }
                  setIsImportExcelOpen(true);
                }}
                onAssignTeacher={(c) => {
                  setAssignTargetClass(c);
                  setIsAssignTeacherOpen(true);
                }}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            </div>
          )}

          {currentTab === 'dashboard' && (
            <div className="w-full max-w-7xl mx-auto">
              <DashboardOverview
                classes={classes}
                teachers={teachers}
                onSelectTab={setCurrentTab}
                onSelectClass={(c) => setSelectedClassId(c.id)}
              />
            </div>
          )}

          {currentTab === 'accounts' && (
            <div className="w-full max-w-7xl mx-auto">
              <AccountsView teachers={teachers} onAddTeacher={handleAddTeacher} />
            </div>
          )}

          {currentTab === 'textbooks' && (
            <div className="w-full max-w-7xl mx-auto">
              <TextbooksView />
            </div>
          )}

          {currentTab === 'documents' && (
            <div className="w-full max-w-7xl mx-auto p-6 bg-white border border-[#c3c6d7] rounded-xl shadow-xs">
              <h2 className="text-xl font-bold text-[#131b2e] mb-2">Kho Tài liệu Học vụ & Đề thi Khối 10</h2>
              <p className="text-sm text-[#434655] mb-4">Lưu trữ đề thi mẫu, phân phối chương trình và tài liệu tập huấn GDPT 2018.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg bg-[#faf8ff] flex items-center gap-3">
                  <span className="material-symbols-outlined text-3xl text-[#004ac6]">folder_zip</span>
                  <div>
                    <h4 className="font-semibold text-sm">Bộ Đề kiểm tra Giữa kỳ I môn Toán 10 (KNTT)</h4>
                    <p className="text-xs text-[#434655]">File .pdf • 14MB • Đăng ngày 28/08/2023</p>
                  </div>
                </div>
                <div className="p-4 border rounded-lg bg-[#faf8ff] flex items-center gap-3">
                  <span className="material-symbols-outlined text-3xl text-[#004ac6]">picture_as_pdf</span>
                  <div>
                    <h4 className="font-semibold text-sm">Phân phối Chương trình môn Ngữ văn Khối 10</h4>
                    <p className="text-xs text-[#434655]">File .pdf • 4.2MB • Đăng ngày 20/08/2023</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentTab === 'topics' && (
            <div className="w-full max-w-7xl mx-auto p-6 bg-white border border-[#c3c6d7] rounded-xl shadow-xs">
              <h2 className="text-xl font-bold text-[#131b2e] mb-2">Chuyên đề Học tập Tự chọn Khối 10</h2>
              <p className="text-sm text-[#434655] mb-4">Danh sách chuyên đề học tập lựa chọn theo định hướng nghề nghiệp THPT.</p>
              <ul className="space-y-2 text-sm text-[#131b2e]">
                <li className="p-3 border rounded bg-[#faf8ff] font-medium">Chuyên đề 10.1: Phương pháp giải bài toán Thực tế bằng Mệnh đề & Tập hợp</li>
                <li className="p-3 border rounded bg-[#faf8ff] font-medium">Chuyên đề 10.2: Ứng dụng Tam thức bậc hai trong Vật lý & Kỹ thuật</li>
                <li className="p-3 border rounded bg-[#faf8ff] font-medium">Chuyên đề 10.3: Hình học Tọa độ trong Mặt phẳng phẳng Oxy</li>
              </ul>
            </div>
          )}

          {currentTab === 'logs' && (
            <div className="w-full max-w-7xl mx-auto">
              <AuditLogsView />
            </div>
          )}

          {currentTab === 'settings' && (
            <div className="w-full max-w-4xl mx-auto p-6 bg-white border border-[#c3c6d7] rounded-xl shadow-xs space-y-4">
              <h2 className="text-xl font-bold text-[#131b2e] mb-2">Cài đặt Hệ thống Quản trị THPT</h2>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[#434655] font-semibold mb-1">Tên Trường THPT</label>
                  <input type="text" defaultValue="Trường THPT Chuyên Nguyễn Trãi" className="w-full h-9 px-3 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-[#434655] font-semibold mb-1">Năm học hiện tại</label>
                  <select defaultValue="2023-2024" className="w-full h-9 px-2 border rounded text-sm">
                    <option value="2023-2024">2023-2024</option>
                    <option value="2024-2025">2024-2025</option>
                  </select>
                </div>
                <div className="pt-3 border-t">
                  <button type="button" onClick={() => showToast('Đã lưu cấu hình cài đặt hệ thống!')} className="px-4 py-2 bg-[#004ac6] text-white rounded font-semibold">
                    Lưu cài đặt
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Detail Sliding Drawer (Active when selectedClassId is set and on 'classes' tab) */}
      {currentTab === 'classes' && selectedClass && (
        <ClassDetailPanel
          schoolClass={selectedClass}
          students={currentClassStudents}
          tasks={currentClassTasks}
          teachers={teachers}
          onClose={() => setSelectedClassId(null)}
          onOpenAddStudent={() => setIsAddStudentOpen(true)}
          onOpenImportExcel={() => setIsImportExcelOpen(true)}
          onOpenAddTask={() => setIsAddTaskOpen(true)}
          onToggleStudentStatus={handleToggleStudentStatus}
          onToggleTaskStatus={handleToggleTaskStatus}
          onUpdateClass={handleUpdateClass}
          onArchiveClass={handleArchiveClass}
          onDeleteStudent={handleDeleteStudent}
        />
      )}

      {/* Modals */}
      <CreateClassModal
        isOpen={isCreateClassOpen}
        onClose={() => setIsCreateClassOpen(false)}
        onSave={handleCreateClass}
        teachers={teachers}
      />

      <AddStudentModal
        isOpen={isAddStudentOpen}
        classNameTitle={selectedClass?.name || ''}
        onClose={() => setIsAddStudentOpen(false)}
        onSave={handleAddStudent}
        nextStt={currentClassStudents.length + 1}
      />

      <ImportExcelModal
        isOpen={isImportExcelOpen}
        classNameTitle={selectedClass?.name}
        onClose={() => setIsImportExcelOpen(false)}
        onImportDone={handleImportExcelDone}
      />

      <AssignTeacherModal
        isOpen={isAssignTeacherOpen}
        schoolClass={assignTargetClass}
        teachers={teachers}
        onClose={() => {
          setIsAssignTeacherOpen(false);
          setAssignTargetClass(null);
        }}
        onSave={handleAssignTeacher}
      />

      <AddTaskModal
        isOpen={isAddTaskOpen}
        classNameTitle={selectedClass?.name || ''}
        totalStudents={selectedClass?.studentCount || 40}
        onClose={() => setIsAddTaskOpen(false)}
        onSave={handleAddTask}
      />

      {/* Toast Notification */}
      <NotificationToast
        message={toastMessage}
        onClose={() => setToastMessage(null)}
      />
    </div>
  );
}
