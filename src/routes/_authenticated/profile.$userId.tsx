import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { usePublicProfile } from "@/hooks/use-public-profile";
import { useSkillsCatalog, useCurrentUser } from "@/hooks/use-current-user";
import { ProfileLayout } from "@/components/tethyr/profile/profile-layout";
import { ProfileOverviewTab } from "@/components/tethyr/profile/profile-overview-tab";
import { ProfileSkillsTab } from "@/components/tethyr/profile/profile-skills-tab";
import { ProfileProjectsTab } from "@/components/tethyr/profile/profile-projects-tab";
import { ProfileActivityTab } from "@/components/tethyr/profile/profile-activity-tab";
import { ProfileSessionsTab } from "@/components/tethyr/profile/profile-sessions-tab";
import { ProfileCommunitiesTab } from "@/components/tethyr/profile/profile-communities-tab";
import { ProfileReviewsTab } from "@/components/tethyr/profile/profile-reviews-tab";

export const Route = createFileRoute("/_authenticated/profile/$userId")({
  head: () => ({
    meta: [
      { title: "Profile — Tethyr" },
      { name: "description", content: "View a creator's profile on Tethyr." },
    ],
  }),
  component: PublicProfilePage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Profile not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <a href="/explore" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to explore
        </a>
      </div>
    </div>
  ),
});

function PublicProfilePage() {
  const { userId } = Route.useParams();
  const currentUser = useCurrentUser();
  const profileQuery = usePublicProfile(userId);
  const skillsQuery = useSkillsCatalog();

  const isOwnProfile = currentUser.data?.userId === userId;

  if (profileQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl p-8 text-sm text-muted-foreground">Loading profile…</div>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">Profile not found</h2>
        <p className="text-sm text-muted-foreground">
          This creator profile doesn't exist or isn't visible.
        </p>
        <a href="/explore">
          <Button variant="outline">Back to explore</Button>
        </a>
      </div>
    );
  }

  if (isOwnProfile) {
    // Redirect to own profile — but since we can't do conditional routing easily,
    // just render with isOwnProfile=true using current user data
    const ownData = currentUser.data;
    if (!ownData) return null;
    return (
      <ProfileLayout
        profile={ownData.profile}
        avatarSigned={ownData.avatarSigned}
        bannerSigned={ownData.bannerSigned}
        userId={ownData.userId}
        isOwnProfile={true}
        teachIds={ownData.teachIds}
        teachMeta={ownData.teachMeta}
        learnIds={ownData.learnIds}
        projects={ownData.projects}
        coverUrls={ownData.coverUrls}
        projectSkillIds={ownData.projectSkillIds}
        activity={ownData.activity}
        skills={skillsQuery.data ?? []}
        onChange={() => currentUser.refresh()}
        tabContent={{
          overview: (
            <ProfileOverviewTab
              profile={ownData.profile}
              userId={ownData.userId}
              teachIds={ownData.teachIds}
              teachMeta={ownData.teachMeta}
              learnIds={ownData.learnIds}
              projects={ownData.projects}
              coverUrls={ownData.coverUrls}
              projectSkillIds={ownData.projectSkillIds}
              activity={ownData.activity}
              skills={skillsQuery.data ?? []}
              onChange={() => currentUser.refresh()}
              isOwnProfile={true}
            />
          ),
          skills: (
            <ProfileSkillsTab
              profile={ownData.profile}
              teachIds={ownData.teachIds}
              teachMeta={ownData.teachMeta}
              learnIds={ownData.learnIds}
              skills={skillsQuery.data ?? []}
              isOwnProfile={true}
              userId={ownData.userId}
            />
          ),
          projects: (
            <ProfileProjectsTab
              projects={ownData.projects}
              coverUrls={ownData.coverUrls}
              userId={ownData.userId}
              skills={skillsQuery.data ?? []}
              projectSkillIds={ownData.projectSkillIds}
              onChange={() => currentUser.refresh()}
              isOwnProfile={true}
            />
          ),
          communities: <ProfileCommunitiesTab />,
          activity: <ProfileActivityTab userId={ownData.userId} activity={ownData.activity} />,
          sessions: <ProfileSessionsTab userId={ownData.userId} isOwnProfile={true} />,
          reviews: <ProfileReviewsTab isOwnProfile={true} />,
        }}
      />
    );
  }

  const {
    profile,
    avatarSigned,
    bannerSigned,
    teachIds,
    teachMeta,
    learnIds,
    projects,
    coverUrls,
    projectSkillIds,
    activity,
  } = profileQuery.data;
  const skills = skillsQuery.data ?? [];

  return (
    <ProfileLayout
      profile={profile}
      avatarSigned={avatarSigned}
      bannerSigned={bannerSigned}
      userId={userId}
      isOwnProfile={false}
      teachIds={teachIds}
      teachMeta={teachMeta}
      learnIds={learnIds}
      projects={projects}
      coverUrls={coverUrls}
      projectSkillIds={projectSkillIds}
      activity={activity}
      skills={skills}
      onChange={() => {}}
      tabContent={{
        overview: (
          <ProfileOverviewTab
            profile={profile}
            userId={userId}
            teachIds={teachIds}
            teachMeta={teachMeta}
            learnIds={learnIds}
            projects={projects}
            coverUrls={coverUrls}
            projectSkillIds={projectSkillIds}
            activity={activity}
            skills={skills}
            onChange={() => {}}
            isOwnProfile={false}
          />
        ),
        skills: (
          <ProfileSkillsTab
            profile={profile}
            teachIds={teachIds}
            teachMeta={teachMeta}
            learnIds={learnIds}
            skills={skills}
            isOwnProfile={false}
            userId={userId}
          />
        ),
        projects: (
          <ProfileProjectsTab
            projects={projects}
            coverUrls={coverUrls}
            userId={userId}
            skills={skills}
            projectSkillIds={projectSkillIds}
            onChange={() => {}}
            isOwnProfile={false}
          />
        ),
        communities: <ProfileCommunitiesTab />,
        activity: <ProfileActivityTab userId={userId} activity={activity} />,
        sessions: <ProfileSessionsTab userId={userId} isOwnProfile={false} />,
        reviews: <ProfileReviewsTab isOwnProfile={false} />,
      }}
    />
  );
}
