import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFollowStatus, useFollowUser, useUnfollowUser } from "@/hooks/use-follow";
import { useCurrentUser } from "@/hooks/use-current-user";

export function FollowButton({
  targetUserId,
  size = "default",
}: {
  targetUserId: string;
  size?: "sm" | "default";
}) {
  const { data: me } = useCurrentUser();
  const { data: followData } = useFollowStatus(targetUserId);
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();
  const [hovered, setHovered] = useState(false);

  if (!me?.userId || me.userId === targetUserId) return null;

  const isFollowing = followData?.isFollowing ?? false;
  const isLoading = followUser.isPending || unfollowUser.isPending;

  function handleClick() {
    if (isFollowing) {
      unfollowUser.mutate(targetUserId, {
        onSuccess: () => toast.success("Unfollowed"),
        onError: () => toast.error("Failed to unfollow"),
      });
    } else {
      followUser.mutate(targetUserId, {
        onSuccess: () => toast.success("Following!"),
        onError: () => toast.error("Failed to follow"),
      });
    }
  }

  if (isFollowing) {
    return (
      <Button
        size={size}
        variant="default"
        className="rounded-full"
        disabled={isLoading}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleClick}
      >
        {hovered ? "Unfollow" : "Following"}
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant="outline"
      className="rounded-full"
      disabled={isLoading}
      onClick={handleClick}
    >
      Follow
    </Button>
  );
}
