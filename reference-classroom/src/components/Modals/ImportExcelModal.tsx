import React, { useState } from 'react';
import { Student } from '../../types';

interface ImportExcelModalProps {
  isOpen: boolean;
  classNameTitle?: string;
  onClose: () => void;
  onImportDone: (importedStudents: Omit<Student, 'id' | 'stt'>[]) => void;
}

export const ImportExcelModal: React.FC<ImportExcelModalProps> = ({
  isOpen,
  classNameTitle,
  onClose,
  onImportDone
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<
    { name: string; studentId: string; gender: 'Nam' | 'Nữ'; parentPhone: string }[]
  >([
    { name: 'Phạm Minh Đức', studentId: 'HS10A2-009', gender: 'Nam', parentPhone: '0911 222 333' },
    { name: 'Nguyễn Khánh Linh', studentId: 'HS10A2-010', gender: 'Nữ', parentPhone: '0922 333 444' },
    { name: 'Trần Vũ Hoàng', studentId: 'HS10A2-011', gender: 'Nam', parentPhone: '0933 444 555' },
    { name: 'Đặng Bảo Ngọc', studentId: 'HS10A2-012', gender: 'Nữ', parentPhone: '0944 555 666' },
  ]);

  if (!isOpen) return null;

  const handleSimulatedFileUpload = (file: File | string) => {
    setFileName(typeof file === 'string' ? file : file.name);
    setStep(2);
  };

  const handleCompleteImport = () => {
    const newStudents: Omit<Student, 'id' | 'stt'>[] = previewData.map((row) => ({
      name: row.name,
      studentId: row.studentId,
      classId: '',
      status: 'ACTIVE',
      progressPercent: 75,
      gender: row.gender,
      parentPhone: row.parentPhone,
    }));

    onImportDone(newStudents);
    setStep(1);
    setFileName(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 select-none">
      <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl border border-[#c3c6d7] animate-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#c3c6d7]">
          <h3 className="font-semibold text-lg text-[#004ac6] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6]">upload_file</span>
            Import Danh Sách Học Sinh từ Excel / CSV
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[#434655] hover:bg-[#f2f3ff] p-1 rounded-full cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {step === 1 ? (
          <div>
            <div className="border-2 border-dashed border-[#c3c6d7] rounded-lg p-8 text-center hover:bg-[#f2f3ff] transition-colors cursor-pointer group mb-4">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleSimulatedFileUpload(e.target.files[0]);
                  }
                }}
                className="hidden"
                id="excelFileInput"
              />
              <label htmlFor="excelFileInput" className="cursor-pointer block">
                <span className="material-symbols-outlined text-4xl text-[#004ac6] mb-2 group-hover:scale-110 transition-transform">
                  cloud_upload
                </span>
                <p className="font-semibold text-sm text-[#131b2e]">
                  Kéo thả file Excel hoặc chọn từ máy tính
                </p>
                <p className="text-xs text-[#434655] mt-1">
                  Hỗ trợ định dạng .xlsx, .xls, .csv (Tối đa 5MB)
                </p>
              </label>
            </div>

            <div className="bg-[#f2f3ff] p-3 rounded-lg flex items-center justify-between text-xs text-[#434655]">
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#004ac6]">
                  description
                </span>
                Tải file mẫu định dạng THPT (.xlsx)
              </span>
              <button
                type="button"
                onClick={() => handleSimulatedFileUpload('danh_sach_hoc_sinh_mau.xlsx')}
                className="text-[#004ac6] font-semibold hover:underline"
              >
                Tải mẫu chuẩn
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3 bg-[#e2e7ff] px-3 py-2 rounded text-xs">
              <span className="font-semibold text-[#004ac6] flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                File đã chọn: {fileName}
              </span>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-[#434655] hover:underline"
              >
                Đổi file khác
              </button>
            </div>

            <p className="text-xs font-semibold text-[#131b2e] mb-2">
              Xem trước dữ liệu trích xuất ({previewData.length} học sinh):
            </p>

            <div className="border border-[#c3c6d7] rounded-lg overflow-hidden max-h-56 overflow-y-auto mb-4">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#f2f3ff] border-b border-[#c3c6d7] text-[#434655]">
                    <th className="p-2 font-semibold">Mã HS</th>
                    <th className="p-2 font-semibold">Họ và Tên</th>
                    <th className="p-2 font-semibold">Giới tính</th>
                    <th className="p-2 font-semibold">SĐT Phụ huynh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c3c6d7]">
                  {previewData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#faf8ff]">
                      <td className="p-2 font-mono text-[#004ac6]">{row.studentId}</td>
                      <td className="p-2 font-semibold">{row.name}</td>
                      <td className="p-2">{row.gender}</td>
                      <td className="p-2">{row.parentPhone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#c3c6d7]">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-[#c3c6d7] rounded text-xs text-[#434655] hover:bg-[#f2f3ff]"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={handleCompleteImport}
                className="px-4 py-2 bg-[#004ac6] text-white rounded text-xs font-semibold hover:bg-[#2563eb]"
              >
                Xác nhận Import ({previewData.length} học sinh)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
