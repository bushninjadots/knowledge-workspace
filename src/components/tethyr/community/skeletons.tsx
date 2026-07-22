import { Skeleton } from "@/components/ui/skeleton";

export function PostCardSkeleton() {
  return (
    <div className="card-border rounded-3xl border border-l-[3px] border-l-muted-foreground/20 bg-surface p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-14" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <div className="mt-4 flex items-center gap-3 border-t border-border/60 pt-3">
        <Skeleton className="h-7 w-20 rounded-xl" />
        <Skeleton className="h-7 w-18 rounded-xl" />
        <Skeleton className="h-7 w-18 rounded-xl" />
        <Skeleton className="h-7 w-16 rounded-xl" />
      </div>
    </div>
  );
}

export function CommunityCardSkeleton() {
  return (
    <div className="card-border flex items-center gap-3 rounded-3xl border bg-surface p-4">
      <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function ChallengeCardSkeleton() {
  return (
    <div className="card-border rounded-3xl border bg-surface p-5">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
      <Skeleton className="mt-1 h-3 w-36" />
    </div>
  );
}
