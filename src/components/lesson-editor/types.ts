import type { JSONContent } from "@tiptap/core";

export type CalloutType = "definition" | "example" | "note" | "warning";

export interface CalloutBlockAttrs {
  title?: string;
  type?: CalloutType;
}

export interface FormulaBlockAttrs {
  latex: string;
}

export interface MathInlineAttrs {
  latex: string;
}

export type LessonDocumentType = JSONContent;

export interface LessonEditorMetadata {
  title: string;
  publicCode: string;
  orderIndex: number;
  status: string;
  summary: string;
  chapterId: number;
}
