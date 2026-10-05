import { Children, cloneElement, isValidElement, useId, type ReactElement } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
    <div className="content-safe min-w-0 max-w-full rounded-xl bg-surface-elevated/30 p-3 sm:p-4">
      <div className="mb-4 flex min-w-0 items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          {action}
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-md"
              onClick={onEdit}
              aria-label={`Edit ${typeof title === "string" ? title : "section"}`}
              title={`Edit ${typeof title === "string" ? title : "section"}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

const CONTROL_TYPES = new Set<unknown>([Input, Textarea, "input", "textarea", "select"]);
const LABEL_CLASS = "text-xs uppercase tracking-wider text-muted-foreground";

/**
 * A labelled form field. A single input child is tied to the label by id, so
 * screen readers announce its name rather than its placeholder; anything
 * else (a chip picker, a row of controls) becomes a group named by the label.
 */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const generatedId = useId();
  const only = Children.count(children) === 1 && isValidElement(children) ? children : null;
  const isControl = !!only && CONTROL_TYPES.has(only.type);
  if (only && isControl) {
    const control = only as ReactElement<{ id?: string }>;
    const id = control.props.id ?? generatedId;
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id} className={LABEL_CLASS}>
          {label}
        </Label>
        {control.props.id ? control : cloneElement(control, { id })}
      </div>
    );
  }
  const labelId = `${generatedId}-label`;
  return (
    <div className="space-y-1.5" role="group" aria-labelledby={labelId}>
      <Label id={labelId} className={LABEL_CLASS}>
        {label}
      </Label>
      {children}
    </div>
  );
}
