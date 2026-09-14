// Dialog for linking a library note/document to a file in one of the owner's
// GitHub repositories. Linking stores repo/path/branch only — nothing is
// pulled until the owner presses "Sync from GitHub".
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listGithubRepos, linkLibraryItemGithub } from "@/lib/github-server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Radix Select reserves the empty string for "no value", so the unset state
// needs its own sentinel.
const NO_REPO = "__none";

export function GithubLinkDialog({
  open,
  onOpenChange,
  itemId,
  initial,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  initial?: { repo: string; path: string; branch: string | null };
  onLinked: () => void;
}) {
  const [repo, setRepo] = useState(initial?.repo ?? "");
  const [path, setPath] = useState(initial?.path ?? "README.md");
  const [branch, setBranch] = useState(initial?.branch ?? "");

  const repos = useQuery({
    queryKey: ["github-repos"],
    queryFn: () => listGithubRepos(),
    enabled: open,
  });

  const submit = async () => {
    if (!repo.trim() || !path.trim()) return;
    const result = await linkLibraryItemGithub({
      data: { itemId, repo: repo.trim(), path: path.trim(), branch: branch.trim() || undefined },
    });
    if (result.ok) {
      onLinked();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link GitHub file</DialogTitle>
          <DialogDescription>
            Pick one of your repositories and the file to pull from. Nothing changes until you press
            “Sync from GitHub”.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="gh-repo">Repository</Label>
            {repos.isLoading ? (
              <div className="flex h-9 items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading repositories…
              </div>
            ) : (repos.data?.length ?? 0) > 0 ? (
              <Select
                value={repo || NO_REPO}
                onValueChange={(value) => setRepo(value === NO_REPO ? "" : value)}
              >
                <SelectTrigger id="gh-repo" className="w-full">
                  <SelectValue placeholder="Choose a repository…" />
                </SelectTrigger>
                <SelectContent>
                  {repos.data!.map((r) => (
                    <SelectItem key={r.full_name} value={r.full_name}>
                      {r.full_name}
                      {r.private ? " (private)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">
                No repositories found — connect GitHub in your profile first.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gh-path">File path</Label>
            <Input
              id="gh-path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="README.md"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gh-branch">Branch (optional)</Label>
            <Input
              id="gh-branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="Default branch"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!repo.trim() || !path.trim()}>
            Link file
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
