import { useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
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
import { SignedImage } from "./signed-image";
import { Dropcursor } from "@tiptap/extension-dropcursor";
import lowlight from "@/lib/lowlight";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { supabase } from "@/integrations/supabase/client";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Minus,
  CodeSquare,
  LinkIcon,
  ImagePlus,
  TableIcon,
  Undo,
  Redo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { validateImageFile } from "@/lib/validators";

// External image URLs use the stock Image extension; storage paths go through
// SignedImage (which signs at render). Keep them from fighting over the same
// `<img>` tag by scoping each parser.
const ExternalImage = Image.extend({
  parseHTML() {
    return [{ tag: 'img[src]:not([src*="library-images"])' }];
  },
}).configure({ HTMLAttributes: { class: "rounded-xl max-w-full" } });

function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  children,
  title,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "h-8 w-8 shrink-0 rounded-lg",
        isActive && "bg-surface-elevated text-brand-green",
        !isActive && "text-muted-foreground hover:text-foreground",
      )}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
    >
      {children}
    </Button>
  );
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  function addLink() {
    const url = window.prompt("URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }

  function addImage() {
    const url = window.prompt("Image URL:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }

  function addTable() {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border/40 px-4 py-2">
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Undo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Redo className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5 bg-border/40" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
        title="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5 bg-border/40" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        title="Inline code"
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5 bg-border/40" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Bullet list"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Numbered list"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive("taskList")}
        title="Task list"
      >
        <ListChecks className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5 bg-border/40" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="Quote"
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Divider"
      >
        <Minus className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive("codeBlock")}
        title="Code block"
      >
        <CodeSquare className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5 bg-border/40" />

      <ToolbarButton onClick={addLink} isActive={editor.isActive("link")} title="Link">
        <LinkIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={addImage} title="Image">
        <ImagePlus className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={addTable} title="Table">
        <TableIcon className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

export function NoteEditor({
  content,
  onChange,
  editable = true,
}: {
  content: string;
  onChange?: (html: string) => void;
  editable?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-brand-green underline" },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      ExternalImage,
      SignedImage,
      Dropcursor.configure({ color: "var(--brand-green)", width: 2 }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: "prose-custom focus:outline-none min-h-[60vh] px-4 py-6 text-sm leading-relaxed",
      },
    },
    onUpdate: ({ editor: e }) => {
      if (!onChange) return;
      onChange(e.getHTML());
    },
  });

  // ── Upload image to Supabase storage ──
  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    try {
      const check = validateImageFile(file);
      if (!check.ok) {
        toast.error(check.error);
        return null;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sign in to add images");
        return null;
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "_") || `image.${check.ext}`;
      // library-files is a private bucket whose RLS requires the owner's id as
      // the first path folder — use that and sign a short-lived URL to render.
      const path = `${user.id}/library-images/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("library-files").upload(path, file, {
        contentType: check.contentType,
        upsert: true,
      });
      if (upErr) throw upErr;
      // Store the storage *path*, not a signed URL — SignedImage signs it at
      // render time so pasted images never expire.
      return path;
    } catch (err: unknown) {
      toast.error(friendlyError(err, "Image upload failed"));
      return null;
    }
  }, []);

  // ── Handle image paste (Cmd/Ctrl+V) ──
  useEffect(() => {
    if (!editor || !editable) return;
    const el = editor.view.dom;
    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          const path = await uploadImage(file);
          if (path) {
            editor
              .chain()
              .focus()
              .insertContent({ type: "signedImage", attrs: { src: path } })
              .run();
          }
          return;
        }
      }
    };
    el.addEventListener("paste", onPaste);
    return () => el.removeEventListener("paste", onPaste);
  }, [editor, editable, uploadImage]);

  // ── Handle image drag-drop ──
  useEffect(() => {
    if (!editor || !editable) return;
    const el = editor.view.dom;
    const onDrop = async (e: DragEvent) => {
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      for (const file of Array.from(files)) {
        if (file.type.startsWith("image/")) {
          e.preventDefault();
          const path = await uploadImage(file);
          if (path) {
            const coords = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
            const pos = coords?.pos ?? editor.state.selection.anchor;
            editor
              .chain()
              .focus()
              .setTextSelection(pos)
              .insertContent({ type: "signedImage", attrs: { src: path } })
              .run();
          }
          return;
        }
      }
    };
    el.addEventListener("drop", onDrop);
    return () => el.removeEventListener("drop", onDrop);
  }, [editor, editable, uploadImage]);

  // Sync external content changes

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  if (!editor) return null;

  return (
    <div className="rounded-xl border card-border bg-surface/40">
      {editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
