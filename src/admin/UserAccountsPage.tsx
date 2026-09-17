import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  AlertTriangle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, 
  Download, GraduationCap, KeyRound, LockKeyhole, MoreHorizontal, 
  Pencil, Plus, Search, ShieldCheck, Trash2, Upload, User, Users, UserX, X, Calendar
} from "lucide-react";
import { 
  confirmUserImport, createUser, deleteUser, disableUser, downloadUserImportTemplate, 
  getAdminStats, getClasses, getEnrollments, getGrades, getMetadata, getUsersPage, 
  resetUserPassword, setUserLocked, updateUser, uploadUserImport, 
  type AuthSession, type MetadataOption, type UserAccount, type UserAccountInput, type UserImportPreview 
} from "../api";
import type { components } from "../api/types";
import { Button } from "../components/ui/button";
import { AdminDrawer } from "./components/AdminDrawer";
import { AdminModal } from "./components/AdminModal";

type UserStatus = components["schemas"]["UserRequest"]["status"];
type ImportRow = components["schemas"]["UserImportRow"];

const fallbackRoles: MetadataOption[] = [
  { value: "ADMIN", label: "Quản trị viên" },
  { value: "TEACHER", label: "Giáo viên" },
  { value: "STUDENT", label: "Học sinh" }
];

const fallbackStatuses: MetadataOption[] = [
  { value: "ACTIVE", label: "Đang hoạt động" },
  { value: "LOCKED", label: "Tạm khóa" },
  { value: "INACTIVE", label: "Tạm ngưng" },
  { value: "ARCHIVED", label: "Đã xóa" }
];

const emptyForm = (roles: MetadataOption[], statuses: MetadataOption[]): UserAccountInput => ({
  username: "",
  email: "",
  fullName: "",
  phone: "",
  roleCode: roles[0]?.value ?? "STUDENT",
  status: (statuses[0]?.value ?? "ACTIVE") as UserStatus,
  password: ""
});

const EMPTY_USER_CLASS_MAP = new Map<number, { classIds: number[]; classNames: string[] }>();

const formatError = (reason: unknown, fallback: string) =>
  reason instanceof Error ? reason.message : fallback;

const USERS_QUERY_KEY = "admin-users-page";

export function UserAccountsPage({ session }: { session: AuthSession }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [targetPageInput, setTargetPageInput] = useState("1");
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);

  // Bộ lọc
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedClassAssignment, setSelectedClassAssignment] = useState<"" | "UNASSIGNED" | "ASSIGNED">("");
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState("");

  // Chọn dòng
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  // Menu 3 chấm theo từng dòng
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  // Drawers & modals
  const [form, setForm] = useState<UserAccountInput>(() => emptyForm(fallbackRoles, fallbackStatuses));
  const [editing, setEditing] = useState<UserAccount | null>(null);
  const [selected, setSelected] = useState<UserAccount | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Đóng action menu khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // Đồng bộ số trang trong ô "Đến trang"
  useEffect(() => {
    setTargetPageInput(String(page + 1));
  }, [page]);

  // Metadata & thống kê
  const metadataQuery = useQuery({
    queryKey: ["admin-metadata-roles-statuses", session.accessToken],
    queryFn: () => getMetadata(session)
  });
  const roles = metadataQuery.data?.roles.length ? metadataQuery.data.roles : fallbackRoles;
  const statuses = metadataQuery.data?.userStatuses.length ? metadataQuery.data.userStatuses : fallbackStatuses;
  const roleLabels = useMemo(() => Object.fromEntries(roles.map(x => [x.value, x.label])), [roles]);
  const statusLabels = useMemo(() => Object.fromEntries(statuses.map(x => [x.value, x.label])), [statuses]);

  const statsQuery = useQuery({
    queryKey: ["admin-stats", session.accessToken],
    queryFn: () => getAdminStats(session)
  });
  const adminStats = statsQuery.data ?? null;

  // Lấy danh sách lớp học và phân lớp của toàn bộ học sinh / giáo viên
  const enrollmentsQuery = useQuery({
    queryKey: ["admin-class-enrollments", session.accessToken],
    queryFn: async () => {
      const classes = await getClasses(session);
      const [studentLinks, teacherLinks] = await Promise.all([
        Promise.all(classes.map(async c => ({
          classId: c.id,
          className: c.name,
          items: await getEnrollments(session, "class-students", c.id)
        }))),
        Promise.all(classes.map(async c => ({
          classId: c.id,
          className: c.name,
          items: await getEnrollments(session, "class-teachers", c.id)
        })))
      ]);

      const userClassMap = new Map<number, { classIds: number[]; classNames: string[] }>();
      const classStudentCount: Record<number, number> = {};
      const classTeacherCount: Record<number, number> = {};

      classes.forEach(c => {
        classStudentCount[c.id] = 0;
        classTeacherCount[c.id] = 0;
      });

      studentLinks.forEach(({ classId, className, items }) => {
        classStudentCount[classId] = items.length;
        items.forEach(item => {
          if (!item.userId) return;
          const entry = userClassMap.get(item.userId) || { classIds: [], classNames: [] };
          if (!entry.classIds.includes(classId)) {
            entry.classIds.push(classId);
            entry.classNames.push(className);
          }
          userClassMap.set(item.userId, entry);
        });
      });

      teacherLinks.forEach(({ classId, className, items }) => {
        classTeacherCount[classId] = items.length;
        items.forEach(item => {
          if (!item.userId) return;
          const entry = userClassMap.get(item.userId) || { classIds: [], classNames: [] };
          if (!entry.classIds.includes(classId)) {
            entry.classIds.push(classId);
            entry.classNames.push(className);
          }
          userClassMap.set(item.userId, entry);
        });
      });

      return { classes, userClassMap, classStudentCount, classTeacherCount };
    },
    staleTime: 60_000
  });

  const classes = enrollmentsQuery.data?.classes ?? [];
  const userClassMap = enrollmentsQuery.data?.userClassMap ?? EMPTY_USER_CLASS_MAP;

  // Lấy dữ liệu người dùng từ backend
  const usersQuery = useQuery({
    queryKey: [USERS_QUERY_KEY, session.accessToken],
    queryFn: () => getUsersPage(session, { page: 0, size: 500 })
  });

  const allUsers = (usersQuery.data?.content ?? []) as UserAccount[];
  const loading = usersQuery.isLoading || enrollmentsQuery.isLoading;

  // Thống kê động và đếm số lượng cho từng bộ lọc
  const counts = useMemo(() => {
    const totalUsers = allUsers.length || (adminStats?.totalUsers ?? 64);
    const students = allUsers.filter(u => u.roleCode === "STUDENT").length || (adminStats?.students ?? 51);
    const teachers = allUsers.filter(u => u.roleCode === "TEACHER").length || (adminStats?.teachers ?? 11);
    const admins = allUsers.filter(u => u.roleCode === "ADMIN").length || (adminStats ? Math.max(0, adminStats.totalUsers - adminStats.teachers - adminStats.students) : 2);

    // Học sinh chưa phân lớp
    const unassignedStudents = allUsers.filter(
      u => u.roleCode === "STUDENT" && (!userClassMap.has(u.id) || userClassMap.get(u.id)!.classIds.length === 0)
    ).length;

    // Số lượng chưa phân lớp & đã phân lớp (tùy theo vai trò đang chọn)
    let baseList = allUsers;
    if (selectedRole) {
      baseList = allUsers.filter(u => u.roleCode === selectedRole);
    }
    const unassignedCount = baseList.filter(
      u => !userClassMap.has(u.id) || userClassMap.get(u.id)!.classIds.length === 0
    ).length;
    const assignedCount = baseList.filter(
      u => userClassMap.has(u.id) && userClassMap.get(u.id)!.classIds.length > 0
    ).length;

    // Đếm theo từng lớp cụ thể
    const classCountMap: Record<number, number> = {};
    classes.forEach(c => {
      classCountMap[c.id] = allUsers.filter(
        u => (!selectedRole || u.roleCode === selectedRole) && userClassMap.get(u.id)?.classIds.includes(c.id)
      ).length;
    });

    return {
      totalUsers,
      students,
      teachers,
      admins,
      unassignedStudents,
      unassignedCount,
      assignedCount,
      classCountMap
    };
  }, [allUsers, adminStats, userClassMap, selectedRole, classes]);

  const invalidateUsers = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] }),
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-class-enrollments"] })
    ]);
  };

  // Mutations
  const saveMutation = useMutation({
    mutationFn: (payload: { id?: number; input: UserAccountInput }) =>
      payload.id ? updateUser(session, payload.id, payload.input) : createUser(session, payload.input),
    onSuccess: () => { setPanelOpen(false); void invalidateUsers(); },
  });
  const lockMutation = useMutation({
    mutationFn: (row: UserAccount) => setUserLocked(session, row.id, row.status !== "LOCKED"),
    onSuccess: () => void invalidateUsers(),
  });
  const disableMutation = useMutation({
    mutationFn: (row: UserAccount) => disableUser(session, row.id),
    onSuccess: () => void invalidateUsers(),
  });
  const deleteMutation = useMutation({
    mutationFn: (row: UserAccount) => deleteUser(session, row.id),
    onSuccess: () => { setSelected(null); void invalidateUsers(); }
  });
  const resetMutation = useMutation({
    mutationFn: ({ row, password }: { row: UserAccount; password: string }) =>
      resetUserPassword(session, row.id, password)
  });

  const error = usersQuery.isError ? formatError(usersQuery.error, "Không thể tải danh sách tài khoản")
    : saveMutation.isError ? formatError(saveMutation.error, "Không thể lưu tài khoản")
    : lockMutation.isError ? formatError(lockMutation.error, "Không thể đổi trạng thái")
    : disableMutation.isError ? formatError(disableMutation.error, "Không thể vô hiệu hóa")
    : deleteMutation.isError ? formatError(deleteMutation.error, "Không thể xóa tài khoản")
    : resetMutation.isError ? formatError(resetMutation.error, "Không thể đặt lại mật khẩu")
    : "";

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(roles, statuses));
    setPanelOpen(true);
  };

  const openEdit = (row: UserAccount) => {
    setEditing(row);
    setForm({
      username: row.username,
      email: row.email,
      fullName: row.fullName,
      phone: row.phone ?? "",
      roleCode: row.roleCode,
      status: row.status,
      password: ""
    });
    setPanelOpen(true);
    setActiveMenuId(null);
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    saveMutation.mutate({ id: editing?.id, input: { ...form, password: form.password || undefined } });
  };

  const toggleLock = (row: UserAccount) => {
    lockMutation.mutate(row);
    setActiveMenuId(null);
  };

  const disable = (row: UserAccount) => {
    setActiveMenuId(null);
    if (!confirm(`Vô hiệu hóa tài khoản ${row.username}?`)) return;
    disableMutation.mutate(row);
  };

  const remove = (row: UserAccount) => {
    setActiveMenuId(null);
    if (!confirm(`Xóa tài khoản ${row.username}? Thao tác này không thể hoàn tác.`)) return;
    deleteMutation.mutate(row);
  };

  const resetPassword = (row: UserAccount) => {
    setActiveMenuId(null);
    const password = prompt(`Nhập mật khẩu mới cho @${row.username} (tối thiểu 8 ký tự):`);
    if (!password) return;
    if (password.length < 8) {
      alert("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }
    resetMutation.mutate({ row, password }, {
      onSuccess: () => alert("Đã đặt lại mật khẩu thành công.")
    });
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  // Lọc dữ liệu đa tiêu chí
  const filteredUsers = useMemo(() => {
    return allUsers.filter(acc => {
      // 1. Tìm kiếm theo tên, tài khoản, email, số điện thoại hoặc tên lớp
      if (debouncedSearch.trim()) {
        const term = debouncedSearch.trim().toLowerCase();
        const userClasses = userClassMap.get(acc.id);
        const classNamesStr = userClasses?.classNames.join(" ").toLowerCase() ?? "";
        const match =
          acc.fullName.toLowerCase().includes(term) ||
          acc.username.toLowerCase().includes(term) ||
          acc.email.toLowerCase().includes(term) ||
          (Boolean(acc.phone) && acc.phone!.includes(term)) ||
          classNamesStr.includes(term);
        if (!match) return false;
      }

      // 2. Lọc theo vai trò
      if (selectedRole && acc.roleCode !== selectedRole) {
        return false;
      }

      // 3. Lọc theo trạng thái
      if (selectedStatus && acc.status !== selectedStatus) {
        return false;
      }

      // 4. Lọc theo tình trạng phân lớp
      if (selectedClassAssignment === "UNASSIGNED") {
        const userClasses = userClassMap.get(acc.id);
        if (userClasses && userClasses.classIds.length > 0) return false;
      } else if (selectedClassAssignment === "ASSIGNED") {
        const userClasses = userClassMap.get(acc.id);
        if (!userClasses || userClasses.classIds.length === 0) return false;
      }

      // 5. Lọc theo lớp cụ thể
      if (selectedClassId != null) {
        const userClasses = userClassMap.get(acc.id);
        if (!userClasses || !userClasses.classIds.includes(selectedClassId)) return false;
      }

      // 6. Lọc theo khoảng ngày tạo
      if (dateRange.trim()) {
        const term = dateRange.trim().toLowerCase();
        const formatted = formatDate(acc.createdAt).toLowerCase();
        if (!formatted.includes(term) && !acc.createdAt?.toLowerCase().includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [allUsers, debouncedSearch, selectedRole, selectedStatus, selectedClassAssignment, selectedClassId, dateRange, userClassMap]);

  const totalElements = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / pageSize));
  const safePage = Math.min(page, Math.max(0, totalPages - 1));

  const rows = useMemo(() => {
    return filteredUsers.slice(safePage * pageSize, (safePage + 1) * pageSize);
  }, [filteredUsers, safePage, pageSize]);

  const clearFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setSelectedRole("");
    setSelectedStatus("");
    setSelectedClassAssignment("");
    setSelectedClassId(null);
    setDateRange("");
    setPage(0);
  };

  const handleClassAssignmentToggle = (type: "UNASSIGNED" | "ASSIGNED") => {
    setSelectedClassAssignment(prev => prev === type ? "" : type);
    setSelectedClassId(null);
    setPage(0);
  };

  const handleSpecificClassToggle = (classId: number) => {
    setSelectedClassId(prev => prev === classId ? null : classId);
    setSelectedClassAssignment("");
    setPage(0);
  };

  // Selection
  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(rows.map(d => d.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleRoleToggle = (code: string) => {
    setSelectedRole(prev => prev === code ? "" : code);
    setPage(0);
  };

  const handleStatusToggle = (st: string) => {
    setSelectedStatus(prev => prev === st ? "" : st);
    setPage(0);
  };

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(targetPageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setPage(p - 1);
    }
  };

  // Tính khoảng hiển thị
  const startItem = totalElements > 0 ? safePage * pageSize + 1 : 0;
  const endItem = Math.min((safePage + 1) * pageSize, totalElements);

  // Tạo danh sách số trang có ellipsis
  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) pages.push(i);
    } else {
      if (safePage <= 3) {
        for (let i = 0; i < 5; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages - 1);
      } else if (safePage >= totalPages - 4) {
        pages.push(0);
        pages.push("...");
        for (let i = totalPages - 5; i < totalPages; i++) pages.push(i);
      } else {
        pages.push(0);
        pages.push("...");
        pages.push(safePage - 1);
        pages.push(safePage);
        pages.push(safePage + 1);
        pages.push("...");
        pages.push(totalPages - 1);
      }
    }
    return pages;
  };

  return (
    <div className="flex-1 min-h-0 h-full w-full flex flex-col overflow-hidden bg-slate-50 font-sans text-gray-900">
      
      {/* 1. SLIM COMPACT HEADER */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-gray-200 shrink-0 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-none">Tài khoản</h1>
          <span className="text-xs text-gray-300 hidden sm:inline">|</span>
          <p className="text-xs text-gray-500 m-0 hidden md:inline truncate">
            Quản lý người dùng, phân quyền và trạng thái truy cập hệ thống
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button 
            type="button"
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg shadow-2xs text-xs font-medium hover:bg-gray-50 transition-colors text-gray-700 cursor-pointer"
          >
            <Upload size={14} /> <span className="hidden sm:inline">Import</span> Excel
          </button>
          <button 
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#176b50] text-white rounded-lg shadow-2xs text-xs font-medium hover:bg-[#11543e] transition-colors cursor-pointer"
          >
            <Plus size={14} /> Thêm tài khoản
          </button>
        </div>
      </div>

      {error && (
        <div className="shrink-0 mx-5 mt-2 p-2 rounded-lg bg-red-50 text-red-700 text-xs flex items-center justify-between border border-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => void usersQuery.refetch()}>Thử lại</Button>
        </div>
      )}

      {/* 2. FIXED COMPACT STATS ROW */}
      <div className="px-5 py-2 bg-white/90 border-b border-gray-200 shrink-0 backdrop-blur-xs">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <StatCard 
            icon={<Users className="text-blue-600" size={16} />} 
            count={counts.totalUsers} 
            label="Tổng tài khoản" 
            bgIcon="bg-blue-50" 
            active={!selectedRole && !selectedClassAssignment && !selectedClassId}
            onClick={() => {
              setSelectedRole("");
              setSelectedClassAssignment("");
              setSelectedClassId(null);
              setPage(0);
            }}
          />
          <StatCard 
            icon={<User className="text-teal-700" size={16} />} 
            count={counts.students} 
            label="Học sinh" 
            bgIcon="bg-teal-50" 
            active={selectedRole === "STUDENT" && !selectedClassAssignment && !selectedClassId}
            onClick={() => {
              setSelectedRole(r => r === "STUDENT" ? "" : "STUDENT");
              setSelectedClassAssignment("");
              setSelectedClassId(null);
              setPage(0);
            }}
          />
          <StatCard 
            icon={<UserX className="text-amber-600" size={16} />} 
            count={counts.unassignedStudents} 
            label="HS chưa phân lớp" 
            bgIcon="bg-amber-50" 
            active={selectedRole === "STUDENT" && selectedClassAssignment === "UNASSIGNED"}
            onClick={() => {
              if (selectedRole === "STUDENT" && selectedClassAssignment === "UNASSIGNED") {
                setSelectedRole("");
                setSelectedClassAssignment("");
              } else {
                setSelectedRole("STUDENT");
                setSelectedClassAssignment("UNASSIGNED");
              }
              setSelectedClassId(null);
              setPage(0);
            }}
          />
          <StatCard 
            icon={<GraduationCap className="text-orange-600" size={16} />} 
            count={counts.teachers} 
            label="Giáo viên" 
            bgIcon="bg-orange-50" 
            active={selectedRole === "TEACHER" && !selectedClassAssignment && !selectedClassId}
            onClick={() => {
              setSelectedRole(r => r === "TEACHER" ? "" : "TEACHER");
              setSelectedClassAssignment("");
              setSelectedClassId(null);
              setPage(0);
            }}
          />
          <StatCard 
            icon={<ShieldCheck className="text-purple-600" size={16} />} 
            count={counts.admins} 
            label="Quản trị viên" 
            bgIcon="bg-purple-50" 
            active={selectedRole === "ADMIN"}
            onClick={() => {
              setSelectedRole(r => r === "ADMIN" ? "" : "ADMIN");
              setSelectedClassAssignment("");
              setSelectedClassId(null);
              setPage(0);
            }}
          />
        </div>
      </div>

      {/* 3. MAIN BODY (Fixed Left Filter & Scrollable Right Table) */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3.5 p-3.5 sm:p-4 overflow-hidden bg-slate-50/60">
        
        {/* LEFT SIDEBAR: CỐ ĐỊNH BỘ LỌC */}
        {!isFilterCollapsed ? (
          <div className="w-full lg:w-60 shrink-0 bg-white rounded-xl shadow-xs border border-gray-200 p-3 flex flex-col h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-800 text-sm">Bộ lọc</h3>
              <button 
                type="button"
                onClick={() => setIsFilterCollapsed(true)}
                className="text-xs text-blue-600 hover:underline cursor-pointer"
              >
                Thu gọn &laquo;
              </button>
            </div>
            
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-2.5 top-2 text-gray-400" size={14} />
              <input 
                type="text" 
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm theo tên, email, SĐT..." 
                className="w-full pl-8 pr-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white transition-all"
              />
            </div>

            {/* Role Filter */}
            <FilterSection title="Vai trò">
              <CheckboxItem 
                label="Học sinh" 
                count={counts.students} 
                checked={selectedRole === "STUDENT"} 
                onChange={() => handleRoleToggle("STUDENT")} 
              />
              <CheckboxItem 
                label="Giáo viên" 
                count={counts.teachers} 
                checked={selectedRole === "TEACHER"} 
                onChange={() => handleRoleToggle("TEACHER")} 
              />
              <CheckboxItem 
                label="Quản trị viên" 
                count={counts.admins} 
                checked={selectedRole === "ADMIN"} 
                onChange={() => handleRoleToggle("ADMIN")} 
              />
            </FilterSection>

            {/* Class Assignment Filter */}
            <FilterSection title="Phân lớp">
              <CheckboxItem 
                label="Chưa phân lớp" 
                count={counts.unassignedCount} 
                checked={selectedClassAssignment === "UNASSIGNED"} 
                onChange={() => handleClassAssignmentToggle("UNASSIGNED")} 
              />
              <CheckboxItem 
                label="Đã phân lớp" 
                count={counts.assignedCount} 
                checked={selectedClassAssignment === "ASSIGNED"} 
                onChange={() => handleClassAssignmentToggle("ASSIGNED")} 
              />
              {classes.length > 0 && (
                <div className="pt-2 mt-1.5 border-t border-gray-100 space-y-1">
                  <div className="text-[10px] uppercase font-semibold text-gray-400 px-0.5">Theo lớp học</div>
                  {classes.map(c => (
                    <CheckboxItem
                      key={c.id}
                      label={c.name}
                      count={counts.classCountMap[c.id] ?? 0}
                      checked={selectedClassId === c.id}
                      onChange={() => handleSpecificClassToggle(c.id)}
                    />
                  ))}
                </div>
              )}
            </FilterSection>

            {/* Status Filter */}
            <FilterSection title="Trạng thái">
              <CheckboxItem 
                label="Đang hoạt động" 
                count={allUsers.filter(u => u.status === "ACTIVE").length || counts.totalUsers} 
                checked={selectedStatus === "ACTIVE"} 
                onChange={() => handleStatusToggle("ACTIVE")} 
              />
              <CheckboxItem 
                label="Tạm khóa" 
                count={allUsers.filter(u => u.status === "LOCKED").length} 
                checked={selectedStatus === "LOCKED"} 
                onChange={() => handleStatusToggle("LOCKED")} 
              />
            </FilterSection>

            {/* Date Filter */}
            <FilterSection title="Ngày tạo">
              <div className="relative">
                <input 
                  type="text" 
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  placeholder="Chọn khoảng ngày" 
                  className="w-full pl-2.5 pr-7 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <Calendar className="absolute right-2 top-2 text-gray-400 pointer-events-none" size={14} />
              </div>
            </FilterSection>

            <button 
              type="button"
              onClick={clearFilters}
              className="w-full py-1.5 mt-auto text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          </div>
        ) : (
          <div className="w-full lg:w-10 shrink-0 bg-white rounded-xl shadow-xs border border-gray-200 p-1.5 flex lg:flex-col items-center justify-center h-fit">
            <button
              type="button"
              onClick={() => setIsFilterCollapsed(false)}
              className="w-full py-2 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
              title="Mở rộng bộ lọc"
            >
              &raquo;
            </button>
          </div>
        )}

        {/* RIGHT MAIN TABLE AREA */}
        <div className="flex-1 min-w-0 bg-white rounded-xl shadow-xs border border-gray-200 flex flex-col h-full overflow-hidden">
          
          {/* Table Top Controls */}
          <div className="shrink-0 px-4 py-2.5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-800 text-sm">Danh sách tài khoản</h2>
              {selectedIds.length > 0 && (
                <span className="text-[11px] bg-teal-50 text-teal-700 font-medium px-2 py-0.5 rounded-full border border-teal-200">
                  Đã chọn {selectedIds.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>
                Hiển thị {startItem}–{endItem} của {totalElements} tài khoản
              </span>
              <div className="relative inline-block">
                <select
                  value={pageSize}
                  onChange={(e) => { 
                    setPageSize(Number(e.target.value)); 
                    setPage(0); 
                  }}
                  className="appearance-none flex items-center border border-gray-200 rounded-lg pl-2.5 pr-7 py-1 bg-gray-50 cursor-pointer text-xs font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value={10}>10 / trang</option>
                  <option value={20}>20 / trang</option>
                  <option value={50}>50 / trang</option>
                </select>
                <ChevronDown size={13} className="absolute right-2 top-2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Scrollable Table Area */}
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-xs z-10 border-b border-gray-200 shadow-2xs">
                <tr className="select-none">
                  <th className="py-2.5 px-3 w-10 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 accent-[#176b50] w-4 h-4 cursor-pointer" 
                      onChange={toggleSelectAll} 
                      checked={rows.length > 0 && rows.every(d => selectedIds.includes(d.id))} 
                    />
                  </th>
                  <th className="py-2.5 px-2.5 w-12 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    STT
                  </th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Họ và tên</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tài khoản</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center">Vai trò</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center">Lớp học</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center">Trạng thái</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center">Ngày tạo</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-xs text-gray-400">
                      Đang tải danh sách tài khoản…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-xs text-gray-400">
                      Không tìm thấy tài khoản phù hợp với điều kiện lọc.
                    </td>
                  </tr>
                ) : (
                  rows.map((acc, index) => (
                    <tr 
                      key={acc.id} 
                      onClick={() => setSelected(acc)}
                      className={`cursor-pointer transition-colors h-11 select-none ${
                        selected?.id === acc.id
                          ? "bg-teal-50/80 font-medium"
                          : selectedIds.includes(acc.id)
                            ? "bg-teal-50/30 hover:bg-teal-50/50"
                            : "hover:bg-slate-50"
                      }`}
                      title="Chạm để xem thông tin chi tiết"
                    >
                      <td className="py-1.5 px-3 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 accent-[#176b50] w-4 h-4 cursor-pointer"
                          checked={selectedIds.includes(acc.id)}
                          onChange={() => toggleSelect(acc.id)}
                        />
                      </td>
                      <td className="py-1.5 px-2.5 text-center align-middle text-xs text-gray-500 font-medium tabular-nums">
                        {safePage * pageSize + index + 1}
                      </td>
                      <td className="py-1.5 px-3 align-middle">
                        <div className="text-xs sm:text-sm font-semibold text-gray-900 group-hover:text-teal-700 leading-tight">
                          {acc.fullName}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5 leading-none">{acc.phone || "Chưa có số điện thoại"}</div>
                      </td>
                      <td className="py-1.5 px-3 align-middle">
                        <div className="text-xs sm:text-sm font-medium text-gray-900 leading-tight">@{acc.username.replace(/^@/, "")}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5 leading-none">{acc.email}</div>
                      </td>
                      <td className="py-1.5 px-3 text-center align-middle">
                        <RoleBadge role={roleLabels[acc.roleCode] ?? acc.roleCode} />
                      </td>
                      <td className="py-1.5 px-3 text-center align-middle">
                        {(() => {
                          const userClasses = userClassMap.get(acc.id);
                          const hasClass = Boolean(userClasses && userClasses.classNames.length > 0);
                          const classNamesStr = userClasses?.classNames.join(", ");

                          if (acc.roleCode === "STUDENT") {
                            if (hasClass) {
                              return (
                                <span 
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  title={classNamesStr}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  {classNamesStr}
                                </span>
                              );
                            }
                            return (
                              <span 
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/70"
                                title="Học sinh chưa được xếp vào lớp nào"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                Chưa phân lớp
                              </span>
                            );
                          }

                          if (acc.roleCode === "TEACHER") {
                            if (hasClass) {
                              return (
                                <span 
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                                  title={classNamesStr}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                  {classNamesStr}
                                </span>
                              );
                            }
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500">
                                Chưa phân công
                              </span>
                            );
                          }

                          return <span className="text-xs text-gray-400">—</span>;
                        })()}
                      </td>
                      <td className="py-1.5 px-3 text-center align-middle">
                        <StatusBadge status={statusLabels[acc.status] ?? acc.status} />
                      </td>
                      <td className="py-1.5 px-3 text-center align-middle text-xs text-gray-600 tabular-nums">
                        {formatDate(acc.createdAt)}
                      </td>
                      <td className="py-1.5 px-3 align-middle" onClick={(e) => e.stopPropagation()}>
                        <div className="relative flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button 
                            type="button"
                            onClick={() => openEdit(acc)}
                            className="p-1 text-gray-400 hover:text-teal-700 hover:bg-teal-50 rounded-md transition-colors cursor-pointer" 
                            title="Sửa"
                          >
                            <Pencil size={15} />
                          </button>
                          
                          <div className="relative">
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === acc.id ? null : acc.id);
                              }}
                              className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer" 
                              title="Thêm thao tác"
                            >
                              <MoreHorizontal size={15} />
                            </button>

                            {/* Dropdown Menu */}
                            {activeMenuId === acc.id && (
                              <div 
                                className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-30 text-left"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button 
                                  type="button"
                                  className="w-full text-left px-3.5 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 text-gray-700 cursor-pointer"
                                  onClick={() => { setSelected(acc); setActiveMenuId(null); }}
                                >
                                  <User size={14} /> Xem chi tiết
                                </button>
                                <button 
                                  type="button"
                                  className="w-full text-left px-3.5 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 text-gray-700 cursor-pointer"
                                  onClick={() => openEdit(acc)}
                                >
                                  <Pencil size={14} /> Chỉnh sửa
                                </button>
                                <button 
                                  type="button"
                                  className="w-full text-left px-3.5 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 text-gray-700 cursor-pointer"
                                  onClick={() => toggleLock(acc)}
                                >
                                  <LockKeyhole size={14} /> {acc.status === "LOCKED" ? "Mở khóa tài khoản" : "Khóa tài khoản"}
                                </button>
                                <button 
                                  type="button"
                                  className="w-full text-left px-3.5 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 text-gray-700 cursor-pointer"
                                  onClick={() => resetPassword(acc)}
                                >
                                  <KeyRound size={14} /> Đặt lại mật khẩu
                                </button>
                                <button 
                                  type="button"
                                  className="w-full text-left px-3.5 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 text-gray-700 cursor-pointer"
                                  onClick={() => disable(acc)}
                                >
                                  <LockKeyhole size={14} /> Vô hiệu hóa
                                </button>
                                <button 
                                  type="button"
                                  className="w-full text-left px-3.5 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer border-t border-gray-100"
                                  onClick={() => remove(acc)}
                                >
                                  <Trash2 size={14} /> Xóa tài khoản
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="shrink-0 px-4 py-2 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3 bg-white mt-auto">
            <div className="flex items-center gap-1">
              <button 
                type="button"
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Trang trước"
              >
                <ChevronLeft size={15} />
              </button>
              
              {/* Dynamic page numbers */}
              {getPageNumbers().map((item, idx) => {
                if (item === "...") {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-1.5 text-gray-400 text-xs select-none">
                      ...
                    </span>
                  );
                }
                const p = item as number;
                const isCurrent = p === page;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-medium flex items-center justify-center transition-colors cursor-pointer ${
                      isCurrent 
                        ? "bg-[#176b50] text-white" 
                        : "hover:bg-gray-100 text-gray-600"
                    }`}
                  >
                    {p + 1}
                  </button>
                );
              })}

              <button 
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Trang sau"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            <form onSubmit={handleJumpToPage} className="flex items-center gap-2 text-xs text-gray-600">
              <span>Đến trang</span>
              <input 
                type="text" 
                value={targetPageInput}
                onChange={(e) => setTargetPageInput(e.target.value)}
                className="w-10 px-1.5 py-1 border border-gray-200 rounded-lg text-center focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs" 
              />
              <button 
                type="submit"
                className="px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 font-medium text-xs transition-colors cursor-pointer"
              >
                Đi
              </button>
            </form>
          </div>

        </div>
      </div>

      {/* DRAWERS & MODALS */}
      <AdminDrawer open={!!selected} onClose={() => setSelected(null)} title="CHI TIẾT TÀI KHOẢN" eyebrow="TÀI KHOẢN" size="md">
        {selected && (
          <AccountDetail 
            session={session} 
            account={selected} 
            roleLabel={roleLabels[selected.roleCode] ?? selected.roleCode} 
            statusLabel={statusLabels[selected.status] ?? selected.status} 
            onClose={() => setSelected(null)} 
            onEdit={() => openEdit(selected)} 
            onLock={() => toggleLock(selected)} 
            onReset={() => resetPassword(selected)} 
            onDisable={() => disable(selected)} 
            onDelete={() => remove(selected)} 
          />
        )}
      </AdminDrawer>

      <AdminDrawer open={panelOpen} onClose={() => setPanelOpen(false)} title={editing ? editing.fullName : "Thêm tài khoản"} eyebrow={editing ? "CHỈNH SỬA" : "TẠO MỚI"} size="lg">
        {panelOpen && (
          <AccountPanel 
            form={form} 
            setForm={setForm} 
            editing={editing} 
            roles={roles} 
            statuses={statuses} 
            onClose={() => setPanelOpen(false)} 
            onSubmit={save} 
          />
        )}
      </AdminDrawer>

      <AdminModal open={importOpen} onClose={() => setImportOpen(false)} title="Nhập danh sách từ Excel" size="lg">
        {importOpen && (
          <ImportDialog 
            session={session} 
            roleLabels={roleLabels} 
            onClose={() => setImportOpen(false)} 
            onImported={invalidateUsers} 
          />
        )}
      </AdminModal>

    </div>
  );
}

// --- SUB COMPONENTS ---

const StatCard = ({ 
  icon, count, label, bgIcon, onClick, active 
}: { 
  icon: React.ReactNode; 
  count: number | string; 
  label: string; 
  bgIcon: string;
  onClick?: () => void;
  active?: boolean;
}) => (
  <div 
    onClick={onClick}
    className={`rounded-lg px-3 py-1.5 flex items-center gap-2.5 transition-all select-none ${
      onClick ? "cursor-pointer hover:shadow-xs" : ""
    } ${
      active 
        ? "bg-teal-50/70 border-2 border-[#176b50] shadow-xs" 
        : "bg-slate-50/70 border border-gray-200/80 hover:border-gray-300 hover:bg-white"
    }`}
  >
    <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${bgIcon}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <div className="text-base sm:text-lg font-bold text-gray-800 leading-none">{count}</div>
      <div className="text-[11px] text-gray-500 font-medium leading-none mt-1 truncate">{label}</div>
    </div>
  </div>
);

const FilterSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="mb-3.5">
    <h4 className="text-xs font-semibold text-gray-800 mb-1.5">{title}</h4>
    <div className="space-y-1.5">
      {children}
    </div>
  </div>
);

const CheckboxItem = ({ label, count, checked, onChange }: { label: string, count?: number, checked: boolean, onChange: () => void }) => (
  <label className="flex items-center justify-between group cursor-pointer select-none py-0.5">
    <div className="flex items-center gap-2">
      <input 
        type="checkbox" 
        checked={checked} 
        onChange={onChange}
        className="w-3.5 h-3.5 rounded border-gray-300 accent-[#176b50] cursor-pointer" 
      />
      <span className="text-xs text-gray-600 group-hover:text-gray-900 transition-colors">{label}</span>
    </div>
    {count !== undefined && <span className="text-[11px] text-gray-400 font-medium">{count}</span>}
  </label>
);

const roleNameMap: Record<string, string> = {
  STUDENT: "Học sinh",
  TEACHER: "Giáo viên",
  ADMIN: "Quản trị viên",
  "Học sinh": "Học sinh",
  "Giáo viên": "Giáo viên",
  "Quản trị viên": "Quản trị viên",
};

const RoleBadge = ({ role }: { role: string }) => {
  const normalized = roleNameMap[role] || role;
  const styles = {
    "Học sinh": "bg-blue-50 text-blue-600 border-blue-100",
    "Giáo viên": "bg-orange-50 text-orange-600 border-orange-100",
    "Quản trị viên": "bg-purple-50 text-purple-600 border-purple-100",
  }[normalized] || "bg-gray-100 text-gray-600 border-gray-200";

  return (
    <span className={`px-2 py-0.5 text-[11px] font-medium border rounded-md inline-block whitespace-nowrap ${styles}`}>
      {normalized}
    </span>
  );
};

const statusNameMap: Record<string, string> = {
  ACTIVE: "Đang hoạt động",
  LOCKED: "Tạm khóa",
  INACTIVE: "Tạm ngưng",
  ARCHIVED: "Đã xóa",
  "Đang hoạt động": "Đang hoạt động",
  "Tạm khóa": "Tạm khóa",
};

const StatusBadge = ({ status }: { status: string }) => {
  const normalized = statusNameMap[status] || status;
  const isAct = normalized === "Đang hoạt động";
  return (
    <span className={`px-2 py-0.5 text-[11px] font-medium border rounded-md inline-block whitespace-nowrap ${
      isAct ? "bg-teal-50 text-teal-700 border-teal-100" : "bg-red-50 text-red-600 border-red-100"
    }`}>
      {normalized}
    </span>
  );
};

// --- DRAWERS & MODALS IMPLEMENTATION ---

function AccountDetail({
  session, account, roleLabel, statusLabel, onClose, onEdit, onLock, onReset, onDisable, onDelete
}: {
  session: AuthSession;
  account: UserAccount;
  roleLabel: string;
  statusLabel: string;
  onClose: () => void;
  onEdit: () => void;
  onLock: () => void;
  onReset: () => void;
  onDisable: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const roleInfo = useQuery({
    queryKey: ["account-role-info", session.accessToken, account.id, account.roleCode],
    enabled: account.roleCode === "STUDENT" || account.roleCode === "TEACHER",
    queryFn: async () => {
      const [classes, grades] = await Promise.all([getClasses(session), getGrades(session)]);
      const kind = account.roleCode === "STUDENT" ? "class-students" : "class-teachers";
      const links = await Promise.all(classes.map(async classroom => ({
        classroom,
        items: await getEnrollments(session, kind, classroom.id)
      })));
      const assigned = links.filter(x => x.items.some(item => item.userId === account.id)).map(x => x.classroom);
      return { classes: assigned, grades: new Map(grades.map(grade => [grade.id, grade])) };
    }
  });

  const initial = account.fullName.trim().split(/\s+/).slice(-2).map(x => x[0]).join("").toUpperCase();
  const date = (value?: string) => value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value)) : "Chưa cập nhật";
  const current = new Date();
  const startYear = current.getMonth() >= 7 ? current.getFullYear() : current.getFullYear() - 1;
  const schoolYear = `${startYear}–${startYear + 1}`;
  const classes = roleInfo.data?.classes ?? [];
  const gradeNames = [...new Set(classes.map(x => roleInfo.data?.grades.get(x.gradeId)?.gradeNumber).filter(Boolean))].join(", ");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-teal-50 text-teal-800 text-xl font-bold">
            {initial || "?"}
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">{account.fullName}</h3>
            <p className="text-sm text-gray-500">{roleLabel}</p>
            <div className="mt-1">
              <StatusBadge status={statusLabel} />
            </div>
          </div>
        </div>
        <div className="relative">
          <Button variant="ghost" size="icon" aria-label="Thêm thao tác" onClick={() => setMenuOpen(x => !x)}>
            <MoreHorizontal size={20} />
          </Button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              <button type="button" className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2" onClick={onLock}>
                <LockKeyhole size={16} />{account.status === "LOCKED" ? "Mở khóa tài khoản" : "Khóa tài khoản"}
              </button>
              <button type="button" className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2" onClick={onReset}>
                <KeyRound size={16} />Đặt lại mật khẩu
              </button>
              <button type="button" className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2" onClick={onDisable}>
                <LockKeyhole size={16} />Vô hiệu hóa
              </button>
              <button type="button" className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer border-t border-gray-100" onClick={onDelete}>
                <Trash2 size={16} />Xóa tài khoản
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="space-y-6">
        <DetailSection title="Thông tin tài khoản">
          <DetailItem label="Mã tài khoản" value={`${account.roleCode === "STUDENT" ? "HS" : account.roleCode === "TEACHER" ? "GV" : "AD"}${String(account.id).padStart(6, "0")}`} />
          <DetailItem label="Tên đăng nhập" value={`@${account.username.replace(/^@/, "")}`} />
          <DetailItem label="Email" value={account.email} />
          <DetailItem label="Số điện thoại" value={account.phone || "Chưa có số điện thoại"} />
          <DetailItem label="Ngày sinh" value="Chưa cập nhật" />
          <DetailItem label="Giới tính" value="Chưa cập nhật" />
          <DetailItem label="Ngày tạo tài khoản" value={date(account.createdAt)} />
          <DetailItem label="Lần đăng nhập gần nhất" value="Chưa cập nhật" />
        </DetailSection>

        {(account.roleCode === "STUDENT" || account.roleCode === "TEACHER") && (
          <DetailSection title={account.roleCode === "STUDENT" ? "Thông tin học tập" : "Thông tin công tác"}>
            {roleInfo.isLoading ? (
              <p className="text-sm text-gray-500 italic">Đang tải thông tin phân công…</p>
            ) : account.roleCode === "STUDENT" ? (
              <>
                <DetailItem label="Khối" value={gradeNames || "Chưa phân lớp"} />
                <DetailItem label="Lớp" value={classes.map(x => x.name).join(", ") || "Chưa phân lớp"} />
                <DetailItem label="Năm học" value={schoolYear} />
              </>
            ) : (
              <>
                <DetailItem label="Bộ môn" value="Toán học" />
                <DetailItem label="Lớp phụ trách" value={classes.map(x => x.name).join(", ") || "Chưa phân công"} />
                <DetailItem label="Năm học" value={schoolYear} />
              </>
            )}
          </DetailSection>
        )}
      </div>

      <footer className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 mt-4">
        <Button onClick={onEdit}><Pencil size={17} className="mr-2" />Chỉnh sửa thông tin</Button>
        <Button variant="outline" onClick={onReset}><KeyRound size={17} className="mr-2" />Đặt lại mật khẩu</Button>
        <Button variant="outline" className={account.status === "LOCKED" ? "text-green-600" : "text-amber-600"} onClick={onLock}>
          <LockKeyhole size={17} className="mr-2" />{account.status === "LOCKED" ? "Mở khóa tài khoản" : "Khóa tài khoản"}
        </Button>
      </footer>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">{title}</h4>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
        {children}
      </dl>
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="contents">
      <dt className="font-medium text-gray-500">{label}</dt>
      <dd className="font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

function AccountPanel({
  form, setForm, editing, roles, statuses, onClose, onSubmit
}: {
  form: UserAccountInput;
  setForm: (x: UserAccountInput) => void;
  editing: UserAccount | null;
  roles: MetadataOption[];
  statuses: MetadataOption[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col h-full gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">Username
        <input 
          className="h-10 px-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#176b50] outline-none" 
          required 
          pattern="[a-zA-Z0-9._-]+" 
          maxLength={80} 
          value={form.username} 
          onChange={e => setForm({ ...form, username: e.target.value })} 
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">Email
        <input 
          className="h-10 px-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#176b50] outline-none" 
          required 
          type="email" 
          value={form.email} 
          onChange={e => setForm({ ...form, email: e.target.value })} 
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">Họ và tên
        <input 
          className="h-10 px-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#176b50] outline-none" 
          required 
          maxLength={120} 
          value={form.fullName} 
          onChange={e => setForm({ ...form, fullName: e.target.value })} 
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">Điện thoại
        <input 
          className="h-10 px-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#176b50] outline-none" 
          maxLength={30} 
          value={form.phone ?? ""} 
          onChange={e => setForm({ ...form, phone: e.target.value })} 
        />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">Vai trò
          <select 
            className="h-10 px-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#176b50] outline-none bg-white" 
            value={form.roleCode} 
            onChange={e => setForm({ ...form, roleCode: e.target.value })}
          >
            {roles.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">Trạng thái
          <select 
            className="h-10 px-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#176b50] outline-none bg-white" 
            value={form.status} 
            onChange={e => setForm({ ...form, status: e.target.value as UserStatus })}
          >
            {statuses.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">{editing ? "Mật khẩu mới (không bắt buộc)" : "Mật khẩu khởi tạo"}
        <input 
          className="h-10 px-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#176b50] outline-none" 
          type="password" 
          minLength={8} 
          required={!editing} 
          value={form.password ?? ""} 
          onChange={e => setForm({ ...form, password: e.target.value })} 
        />
      </label>
      <div className="mt-auto pt-4 flex justify-end gap-3 border-t border-gray-200">
        <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
        <Button type="submit">{editing ? "Lưu thay đổi" : "Tạo tài khoản"}</Button>
      </div>
    </form>
  );
}

function ImportDialog({
  session, roleLabels, onClose, onImported
}: {
  session: AuthSession;
  roleLabels: Record<string, string>;
  onClose: () => void;
  onImported: () => Promise<unknown>;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<UserImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const rows = (preview?.rows ?? []) as ImportRow[];

  const friendlyError = (reason: unknown) => {
    const message = reason instanceof Error ? reason.message : "Không thể đọc file";
    return message === "Failed to fetch" ? "Không thể kết nối máy chủ. Vui lòng kiểm tra backend đã được cập nhật và thử lại." : message;
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      setPreview(await uploadUserImport(session, file));
      setStep(2);
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!preview?.objectKey) return;
    setBusy(true);
    setError("");
    try {
      const next = await confirmUserImport(session, preview.objectKey);
      setResult(`Đã tạo ${next.created ?? 0} tài khoản, bỏ qua ${next.skipped ?? 0} dòng.`);
      setStep(3);
      await onImported();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Import thất bại");
    } finally {
      setBusy(false);
    }
  };

  const labels = useMemo(() => ["Tải file", "Xem trước", "Xác nhận"], []);

  return (
    <div className="flex flex-col h-[500px]">
      <ol className="flex items-center w-full mb-6 text-sm font-medium text-center text-gray-500">
        {labels.map((label, i) => (
          <li className={`flex items-center ${step >= i + 1 ? "text-[#176b50]" : ""} ${i < labels.length - 1 ? "w-full after:content-[''] after:w-full after:h-px after:bg-gray-200 after:mx-4" : ""}`} key={label}>
            <span className={`flex items-center justify-center w-6 h-6 rounded-full mr-2 ${step > i + 1 ? "bg-[#176b50] text-white" : step === i + 1 ? "bg-teal-100 text-[#176b50]" : "bg-slate-100"}`}>
              {step > i + 1 ? <CheckCircle2 size={14} /> : i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>
      
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm flex items-center gap-2 border border-red-200">
          <AlertTriangle size={17} /><span>{error}</span>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto">
        {step === 1 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-teal-100 text-[#176b50] flex items-center justify-center mb-4">
              <Upload size={24} />
            </div>
            <h3 className="text-lg font-bold mb-1 text-gray-900">Chọn file Excel</h3>
            <p className="text-sm text-gray-500 mb-6">Định dạng .xlsx · tối đa 1.000 dòng · dung lượng tối đa 10 MB</p>
            
            <label className="cursor-pointer mb-4">
              <input type="file" className="hidden" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e => { setFile(e.target.files?.[0] ?? null); setError(""); }} />
              <div className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-slate-50 transition-colors text-gray-700">
                {file ? "Đổi file" : "Chọn file .xlsx"}
              </div>
            </label>
            
            {file && (
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg text-sm mb-6 border border-gray-200">
                <CheckCircle2 size={18} className="text-green-600" />
                <div className="text-left">
                  <b className="block text-gray-900">{file.name}</b>
                  <small className="text-gray-500">{(file.size / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} KB</small>
                </div>
              </div>
            )}
            
            <div className="text-sm text-gray-500 mb-6">
              <b className="block mb-1 text-gray-700">Các cột bắt buộc</b>
              <span>username · email · fullName · roleCode · password</span>
            </div>
          </div>
        )}
        
        {step === 2 && (
          <div className="h-full flex flex-col">
            <div className="flex gap-4 mb-4 text-sm bg-slate-50 p-3 rounded-lg border border-gray-200">
              <div className="flex flex-col"><span className="text-gray-500">Tổng dòng</span><b className="text-lg text-gray-900">{preview?.totalRows ?? 0}</b></div>
              <div className="flex flex-col text-green-600"><span>Hợp lệ</span><b className="text-lg">{preview?.validRows ?? 0}</b></div>
              <div className="flex flex-col text-red-600"><span>Cần sửa</span><b className="text-lg">{preview?.invalidRows ?? 0}</b></div>
            </div>
            
            <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 text-left text-xs font-bold uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Dòng</th>
                    <th className="px-3 py-2">Họ tên</th>
                    <th className="px-3 py-2">Tài khoản</th>
                    <th className="px-3 py-2">Vai trò</th>
                    <th className="px-3 py-2">Kết quả</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(row => (
                    <tr key={row.rowNumber} className="border-t border-gray-100">
                      <td className="px-3 py-2">{row.rowNumber}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">{row.fullName}</td>
                      <td className="px-3 py-2"><b className="block text-gray-900">{row.username}</b><small className="text-gray-500">{row.email}</small></td>
                      <td className="px-3 py-2">{roleLabels[row.roleCode ?? ""] ?? row.roleCode}</td>
                      <td className="px-3 py-2">{row.errors?.length ? <span className="text-red-600">{row.errors.join(", ")}</span> : <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={15} />Hợp lệ</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {step === 3 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <CheckCircle2 size={42} className="text-green-600 mb-4" />
            <h3 className="text-lg font-bold mb-2 text-gray-900">Import hoàn tất</h3>
            <p className="text-sm text-gray-500 mb-6">{result}</p>
          </div>
        )}
      </div>
      
      <footer className="mt-auto pt-4 flex justify-end gap-3 border-t border-gray-200">
        {step === 1 && (
          <>
            <Button type="button" variant="outline" onClick={() => void downloadUserImportTemplate(session)}>Tải file mẫu</Button>
            <Button type="button" disabled={!file || busy} onClick={() => void upload()}>{busy ? "Đang tải lên…" : "Tải lên và xem trước"}</Button>
          </>
        )}
        {step === 2 && (
          <>
            <Button variant="outline" onClick={() => setStep(1)}>Chọn file khác</Button>
            <Button disabled={busy || !preview?.validRows} onClick={() => void confirmImport()}>{busy ? "Đang import…" : `Import ${preview?.validRows ?? 0} tài khoản`}</Button>
          </>
        )}
        {step === 3 && <Button onClick={onClose}>Đóng</Button>}
      </footer>
    </div>
  );
}
