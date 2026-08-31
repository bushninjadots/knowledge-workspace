import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyLinkIconButton() {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      onClick={copy}
      aria-label="Copy link"
      title="Copy link"
    >
      <Link2 className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
