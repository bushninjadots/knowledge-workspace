import React from "react";
import { Link } from "@tanstack/react-router";
import {
  Trophy,
  Users,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Clock,
  ListChecks,
  Hourglass,
  XCircle,
  FileText,
  Award,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useJoinChallenge, useLeaveChallenge, type ChallengeRow } from "@/hooks/use-challenges";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";

const TYPE_COLORS: Record<string, string> = {
  skill: "bg-brand-purple/10 text-brand-purple border-brand-purple/20",
  project: "bg-primary/10 text-primary border-primary/20",
  learning: "bg-brand-green/10 text-brand-green border-brand-green/20",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-brand-green/10 text-brand-green border-brand-green/20",
  intermediate: "bg-teaching text-teaching border-teaching/40",
  advanced: "bg-warning text-warning border-warning/40",
};

export function ChallengeCard({ challenge }: { challenge: ChallengeRow }) {
  const joinMutation = useJoinChallenge();
  const leaveMutation = useLeaveChallenge();

  const isPending = joinMutation.isPending || leaveMutation.isPending;

  const handleToggleJoin = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (challenge.is_joined) {
      leaveMutation.mutate(challenge.id, {
        onSuccess: () => toast.success("Left challenge"),
        onError: () => toast.error("Failed to leave challenge"),
      });
    } else {
      joinMutation.mutate(challenge.id, {
        onSuccess: () => toast.success("Joined challenge"),
        onError: (err) => toast.error(`Failed to join: ${(err as Error).message}`),
      });
    }
  };

  return (
    <Card className="group relative rounded-xl border card-border bg-surface hover:border-[var(--user-accent-border,var(--border-strong))] hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className={`text-xs capitalize font-medium ${TYPE_COLORS[challenge.type] ?? ""}`}
              >
                {challenge.type} Challenge
              </Badge>
              <Badge
                variant="outline"
                className={`text-xs capitalize font-medium ${DIFFICULTY_COLORS[challenge.difficulty] ?? ""}`}
              >
                {challenge.difficulty}
              </Badge>
            </div>
            <h3 className="text-lg font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
              <Link to="/challenges/$id" params={{ id: challenge.id }}>
                {challenge.title}
              </Link>
            </h3>
          </div>
          <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
            <Trophy className="h-5 w-5" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-0 space-y-4">
        <p
          className="text-sm text-muted-foreground line-clamp-2 leading-relaxed"
          title={challenge.description}
        >
          {challenge.description}
        </p>

        {challenge.skills && challenge.skills.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {challenge.skills.map((skill) => (
              <Badge
                key={skill}
                variant="secondary"
                className="text-xs px-2.5 py-0.5 bg-secondary/60"
              >
                #{skill}
              </Badge>
            ))}
          </div>
        )}

        {challenge.pass_criteria && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2" title={challenge.pass_criteria}>
              Pass: {challenge.pass_criteria}
            </span>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span>
              {challenge.participant_count ?? 0}
              {challenge.max_participants ? `/ ${challenge.max_participants}` : ""} joined
            </span>
          </div>
          {challenge.end_date && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>Ends {new Date(challenge.end_date).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-5 pt-0 flex items-center justify-between gap-3 border-t border-border/30 mt-2">
        <div className="flex items-center gap-2">
          {challenge.is_joined ? (
            <ReviewStatusBadge status={challenge.my_participation?.review_status} />
          ) : (
            <span className="text-xs text-muted-foreground">
              Created by {challenge.creator?.display_name || "Community Member"}
            </span>
          )}
        </div>

        {challenge.is_joined &&
          challenge.my_participation?.review_status === "passed" &&
          challenge.my_participation?.submission_url && (
            <PassedSubmissionLink
              url={challenge.my_participation.submission_url}
              reviewedAt={challenge.my_participation.reviewed_at}
            />
          )}

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={challenge.is_joined ? "outline" : "default"}
            disabled={isPending}
            onClick={handleToggleJoin}
            className="text-xs h-8 px-3.5 min-h-[36px]"
          >
            {isPending ? (
              <Clock className="h-3.5 w-3.5 animate-spin" />
            ) : challenge.is_joined ? (
              "Leave Challenge"
            ) : (
              "Join Challenge"
            )}
          </Button>

          <Button size="sm" variant="ghost" asChild className="text-xs h-8 px-3 min-h-[36px]">
            <Link to="/challenges/$id" params={{ id: challenge.id }}>
              View Details <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function PassedSubmissionLink({ url, reviewedAt }: { url: string; reviewedAt?: string | null }) {
  const isHttp = /^https?:\/\//i.test(url ?? "");
  const { data: signedUrl } = useSignedStorageUrl("challenge-submissions", isHttp ? null : url);
  const href = isHttp ? url : (signedUrl ?? "#");
  const label = isHttp ? "View submission" : (url?.split("/").pop() ?? "Download submission");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/40 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-primary/40"
      >
        <FileText className="h-3 w-3" />
        {label}
        <ExternalLink className="h-3 w-3 text-muted-foreground" />
      </a>
      {reviewedAt && (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Award className="h-3 w-3 text-trust" />
          Passed {new Date(reviewedAt).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}

function ReviewStatusBadge({ status }: { status?: string | null }) {
  if (status === "passed") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-brand-green/30 text-brand-green bg-brand-green/10 text-xs"
      >
        <CheckCircle2 className="h-3.5 w-3.5" /> Passed
      </Badge>
    );
  }
  if (status === "submitted") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-teaching/30 text-teaching bg-teaching/10 text-xs"
      >
        <Hourglass className="h-3.5 w-3.5" /> Under review
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-destructive/30 text-destructive bg-destructive/10 text-xs"
      >
        <XCircle className="h-3.5 w-3.5" /> Needs revision
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-1 border-brand-green/30 text-brand-green bg-brand-green/10 text-xs"
    >
      <CheckCircle2 className="h-3.5 w-3.5" /> Joined
    </Badge>
  );
}
