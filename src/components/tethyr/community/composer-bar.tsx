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
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  X,
  Lightbulb,
  MessageSquareMore,
  UserPlus,
  Paperclip,
  BarChart3,
  Plus,
  Check,
  ChevronDown,
  Tag,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  QUICK_ACTIONS,
  POST_FLAIRS,
  FEEDBACK_TAG_OPTIONS,
  flairClasses,
  type PostType,
} from "@/lib/community-data";
import { useCommunitySpaces, type CommunitySpace } from "@/hooks/use-community-spaces";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useCreatePost,
  useUpdatePost,
  type PostWithAuthor,
  VALID_POST_TYPES,
  type ProjectSnapshot,
} from "@/hooks/use-community";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AttachProjectPanel } from "@/components/tethyr/community/attach-project-panel";
import { supabase } from "@/integrations/supabase/client";
import { validateFeedbackRequest, validatePollDraft } from "@/lib/community-validation";
import { validateImageFile } from "@/lib/validators";

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
  poll: BarChart3,
};

// The composer shows three primary actions up front — the most common ways to
// post — and tucks the rest behind a single "More" menu so the toolbar stays
// calm before anyone has typed a word.
const PRIMARY_ACTIONS = [
  { type: "showcase", label: "Showcase" },
  { type: "help_request", label: "Ask for help" },
  { type: "collaboration_request", label: "Find collaborators" },
] as const;

const MORE_ACTIONS = QUICK_ACTIONS.filter((a) => !PRIMARY_ACTIONS.some((p) => p.type === a.type));

const MAX_CHARS = 2000;
const DRAFT_KEY = "tethyr-community-draft";

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
  presetType,
}: {
  editingPost?: PostWithAuthor | null;
  onCancelEdit?: () => void;
  spaceId?: string | null;
  /** Post type to pre-select (from empty-state actions like "Share a showcase"). */
  presetType?: string | null;
}) {
  const { data: me } = useCurrentUser();
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();
  const [type, setType] = useState<string | null>(editingPost?.type ?? null);
  const draftKey = me?.userId ? `${DRAFT_KEY}:${me.userId}` : null;
  const [title, setTitle] = useState(editingPost?.title ?? "");
  const [draft, setDraft] = useState(editingPost?.body ?? "");
  const [images, setImages] = useState<string[]>(editingPost?.images ?? []);
  const [focused, setFocused] = useState(false);
  const [showAttachPanel, setShowAttachPanel] = useState(false);
  const [attachedProject, setAttachedProject] = useState<{
    projectId?: string;
    snapshot: ProjectSnapshot;
  } | null>(null);
  const [feedbackTags, setFeedbackTags] = useState<string[]>([]);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollEndsAt, setPollEndsAt] = useState("");
  const [draftReadyKey, setDraftReadyKey] = useState<string | null>(null);
  const [flair, setFlair] = useState<string | null>(editingPost?.flair ?? null);
  const [linkUrl, setLinkUrl] = useState(editingPost?.link_url ?? "");
  const [showLinkInput, setShowLinkInput] = useState(!!editingPost?.link_url);
  const [targetSpaceId, setTargetSpaceId] = useState<string | null>(editingPost?.space_id ?? null);
  const { data: allSpaces = [] } = useCommunitySpaces();
  const mySpaces = (allSpaces as CommunitySpace[]).filter((s) => s.is_member);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appliedPresetRef = useRef<string | null>(null);

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
    setFlair(editingPost?.flair ?? null);
    setLinkUrl(editingPost?.link_url ?? "");
    setShowLinkInput(!!editingPost?.link_url);
    setTargetSpaceId(editingPost?.space_id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPost?.id]);

  const name = me?.profile?.display_name || me?.profile?.handle || "You";
  const initial = name.charAt(0).toUpperCase();
  const isEditing = !!editingPost;
  const isSubmitting = createPost.isPending || updatePost.isPending;

  // Draft autosave
  useEffect(() => {
    if (isEditing || !draftKey) return;

    // Reset in-memory composer state before loading the next account's draft.
    setDraft("");
    setTitle("");
    setType(null);
    setImages([]);
    setFeedbackTags([]);
    setPollQuestion("");
    setPollOptions(["", ""]);
    setPollEndsAt("");

    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.body) setDraft(parsed.body);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.type && VALID_POST_TYPES.has(parsed.type)) {
          setType(parsed.type);
        } else if (parsed.type) {
          // Clear stale draft with invalid type
          localStorage.removeItem(draftKey);
        }
        if (parsed.images) setImages(parsed.images);
        if (Array.isArray(parsed.feedbackTags)) setFeedbackTags(parsed.feedbackTags);
        if (typeof parsed.pollQuestion === "string") setPollQuestion(parsed.pollQuestion);
        if (Array.isArray(parsed.pollOptions)) setPollOptions(parsed.pollOptions);
        if (typeof parsed.pollEndsAt === "string") setPollEndsAt(parsed.pollEndsAt);
      } catch {
        // ignore
      }
    }
    setDraftReadyKey(draftKey);
  }, [draftKey, isEditing]);

  useEffect(() => {
    if (isEditing || !draftKey || draftReadyKey !== draftKey) return;
    if (
      draft ||
      type ||
      images.length > 0 ||
      feedbackTags.length > 0 ||
      pollQuestion ||
      pollOptions.some(Boolean) ||
      pollEndsAt
    ) {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          body: draft,
          title,
          type,
          images,
          feedbackTags,
          pollQuestion,
          pollOptions,
          pollEndsAt,
        }),
      );
    } else {
      localStorage.removeItem(draftKey);
    }
  }, [
    draftReadyKey,
    draftKey,
    draft,
    title,
    type,
    images,
    feedbackTags,
    pollQuestion,
    pollOptions,
    pollEndsAt,
    isEditing,
  ]);

  // Pre-select a post type from an empty-state action ("Share a showcase").
  // One-shot per preset: never clobbers a saved draft or an edit session.
  useEffect(() => {
    if (!presetType || isEditing || appliedPresetRef.current === presetType) return;
    if (!VALID_POST_TYPES.has(presetType)) return;
    let hasDraft = false;
    try {
      if (!draftKey) return;
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        hasDraft = !!(
          parsed?.body ||
          parsed?.type ||
          parsed?.images?.length ||
          parsed?.feedbackTags?.length ||
          parsed?.pollQuestion ||
          parsed?.pollOptions?.some(Boolean)
        );
      }
    } catch {
      // ignore
    }
    if (!hasDraft) setType(presetType);
    appliedPresetRef.current = presetType;
  }, [draftKey, presetType, isEditing]);

  const handleImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (images.length >= 4) {
        toast.info("Maximum 4 images per post");
        break;
      }
      const check = validateImageFile(file);
      if (!check.ok) {
        toast.error(check.error);
        continue;
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

  function handleStrikethrough() {
    if (!textareaRef.current) return;
    const result = insertMarkdown(textareaRef.current, "~~", "~~", "strikethrough");
    setDraft(result.text.slice(0, MAX_CHARS));
  }

  function handleH1() {
    if (!textareaRef.current) return;
    const result = insertMarkdown(textareaRef.current, "# ", "", "Heading 1");
    setDraft(result.text.slice(0, MAX_CHARS));
  }

  function handleH2() {
    if (!textareaRef.current) return;
    const result = insertMarkdown(textareaRef.current, "## ", "", "Heading 2");
    setDraft(result.text.slice(0, MAX_CHARS));
  }

  function handleBulletList() {
    if (!textareaRef.current) return;
    const result = insertMarkdown(textareaRef.current, "\n- ", "", "list item");
    setDraft(result.text.slice(0, MAX_CHARS));
  }

  function handleNumberedList() {
    if (!textareaRef.current) return;
    const result = insertMarkdown(textareaRef.current, "\n1. ", "", "list item");
    setDraft(result.text.slice(0, MAX_CHARS));
  }

  function handleBlockquote() {
    if (!textareaRef.current) return;
    const result = insertMarkdown(textareaRef.current, "> ", "", "quoted text");
    setDraft(result.text.slice(0, MAX_CHARS));
  }

  function handleLink() {
    const url = window.prompt("URL:");
    if (!url || !textareaRef.current) return;
    const label = window.prompt("Link text:") || url;
    const result = insertMarkdown(textareaRef.current, "[", `](${url})`, label);
    setDraft(result.text.slice(0, MAX_CHARS));
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

    // Link posts need a valid URL
    const trimmedLink = linkUrl.trim();
    if (showLinkInput && trimmedLink) {
      if (!/^https?:\/\//i.test(trimmedLink)) {
        toast.error("Link URL must start with http:// or https://");
        return;
      }
    }

    const postTitle =
      title.trim() || (bodyText.length > 80 ? bodyText.slice(0, 77) + "..." : bodyText);

    if (type === "feedback_request") {
      const feedbackError = validateFeedbackRequest(feedbackTags);
      if (feedbackError) {
        toast.info(feedbackError);
        setFocused(true);
        return;
      }
    }

    if (type === "poll") {
      const pollError = validatePollDraft(pollOptions, pollEndsAt);
      if (pollError) {
        toast.error(pollError);
        return;
      }
    }

    try {
      if (isEditing && editingPost) {
        await updatePost.mutateAsync({
          id: editingPost.id,
          type: type as PostType,
          title: postTitle,
          body: bodyText,
          images: images.length > 0 ? images : undefined,
          flair: flair ?? undefined,
          link_url: showLinkInput && trimmedLink ? trimmedLink : null,
        });
        toast.success("Post updated");
      } else {
        const poll_data =
          type === "poll"
            ? {
                question: pollQuestion.trim() || postTitle,
                options: pollOptions.filter((o) => o.trim()).map((o) => o.trim()),
                votes: [],
                ends_at: pollEndsAt ? new Date(pollEndsAt).toISOString() : null,
              }
            : undefined;

        await createPost.mutateAsync({
          type: type as PostType,
          title: postTitle,
          body: bodyText,
          community: me?.profile?.category || "General",
          space_id: (spaceId ?? targetSpaceId) || null,
          images: images.length > 0 ? images : undefined,
          project_id: attachedProject?.projectId ?? null,
          project_snapshot: attachedProject?.snapshot ?? null,
          feedback_tags: feedbackTags.length > 0 ? feedbackTags : undefined,
          poll_data,
          flair: flair ?? undefined,
          link_url: showLinkInput && trimmedLink ? trimmedLink : null,
        });
        toast.success(
          (spaceId ?? targetSpaceId) ? "Posted to the community" : "Posted to the community feed",
        );
      }
      setDraft("");
      setTitle("");
      setType(null);
      setImages([]);
      setAttachedProject(null);
      setFeedbackTags([]);
      setPollQuestion("");
      setPollOptions(["", ""]);
      setPollEndsAt("");
      setFlair(null);
      setLinkUrl("");
      setShowLinkInput(false);
      setTargetSpaceId(null);
      setShowAttachPanel(false);
      if (draftKey) localStorage.removeItem(draftKey);
      onCancelEdit?.();
    } catch (err: unknown) {
      const e = err as { message?: string; error?: { message?: string } };
      toast.error(friendlyError(e));
    }
  }

  return (
    <div
      className={`card-border border bg-surface px-4 py-3.5 sm:px-5 sm:py-4 transition-shadow ${
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
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-green text-sm font-semibold text-background">
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
            id="community-composer-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="What are you building or learning today?"
            rows={focused || draft.length > 80 ? 5 : 2}
            className="min-h-16 resize-none rounded-xl border-border/60 bg-background/40 transition-all text-sm"
          />
          {focused && (
            <div className="mt-1.5 flex items-center justify-end gap-1.5">
              <CharCount current={draft.length} max={MAX_CHARS} />
              <span
                className={`text-[11px] tabular-nums ${draft.length > MAX_CHARS * 0.85 ? "text-destructive" : "text-muted-foreground"}`}
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

      {type === "feedback_request" && (
        <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <MessageSquareMore className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              What kind of feedback would help?
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FEEDBACK_TAG_OPTIONS.map((tag) => {
              const selected = feedbackTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setFeedbackTags((current) =>
                      selected ? current.filter((value) => value !== tag) : [...current, tag],
                    )
                  }
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {selected && <Check className="mr-1 inline h-3 w-3" />}
                  {tag}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Select focused areas so people can give useful, specific feedback.
          </p>
        </div>
      )}

      {type === "poll" && (
        <div className="mt-3 rounded-xl border border-[var(--user-accent-border,var(--border-strong))]/60 bg-[var(--user-accent-subtle,var(--surface-elevated))] p-4">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-brand-purple" />
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-purple">
              Poll
            </span>
          </div>
          <input
            value={pollQuestion}
            onChange={(e) => setPollQuestion(e.target.value.slice(0, 200))}
            placeholder="Ask a question…"
            className="mb-3 w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
          />
          <div className="space-y-2">
            {pollOptions.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/60 text-[11px] tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <input
                  value={opt}
                  onChange={(e) => {
                    const next = [...pollOptions];
                    next[i] = e.target.value.slice(0, 100);
                    setPollOptions(next);
                  }}
                  placeholder={`Option ${i + 1}…`}
                  className="flex-1 rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
                />
                {pollOptions.length > 2 && (
                  <button
                    onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Ends</span>
            <input
              type="datetime-local"
              value={pollEndsAt}
              onChange={(e) => setPollEndsAt(e.target.value)}
              className="rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-xs text-foreground focus:border-primary/50 focus:outline-none"
            />
            {pollEndsAt && (
              <button
                onClick={() => setPollEndsAt("")}
                className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            )}
            <span className="text-[11px] text-muted-foreground">optional</span>
          </div>

          {pollOptions.length < 10 && (
            <button
              onClick={() => setPollOptions([...pollOptions, ""])}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              Add option
            </button>
          )}
        </div>
      )}

      {/* Post-to-space picker + link + flair (Reddit-style meta row) */}
      {(focused || !!type || !!flair || showLinkInput || !!targetSpaceId || isEditing) && (
        <div className="mt-3 space-y-2 rounded-xl border border-border/50 bg-background/30 p-3">
          {/* Destination picker */}
          {!spaceId && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <Users className="h-3 w-3" />
                Post to
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all active:scale-95 ${
                      targetSpaceId
                        ? "border-brand-purple/40 bg-brand-purple/10 text-brand-purple"
                        : "border-border bg-background/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Users className="h-3 w-3" />
                    {targetSpaceId
                      ? (mySpaces.find((s) => s.id === targetSpaceId)?.name ?? "Space")
                      : "Community feed"}

                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-72 w-60 overflow-y-auto">
                  <DropdownMenuItem onClick={() => setTargetSpaceId(null)}>
                    <span className="flex-1">Community feed (all)</span>
                    {!targetSpaceId && <Check className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                  {mySpaces.length > 0 && <div className="my-1 h-px bg-border/60" />}
                  {(mySpaces as CommunitySpace[]).map((s) => (
                    <DropdownMenuItem key={s.id} onClick={() => setTargetSpaceId(s.id)}>
                      <span className="flex-1 truncate">{s.name}</span>
                      {targetSpaceId === s.id && <Check className="h-3.5 w-3.5 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                  {mySpaces.length === 0 && (
                    <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
                      You're not a member of any space yet.
                    </p>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Link post field */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowLinkInput((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all active:scale-95 ${
                showLinkInput
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Link2 className="h-3 w-3" />
              Link
            </button>
            {showLinkInput && (
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value.slice(0, 500))}
                placeholder="https://…  (optional URL this post links to)"
                className="min-w-0 flex-1 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
              />
            )}
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Tag className="h-3 w-3" />
              Flair
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all active:scale-95 ${
                    flair
                      ? `border-transparent ${flairClasses(flair)}`
                      : "border-border bg-background/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {flair ?? "Add flair"}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                {POST_FLAIRS.map((f) => (
                  <DropdownMenuItem key={f.value} onClick={() => setFlair(f.value)}>
                    <span
                      className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${flairClasses(f.value)}`}
                    />
                    <span className="flex-1">{f.label}</span>
                    {flair === f.value && <Check className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
                {flair && (
                  <>
                    <div className="my-1 h-px bg-border/60" />
                    <DropdownMenuItem onClick={() => setFlair(null)}>
                      <span className="flex-1 text-muted-foreground">Remove flair</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
        <button
          type="button"
          onClick={handleH1}
          aria-label="Heading 1"
          title="Heading 1"
          className="inline-flex items-center rounded-full border border-border bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground active:scale-95"
        >
          <Heading1 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleH2}
          aria-label="Heading 2"
          title="Heading 2"
          className="inline-flex items-center rounded-full border border-border bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground active:scale-95"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </button>
        <div className="mx-0.5 h-4 w-px bg-border/60" />
        <button
          type="button"
          onClick={handleBold}
          aria-label="Bold"
          title="Bold"
          className="inline-flex items-center rounded-full border border-border bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground active:scale-95"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleItalic}
          aria-label="Italic"
          title="Italic"
          className="inline-flex items-center rounded-full border border-border bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground active:scale-95"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleStrikethrough}
          aria-label="Strikethrough"
          title="Strikethrough"
          className="inline-flex items-center rounded-full border border-border bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground active:scale-95"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </button>
        <div className="mx-0.5 h-4 w-px bg-border/60" />
        <button
          type="button"
          onClick={handleBulletList}
          aria-label="Bullet list"
          title="Bullet list"
          className="inline-flex items-center rounded-full border border-border bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground active:scale-95"
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleNumberedList}
          aria-label="Numbered list"
          title="Numbered list"
          className="inline-flex items-center rounded-full border border-border bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground active:scale-95"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleBlockquote}
          aria-label="Blockquote"
          title="Blockquote"
          className="inline-flex items-center rounded-full border border-border bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground active:scale-95"
        >
          <Quote className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleLink}
          aria-label="Insert link"
          title="Insert link"
          className="inline-flex items-center rounded-full border border-border bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground active:scale-95"
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
        <div className="mx-0.5 h-4 w-px bg-border/60" />
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
        {PRIMARY_ACTIONS.map((a) => {
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

        {/* Every other post type lives behind a single "More" menu. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs transition-all active:scale-95 ${
                type && MORE_ACTIONS.some((a) => a.type === type)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background/60 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
              }`}
            >
              {type && MORE_ACTIONS.some((a) => a.type === type) ? (
                <>
                  {(() => {
                    const Icon = ACTION_ICON[type] ?? HelpCircle;
                    return <Icon className="h-3.5 w-3.5" />;
                  })()}
                  {MORE_ACTIONS.find((a) => a.type === type)?.label}
                </>
              ) : (
                <>
                  More
                  <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
            {MORE_ACTIONS.map((a) => {
              const Icon = ACTION_ICON[a.type] ?? HelpCircle;
              const active = type === a.type;
              return (
                <DropdownMenuItem key={a.type} onClick={() => setType(active ? null : a.type)}>
                  <Icon className="mr-2 h-3.5 w-3.5" />
                  <span className="flex-1">{a.label}</span>
                  {active && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-1 h-4 w-px bg-border/60" />
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
