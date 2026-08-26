import { X } from "lucide-react";

export function youtubeEmbedUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (url.pathname === "/watch") id = url.searchParams.get("v") ?? "";
      else if (/^\/(embed|shorts|live)\//.test(url.pathname)) id = url.pathname.split("/")[2] ?? "";
    }
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
  } catch {
    return null;
  }
}

export function youtubeThumbnailUrl(value: string): string | null {
  const embed = youtubeEmbedUrl(value);
  const id = embed?.match(/\/embed\/([A-Za-z0-9_-]{11})/)?.[1];
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
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
