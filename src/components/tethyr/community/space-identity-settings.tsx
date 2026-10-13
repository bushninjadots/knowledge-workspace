// Settings → Identity: everything that makes a space its owner's own place —
// banner and picture (saved straight away, like a profile photo), name,
// tagline, card description, a markdown About, a welcome note, a colour,
// topics and links (saved with the page's Save button). A live preview shows
// the header as members will see it.
import { useMemo, useState, type KeyboardEvent } from "react";
import { Eye, ImagePlus, Link2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DragDropFileInput } from "@/components/tethyr/drag-drop-file-input";
import { useCropConfirm } from "@/components/tethyr/profile/crop-confirm-dialog";
import {
  SpaceAvatar,
  SpaceBanner,
  useBannerPalette,
  useSpaceAccent,
} from "@/components/tethyr/community/space-media";
import type { CommunitySpace } from "@/hooks/use-community-spaces";
import { useSpaceImage, type SpaceImageKind } from "@/hooks/use-space-settings";
import { blockMarkdownToHtml } from "@/lib/block-markdown";
import { friendlyError } from "@/lib/error-message";
import {
  ABOUT_MAX,
  DESCRIPTION_MAX,
  LINKS_MAX,
  LINK_LABEL_MAX,
  SPACE_ACCENT_SWATCHES,
  TAGLINE_MAX,
  TOPICS_MAX,
  TOPIC_MAX,
  WELCOME_MAX,
  isHexColor,
  normalizeTopics,
  type LinkDraft,
} from "@/lib/space-identity";
import { validateImageFile } from "@/lib/validators";
import { cn } from "@/lib/utils";

export type IdentityDraft = {
  name: string;
  tagline: string;
  description: string;
  about: string;
  welcome: string;
  accent: string | null;
  topics: string[];
  links: LinkDraft[];
};

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span
      className={cn(
        "numeric text-[11px]",
        value.length > max * 0.9 ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {value.length}/{max}
    </span>
  );
}

export function SpaceIdentitySettings({
  space,
  ownerId,
  canEdit,
  draft,
  onChange,
  linkProblems,
}: {
  space: CommunitySpace;
  ownerId: string;
  canEdit: boolean;
  draft: IdentityDraft;
  onChange: (patch: Partial<IdentityDraft>) => void;
  linkProblems: { index: number; message: string }[];
}) {
  const image = useSpaceImage();
  const { requestCrop, dialog: cropDialog } = useCropConfirm();
  const [pendingKind, setPendingKind] = useState<SpaceImageKind | null>(null);
  const [topicInput, setTopicInput] = useState("");
  const [aboutPreview, setAboutPreview] = useState(false);

  // The banner's colours, offered as swatches. With no colour picked, the
  // space follows its banner's main colour automatically (useSpaceAccent).
  const bannerColours = useBannerPalette(space.banner_url);
  const accent = useSpaceAccent({ ...space, accent_color: draft.accent });
  const aboutHtml = useMemo(
    () => (aboutPreview && draft.about.trim() ? blockMarkdownToHtml(draft.about) : null),
    [aboutPreview, draft.about],
  );

  function pick(kind: SpaceImageKind, files: File[]) {
    const file = files[0];
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.ok) return toast.error(check.error);
    requestCrop(file, kind, (payload, meta) => saveImage(kind, { payload, ...meta }));
  }

  function saveImage(
    kind: SpaceImageKind,
    file: { payload: File | Blob; ext: string; contentType: string } | null,
  ) {
    setPendingKind(kind);
    image.mutate(
      {
        spaceId: space.id,
        ownerId,
        kind,
        previousPath: kind === "avatar" ? space.avatar_url : space.banner_url,
        file,
      },
      {
        onSuccess: () =>
          toast.success(
            file
              ? kind === "avatar"
                ? "Picture updated"
                : "Banner updated"
              : kind === "avatar"
                ? "Picture removed"
                : "Banner removed",
          ),
        onError: (err) => toast.error(friendlyError(err, "Couldn't save the image")),
        onSettled: () => setPendingKind(null),
      },
    );
  }

  function addTopics(raw: string) {
    const parts = raw.split(",");
    const next = normalizeTopics([...draft.topics, ...parts]);
    if (draft.topics.length + parts.filter((p) => p.trim()).length > TOPICS_MAX) {
      toast.info(`Up to ${TOPICS_MAX} topics`);
    }
    onChange({ topics: next });
    setTopicInput("");
  }

  function onTopicKey(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.key === "Enter" || event.key === ",") && topicInput.trim()) {
      event.preventDefault();
      addTopics(topicInput);
    } else if (event.key === "Backspace" && !topicInput && draft.topics.length) {
      onChange({ topics: draft.topics.slice(0, -1) });
    }
  }

  const setLink = (index: number, patch: Partial<LinkDraft>) =>
    onChange({
      links: draft.links.map((link, i) => (i === index ? { ...link, ...patch } : link)),
    });

  return (
    <section className="community-card overflow-hidden p-0">
      {cropDialog}
      <div className="p-5 pb-0">
        <h2 className="text-sm font-semibold">Identity</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Make this space recognisably yours — it&apos;s how people find it, and the first thing
          they see when they arrive.
        </p>
      </div>

      {/* Live preview of the header, with the image controls on it. */}
      <div className="mt-4 border-y border-border/60">
        <div className="relative">
          <SpaceBanner path={space.banner_url} accent={accent} className="h-32" />
          {canEdit && (
            <div className="absolute right-3 top-3 flex gap-1.5">
              <DragDropFileInput
                accept="image/*"
                onFiles={(files) => pick("banner", files)}
                disabled={pendingKind !== null}
              >
                <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-card/90 px-3 text-xs font-medium shadow-sm ring-1 ring-border/60 hover:bg-card">
                  <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                  {pendingKind === "banner"
                    ? "Saving…"
                    : space.banner_url
                      ? "Change banner"
                      : "Add banner"}
                </span>
              </DragDropFileInput>
              {space.banner_url && (
                <button
                  type="button"
                  onClick={() => saveImage("banner", null)}
                  disabled={pendingKind !== null}
                  aria-label="Remove banner"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-card/90 shadow-sm ring-1 ring-border/60 hover:bg-card"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-end gap-4 px-5 pb-4">
          <div className="relative -mt-10 shrink-0">
            <SpaceAvatar
              name={draft.name || space.name}
              path={space.avatar_url}
              accent={accent}
              className="h-20 w-20 text-3xl ring-4 ring-[color-mix(in_oklab,var(--community-tint,var(--primary))_8%,var(--surface))]"
            />
            {canEdit && (
              <DragDropFileInput
                accept="image/*"
                onFiles={(files) => pick("avatar", files)}
                disabled={pendingKind !== null}
                // z-20: the avatar is z-10 (it overlaps the banner), and this
                // button must sit on top of it or clicks land on the picture.
                className="absolute -bottom-1 -right-1 z-20"
              >
                <span
                  role="button"
                  aria-label={space.avatar_url ? "Change picture" : "Add picture"}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border/70 hover:bg-surface-elevated"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </span>
              </DragDropFileInput>
            )}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <p className="truncate font-display text-xl font-semibold">
              {draft.name || space.name}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {draft.tagline || draft.description || "Add a tagline below"}
            </p>
          </div>
          {canEdit && space.avatar_url && (
            <button
              type="button"
              onClick={() => saveImage("avatar", null)}
              disabled={pendingKind !== null}
              className="mb-1 shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Remove picture
            </button>
          )}
        </div>
        {draft.topics.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 px-5 pb-4" aria-label="Topics preview">
            {draft.topics.map((topic) => (
              <li
                key={topic}
                className="rounded-full border px-2.5 py-0.5 text-xs"
                style={{
                  borderColor: `color-mix(in oklab, ${accent} 35%, var(--border))`,
                  background: `color-mix(in oklab, ${accent} 12%, transparent)`,
                }}
              >
                {topic}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="space-name">Name</Label>
            <Input
              id="space-name"
              value={draft.name}
              onChange={(e) => onChange({ name: e.target.value })}
              maxLength={50}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="space-tagline">Tagline</Label>
              <Counter value={draft.tagline} max={TAGLINE_MAX} />
            </div>
            <Input
              id="space-tagline"
              value={draft.tagline}
              onChange={(e) => onChange({ tagline: e.target.value.slice(0, TAGLINE_MAX) })}
              placeholder="One line on what this room is for"
              disabled={!canEdit}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="space-description">Short description</Label>
            <Counter value={draft.description} max={DESCRIPTION_MAX} />
          </div>
          <Textarea
            id="space-description"
            value={draft.description}
            onChange={(e) => onChange({ description: e.target.value.slice(0, DESCRIPTION_MAX) })}
            rows={2}
            disabled={!canEdit}
          />
          <p className="text-xs text-muted-foreground">Shown on the space&apos;s card in Spaces.</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="space-about">About</Label>
            <div className="flex items-center gap-2">
              <Counter value={draft.about} max={ABOUT_MAX} />
              <button
                type="button"
                onClick={() => setAboutPreview((v) => !v)}
                aria-pressed={aboutPreview}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
              >
                {aboutPreview ? (
                  <Pencil className="h-3 w-3" aria-hidden />
                ) : (
                  <Eye className="h-3 w-3" aria-hidden />
                )}
                {aboutPreview ? "Edit" : "Preview"}
              </button>
            </div>
          </div>
          {aboutPreview ? (
            <div className="min-h-32 rounded-md border border-border/60 community-well p-3">
              {aboutHtml ? (
                <div
                  className="prose-custom text-sm [&_p]:mb-2"
                  dangerouslySetInnerHTML={{ __html: aboutHtml }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
              )}
            </div>
          ) : (
            <Textarea
              id="space-about"
              value={draft.about}
              onChange={(e) => onChange({ about: e.target.value.slice(0, ABOUT_MAX) })}
              rows={7}
              placeholder={
                "What happens here, who it's for, how to get the most out of it.\n\nMarkdown works: **bold**, _italic_, - lists, [links](https://…)"
              }
              disabled={!canEdit}
            />
          )}
          <p className="text-xs text-muted-foreground">
            Shown in the space&apos;s About column. Markdown is supported.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="space-welcome">Welcome note</Label>
            <Counter value={draft.welcome} max={WELCOME_MAX} />
          </div>
          <Textarea
            id="space-welcome"
            value={draft.welcome}
            onChange={(e) => onChange({ welcome: e.target.value.slice(0, WELCOME_MAX) })}
            rows={3}
            placeholder="Shown to members until they dismiss it — say hi, point them to a first thread."
            disabled={!canEdit}
          />
        </div>

        <fieldset className="space-y-2" disabled={!canEdit}>
          <legend className="text-sm font-medium">Colour</legend>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onChange({ accent: null })}
              aria-pressed={!draft.accent}
              title={
                bannerColours.length > 0
                  ? "Follow the banner's main colour"
                  : "The default colour for this kind of space"
              }
              className={cn(
                "h-8 rounded-full border px-3 text-xs transition-colors",
                !draft.accent
                  ? "border-foreground/60 font-medium"
                  : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {bannerColours.length > 0 ? "Auto" : "Default"}
            </button>
            {SPACE_ACCENT_SWATCHES.map((swatch) => (
              <button
                key={swatch.value}
                type="button"
                onClick={() => onChange({ accent: swatch.value })}
                aria-pressed={draft.accent?.toLowerCase() === swatch.value}
                aria-label={swatch.label}
                title={swatch.label}
                className={cn(
                  "h-8 w-8 rounded-full ring-offset-2 ring-offset-[var(--surface)] transition-shadow",
                  draft.accent?.toLowerCase() === swatch.value
                    ? "ring-2 ring-foreground/70"
                    : "hover:ring-2 hover:ring-border",
                )}
                style={{ background: swatch.value }}
              />
            ))}
            {bannerColours.length > 0 && (
              <span className="flex items-center gap-2 border-l border-border/60 pl-2">
                <span className="text-xs text-muted-foreground">From banner</span>
                {bannerColours.map((colour) => (
                  <button
                    key={colour}
                    type="button"
                    onClick={() => onChange({ accent: colour })}
                    aria-pressed={draft.accent?.toLowerCase() === colour}
                    aria-label={`Banner colour ${colour}`}
                    title={colour}
                    className={cn(
                      "h-8 w-8 rounded-full ring-offset-2 ring-offset-[var(--surface)] transition-shadow",
                      draft.accent?.toLowerCase() === colour
                        ? "ring-2 ring-foreground/70"
                        : "hover:ring-2 hover:ring-border",
                    )}
                    style={{ background: colour }}
                  />
                ))}
              </span>
            )}
            <label className="inline-flex h-8 items-center gap-2 rounded-full border border-border/60 pl-1 pr-3 text-xs text-muted-foreground">
              <input
                type="color"
                value={isHexColor(draft.accent) ? draft.accent : "#7c3aed"}
                onChange={(e) => onChange({ accent: e.target.value })}
                aria-label="Custom colour"
                className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
              />
              Custom
            </label>
          </div>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="space-topic-input">Topics</Label>
          <div
            className={cn(
              "flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input community-well px-2 py-1.5",
              !canEdit && "opacity-60",
            )}
          >
            {draft.topics.map((topic) => (
              <span
                key={topic}
                className="inline-flex items-center gap-1 rounded-full bg-surface-elevated px-2 py-0.5 text-xs"
              >
                {topic}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onChange({ topics: draft.topics.filter((t) => t !== topic) })}
                    aria-label={`Remove ${topic}`}
                    className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
            {canEdit && draft.topics.length < TOPICS_MAX && (
              <input
                id="space-topic-input"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value.slice(0, TOPIC_MAX + 1))}
                onKeyDown={onTopicKey}
                onBlur={() => topicInput.trim() && addTopics(topicInput)}
                placeholder={draft.topics.length ? "Add another…" : "e.g. Branding, Critique"}
                className="min-w-28 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Up to {TOPICS_MAX}. Press Enter or comma to add one.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Links</p>
          <ul className="space-y-2">
            {draft.links.map((link, index) => {
              const problem = linkProblems.find((p) => p.index === index);
              return (
                <li key={index}>
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <Input
                      value={link.label}
                      onChange={(e) =>
                        setLink(index, { label: e.target.value.slice(0, LINK_LABEL_MAX) })
                      }
                      placeholder="Label"
                      aria-label={`Link ${index + 1} label`}
                      className="w-32 shrink-0 sm:w-40"
                      disabled={!canEdit}
                    />
                    <Input
                      value={link.url}
                      onChange={(e) => setLink(index, { url: e.target.value })}
                      placeholder="discord.gg/your-room"
                      aria-label={`Link ${index + 1} address`}
                      aria-invalid={!!problem}
                      className="min-w-0 flex-1"
                      disabled={!canEdit}
                    />
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() =>
                          onChange({ links: draft.links.filter((_, i) => i !== index) })
                        }
                        aria-label={`Remove link ${index + 1}`}
                        className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {problem && (
                    <p className="mt-1 pl-6 text-xs text-destructive">{problem.message}</p>
                  )}
                </li>
              );
            })}
          </ul>
          {canEdit && draft.links.length < LINKS_MAX && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onChange({ links: [...draft.links, { label: "", url: "" }] })}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add a link
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
