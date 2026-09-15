import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type LightboxImage = {
  src: string;
  alt?: string;
  caption?: string | null;
};

/**
 * Fullscreen image lightbox: portal-rendered, arrow-key/prev-next navigation
 * with wrap-around, Escape to close, click-outside-to-close. Body scroll is
 * locked while open. Only shown for images — video evidence keeps its native
 * player (the gallery renders it inline already).
 */
export function MediaLightbox({
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: LightboxImage[];
  /** Open when >= 0; render nothing otherwise. */
  index: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
}) {
  const isOpen = index >= 0 && index < images.length;

  const goPrev = useCallback(() => {
    if (images.length === 0) return;
    onNavigate((index - 1 + images.length) % images.length);
  }, [images.length, index, onNavigate]);

  const goNext = useCallback(() => {
    if (images.length === 0) return;
    onNavigate((index + 1) % images.length);
  }, [images.length, index, onNavigate]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose, goPrev, goNext]);

  if (!isOpen) return null;
  const image = images[index];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.alt || "Image viewer"}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 sm:p-10"
      onClick={onClose}
    >
      {/* Counter + close */}
      <div className="absolute top-4 right-4 flex items-center gap-3 text-white/70">
        <span className="text-xs tabular-nums">
          {index + 1} / {images.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close viewer"
          className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Prev / Next — hidden when a single image */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            aria-label="Previous image"
            className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:left-6"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            aria-label="Next image"
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:right-6"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </>
      )}

      {/* The image itself */}
      <img
        key={image.src}
        src={image.src}
        alt={image.alt || ""}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "max-h-full max-w-full rounded-lg object-contain shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-150",
        )}
      />

      {/* Caption */}
      {image.caption && (
        <p className="absolute bottom-4 left-1/2 max-w-[90vw] -translate-x-1/2 truncate text-center text-sm text-white/80">
          {image.caption}
        </p>
      )}
    </div>,
    document.body,
  );
}
