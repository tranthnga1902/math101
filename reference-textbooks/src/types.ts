export type MatchStatus = 'matched' | 'unmatched' | 'partial';
export type PublishStatus = 'published' | 'draft';

export interface SgkBook {
  id: string;
  title: string;
  volume: string;
  pdfPageCount: number;
  matchStatus: MatchStatus;
  matchPercentage?: number;
  publishStatus: PublishStatus;
  coverUrl?: string;
  bookCode?: string;
}

export interface Lesson {
  id: string;
  title: string;
  pageRange?: string; // e.g., "Tr 1-5"
  startPage?: number;
  endPage?: number;
  isAttached: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  pageRange?: string;
  lessons: Lesson[];
}

export interface PdfPageThumb {
  pdfPage: number;
  bookPage?: number | null;
  label: string; // e.g. "Bìa", "Mục lục", "Nội dung"
  isMatched?: boolean;
}
