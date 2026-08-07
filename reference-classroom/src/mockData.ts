import { SchoolClass, Student, TaskItem, Teacher } from './types';

export const INITIAL_TEACHERS: Teacher[] = [
  { id: 't1', name: 'Nguyễn Văn A', subject: 'Toán học', email: 'nguyenvana@thpt.edu.vn', phone: '0912 345 678', assignedClassesCount: 2 },
  { id: 't2', name: 'Trần Thị B', subject: 'Văn học', email: 'tranthib@thpt.edu.vn', phone: '0923 456 789', assignedClassesCount: 1 },
  { id: 't3', name: 'Lê Văn C', subject: 'Tiếng Anh', email: 'levanc@thpt.edu.vn', phone: '0934 567 890', assignedClassesCount: 2 },
  { id: 't4', name: 'Phạm Hoàng D', subject: 'Vật lý', email: 'phamhoangd@thpt.edu.vn', phone: '0945 678 901', assignedClassesCount: 1 },
  { id: 't5', name: 'Đỗ Thị E', subject: 'Hóa học', email: 'dothie@thpt.edu.vn', phone: '0956 789 012', assignedClassesCount: 1 },
  { id: 't6', name: 'Vũ Minh Khôi', subject: 'Sinh học', email: 'vuminhkhoi@thpt.edu.vn', phone: '0967 890 123', assignedClassesCount: 0 },
  { id: 't7', name: 'Ngô Thanh Hương', subject: 'Lịch sử', email: 'ngothanhtuong@thpt.edu.vn', phone: '0978 901 234', assignedClassesCount: 0 },
];

export const INITIAL_CLASSES: SchoolClass[] = [
  {
    id: 'c1',
    name: '10A1',
    academicYear: '2023-2024',
    teacherName: 'Nguyễn Văn A',
    teacherId: 't1',
    studentCount: 45,
    openTasksCount: 3,
    progressPercent: 85,
    status: 'ĐANG HỌC',
    grade: 10,
    room: 'Phòng 201'
  },
  {
    id: 'c2',
    name: '10A2',
    academicYear: '2023-2024',
    teacherName: 'Trần Thị B',
    teacherId: 't2',
    studentCount: 42,
    openTasksCount: 5,
    progressPercent: 60,
    status: 'ĐANG HỌC',
    grade: 10,
    room: 'Phòng 202'
  },
  {
    id: 'c3',
    name: '10A3',
    academicYear: '2023-2024',
    teacherName: undefined,
    teacherId: undefined,
    studentCount: 40,
    openTasksCount: 0,
    progressPercent: 0,
    status: 'CHỜ K/G',
    grade: 10,
    room: 'Phòng 203'
  },
  {
    id: 'c4',
    name: '10A4',
    academicYear: '2023-2024',
    teacherName: 'Lê Văn C',
    teacherId: 't3',
    studentCount: 44,
    openTasksCount: 2,
    progressPercent: 92,
    status: 'ĐANG HỌC',
    grade: 10,
    room: 'Phòng 204'
  },
  {
    id: 'c5',
    name: '10A5',
    academicYear: '2023-2024',
    teacherName: 'Phạm Hoàng D',
    teacherId: 't4',
    studentCount: 41,
    openTasksCount: 4,
    progressPercent: 74,
    status: 'ĐANG HỌC',
    grade: 10,
    room: 'Phòng 205'
  },
  {
    id: 'c6',
    name: '10A6',
    academicYear: '2023-2024',
    teacherName: 'Đỗ Thị E',
    teacherId: 't5',
    studentCount: 43,
    openTasksCount: 1,
    progressPercent: 48,
    status: 'ĐANG HỌC',
    grade: 10,
    room: 'Phòng 206'
  }
];

export const INITIAL_STUDENTS: Record<string, Student[]> = {
  c2: [
    { id: 's1', stt: 1, name: 'Bùi Anh Tuấn', studentId: 'HS10A2-001', classId: 'c2', status: 'ACTIVE', progressPercent: 100, gender: 'Nam', dob: '14/05/2008', email: 'anhtuan.bui@thpt.edu.vn', parentPhone: '0901 111 222' },
    { id: 's2', stt: 2, name: 'Cao Mỹ Duyên', studentId: 'HS10A2-002', classId: 'c2', status: 'ACTIVE', progressPercent: 80, gender: 'Nữ', dob: '22/08/2008', email: 'myduyen.cao@thpt.edu.vn', parentPhone: '0902 222 333' },
    { id: 's3', stt: 3, name: 'Đặng Văn Khoa', studentId: 'HS10A2-003', classId: 'c2', status: 'SUSPENDED', progressPercent: 15, gender: 'Nam', dob: '03/01/2008', email: 'vankhoa.dang@thpt.edu.vn', parentPhone: '0903 333 444' },
    { id: 's4', stt: 4, name: 'Hoàng Bích Ngọc', studentId: 'HS10A2-004', classId: 'c2', status: 'ACTIVE', progressPercent: 65, gender: 'Nữ', dob: '19/11/2008', email: 'bichngoc.hoang@thpt.edu.vn', parentPhone: '0904 444 555' },
    { id: 's5', stt: 5, name: 'Lê Hữu Cảnh', studentId: 'HS10A2-005', classId: 'c2', status: 'ACTIVE', progressPercent: 40, gender: 'Nam', dob: '07/04/2008', email: 'huucanh.le@thpt.edu.vn', parentPhone: '0905 555 666' },
    { id: 's6', stt: 6, name: 'Nguyễn Minh Hải', studentId: 'HS10A2-006', classId: 'c2', status: 'ACTIVE', progressPercent: 95, gender: 'Nam', dob: '12/09/2008', email: 'minhhai.nguyen@thpt.edu.vn', parentPhone: '0906 666 777' },
    { id: 's7', stt: 7, name: 'Phan Thu Hà', studentId: 'HS10A2-007', classId: 'c2', status: 'ACTIVE', progressPercent: 88, gender: 'Nữ', dob: '30/06/2008', email: 'thuha.phan@thpt.edu.vn', parentPhone: '0907 777 888' },
    { id: 's8', stt: 8, name: 'Vũ Quốc Khánh', studentId: 'HS10A2-008', classId: 'c2', status: 'ACTIVE', progressPercent: 72, gender: 'Nam', dob: '15/02/2008', email: 'quockhanh.vu@thpt.edu.vn', parentPhone: '0908 888 999' },
  ],
  c1: [
    { id: 's101', stt: 1, name: 'Nguyễn Văn Minh', studentId: 'HS10A1-001', classId: 'c1', status: 'ACTIVE', progressPercent: 90, gender: 'Nam', dob: '01/02/2008' },
    { id: 's102', stt: 2, name: 'Trần Thị Thu', studentId: 'HS10A1-002', classId: 'c1', status: 'ACTIVE', progressPercent: 85, gender: 'Nữ', dob: '15/03/2008' },
    { id: 's103', stt: 3, name: 'Lê Hoàng Nam', studentId: 'HS10A1-003', classId: 'c1', status: 'ACTIVE', progressPercent: 78, gender: 'Nam', dob: '20/07/2008' },
  ],
  c4: [
    { id: 's401', stt: 1, name: 'Đỗ Bảo Lâm', studentId: 'HS10A4-001', classId: 'c4', status: 'ACTIVE', progressPercent: 95, gender: 'Nam', dob: '10/05/2008' },
    { id: 's402', stt: 2, name: 'Phạm Quỳnh Anh', studentId: 'HS10A4-002', classId: 'c4', status: 'ACTIVE', progressPercent: 90, gender: 'Nữ', dob: '28/09/2008' },
  ]
};

export const INITIAL_TASKS: Record<string, TaskItem[]> = {
  c2: [
    { id: 'tks1', classId: 'c2', title: 'Bài tập Đại số Chuyên đề 1: Hàm số bậc hai', dueDate: '10/09/2023', subject: 'Toán học', completedCount: 38, totalStudents: 42, status: 'OPEN' },
    { id: 'tks2', classId: 'c2', title: 'Nộp sơ yếu lý lịch & Hồ sơ nhập học THPT', dueDate: '15/09/2023', subject: 'Học vụ', completedCount: 42, totalStudents: 42, status: 'COMPLETED' },
    { id: 'tks3', classId: 'c2', title: 'Đọc & Đăng ký mượn SGK Kết nối tri thức', dueDate: '20/09/2023', subject: 'Thư viện', completedCount: 25, totalStudents: 42, status: 'OPEN' },
    { id: 'tks4', classId: 'c2', title: 'Bài viết số 1 Ngữ văn: Tác phẩm Văn học dân gian', dueDate: '25/09/2023', subject: 'Ngữ văn', completedCount: 15, totalStudents: 42, status: 'OPEN' },
    { id: 'tks5', classId: 'c2', title: 'Khảo sát nguyện vọng môn học tự chọn lớp 10', dueDate: '30/09/2023', subject: 'BGH', completedCount: 30, totalStudents: 42, status: 'OPEN' },
  ],
  c1: [
    { id: 'tks101', classId: 'c1', title: 'Bài kiểm tra 15 phút Vật lý KNTT', dueDate: '12/09/2023', subject: 'Vật lý', completedCount: 40, totalStudents: 45, status: 'OPEN' },
    { id: 'tks102', classId: 'c1', title: 'Nộp giấy khám sức khỏe đầu năm', dueDate: '18/09/2023', subject: 'Y tế', completedCount: 45, totalStudents: 45, status: 'COMPLETED' },
  ]
};
