import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Globe,
  Youtube,
  Instagram,
  Twitter,
  Twitch,
  Github,
  Link as LinkIcon,
  X,
  Plus,
  Sparkles,
} from "lucide-react";
import { friendlyError } from "@/lib/error-message";
import { supabase } from "@/integrations/supabase/client";
import { isSafeUrl, safeHref } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SectionCard } from "./section-card";
import type { Profile } from "@/hooks/use-current-user";

const SOCIAL_KEYS: { key: string; label: string; icon: typeof Youtube; placeholder: string }[] = [
  { key: "website", label: "Website", icon: Globe, placeholder: "https://yoursite.com" },
  { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@you" },
  {
    key: "instagram",
    label: "Instagram",
    icon: Instagram,
    placeholder: "https://instagram.com/you",
  },
  { key: "x", label: "X", icon: Twitter, placeholder: "https://x.com/you" },
  { key: "tiktok", label: "TikTok", icon: Sparkles, placeholder: "https://tiktok.com/@you" },
  { key: "twitch", label: "Twitch", icon: Twitch, placeholder: "https://twitch.tv/you" },
  { key: "github", label: "GitHub", icon: Github, placeholder: "https://github.com/you" },
];

export function LinksCard({
  profile,
  onChange,
}: {
  profile: Profile | null;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [social, setSocial] = useState<Record<string, string>>(profile?.social_links ?? {});
  const [portfolio, setPortfolio] = useState<{ label: string; url: string }[]>(
    profile?.portfolio_links ?? [],
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSocial(profile?.social_links ?? {});
      setPortfolio(profile?.portfolio_links ?? []);
    }
  }, [open, profile]);

  async function save() {
    setSaving(true);
    const cleanedSocial: Record<string, string> = {};
    for (const [k, v] of Object.entries(social)) {
      const val = v?.trim();
      if (!val) continue;
      if (!isSafeUrl(val)) {
        setSaving(false);
        return toast.error(`${k} must be a valid http(s) URL`);
      }
      cleanedSocial[k] = val;
    }
    const cleanedPortfolio: { label: string; url: string }[] = [];
    for (const p of portfolio) {
      const url = p.url.trim();
      if (!url) continue;
      if (!isSafeUrl(url)) {
        setSaving(false);
        return toast.error(`Portfolio link "${p.label || url}" must be a valid http(s) URL`);
      }
      cleanedPortfolio.push({ label: p.label, url });
    }
    const { error } = await supabase
      .from("profiles")
      .update({ social_links: cleanedSocial, portfolio_links: cleanedPortfolio })
      .eq("id", profile!.id);
    setSaving(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Saved");
    onChange();
    setOpen(false);
  }

  const hasAny =
    (profile?.portfolio_links?.length ?? 0) > 0 ||
    Object.keys(profile?.social_links ?? {}).length > 0;

  return (
    <SectionCard title="Links" onEdit={() => setOpen(true)}>
      {!hasAny ? (
        <p className="text-sm text-muted-foreground">Add your portfolio and socials.</p>
      ) : (
        <div className="space-y-3">
          {profile?.portfolio_links?.map((p, i) => (
            <a
              key={i}
              href={safeHref(p.url)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-foreground hover:text-primary"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              {p.label || p.url}
            </a>
          ))}
          <div className="flex flex-wrap gap-2 pt-2">
            {SOCIAL_KEYS.map(({ key, icon: Icon, label }) =>
              profile?.social_links?.[key] ? (
                <a
                  key={key}
                  href={safeHref(profile.social_links[key])}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </a>
              ) : null,
            )}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit links</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Portfolio</p>
              {portfolio.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Label"
                    value={p.label}
                    onChange={(e) => {
                      const next = [...portfolio];
                      next[i] = { ...next[i], label: e.target.value };
                      setPortfolio(next);
                    }}
                    className="w-32"
                  />
                  <Input
                    placeholder="https://…"
                    value={p.url}
                    onChange={(e) => {
                      const next = [...portfolio];
                      next[i] = { ...next[i], url: e.target.value };
                      setPortfolio(next);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setPortfolio(portfolio.filter((_, j) => j !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPortfolio([...portfolio, { label: "", url: "" }])}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add link
              </Button>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Socials</p>
              {SOCIAL_KEYS.map(({ key, label, icon: Icon, placeholder }) => (
                <div key={key} className="flex items-center gap-2">
                  <div className="flex w-28 items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                  <Input
                    placeholder={placeholder}
                    value={social[key] ?? ""}
                    onChange={(e) => setSocial({ ...social, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
