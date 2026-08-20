import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";

const DISMISSED_KEY = "tethyr-welcome-modal-dismissed";

export function WelcomeModal() {
  const { data: user } = useCurrentUser();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (!dismissed) {
      setOpen(true);
    }
  }, [user]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setOpen(false);
  };

  if (!user) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleDismiss();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Welcome to Tethyr, {user.profile?.display_name?.split(" ")[0] ?? "creator"}!
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            You're part of a community of people known by what they build. Here's how to get
            started.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          <Link to="/profile" onClick={handleDismiss}>
            <Button variant="outline" className="w-full justify-start gap-3">
              <span className="text-lg">🎨</span>
              <div className="text-left">
                <p className="font-medium">Add your skills</p>
                <p className="text-xs text-muted-foreground">
                  Share what you teach and what you're growing
                </p>
              </div>
            </Button>
          </Link>

          <Link to="/explore" onClick={handleDismiss}>
            <Button variant="outline" className="w-full justify-start gap-3">
              <span className="text-lg">🔍</span>
              <div className="text-left">
                <p className="font-medium">Explore the community</p>
                <p className="text-xs text-muted-foreground">
                  Find projects and people to collaborate with
                </p>
              </div>
            </Button>
          </Link>

          <Link to="/community" onClick={handleDismiss}>
            <Button variant="outline" className="w-full justify-start gap-3">
              <span className="text-lg">💬</span>
              <div className="text-left">
                <p className="font-medium">Join the conversation</p>
                <p className="text-xs text-muted-foreground">
                  Ask questions, share work, find collaborators
                </p>
              </div>
            </Button>
          </Link>
        </div>

        <Button
          variant="ghost"
          className="mt-2 w-full text-muted-foreground"
          onClick={handleDismiss}
        >
          I'll explore on my own
        </Button>
      </DialogContent>
    </Dialog>
  );
}
