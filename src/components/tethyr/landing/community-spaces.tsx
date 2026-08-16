import { Link } from "@tanstack/react-router";
import { ArrowRight, Building2 } from "lucide-react";
import { useCommunitySpaces, type CommunitySpace } from "@/hooks/use-community-spaces";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";

export function CommunitySpaces() {
  const { data, isLoading } = useCommunitySpaces();
  const spaces = (data ?? []) as CommunitySpace[];
  if (isLoading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-border/60 bg-surface"
            />
          ))}
        </div>
      </section>
    );
  }
  if (spaces.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="section-label mb-3">Community spaces</p>{" "}
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Spaces where builders connect
          </h2>
        </div>
        <Link
          to="/community"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary"
        >
          Browse spaces <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {spaces.slice(0, 4).map((space) => (
          <SpaceCard key={space.id} space={space} />
        ))}
      </div>
    </section>
  );
}

function SpaceCard({ space }: { space: CommunitySpace }) {
  const initial = space.name.charAt(0).toUpperCase();
  // community_spaces.avatar_url stores a storage path — sign it to render.
  const { data: avatarUrl } = useSignedStorageUrl("avatars", space.avatar_url);
  return (
    <Link
      to="/community"
      className="group rounded-xl bg-surface-elevated/30 p-5 transition hover:bg-surface-elevated/50"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-surface-elevated text-base font-semibold">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full rounded-xl object-cover" />
        ) : (
          initial
        )}
      </div>
      <h3 className="mt-4 truncate font-display text-base font-semibold group-hover:text-primary">
        {space.name}
      </h3>
      {space.description && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{space.description}</p>
      )}
      <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" />
        {space.visibility === "private" ? "Private space" : "Community space"}
      </div>
    </Link>
  );
}
