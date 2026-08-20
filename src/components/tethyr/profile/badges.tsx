import { Trophy, Check } from "lucide-react";
import { EXPERIENCE_LABEL, VERIFICATION_LABEL, VERIFICATION_STYLE } from "./types";
import type { SkillVerificationLevel, SkillExperienceLevel } from "@/hooks/use-current-user";
import { safeHref } from "@/lib/validators";

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
  if (level === "proof_certified" && proofUrl) {
    return (
      <a href={safeHref(proofUrl)} target="_blank" rel="noreferrer" className="hover:opacity-80">
        {content}
      </a>
    );
  }
  return content;
}
