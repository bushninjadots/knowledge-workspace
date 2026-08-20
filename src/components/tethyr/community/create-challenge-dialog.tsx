import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import {
  useCreateChallenge,
  type ChallengeType,
  type ChallengeDifficulty,
} from "@/hooks/use-challenges";

export function CreateChallengeDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  projectId,
}: {
  /** Optional controlled mode — lets callers open the dialog from elsewhere. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Pre-link the new challenge to this project (e.g. opened from a project page). */
  projectId?: string | null;
} = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (controlledOnOpenChange) controlledOnOpenChange(v);
    else setInternalOpen(v);
  };
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<string>("skill");
  const [skills, setSkills] = useState("");
  const [difficulty, setDifficulty] = useState<string>("intermediate");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [passCriteria, setPassCriteria] = useState("");
  const create = useCreateChallenge();

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }

    create.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        type: type as ChallengeType,
        skills: skills
          ? skills
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        difficulty: difficulty as ChallengeDifficulty,
        start_date: startDate || null,
        end_date: endDate || null,
        max_participants: maxParticipants ? parseInt(maxParticipants) : null,
        pass_criteria: passCriteria.trim() || null,
        project_id: projectId ?? null,
      },
      {
        onSuccess: () => {
          toast.success("Challenge created");
          setOpen(false);
          setTitle("");
          setDescription("");
          setSkills("");
          setStartDate("");
          setEndDate("");
          setMaxParticipants("");
          setPassCriteria("");
        },
        onError: (err) => toast.error(friendlyError(err, "Failed to create challenge")),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Create Challenge</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a Challenge</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Challenge title"
          />
          <Textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            aria-label="Challenge description"
          />
          <div className="grid grid-cols-2 gap-3">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger aria-label="Challenge type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skill">Skill</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="learning">Learning</SelectItem>
              </SelectContent>
            </Select>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger aria-label="Difficulty level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder="Skills (comma-separated)"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            aria-label="Skills, comma-separated"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Start date</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">End date</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <Input
            placeholder="Max participants (optional)"
            type="number"
            min="1"
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
            aria-label="Maximum participants"
          />
          <Textarea
            placeholder="Pass criteria (optional) — what must a submission include to pass? e.g. working demo + 3 commits + short write-up"
            value={passCriteria}
            onChange={(e) => setPassCriteria(e.target.value)}
            rows={2}
            aria-label="Pass criteria"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={create.isPending}>
              {create.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
