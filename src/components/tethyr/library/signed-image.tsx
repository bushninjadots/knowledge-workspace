import { useEffect, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "library-files";
const SIGN_TTL = 60 * 60 * 24; // 24h — re-signed on every editor mount

/**
 * Node view that resolves a stored storage path into a fresh signed URL.
 * The note content stores the path (never a signed URL), so images don't expire.
 */
function SignedImageView({
  node,
}: {
  node: { attrs: { src?: string | null; alt?: string | null } };
}) {
  const src = node.attrs.src;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setUrl(null);
      return;
    }
    let active = true;
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(src, SIGN_TTL)
      .then(({ data, error }) => {
        if (active) setUrl(error ? null : (data?.signedUrl ?? null));
      })
      .catch(() => {
        if (active) setUrl(null);
      });
    return () => {
      active = false;
    };
  }, [src]);

  if (!src) return null;
  if (!url) {
    return (
      <span
        contentEditable={false}
        className="my-2 block h-40 w-full animate-pulse rounded-xl border border-border/60 bg-surface"
      />
    );
  }
  return (
    <img
      src={url}
      alt={node.attrs.alt ?? ""}
      contentEditable={false}
      draggable
      data-drag-handle
      className="my-2 max-w-full rounded-xl"
    />
  );
}

/**
 * A block-level image node whose `src` is a `library-files` storage path.
 * Serializes back to `<img src="<path>">` so saving stores the path; parsing
 * only claims `library-images` paths so external `<img>` URLs still use the
 * standard Image extension.
 */
export const SignedImage = Node.create({
  name: "signedImage",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "img[src*='library-images']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SignedImageView);
  },
});
