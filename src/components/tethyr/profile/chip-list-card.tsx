import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { supabase } from "@/integrations/supabase/client";
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

/* -------- Free-text chip list (tools / stack) -------- */
export function ChipListCard({
  title,
  icon,
  field,
  values,
  userId,
  accent,
  placeholder,
  onChange,
}: {
  title: string;
  icon: React.ReactNode;
  field: "favourite_tools" | "software_stack";
  values: string[];
  userId: string;
  accent: "green" | "purple";
  placeholder: string;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<string[]>(values);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setItems(values);
  }, [open, values]);

  const chipCls =
    accent === "green"
      ? "border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent,var(--primary))]"
      : "border-[var(--brand-purple)]/40 bg-[var(--brand-purple)]/10 text-[var(--brand-purple)]";

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: items } as never)
      .eq("id", userId);
    setSaving(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Saved");
    onChange();
    setOpen(false);
  }

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
      }
      onEdit={() => setOpen(true)}
    >
      {values.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add the tools you use most.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {values.map((v) => (
            <span key={v} className={`rounded-full border px-3 py-1 text-xs ${chipCls}`}>
              {v}
            </span>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {title.toLowerCase()}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {items.map((v) => (
                <button
                  key={v}
                  onClick={() => setItems(items.filter((x) => x !== v))}
                  className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${chipCls}`}
                >
                  {v}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={input}
                placeholder={placeholder}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = input.trim();
                    if (v && !items.includes(v)) setItems([...items, v]);
                    setInput("");
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const v = input.trim();
                  if (v && !items.includes(v)) setItems([...items, v]);
                  setInput("");
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
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
