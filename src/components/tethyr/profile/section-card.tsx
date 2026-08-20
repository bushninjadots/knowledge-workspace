import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function SectionCard({
  title,
  onEdit,
  children,
  action,
}: {
  title: React.ReactNode;
  onEdit?: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="content-safe min-w-0 max-w-full overflow-hidden rounded-xl bg-surface-elevated/30 p-3 sm:p-4">
      <div className="mb-4 flex min-w-0 items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          {action}
          {onEdit && (
            <Button variant="ghost" size="icon" className="rounded-full" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
