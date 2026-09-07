import { useEffect, useRef } from "react";
import { Briefcase } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { OpenRoleRow } from "@/hooks/use-projects";
import { ApplyToRoleButton } from "./project-role-applications";

interface ProjectJoinModalProps {
  open: boolean;
  projectId: string;
  projectTitle?: string;
  openRoles: OpenRoleRow[];
  meId: string | null;
  /** Role to spotlight + scroll to when the modal opens (from a sidebar Apply). */
  focusRoleId?: string | null;
  onClose: () => void;
}

export function ProjectJoinModal({
  open,
  projectId,
  projectTitle,
  openRoles,
  meId,
  focusRoleId,
  onClose,
}: ProjectJoinModalProps) {
  const focusRef = useRef<HTMLDivElement | null>(null);

  // Scroll the focused role into view once the modal renders (after layout settles).
  useEffect(() => {
    if (!open || !focusRoleId) return;
    const raf = requestAnimationFrame(() => {
      focusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(raf);
  }, [open, focusRoleId]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-xl border card-border bg-surface p-6">
        <DialogTitle className="font-display text-lg font-semibold">
          Join {projectTitle || "this project"}
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">
          Pick a role below to send an application. Your application will stay connected to this
          project.
        </DialogDescription>

        {openRoles.length > 0 ? (
          <div className="mt-4 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {openRoles.map((role) => {
              const focused = role.id === focusRoleId;
              return (
                <div
                  key={role.id}
                  ref={focused ? focusRef : undefined}
                  className={`rounded-xl border bg-background/40 p-3 transition ${
                    focused
                      ? "border-[var(--user-accent,var(--primary))]/60 ring-2 ring-[var(--user-accent,var(--primary))]/20"
                      : "border-border/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{role.title}</p>
                      {role.description && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {role.description}
                        </p>
                      )}
                      {role.skills.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {role.skills.map((s) => (
                            <span
                              key={s}
                              className="rounded-full border border-border/60 bg-background/60 px-2 py-0 text-[11px] text-muted-foreground"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <ApplyToRoleButton
                      roleId={role.id}
                      projectId={projectId}
                      isOwner={false}
                      meId={meId}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border card-border bg-background/40 p-4">
            <Briefcase className="h-5 w-5 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              This project isn't looking for collaborators right now. Follow its updates and
              community posts to stay in the loop.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
