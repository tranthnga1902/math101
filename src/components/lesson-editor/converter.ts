import type { JSONContent } from "@tiptap/core";

/**
 * Kiểm tra xem chuỗi nội dung có phải là tài liệu JSON có cấu trúc (Structured Lesson Document) hay không.
 */
export function isStructuredLesson(content: string | null | undefined): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return false;
  try {
    const parsed = JSON.parse(trimmed);
    return Boolean(
      parsed &&
      typeof parsed === "object" &&
      parsed.type === "doc" &&
      Array.isArray(parsed.content)
    );
  } catch {
    return false;
  }
}

/**
 * Phân giải chuỗi nội dung an toàn thành JSONContent.
 */
export function safeParseStructuredLesson(content: string | null | undefined): JSONContent | null {
  if (!isStructuredLesson(content)) return null;
  try {
    return JSON.parse(content!.trim()) as JSONContent;
  } catch {
    return null;
  }
}

/**
 * Tạo tài liệu rỗng chuẩn.
 */
export function createEmptyLessonDoc(): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
      },
    ],
  };
}

/**
 * Tuần tự hóa JSONContent thành chuỗi JSON lưu vào CSDL.
 */
export function serializeLessonDoc(doc: JSONContent): string {
  return JSON.stringify(doc);
}

/**
 * Trích xuất text nodes từ HTML inline element (hỗ trợ bold, italic, text).
 */
function parseInlineContent(element: Node): JSONContent[] {
  const result: JSONContent[] = [];

  element.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || "";
      if (text) {
        result.push({ type: "text", text });
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tagName = el.tagName.toLowerCase();
      const text = el.textContent || "";

      if (!text) return;

      const marks: Array<{ type: string }> = [];
      if (tagName === "strong" || tagName === "b") marks.push({ type: "bold" });
      if (tagName === "em" || tagName === "i") marks.push({ type: "italic" });
      if (tagName === "code") marks.push({ type: "code" });
      if (tagName === "s" || tagName === "del") marks.push({ type: "strike" });

      if (marks.length > 0) {
        result.push({ type: "text", text, marks });
      } else {
        result.push(...parseInlineContent(el));
      }
    }
  });

  return result.length > 0 ? result : [{ type: "text", text: element.textContent || "" }];
}

/**
 * Chuyển đổi một phần tử list (ul/ol) sang block list của Tiptap.
 */
function parseListElement(listEl: HTMLOListElement | HTMLUListElement): JSONContent {
  const isOrdered = listEl.tagName.toLowerCase() === "ol";
  const items: JSONContent[] = [];

  listEl.querySelectorAll(":scope > li").forEach((li) => {
    const inline = parseInlineContent(li);
    items.push({
      type: "listItem",
      content: [
        {
          type: "paragraph",
          content: inline.length > 0 ? inline : [{ type: "text", text: li.textContent || "" }],
        },
      ],
    });
  });

  return {
    type: isOrdered ? "orderedList" : "bulletList",
    content: items,
  };
}

/**
 * Phân tích khối HTML cũ (Legacy HTML) và chuyển đổi sang Structured Blocks của Tiptap.
 * Hỗ trợ nhận diện các cấu trúc:
 * - Thẻ h1, h2, h3, h4 -> heading
 * - Box border-emerald, border-l-4 -> definitionBlock
 * - Box bg-amber, border-amber -> exampleBlock
 * - Box bg-blue -> noteBlock
 * - Box bg-rose, border-red -> warningBlock
 * - ul, ol -> bulletList, orderedList
 * - Công thức toán độc lập $$...$$ -> formulaBlock
 */
export function convertLegacyHtmlToStructured(html: string): JSONContent {
  if (!html || !html.trim()) {
    return createEmptyLessonDoc();
  }

  // Nếu bản thân chuỗi đã là JSON chuẩn thì trả về luôn
  if (isStructuredLesson(html)) {
    return safeParseStructuredLesson(html)!;
  }

  // Nếu là chuỗi text thuần không có thẻ HTML
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    const paragraphs = html
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (paragraphs.length === 0) return createEmptyLessonDoc();

    return {
      type: "doc",
      content: paragraphs.map((p) => {
        if (/^\$\$([\s\S]+)\$\$$/.test(p)) {
          const match = p.match(/^\$\$([\s\S]+)\$\$$/);
          return {
            type: "formulaBlock",
            attrs: { latex: (match ? match[1] : p).trim() },
          };
        }
        return {
          type: "paragraph",
          content: [{ type: "text", text: p }],
        };
      }),
    };
  }

  // Sử dụng DOMParser để bóc tách cấu trúc HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.body;

  const content: JSONContent[] = [];

  function processElement(el: HTMLElement) {
    const tagName = el.tagName.toLowerCase();
    const className = (el.className || "").toLowerCase();
    const textContent = (el.textContent || "").trim();

    // 1. Thẻ Tiêu đề (Heading)
    if (/^h[1-6]$/.test(tagName)) {
      const level = Math.min(Number(tagName.slice(1)), 3);
      content.push({
        type: "heading",
        attrs: { level },
        content: parseInlineContent(el),
      });
      return;
    }

    // 2. Kiểm tra các Khối sư phạm (Callout Blocks)
    const isDefinition =
      className.includes("emerald") ||
      className.includes("border-emerald") ||
      className.includes("callout-definition") ||
      (className.includes("border-l-4") && textContent.includes("Định nghĩa"));

    const isExample =
      className.includes("amber") ||
      className.includes("yellow") ||
      className.includes("callout-example") ||
      textContent.startsWith("Ví dụ");

    const isWarning =
      className.includes("rose") ||
      className.includes("red") ||
      className.includes("warn") ||
      className.includes("cảnh báo") ||
      className.includes("lưu ý");

    const isNote =
      className.includes("blue") ||
      className.includes("info") ||
      className.includes("ghi chú") ||
      className.includes("note");

    if (isDefinition || isExample || isWarning || isNote) {
      const blockType = isDefinition
        ? "definitionBlock"
        : isExample
        ? "exampleBlock"
        : isWarning
        ? "warningBlock"
        : "noteBlock";

      const defaultTitle = isDefinition
        ? "Định nghĩa"
        : isExample
        ? "Ví dụ"
        : isWarning
        ? "Cảnh báo"
        : "Ghi chú";

      // Trích xuất tiêu đề nếu có thẻ strong hoặc b đầu tiên
      let title = defaultTitle;
      const firstStrong = el.querySelector("strong, b, .font-bold");
      if (firstStrong && firstStrong.textContent?.trim().length && firstStrong.textContent.trim().length < 40) {
        title = firstStrong.textContent.trim().replace(/[:.]$/, "");
      }

      // Xây dựng các block con bên trong callout
      const innerBlocks: JSONContent[] = [];
      const childLists = el.querySelectorAll(":scope > ul, :scope > ol");
      const childParagraphs = el.querySelectorAll(":scope > p, :scope > div");

      if (childParagraphs.length > 0 || childLists.length > 0) {
        el.childNodes.forEach((child) => {
          if (child.nodeType === Node.ELEMENT_NODE) {
            const childEl = child as HTMLElement;
            const cTag = childEl.tagName.toLowerCase();
            if (cTag === "ul" || cTag === "ol") {
              innerBlocks.push(parseListElement(childEl as HTMLUListElement | HTMLOListElement));
            } else if (childEl.textContent?.trim()) {
              innerBlocks.push({
                type: "paragraph",
                content: parseInlineContent(childEl),
              });
            }
          }
        });
      }

      if (innerBlocks.length === 0) {
        innerBlocks.push({
          type: "paragraph",
          content: parseInlineContent(el),
        });
      }

      content.push({
        type: blockType,
        attrs: { title },
        content: innerBlocks,
      });
      return;
    }

    // 3. Danh sách (Lists)
    if (tagName === "ul" || tagName === "ol") {
      content.push(parseListElement(el as HTMLUListElement | HTMLOListElement));
      return;
    }

    // 4. Khối công thức Toán độc lập
    if (/^\$\$([\s\S]+)\$\$$/.test(textContent)) {
      const match = textContent.match(/^\$\$([\s\S]+)\$\$$/);
      content.push({
        type: "formulaBlock",
        attrs: { latex: (match ? match[1] : textContent).trim() },
      });
      return;
    }

    // 5. Thẻ Section / Div cha (đệ quy kiểm tra các con)
    if (tagName === "section" || (tagName === "div" && (className.includes("theory") || className.includes("space-y")))) {
      Array.from(el.children).forEach((child) => processElement(child as HTMLElement));
      return;
    }

    // 6. Thẻ Đoạn văn (Paragraph) hoặc thẻ khác
    if (textContent) {
      content.push({
        type: "paragraph",
        content: parseInlineContent(el),
      });
    }
  }

  Array.from(body.children).forEach((child) => {
    processElement(child as HTMLElement);
  });

  if (content.length === 0) {
    return createEmptyLessonDoc();
  }

  return {
    type: "doc",
    content,
  };
}

