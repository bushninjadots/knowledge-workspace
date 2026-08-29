import { useState } from "react";
import { Plus, Trash2, HandHeart } from "lucide-react";
import { toast } from "sonner";
import type { OpenRoleRow } from "@/hooks/use-projects";
import {
  useCreateOpenRole,
  useDeleteOpenRole,
  useAcceptRoleApplication,
  useDeclineRoleApplication,
} from "@/hooks/use-projects";
import { ApplyToRoleButton, RoleApplicationsList } from "./project-role-applications";
import { Button } from "@/components/ui/button";

export function OpenRolesSection({
  roles,
  projectId,
  isOwner,
}: {
  roles: OpenRoleRow[];
  projectId: string;
  isOwner: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [skills, setSkills] = useState("");
  const createRole = useCreateOpenRole();
  const deleteRole = useDeleteOpenRole();
  const acceptApp = useAcceptRoleApplication();
  const declineApp = useDeclineRoleApplication();

  const handleAdd = async () => {
    if (!title.trim()) return;
    try {
      await createRole.mutateAsync({
        projectId,
        title: title.trim(),
        description: desc.trim() || undefined,
        skills: skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setTitle("");
      setDesc("");
      setSkills("");
      setShowAdd(false);
      toast.success("Role added");
    } catch {
      toast.error("Failed to add role");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRole.mutateAsync({ id, projectId });
      toast.success("Role removed");
    } catch {
      toast.error("Failed to delete role");
    }
  };

  const unfilledRoles = roles.filter((r) => !r.is_filled);

  return (
    <div className="rounded-xl bg-surface-elevated/30 p-3 sm:p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground/80">Open Roles</h3>
        {isOwner && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowAdd(!showAdd)}
            aria-expanded={showAdd}
            className="rounded-full"
          >
            <Plus className="h-3 w-3" />
            Add
          </Button>
        )}
      </div>

      {showAdd && (
        <div className="mb-4 space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Role title (e.g. React Developer)"
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="What this role involves (optional)"
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="Skills needed (comma-separated)"
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleAdd} busy={createRole.isPending} disabled={!title.trim()}>
              Save role
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {unfilledRoles.length === 0 && roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open roles yet.</p>
      ) : (
        <div className="space-y-2">
          {unfilledRoles.map((r) => (
            <div key={r.id} className="rounded-xl bg-background/40 p-3">
              <div className="flex items-start gap-3">
                <HandHeart className="mt-0.5 h-4 w-4 shrink-0 text-brand-purple" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.title}</p>
                  {r.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>
                  )}
                  {r.skills.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {r.skills.map((s) => (
                        <span
                          key={s}
                          className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  <ApplyToRoleButton roleId={r.id} projectId={projectId} isOwner={isOwner} />
                </div>
                {isOwner && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(r.id)}
                    busy={deleteRole.isPending}
                    aria-label={`Delete role ${r.title}`}
                    className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <RoleApplicationsList
                roleId={r.id}
                isOwner={isOwner}
                onAccept={(appId, profileId) =>
                  acceptApp.mutate({ applicationId: appId, profileId, roleId: r.id, projectId })
                }
                onDecline={(appId) =>
                  declineApp.mutate({ applicationId: appId, roleId: r.id, projectId })
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
