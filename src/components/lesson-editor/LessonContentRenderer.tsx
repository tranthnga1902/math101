import React, { useMemo, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { JSONContent } from "@tiptap/core";
import { isStructuredLesson, safeParseStructuredLesson } from "./converter";
import { BookOpen, Lightbulb, Info, AlertTriangle, Copy, Check } from "lucide-react";
import "./lesson-renderer.css";
import { IsolatedHtmlFrame, isFullHtmlDocument } from "./IsolatedHtmlFrame";

interface LessonContentRendererProps {
  content: string | null | undefined;
  fallbackSummary?: string | null;
  className?: string;
}

/**
 * Xử lý văn bản có chứa ký hiệu toán học $inline$ hoặc $$display$$ sang KaTeX.
 */
function renderMathInText(text: string): string {
  if (!text) return "";
  let processed = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return tex;
    }
  });
  return processed.replace(/\$([^\$\n\r]+?)\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return tex;
    }
  });
}

/**
 * Render inline marks (bold, italic, code, strike, link) và text math.
 */
function InlineContent({ node }: { node: JSONContent }) {
  if (node.type === "mathInline") {
    const latex = node.attrs?.latex || "";
    const html = useMemo(() => {
      try {
        return katex.renderToString(latex, { displayMode: false, throwOnError: false });
      } catch {
        return latex;
      }
    }, [latex]);
    return <span className="inline-math align-baseline" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  let text = node.text || "";
  const renderedText = useMemo(() => renderMathInText(text), [text]);

  let element = <span dangerouslySetInnerHTML={{ __html: renderedText }} />;

  if (node.marks && node.marks.length > 0) {
    node.marks.forEach((mark) => {
      if (mark.type === "bold") {
        element = <strong>{element}</strong>;
      } else if (mark.type === "italic") {
        element = <em>{element}</em>;
      } else if (mark.type === "strike") {
        element = <del>{element}</del>;
      } else if (mark.type === "code") {
        element = <code className="px-1 py-0.5 rounded bg-slate-100 font-mono text-xs text-rose-600">{element}</code>;
      } else if (mark.type === "link") {
        element = (
          <a
            href={mark.attrs?.href || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-emerald-700"
          >
            {element}
          </a>
        );
      }
    });
  }

  return element;
}

/**
 * Khối công thức hiển thị riêng dòng có nút Copy LaTeX.
 */
function FormulaBlockView({ latex }: { latex: string }) {
  const [copied, setCopied] = useState(false);

  const html = useMemo(() => {
    try {
      return katex.renderToString(latex.trim() || "\\dots", {
        displayMode: true,
        throwOnError: false,
      });
    } catch {
      return `<span class="text-rose-500">${latex}</span>`;
    }
  }, [latex]);

  const copy = () => {
    navigator.clipboard.writeText(latex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="lesson-formula-display group">
      <button
        type="button"
        onClick={copy}
        className="formula-copy-btn flex items-center gap-1 cursor-pointer"
        title="Sao chép LaTeX"
      >
        {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
        <span>{copied ? "Đã chép" : "Copy"}</span>
      </button>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

/**
 * Render đệ quy các block của Structured Lesson Document.
 */
function RenderBlock({ node, index }: { node: JSONContent; index: number }) {
  switch (node.type) {
    case "heading": {
      const level = node.attrs?.level || 2;
      const Tag = `h${Math.min(Math.max(level, 1), 3)}` as "h1" | "h2" | "h3";
      return (
        <Tag key={index}>
          {node.content?.map((child, i) => (
            <InlineContent key={i} node={child} />
          ))}
        </Tag>
      );
    }

    case "paragraph": {
      return (
        <p key={index}>
          {node.content?.map((child, i) => (
            <InlineContent key={i} node={child} />
          ))}
        </p>
      );
    }

    case "bulletList": {
      return (
        <ul key={index}>
          {node.content?.map((item, i) => (
            <li key={i}>
              {item.content?.map((pNode, j) =>
                pNode.type === "paragraph" ? (
                  pNode.content?.map((inline, k) => <InlineContent key={k} node={inline} />)
                ) : (
                  <RenderBlock key={j} node={pNode} index={j} />
                )
              )}
            </li>
          ))}
        </ul>
      );
    }

    case "orderedList": {
      return (
        <ol key={index}>
          {node.content?.map((item, i) => (
            <li key={i}>
              {item.content?.map((pNode, j) =>
                pNode.type === "paragraph" ? (
                  pNode.content?.map((inline, k) => <InlineContent key={k} node={inline} />)
                ) : (
                  <RenderBlock key={j} node={pNode} index={j} />
                )
              )}
            </li>
          ))}
        </ol>
      );
    }

    case "definitionBlock": {
      const title = node.attrs?.title || "Định nghĩa";
      return (
        <div key={index} className="lesson-callout callout-definition">
          <div className="callout-header">
            <BookOpen size={16} className="text-[#176b50]" />
            <span className="callout-title font-bold uppercase tracking-wider">{title}</span>
          </div>
          <div className="callout-body">
            {node.content?.map((child, i) => (
              <RenderBlock key={i} node={child} index={i} />
            ))}
          </div>
        </div>
      );
    }

    case "exampleBlock": {
      const title = node.attrs?.title || "Ví dụ";
      return (
        <div key={index} className="lesson-callout callout-example">
          <div className="callout-header">
            <Lightbulb size={16} className="text-amber-600" />
            <span className="callout-title font-bold uppercase tracking-wider">{title}</span>
          </div>
          <div className="callout-body">
            {node.content?.map((child, i) => (
              <RenderBlock key={i} node={child} index={i} />
            ))}
          </div>
        </div>
      );
    }

    case "noteBlock": {
      const title = node.attrs?.title || "Ghi chú";
      return (
        <div key={index} className="lesson-callout callout-note">
          <div className="callout-header">
            <Info size={16} className="text-sky-600" />
            <span className="callout-title font-bold uppercase tracking-wider">{title}</span>
          </div>
          <div className="callout-body">
            {node.content?.map((child, i) => (
              <RenderBlock key={i} node={child} index={i} />
            ))}
          </div>
        </div>
      );
    }

    case "warningBlock": {
      const title = node.attrs?.title || "Cảnh báo / Lưu ý";
      return (
        <div key={index} className="lesson-callout callout-warning">
          <div className="callout-header">
            <AlertTriangle size={16} className="text-rose-600" />
            <span className="callout-title font-bold uppercase tracking-wider">{title}</span>
          </div>
          <div className="callout-body">
            {node.content?.map((child, i) => (
              <RenderBlock key={i} node={child} index={i} />
            ))}
          </div>
        </div>
      );
    }

    case "formulaBlock": {
      return <FormulaBlockView key={index} latex={node.attrs?.latex || ""} />;
    }

    case "table": {
      return (
        <div key={index} className="overflow-x-auto my-3">
          <table>
            <tbody>
              {node.content?.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.content?.map((cell, cIdx) => {
                    const isHeader = cell.type === "tableHeader";
                    const CellTag = isHeader ? "th" : "td";
                    return (
                      <CellTag key={cIdx}>
                        {cell.content?.map((cellChild, pIdx) => (
                          <RenderBlock key={pIdx} node={cellChild} index={pIdx} />
                        ))}
                      </CellTag>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case "image": {
      return (
        <figure key={index} className="my-4 text-center">
          <img
            src={node.attrs?.src}
            alt={node.attrs?.alt || "Hình ảnh bài học"}
            className="max-h-96 mx-auto rounded-lg shadow-sm"
          />
          {node.attrs?.title && (
            <figcaption className="text-xs text-slate-500 mt-1">{node.attrs.title}</figcaption>
          )}
        </figure>
      );
    }

    default:
      return null;
  }
}

/**
 * Renderer tương thích ngược cho dữ liệu HTML cũ (Legacy HTML).
 */
function LegacyLessonContent({ html }: { html: string }) {
  const sanitizedAndRendered = useMemo(() => {
    if (!html) return "";
    // 1. Xử lý công thức KaTeX
    const withMath = renderMathInText(html);

    // 2. Làm sạch thẻ độc hại bằng template parser
    const template = document.createElement("template");
    template.innerHTML = withMath;
    template.content
      .querySelectorAll("script,style,iframe,object,embed,form")
      .forEach((node) => node.remove());
    template.content.querySelectorAll<HTMLElement>("*").forEach((node) => {
      for (const attribute of Array.from(node.attributes)) {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.trim().toLowerCase();
        if (
          name.startsWith("on") ||
          ((name === "href" || name === "src") && value.startsWith("javascript:"))
        ) {
          node.removeAttribute(attribute.name);
        }
      }
    });
    return template.innerHTML;
  }, [html]);

  return <div className="legacy-lesson-html" dangerouslySetInnerHTML={{ __html: sanitizedAndRendered }} />;
}

/**
 * COMPONENT RENDERER DUY NHẤT (Single Source of Truth):
 * Tự động chuyển đổi hiển thị giữa Structured Document JSON và Legacy HTML.
 * Sử dụng đồng nhất ở:
 * - Học sinh xem bài giảng (LessonDetailPage.tsx)
 * - Admin xem trước bài giảng (Drawer preview trong App.tsx)
 * - Tab Xem trước trong Editor (LessonEditorModal.tsx)
 */
export function LessonContentRenderer({
  content,
  fallbackSummary,
  className = "",
}: LessonContentRendererProps) {
  const isStructured = useMemo(() => isStructuredLesson(content), [content]);
  const doc = useMemo(() => (isStructured ? safeParseStructuredLesson(content) : null), [
    isStructured,
    content,
  ]);

  if (!content || !content.trim()) {
    return (
      <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
        {fallbackSummary || "Bài học này chưa có nội dung lý thuyết."}
      </div>
    );
  }

  return (
    <div className={`lesson-rendered-content ${className}`}>
      {isStructured && doc ? (
        <div className="space-y-1">
          {doc.content?.map((node, index) => (
            <RenderBlock key={index} node={node} index={index} />
          ))}
        </div>
      ) : isFullHtmlDocument(content) ? (
        <IsolatedHtmlFrame html={content} />
      ) : (
        <LegacyLessonContent html={content} />
      )}
    </div>
  );
}
