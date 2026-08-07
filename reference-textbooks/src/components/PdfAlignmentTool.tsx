import React, { useState } from 'react';
import { SgkBook, Chapter, Lesson } from '../types';
import { MOCK_CHAPTERS, generatePdfThumbs } from '../data/mockData';

interface PdfAlignmentToolProps {
  book: SgkBook;
  onBack: () => void;
  onSaveToast: (msg: string) => void;
}

export const PdfAlignmentTool: React.FC<PdfAlignmentToolProps> = ({
  book,
  onBack,
  onSaveToast,
}) => {
  // Page Mapping State
  const [currentPdfPage, setCurrentPdfPage] = useState<number>(15);
  const [pdfAnchor, setPdfAnchor] = useState<number>(15);
  const [bookAnchor, setBookAnchor] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Quick check input
  const [checkPdfInput, setCheckPdfInput] = useState<string>('');

  // Tree / Chapters state
  const [chapters, setChapters] = useState<Chapter[]>(MOCK_CHAPTERS);
  const [selectedLessonId, setSelectedLessonId] = useState<string>('les-1');
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>({
    'ch-1': true,
    'ch-2': false,
    'ch-3': false,
  });

  // Range Attachment Modal
  const [showRangeModal, setShowRangeModal] = useState<boolean>(false);
  const [rangeStart, setRangeStart] = useState<number>(15);
  const [rangeEnd, setRangeEnd] = useState<number>(20);

  // Add lesson modal
  const [showAddLessonModal, setShowAddLessonModal] = useState<boolean>(false);
  const [newLessonTitle, setNewLessonTitle] = useState<string>('');
  const [targetChapterId, setTargetChapterId] = useState<string>('ch-1');

  // Offset formula: Trang Sách = Trang PDF - (pdfAnchor - bookAnchor)
  const offset = pdfAnchor - bookAnchor;

  // Calculate book page from pdf page
  const getBookPageForPdf = (pdfP: number): number | null => {
    if (pdfP <= offset) return null;
    return pdfP - offset;
  };

  const currentBookPage = getBookPageForPdf(currentPdfPage);

  // Quick check result
  const testPdfPageNum = parseInt(checkPdfInput, 10);
  const testBookPageNum =
    !isNaN(testPdfPageNum) && testPdfPageNum > offset
      ? testPdfPageNum - offset
      : null;

  // Thumbnails data
  const pdfThumbs = generatePdfThumbs(book.pdfPageCount || 185, offset);

  // Toggle chapter collapse
  const toggleChapter = (chId: string) => {
    setOpenChapters((prev) => ({ ...prev, [chId]: !prev[chId] }));
  };

  // Attach current page to selected lesson
  const handleAttachCurrentPage = () => {
    if (!selectedLessonId || !currentBookPage) return;

    setChapters((prev) =>
      prev.map((ch) => ({
        ...ch,
        lessons: ch.lessons.map((les) => {
          if (les.id === selectedLessonId) {
            const startP = les.startPage ?? currentBookPage;
            const endP = Math.max(les.endPage ?? currentBookPage, currentBookPage);
            return {
              ...les,
              isAttached: true,
              startPage: startP,
              endPage: endP,
              pageRange: `Tr ${startP}-${endP}`,
            };
          }
          return les;
        }),
      }))
    );

    onSaveToast(`Đã gắn trang PDF ${currentPdfPage} (Trang sách ${currentBookPage}) vào bài học!`);
  };

  // Attach range to selected lesson
  const handleAttachRange = () => {
    if (!selectedLessonId) return;
    const startBookP = getBookPageForPdf(rangeStart) || 1;
    const endBookP = getBookPageForPdf(rangeEnd) || 1;

    setChapters((prev) =>
      prev.map((ch) => ({
        ...ch,
        lessons: ch.lessons.map((les) => {
          if (les.id === selectedLessonId) {
            return {
              ...les,
              isAttached: true,
              startPage: startBookP,
              endPage: endBookP,
              pageRange: `Tr ${startBookP}-${endBookP}`,
            };
          }
          return les;
        }),
      }))
    );

    setShowRangeModal(false);
    onSaveToast(`Đã gắn khoảng trang PDF ${rangeStart}-${rangeEnd} vào bài học!`);
  };

  // Add new lesson
  const handleAddLesson = () => {
    if (!newLessonTitle.trim()) return;

    const newLes: Lesson = {
      id: `les-${Date.now()}`,
      title: newLessonTitle.trim(),
      isAttached: false,
    };

    setChapters((prev) =>
      prev.map((ch) => {
        if (ch.id === targetChapterId) {
          return { ...ch, lessons: [...ch.lessons, newLes] };
        }
        return ch;
      })
    );

    setNewLessonTitle('');
    setShowAddLessonModal(false);
    onSaveToast('Thêm bài học mới thành công!');
  };

  // Get active lesson title
  let activeLessonTitle = '';
  chapters.forEach((ch) => {
    ch.lessons.forEach((l) => {
      if (l.id === selectedLessonId) {
        activeLessonTitle = `${ch.title.split(':')[0]} - ${l.title.split(':')[0]}`;
      }
    });
  });

  // Calculate statistics
  const totalLessons = chapters.reduce((acc, ch) => acc + ch.lessons.length, 0);
  const attachedLessons = chapters.reduce(
    (acc, ch) => acc + ch.lessons.filter((l) => l.isAttached).length,
    0
  );
  const attachedPercentage = Math.round((attachedLessons / (totalLessons || 1)) * 100);

  return (
    <div className="bg-[#faf8ff] text-[#131b2e] h-screen overflow-hidden flex flex-col font-sans">
      {/* Topbar (Thin, Full width) */}
      <header className="h-[48px] bg-white border-b border-[#c3c6d7] flex items-center justify-between px-4 shrink-0 z-20 relative shadow-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-[#434655] hover:bg-[#f2f3ff] p-1.5 rounded-full transition-colors flex items-center justify-center h-[32px] w-[32px] cursor-pointer"
            title="Quay lại danh sách"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div className="flex flex-col">
            <h1 className="text-[16px] font-bold text-[#131b2e] leading-tight">
              {book.title} ({book.volume})
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#434655] font-medium">
                Tiến độ khớp: 145/{book.pdfPageCount || 180} trang (80%)
              </span>
              <div className="w-32 h-1.5 bg-[#dae2fd] rounded-full overflow-hidden">
                <div className="bg-[#004ac6] h-full w-[80%] rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="h-[32px] px-4 text-xs font-semibold text-[#131b2e] border border-[#c3c6d7] rounded-lg hover:bg-[#eaedff] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
            Thoát
          </button>
          <button
            onClick={() => onSaveToast('Đã lưu cấu hình khớp trang và bài học thành công!')}
            className="h-[32px] px-4 text-xs font-semibold text-white bg-[#004ac6] rounded-lg hover:bg-[#003ea8] transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            Lưu lại
          </button>
        </div>
      </header>

      {/* Main Content: 3 Columns */}
      <main className="flex-1 flex overflow-hidden">
        {/* Column 1: PDF Thumbnails (160px) */}
        <aside className="w-[160px] bg-white border-r border-[#c3c6d7] flex flex-col shrink-0">
          <div className="p-2 border-b border-[#c3c6d7] bg-[#f2f3ff] flex justify-between items-center shrink-0">
            <span className="text-xs font-semibold text-[#434655]">Trang PDF</span>
            <span className="material-symbols-outlined text-[16px] text-[#434655] cursor-pointer">
              filter_list
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {pdfThumbs.slice(0, 30).map((thumb) => {
              const isActive = thumb.pdfPage === currentPdfPage;
              return (
                <div
                  key={thumb.pdfPage}
                  onClick={() => setCurrentPdfPage(thumb.pdfPage)}
                  className="group relative cursor-pointer flex flex-col items-center"
                >
                  <div
                    className={`w-full aspect-[1/1.4] bg-white border rounded mb-1 overflow-hidden transition-all flex flex-col items-center justify-center relative ${
                      isActive
                        ? 'border-2 border-[#004ac6] shadow-[0_0_0_2px_rgba(0,74,198,0.2)]'
                        : 'border-[#c3c6d7] group-hover:border-[#004ac6]'
                    }`}
                  >
                    <span
                      className={`text-[11px] font-semibold ${
                        isActive ? 'text-[#004ac6]' : 'text-[#737686]'
                      }`}
                    >
                      {thumb.label}
                    </span>
                    {thumb.pdfPage >= 15 && (
                      <div className="absolute top-1 right-1 w-2 h-2 bg-[#006e2d] rounded-full"></div>
                    )}
                  </div>
                  <span
                    className={`text-[11px] ${
                      isActive
                        ? 'text-[#004ac6] font-bold'
                        : 'text-[#434655]'
                    }`}
                  >
                    PDF: {thumb.pdfPage} | Sách:{' '}
                    {thumb.bookPage !== null ? thumb.bookPage : '-'}
                  </span>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Column 2: PDF Viewer (Flexible Center) */}
        <section className="flex-1 bg-[#eaedff] flex flex-col relative overflow-hidden">
          {/* Viewer Toolbar */}
          <div className="h-10 bg-white/90 backdrop-blur-xs border-b border-[#c3c6d7] flex items-center justify-center gap-4 px-4 shrink-0 absolute top-0 left-0 right-0 z-10 shadow-2xs">
            {/* Zoom controls */}
            <div className="flex items-center gap-1 bg-[#f2f3ff] rounded-lg p-1">
              <button
                onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-[#dae2fd] text-[#434655] transition-colors cursor-pointer"
                title="Thu nhỏ"
              >
                <span className="material-symbols-outlined text-[18px]">zoom_out</span>
              </button>
              <span className="text-xs font-semibold px-2 w-12 text-center text-[#131b2e]">
                {zoomLevel}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(200, z + 10))}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-[#dae2fd] text-[#434655] transition-colors cursor-pointer"
                title="Phóng to"
              >
                <span className="material-symbols-outlined text-[18px]">zoom_in</span>
              </button>
            </div>

            {/* Page navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPdfPage((p) => Math.max(1, p - 1))}
                disabled={currentPdfPage <= 1}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#dae2fd] text-[#434655] disabled:opacity-40 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">
                  navigate_before
                </span>
              </button>
              <span className="text-xs font-semibold text-[#131b2e]">
                PDF: {currentPdfPage} / {book.pdfPageCount || 185}
              </span>
              <button
                onClick={() =>
                  setCurrentPdfPage((p) =>
                    Math.min(book.pdfPageCount || 185, p + 1)
                  )
                }
                disabled={currentPdfPage >= (book.pdfPageCount || 185)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#dae2fd] text-[#434655] disabled:opacity-40 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">navigate_next</span>
              </button>
            </div>
          </div>

          {/* PDF Page Display Canvas */}
          <div className="flex-1 overflow-auto p-4 flex items-start justify-center pt-14 pb-8">
            <div
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
              className="bg-white shadow-md border border-[#c3c6d7] w-full max-w-[780px] aspect-[1/1.414] relative flex flex-col items-center justify-center p-8 transition-transform duration-150 rounded-sm"
            >
              {/* Overlay Indicator Badge */}
              <div className="absolute top-4 right-4 bg-[#7cf994] text-[#007230] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-xs border border-[#006e2d]/20">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Đã khớp: {activeLessonTitle || 'Chương 1 - Bài 1'}
              </div>

              <div className="text-center space-y-2">
                <p className="text-xl font-bold text-[#c3c6d7]">
                  Nội dung trang PDF {currentPdfPage}
                </p>
                <p className="text-base text-[#737686]">
                  (Trang sách {currentBookPage !== null ? currentBookPage : 'Chưa định dạng'})
                </p>
                <div className="mt-8 border border-dashed border-[#c3c6d7] p-6 rounded-lg bg-[#faf8ff] max-w-md mx-auto text-left text-xs text-[#434655] space-y-2">
                  <p className="font-bold text-[#004ac6]">THÔNG TIN KHỚP TRANG VÀ BÀI HỌC</p>
                  <p>• Mốc khớp: Trang PDF {pdfAnchor} = Trang Sách {bookAnchor}</p>
                  <p>• Công thức: Trang Sách = Trang PDF - {offset}</p>
                  <p>• Trạng thái: Đã tự động tính toán đồng bộ cho toàn bộ bộ sách.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Column 3: Mapping Controls (360px) */}
        <aside className="w-[360px] bg-white border-l border-[#c3c6d7] flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto">
            {/* Block 1: Page Number Mapping */}
            <div className="p-4 border-b border-[#c3c6d7]">
              <h2 className="text-base font-bold text-[#131b2e] flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[#004ac6] text-[20px]">
                  sync
                </span>
                Khớp số trang
              </h2>

              <div className="bg-[#f2f3ff] p-3 rounded-lg border border-[#c3c6d7]/60 space-y-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-[#434655] mb-1">
                      Mốc Trang PDF
                    </label>
                    <input
                      type="number"
                      value={pdfAnchor}
                      onChange={(e) => setPdfAnchor(Number(e.target.value) || 1)}
                      className="w-full h-8 px-2 border border-[#c3c6d7] rounded bg-white text-sm font-semibold text-[#131b2e] focus:ring-1 focus:ring-[#004ac6] focus:border-[#004ac6] outline-none"
                    />
                  </div>
                  <span className="text-lg font-bold text-[#434655] px-1 pb-1">=</span>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-[#434655] mb-1">
                      Mốc Trang Sách
                    </label>
                    <input
                      type="number"
                      value={bookAnchor}
                      onChange={(e) => setBookAnchor(Number(e.target.value) || 1)}
                      className="w-full h-8 px-2 border border-[#c3c6d7] rounded bg-white text-sm font-semibold text-[#131b2e] focus:ring-1 focus:ring-[#004ac6] focus:border-[#004ac6] outline-none"
                    />
                  </div>
                </div>

                {/* Formula Info callout */}
                <div className="bg-[#004ac6]/10 text-[#00174b] p-2.5 rounded text-[12px] font-medium flex items-start gap-2 border border-[#004ac6]/20">
                  <span className="material-symbols-outlined text-[18px] text-[#004ac6] shrink-0 mt-0.5">
                    info
                  </span>
                  <div>
                    <div>
                      Công thức: <strong>Trang Sách = Trang PDF - {offset}</strong>
                    </div>
                    <div className="text-[#434655] mt-0.5 text-[11px]">
                      Áp dụng tự động cho các trang phía sau mốc này.
                    </div>
                  </div>
                </div>

                {/* Quick Check Calculator */}
                <div className="border-t border-[#c3c6d7]/50 pt-3">
                  <label className="block text-xs font-semibold text-[#434655] mb-2">
                    Kiểm tra nhanh công thức
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[#131b2e]">Nhập trang PDF:</span>
                    <input
                      type="number"
                      value={checkPdfInput}
                      onChange={(e) => setCheckPdfInput(e.target.value)}
                      placeholder="VD: 20"
                      className="w-16 h-7 px-1 border border-[#c3c6d7] rounded bg-white text-xs font-medium focus:ring-1 focus:ring-[#004ac6] outline-none text-center"
                    />
                    <span className="material-symbols-outlined text-[14px] text-[#434655]">
                      arrow_forward
                    </span>
                    <span className="text-[12px] font-bold text-[#004ac6] bg-[#004ac6]/10 px-2.5 py-1 rounded">
                      Sách: {testBookPageNum !== null ? testBookPageNum : '--'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Block 2: Lesson Attachment (Tree View) */}
            <div className="p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-[#131b2e] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#004ac6] text-[20px]">
                    account_tree
                  </span>
                  Gắn bài học
                </h2>
                <button
                  onClick={() => setShowAddLessonModal(true)}
                  className="text-[#004ac6] hover:bg-[#f2f3ff] p-1 rounded transition-colors cursor-pointer"
                  title="Thêm bài học mới"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={handleAttachCurrentPage}
                  className="flex-1 h-8 bg-[#eaedff] border border-[#c3c6d7] rounded text-[12px] font-semibold text-[#131b2e] hover:bg-[#dae2fd] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">push_pin</span>
                  Gắn trang hiện tại ({currentPdfPage})
                </button>
                <button
                  onClick={() => setShowRangeModal(true)}
                  className="flex-1 h-8 bg-[#eaedff] border border-[#c3c6d7] rounded text-[12px] font-semibold text-[#131b2e] hover:bg-[#dae2fd] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    library_books
                  </span>
                  Gắn khoảng trang...
                </button>
              </div>

              {/* Tree Structure */}
              <div className="border border-[#c3c6d7] rounded-lg bg-white p-2 max-h-[360px] overflow-y-auto">
                {chapters.map((ch) => {
                  const isOpen = openChapters[ch.id];
                  return (
                    <div key={ch.id} className="mb-1">
                      {/* Chapter Header */}
                      <div
                        onClick={() => toggleChapter(ch.id)}
                        className="flex items-center gap-1 p-1 hover:bg-[#f2f3ff] rounded cursor-pointer group"
                      >
                        <span
                          className={`material-symbols-outlined text-[18px] text-[#434655] transition-transform ${
                            isOpen ? 'rotate-90' : ''
                          }`}
                        >
                          chevron_right
                        </span>
                        <span className="material-symbols-outlined text-[16px] text-[#737686]">
                          folder
                        </span>
                        <span className="text-[13px] font-semibold text-[#131b2e] flex-1 truncate">
                          {ch.title}
                        </span>
                        {ch.pageRange && (
                          <span className="text-[10px] bg-[#eaedff] px-1.5 py-0.5 rounded text-[#434655]">
                            {ch.pageRange}
                          </span>
                        )}
                      </div>

                      {/* Lessons List */}
                      {isOpen && (
                        <div className="ml-5 border-l border-[#c3c6d7]/50 pl-2 mt-1 space-y-1">
                          {ch.lessons.map((les) => {
                            const isSelected = selectedLessonId === les.id;
                            return (
                              <div
                                key={les.id}
                                onClick={() => setSelectedLessonId(les.id)}
                                className={`flex items-center gap-1 p-1.5 rounded cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-[#004ac6]/10 border border-[#004ac6]/30'
                                    : 'hover:bg-[#f2f3ff]'
                                }`}
                              >
                                <span
                                  className={`material-symbols-outlined text-[16px] ${
                                    isSelected ? 'text-[#004ac6]' : 'text-[#737686]'
                                  }`}
                                >
                                  description
                                </span>
                                <span
                                  className={`text-[13px] flex-1 truncate ${
                                    isSelected
                                      ? 'text-[#004ac6] font-semibold'
                                      : les.isAttached
                                      ? 'text-[#131b2e] font-normal'
                                      : 'text-[#434655] italic'
                                  }`}
                                >
                                  {les.title}
                                </span>

                                {les.isAttached && les.pageRange ? (
                                  <span className="text-[10px] bg-[#004ac6] text-white px-1.5 py-0.5 rounded font-bold">
                                    {les.pageRange}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-[#737686] italic">
                                    (Chưa gắn)
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Summary Footer */}
          <div className="bg-[#f2f3ff] p-3 border-t border-[#c3c6d7] shrink-0">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[12px] font-medium text-[#434655]">
                Tổng quan gắn trang:
              </span>
              <span className="text-[14px] font-bold text-[#004ac6]">
                {attachedLessons}/{totalLessons} bài học ({attachedPercentage}%)
              </span>
            </div>
            <div className="w-full h-1.5 bg-[#dae2fd] rounded-full overflow-hidden">
              <div
                style={{ width: `${attachedPercentage}%` }}
                className="bg-[#006e2d] h-full rounded-full transition-all duration-300"
              ></div>
            </div>
          </div>
        </aside>
      </main>

      {/* Range Attachment Modal */}
      {showRangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 border border-[#c3c6d7]">
            <h3 className="text-base font-bold text-[#131b2e] mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#004ac6]">library_books</span>
              Gắn khoảng trang cho bài học
            </h3>
            <p className="text-xs text-[#434655] mb-4">
              Nhập khoảng trang PDF cần gán cho bài học đang chọn.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-[#434655] mb-1">
                  Trang PDF bắt đầu
                </label>
                <input
                  type="number"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(Number(e.target.value))}
                  className="w-full h-9 px-3 border border-[#c3c6d7] rounded text-sm text-[#131b2e] outline-none focus:ring-2 focus:ring-[#004ac6]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#434655] mb-1">
                  Trang PDF kết thúc
                </label>
                <input
                  type="number"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(Number(e.target.value))}
                  className="w-full h-9 px-3 border border-[#c3c6d7] rounded text-sm text-[#131b2e] outline-none focus:ring-2 focus:ring-[#004ac6]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRangeModal(false)}
                className="px-4 py-2 text-xs font-medium text-[#434655] bg-[#eaedff] rounded hover:bg-[#dae2fd]"
              >
                Hủy
              </button>
              <button
                onClick={handleAttachRange}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#004ac6] rounded hover:bg-[#003ea8]"
              >
                Xác nhận gắn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Lesson Modal */}
      {showAddLessonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 border border-[#c3c6d7]">
            <h3 className="text-base font-bold text-[#131b2e] mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#004ac6]">add_circle</span>
              Thêm bài học mới vào chương
            </h3>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-[#434655] mb-1">
                  Chọn Chương
                </label>
                <select
                  value={targetChapterId}
                  onChange={(e) => setTargetChapterId(e.target.value)}
                  className="w-full h-9 px-3 border border-[#c3c6d7] rounded text-sm text-[#131b2e] outline-none focus:ring-2 focus:ring-[#004ac6]"
                >
                  {chapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#434655] mb-1">
                  Tên bài học mới
                </label>
                <input
                  type="text"
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                  placeholder="VD: Bài 4: Phép hợp hai tập hợp"
                  className="w-full h-9 px-3 border border-[#c3c6d7] rounded text-sm text-[#131b2e] outline-none focus:ring-2 focus:ring-[#004ac6]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddLessonModal(false)}
                className="px-4 py-2 text-xs font-medium text-[#434655] bg-[#eaedff] rounded hover:bg-[#dae2fd]"
              >
                Hủy
              </button>
              <button
                onClick={handleAddLesson}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#004ac6] rounded hover:bg-[#003ea8]"
              >
                Thêm bài học
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
