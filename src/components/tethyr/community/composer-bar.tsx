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
  Lightbulb,
  MessageSquareMore,
  UserPlus,
  Paperclip,
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
  VALID_POST_TYPES,
  type ProjectSnapshot,
} from "@/hooks/use-community";
import { InlineDropZone } from "@/components/tethyr/drag-drop-file-input";
import { AttachProjectPanel } from "@/components/tethyr/community/attach-project-panel";
import { supabase } from "@/integrations/supabase/client";

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
  lesson_learned: Lightbulb,
  feedback_request: MessageSquareMore,
  open_role: UserPlus,
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
          className={warn ? "text-destructive" : "text-[var(--user-accent,var(--trust))]"}
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
  spaceId,
}: {
  editingPost?: PostWithAuthor | null;
  onCancelEdit?: () => void;
  spaceId?: string | null;
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
  const [showAttachPanel, setShowAttachPanel] = useState(false);
  const [attachedProject, setAttachedProject] = useState<{
    projectId?: string;
    snapshot: ProjectSnapshot;
  } | null>(null);
  const [feedbackTags, setFeedbackTags] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Read ?attach_project param to pre-fill attachment
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const attachId = params.get("attach_project");
    if (attachId && !attachedProject) {
      (async () => {
        const { data } = await supabase
          .from("projects")
          .select("id, title, description, status, stage")
          .eq("id", attachId)
          .single();
        if (data) {
          setAttachedProject({
            projectId: data.id,
            snapshot: {
              name: data.title,
              description: data.description,
              platform: "tethyr",
              url: `/projects/${data.id}`,
              logo: null,
              status: data.status,
              stage: data.stage,
            },
          });
          setShowAttachPanel(true);
        }
      })();
      // Clean URL param
      const url = new URL(window.location.href);
      url.searchParams.delete("attach_project");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset states when editingPost changes (switching between posts)
  useEffect(() => {
    setType(editingPost?.type ?? null);
    setTitle(editingPost?.title ?? "");
    setDraft(editingPost?.body ?? "");
    setImages(editingPost?.images ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPost?.id]);

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
        if (parsed.type && VALID_POST_TYPES.has(parsed.type)) {
          setType(parsed.type);
        } else if (parsed.type) {
          // Clear stale draft with invalid type
          localStorage.removeItem(DRAFT_KEY);
        }
        if (parsed.images) setImages(parsed.images);
      } catch {
        // ignore
      }
    }
  }, [isEditing]);

  useEffect(() => {
    if (isEditing) return;
    if (draft || type || images.length > 0) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ body: draft, title, type, images }));
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

  function handleDroppedImage(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Only images are supported");
      return;
    }
    if (images.length >= 4) {
      toast.info("Maximum 4 images per post");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImages((prev) => [...prev, reader.result as string]);
    };
    reader.readAsDataURL(file);
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

    if (!VALID_POST_TYPES.has(type)) {
      toast.error(`Invalid post type "${type}". Pick a type from the toolbar.`);
      setType(null);
      return;
    }

    const postTitle =
      title.trim() || (bodyText.length > 80 ? bodyText.slice(0, 77) + "..." : bodyText);

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
          space_id: spaceId ?? null,
          images: images.length > 0 ? images : undefined,
          project_id: attachedProject?.projectId ?? null,
          project_snapshot: attachedProject?.snapshot ?? null,
          feedback_tags: feedbackTags.length > 0 ? feedbackTags : undefined,
        });
        toast.success("Posted to the community");
      }
      setDraft("");
      setTitle("");
      setType(null);
      setImages([]);
      setAttachedProject(null);
      setFeedbackTags([]);
      setShowAttachPanel(false);
      localStorage.removeItem(DRAFT_KEY);
      onCancelEdit?.();
    } catch (err: any) {
      const msg = err?.message ?? err?.error?.message ?? "Something went wrong";
      toast.error(msg);
    }
  }

  return (
    <div
      className={`border border-border bg-surface px-4 py-3.5 sm:px-5 sm:py-4 transition-shadow ${
        focused
          ? "shadow-[0_0_0_1px_oklch(0.92_0.23_142/20%),0_0_20px_-4px_oklch(0.92_0.23_142/15%)]"
          : ""
      }`}
    >
      {isEditing && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-surface-elevated px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Editing post</span>
          <button
            type="button"
            onClick={onCancelEdit}
            aria-label="Cancel editing"
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
            className="mb-2 w-full rounded-xl border-none bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="What are you building or learning today? Supports **bold**, _italic_, and```code```."
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

      {showAttachPanel && (
        <div className="mt-3">
          <AttachProjectPanel
            currentAttachment={attachedProject}
            feedbackTags={feedbackTags}
            onAttach={(projectId, snapshot) => {
              setAttachedProject({ projectId: projectId ?? undefined, snapshot });
              setShowAttachPanel(false);
            }}
            onRemove={() => {
              setAttachedProject(null);
              setFeedbackTags([]);
            }}
            onFeedbackTagsChange={setFeedbackTags}
          />
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
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground active:scale-95 disabled:opacity-40"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          Image
        </button>
        <InlineDropZone
          accept="image/*"
          onFile={handleDroppedImage}
          className="hidden sm:flex h-8 w-32"
        />
        <button
          type="button"
          onClick={handleBold}
          aria-label="Bold"
          className="inline-flex items-center rounded-full border border-border bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground active:scale-95"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleItalic}
          aria-label="Italic"
          className="inline-flex items-center rounded-full border border-border bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground active:scale-95"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Insert code block"
          onClick={handleCode}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs transition-all active:scale-95 ${
            showCodeInsert
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background/60 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
          }`}
        >
          <Code2 className="h-3.5 w-3.5" />
          Code
        </button>
        <button
          onClick={() => setShowAttachPanel((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs transition-all active:scale-95 ${
            showAttachPanel || attachedProject
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background/60 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
          }`}
        >
          <Paperclip className="h-3.5 w-3.5" />
          Project
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
                  : "border-border bg-background/60 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {a.label}
            </button>
          );
        })}
        <Button
          type="button"
          size="sm"
          className="ml-auto"
          onClick={submit}
          disabled={!draft.trim() || !type || isSubmitting}
        >
          {isSubmitting ? "..." : isEditing ? "Save" : "Post"}
        </Button>
      </div>
    </div>
  );
}
