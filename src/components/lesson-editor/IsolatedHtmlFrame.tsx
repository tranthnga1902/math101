import React, { useLayoutEffect, useMemo, useRef, useState } from "react";

/**
 * Trang HTML hoàn chỉnh (có <style>/<script> riêng) được soạn ngoài hệ thống.
 * Chèn thẳng vào trang thì CSS của nó đè lên giao diện và script phải bị gỡ,
 * nên hiển thị trong iframe sandbox: giữ nguyên định dạng và tương tác của file.
 *
 * sandbox chỉ có "allow-scripts", KHÔNG có "allow-same-origin": script trong file
 * chạy ở origin rỗng, không đọc được cookie, localStorage hay token của ứng dụng,
 * không mở popup, không điều hướng trang cha, không gửi form.
 */
export function isFullHtmlDocument(html: string | null | undefined): boolean {
  if (!html) return false;
  return /<(style|script|html|head|body|link)[\s>]/i.test(html);
}

const HEIGHT_REPORTER = `<script>(function(){
  function send(){
    var h=Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0);
    parent.postMessage({__lessonFrameHeight:h},"*");
  }
  window.addEventListener("load",send);
  window.addEventListener("resize",send);
  if(window.ResizeObserver){new ResizeObserver(send).observe(document.documentElement);}
  [50,300,1000,2500].forEach(function(t){setTimeout(send,t);});
})();</script>`;

function withHeightReporter(html: string): string {
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${HEIGHT_REPORTER}</body>`);
  return html + HEIGHT_REPORTER;
}

export function IsolatedHtmlFrame({ html, title = "Nội dung bài học" }: { html: string; title?: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(600);
  const srcDoc = useMemo(() => withHeightReporter(html), [html]);

  // Đăng ký trước khi iframe kịp tải, để không lỡ tin báo chiều cao đầu tiên
  useLayoutEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const h = Number(event.data?.__lessonFrameHeight);
      if (Number.isFinite(h) && h > 0) setHeight(Math.ceil(h));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={frameRef}
      title={title}
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      style={{ width: "100%", height, border: 0, display: "block", borderRadius: 12 }}
    />
  );
}
