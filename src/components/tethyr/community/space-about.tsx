// "About this space": the right-hand column while a space is open — the
// owner's long About (markdown), links, who runs it and the rules. Makes a
// space read as its own forum rather than a filtered feed.
import { memo, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Crown, ExternalLink, Info, Link2, ScrollText, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MemberAvatar } from "@/components/tethyr/member-avatar";
import { useSpaceMembers, type CommunitySpace } from "@/hooks/use-community-spaces";
import { blockMarkdownToHtml } from "@/lib/block-markdown";
import { useSpaceAccent } from "@/components/tethyr/community/space-media";
import { safeHref } from "@/lib/validators";

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="community-card p-4">
      <h2 className="section-label mb-3 flex items-center gap-1.5">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

export const SpaceAbout = memo(function SpaceAbout({
  space,
  mobile = false,
}: {
  space: CommunitySpace;
  mobile?: boolean;
}) {
  const accent = useSpaceAccent(space);
  const aboutHtml = useMemo(
    () => (space.about?.trim() ? blockMarkdownToHtml(space.about) : null),
    [space.about],
  );
  // Members can read the member list (RLS); visitors see who started it.
  const { data: members = [] } = useSpaceMembers(space.is_member ? space.id : "");
  const team = members.filter((m) => m.role === "owner" || m.role === "moderator");
  const { data: founder } = useQuery({
    queryKey: ["space-founder", space.created_by],
    enabled: !space.is_member && !!space.created_by,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, handle, avatar_url")
        .eq("id", space.created_by)
        .maybeSingle();
      return data;
    },
  });

  return (
    <aside
      aria-label={`About ${space.name}`}
      className={
        mobile
          ? "flex flex-col gap-3"
          : "sticky top-16 hidden max-h-[calc(100vh-5rem)] flex-col gap-3 self-start overflow-y-auto pb-4 xl:flex"
      }
    >
      <Card
        title="About"
        icon={
          <Info
            className="h-3.5 w-3.5"
            style={{ color: `color-mix(in oklab, ${accent} 75%, var(--foreground))` }}
          />
        }
      >
        {aboutHtml ? (
          <div
            className="prose-custom text-sm [&_p]:mb-2"
            // blockMarkdownToHtml escapes HTML and allowlists URL schemes.
            dangerouslySetInnerHTML={{ __html: aboutHtml }}
          />
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {space.description || "No description yet."}
          </p>
        )}
      </Card>

      {(space.links?.length ?? 0) > 0 && (
        <Card title="Links" icon={<Link2 className="h-3.5 w-3.5 text-muted-foreground" />}>
          <ul className="space-y-1">
            {space.links!.map((link) => (
              <li key={`${link.label}-${link.url}`}>
                <a
                  href={safeHref(link.url)}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-surface-elevated"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{link.label}</span>
                  <ExternalLink
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground"
                    aria-hidden
                  />
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(team.length > 0 || founder) && (
        <Card
          title={team.length > 0 ? "Run by" : "Started by"}
          icon={<Crown className="h-3.5 w-3.5 text-muted-foreground" />}
        >
          <ul className="space-y-2">
            {(team.length > 0
              ? team.map((m) => ({
                  key: m.user_id,
                  role: m.role,
                  name: m.profile?.display_name || m.profile?.handle || "Member",
                  handle: m.profile?.handle ?? null,
                  avatar: m.profile?.avatar_url ?? null,
                }))
              : [
                  {
                    key: space.created_by,
                    role: "owner" as const,
                    name: founder?.display_name || founder?.handle || "Member",
                    handle: founder?.handle ?? null,
                    avatar: founder?.avatar_url ?? null,
                  },
                ]
            ).map((person) => (
              <li key={person.key} className="flex items-center gap-2.5">
                <MemberAvatar name={person.name} avatarPath={person.avatar} className="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  {person.handle ? (
                    <Link
                      to="/u/$handle"
                      params={{ handle: person.handle }}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {person.name}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-medium">{person.name}</p>
                  )}
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                  {person.role === "owner" ? (
                    <Crown className="h-3 w-3" aria-hidden />
                  ) : (
                    <Shield className="h-3 w-3" aria-hidden />
                  )}
                  {person.role === "owner" ? "Owner" : "Moderator"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(space.rules?.length ?? 0) > 0 && (
        <Card title="Rules" icon={<ScrollText className="h-3.5 w-3.5 text-muted-foreground" />}>
          <ol className="space-y-2">
            {space.rules.map((rule, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/85">
                <span
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                  style={{
                    background: `color-mix(in oklab, ${accent} 20%, transparent)`,
                    color: `color-mix(in oklab, ${accent} 75%, var(--foreground))`,
                  }}
                >
                  {i + 1}
                </span>
                {rule}
              </li>
            ))}
          </ol>
        </Card>
      )}
    </aside>
  );
});
