import { useEffect, useState } from "react";

// Samples an image and returns its average color as an `rgb(...)` string.
// Used to make UI accents (like the banner border) sync with whatever photo
// the user uploads. Runs entirely client-side via a hidden canvas.
//
// Note: this relies on the image being served with permissive CORS headers
// (Supabase Storage signed URLs are). If the canvas gets tainted for any
// reason, we fail silently and return null — callers should treat that as
// "no accent color" rather than throw.
export async function getDominantColor(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);

        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;

        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha < 200) continue; // skip mostly-transparent pixels
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }

        if (count === 0) return resolve(null);

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        resolve(`rgb(${r}, ${g}, ${b})`);
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// React hook wrapper — re-samples whenever the image URL changes, and
// resets to null (no accent) when there's no image.
export function useDominantColor(url: string | null): string | null {
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!url) {
      setColor(null);
      return;
    }
    getDominantColor(url).then((c) => {
      if (!cancelled) setColor(c);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return color;
}
