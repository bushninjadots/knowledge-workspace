// One-off conversions between the Library's two storage formats. These run
// only when a user explicitly switches an item between Docs (HTML) and Code
// (Markdown) modes, so a headless Tiptap instance per call is fine.
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Image } from "@tiptap/extension-image";
import { Markdown } from "@tiptap/markdown";
import lowlight from "@/lib/lowlight";

// Mirrors the NoteEditor schema (minus editor-only helpers) so conversions
// preserve everything users can actually author — especially fenced code
// blocks with their language.
function conversionExtensions() {
  return [
    StarterKit,
    Link,
    TaskList,
    TaskItem.configure({ nested: true }),
    CodeBlockLowlight.configure({ lowlight }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    Image.configure({ HTMLAttributes: { class: "max-w-full" } }),
    Markdown,
  ];
}

export function htmlToMarkdown(html: string): string {
  const editor = new Editor({ extensions: conversionExtensions(), content: html });
  try {
    return editor.getMarkdown();
  } finally {
    editor.destroy();
  }
}

export function markdownToHtml(markdown: string): string {
  const editor = new Editor({
    extensions: conversionExtensions(),
    content: markdown,
    contentType: "markdown",
  });
  try {
    return editor.getHTML();
  } finally {
    editor.destroy();
  }
}
