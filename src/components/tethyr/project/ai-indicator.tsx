import { Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { AI_COMMUNITY_THRESHOLD, useToggleAiTag } from "@/hooks/use-projects";

/**
 * AI-creation indicator for the project header.
 *
 * Shows a badge when the project is AI-assisted (owner self-report or
 * community consensus at the threshold). Signed-in non-owners can tag the
 * project as AI-assisted; the toggle reflects whether they've already tagged.
 *
 * The badge follows Tethyr's visual language: a rounded-full chip with a
 * subtle border tint, no gradient or glow.
 */
export function AiIndicator({
  projectId,
  ownerAssisted,
  aiTagCount,
  aiUserTagged,
  canTag,
}: {
  projectId: string;
  ownerAssisted: boolean;
  aiTagCount: number;
  aiUserTagged: boolean;
  /** Signed in and not the owner — eligible to community-tag. */
  canTag: boolean;
}) {
  const toggle = useToggleAiTag();

  const communityReached = aiTagCount >= AI_COMMUNITY_THRESHOLD;
  const showBadge = ownerAssisted || communityReached;

  const handleToggle = () => {
    toggle.mutate(
      { projectId, tagged: !aiUserTagged },
      {
        onSuccess: () => {
          toast.success(aiUserTagged ? "Removed your AI tag" : "Tagged as AI-assisted");
        },
        onError: (err) => toast.error(friendlyError(err)),
      },
    );
  };

  return (
    <div className="flex items-center gap-2">
      {showBadge && (
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--ai)]/30 bg-[var(--ai)]/10 px-2.5 py-0.5 text-[11px] font-medium text-[var(--ai)]"
          title={
            ownerAssisted
              ? "The builder marked this project as AI-assisted"
              : `${aiTagCount} community members flagged this as AI-assisted`
          }
        >
          {ownerAssisted ? <Sparkles className="h-3 w-3" /> : <Users className="h-3 w-3" />}
          AI-assisted
          {!ownerAssisted && communityReached && (
            <span className="text-[var(--ai)]/60">· {aiTagCount}</span>
          )}
        </span>
      )}

      {/* Community tag action — signed-in non-owners only. The button is
          intentionally small and quiet: it's a signal, not a call to arms. */}
      {canTag && (
        <button
          type="button"
          onClick={handleToggle}
          disabled={toggle.isPending}
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] transition-lift ${
            aiUserTagged
              ? "border-[var(--ai)]/30 bg-[var(--ai)]/10 text-[var(--ai)]"
              : "border-border/60 bg-background/40 text-muted-foreground hover:border-border-strong hover:text-foreground"
          }`}
          title={
            aiUserTagged
              ? "You flagged this as AI-assisted — click to remove your tag"
              : "Flag this project as built with AI assistance"
          }
        >
          <Sparkles className="h-3 w-3" />
          {aiUserTagged ? "Tagged" : "Flag AI"}
        </button>
      )}
    </div>
  );
}
