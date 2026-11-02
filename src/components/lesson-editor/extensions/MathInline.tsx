import React, { useState, useMemo } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import katex from "katex";
import "katex/dist/katex.min.css";

function MathInlineComponent({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const latex = node.attrs.latex || "";

  const rendered = useMemo(() => {
    try {
      return katex.renderToString(latex.trim() || "\\dots", {
        displayMode: false,
        throwOnError: false,
      });
    } catch {
      return latex;
    }
  }, [latex]);

  if (isEditing) {
    return (
      <NodeViewWrapper as="span" className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-300 rounded px-1.5 py-0.5 align-middle">
        <span className="text-[10px] text-emerald-800 font-mono font-bold">$</span>
        <input
          type="text"
          className="font-mono text-xs border-none outline-none bg-transparent min-w-[60px] text-emerald-950"
          value={latex}
          autoFocus
          onBlur={() => setIsEditing(false)}
          onChange={(e) => updateAttributes({ latex: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") setIsEditing(false);
            if (e.key === "Backspace" && !latex) deleteNode();
          }}
        />
        <span className="text-[10px] text-emerald-800 font-mono font-bold">$</span>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="span"
      className="inline-math-node cursor-pointer px-1 py-0.5 rounded hover:bg-emerald-50 hover:ring-1 hover:ring-emerald-400 transition-all inline-block align-baseline"
      onClick={() => setIsEditing(true)}
      title="Bấm để chỉnh sửa công thức inline"
    >
      <span dangerouslySetInnerHTML={{ __html: rendered }} />
    </NodeViewWrapper>
  );
}

export const MathInline = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: "x \\in \\mathbb{R}",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="math-inline"]',
        getAttrs: (element) => ({
          latex: (element as HTMLElement).getAttribute("data-latex") || "",
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "math-inline",
        "data-latex": node.attrs.latex,
        class: "lesson-math-inline",
      }),
      `$${node.attrs.latex}$`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathInlineComponent);
  },
});
