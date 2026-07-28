import { useState } from "react";
import { toast } from "sonner";
import { Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCommunitySpaces, useSharePost } from "@/hooks/use-community-spaces";

export function ShareSpaceDialog({
  open,
  onOpenChange,
  postId,
  currentSpaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  currentSpaceId?: string | null;
}) {
  const { data: spaces = [], isLoading } = useCommunitySpaces();
  const sharePost = useSharePost();
  const [sharedTo, setSharedTo] = useState<Set<string>>(new Set());

  const memberSpaces = spaces.filter(
    (s: (typeof spaces)[number]) => s.is_member && s.id !== currentSpaceId,
  );

  async function handleShare(spaceId: string) {
    try {
      await sharePost.mutateAsync({ postId, spaceId });
      setSharedTo((prev) => new Set(prev).add(spaceId));
      toast.success("Shared to space");
    } catch {
      toast.error("Failed to share");
    }
  }

  function handleClose() {
    setSharedTo(new Set());
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Share to space
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-64 overflow-y-auto">
          {isLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading spaces...</p>
          ) : memberSpaces.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Join a community space to share posts there.
            </p>
          ) : (
            <div className="space-y-1">
              {memberSpaces.map((space: (typeof memberSpaces)[number]) => {
                const alreadyShared = sharedTo.has(space.id);
                return (
                  <button
                    key={space.id}
                    onClick={() => handleShare(space.id)}
                    disabled={alreadyShared}
                    className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-surface-elevated disabled:opacity-60"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-purple/10 text-sm font-semibold text-brand-purple">
                      {space.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{space.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {space.member_count ?? 0} member{(space.member_count ?? 0) !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {alreadyShared ? (
                      <Check className="h-4 w-4 shrink-0 text-brand-green" />
                    ) : (
                      <Share2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
