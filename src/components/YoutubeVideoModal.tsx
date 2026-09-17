import { X } from "lucide-react";

/**
 * Trích xuất mã ID 11 ký tự của YouTube từ mọi dạng link phổ biến:
 * - https://www.youtube.com/watch?v=VIDEO_ID (và /watch/?v=..., tham số phụ &t=..., &list=..., &feature=...)
 * - https://youtu.be/VIDEO_ID (và ?si=..., ?t=...)
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/live/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 * - Link thiếu scheme: youtube.com/watch?v=..., youtu.be/..., www.youtube.com/...
 * - Mã iframe nhúng: <iframe src="https://www.youtube.com/embed/VIDEO_ID"...>
 */
export function extractYoutubeId(value: string): string | null {
  if (!value || typeof value !== "string") return null;
  let str = value.trim();
  if (!str) return null;

  // Nếu người dùng dán cả đoạn mã nhúng iframe <iframe src="...">
  const iframeSrc = /src=["']([^"']+)["']/i.exec(str);
  if (iframeSrc) {
    str = iframeSrc[1].trim();
  }

  // Tự động bổ sung https:// nếu thiếu giao thức để URL parser phân tích được
  if (!/^https?:\/\//i.test(str)) {
    str = "https://" + str;
  }

  try {
    const parsed = new URL(str);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

    // Dạng youtu.be/ID
    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id;
    }

    // Dạng youtube.com, m.youtube.com, music.youtube.com
    if (host === "youtube.com" || host.endsWith(".youtube.com") || host.endsWith("youtube-nocookie.com")) {
      // /watch?v=ID hoặc /watch/?v=ID
      const v = parsed.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;

      // /embed/ID, /shorts/ID, /live/ID, /v/ID
      const match = parsed.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/i);
      if (match && match[1]) return match[1];
    }
  } catch {
    // Nếu URL constructor lỗi, dùng regex dự phòng
  }

  // Regex bao quát dự phòng
  const fallback = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([\w-]{11})/i.exec(value);
  if (fallback && /^[A-Za-z0-9_-]{11}$/.test(fallback[1])) {
    return fallback[1];
  }

  return null;
}

/** Trả về URL xem chuẩn https://www.youtube.com/watch?v=ID từ bất kỳ dạng link YouTube nào */
export function canonicalYoutubeUrl(value: string): string {
  const id = extractYoutubeId(value);
  return id ? `https://www.youtube.com/watch?v=${id}` : value.trim();
}

export function youtubeEmbedUrl(value: string): string | null {
  const id = extractYoutubeId(value);
  if (!id) return null;
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
}

export function youtubeThumbnailUrl(value: string): string | null {
  const id = extractYoutubeId(value);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export type ParsedYoutubeItem = {
  id: string;
  youtubeId: string;
  canonicalUrl: string;
  thumbnailUrl: string;
  title: string;
};

/**
 * Phân tích danh sách link YouTube từ văn bản nhiều dòng hoặc phân cách bởi dấu phẩy/chấm phẩy.
 * Tự động loại bỏ trùng lặp và sinh tiêu đề mặc định.
 */
export function parseYoutubeList(input: string, defaultPrefix = "Video YouTube"): ParsedYoutubeItem[] {
  if (!input || typeof input !== "string") return [];
  const lines = input
    .split(/[\r\n,;]+/)
    .map(line => line.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const results: ParsedYoutubeItem[] = [];

  for (const line of lines) {
    const id = extractYoutubeId(line);
    if (!id || seen.has(id)) continue;
    seen.add(id);

    results.push({
      id: `${id}-${results.length + 1}`,
      youtubeId: id,
      canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      title: `${defaultPrefix} ${results.length + 1}`,
    });
  }

  return results;
}

export function YoutubeVideoModal({ title, url, onClose }: { title: string; url: string; onClose: () => void }) {
  const embedUrl = youtubeEmbedUrl(url);
  if (!embedUrl) return null;
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-5xl overflow-hidden rounded-xl bg-black shadow-2xl">
      <header className="flex min-h-14 items-center justify-between gap-4 bg-slate-950 px-4 text-white">
        <h2 className="truncate text-base font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Đóng video" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-white/15"><X size={20}/></button>
      </header>
      <div className="aspect-video w-full">
        <iframe
          className="h-full w-full border-0"
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation"
        />
      </div>
    </section>
  </div>;
}
