import { useEffect, useState } from "react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SectionCard } from "./section-card";
import type { Profile } from "@/hooks/use-current-user";

export function TextCard({
  title,
  field,
  value,
  placeholder,
  onChange,
  userId,
}: {
  title: string;
  field: "teaching_style" | "learning_goals";
  value: string;
  placeholder: string;
  onChange: () => void;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setText(value);
  }, [open, value]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: text || null } as Partial<
        Pick<Profile, "teaching_style" | "learning_goals">
      >)
      .eq("id", userId);
    setSaving(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Saved");
    onChange();
    setOpen(false);
  }

  return (
    <SectionCard title={title} onEdit={() => setOpen(true)}>
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{value || placeholder}</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {title.toLowerCase()}</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
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
