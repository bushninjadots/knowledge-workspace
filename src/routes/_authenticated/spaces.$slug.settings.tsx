import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Globe,
  Lock,
  Trash2,
  Loader2,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  Crown,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/tethyr/empty-state";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useCommunitySpace,
  useUpdateSpace,
  useDeleteSpace,
  useSpaceMembers,
  useUpdateMemberRole,
  useRemoveMember,
  type SpaceMember,
  type SpaceMemberRole,
  type SpaceVisibility,
} from "@/hooks/use-community-spaces";

export const Route = createFileRoute("/_authenticated/spaces/$slug/settings")({
  head: () => ({
    meta: [
      { title: "Community settings — Tethyr" },
      {
        name: "description",
        content:
          "Edit your community name, description, visibility, and manage moderators and members.",
      },
      { property: "og:title", content: "Community settings — Tethyr" },
      {
        property: "og:description",
        content: "Manage your community details, visibility, and moderation team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SpaceSettingsPage,
});

const ROLE_LABELS: Record<SpaceMemberRole, string> = {
  owner: "Owner",
  moderator: "Moderator",
  member: "Member",
};

const ROLE_BADGE: Record<
  SpaceMemberRole,
  { variant: "teaching" | "learning" | "outline"; icon: React.ReactNode }
> = {
  owner: { variant: "teaching", icon: <Crown className="h-3 w-3" /> },
  moderator: { variant: "learning", icon: <Shield className="h-3 w-3" /> },
  member: { variant: "outline", icon: <User className="h-3 w-3" /> },
};

const ROLE_FILTERS: { value: "all" | SpaceMemberRole; label: string }[] = [
  { value: "all", label: "All" },
  { value: "moderator", label: "Moderators" },
  { value: "member", label: "Members" },
];

const PAGE_SIZE = 10;

function SpaceSettingsPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { data: space, isLoading } = useCommunitySpace(slug);
  const { data: me } = useCurrentUser();
  const { data: members = [] } = useSpaceMembers(space?.id ?? "");

  const updateSpace = useUpdateSpace();
  const deleteSpace = useDeleteSpace();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<SpaceVisibility>("public");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | SpaceMemberRole>("all");
  const [page, setPage] = useState(1);

  const counts = useMemo(() => {
    const c = { owner: 0, moderator: 0, member: 0 };
    for (const m of members as SpaceMember[]) c[m.role] += 1;
    return c;
  }, [members]);

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    const rank: Record<SpaceMemberRole, number> = { owner: 0, moderator: 1, member: 2 };
    return members
      .filter((m: SpaceMember) => (roleFilter === "all" ? true : m.role === roleFilter))
      .filter((m: SpaceMember) => {
        if (!q) return true;
        const name = (m.profile?.display_name ?? "").toLowerCase();
        const handle = (m.profile?.handle ?? "").toLowerCase();
        return name.includes(q) || handle.includes(q);
      })
      .sort((a: SpaceMember, b: SpaceMember) => rank[a.role] - rank[b.role]);
  }, [members, memberQuery, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rangeStart = filteredMembers.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filteredMembers.length);
  const pageMembers = filteredMembers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (!space) return;
    setName(space.name);
    setDescription(space.description ?? "");
    setVisibility(space.visibility ?? "public");
  }, [space]);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!space) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          icon={<Lock className="h-5 w-5" />}
          title="Community not found"
          description="This community doesn't exist or you don't have access to it."
        />
      </div>
    );
  }

  const isOwner = space.my_role === "owner";
  const canManage = isOwner || space.my_role === "moderator";

  if (!canManage) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          icon={<Lock className="h-5 w-5" />}
          title="You don't manage this community"
          description="Only owners and moderators can open community settings."
        />
      </div>
    );
  }

  const dirty =
    name.trim() !== space.name ||
    description.trim() !== (space.description ?? "") ||
    visibility !== (space.visibility ?? "public");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!space) return;
    try {
      await updateSpace.mutateAsync({
        id: space.id,
        name: name.trim(),
        description: description.trim(),
        visibility,
      });
      toast.success("Community settings saved");
    } catch (err) {
      toast.error(`Failed to save: ${(err as Error).message}`);
    }
  }

  function handleDelete() {
    if (!space) return;
    deleteSpace.mutate(space.id, {
      onSuccess: () => {
        toast.success("Community deleted");
        navigate({ to: "/community" });
      },
      onError: () => toast.error("Failed to delete community"),
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 flex items-start gap-3">
        <Link
          to="/community"
          search={{ space: space.slug }}
          aria-label="Back to the community"
          className="mt-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Community settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage details, visibility, and the moderation team for {space.name}.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-10">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Details</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            The name and description shown across the community.
          </p>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="space-name">Name</Label>
              <Input
                id="space-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                disabled={!isOwner}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="space-description">Description</Label>
              <Textarea
                id="space-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={300}
                disabled={!isOwner}
              />
              <p className="text-xs text-muted-foreground">{description.length}/300</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Visibility</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Control who can discover and read this community.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <VisibilityOption
              icon={<Globe className="h-4 w-4" />}
              title="Public"
              description="Anyone signed in can find, read, and join this community."
              selected={visibility === "public"}
              disabled={!isOwner}
              onSelect={() => setVisibility("public")}
            />
            <VisibilityOption
              icon={<Lock className="h-4 w-4" />}
              title="Private"
              description="Only members and the owner can see this community and its posts."
              selected={visibility === "private"}
              disabled={!isOwner}
              onSelect={() => setVisibility("private")}
            />
          </div>
        </section>

        {isOwner && (
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!name.trim() || !dirty || updateSpace.isPending}>
              {updateSpace.isPending ? "Saving..." : "Save changes"}
            </Button>
            {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
          </div>
        )}
      </form>

      <section className="mt-10 rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Moderators &amp; members</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {counts.owner} owner{counts.owner !== 1 ? "s" : ""} · {counts.moderator} moderator
              {counts.moderator !== 1 ? "s" : ""} · {counts.member} member
              {counts.member !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={memberQuery}
              onChange={(e) => {
                setMemberQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search members by name or handle..."
              aria-label="Search members"
              className="pl-8"
            />
            {memberQuery && (
              <button
                type="button"
                aria-label="Clear member search"
                onClick={() => {
                  setMemberQuery("");
                  setPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {ROLE_FILTERS.map((f) => (
              <Button
                key={f.value}
                type="button"
                size="sm"
                variant={roleFilter === f.value ? "default" : "outline"}
                onClick={() => {
                  setRoleFilter(f.value);
                  setPage(1);
                }}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-4 divide-y divide-border">
          {pageMembers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No members match your filters.
            </p>
          ) : (
            pageMembers.map((member: SpaceMember) => (
              <MemberRow
                key={member.user_id}
                member={member}
                isOwner={isOwner}
                currentUserId={me?.userId}
                busy={updateRole.isPending || removeMember.isPending}
                onRoleChange={(role) =>
                  updateRole.mutate(
                    { spaceId: space.id, userId: member.user_id, role },
                    {
                      onSuccess: () =>
                        toast.success(
                          role === "moderator" ? "Promoted to moderator" : "Demoted to member",
                        ),
                      onError: () => toast.error("Failed to update role"),
                    },
                  )
                }
                onRemove={() =>
                  removeMember.mutate(
                    { spaceId: space.id, userId: member.user_id },
                    {
                      onSuccess: () => toast.success("Member removed"),
                      onError: () => toast.error("Failed to remove member"),
                    },
                  )
                }
              />
            ))
          )}
        </div>

        {filteredMembers.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Showing {rangeStart}–{rangeEnd} of {filteredMembers.length}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                >
                  <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                >
                  Next
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      {isOwner && (
        <section className="mt-10 rounded-lg border border-destructive/40 bg-card p-5">
          <h2 className="text-sm font-semibold text-destructive">Danger zone</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Deleting a community removes it for everyone. This cannot be undone.
          </p>
          <div className="mt-4">
            {!confirmDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete community
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-destructive">Delete {space.name} permanently?</p>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteSpace.isPending}
                >
                  Confirm delete
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function VisibilityOption({
  icon,
  title,
  description,
  selected,
  disabled,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        selected
          ? "border-primary bg-surface-elevated"
          : "border-border hover:bg-surface-elevated/60"
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </span>
      <span className="mt-1.5 block text-xs text-muted-foreground">{description}</span>
    </button>
  );
}

function MemberRow({
  member,
  isOwner,
  currentUserId,
  busy,
  onRoleChange,
  onRemove,
}: {
  member: SpaceMember;
  isOwner: boolean;
  currentUserId?: string;
  busy?: boolean;
  onRoleChange: (role: SpaceMemberRole) => void;
  onRemove: () => void;
}) {
  const name = member.profile?.display_name || member.profile?.handle || "Unknown";
  const canEdit = isOwner && member.role !== "owner" && member.user_id !== currentUserId;

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name}</p>
          {member.profile?.handle && (
            <p className="truncate text-xs text-muted-foreground">@{member.profile.handle}</p>
          )}
        </div>
        <Badge variant={ROLE_BADGE[member.role].variant}>
          {ROLE_BADGE[member.role].icon}
          {ROLE_LABELS[member.role]}
        </Badge>
      </div>
      {canEdit && (
        <div className="flex shrink-0 items-center gap-1">
          {member.role === "member" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onRoleChange("moderator")}
            >
              <Shield className="mr-1.5 h-3.5 w-3.5" />
              Promote to moderator
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onRoleChange("member")}
            >
              Demote to member
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={busy}
            onClick={onRemove}
          >
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
