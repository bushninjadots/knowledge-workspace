// One member's ship for a week: who, what they shipped, the GitHub links it
// came from, what's next, and kudos + replies. Used by the Ship log page and
// the member's own log.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CircleDot,
  FolderGit2,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
  MessageCircle,
  Rocket,
  Tag,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MemberAvatar } from "@/components/tethyr/member-avatar";
import { ProfileLink } from "@/components/tethyr/profile-link";
import {
  useDeleteShipReply,
  useReplyToShip,
  useShipReplies,
  useToggleShipKudos,
  type Ship,
} from "@/hooks/use-ships";
import {
  SHIP_REPLY_MAX,
  safeHighlightUrl,
  shipErrorMessage,
  streakLabel,
  type ShipHighlight,
} from "@/lib/ship-log";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

const HIGHLIGHT_ICON: Record<string, LucideIcon> = {
  pr_merged: GitMerge,
  pr_opened: GitPullRequest,
  release: Tag,
  repo_created: FolderGit2,
  push: GitCommitHorizontal,
  issue: CircleDot,
};

export function ShipHighlights({
  highlights,
  onRemove,
}: {
  highlights: ShipHighlight[];
  onRemove?: (index: number) => void;
}) {
  if (highlights.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {highlights.map((h, i) => {
        const Icon = HIGHLIGHT_ICON[h.kind] ?? GitCommitHorizontal;
        const href = safeHighlightUrl(h.url);
        const label = (
          <>
            <Icon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{h.title}</span>
          </>
        );
        return (
          <li
            key={`${h.url}-${i}`}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-surface-elevated/60 py-0.5 pr-1 pl-2.5 text-xs"
          >
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex min-w-0 items-center gap-1.5 hover:text-foreground hover:underline"
              >
                {label}
              </a>
            ) : (
              <span className="inline-flex min-w-0 items-center gap-1.5">{label}</span>
            )}
            {onRemove ? (
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={`Remove ${h.title}`}
                className="rounded-full px-1 text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            ) : (
              <span className="w-1" />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function StreakBadge({ streak }: { streak: number | undefined }) {
  const label = streakLabel(streak);
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--caution)_14%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[color-mix(in_oklab,var(--caution)_55%,var(--foreground))]">
      <Rocket className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

function ShipReplies({ ship, userId }: { ship: Ship; userId: string | undefined }) {
  const { data: replies, isLoading } = useShipReplies(ship.id);
  const reply = useReplyToShip(userId);
  const remove = useDeleteShipReply();
  const [body, setBody] = useState("");

  async function send() {
    const text = body.trim();
    if (!text) return;
    try {
      await reply.mutateAsync({ shipId: ship.id, body: text });
      setBody("");
    } catch (error) {
      toast.error(shipErrorMessage(error));
    }
  }

  return (
    <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading replies…</p>
      ) : (
        replies?.map((r) => {
          const name = r.author?.display_name || r.author?.handle || "Member";
          const canRemove = !!userId && (r.author_id === userId || ship.author_id === userId);
          return (
            <div key={r.id} className="flex gap-2.5">
              <MemberAvatar name={name} avatarPath={r.author?.avatar_url} className="h-7 w-7" />
              <div className="min-w-0 flex-1">
                <p className="text-xs">
                  <ProfileLink handle={r.author?.handle} className="font-medium hover:underline">
                    {name}
                  </ProfileLink>{" "}
                  <span className="text-muted-foreground">· {timeAgo(r.created_at)}</span>
                </p>
                <p className="text-sm break-words whitespace-pre-line">{r.body}</p>
              </div>
              {canRemove && (
                <button
                  type="button"
                  onClick={() => remove.mutate({ id: r.id, shipId: ship.id })}
                  aria-label="Remove reply"
                  className="self-start p-1 text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })
      )}
      {userId && (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, SHIP_REPLY_MAX))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="Ask how, cheer them on…"
            aria-label="Reply"
            className="min-h-9 flex-1 resize-none rounded-xl"
          />
          <Button type="submit" size="sm" busy={reply.isPending} disabled={!body.trim()}>
            Reply
          </Button>
        </form>
      )}
    </div>
  );
}

export function ShipCard({
  ship,
  userId,
  streak,
  kudosGiven,
  showAuthor = true,
  actions,
}: {
  ship: Ship;
  userId: string | undefined;
  streak?: number;
  kudosGiven: boolean;
  showAuthor?: boolean;
  /** Owner controls (edit / delete), shown in the header. */
  actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggle = useToggleShipKudos(userId);
  const name = ship.author?.display_name || ship.author?.handle || "Member";
  const mine = ship.author_id === userId;
  const kudos = ship.kudos;

  return (
    <article className="surface-card p-4 sm:p-5">
      <header className="flex items-start gap-3">
        {showAuthor && (
          <ProfileLink handle={ship.author?.handle} ariaLabel={name}>
            <MemberAvatar name={name} avatarPath={ship.author?.avatar_url} />
          </ProfileLink>
        )}
        <div className="min-w-0 flex-1">
          {showAuthor && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <ProfileLink handle={ship.author?.handle} className="font-medium hover:underline">
                {name}
              </ProfileLink>
              <StreakBadge streak={streak} />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {ship.author?.creator_title && showAuthor ? `${ship.author.creator_title} · ` : ""}
            {timeAgo(ship.created_at)}
            {ship.project && (
              <>
                {" · "}
                <Link
                  to="/projects/$id"
                  params={{ id: ship.project.id }}
                  className="text-foreground hover:underline"
                >
                  {ship.project.title}
                </Link>
              </>
            )}
          </p>
        </div>
        {actions}
      </header>

      <p className="mt-3 text-sm leading-relaxed break-words whitespace-pre-line">{ship.body}</p>

      {ship.highlights.length > 0 && (
        <div className="mt-3">
          <ShipHighlights highlights={ship.highlights} />
        </div>
      )}

      {ship.next_up && (
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Next up:</span> {ship.next_up}
        </p>
      )}

      <footer className="mt-4 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={kudosGiven ? "secondary" : "ghost"}
          className={cn("rounded-full", kudosGiven && "text-foreground")}
          disabled={!userId || mine || toggle.isPending}
          aria-pressed={kudosGiven}
          title={mine ? "Your own ship" : kudosGiven ? "Take back kudos" : "Give kudos"}
          onClick={() =>
            toggle.mutate(
              { shipId: ship.id, on: !kudosGiven },
              { onError: (error) => toast.error(shipErrorMessage(error)) },
            )
          }
        >
          <Rocket className={cn("h-3.5 w-3.5", kudosGiven && "text-caution")} aria-hidden />
          Kudos{kudos > 0 && <span className="tabular-nums">· {kudos}</span>}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="rounded-full"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
          {ship.replies > 0
            ? `${ship.replies} ${ship.replies === 1 ? "reply" : "replies"}`
            : "Reply"}
        </Button>
      </footer>

      {open && <ShipReplies ship={ship} userId={userId} />}
    </article>
  );
}
