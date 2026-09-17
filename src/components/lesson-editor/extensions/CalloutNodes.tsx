import React from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { BookOpen, Lightbulb, Info, AlertTriangle, Trash2 } from "lucide-react";

interface CalloutConfig {
  name: string;
  dataType: string;
  defaultTitle: string;
  icon: React.ReactNode;
  cssClass: string;
}

const CALLOUT_CONFIGS: Record<string, CalloutConfig> = {
  definitionBlock: {
    name: "definitionBlock",
    dataType: "definition-block",
    defaultTitle: "Định nghĩa",
    icon: <BookOpen size={16} className="text-[#176b50]" />,
    cssClass: "callout-definition",
  },
  exampleBlock: {
    name: "exampleBlock",
    dataType: "example-block",
    defaultTitle: "Ví dụ",
    icon: <Lightbulb size={16} className="text-amber-600" />,
    cssClass: "callout-example",
  },
  noteBlock: {
    name: "noteBlock",
    dataType: "note-block",
    defaultTitle: "Ghi chú",
    icon: <Info size={16} className="text-sky-600" />,
    cssClass: "callout-note",
  },
  warningBlock: {
    name: "warningBlock",
    dataType: "warning-block",
    defaultTitle: "Cảnh báo / Lưu ý",
    icon: <AlertTriangle size={16} className="text-rose-600" />,
    cssClass: "callout-warning",
  },
};

function CalloutComponent({ node, updateAttributes, deleteNode, extension }: NodeViewProps) {
  const config = CALLOUT_CONFIGS[extension.name] || CALLOUT_CONFIGS.definitionBlock;
  const title = node.attrs.title ?? config.defaultTitle;

  return (
    <NodeViewWrapper className={`lesson-callout ${config.cssClass} my-3 rounded-lg border overflow-hidden`}>
      <div className="callout-header flex items-center justify-between px-3 py-2 border-b bg-black/5">
        <div className="flex items-center gap-2 flex-1">
          {config.icon}
          <input
            type="text"
            className="callout-title-input font-bold text-xs uppercase tracking-wider bg-transparent border-none outline-none text-current flex-1"
            value={title}
            placeholder={config.defaultTitle}
            onChange={(e) => updateAttributes({ title: e.target.value })}
            onKeyDown={(e) => {
              // Ngăn Enter tạo dòng mới trong title input
              if (e.key === "Enter") e.preventDefault();
            }}
          />
        </div>
        <button
          type="button"
          onClick={deleteNode}
          className="callout-delete-btn p-1 text-gray-400 hover:text-red-500 rounded hover:bg-black/5 transition-colors cursor-pointer"
          title="Xóa khối này"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="callout-body p-3 text-sm">
        <NodeViewContent className="callout-content outline-none min-h-[32px]" />
      </div>
    </NodeViewWrapper>
  );
}

function createCalloutExtension(name: string) {
  const config = CALLOUT_CONFIGS[name];

  return Node.create({
    name,
    group: "block",
    content: "block+",
    defining: true,
    isolating: true,

    addAttributes() {
      return {
        title: {
          default: config.defaultTitle,
        },
      };
    },

    parseHTML() {
      return [
        {
          tag: `div[data-type="${config.dataType}"]`,
          getAttrs: (element) => ({
            title: (element as HTMLElement).getAttribute("data-title") || config.defaultTitle,
          }),
        },
      ];
    },

    renderHTML({ HTMLAttributes, node }) {
      return [
        "div",
        mergeAttributes(HTMLAttributes, {
          "data-type": config.dataType,
          "data-title": node.attrs.title || config.defaultTitle,
          class: `lesson-callout ${config.cssClass}`,
        }),
        [
          "div",
          { class: "callout-header" },
          ["span", { class: "callout-title" }, node.attrs.title || config.defaultTitle],
        ],
        ["div", { class: "callout-body" }, 0],
      ];
    },

    addNodeView() {
      return ReactNodeViewRenderer(CalloutComponent);
    },
  });
}

export const DefinitionBlock = createCalloutExtension("definitionBlock");
export const ExampleBlock = createCalloutExtension("exampleBlock");
export const NoteBlock = createCalloutExtension("noteBlock");
export const WarningBlock = createCalloutExtension("warningBlock");
