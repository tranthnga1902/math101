import React, { useState } from 'react';
import { SchoolClass } from '../types';

interface ClassListTableProps {
  classes: SchoolClass[];
  selectedClassId?: string;
  onSelectClass: (schoolClass: SchoolClass) => void;
  onOpenCreateClass: () => void;
  onOpenImportStudents: () => void;
  onAssignTeacher: (schoolClass: SchoolClass) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const ClassListTable: React.FC<ClassListTableProps> = ({
  classes,
  selectedClassId,
  onSelectClass,
  onOpenCreateClass,
  onOpenImportStudents,
  onAssignTeacher,
  searchQuery,
  onSearchChange
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [actionMenuClassId, setActionMenuClassId] = useState<string | null>(null);

  // Filter logic
  const filteredClasses = classes.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.teacherName && c.teacherName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      c.academicYear.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ? true : c.status === statusFilter;

    const matchesYear =
      yearFilter === 'ALL' ? true : c.academicYear === yearFilter;

    return matchesSearch && matchesStatus && matchesYear;
  });

  return (
    <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
      {/* Page Header & Toolbar */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#131b2e] mb-1">
            Danh sách Lớp học
          </h2>
          <p className="text-sm text-[#434655]">
            Quản lý và theo dõi tiến độ các lớp khối 10.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onOpenImportStudents}
            className="h-10 px-4 rounded-lg border border-[#c3c6d7] bg-white text-[#131b2e] text-xs font-semibold hover:bg-[#e2e7ff] transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">
              upload_file
            </span>
            Import danh sách học sinh
          </button>
          <button
            type="button"
            onClick={onOpenCreateClass}
            className="h-10 px-4 rounded-lg bg-[#004ac6] text-white text-xs font-semibold hover:bg-[#2563eb] transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Tạo lớp
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="mb-4 flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 max-w-sm min-w-[200px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#434655] text-[18px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm kiếm lớp học, giáo viên..."
            className="h-10 w-full pl-9 pr-3 bg-white border border-[#c3c6d7] rounded-lg text-sm text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#0053db] focus:border-transparent"
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className={`h-10 px-3 rounded-lg border border-[#c3c6d7] bg-white text-[#131b2e] text-xs font-medium flex items-center gap-2 hover:bg-[#f2f3ff] transition-colors cursor-pointer ${
              statusFilter !== 'ALL' || yearFilter !== 'ALL'
                ? 'border-[#004ac6] text-[#004ac6] bg-[#f2f3ff]'
                : ''
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              filter_list
            </span>
            Lọc
            {(statusFilter !== 'ALL' || yearFilter !== 'ALL') && (
              <span className="w-2 h-2 rounded-full bg-[#004ac6]" />
            )}
          </button>

          {showFilterDropdown && (
            <div className="absolute left-0 mt-2 w-64 bg-white border border-[#c3c6d7] rounded-lg shadow-lg p-4 z-30 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#c3c6d7]">
                <span className="font-semibold text-xs text-[#131b2e]">
                  Bộ lọc lớp học
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('ALL');
                    setYearFilter('ALL');
                  }}
                  className="text-[11px] text-[#004ac6] hover:underline"
                >
                  Đặt lại
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[#434655] font-medium mb-1">
                    Trạng thái
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full h-8 px-2 border border-[#c3c6d7] rounded bg-white"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="ĐANG HỌC">Đang học</option>
                    <option value="CHỜ K/G">Chờ khai giảng</option>
                    <option value="ĐÃ LƯU TRỮ">Đã lưu trữ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#434655] font-medium mb-1">
                    Năm học
                  </label>
                  <select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="w-full h-8 px-2 border border-[#c3c6d7] rounded bg-white"
                  >
                    <option value="ALL">Tất cả năm học</option>
                    <option value="2023-2024">2023-2024</option>
                    <option value="2024-2025">2024-2025</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 pt-2 border-t border-[#c3c6d7] flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowFilterDropdown(false)}
                  className="px-3 py-1 bg-[#004ac6] text-white text-xs rounded hover:bg-[#2563eb]"
                >
                  Áp dụng
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Data Table Container */}
      <div className="border border-[#c3c6d7] rounded-lg bg-white overflow-hidden flex-1 flex flex-col shadow-xs">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[#f2f3ff] border-b border-[#c3c6d7]">
                <th className="h-11 px-4 text-xs text-[#434655] font-semibold whitespace-nowrap">
                  Tên lớp
                </th>
                <th className="h-11 px-4 text-xs text-[#434655] font-semibold whitespace-nowrap">
                  Năm học
                </th>
                <th className="h-11 px-4 text-xs text-[#434655] font-semibold whitespace-nowrap">
                  GV Phụ trách
                </th>
                <th className="h-11 px-4 text-xs text-[#434655] font-semibold whitespace-nowrap text-right">
                  Sĩ số
                </th>
                <th className="h-11 px-4 text-xs text-[#434655] font-semibold whitespace-nowrap text-right">
                  NV đang mở
                </th>
                <th className="h-11 px-4 text-xs text-[#434655] font-semibold whitespace-nowrap w-48">
                  Tiến độ
                </th>
                <th className="h-11 px-4 text-xs text-[#434655] font-semibold whitespace-nowrap">
                  Trạng thái
                </th>
                <th className="h-11 px-4 text-xs text-[#434655] font-semibold whitespace-nowrap text-center">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="text-sm text-[#131b2e]">
              {filteredClasses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#434655]">
                    <span className="material-symbols-outlined text-4xl text-[#c3c6d7] mb-2 block">
                      search_off
                    </span>
                    Không tìm thấy lớp học phù hợp.
                  </td>
                </tr>
              ) : (
                filteredClasses.map((item) => {
                  const isSelected = item.id === selectedClassId;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => onSelectClass(item)}
                      className={`h-11 border-b border-[#c3c6d7] transition-colors cursor-pointer relative ${
                        isSelected
                          ? 'bg-[#e2e7ff] hover:bg-[#dae2fd]'
                          : 'hover:bg-[#faf8ff]'
                      }`}
                    >
                      <td className="px-4 font-semibold text-[#004ac6]">
                        {item.name}
                      </td>
                      <td className="px-4">{item.academicYear}</td>
                      <td className="px-4">
                        {item.teacherName ? (
                          <span>{item.teacherName}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAssignTeacher(item);
                            }}
                            className="inline-flex items-center px-2 h-6 rounded border border-[#973400] text-[#973400] hover:bg-[#ffede7] hover:text-[#c04400] text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px] mr-1">
                              person_add
                            </span>
                            Gán giáo viên
                          </button>
                        )}
                      </td>
                      <td className="px-4 text-right">{item.studentCount}</td>
                      <td className="px-4 text-right">{item.openTasksCount}</td>
                      <td className="px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-full bg-[#e2e7ff] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#004ac6] transition-all duration-300"
                              style={{ width: `${item.progressPercent}%` }}
                            />
                          </div>
                          <span className="text-xs text-[#434655] font-medium w-8 text-right">
                            {item.progressPercent}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4">
                        {item.status === 'ĐANG HỌC' && (
                          <span className="inline-flex items-center px-2 h-6 rounded bg-[#7cf994] text-[#007230] text-[11px] font-semibold tracking-wide">
                            ĐANG HỌC
                          </span>
                        )}
                        {item.status === 'CHỜ K/G' && (
                          <span className="inline-flex items-center px-2 h-6 rounded bg-[#dae2fd] text-[#434655] text-[11px] font-semibold tracking-wide">
                            CHỜ K/G
                          </span>
                        )}
                        {item.status === 'ĐÃ LƯU TRỮ' && (
                          <span className="inline-flex items-center px-2 h-6 rounded bg-[#ffdad6] text-[#93000a] text-[11px] font-semibold tracking-wide">
                            ĐÃ LƯU TRỮ
                          </span>
                        )}
                      </td>
                      <td className="px-4 text-center relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenuClassId(
                              actionMenuClassId === item.id ? null : item.id
                            );
                          }}
                          className="p-1 text-[#434655] hover:text-[#004ac6] hover:bg-white rounded transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            more_vert
                          </span>
                        </button>

                        {actionMenuClassId === item.id && (
                          <div
                            className="absolute right-4 top-8 w-44 bg-white border border-[#c3c6d7] rounded-lg shadow-lg py-1 z-40 text-left"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                onSelectClass(item);
                                setActionMenuClassId(null);
                              }}
                              className="w-full px-3 py-1.5 text-xs text-[#434655] hover:bg-[#f2f3ff] flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-[16px]">visibility</span>
                              Xem chi tiết
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onAssignTeacher(item);
                                setActionMenuClassId(null);
                              }}
                              className="w-full px-3 py-1.5 text-xs text-[#434655] hover:bg-[#f2f3ff] flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-[16px]">person_add</span>
                              Đổi GV phụ trách
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Selected row blue bar indicator */}
                      {isSelected && (
                        <td className="absolute right-0 top-0 bottom-0 w-1 bg-[#004ac6]" />
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="h-12 border-t border-[#c3c6d7] bg-white flex items-center justify-between px-4">
          <span className="text-xs text-[#434655]">
            Hiển thị 1-{filteredClasses.length} trên {classes.length} lớp
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled
              className="p-1 rounded text-[#434655] opacity-40 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[20px]">
                chevron_left
              </span>
            </button>
            <button
              type="button"
              className="p-1 rounded text-[#434655] hover:bg-[#f2f3ff] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">
                chevron_right
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
