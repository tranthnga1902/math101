export type ClassStatus = 'ĐANG HỌC' | 'CHỜ K/G' | 'ĐÃ LƯU TRỮ';

export interface SchoolClass {
  id: string;
  name: string;
  academicYear: string;
  teacherName?: string;
  teacherId?: string;
  studentCount: number;
  openTasksCount: number;
  progressPercent: number;
  status: ClassStatus;
  grade: number;
  room?: string;
  description?: string;
}

export type StudentStatus = 'ACTIVE' | 'SUSPENDED' | 'GRADUATED';

export interface Student {
  id: string;
  stt: number;
  name: string;
  studentId: string;
  classId: string;
  status: StudentStatus;
  progressPercent: number;
  gender?: 'Nam' | 'Nữ';
  dob?: string;
  email?: string;
  parentPhone?: string;
}

export interface TaskItem {
  id: string;
  classId: string;
  title: string;
  dueDate: string;
  subject: string;
  completedCount: number;
  totalStudents: number;
  status: 'OPEN' | 'COMPLETED' | 'OVERDUE';
}

export interface Teacher {
  id: string;
  name: string;
  subject: string;
  email: string;
  phone: string;
  assignedClassesCount: number;
}

export type NavigationTab = 
  | 'dashboard' 
  | 'accounts' 
  | 'classes' 
  | 'textbooks' 
  | 'documents' 
  | 'topics' 
  | 'logs' 
  | 'settings';
