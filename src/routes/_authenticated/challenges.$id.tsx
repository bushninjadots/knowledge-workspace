import React, { useEffect, useState } from "react";
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
  UploadCloud,
  FileText,
  ShieldCheck,
  XCircle,
  ExternalLink,
  Download,
  Loader2,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  useChallenge,
  useJoinChallenge,
  useLeaveChallenge,
  useUpdateChallengeProgress,
  useSubmitChallengeWork,
  useReviewChallengeSubmission,
  type ChallengeParticipantRow,
} from "@/hooks/use-challenges";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { safeHref, isSafeUrl, sanitizeFilename, validateLibraryFile } from "@/lib/validators";

export const Route = createFileRoute("/_authenticated/challenges/$id")({
  head: () => ({
    meta: [
      { title: "Challenge — Tethyr" },
      { name: "description", content: "Join a challenge and level up with the community." },
    ],
  }),
  component: ChallengeDetailPage,
});

function ChallengeDetailPage() {
  const { id } = Route.useParams();
  const { data: challenge, isLoading, error } = useChallenge(id);
  const { data: me } = useCurrentUser();
  const joinMutation = useJoinChallenge();
  const leaveMutation = useLeaveChallenge();
  const updateProgressMutation = useUpdateChallengeProgress();
  const submitWorkMutation = useSubmitChallengeWork();
  const reviewMutation = useReviewChallengeSubmission();

  const [submitUrl, setSubmitUrl] = useState("");
  const [submitNote, setSubmitNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isCreator = me?.userId === challenge?.created_by;

  // Replace the generic tab title with the challenge's real title once loaded.
  useEffect(() => {
    if (challenge?.title) document.title = `${challenge.title} — Tethyr`;
  }, [challenge?.title]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 flex justify-center items-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Clock className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Loading challenge details...</p>
        </div>
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
        <Link
          to="/challenges"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Challenges
        </Link>
        <div className="rounded-xl bg-surface-elevated/30 p-8 text-center">
          <Trophy className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="mt-4 font-display text-xl font-semibold">Challenge Not Found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This challenge may have been removed or does not exist.
          </p>
        </div>
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
        onError: (err) => toast.error(friendlyError(err, "Failed to join")),
      });
    }
  };

  async function handleUploadSubmissionFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !me?.userId || !challenge) return;
    const check = validateLibraryFile(file);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    const safeName = sanitizeFilename(file.name) || `submission.${check.ext}`;
    setUploading(true);
    try {
      // Path: <participantId>/<challengeId>/<timestamp>-<safe-name>
      const path = `${me.userId}/${challenge.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("challenge-submissions")
        .upload(path, file);
      if (upErr) throw upErr;
      setSubmitUrl(path);
      toast.success("File uploaded — attach a note and submit");
    } catch (err: unknown) {
      toast.error(friendlyError(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmitForReview() {
    if (!challenge) return;
    if (!submitUrl.trim()) {
      toast.error("Upload a file or paste a link to your finished work first");
      return;
    }
    const trimmed = submitUrl.trim();
    if (/^https?:\/\//i.test(trimmed) && !isSafeUrl(trimmed)) {
      toast.error("That link doesn't look valid");
      return;
    }
    submitWorkMutation.mutate(
      {
        challengeId: challenge.id,
        submissionUrl: trimmed,
        submissionNote: submitNote,
      },
      {
        onSuccess: () => {
          toast.success("Submitted for review — the creator will review your work");
          setSubmitUrl("");
          setSubmitNote("");
        },
        onError: () => toast.error("Failed to submit"),
      },
    );
  }
  function handleReview(
    participant: ChallengeParticipantRow,
    status: "passed" | "rejected",
    note: string,
  ) {
    if (!challenge) return;
    reviewMutation.mutate(
      {
        challengeId: challenge.id,
        participantId: participant.id,
        reviewStatus: status,
        reviewerNote: note.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            status === "passed"
              ? "Submission passed — badge + reputation awarded"
              : "Submission rejected",
          );
        },
        onError: () => toast.error("Failed to update review"),
      },
    );
  }

  const myReview = challenge.my_participation?.review_status;
  const isVerified = myReview === "passed";
  const isPendingVerification =
    challenge.my_participation?.status === "completed" && myReview !== "passed";

  return (
    <div className="animate-room-enter min-h-screen bg-noise">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        <Link
          to="/challenges"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Challenges
        </Link>

        {/* Challenge Header */}
        <div className="rounded-xl bg-surface-elevated/30 p-5 sm:p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {challenge.is_starter && (
                  <Badge
                    variant="outline"
                    className="gap-1 bg-brand-purple/10 text-brand-purple border-brand-purple/30"
                  >
                    <Sparkles className="h-3 w-3" /> Starter · Curated by Tethyr
                  </Badge>
                )}
                <Badge variant="outline" className="capitalize bg-ai text-ai border-ai/40">
                  {challenge.type} Challenge
                </Badge>
                <Badge
                  variant="outline"
                  className="capitalize bg-teaching text-teaching border-teaching/40"
                >
                  {challenge.difficulty}
                </Badge>
                {isVerified && (
                  <Badge variant="outline" className="bg-trust text-trust border-trust/40 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Challenge Completed!
                  </Badge>
                )}
                {isPendingVerification && myReview === "submitted" && (
                  <Badge
                    variant="outline"
                    className="bg-teaching text-teaching border-teaching/40 gap-1"
                  >
                    <Clock className="h-3 w-3" /> Under review
                  </Badge>
                )}
                {isPendingVerification && myReview === "rejected" && (
                  <Badge
                    variant="outline"
                    className="bg-destructive/10 text-destructive border-destructive/30 gap-1"
                  >
                    <XCircle className="h-3 w-3" /> Needs revision
                  </Badge>
                )}
                {isPendingVerification && !myReview && (
                  <Badge
                    variant="outline"
                    className="bg-teaching text-teaching border-teaching/40 gap-1"
                  >
                    <Clock className="h-3 w-3" /> Marked complete — pending verification
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                {challenge.title}
              </h1>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ChallengeAvatar
                    profile={challenge.creator}
                    className="h-5 w-5"
                    fallbackClassName="text-[11px]"
                  />
                  <span>
                    {challenge.is_starter
                      ? "Curated by Tethyr"
                      : `Created by ${challenge.creator?.display_name || "Community Member"}`}
                  </span>
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

            {challenge.pass_criteria && (
              <div className="mt-2 rounded-xl border card-border bg-background/40 p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <ListChecks className="h-3.5 w-3.5" />
                  Pass criteria
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {challenge.pass_criteria}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Progress & Actions Section if Joined */}
        {challenge.is_joined && challenge.my_participation && (
          <div className="rounded-xl border card-border bg-[var(--user-accent-subtle,var(--learning-subtle))] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-trust" />
                <h2 className="text-lg font-semibold">Your Challenge Status</h2>
              </div>
              <Badge variant="outline" className="capitalize bg-background">
                {(challenge.my_participation.status || "joined").replace(/_/g, " ")}
              </Badge>
            </div>

            {(() => {
              const myParticipation = challenge.my_participation!;
              const STATUS_STEPS = ["joined", "in_progress", "completed"] as const;
              const currentStepIndex = STATUS_STEPS.indexOf(
                myParticipation.status as (typeof STATUS_STEPS)[number],
              );
              const progressPercent =
                currentStepIndex >= 0 ? (currentStepIndex / (STATUS_STEPS.length - 1)) * 100 : 0;

              return (
                <>
                  <Progress
                    value={progressPercent}
                    className="mb-4"
                    aria-label={`Challenge progress: ${progressPercent}%`}
                  />

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
                              onClick={() =>
                                updateProgressMutation.mutate(
                                  {
                                    challengeId: challenge.id,
                                    status: step as (typeof STATUS_STEPS)[number],
                                  },
                                  {
                                    onSuccess: () => toast.success("Challenge status updated"),
                                    onError: () => toast.error("Failed to update challenge status"),
                                  },
                                )
                              }
                              disabled={updateProgressMutation.isPending}
                              className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))]"
                            />
                          ) : (
                            <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted" />
                          )}
                          <span
                            className={`text-sm capitalize ${isDone ? "text-muted-foreground line-through" : isCurrent ? "font-medium" : "text-muted-foreground"}`}
                          >
                            {step.replace(/_/g, " ")}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {(myParticipation.status === "in_progress" ||
                    (myParticipation.status === "completed" &&
                      myParticipation.review_status === "none")) && (
                    <div className="space-y-3 pt-2">
                      {myParticipation.status === "completed" && (
                        <p className="flex items-start gap-1.5 rounded-lg border border-teaching/30 bg-teaching/5 px-3 py-2 text-xs text-teaching">
                          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>
                            You marked this complete, but it isn&apos;t verified yet. Submit your
                            work below — you&apos;ll earn the badge and reputation once the creator
                            passes it.
                          </span>
                        </p>
                      )}
                      {challenge.pass_criteria && (
                        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>
                            To pass, your submission should include:{" "}
                            <span className="text-foreground/80">{challenge.pass_criteria}</span>
                          </span>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Finished? Upload your work — the creator will review it before you earn the
                        badge and reputation.
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={handleUploadSubmissionFile}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="gap-1.5 text-xs"
                          >
                            {uploading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <UploadCloud className="h-3.5 w-3.5" />
                            )}
                            {submitUrl ? "File attached" : "Upload your work"}
                          </Button>
                          <span className="text-[11px] text-muted-foreground">
                            or paste a link below
                          </span>
                        </div>
                        <input
                          type="text"
                          placeholder="Link to your work (repo, video, doc…) or uploaded file name"
                          value={submitUrl}
                          onChange={(e) => setSubmitUrl(e.target.value)}
                          className="w-full text-xs px-3 py-2 rounded-md bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <input
                          type="text"
                          placeholder="Short note for the reviewer (optional)"
                          value={submitNote}
                          onChange={(e) => setSubmitNote(e.target.value.slice(0, 300))}
                          className="w-full text-xs px-3 py-2 rounded-md bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <Button
                          size="sm"
                          onClick={handleSubmitForReview}
                          disabled={submitWorkMutation.isPending || uploading}
                          className="gap-1.5 text-xs bg-trust hover:bg-trust"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" /> Submit for Review
                        </Button>
                      </div>
                    </div>
                  )}

                  {myParticipation.review_status === "submitted" && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-teaching">
                      <Clock className="h-4 w-4" />
                      <span>Under review — the creator hasn&apos;t graded it yet.</span>
                    </div>
                  )}

                  {myParticipation.review_status === "passed" && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-teaching">
                      <Award className="h-4 w-4" />
                      <span>Passed review — badge + 15 reputation earned!</span>
                    </div>
                  )}

                  {myParticipation.review_status === "rejected" && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <XCircle className="h-4 w-4" />
                        <span>Needs another pass — revise and resubmit.</span>
                      </div>
                      {myParticipation.reviewer_note && (
                        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
                          Creator: {myParticipation.reviewer_note}
                        </p>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-1 text-xs"
                        onClick={() => {
                          updateProgressMutation.mutate(
                            { challengeId: challenge.id, status: "in_progress" },
                            {
                              onSuccess: () => toast.success("You can now resubmit"),
                              onError: () => toast.error("Failed to reset"),
                            },
                          );
                        }}
                      >
                        Revise & resubmit
                      </Button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Creator review panel — submissions waiting for a verdict */}
        {isCreator &&
          (challenge.participants ?? []).some((p) => p.review_status === "submitted") && (
            <div className="rounded-xl border border-teaching/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-teaching" />
                <h2 className="text-lg font-semibold">Review submissions</h2>
              </div>
              {challenge.pass_criteria && (
                <p className="flex items-start gap-1.5 rounded-lg border border-teaching/20 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                  <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teaching" />
                  <span>
                    <span className="font-medium text-foreground/80">Your pass criteria:</span>{" "}
                    {challenge.pass_criteria}
                  </span>
                </p>
              )}
              <div className="space-y-3">
                {challenge.participants
                  .filter((p) => p.review_status === "submitted")
                  .map((p) => (
                    <ReviewSubmissionCard
                      key={p.id}
                      participant={p}
                      busy={reviewMutation.isPending}
                      onReview={handleReview}
                    />
                  ))}
              </div>
            </div>
          )}

        {/* Participant Roster */}
        <div className="rounded-xl bg-surface-elevated/30 p-5 sm:p-6 space-y-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" /> Participants (
            {challenge.participant_count ?? 0})
          </h2>
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
                    <ChallengeAvatar
                      profile={part.profile}
                      className="h-8 w-8"
                      fallbackClassName="text-xs"
                    />
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
                    className={`text-[11px] capitalize ${
                      part.review_status === "passed"
                        ? "bg-trust text-trust border-trust/40"
                        : part.review_status === "submitted"
                          ? "bg-teaching text-teaching border-teaching/40"
                          : part.review_status === "rejected"
                            ? "bg-destructive/10 text-destructive border-destructive/30"
                            : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {part.review_status === "passed"
                      ? "Passed"
                      : part.review_status === "submitted"
                        ? "Under review"
                        : part.review_status === "rejected"
                          ? "Needs revision"
                          : part.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewSubmissionCard({
  participant,
  busy,
  onReview,
}: {
  participant: ChallengeParticipantRow;
  busy: boolean;
  onReview: (
    participant: ChallengeParticipantRow,
    status: "passed" | "rejected",
    note: string,
  ) => void;
}) {
  const [note, setNote] = useState("");

  return (
    <div className="rounded-xl border card-border bg-background/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChallengeAvatar
            profile={participant.profile}
            className="h-8 w-8"
            fallbackClassName="text-xs"
          />
          <div>
            <p className="text-sm font-medium">
              {participant.profile?.display_name || "Community Member"}
            </p>
            <p className="text-xs text-muted-foreground">
              Submitted{" "}
              {participant.submitted_at
                ? new Date(participant.submitted_at).toLocaleDateString()
                : ""}
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="capitalize bg-teaching/10 text-teaching border-teaching/30"
        >
          Awaiting review
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SubmissionLink url={participant.submission_url} />
        {participant.submission_note && (
          <span className="text-xs text-muted-foreground">{participant.submission_note}</span>
        )}
      </div>
      <input
        type="text"
        placeholder="Review note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 300))}
        className="w-full text-xs px-3 py-2 rounded-md bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="gap-1.5 text-xs bg-trust hover:bg-trust"
          onClick={() => onReview(participant, "passed", note)}
          disabled={busy}
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Pass — award badge
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs text-destructive"
          onClick={() => onReview(participant, "rejected", note)}
          disabled={busy}
        >
          <XCircle className="h-3.5 w-3.5" /> Reject
        </Button>
      </div>
    </div>
  );
}

/**
 * Resolves a submission reference to a working link:
 * - http(s) URLs open directly (safeHref-validated)
 * - storage paths (participant uploads to the private challenge-submissions
 *   bucket) are turned into short-lived signed URLs so the creator can
 *   actually open the file.
 */
function SubmissionLink({ url }: { url: string | null }) {
  const isHttp = /^https?:\/\//i.test(url ?? "");
  const { data: signedUrl } = useSignedStorageUrl("challenge-submissions", isHttp ? null : url);
  const href = isHttp ? safeHref(url ?? "") : (signedUrl ?? "#");
  const label = isHttp ? "View submission" : (url?.split("/").pop() ?? "Download file");

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground hover:border-primary/40"
    >
      <FileText className="h-3.5 w-3.5" />
      {label}
      {!isHttp && <Download className="h-3 w-3 text-muted-foreground" />}
      <ExternalLink className="h-3 w-3 text-muted-foreground" />
    </a>
  );
}

function ChallengeAvatar({
  profile,
  className,
  fallbackClassName,
}: {
  profile?: { avatar_url?: string | null; display_name?: string | null } | null;
  className?: string;
  fallbackClassName?: string;
}) {
  const { data: avatarUrl } = useSignedStorageUrl("avatars", profile?.avatar_url);
  return (
    <Avatar className={className}>
      <AvatarImage src={avatarUrl ?? undefined} />
      <AvatarFallback className={fallbackClassName}>
        {profile?.display_name?.slice(0, 2).toUpperCase() || "CM"}
      </AvatarFallback>
    </Avatar>
  );
}
