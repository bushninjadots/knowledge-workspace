import { useState } from "react";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CURRENT_USER_KEY, useCurrentUser } from "@/hooks/use-current-user";
import { useSkillsCatalog } from "@/hooks/use-current-user";
import { ProjectDialog } from "./profile-sections";

export function CreateProjectButton({
  variant = "default",
  size = "sm",
  className,
  label = "Create",
  onCreated,
}: {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "icon";
  className?: string;
  label?: string;
  onCreated?: () => void;
}) {
  const { data: me } = useCurrentUser();
  const queryClient = useQueryClient();
  const { data: skills = [] } = useSkillsCatalog();
  const [open, setOpen] = useState(false);

  if (!me?.userId) return null;

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <Plus className={size === "icon" ? "h-4 w-4" : "mr-1.5 h-3.5 w-3.5"} />
        {size !== "icon" && label}
      </Button>
      {open && (
        <ProjectDialog
          project={null}
          userId={me.userId}
          allSkills={skills}
          initialSkillIds={[]}
          open={open}
          onOpenChange={setOpen}
          onSaved={() => {
            setOpen(false);
            queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY });
            queryClient.invalidateQueries({ queryKey: ["explore-projects"] });
            onCreated?.();
          }}
        />
      )}
    </>
  );
}
