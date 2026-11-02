import * as pdfjsLib from "pdfjs-dist";
// Vite bundle worker thành asset và trả URL — giống PdfThumbnail.tsx.
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { API_BASE_URL } from "../api";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * OCR PDF dạng ảnh/scan ngay trên trình duyệt: pdfjs vẽ từng trang ra canvas, rồi
 * tesseract.js (WASM) nhận dạng chữ tiếng Việt. Backend không có OCR nên toàn bộ việc
 * nặng chạy ở máy Admin; kết quả được gửi lên lưu vào contentMarkdown.
 *
 * tesseract.js tải worker + core WASM + dữ liệu ngôn ngữ từ CDN jsdelivr (mặc định của
 * thư viện, khoảng 5 MB cho lần đầu, sau đó trình duyệt cache lại). Vì vậy máy Admin
 * phải có mạng ra ngoài lần đầu dùng.
 *
 * Giới hạn thật của cách này: chữ thường khá tốt, nhưng công thức toán, ký hiệu và bảng
 * sẽ sai nhiều — kết quả luôn cần Admin đọc lại và sửa tay.
 */

export type OcrPhase = "download" | "prepare" | "page";
export type OcrProgress = { phase: OcrPhase; page: number; total: number };
export type OcrResult = { markdown: string; pages: number; truncated: boolean };

/** Người dùng bấm hủy giữa lúc đang OCR — không phải lỗi, UI không hiện thông báo đỏ. */
export class OcrCancelled extends Error {
  constructor() {
    super("Đã hủy nhận dạng chữ");
    this.name = "OcrCancelled";
  }
}

/** Bề rộng ảnh đưa vào Tesseract. ~200 DPI với trang A4 — đủ chính xác, chưa ngốn RAM. */
const TARGET_WIDTH = 1800;
/** OCR mỗi trang mất vài giây; chặn ở đây để không treo trình duyệt với sách vài trăm trang. */
const MAX_PAGES = 40;

function resolvePdfUrl(fileUrl: string): string {
  // fileUrl từ API là đường dẫn tương đối tới endpoint có xác thực của backend
  // (/api/documents/{id}/content.pdf), nên không phụ thuộc cấu hình CORS của domain R2.
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  if (!fileUrl) return fileUrl;
  return fileUrl.startsWith("/") ? `${API_BASE_URL}${fileUrl}` : `${API_BASE_URL}/${fileUrl}`;
}

async function fetchPdfBytes(fileUrl: string, accessToken?: string): Promise<ArrayBuffer> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(resolvePdfUrl(fileUrl), { headers, credentials: "include" });
  if (!response.ok) throw new Error(`Không tải được file PDF (${response.status})`);
  return response.arrayBuffer();
}

/**
 * Gom text thô của Tesseract thành các khối cách nhau bởi dòng trống. Giữ nguyên ngắt dòng
 * bên trong một khối vì MarkdownContent render mỗi \n thành <br/> — với đề toán thì mỗi câu
 * nằm đúng một dòng quan trọng hơn là gộp thành đoạn văn liền mạch.
 */
function tidy(rawText: string): string {
  const lines = rawText.replace(/\r\n?/g, "\n").split("\n").map(line => line.replace(/[ \t]+/g, " ").trim());
  const blocks: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line) {
      current.push(line);
      continue;
    }
    if (current.length) {
      blocks.push(current.join("\n"));
      current = [];
    }
  }
  if (current.length) blocks.push(current.join("\n"));
  return blocks.join("\n\n");
}

async function renderPageToCanvas(pdf: pdfjsLib.PDFDocumentProxy, pageNumber: number): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNumber);
  const unscaled = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(4, TARGET_WIDTH / unscaled.width) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Không tạo được canvas để vẽ trang PDF");
  // Tesseract nhận dạng tốt hơn trên nền trắng đục; PDF trong suốt sẽ ra nền đen.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport }).promise;
  page.cleanup();
  return canvas;
}

export async function ocrPdfToMarkdown({
  fileUrl,
  file,
  bareText,
  accessToken,
  onProgress,
  isCancelled,
}: {
  /** Đường dẫn tới file trên máy chủ. Bỏ qua khi đã có sẵn `file` trong tay trình duyệt. */
  fileUrl?: string;
  /** File người dùng vừa chọn: đọc thẳng, không phải tải lại từ máy chủ. */
  file?: Blob;
  /**
   * Chỉ lấy chữ, không thêm tiêu đề "## Trang N" và lời cảnh báo. Bộ tách câu của đường ống đề thi
   * đọc từng dòng, nên mỗi dòng trang trí là một khối rác nằm giữa các câu.
   */
  bareText?: boolean;
  accessToken?: string;
  onProgress?: (progress: OcrProgress) => void;
  isCancelled?: () => boolean;
}): Promise<OcrResult> {
  onProgress?.({ phase: "download", page: 0, total: 0 });
  const bytes = file ? await file.arrayBuffer() : await fetchPdfBytes(fileUrl ?? "", accessToken);
  const pdf = await pdfjsLib.getDocument({ data: bytes, isEvalSupported: false }).promise;
  const total = Math.min(pdf.numPages, MAX_PAGES);

  onProgress?.({ phase: "prepare", page: 0, total });
  // Nạp động: tesseract.js nặng, không nên nằm trong bundle chính của mọi vai trò.
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["vie", "eng"]);

  try {
    const sections: string[] = [];
    for (let pageNumber = 1; pageNumber <= total; pageNumber++) {
      if (isCancelled?.()) throw new OcrCancelled();
      onProgress?.({ phase: "page", page: pageNumber, total });
      const canvas = await renderPageToCanvas(pdf, pageNumber);
      try {
        const { data } = await worker.recognize(canvas);
        const body = tidy(data.text);
        if (body) sections.push(bareText ? body : `## Trang ${pageNumber}\n\n${body}`);
      } finally {
        // Thả ảnh ngay: 40 canvas ~1800px giữ lại cùng lúc là vài trăm MB.
        canvas.width = 0;
        canvas.height = 0;
      }
    }

    if (!sections.length) {
      throw new Error("Không nhận dạng được chữ nào — ảnh trong PDF có thể quá mờ hoặc bị nghiêng");
    }
    const truncated = pdf.numPages > total;
    if (bareText) return { markdown: sections.join("\n\n"), pages: total, truncated };
    const header = [
      "## Nội dung nhận dạng tự động (OCR)",
      `Bản này do máy đọc từ PDF scan${truncated ? ` — chỉ ${total} trang đầu trong ${pdf.numPages} trang` : ""}. Công thức toán và ký hiệu có thể sai, cần đọc lại và sửa trước khi cho học sinh dùng.`,
    ].join("\n\n");
    return { markdown: [header, ...sections].join("\n\n"), pages: total, truncated };
  } finally {
    await worker.terminate();
    void pdf.destroy();
  }
}
