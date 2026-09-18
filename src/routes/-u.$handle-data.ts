// Shared data plane for the /u/$handle route: the eager loader and the
// lazy page component both need this, so it lives outside both chunks.
import { notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { backgroundImageSignedUrl, type ProfileBackground } from "@/lib/background-themes";

export type PublicProfile = {
  id: string;
  handle: string | null;
  display_name: string | null;
  banner_url: string | null;
  avatar_url: string | null;
  creator_title: string | null;
  category: string | null;
  country: string | null;
  timezone: string | null;
  bio: string | null;
  languages: string[] | null;
  social_links: Record<string, string> | null;
  portfolio_links: { label: string; url: string }[] | null;
  background: ProfileBackground | null;
  public_background: ProfileBackground | null;
};

export async function fetchPublicProfile(handle: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, handle, display_name, banner_url, avatar_url, creator_title, category, country, timezone, bio, languages, social_links, portfolio_links, background, public_background",
    )
    .eq("handle", handle)
    .maybeSingle();
  if (error) throw error;
  if (!profile) throw notFound();

  const publicBg = (profile.public_background ?? profile.background) as ProfileBackground | null;
  const [backgroundImageUrl, banner, avatar] = await Promise.all([
    backgroundImageSignedUrl(publicBg?.mode === "image" ? publicBg.image_url : null),
    profile.banner_url
      ? supabase.storage.from("banners").createSignedUrl(profile.banner_url, 60 * 60 * 24)
      : Promise.resolve({ data: null }),
    profile.avatar_url
      ? supabase.storage.from("avatars").createSignedUrl(profile.avatar_url, 60 * 60 * 24)
      : Promise.resolve({ data: null }),
  ]);
  return {
    profile: profile as PublicProfile,
    publicBackground: publicBg ?? null,
    backgroundImageUrl,
    // Needed when the backdrop tint follows the banner (`colorSource: "banner"`).
    bannerSigned: banner.data?.signedUrl ?? null,
    avatarSigned: avatar.data?.signedUrl ?? null,
  };
}
