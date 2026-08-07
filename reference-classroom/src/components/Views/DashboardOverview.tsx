import React from 'react';
import { SchoolClass, Teacher } from '../../types';

interface DashboardOverviewProps {
  classes: SchoolClass[];
  teachers: Teacher[];
  onSelectTab: (tab: any) => void;
  onSelectClass: (c: SchoolClass) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  classes,
  teachers,
  onSelectTab,
  onSelectClass
}) => {
  const activeClasses = classes.filter((c) => c.status === 'ĐANG HỌC');
  const pendingClasses = classes.filter((c) => c.status === 'CHỜ K/G');
  const totalStudents = classes.reduce((acc, c) => acc + c.studentCount, 0);
  const avgProgress = Math.round(
    classes.reduce((acc, c) => acc + c.progressPercent, 0) / (classes.length || 1)
  );

  return (
    <div className="space-y-6">
      {/* Top Welcome Header */}
      <div className="bg-gradient-to-r from-[#004ac6] to-[#2563eb] rounded-xl p-6 text-white shadow-md">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">
              Tổng quan Hệ thống Quản trị THPT
            </h2>
            <p className="text-sm text-[#eeefff] opacity-90">
              Năm học 2023-2024 • Khối 10 • Cập nhật tiến độ học tập và quản lý lớp chuyên sâu.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelectTab('classes')}
            className="px-4 py-2.5 bg-white text-[#004ac6] font-semibold text-xs rounded-lg shadow hover:bg-[#f2f3ff] transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">school</span>
            Quản lý Lớp học ngay
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-[#c3c6d7] shadow-xs">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-[#434655] font-semibold">Tổng số lớp học</span>
            <span className="p-2 rounded-lg bg-[#e2e7ff] text-[#004ac6] material-symbols-outlined text-[20px]">
              school
            </span>
          </div>
          <div className="text-3xl font-bold text-[#131b2e]">{classes.length}</div>
          <p className="text-[11px] text-[#006e2d] font-semibold mt-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">trending_up</span>
            {activeClasses.length} lớp đang học, {pendingClasses.length} lớp chờ K/G
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#c3c6d7] shadow-xs">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-[#434655] font-semibold">Tổng số học sinh</span>
            <span className="p-2 rounded-lg bg-[#7cf994]/30 text-[#007230] material-symbols-outlined text-[20px]">
              group
            </span>
          </div>
          <div className="text-3xl font-bold text-[#131b2e]">{totalStudents}</div>
          <p className="text-[11px] text-[#434655] mt-2">
            Trung bình {Math.round(totalStudents / (classes.length || 1))} học sinh / lớp
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#c3c6d7] shadow-xs">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-[#434655] font-semibold">Tiến độ chương trình</span>
            <span className="p-2 rounded-lg bg-[#ffdbce] text-[#973400] material-symbols-outlined text-[20px]">
              analytics
            </span>
          </div>
          <div className="text-3xl font-bold text-[#131b2e]">{avgProgress}%</div>
          <div className="mt-2 h-1.5 w-full bg-[#e2e7ff] rounded-full overflow-hidden">
            <div className="h-full bg-[#004ac6]" style={{ width: `${avgProgress}%` }} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#c3c6d7] shadow-xs">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-[#434655] font-semibold">Đội ngũ giáo viên</span>
            <span className="p-2 rounded-lg bg-[#dae2fd] text-[#0053db] material-symbols-outlined text-[20px]">
              badge
            </span>
          </div>
          <div className="text-3xl font-bold text-[#131b2e]">{teachers.length}</div>
          <p className="text-[11px] text-[#434655] mt-2">
            Đã phân công chủ nhiệm: {teachers.filter((t) => t.assignedClassesCount > 0).length} GV
          </p>
        </div>
      </div>

      {/* Quick Class Grid */}
      <div className="bg-white p-6 rounded-xl border border-[#c3c6d7] shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-base text-[#131b2e]">
            Tiến độ các lớp Khối 10
          </h3>
          <button
            type="button"
            onClick={() => onSelectTab('classes')}
            className="text-xs font-semibold text-[#004ac6] hover:underline"
          >
            Xem tất cả {classes.length} lớp &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {classes.slice(0, 6).map((c) => (
            <div
              key={c.id}
              onClick={() => {
                onSelectTab('classes');
                onSelectClass(c);
              }}
              className="p-4 rounded-lg border border-[#c3c6d7] bg-[#faf8ff] hover:bg-[#e2e7ff]/40 hover:border-[#004ac6] transition-all cursor-pointer"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-lg text-[#004ac6]">Lớp {c.name}</span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                    c.status === 'ĐANG HỌC'
                      ? 'bg-[#7cf994] text-[#007230]'
                      : 'bg-[#dae2fd] text-[#434655]'
                  }`}
                >
                  {c.status}
                </span>
              </div>
              <p className="text-xs text-[#434655] mb-2">
                GV: {c.teacherName || 'Chưa gán'} • Sĩ số: {c.studentCount}
              </p>
              <div className="flex items-center gap-2">
                <div className="h-2 w-full bg-[#e2e7ff] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#004ac6]"
                    style={{ width: `${c.progressPercent}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-[#131b2e]">
                  {c.progressPercent}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
