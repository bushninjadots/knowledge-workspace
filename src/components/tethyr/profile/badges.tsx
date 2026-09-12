import { Trophy, Check } from "lucide-react";
import { EXPERIENCE_LABEL, VERIFICATION_LABEL, VERIFICATION_STYLE } from "./types";
import type { SkillVerificationLevel, SkillExperienceLevel } from "@/hooks/use-current-user";
import { safeHref } from "@/lib/validators";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";

export function ExperienceBadge({ level }: { level: SkillExperienceLevel }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[11px] text-muted-foreground">
      {EXPERIENCE_LABEL[level]}
    </span>
  );
}

export function VerificationBadge({
  level,
  proofUrl,
}: {
  level: SkillVerificationLevel;
  proofUrl?: string | null;
}) {
  const Icon =
    level === "community_recognized" ? Trophy : level === "proof_certified" ? Check : null;
  const content = (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${VERIFICATION_STYLE[level]}`}
    >
      {Icon && <Icon className="h-2.5 w-2.5" />}
      {VERIFICATION_LABEL[level]}
    </span>
  );
  // If proofUrl is a storage path (not an HTTP URL), generate a signed URL
  // — the skill-proofs bucket is private, so getPublicUrl would 403.
  // If it's an HTTP URL (external link or legacy public URL), use it directly.
  // The hook must be called unconditionally (React rules of hooks); when
  // proofUrl is null or an HTTP URL, we pass null so it stays disabled.
  const isHttpUrl = proofUrl ? /^https?:\/\//.test(proofUrl) : false;
  const { data: signedUrl } = useSignedStorageUrl(
    "skill-proofs",
    !isHttpUrl && proofUrl ? proofUrl : null,
  );

  if (level === "proof_certified" && proofUrl) {
    const href = isHttpUrl ? proofUrl : signedUrl;
    if (!href) return content;
    return (
      <a href={safeHref(href)} target="_blank" rel="noreferrer" className="hover:opacity-80">
        {content}
      </a>
    );
  }
  return content;
}
