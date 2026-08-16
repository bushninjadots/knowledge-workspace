import { useState } from "react";
import { toast } from "sonner";
import { Globe, ShieldCheck, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCreateSpace, type SpaceJoinType } from "@/hooks/use-community-spaces";

export function CreateSpaceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [joinType, setJoinType] = useState<SpaceJoinType>("auto");
  const [rules, setRules] = useState<string[]>([]);
  const [ruleInput, setRuleInput] = useState("");
  const createSpace = useCreateSpace();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await createSpace.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        join_type: joinType,
        rules: rules.filter(Boolean),
      });
      toast.success("Space created!");
      setName("");
      setDescription("");
      setRules([]);
      setRuleInput("");
      setJoinType("auto");
      onOpenChange(false);
      onCreated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create space";
      toast.error(msg);
    }
  }

  function addRule() {
    const v = ruleInput.trim();
    if (v && !rules.includes(v) && rules.length < 10) {
      setRules([...rules, v]);
      setRuleInput("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a community space</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="space-name">Name</Label>
            <Input
              id="space-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Video Editing, Web Dev, Music Production"
              maxLength={50}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="space-desc">Description</Label>
            <Textarea
              id="space-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this space about?"
              rows={3}
              maxLength={300}
            />
          </div>

          {/* Join type — like a subreddit's approval setting */}
          <div className="space-y-2">
            <Label>Who can join?</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setJoinType("auto")}
                aria-pressed={joinType === "auto"}
                className={`rounded-xl border p-3 text-left transition ${
                  joinType === "auto"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-surface-elevated/60"
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Globe className="h-4 w-4 text-primary" />
                  Anyone can join
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Instant — like a public subreddit.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setJoinType("review")}
                aria-pressed={joinType === "review"}
                className={`rounded-xl border p-3 text-left transition ${
                  joinType === "review"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-surface-elevated/60"
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4 text-brand-purple" />
                  Request to join
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Owners approve each member.
                </span>
              </button>
            </div>
          </div>

          {/* Community rules */}
          <div className="space-y-2">
            <Label>Rules (optional)</Label>
            <div className="flex gap-2">
              <Input
                value={ruleInput}
                onChange={(e) => setRuleInput(e.target.value)}
                placeholder="e.g. Be kind, no spam"
                maxLength={120}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRule();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addRule}
                disabled={!ruleInput.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {rules.length > 0 && (
              <ul className="space-y-1.5 pt-1">
                {rules.map((rule, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-elevated/50 px-3 py-1.5 text-xs"
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-surface-elevated text-[10px] font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    {rule}
                    <button
                      type="button"
                      onClick={() => setRules(rules.filter((_, j) => j !== i))}
                      className="ml-auto rounded p-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || createSpace.isPending}>
              {createSpace.isPending ? "Creating..." : "Create space"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
