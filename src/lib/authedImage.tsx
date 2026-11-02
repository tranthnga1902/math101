import { useEffect, useState, type ReactNode } from "react";
import { API_BASE_URL } from "../api";
import { LruCache } from "./lruCache";

/**
 * Ảnh do backend phục vụ thì phải tải kèm token rồi mới gắn vào `<img>`.
 *
 * <p>Từ khi bucket R2 chuyển sang private, API không trả URL ảnh thô nữa: `thumbnailUrl` giờ là
 * `/api/documents/{id}/thumbnail`, một endpoint có `@PreAuthorize`. Gắn thẳng đường dẫn đó vào
 * `<img src>` là hỏng hai lần cùng lúc, và cả hai đều im lặng:
 *
 * <ul>
 *   <li>Thẻ `<img>` không gửi được header `Authorization` — trình duyệt chỉ gửi cookie. Backend
 *       trả 401, ảnh không hiện, không có lỗi nào trong console ngoài dòng mạng đỏ.</li>
 *   <li>Đường dẫn tương đối trỏ về chính origin đang mở. Frontend trên Vercel còn backend trên
 *       Render là hai origin khác nhau, nên `/api/...` rơi vào Vercel và ăn 404 trước cả khi
 *       chuyện xác thực kịp xảy ra.</li>
 * </ul>
 *
 * <p>Nên chỗ này gom lại một mối: nối {@link API_BASE_URL}, fetch kèm token, đổi sang data URL.
 * Ảnh bìa hiếm khi đổi mà lại hay được vẽ lại (lọc, tìm kiếm, đổi tab), nên có cache LRU dùng
 * chung — 60 ảnh, đủ cho một màn danh sách mà không phình bộ nhớ khi lướt lâu.
 */
export const anhCache = new LruCache<string, string>(60);

/** Đường dẫn tương đối từ API là tương đối với backend, không phải với trang đang mở. */
export function resolveApiUrl(url: string): string {
  if (!url || /^(https?:|data:|blob:)/i.test(url)) return url;
  return url.startsWith("/") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/${url}`;
}

/** Ảnh phải qua fetch có token nên không gán thẳng vào `<img src>` được; đổi sang data URL. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Không đọc được ảnh"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Trả về `src` dùng được cho `<img>`, hoặc null khi chưa có.
 *
 * <p>Nơi gọi tự vẽ lấy thẻ `<img>` của mình: mỗi màn hình có khung ảnh một cỡ khác nhau, gói
 * chung vào một component thì cỡ ảnh phải truyền qua className và Tailwind không đảm bảo class
 * truyền vào thắng được class mặc định — thứ tự trong file CSS mới quyết định, chứ không phải
 * thứ tự trong chuỗi.
 *
 * <p>URL tuyệt đối (ảnh video YouTube chẳng hạn) đi thẳng, không fetch: gắn header Authorization
 * vào một host ngoài vừa vô nghĩa vừa làm CORS chặn.
 */
export function useAuthedImage(url: string | null | undefined, accessToken?: string) {
  const ngoai = !!url && /^(https?:|data:|blob:)/i.test(url);
  const [src, setSrc] = useState<string | null>(ngoai ? url! : null);
  const [loi, setLoi] = useState(false);

  useEffect(() => {
    if (!url) { setSrc(null); setLoi(false); return; }
    if (/^(https?:|data:|blob:)/i.test(url)) { setSrc(url); setLoi(false); return; }

    const resolved = resolveApiUrl(url);
    const daCo = anhCache.get(resolved);
    if (daCo) { setSrc(daCo); setLoi(false); return; }

    let huy = false;
    setSrc(null);
    setLoi(false);
    (async () => {
      try {
        const headers: Record<string, string> = {};
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
        const res = await fetch(resolved, { headers, credentials: "include" });
        if (!res.ok) throw new Error(`Tải ảnh thất bại (${res.status})`);
        const dataUrl = await blobToDataUrl(await res.blob());
        anhCache.set(resolved, dataUrl);
        if (!huy) setSrc(dataUrl);
      } catch {
        if (!huy) setLoi(true);
      }
    })();
    return () => { huy = true; };
  }, [url, accessToken]);

  return { src, loi, dangTai: !!url && !src && !loi };
}

/**
 * Ảnh từ backend, kèm chỗ thay thế khi chưa có hoặc tải hỏng.
 *
 * <p>Hook phải gọi ở thân component nên không dùng thẳng trong `.map()` được — mà mọi chỗ hiện
 * ảnh bìa đều nằm trong một vòng lặp danh sách. Component mỏng này là chỗ để đặt hook.
 *
 * <p>Không có className mặc định: nơi gọi tự quyết cỡ ảnh. Trộn class mặc định với class truyền
 * vào thì bên nào thắng do thứ tự trong file CSS quyết định chứ không phải thứ tự trong chuỗi,
 * nên một ô 48px có thể lặng lẽ bị kéo thành 132px.
 */
export function AuthedImage({ url, accessToken, alt = "", className, fallback = null }: {
  url: string | null | undefined;
  accessToken?: string;
  alt?: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const { src } = useAuthedImage(url, accessToken);
  if (!src) return <>{fallback}</>;
  return <img src={src} alt={alt} loading="lazy" className={className} />;
}
