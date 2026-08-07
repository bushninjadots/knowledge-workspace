// Real quick-match for the landing hero — powered by the same matching engine used
// across Tethyr (computeMatchScore over profile_skills_teach / profile_skills_learn).
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Search, Sparkles, X, Zap } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { computeMatchScore, type AvailabilityStatus, type SkillMeta } from "@/lib/skill-match";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvailabilityBadge } from "./availability-badge";

// Untyped tables (profile_skills_* / profiles aren't fully typed yet)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type SkillOption = { id: string; name: string; slug: string };

type CandidateProfile = {
  id: string;
  handle: string | null;
  display_name: string | null;
  creator_title: string | null;
  avatar_url: string | null;
  availability: AvailabilityStatus;
  languages: string[];
};

type MatchResult = {
  profile_id: string;
  handle: string | null;
  display_name: string | null;
  creator_title: string | null;
  avatar_url: string | null;
  availability: AvailabilityStatus;
  matchScore: number;
  matchReasons: string[];
};

function useSkillsCatalog() {
  return useQuery({
    queryKey: ["landing-skills-catalog"],
    queryFn: async (): Promise<SkillOption[]> => {
      const { data, error } = await supabase
        .from("skills")
        .select("id, name, slug")
        .order("name", { ascending: true })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as SkillOption[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

async function findMatches(
  offer: SkillOption | null,
  learn: SkillOption | null,
): Promise<MatchResult[]> {
  if (!offer && !learn) return [];
  const targetTeachIds = new Set(offer ? [offer.id] : []);
  const targetLearnIds = new Set(learn ? [learn.id] : []);

  const { data: profiles } = await sb
    .from("profiles")
    .select("id, handle, display_name, creator_title, avatar_url, availability, languages")
    .not("display_name", "is", null)
    .limit(200);
  if (!profiles || profiles.length === 0) return [];

  const candidateIds = profiles.map((p: CandidateProfile) => p.id);
  const [teachRes, learnRes] = await Promise.all([
    sb
      .from("profile_skills_teach")
      .select("profile_id, skill_id, experience_level, verification_level, skills(name, category)")
      .in("profile_id", candidateIds),
    sb
      .from("profile_skills_learn")
      .select("profile_id, skill_id, skills(name, category)")
      .in("profile_id", candidateIds),
  ]);

  const teachMap = new Map<string, SkillMeta[]>();
  for (const row of teachRes.data ?? []) {
    const s = row.skills as { name: string; category: string } | null;
    if (!s) continue;
    const list = teachMap.get(row.profile_id) ?? [];
    list.push({
      skill_id: row.skill_id,
      name: s.name,
      category: s.category,
      experience_level: row.experience_level,
      verification_level: row.verification_level,
    });
    teachMap.set(row.profile_id, list);
  }

  const learnMap = new Map<string, SkillMeta[]>();
  for (const row of learnRes.data ?? []) {
    const s = row.skills as { name: string; category: string } | null;
    if (!s) continue;
    const list = learnMap.get(row.profile_id) ?? [];
    list.push({ skill_id: row.skill_id, name: s.name, category: s.category });
    learnMap.set(row.profile_id, list);
  }

  return profiles
    .map((p: CandidateProfile): MatchResult => {
      const { score, reasons } = computeMatchScore({
        candidateTeach: teachMap.get(p.id) ?? [],
        candidateLearn: learnMap.get(p.id) ?? [],
        candidateAvail: p.availability,
        candidateLangs: p.languages,
        targetLearnIds,
        targetTeachIds,
        targetAvail: null,
        targetLangs: [],
      });
      return {
        profile_id: p.id,
        handle: p.handle,
        display_name: p.display_name,
        creator_title: p.creator_title,
        avatar_url: p.avatar_url,
        availability: p.availability,
        matchScore: score,
        matchReasons: reasons,
      };
    })
    .filter((c: MatchResult) => c.matchScore > 0)
    .sort((a: MatchResult, b: MatchResult) => b.matchScore - a.matchScore)
    .slice(0, 4);
}

// ---------------------------------------------------------------------------
// Skill picker — combobox-lite over the real skills catalog
// ---------------------------------------------------------------------------

function SkillPicker({
  label,
  placeholder,
  value,
  onChange,
  catalog,
}: {
  label: string;
  placeholder: string;
  value: SkillOption | null;
  onChange: (skill: SkillOption | null) => void;
  catalog: SkillOption[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog.slice(0, 6);
    return catalog.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 6);
  }, [catalog, query]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const select = (skill: SkillOption) => {
    onChange(skill);
    setQuery(skill.name);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <span className="pointer-events-none absolute left-3 top-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(null);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open) {
            if (e.key === "ArrowDown" || e.key === "Enter") setOpen(true);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (suggestions[highlight]) select(suggestions[highlight]);
            else setOpen(false);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-label={label}
        className="w-full rounded-xl border border-border/60 bg-surface-elevated/60 py-2.5 pr-8 pl-3 pt-7 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/50"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
          aria-label={`Clear ${label}`}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-border/60 bg-surface shadow-lg">
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                select(s);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                i === highlight ? "bg-surface-elevated text-foreground" : "text-muted-foreground"
              }`}
            >
              {s.name}
              {value?.id === s.id && <Sparkles className="h-3 w-3 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick match card
// ---------------------------------------------------------------------------

export function HeroQuickMatch() {
  const { data: catalog = [] } = useSkillsCatalog();
  const [offer, setOffer] = useState<SkillOption | null>(null);
  const [learn, setLearn] = useState<SkillOption | null>(null);
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const canSearch = (offer != null || learn != null) && !searching;

  const onSearch = async () => {
    if (!offer && !learn) return;
    setSearching(true);
    setSearched(true);
    setResults(null);
    try {
      setResults(await findMatches(offer, learn));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="card-border relative mt-12 rounded-2xl border bg-surface/80 p-5 backdrop-blur-sm sm:p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Quick match
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end">
        <SkillPicker
          label="I offer"
          placeholder="e.g. UI Design"
          value={offer}
          onChange={setOffer}
          catalog={catalog}
        />
        <ArrowRight className="hidden shrink-0 pb-3 text-muted-foreground/60 md:block" />
        <SkillPicker
          label="I want to learn"
          placeholder="e.g. Photography"
          value={learn}
          onChange={setLearn}
          catalog={catalog}
        />
        <button
          type="button"
          onClick={onSearch}
          disabled={!canSearch}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-background transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {searching ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-background/40 border-t-background" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          {searching ? "Matching…" : "Find my match"}
        </button>
      </div>

      {searched &&
        !searching &&
        results !== null &&
        (results.length > 0 ? (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          >
            {results.map((r) => {
              const name = r.display_name || r.handle || "Member";
              const initial = name.charAt(0).toUpperCase();
              return (
                <Link
                  key={r.profile_id}
                  to="/u/$handle"
                  params={{ handle: r.handle ?? "" }}
                  className="card-border group rounded-xl border bg-surface p-3.5 transition hover:border-[var(--user-accent-border,var(--border-strong))]"
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-9 w-9">
                      {r.avatar_url ? <AvatarImage src={r.avatar_url} alt="" /> : null}
                      <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium group-hover:text-primary">
                        {name}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {r.creator_title || "Member"}
                      </p>
                    </div>
                    <span className="ml-auto shrink-0">
                      <AvailabilityBadge status={r.availability} size="xs" />
                    </span>
                  </div>
                  {r.matchReasons.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {r.matchReasons.slice(0, 2).map((reason) => (
                        <span
                          key={reason}
                          className="inline-flex items-center gap-1 rounded-full border border-brand-green/30 bg-brand-green/5 px-2 py-0.5 text-[11px] text-brand-green"
                        >
                          <Zap className="h-2.5 w-2.5" />
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              );
            })}
          </motion.div>
        ) : (
          <div className="mt-5 rounded-xl border border-border/60 bg-surface-elevated/40 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              No one on Tethyr matches this yet — be the first to offer or learn it.
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {offer && (
                <Link
                  to="/skills/$slug"
                  params={{ slug: offer.slug }}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface px-3 py-1 text-xs text-foreground transition hover:border-[var(--user-accent-border,var(--border-strong))]"
                >
                  Everyone offering {offer.name} <ArrowRight className="h-3 w-3" />
                </Link>
              )}
              {learn && (
                <Link
                  to="/skills/$slug"
                  params={{ slug: learn.slug }}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface px-3 py-1 text-xs text-foreground transition hover:border-[var(--user-accent-border,var(--border-strong))]"
                >
                  Everyone learning {learn.name} <ArrowRight className="h-3 w-3" />
                </Link>
              )}
              <Link
                to="/signup"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary"
              >
                Add your skills <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        ))}
    </div>
  );
}
