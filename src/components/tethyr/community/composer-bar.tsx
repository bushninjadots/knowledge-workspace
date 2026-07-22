import { useState, useRef, useEffect, useCallback } from "react";
import {
  Rocket,
  HelpCircle,
  Link2,
  BookOpen,
  Trophy,
  HandHeart,
  Handshake,
  Sparkles,
  ImagePlus,
  Code2,
  Bold,
  Italic,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { QUICK_ACTIONS, type PostType } from "@/lib/community-data";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useCreatePost,
  useUpdatePost,
  type PostWithAuthor,
} from "@/hooks/use-community";

const ACTION_ICON: Record<string, typeof Rocket> = {
  showcase: Rocket,
  question: HelpCircle,
  project_update: Rocket,
  tutorial: BookOpen,
  resource: Link2,
  achievement: Trophy,
  discussion: HelpCircle,
  help_request: HandHeart,
  collaboration_request: Handshake,
  progress_update: Sparkles,
};

const MAX_CHARS = 2000;
const DRAFT_KEY = "tethyr-community-draft";
const CODE_LANGUAGES = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Rust",
  "Go",
  "SQL",
  "HTML/CSS",
  "Other",
];

function CharCount({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? current / max : 0;
  const r = 7;
  const circ = 2 * Math.PI * r;
  const offset = circ - pct * circ;
  const warn = pct > 0.85;

  return (
    <div className="relative h-5 w-5">
      <svg className="h-5 w-5 -rotate-90" viewBox="0 0 18 18">
        <circle
          cx="9"
          cy="9"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-border"
        />
        <circle
          cx="9"
          cy="9"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={warn ? "text-destructive" : "text-brand-green"}
        />
      </svg>
    </div>
  );
}

function insertMarkdown(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  fallback?: string,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selected = text.slice(start, end) || fallback || "";
  const newText = text.slice(0, start) + before + selected + after + text.slice(end);
  return {
    text: newText,
    cursorStart: start + before.length,
    cursorEnd: start + before.length + selected.length,
  };
}

export function ComposerBar({
  editingPost,
  onCancelEdit,
}: {
  editingPost?: PostWithAuthor | null;
  onCancelEdit?: () => void;
}) {
  const { data: me } = useCurrentUser();
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();
  const [type, setType] = useState<string | null>(editingPost?.type ?? null);
  const [title, setTitle] = useState(editingPost?.title ?? "");
  const [draft, setDraft] = useState(editingPost?.body ?? "");
  const [images, setImages] = useState<string[]>(editingPost?.images ?? []);
  const [showCodeInsert, setShowCodeInsert] = useState(false);
  const [codeLang, setCodeLang] = useState("JavaScript");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const name = me?.profile?.display_name || me?.profile?.handle || "You";
  const initial = name.charAt(0).toUpperCase();
  const isEditing = !!editingPost;
  const isSubmitting = createPost.isPending || updatePost.isPending;

  // Draft autosave
  useEffect(() => {
    if (isEditing) return;
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.body) setDraft(parsed.body);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.type) setType(parsed.type);
        if (parsed.images) setImages(parsed.images);
      } catch {
        // ignore
      }
    }
  }, [isEditing]);

  useEffect(() => {
    if (isEditing) return;
    if (draft || type || images.length > 0) {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ body: draft, title, type, images }),
      );
    } else {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [draft, title, type, images, isEditing]);

  const handleImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (images.length >= 4) {
        toast.info("Maximum 4 images per post");
        break;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function handleBold() {
    if (!textareaRef.current) return;
    const result = insertMarkdown(textareaRef.current, "**", "**", "bold text");
    setDraft(result.text.slice(0, MAX_CHARS));
  }

  function handleItalic() {
    if (!textareaRef.current) return;
    const result = insertMarkdown(textareaRef.current, "_", "_", "italic text");
    setDraft(result.text.slice(0, MAX_CHARS));
  }

  function handleCode() {
    setShowCodeInsert((v) => !v);
  }

  function insertCodeBlock() {
    if (!textareaRef.current) return;
    const lang = codeLang.toLowerCase().replace("/", "");
    const block = `\n\`\`\`${lang}\n// code here\n\`\`\`\n`;
    const pos = textareaRef.current.selectionStart;
    const newText = draft.slice(0, pos) + block + draft.slice(pos);
    setDraft(newText.slice(0, MAX_CHARS));
    setShowCodeInsert(false);
  }

  async function submit() {
    const bodyText = draft.trim();
    if (!bodyText || !type) {
      if (!type) toast.info("Pick a post type above first");
      return;
    }

    const postTitle = title.trim() || (bodyText.length > 80 ? bodyText.slice(0, 77) + "..." : bodyText);

    try {
      if (isEditing && editingPost) {
        await updatePost.mutateAsync({
          id: editingPost.id,
          type: type as PostType,
          title: postTitle,
          body: bodyText,
          images: images.length > 0 ? images : undefined,
        });
        toast.success("Post updated");
      } else {
        await createPost.mutateAsync({
          type: type as PostType,
          title: postTitle,
          body: bodyText,
          community: me?.profile?.category || "General",
          images: images.length > 0 ? images : undefined,
        });
        toast.success("Posted to the community");
      }
      setDraft("");
      setTitle("");
      setType(null);
      setImages([]);
      localStorage.removeItem(DRAFT_KEY);
      onCancelEdit?.();
    } catch (err: any) {
      const msg = err?.message ?? err?.error?.message ?? "Something went wrong";
      toast.error(msg);
    }
  }

  return (
    <div
      className={`card-border rounded-3xl border bg-surface p-5 sm:p-6 transition-shadow ${
        focused
          ? "shadow-[0_0_0_1px_oklch(0.92_0.23_142/20%),0_0_20px_-4px_oklch(0.92_0.23_142/15%)]"
          : ""
      }`}
    >
      {isEditing && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-surface-elevated px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Editing post</span>
          <button
            onClick={onCancelEdit}
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-green text-sm font-semibold text-background">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 200))}
            onFocus={() => setFocused(true)}
            placeholder="Title (optional)"
            className="mb-2 w-full rounded-xl border-none bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="What are you building or learning today? Supports **bold**, _italic_, and ```code```."
            rows={focused || draft.length > 80 ? 5 : 2}
            className="min-h-16 resize-none rounded-2xl border-border/60 bg-background/40 transition-all font-mono text-sm"
          />
          {focused && (
            <div className="mt-1.5 flex items-center justify-end gap-1.5">
              <CharCount current={draft.length} max={MAX_CHARS} />
              <span
                className={`text-[10px] tabular-nums ${draft.length > MAX_CHARS * 0.85 ? "text-destructive" : "text-muted-foreground"}`}
              >
                {draft.length}/{MAX_CHARS}
              </span>
            </div>
          )}
        </div>
      </div>

      {images.length > 0 && (
        <div className="mt-3 flex gap-2">
          {images.map((src, i) => (
            <div key={i} className="relative">
              <img src={src} alt="" className="h-16 w-16 rounded-xl object-cover" />
              <button
                onClick={() => removeImage(i)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-surface text-foreground shadow-md"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showCodeInsert && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/60 bg-background/40 p-2">
          <Code2 className="h-4 w-4 shrink-0 text-brand-purple" />
          <select
            value={codeLang}
            onChange={(e) => setCodeLang(e.target.value)}
            className="rounded-lg border border-border/60 bg-surface px-2 py-1 text-xs text-foreground"
          >
            {CODE_LANGUAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="ghost"
            onClick={insertCodeBlock}
            className="ml-auto h-7 text-xs"
          >
            Insert
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowCodeInsert(false)}
            className="h-7 text-xs"
          >
            Cancel
          </Button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onFileChange}
        />
        <button
          onClick={handleImageUpload}
          disabled={images.length >= 4}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground active:scale-95 disabled:opacity-40"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          Image
        </button>
        <button
          onClick={handleBold}
          className="inline-flex items-center rounded-full border border-border bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground active:scale-95"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleItalic}
          className="inline-flex items-center rounded-full border border-border bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground active:scale-95"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleCode}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs transition-all active:scale-95 ${
            showCodeInsert
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
          }`}
        >
          <Code2 className="h-3.5 w-3.5" />
          Code
        </button>
        <div className="mx-1 h-4 w-px bg-border/60" />
        {QUICK_ACTIONS.map((a) => {
          const Icon = ACTION_ICON[a.type] ?? HelpCircle;
          const active = type === a.type;
          return (
            <button
              key={a.type}
              onClick={() => setType(active ? null : a.type)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all active:scale-95 ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {a.label}
            </button>
          );
        })}
        <Button
          size="sm"
          className="ml-auto"
          onClick={submit}
          disabled={!draft.trim() || isSubmitting}
        >
          {isSubmitting ? "..." : isEditing ? "Save" : "Post"}
        </Button>
      </div>
    </div>
  );
}
