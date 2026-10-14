// The dashboard's weekly ritual: post this week's ship, or — once posted —
// the streak and a way to see what everyone else shipped.
import { Link } from "@tanstack/react-router";
import { ArrowRight, Rocket } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useMyShip, useShipStreaks } from "@/hooks/use-ships";
import { streakLabel } from "@/lib/ship-log";

export function ShipWeekPrompt() {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;
  const { data: mine, isLoading } = useMyShip(userId);
  const { data: streaks } = useShipStreaks(userId ? [userId] : []);
  const streak = userId ? (streaks?.[userId] ?? 0) : 0;
  const shipped = !!mine;

  return (
    <div className="flex min-w-0 flex-col items-start gap-3 self-start">
      <div className="flex min-w-0 items-start gap-3">
        <Rocket className="mt-0.5 h-4 w-4 shrink-0 text-caution" aria-hidden />
        <div className="min-w-0">
          <p className="section-label">Ship log</p>
          <h2 id="weekly-show-your-work-heading" className="mt-1 text-sm font-semibold">
            {shipped ? "Shipped this week — nice." : "What did you ship this week?"}
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            {shipped
              ? `${streakLabel(streak) ?? "First week on the log"}. See what everyone else shipped and give some kudos.`
              : streak > 0
                ? `You're on a ${streak}-week streak. A few lines keeps it going — Tethyr drafts it from your journal and GitHub.`
                : "A few lines is enough. Tethyr drafts it from your journal and GitHub; you edit and post."}
          </p>
        </div>
      </div>
      {!isLoading && (
        <Link
          to="/ships"
          className="ml-7 inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-fade hover:opacity-90"
        >
          {shipped ? "See this week's ships" : "Post your ship"}{" "}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
