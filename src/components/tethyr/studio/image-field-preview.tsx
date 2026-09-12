import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\/\S+$/.test(value.trim());
}

/**
 * Preview an image field that may store either a full HTTP URL (custom link
 * or legacy public URL) or a storage path. When the value is a path, a signed
 * URL is generated on the fly — the bucket is private, so getPublicUrl would
 * return a URL that 403s.
 */
export function ImageFieldPreview({
  bucket,
  value,
  onClear,
}: {
  bucket: string;
  value: string;
  onClear: () => void;
}) {
  const isHttp = looksLikeUrl(value);
  const { data: signedUrl } = useSignedStorageUrl(
    bucket,
    isHttp ? null : value,
  );
  const src = isHttp ? value : signedUrl;

  if (!src) return null;

  return (
    <div className="relative overflow-hidden rounded-lg border border-border/50">
      <img src={src} alt="" className="h-20 w-full object-cover" />
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1 h-6 w-6 rounded-md bg-surface/80"
        aria-label="Clear image"
        onClick={onClear}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
