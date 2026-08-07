import { SgkBook, Chapter, PdfPageThumb } from '../types';

export const INITIAL_BOOKS: SgkBook[] = [
  {
    id: 'sgk-1',
    title: 'Toán 10 - Kết nối tri thức với cuộc sống',
    volume: 'Tập 1',
    pdfPageCount: 156,
    matchStatus: 'matched',
    publishStatus: 'published',
    coverUrl: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=150&auto=format&fit=crop&q=80',
    bookCode: 'KNTT-10-1',
  },
  {
    id: 'sgk-2',
    title: 'Toán 10 - Chân trời sáng tạo',
    volume: 'Tập 1',
    pdfPageCount: 142,
    matchStatus: 'unmatched',
    publishStatus: 'draft',
    coverUrl: '', // image_not_supported placeholder
    bookCode: 'CTST-10-1',
  },
  {
    id: 'sgk-3',
    title: 'Toán 10 - Cánh diều',
    volume: 'Tập 2',
    pdfPageCount: 168,
    matchStatus: 'partial',
    matchPercentage: 85,
    publishStatus: 'draft',
    coverUrl: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=150&auto=format&fit=crop&q=80',
    bookCode: 'CD-10-2',
  },
  {
    id: 'sgk-4',
    title: 'Toán 10 - Kết nối tri thức với cuộc sống',
    volume: 'Tập 2',
    pdfPageCount: 148,
    matchStatus: 'matched',
    publishStatus: 'published',
    coverUrl: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=150&auto=format&fit=crop&q=80',
    bookCode: 'KNTT-10-2',
  },
];

export const MOCK_CHAPTERS: Chapter[] = [
  {
    id: 'ch-1',
    title: 'Chương I: Mệnh đề và tập hợp',
    pageRange: 'Tr 1-15',
    lessons: [
      { id: 'les-1', title: 'Bài 1: Mệnh đề', pageRange: 'Tr 1-5', startPage: 1, endPage: 5, isAttached: true },
      { id: 'les-2', title: 'Bài 2: Tập hợp', pageRange: 'Tr 6-10', startPage: 6, endPage: 10, isAttached: true },
      { id: 'les-3', title: 'Bài 3: Các phép toán tập hợp (Chưa gắn)', isAttached: false },
    ],
  },
  {
    id: 'ch-2',
    title: 'Chương II: Bất phương trình',
    pageRange: 'Tr 16-30',
    lessons: [
      { id: 'les-4', title: 'Bài 1: Bất phương trình bậc nhất hai ẩn', pageRange: 'Tr 16-22', startPage: 16, endPage: 22, isAttached: true },
      { id: 'les-5', title: 'Bài 2: Hệ bất phương trình bậc nhất hai ẩn', pageRange: 'Tr 23-30', startPage: 23, endPage: 30, isAttached: true },
    ],
  },
  {
    id: 'ch-3',
    title: 'Chương III: Hàm số và đồ thị',
    pageRange: 'Tr 31-50',
    lessons: [
      { id: 'les-6', title: 'Bài 1: Hàm số và tập xác định', pageRange: 'Tr 31-38', startPage: 31, endPage: 38, isAttached: true },
      { id: 'les-7', title: 'Bài 2: Hàm số bậc hai', pageRange: 'Tr 39-50', startPage: 39, endPage: 50, isAttached: true },
    ],
  },
];

export const generatePdfThumbs = (totalPages: number = 185, pdfOffset: number = 14): PdfPageThumb[] => {
  const thumbs: PdfPageThumb[] = [
    { pdfPage: 1, bookPage: null, label: 'Bìa', isMatched: false },
    { pdfPage: 2, bookPage: null, label: 'Mục lục', isMatched: false },
    { pdfPage: 3, bookPage: null, label: 'Lời nói đầu', isMatched: false },
  ];

  for (let p = 4; p <= totalPages; p++) {
    const bookP = p > pdfOffset ? p - pdfOffset : null;
    thumbs.push({
      pdfPage: p,
      bookPage: bookP,
      label: 'Nội dung',
      isMatched: p >= 15 && p <= 160,
    });
  }

  return thumbs;
};
