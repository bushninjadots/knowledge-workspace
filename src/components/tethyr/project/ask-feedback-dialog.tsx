// Ask for feedback straight from a project: posts a feedback request that
// carries the project (so replies come back to its page), to the whole
// community or to one of the asker's spaces, tagged with the project's skills
// so it also surfaces on those skill pages.
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreatePost, type ProjectSnapshot } from "@/hooks/use-community";
import { useCommunitySpaces } from "@/hooks/use-community-spaces";
import { FEEDBACK_TAG_OPTIONS } from "@/lib/community-data";
import { validateFeedbackRequest } from "@/lib/community-validation";
import { friendlyError } from "@/lib/error-message";
import { cn } from "@/lib/utils";

const EVERYONE = "everyone";
const QUESTION_MAX = 140;
const CONTEXT_MAX = 2000;

export type FeedbackProject = {
  id: string;
  title: string;
  description: string | null;
  status?: string | null;
  stage?: string | null;
  skills: { slug: string }[];
};

export function AskFeedbackDialog({
  project,
  open,
  onOpenChange,
}: {
  project: FeedbackProject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createPost = useCreatePost();
  const { data: spaces = [] } = useCommunitySpaces();
  const mySpaces = useMemo(() => spaces.filter((s) => s.is_member), [spaces]);

  const [where, setWhere] = useState(EVERYONE);
  const [areas, setAreas] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");

  const toggleArea = (area: string) =>
    setAreas((current) =>
      current.includes(area) ? current.filter((a) => a !== area) : [...current, area],
    );

  function reset() {
    setWhere(EVERYONE);
    setAreas([]);
    setQuestion("");
    setContext("");
  }

  function submit() {
    const areaError = validateFeedbackRequest(areas);
    if (areaError) return toast.error(areaError);
    const ask = question.trim();
    if (!ask) return toast.error("Say what you'd like feedback on");

    const snapshot: ProjectSnapshot = {
      name: project.title,
      description: project.description,
      platform: "tethyr",
      url: `/projects/${project.id}`,
      logo: null,
      status: project.status ?? undefined,
      stage: project.stage ?? undefined,
    };
    const space = where === EVERYONE ? null : (mySpaces.find((s) => s.id === where) ?? null);

    createPost.mutate(
      {
        type: "feedback_request",
        title: ask,
        body: context.trim(),
        project_id: project.id,
        project_snapshot: snapshot,
        feedback_tags: areas,
        skills: project.skills.map((s) => s.slug),
        space_id: space?.id ?? null,
      },
      {
        onSuccess: (post) => {
          qc.invalidateQueries({ queryKey: ["project-community-posts", project.id] });
          toast.success(space ? `Asked ${space.name} for feedback` : "Asked the community", {
            description: "Replies show up on this project too.",
            action: {
              label: "View post",
              onClick: () =>
                navigate({
                  to: "/community",
                  search: (space
                    ? { post: post.id, space: space.slug }
                    : { post: post.id }) as Record<string, string>,
                }),
            },
          });
          reset();
          onOpenChange(false);
        },
        onError: (err) => toast.error(friendlyError(err, "Couldn't post your request")),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask for feedback</DialogTitle>
          <DialogDescription>
            Post {project.title} to the community. Replies come back to this page, and you can mark
            the one that helped most.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="feedback-question">What do you want to know?</Label>
            <Input
              id="feedback-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, QUESTION_MAX))}
              placeholder={`e.g. Is the onboarding in ${project.title} clear?`}
              autoFocus
            />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Feedback on</legend>
            <div className="flex flex-wrap gap-1.5">
              {FEEDBACK_TAG_OPTIONS.map((area) => {
                const on = areas.includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleArea(area)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      on
                        ? "border-caution/60 bg-caution/15 font-medium text-foreground"
                        : "border-border/60 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {area}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="feedback-context">Context (optional)</Label>
            <Textarea
              id="feedback-context"
              value={context}
              onChange={(e) => setContext(e.target.value.slice(0, CONTEXT_MAX))}
              rows={3}
              placeholder="What you've tried, what you're unsure about, a link to look at…"
            />
          </div>

          <div className="space-y-1.5">
            <Label id="feedback-where-label">Where</Label>
            <Select value={where} onValueChange={setWhere}>
              <SelectTrigger aria-labelledby="feedback-where-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EVERYONE}>Everyone — the Community feed</SelectItem>
                {mySpaces.map((space) => (
                  <SelectItem key={space.id} value={space.id}>
                    {space.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mySpaces.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Join a space to ask a smaller room that shares your craft.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} busy={createPost.isPending}>
            Ask for feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
