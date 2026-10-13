import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUser, useSkillsCatalog } from "@/hooks/use-current-user";
import { StudioView } from "@/components/tethyr/studio/studio-view";
import { useUserPalette } from "@/lib/dominant-color";
import { appearanceStyle, type ProfileBackground } from "@/lib/background-themes";
import { BackgroundLayer } from "@/components/tethyr/background-layer";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ProfileSetupForm } from "./-profile-setup-form";

// Code-split module: the interactive page for its route. See the route
// file for the eager surface (loader/head) and the lazyRouteComponent wire-up.
export function ProfilePage() {
  const profileQuery = useCurrentUser();
  const skillsQuery = useSkillsCatalog();
  // Resolved once at the route level so the setup form's backdrop can follow
  // the banner colour (see `colorSource: "banner"`).
  const setupPalette = useUserPalette(profileQuery.data?.bannerSigned ?? null);
  const refresh = profileQuery.refresh;

  const navigate = useNavigate();
  const { github: githubParam, details: detailsParam } = useSearch({ strict: false }) as {
    github?: string;
    details?: string;
  };
  const focusGithubToken = githubParam === "token";
  const githubScrolledRef = useRef(false);
  // While in the Studio, users can jump into the setup form anytime to finish
  // their profile — entering the Studio should not require it first.
  const [showSetup, setShowSetup] = useState(false);

  // ?details=open (dashboard "Round out your profile" steps) opens the Edit
  // details form straight away, then drops the param so a reload doesn't.
  useEffect(() => {
    if (detailsParam !== "open") return;
    setShowSetup(true);
    void navigate({ to: "/profile", search: {}, replace: true });
  }, [detailsParam, navigate]);

  // Old links to the token form (?github=token) now land in Settings → GitHub.
  useEffect(() => {
    if (!focusGithubToken || githubScrolledRef.current) return;
    githubScrolledRef.current = true;
    void navigate({ to: "/settings", hash: "github", replace: true });
  }, [focusGithubToken, navigate]);

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

  const { profile, userId, teachIds, teachMeta, learnIds, avatarSigned, bannerSigned, background } =
    profileQuery.data;

  const setupBackground = profile?.background as ProfileBackground | null;

  const setupForm = () => (
    <ProfileSetupForm
      profile={profile}
      userId={userId}
      onSaved={() => {
        setShowSetup(false);
        refresh();
      }}
      refresh={refresh}
      avatarSigned={avatarSigned}
      bannerSigned={bannerSigned}
      background={background}
      publicBackground={profile?.public_background ?? null}
      teachIds={teachIds ?? []}
      teachMeta={teachMeta ?? {}}
      learnIds={learnIds ?? []}
      allSkills={skillsQuery.data ?? []}
    />
  );

  // The Studio is the primary profile surface, including for incomplete
  // accounts. Identity completion stays available as an "Edit details" dialog
  // over the Studio instead of replacing it with the legacy setup form.
  return (
    <>
      <StudioView userId={userId} profile={profile} onCompleteProfile={() => setShowSetup(true)} />
      <Dialog open={showSetup} onOpenChange={setShowSetup}>
        <DialogContent className="max-h-[90vh] max-w-4xl gap-0 overflow-y-auto p-0 md:max-w-5xl">
          <DialogTitle className="sr-only">Edit details</DialogTitle>
          <div className="relative isolate" style={{ ...appearanceStyle(setupBackground) }}>
            <BackgroundLayer
              background={setupBackground}
              imageUrl={profileQuery.data.backgroundImageUrl}
              bannerColor={setupPalette?.dominant ?? null}
            />
            {setupForm()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
