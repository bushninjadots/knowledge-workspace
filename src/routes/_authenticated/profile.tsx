import { useEffect, useRef, useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { Wrench, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser, useSkillsCatalog } from "@/hooks/use-current-user";
import { ProfileLayout } from "@/components/tethyr/profile/profile-layout";
import { PageShell } from "@/components/tethyr/page/page-shell";
import { EditModeProvider } from "@/components/tethyr/page/edit-mode-context";
import "@/components/tethyr/blocks/register-all";
import { ProfileProjectsTab } from "@/components/tethyr/profile/profile-projects-tab";
import { ProfileActivityTab } from "@/components/tethyr/profile/profile-activity-tab";
import { ProfileSessionsTab } from "@/components/tethyr/profile/profile-sessions-tab";
import { ProfileCommunitiesTab } from "@/components/tethyr/profile/profile-communities-tab";
import { GitHubConnect } from "@/components/tethyr/profile/github-connect";
import { AboutCard } from "@/components/tethyr/profile/about-card";
import { TextCard } from "@/components/tethyr/profile/text-card";
import { LinksCard } from "@/components/tethyr/profile/links-card";
import { SkillEditingSection } from "@/components/tethyr/profile/skill-editing";
import { ChipListCard } from "@/components/tethyr/profile-sections";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your Studio — Tethyr" },
      {
        name: "description",
        content: "Manage your skills, projects, and collaborative presence on Tethyr.",
      },
    ],
  }),
  component: ProfilePage,
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Studio failed to load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong while loading your studio. Please try again.
        </p>
        <a href="/profile" className="mt-4 inline-block text-sm text-primary hover:underline">
          Try again
        </a>
      </div>
    </div>
  ),
});

function ProfilePage() {
  const profileQuery = useCurrentUser();
  const skillsQuery = useSkillsCatalog();
  const refresh = profileQuery.refresh;

  // Deep link from project repo sections: /profile?github=token scrolls to the
  // GitHub card with the token editor already open.
  const {
    github: githubParam,
    preview: previewParam,
    from: previewFrom,
  } = useSearch({ strict: false }) as {
    github?: string;
    preview?: string;
    from?: string;
  };
  const previewMode = previewParam === "private" || previewParam === "public" ? previewParam : null;
  const [studioPreview, setStudioPreview] = useState<{
    layout: import("@/lib/page-blocks").PageLayout;
    theme: import("@/lib/page-blocks").ThemeTokens | null;
  } | null>(null);

  useEffect(() => {
    if (!previewMode) return;
    try {
      const raw = sessionStorage.getItem(
        `tethyr:studio-preview:profile:${profileQuery.data?.userId ?? ""}`,
      );
      if (raw) setStudioPreview(JSON.parse(raw));
    } catch {
      setStudioPreview(null);
    }
  }, [previewMode, profileQuery.data?.userId]);
  const focusGithubToken = githubParam === "token";
  const githubScrolledRef = useRef(false);

  // Scroll once the card is actually mounted (waits for the profile query to
  // resolve instead of racing a fixed timeout).
  useEffect(() => {
    if (!focusGithubToken || !profileQuery.data || githubScrolledRef.current) return;
    githubScrolledRef.current = true;
    const t = setTimeout(() => {
      document
        .getElementById("github-integration")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    return () => clearTimeout(t);
  }, [focusGithubToken, profileQuery.data]);

  if (profileQuery.isError) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">Couldn't load your studio</h2>
        <p className="text-sm text-muted-foreground">
          {profileQuery.error?.message ?? "Something went wrong. Please try again."}
        </p>
        <Button variant="outline" onClick={() => refresh()}>
          Try again
        </Button>
      </div>
    );
  }

  if (profileQuery.isLoading || !profileQuery.data) {
    return (
      <div className="mx-auto max-w-7xl p-8 text-sm text-muted-foreground">
        Setting up your studio…
      </div>
    );
  }

  const {
    profile,
    teachIds,
    teachMeta,
    learnIds,
    avatarSigned,
    bannerSigned,
    background,
    userId,
    projects,
    coverUrls,
    projectSkillIds,
    activity,
  } = profileQuery.data;
  const skills = skillsQuery.data ?? [];

  if (previewMode) {
    return (
      <div className="min-h-screen bg-background">
        {/* PageShell renders the canonical preview banner (label + Back to
            Studio); a route-level duplicate would double up the chrome. */}
        <EditModeProvider>
          <PageShell
            ownerId={userId}
            ownerType="profile"
            isOwner
            previewDraft
            previewMode={previewMode}
            previewLayout={studioPreview?.layout}
            previewTheme={studioPreview?.theme ?? undefined}
            previewData={{ profile }}
            onBackToStudio={() =>
              previewFrom === "studio" ? window.history.back() : (window.location.href = "/studio")
            }
          />
        </EditModeProvider>
      </div>
    );
  }

  return (
    <ProfileLayout
      profile={profile}
      avatarSigned={avatarSigned}
      bannerSigned={bannerSigned}
      background={background}
      publicBackground={profile?.public_background ?? null}
      userId={userId}
      isOwnProfile={true}
      teachIds={teachIds}
      teachMeta={teachMeta}
      learnIds={learnIds}
      projects={projects}
      coverUrls={coverUrls}
      projectSkillIds={projectSkillIds}
      skills={skills}
      onChange={refresh}
      tabContent={{
        overview: (
          <div className="space-y-6">
            <AboutCard profile={profile} onChange={refresh} />
            <TextCard
              title="Sharing style"
              field="teaching_style"
              value={profile?.teaching_style ?? ""}
              placeholder="How do you share? Hands-on, project-based, async reviews…"
              onChange={refresh}
              userId={userId}
            />
            <TextCard
              title="Growth goals"
              field="learning_goals"
              value={profile?.learning_goals ?? ""}
              placeholder="What do you want to unlock in the next 6 months?"
              onChange={refresh}
              userId={userId}
            />
            <div className="grid gap-6 md:grid-cols-2">
              <ChipListCard
                title="Favourite tools"
                icon={<Wrench className="h-4 w-4" />}
                field="favourite_tools"
                values={profile?.favourite_tools ?? []}
                userId={userId}
                accent="green"
                placeholder="Figma, Notion, Runway…"
                onChange={refresh}
              />
              <ChipListCard
                title="Software stack"
                icon={<Layers className="h-4 w-4" />}
                field="software_stack"
                values={profile?.software_stack ?? []}
                userId={userId}
                accent="purple"
                placeholder="Photoshop, Blender, Ableton…"
                onChange={refresh}
              />
            </div>
            <LinksCard profile={profile} onChange={refresh} />
            <GitHubConnect autoOpenToken={focusGithubToken} />
          </div>
        ),
        skills: (
          <div className="space-y-6">
            <SkillEditingSection
              teachIds={teachIds}
              teachMeta={teachMeta}
              learnIds={learnIds}
              allSkills={skills}
              userId={userId}
              onChange={refresh}
            />
          </div>
        ),
        projects: (
          <ProfileProjectsTab
            projects={projects}
            coverUrls={coverUrls}
            userId={userId}
            skills={skills}
            projectSkillIds={projectSkillIds}
            onChange={refresh}
          />
        ),
        communities: (
          <div className="space-y-6">
            <ProfileCommunitiesTab />
          </div>
        ),
        activity: (
          <div className="space-y-6">
            <ProfileActivityTab userId={userId} activity={activity} />
            <ProfileSessionsTab userId={userId} isOwnProfile={true} />
          </div>
        ),
      }}
    />
  );
}
