import React, { useState } from 'react';
import { SgkBook } from '../types';

interface SgkListDashboardProps {
  books: SgkBook[];
  onOpenUpload: () => void;
  onOpenMapping: (book: SgkBook) => void;
  onTogglePublish: (bookId: string) => void;
  searchTerm: string;
}

export const SgkListDashboard: React.FC<SgkListDashboardProps> = ({
  books,
  onOpenUpload,
  onOpenMapping,
  onTogglePublish,
  searchTerm,
}) => {
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);

  const filteredBooks = books.filter(
    (b) =>
      b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.volume.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main className="pt-[80px] pl-[264px] pr-[24px] w-full min-h-screen pb-12 flex flex-col gap-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center w-full">
        <div>
          <h1 className="text-[32px] leading-[40px] font-bold text-[#131b2e]">
            Quản lý Sách Giáo Khoa
          </h1>
          <p className="text-base font-normal text-[#434655] mt-1">
            Danh sách SGK môn Toán lớp 10 chương trình GDPT 2018.
          </p>
        </div>

        <button
          onClick={onOpenUpload}
          className="h-[40px] px-6 bg-[#004ac6] text-white rounded font-medium text-xs tracking-wider flex items-center gap-2 hover:bg-[#003ea8] transition-colors shadow-xs cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">upload</span>
          Tải lên SGK
        </button>
      </div>

      {/* Data Table Container */}
      <div className="bg-white border border-[#c3c6d7] rounded-lg overflow-hidden flex flex-col shadow-xs">
        {/* Table Header */}
        <div className="bg-[#F1F5F9] border-b border-[#c3c6d7] px-4 flex items-center h-[44px] text-sm font-bold text-[#434655] sticky top-0 z-10">
          <div className="w-[80px]">Ảnh bìa</div>
          <div className="flex-1">Tên SGK</div>
          <div className="w-[80px] text-center">Tập</div>
          <div className="w-[120px] text-center">Số trang PDF</div>
          <div className="w-[180px]">Trạng thái khớp trang</div>
          <div className="w-[160px]">Trạng thái xuất bản</div>
          <div className="w-[120px] text-right">Thao tác</div>
        </div>

        {/* Table Body */}
        <div className="flex flex-col divide-y divide-[#c3c6d7]">
          {filteredBooks.length === 0 ? (
            <div className="p-8 text-center text-[#737686]">
              Không tìm thấy sách giáo khoa phù hợp.
            </div>
          ) : (
            filteredBooks.map((book) => {
              const isMatched = book.matchStatus === 'matched';
              const isPartial = book.matchStatus === 'partial';
              const isUnmatched = book.matchStatus === 'unmatched';
              const isPublished = book.publishStatus === 'published';

              return (
                <div
                  key={book.id}
                  className="flex items-center px-4 h-[72px] hover:bg-[#F1F5F9] transition-colors text-sm text-[#131b2e]"
                >
                  {/* Cover image column */}
                  <div className="w-[80px]">
                    {book.coverUrl ? (
                      <img
                        src={book.coverUrl}
                        alt={book.title}
                        className="w-[48px] h-[64px] object-cover border border-[#c3c6d7] rounded shadow-xs"
                      />
                    ) : (
                      <div className="w-[48px] h-[64px] bg-[#eaedff] flex items-center justify-center border border-[#c3c6d7] rounded text-[#737686]">
                        <span className="material-symbols-outlined text-[24px]">
                          image_not_supported
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Title column */}
                  <div className="flex-1 font-semibold text-[#131b2e] truncate pr-4">
                    {book.title}
                  </div>

                  {/* Volume column */}
                  <div className="w-[80px] text-center text-[#434655] font-medium">
                    {book.volume}
                  </div>

                  {/* PDF Page count column */}
                  <div className="w-[120px] text-center text-[#434655] font-medium">
                    {book.pdfPageCount}
                  </div>

                  {/* Page Match Status Column */}
                  <div className="w-[180px]">
                    {isMatched && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded h-[24px] bg-[#E6F4EA] text-[#006e2d] border border-[#006e2d]/20 text-[12px] font-medium">
                        <span className="material-symbols-outlined text-[14px]">
                          check_circle
                        </span>
                        Đã khớp
                      </div>
                    )}
                    {isUnmatched && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded h-[24px] bg-[#FFF3E0] text-[#E65100] border border-[#E65100]/20 text-[12px] font-medium">
                        <span className="material-symbols-outlined text-[14px]">warning</span>
                        Chưa khớp
                      </div>
                    )}
                    {isPartial && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded h-[24px] bg-[#FFF3E0] text-[#E65100] border border-[#E65100]/20 text-[12px] font-medium">
                        <span className="material-symbols-outlined text-[14px]">error</span>
                        Khớp một phần ({book.matchPercentage || 85}%)
                      </div>
                    )}
                  </div>

                  {/* Publish Status Column */}
                  <div className="w-[160px] flex items-center gap-2">
                    {isPublished ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded h-[24px] bg-[#dbe1ff] text-[#004ac6] font-medium text-[12px]">
                        Đã xuất bản
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <button
                            disabled={!isMatched}
                            onClick={() => isMatched && onTogglePublish(book.id)}
                            onMouseEnter={() =>
                              !isMatched && setHoveredTooltip(`pub-${book.id}`)
                            }
                            onMouseLeave={() => setHoveredTooltip(null)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded h-[28px] border text-[12px] font-medium transition-colors ${
                              isMatched
                                ? 'border-[#004ac6] text-[#004ac6] hover:bg-[#dbe1ff] cursor-pointer'
                                : 'border-[#c3c6d7] text-[#737686] bg-[#f2f3ff] opacity-60 cursor-not-allowed'
                            }`}
                          >
                            Xuất bản
                          </button>

                          {/* Tooltip for disabled publish button */}
                          {!isMatched && hoveredTooltip === `pub-${book.id}` && (
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-[210px] p-2 bg-[#333333] text-white text-[11px] rounded shadow-lg z-30 pointer-events-none text-left">
                              Phải hoàn thành khớp trang PDF trước khi có thể xuất bản.
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#333333]"></div>
                            </div>
                          )}
                        </div>
                        <span className="text-[12px] text-[#434655]">Bản nháp</span>
                      </div>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="w-[120px] flex justify-end gap-2 text-[#737686]">
                    {/* Action button 1: Primary match action */}
                    {isMatched ? (
                      <button
                        onClick={() => onOpenMapping(book)}
                        onMouseEnter={() => setHoveredTooltip(`prev-${book.id}`)}
                        onMouseLeave={() => setHoveredTooltip(null)}
                        title="Xem trước"
                        className="hover:text-[#004ac6] transition-colors relative p-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          visibility
                        </span>
                        {hoveredTooltip === `prev-${book.id}` && (
                          <div className="absolute right-0 bottom-full mb-1 px-2 py-1 bg-[#333] text-white text-[11px] rounded whitespace-nowrap z-20">
                            Xem trước
                          </div>
                        )}
                      </button>
                    ) : isUnmatched ? (
                      <button
                        onClick={() => onOpenMapping(book)}
                        onMouseEnter={() => setHoveredTooltip(`match-${book.id}`)}
                        onMouseLeave={() => setHoveredTooltip(null)}
                        title="Khớp trang ngay"
                        className="text-[#004ac6] hover:text-[#003ea8] transition-colors relative p-1 cursor-pointer"
                      >
                        <span
                          className="material-symbols-outlined text-[20px] fill"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          dataset_linked
                        </span>
                        {hoveredTooltip === `match-${book.id}` && (
                          <div className="absolute right-0 bottom-full mb-1 px-2 py-1 bg-[#333] text-white text-[11px] rounded whitespace-nowrap z-20">
                            Khớp trang ngay
                          </div>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => onOpenMapping(book)}
                        onMouseEnter={() => setHoveredTooltip(`cont-${book.id}`)}
                        onMouseLeave={() => setHoveredTooltip(null)}
                        title="Tiếp tục khớp"
                        className="hover:text-[#004ac6] transition-colors relative p-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          dataset_linked
                        </span>
                        {hoveredTooltip === `cont-${book.id}` && (
                          <div className="absolute right-0 bottom-full mb-1 px-2 py-1 bg-[#333] text-white text-[11px] rounded whitespace-nowrap z-20">
                            Tiếp tục khớp
                          </div>
                        )}
                      </button>
                    )}

                    {/* Action button 2: Edit */}
                    <button
                      onClick={() => onOpenMapping(book)}
                      onMouseEnter={() => setHoveredTooltip(`edit-${book.id}`)}
                      onMouseLeave={() => setHoveredTooltip(null)}
                      title="Chỉnh sửa"
                      className="hover:text-[#004ac6] transition-colors relative p-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                      {hoveredTooltip === `edit-${book.id}` && (
                        <div className="absolute right-0 bottom-full mb-1 px-2 py-1 bg-[#333] text-white text-[11px] rounded whitespace-nowrap z-20">
                          Chỉnh sửa
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Table Footer / Pagination */}
        <div className="bg-white border-t border-[#c3c6d7] px-4 py-3 flex items-center justify-between text-sm text-[#434655]">
          <div>Hiển thị {filteredBooks.length} kết quả</div>
          <div className="flex gap-1 items-center">
            <button
              disabled
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#eaedff] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded bg-[#004ac6] text-white font-medium text-xs">
              1
            </button>
            <button
              disabled
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#eaedff] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};
