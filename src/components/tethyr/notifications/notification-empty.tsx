import { Bell, Compass, FolderOpen } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function NotificationEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-surface-elevated">
        <Bell className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <h3 className="text-lg font-medium text-foreground">You're all caught up</h3>
      <p className="mt-1 text-sm text-muted-foreground">No new notifications right now.</p>
      <div className="mt-6 flex gap-3">
        <Button asChild variant="outline" size="sm">
          <Link to="/explore">
            <FolderOpen className="mr-2 h-3.5 w-3.5" />
            Browse Projects
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/community">
            <Compass className="mr-2 h-3.5 w-3.5" />
            Explore Community
          </Link>
        </Button>
      </div>
    </div>
  );
}
