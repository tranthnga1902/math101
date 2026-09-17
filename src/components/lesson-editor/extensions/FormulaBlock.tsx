import React, { useState, useMemo } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Sigma, Trash2, Edit2, Check, Copy } from "lucide-react";

function FormulaComponent({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const latex = node.attrs.latex || "";

  const renderedMath = useMemo(() => {
    try {
      return katex.renderToString(latex.trim() || "\\text{(Chưa nhập công thức)}", {
        displayMode: true,
        throwOnError: false,
      });
    } catch {
      return `<span class="text-red-500 text-xs">Lỗi cú pháp LaTeX: ${latex}</span>`;
    }
  }, [latex]);

  const copyLatex = () => {
    navigator.clipboard.writeText(latex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const QUICK_SNIPPETS = [
    { label: "Phân số", code: "\\frac{a}{b}" },
    { label: "Căn thức", code: "\\sqrt{x}" },
    { label: "Mũ số", code: "x^{2}" },
    { label: "Thuộc tập", code: "x \\in \\mathbb{R}" },
    { label: "Kéo theo", code: "P \\Rightarrow Q" },
    { label: "Tương đương", code: "P \\Leftrightarrow Q" },
    { label: "Hệ pt", code: "\\begin{cases} x + y = 1 \\\\ x - y = 0 \\end{cases}" },
  ];

  return (
    <NodeViewWrapper className="lesson-formula-node my-4 rounded-xl border border-emerald-200 bg-emerald-50/30 overflow-hidden shadow-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-100/50 border-b border-emerald-200 text-xs text-[#176b50]">
        <div className="flex items-center gap-1.5 font-semibold">
          <Sigma size={14} />
          <span>CÔNG THỨC TOÁN (KATEX)</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copyLatex}
            className="p-1 rounded hover:bg-emerald-200/60 text-emerald-800 transition-colors cursor-pointer"
            title="Sao chép mã LaTeX"
          >
            {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isEditing ? "bg-emerald-600 text-white" : "hover:bg-emerald-200/60 text-emerald-800"
            }`}
            title={isEditing ? "Xem kết quả" : "Chỉnh sửa mã LaTeX"}
          >
            <Edit2 size={13} />
          </button>
          <button
            type="button"
            onClick={deleteNode}
            className="p-1 rounded hover:bg-red-100 text-red-500 transition-colors cursor-pointer"
            title="Xóa công thức"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="p-3 bg-white border-b border-emerald-100 space-y-2">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className="text-[11px] font-medium text-gray-500 self-center mr-1">Chèn nhanh:</span>
            {QUICK_SNIPPETS.map((snip) => (
              <button
                key={snip.label}
                type="button"
                className="text-[11px] px-2 py-0.5 rounded bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 transition-colors border border-slate-200 cursor-pointer"
                onClick={() => updateAttributes({ latex: latex ? `${latex} ${snip.code}` : snip.code })}
              >
                {snip.label}
              </button>
            ))}
          </div>
          <textarea
            className="w-full font-mono text-xs p-2.5 rounded-lg border border-gray-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none resize-y min-h-[60px]"
            value={latex}
            placeholder="Nhập mã LaTeX (ví dụ: f(x) = ax^2 + bx + c)"
            onChange={(e) => updateAttributes({ latex: e.target.value })}
          />
        </div>
      )}

      <div
        className="p-4 text-center overflow-x-auto cursor-pointer hover:bg-emerald-50/50 transition-colors"
        onClick={() => !isEditing && setIsEditing(true)}
        title="Nhấp đúp hoặc bấm biểu tượng bút để chỉnh sửa LaTeX"
      >
        <div dangerouslySetInnerHTML={{ __html: renderedMath }} />
      </div>
    </NodeViewWrapper>
  );
}

export const FormulaBlock = Node.create({
  name: "formulaBlock",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: "f(x) = ax^2 + bx + c",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="formula-block"]',
        getAttrs: (element) => ({
          latex: (element as HTMLElement).getAttribute("data-latex") || "",
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "formula-block",
        "data-latex": node.attrs.latex,
        class: "lesson-formula-block",
      }),
      node.attrs.latex,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FormulaComponent);
  },
});
