import React, { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Trophy,
  Users,
  Calendar,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Sparkles,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  useChallenge,
  useJoinChallenge,
  useLeaveChallenge,
  useUpdateChallengeProgress,
} from "@/hooks/use-challenges";

export const Route = createFileRoute("/_authenticated/challenges/$id")({
  component: ChallengeDetailPage,
});

function ChallengeDetailPage() {
  const { id } = Route.useParams();
  const { data: challenge, isLoading, error } = useChallenge(id);
  const joinMutation = useJoinChallenge();
  const leaveMutation = useLeaveChallenge();
  const updateProgressMutation = useUpdateChallengeProgress();

  const [notes, setNotes] = useState("");

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-12 flex justify-center items-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Clock className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Loading challenge details...</p>
        </div>
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div className="container max-w-4xl py-12 space-y-6">
        <Link
          to="/community"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Community
        </Link>
        <Card className="p-8 text-center space-y-4">
          <Trophy className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-bold">Challenge Not Found</h2>
          <p className="text-sm text-muted-foreground">
            This challenge may have been removed or does not exist.
          </p>
        </Card>
      </div>
    );
  }

  const isPending =
    joinMutation.isPending || leaveMutation.isPending || updateProgressMutation.isPending;

  const handleToggleJoin = () => {
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

  const handleMarkComplete = () => {
    updateProgressMutation.mutate({
      challengeId: challenge.id,
      status: "completed",
      progress: { note: notes, completed_at: new Date().toISOString() },
    }, {
      onSuccess: () => toast.success("Challenge marked as completed"),
      onError: () => toast.error("Failed to update progress"),
    });
  };

  const isCompleted = challenge.my_participation?.status === "completed";

  return (
    <div className="container max-w-4xl py-8 space-y-8 animate-fade-in">
      <Link
        to="/community"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Community Feed
      </Link>

      {/* Challenge Header Card */}
      <Card className="relative overflow-hidden border-border/60 bg-gradient-to-b from-card to-background p-6 md:p-8 space-y-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="capitalize bg-purple-500/10 text-purple-400 border-purple-500/20"
              >
                {challenge.type} Challenge
              </Badge>
              <Badge
                variant="outline"
                className="capitalize bg-amber-500/10 text-amber-400 border-amber-500/20"
              >
                {challenge.difficulty}
              </Badge>
              {isCompleted && (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1"
                >
                  <CheckCircle2 className="h-3 w-3" /> Challenge Completed!
                </Badge>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              {challenge.title}
            </h1>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={challenge.creator?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {challenge.creator?.display_name?.slice(0, 2).toUpperCase() || "CM"}
                  </AvatarFallback>
                </Avatar>
                <span>Created by {challenge.creator?.display_name || "Community Member"}</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                <span>{challenge.participant_count ?? 0} participants</span>
              </div>
              {challenge.end_date && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Ends {new Date(challenge.end_date).toLocaleDateString()}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              size="lg"
              variant={challenge.is_joined ? "outline" : "default"}
              disabled={isPending}
              onClick={handleToggleJoin}
              className="gap-2"
            >
              {isPending ? (
                <Clock className="h-4 w-4 animate-spin" />
              ) : challenge.is_joined ? (
                "Leave Challenge"
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Join Challenge
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Description & Skills */}
        <div className="space-y-4 pt-4 border-t border-border/40">
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {challenge.description}
          </p>

          {challenge.skills && challenge.skills.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-2">
              <span className="text-xs text-muted-foreground">Focus Skills:</span>
              {challenge.skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="text-xs bg-secondary/60">
                  #{skill}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Progress & Actions Section if Joined */}
      {challenge.is_joined && challenge.my_participation && (
        <Card className="p-6 space-y-4 border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-semibold">Your Challenge Status</h2>
            </div>
            <Badge variant="outline" className="capitalize bg-background">
              {challenge.my_participation.status || "joined"}
            </Badge>
          </div>

          {(() => {
            const myParticipation = challenge.my_participation!;
            const STATUS_STEPS = ["joined", "in_progress", "completed"] as const;
            const currentStepIndex = STATUS_STEPS.indexOf(myParticipation.status as typeof STATUS_STEPS[number]);
            const progressPercent = currentStepIndex >= 0 ? (currentStepIndex / (STATUS_STEPS.length - 1)) * 100 : 0;

            return (
              <>
                <Progress value={progressPercent} className="mb-4" />

                <div className="space-y-2">
                  {STATUS_STEPS.map((step, i) => {
                    const isCurrent = i === currentStepIndex;
                    const isDone = i < currentStepIndex;
                    const isAvailable = i === currentStepIndex + 1;
                    return (
                      <div key={step} className="flex items-center gap-3">
                        {isDone ? (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-3 w-3" />
                          </div>
                        ) : isCurrent ? (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary">
                            <div className="h-2 w-2 rounded-full bg-primary" />
                          </div>
                        ) : isAvailable ? (
                          <button
                            onClick={() => updateProgressMutation.mutate({ challengeId: challenge.id, status: step as any }, {
                              onSuccess: () => toast.success("Challenge status updated"),
                              onError: () => toast.error("Failed to update challenge status"),
                            })}
                            disabled={updateProgressMutation.isPending}
                            className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted-foreground hover:border-primary"
                          />
                        ) : (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted" />
                        )}
                        <span className={`text-sm capitalize ${isDone ? "text-muted-foreground line-through" : isCurrent ? "font-medium" : "text-muted-foreground"}`}>
                          {step.replace("_", " ")}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {myParticipation.status === "in_progress" && (
                  <div className="space-y-3 pt-2">
                    <p className="text-xs text-muted-foreground">
                      Work on this challenge and mark it completed when you&apos;re done to earn reputation points!
                    </p>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder="Optional notes or repository link..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="flex-1 text-xs px-3 py-2 rounded-md bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <Button
                        size="sm"
                        onClick={handleMarkComplete}
                        disabled={updateProgressMutation.isPending}
                        className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark Completed
                      </Button>
                    </div>
                  </div>
                )}

                {myParticipation.status === "completed" && (
                  <div className="mt-2 flex items-center gap-1 text-sm text-amber-600">
                    <Award className="h-4 w-4" />
                    <span>+15 reputation</span>
                  </div>
                )}
              </>
            );
          })()}
        </Card>
      )}

      {/* Participant Roster */}
      <Card className="p-6 space-y-4">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Challenge Participants (
            {challenge.participant_count ?? 0})
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {!challenge.participants || challenge.participants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No participants yet. Be the first to join!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {challenge.participants.map((part) => (
                <div
                  key={part.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/40"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={part.profile?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {part.profile?.display_name?.slice(0, 2).toUpperCase() || "CM"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {part.profile?.display_name || "Community Member"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @{part.profile?.handle || "user"}
                      </p>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-[10px] capitalize ${
                      part.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {part.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
