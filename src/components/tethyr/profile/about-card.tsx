import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Languages, X } from "lucide-react";
import { friendlyError } from "@/lib/error-message";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SectionCard, Field } from "./section-card";
import type { Profile } from "@/hooks/use-current-user";

export function AboutCard({
  profile,
  onChange,
}: {
  profile: Profile | null;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [langInput, setLangInput] = useState("");
  const [languages, setLanguages] = useState<string[]>(profile?.languages ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setBio(profile?.bio ?? "");
      setLanguages(profile?.languages ?? []);
    }
  }, [editing, profile]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ bio: bio || null, languages })
      .eq("id", profile!.id);
    setSaving(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Saved");
    onChange();
    setEditing(false);
  }

  return (
    <SectionCard title="About" onEdit={() => setEditing(true)}>
      <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
        {profile?.bio || "Tell other people who you are and what you make."}
      </p>
      {profile && profile.languages.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <Languages className="h-3.5 w-3.5 text-muted-foreground" />
          {profile.languages.map((l) => (
            <Chip key={l}>{l}</Chip>
          ))}
        </div>
      )}

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit about</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Bio">
              <Textarea
                rows={5}
                value={bio}
                maxLength={1000}
                onChange={(e) => setBio(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">{bio.length}/1000</p>
            </Field>
            <Field label="Languages">
              <div className="flex flex-wrap gap-2">
                {languages.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLanguages(languages.filter((x) => x !== l))}
                    className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary"
                  >
                    {l}
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={langInput}
                  onChange={(e) => setLangInput(e.target.value)}
                  placeholder="English"
                  maxLength={30}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const v = langInput.trim();
                      if (v && !languages.includes(v) && languages.length < 10)
                        setLanguages([...languages, v]);
                      setLangInput("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const v = langInput.trim();
                    if (v && !languages.includes(v) && languages.length < 10)
                      setLanguages([...languages, v]);
                    setLangInput("");
                  }}
                >
                  Add
                </Button>
              </div>
              {languages.length >= 10 && (
                <p className="mt-1 text-xs text-muted-foreground">Maximum 10 languages</p>
              )}
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button onClick={save} busy={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1">
      {children}
    </span>
  );
}
