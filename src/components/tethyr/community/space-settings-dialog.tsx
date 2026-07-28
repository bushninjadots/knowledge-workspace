import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useUpdateSpace,
  useDeleteSpace,
  useSpaceMembers,
  useUpdateMemberRole,
  useRemoveMember,
  type CommunitySpace,
  type SpaceMember,
  type SpaceMemberRole,
} from "@/hooks/use-community-spaces";
import { useCurrentUser } from "@/hooks/use-current-user";

const ROLE_LABELS: Record<SpaceMemberRole, string> = {
  owner: "Owner",
  moderator: "Mod",
  member: "Member",
};

const ROLE_OPTIONS: SpaceMemberRole[] = ["moderator", "member"];

export function SpaceSettingsDialog({
  space,
  open,
  onOpenChange,
  onDeleted,
}: {
  space: CommunitySpace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(space.name);
  const [description, setDescription] = useState(space.description);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateSpace = useUpdateSpace();
  const deleteSpace = useDeleteSpace();
  const { data: members = [] } = useSpaceMembers(space.id);
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const { data: me } = useCurrentUser();

  const isOwner = space.my_role === "owner";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateSpace.mutateAsync({
        id: space.id,
        name: name.trim(),
        description: description.trim(),
      });
      toast.success("Space updated");
      onOpenChange(false);
    } catch {
      toast.error("Failed to update");
    }
  }

  function handleDelete() {
    deleteSpace.mutate(space.id, {
      onSuccess: () => {
        toast.success("Space deleted");
        onOpenChange(false);
        onDeleted?.();
      },
      onError: () => toast.error("Failed to delete"),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Space settings</DialogTitle>
        </DialogHeader>

        {isOwner && (
          <form onSubmit={handleSave} className="space-y-4 border-b border-border pb-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={300}
              />
            </div>
            <Button type="submit" size="sm" disabled={!name.trim() || updateSpace.isPending}>
              Save changes
            </Button>
          </form>
        )}

        <div className="space-y-3">
          <Label>Members ({members.length})</Label>
          <div className="space-y-2">
            {members.map((member: SpaceMember) => (
              <MemberRow
                key={member.user_id}
                member={member}
                isOwner={isOwner}
                currentUserId={me?.userId}
                onRoleChange={(role) => {
                  updateRole.mutate({ spaceId: space.id, userId: member.user_id, role });
                }}
                onRemove={() => {
                  removeMember.mutate(
                    { spaceId: space.id, userId: member.user_id },
                    { onSuccess: () => toast.success("Member removed") },
                  );
                }}
              />
            ))}
          </div>
        </div>

        {isOwner && (
          <div className="border-t border-border pt-4">
            {!confirmDelete ? (
              <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete space
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-destructive">Are you sure? This cannot be undone.</p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteSpace.isPending}
                >
                  Confirm
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MemberRow({
  member,
  isOwner,
  currentUserId,
  onRoleChange,
  onRemove,
}: {
  member: SpaceMember;
  isOwner: boolean;
  currentUserId?: string;
  onRoleChange: (role: SpaceMemberRole) => void;
  onRemove: () => void;
}) {
  const name = member.profile?.display_name || member.profile?.handle || "Unknown";

  return (
    <div className="flex items-center justify-between rounded-xl bg-surface-elevated/50 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        <span className="text-xs text-muted-foreground">{ROLE_LABELS[member.role]}</span>
      </div>
      {isOwner && member.role !== "owner" && member.user_id !== currentUserId && (
        <div className="flex items-center gap-1">
          {ROLE_OPTIONS.filter((r) => r !== member.role).map((role) => (
            <Button
              key={role}
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onRoleChange(role)}
            >
              → {ROLE_LABELS[role]}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive"
            onClick={onRemove}
          >
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
