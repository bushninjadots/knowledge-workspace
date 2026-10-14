// The Ship log: this week's "what I shipped" from everyone (or the people you
// follow), with your own week on top. Earlier weeks are one click back.
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/tethyr/empty-state";
import { PageContainer, PageHeader } from "@/components/tethyr/page-header";
import { SegmentedControl } from "@/components/tethyr/segmented-control";
import { ShipCard } from "@/components/tethyr/ships/ship-card";
import { ShipComposer } from "@/components/tethyr/ships/ship-composer";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useFollowing } from "@/hooks/use-follow";
import { useMyShipKudos, useShipStreaks, useWeekShips } from "@/hooks/use-ships";
import { shiftWeek, shipWeekOf, weekLabel } from "@/lib/ship-log";

type Scope = "everyone" | "following";

export function ShipsPage() {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;
  const current = shipWeekOf();
  const [week, setWeek] = useState(current);
  const [scope, setScope] = useState<Scope>("everyone");

  const { data: ships, isLoading } = useWeekShips(week);
  const { data: following } = useFollowing(userId ?? "");
  const { data: myKudos } = useMyShipKudos(userId);

  const followingIds = useMemo(
    () => new Set((following ?? []).map((f) => f.following_id)),
    [following],
  );
  // Your own ship sits in "Your week" above, so the feed is everyone else's.
  const feed = (ships ?? []).filter(
    (s) =>
      !(week === current && s.author_id === userId) &&
      (scope === "everyone" || followingIds.has(s.author_id)),
  );
  const { data: streaks } = useShipStreaks(feed.map((s) => s.author_id));
  const isCurrent = week === current;

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Ship log"
        meta={
          <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-xs text-muted-foreground">
            {weekLabel(week, current)}
          </span>
        }
        description="Every week, post what you shipped — a feature, a fix, a design, something you learned. Tethyr drafts it from your GitHub; you edit and post. Keep the streak going."
        actions={
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              className="rounded-full"
              aria-label="Previous week"
              onClick={() => setWeek((w) => shiftWeek(w, -1))}
            >
              <ChevronLeft />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="rounded-full"
              aria-label="Next week"
              disabled={isCurrent}
              onClick={() => setWeek((w) => shiftWeek(w, 1))}
            >
              <ChevronRight />
            </Button>
          </div>
        }
      />

      <div className="space-y-8">
        {isCurrent && <ShipComposer />}

        <section aria-labelledby="ships-feed" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="ships-feed" className="text-sm font-semibold">
              {isCurrent ? "What everyone shipped" : `${weekLabel(week, current)}'s ships`}
              {feed.length > 0 && (
                <span className="ml-1.5 font-normal tabular-nums text-muted-foreground">
                  · {feed.length}
                </span>
              )}
            </h2>
            <SegmentedControl
              size="sm"
              value={scope}
              onChange={setScope}
              ariaLabel="Whose ships"
              options={[
                { value: "everyone", label: "Everyone" },
                { value: "following", label: "Following" },
              ]}
            />
          </div>

          {isLoading ? (
            <div className="space-y-3" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-36 animate-gentle-pulse surface-card" />
              ))}
            </div>
          ) : feed.length === 0 ? (
            scope === "following" && followingIds.size === 0 ? (
              <EmptyState
                icon={<Rocket className="h-5 w-5" />}
                title="You're not following anyone yet"
                description="Follow builders whose work you like and their ships show up here every week."
                actionLabel="Find builders"
                actionHref="/explore"
              />
            ) : (
              <EmptyState
                icon={<Rocket className="h-5 w-5" />}
                title={isCurrent ? "No ships yet this week" : "No ships that week"}
                description={
                  isCurrent
                    ? "Be the first — post yours above. Ships from everyone land here through the week."
                    : "Try another week, or switch to Everyone."
                }
              />
            )
          ) : (
            <div className="space-y-3">
              {feed.map((ship) => (
                <ShipCard
                  key={ship.id}
                  ship={ship}
                  userId={userId}
                  streak={streaks?.[ship.author_id]}
                  kudosGiven={myKudos?.has(ship.id) ?? false}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
