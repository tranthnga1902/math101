import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { SgkListDashboard } from './components/SgkListDashboard';
import { PdfAlignmentTool } from './components/PdfAlignmentTool';
import { UploadSgkModal } from './components/UploadSgkModal';
import { Toast } from './components/Toast';
import { INITIAL_BOOKS } from './data/mockData';
import { SgkBook } from './types';

export default function App() {
  const [sidebarTab, setSidebarTab] = useState<string>('sgk');
  const [viewMode, setViewMode] = useState<'list' | 'mapping'>('list');
  const [activeBookForMapping, setActiveBookForMapping] = useState<SgkBook | null>(null);

  const [books, setBooks] = useState<SgkBook[]>(INITIAL_BOOKS);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  const handleOpenMapping = (book: SgkBook) => {
    setActiveBookForMapping(book);
    setViewMode('mapping');
  };

  const handleAddBook = (newBook: SgkBook) => {
    setBooks((prev) => [newBook, ...prev]);
    showToast(`Đã tải lên "${newBook.title}" thành công!`);
  };

  const handleTogglePublish = (bookId: string) => {
    setBooks((prev) =>
      prev.map((b) => {
        if (b.id === bookId) {
          const nextStatus = b.publishStatus === 'published' ? 'draft' : 'published';
          showToast(
            nextStatus === 'published'
              ? `Đã xuất bản "${b.title}"!`
              : `Đã chuyển "${b.title}" về Bản nháp!`
          );
          return { ...b, publishStatus: nextStatus };
        }
        return b;
      })
    );
  };

  if (viewMode === 'mapping' && activeBookForMapping) {
    return (
      <>
        <PdfAlignmentTool
          book={activeBookForMapping}
          onBack={() => setViewMode('list')}
          onSaveToast={showToast}
        />
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col font-sans">
      <Sidebar activeTab={sidebarTab} setActiveTab={setSidebarTab} />
      <Header searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

      {sidebarTab === 'sgk' ? (
        <SgkListDashboard
          books={books}
          onOpenUpload={() => setIsUploadModalOpen(true)}
          onOpenMapping={handleOpenMapping}
          onTogglePublish={handleTogglePublish}
          searchTerm={searchTerm}
        />
      ) : (
        <main className="pt-[80px] pl-[264px] pr-[24px] w-full min-h-screen pb-12 flex flex-col gap-6">
          <div className="bg-white border border-[#c3c6d7] rounded-lg p-8 shadow-xs text-center space-y-4">
            <span className="material-symbols-outlined text-4xl text-[#004ac6]">
              construction
            </span>
            <h2 className="text-xl font-bold">Trang đang được xây dựng</h2>
            <p className="text-sm text-[#434655]">
              Mục danh mục này đang trong quá trình phát triển. Vui lòng chuyển sang mục{' '}
              <button
                onClick={() => setSidebarTab('sgk')}
                className="text-[#004ac6] font-bold underline cursor-pointer"
              >
                SGK
              </button>{' '}
              để xem đầy đủ giao diện Quản lý Sách Giáo Khoa &amp; Tool Khớp Trang.
            </p>
          </div>
        </main>
      )}

      <UploadSgkModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onAddBook={handleAddBook}
      />

      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
}
