import React, { useState } from 'react';
import { SgkBook } from '../types';

interface UploadSgkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBook: (book: SgkBook) => void;
}

export const UploadSgkModal: React.FC<UploadSgkModalProps> = ({ isOpen, onClose, onAddBook }) => {
  const [title, setTitle] = useState('');
  const [volume, setVolume] = useState('Tập 1');
  const [pdfPageCount, setPdfPageCount] = useState(150);
  const [publisher, setPublisher] = useState('Kết nối tri thức với cuộc sống');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    setIsUploading(true);

    setTimeout(() => {
      const newBook: SgkBook = {
        id: `sgk-${Date.now()}`,
        title: `Toán 10 - ${title}`,
        volume,
        pdfPageCount: Number(pdfPageCount),
        matchStatus: 'unmatched',
        publishStatus: 'draft',
        coverUrl: selectedFile ? URL.createObjectURL(selectedFile) : '',
        bookCode: `SGK-${Math.floor(Math.random() * 900 + 100)}`,
      };

      onAddBook(newBook);
      setIsUploading(false);
      onClose();
      // Reset
      setTitle('');
      setSelectedFile(null);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-[#c3c6d7] animate-in fade-in duration-200">
        <div className="px-6 py-4 border-b border-[#c3c6d7] flex justify-between items-center bg-[#f2f3ff]">
          <h2 className="text-lg font-bold text-[#131b2e] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6]">upload_file</span>
            Tải lên Sách Giáo Khoa mới
          </h2>
          <button
            onClick={onClose}
            className="text-[#737686] hover:text-[#131b2e] p-1 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#434655] mb-1">
              Bộ sách SGK <span className="text-[#ba1a1a]">*</span>
            </label>
            <select
              value={publisher}
              onChange={(e) => {
                setPublisher(e.target.value);
                setTitle(e.target.value);
              }}
              className="w-full h-10 px-3 border border-[#c3c6d7] rounded-md text-sm text-[#131b2e] focus:ring-2 focus:ring-[#004ac6] focus:border-[#004ac6] outline-none"
            >
              <option value="Kết nối tri thức với cuộc sống">Kết nối tri thức với cuộc sống</option>
              <option value="Chân trời sáng tạo">Chân trời sáng tạo</option>
              <option value="Cánh diều">Cánh diều</option>
              <option value="Cùng học để phát triển năng lực">Cùng học để phát triển năng lực</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#434655] mb-1">
              Tên đầy đủ sách <span className="text-[#ba1a1a]">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Kết nối tri thức với cuộc sống"
              className="w-full h-10 px-3 border border-[#c3c6d7] rounded-md text-sm text-[#131b2e] focus:ring-2 focus:ring-[#004ac6] outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#434655] mb-1">Tập</label>
              <select
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                className="w-full h-10 px-3 border border-[#c3c6d7] rounded-md text-sm text-[#131b2e] focus:ring-2 focus:ring-[#004ac6] outline-none"
              >
                <option value="Tập 1">Tập 1</option>
                <option value="Tập 2">Tập 2</option>
                <option value="Toàn tập">Toàn tập</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#434655] mb-1">Số trang PDF</label>
              <input
                type="number"
                value={pdfPageCount}
                onChange={(e) => setPdfPageCount(Number(e.target.value))}
                min={1}
                className="w-full h-10 px-3 border border-[#c3c6d7] rounded-md text-sm text-[#131b2e] focus:ring-2 focus:ring-[#004ac6] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#434655] mb-1">Tệp PDF Sách</label>
            <div className="border-2 border-dashed border-[#c3c6d7] hover:border-[#004ac6] rounded-lg p-4 text-center cursor-pointer bg-[#faf8ff] transition-colors">
              <input
                type="file"
                accept=".pdf"
                id="pdf-upload"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
              />
              <label htmlFor="pdf-upload" className="cursor-pointer block">
                <span className="material-symbols-outlined text-3xl text-[#004ac6] mb-1">
                  cloud_upload
                </span>
                <p className="text-sm font-medium text-[#131b2e]">
                  {selectedFile ? selectedFile.name : 'Kéo thả file PDF vào đây hoặc chọn tệp'}
                </p>
                <p className="text-xs text-[#737686] mt-1">Hỗ trợ định dạng .PDF tối đa 200MB</p>
              </label>
            </div>
          </div>

          <div className="pt-3 border-t border-[#c3c6d7] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#434655] bg-[#eaedff] hover:bg-[#dae2fd] rounded-md transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-5 py-2 text-sm font-semibold text-white bg-[#004ac6] hover:bg-[#003ea8] rounded-md shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-base">sync</span>
                  Đang tải lên...
                </>
              ) : (
                'Thêm mới SGK'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
