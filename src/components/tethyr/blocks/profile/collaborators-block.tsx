// ── Profile Collaborators Block ──────────────────────────────────────────────
// "People they build with": everyone this profile shares a project with,
// surfaced as PersonPills that link to each collaborator's public Studio.
// Fetches from project_contributors (the people-join for projects).

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { registerBlock } from "@/lib/block-registry";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { PersonPill } from "@/components/tethyr/person-pill";
import type { BlockProps } from "@/lib/page-blocks";

type CollaboratorRow = {
  profile_id: string;
  role: string;
  /** The project shared with this profile (used only to count shared projects). */
  project_id: string;
  profile: {
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
    creator_title: string | null;
  } | null;
};

function ProfileCollaboratorsBlock({ context }: BlockProps) {
  const { blockId, isEditing, onBlockEmptyChange } = context;
  const profileId = context.ownerType === "profile" ? context.ownerId : null;

  const { data, isLoading } = useQuery({
    queryKey: ["profile-collaborators-block", profileId],
    queryFn: async (): Promise<CollaboratorRow[]> => {
      if (!profileId) return [];
      // Projects this profile is part of.
      const { data: memberships } = await supabase
        .from("project_contributors")
        .select("project_id")
        .eq("profile_id", profileId)
        .limit(50);
      const projectIds = (memberships ?? []).map((m) => m.project_id);
      if (projectIds.length === 0) return [];
      // Everyone else sharing any of those projects, excluding ourselves and
      // the project's creator (already surfaced in the project header).
      const { data } = await supabase
        .from("project_contributors")
        .select(
          "profile_id, role, project_id, profile:profiles(display_name, handle, avatar_url, creator_title)",
        )
        .in("project_id", projectIds)
        .neq("profile_id", profileId)
        .limit(40);
      // Dedupe by person, preferring the strongest shared role (creator wins,
      // then the most recent shared project).
      const byPerson = new Map<string, CollaboratorRow>();
      for (const row of (data ?? []) as unknown as CollaboratorRow[]) {
        const existing = byPerson.get(row.profile_id);
        if (!existing || (row.role === "creator" && existing.role !== "creator")) {
          byPerson.set(row.profile_id, row);
        }
      }
      return Array.from(byPerson.values()).slice(0, 12);
    },
    enabled: !!profileId,
  });

  useEffect(() => {
    if (isLoading || isEditing || !blockId) return;
    onBlockEmptyChange?.(blockId, !data || data.length === 0);
  }, [blockId, data, isEditing, isLoading, onBlockEmptyChange]);

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-32 rounded-full" />
        ))}
      </div>
    );
  }

  const people = data ?? [];
  if (people.length === 0) {
    if (context.isEditing) {
      return (
        <BlockEmptyState
          label="People they build with"
          detail="As you collaborate on projects with others, they appear here."
        />
      );
    }
    return null;
  }

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Users className="h-4 w-4 text-muted-foreground" />
        People they build with
      </h3>
      <div className="flex flex-wrap gap-2">
        {people.map((c) => (
          <CollaboratorPill key={c.profile_id} row={c} />
        ))}
      </div>
    </div>
  );
}

function CollaboratorPill({ row }: { row: CollaboratorRow }) {
  const { data: avatarSigned } = useSignedStorageUrl("avatars", row.profile?.avatar_url ?? null);
  return (
    <PersonPill
      handle={row.profile?.handle}
      name={row.profile?.display_name ?? row.profile?.handle}
      role={row.role}
      title={row.profile?.creator_title}
      avatarSrc={avatarSigned}
      size="md"
    />
  );
}

registerBlock({
  type: "profile-collaborators",
  category: "people",
  label: "People They Build With",
  description: "The people this profile co-builds projects with, each leading to their Studio.",
  icon: "Users",
  defaults: {},
  component: ProfileCollaboratorsBlock,
});

export { ProfileCollaboratorsBlock };
