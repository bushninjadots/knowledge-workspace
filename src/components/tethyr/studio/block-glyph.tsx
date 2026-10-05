// Block palette wireframe glyphs — static SVG sketches per block type.
//
// Split out of g-studio-surface.tsx; pure presentation with no editor state.

import type { BlockCategory } from "@/lib/page-blocks";

/** 36×24 wireframe sketch shown next to each block in the palette. Type-level
 *  sketches communicate what a block renders at a glance; unknown or new types
 *  fall back to a category sketch so the palette never looks broken. Rendered
 *  as one self-contained <svg> — the shapes are meaningless to the DOM without
 *  it (bare rects are dropped, which is exactly the "empty box" bug). */
export function BlockGlyph({ type, category }: { type: string; category: BlockCategory }) {
  return (
    <svg
      viewBox="0 0 36 24"
      width={36}
      height={24}
      aria-hidden
      className="shrink-0"
      role="presentation"
    >
      <BlockGlyphShapes type={type} category={category} />
    </svg>
  );
}

function BlockGlyphShapes({ type, category }: { type: string; category: BlockCategory }) {
  const stroke = "var(--border-strong)";
  const accent = "var(--user-accent,var(--primary))";
  const line = (y: number, x = 2, w = 32, h = 1.6) => (
    <rect x={x} y={y} width={w} height={h} rx={0.8} fill="var(--border)" />
  );
  const chip = (y: number, x: number, w = 12, h = 4) => (
    <rect x={x} y={y} width={w} height={h} rx={2} fill="var(--border-soft,var(--border))" />
  );
  const card = (x: number, y: number, w: number, h: number) => (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={1.5}
      fill="var(--surface-sunken)"
      stroke={stroke}
      strokeWidth={0.8}
    />
  );
  switch (type) {
    case "profile-header":
      return (
        <>
          <circle
            cx={8}
            cy={9}
            r={5}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.9}
          />
          <rect x={16} y={4} width={18} height={2.4} rx={1.2} fill={accent} />
          {line(9, 16, 14)}
          {line(12.5, 16, 18)}
          {line(16, 16, 12)}
        </>
      );
    case "profile-projects":
      return (
        <>
          {card(2, 3, 15, 18)}
          {line(5.5, 5, 9)}
          {line(9.5, 5, 9)}
          {line(15, 5, 9)}
          {card(19, 3, 15, 18)}
          {line(22.5, 22, 9)}
          {line(26.5, 22, 9)}
        </>
      );
    case "profile-skills":
      return (
        <>
          {chip(3, 2, 12, 5)}
          {line(4.5, 18, 16)}
          {chip(9.5, 2, 8, 5)}
          {line(11, 18, 16)}
          {chip(16, 2, 10, 5)}
          {line(17.5, 18, 16)}
        </>
      );
    case "profile-tools":
      return (
        <>
          {chip(3, 2, 14, 5)}
          {chip(10, 2, 10, 5)}
          {chip(3, 19, 12, 5)}
          {chip(10, 19, 12, 5)}
          {chip(17, 19, 8, 5)}
          {chip(20, 2, 6, 5)}
        </>
      );
    case "profile-gallery":
      return (
        <>
          {card(2, 2, 15, 9)}
          {card(19, 2, 15, 9)}
          {card(2, 13, 15, 9)}
          {card(19, 13, 15, 9)}
        </>
      );
    case "profile-experience":
      return (
        <>
          <rect
            x={8}
            y={2}
            width={1.4}
            height={20}
            rx={0.7}
            fill="var(--border-soft,var(--border))"
          />
          <circle cx={8.9} cy={6} r={1.8} fill={accent} />
          <circle
            cx={8.9}
            cy={12}
            r={1.8}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.9}
          />
          <circle
            cx={8.9}
            cy={18}
            r={1.8}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.9}
          />
          {line(5, 15, 19)}
          {line(11, 15, 15)}
          {line(17, 15, 17)}
        </>
      );
    case "profile-achievements":
      return (
        <>
          <rect
            x={2}
            y={3}
            width={14}
            height={18}
            rx={1.5}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.8}
          />
          <rect x={6} y={7} width={6} height={1.6} rx={0.8} fill={accent} />
          {line(11, 6, 6)}
          {line(14.5, 6, 6)}
          {line(18, 6, 6)}
        </>
      );
    case "profile-direction":
      return (
        <>
          <circle
            cx={7}
            cy={9}
            r={5.5}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.9}
          />
          <rect
            x={10}
            y={12}
            width={5}
            height={1.4}
            rx={0.7}
            fill="var(--border-soft,var(--border))"
            transform="rotate(45 12.5 12.7)"
          />
          <rect
            x={4.5}
            y={6.5}
            width={5}
            height={1.4}
            rx={0.7}
            fill="var(--border-soft,var(--border))"
            transform="rotate(45 7 7.2)"
          />
          <circle
            cx={7}
            cy={9}
            r={1.4}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.8}
          />
          {line(6, 17, 17)}
          {line(12, 17, 12)}
          {line(18, 17, 9)}
        </>
      );
    case "content-divider":
      return (
        <rect
          x={2}
          y={11}
          width={32}
          height={1.4}
          rx={0.7}
          fill="var(--border-strong,var(--border))"
        />
      );
    case "content-heading":
      return (
        <>
          <rect x={2} y={3} width={26} height={3} rx={1.2} fill={accent} />
          {line(10, 2, 30)}
          {line(14, 2, 26)}
          {line(18, 2, 18)}
        </>
      );
    case "profile-bio":
    case "content-text":
    case "content-markdown":
      return (
        <>
          {line(4, 2, 32)}
          {line(9, 2, 28)}
          {line(14, 2, 32)}
          {line(19, 2, 20)}
        </>
      );
    case "profile-links":
      return (
        <>
          {line(4, 9, 25)}
          <circle
            cx={6}
            cy={4.8}
            r={1.5}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.9}
          />
          {line(9, 9, 25)}
          <circle
            cx={6}
            cy={9.8}
            r={1.5}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.9}
          />
          {line(14, 9, 25)}
          <circle
            cx={6}
            cy={14.8}
            r={1.5}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.9}
          />
        </>
      );
    case "content-image":
      return (
        <>
          <rect
            x={2}
            y={3}
            width={32}
            height={18}
            rx={1.5}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.8}
          />
          <circle cx={9} cy={9} r={2.2} fill={accent} />
          <path d="M4 19 L13 11 L19 16 L24 12 L32 19 Z" fill="var(--border)" stroke="none" />
        </>
      );
    case "profile-readme":
      return (
        <>
          <rect
            x={6}
            y={2}
            width={24}
            height={20}
            rx={1.5}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.8}
          />
          {line(6, 9, 18)}
          {line(10, 9, 18)}
          {line(14, 9, 12)}
          <rect x={9} y={17} width={8} height={2.4} rx={1.2} fill={accent} />
        </>
      );
    case "profile-collaborators":
      return (
        <>
          <circle
            cx={8}
            cy={8}
            r={4}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.9}
          />
          <circle
            cx={19}
            cy={6.5}
            r={4}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.9}
          />
          <circle cx={29} cy={9} r={4} fill={accent} opacity={0.55} />
          {line(15, 3, 30, 2)}
          {line(19.5, 6, 24, 2)}
        </>
      );
    default:
      if (category === "project" || category === "community") {
        return (
          <>
            <rect x={2} y={3} width={32} height={4} rx={1.5} fill={accent} />
            {line(11, 2, 30)}
            {line(16, 2, 24)}
          </>
        );
      }
      return (
        <>
          <circle
            cx={8}
            cy={8}
            r={5}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.9}
          />
          {line(17, 16, 18)}
          {line(21, 16, 18)}
        </>
      );
  }
}
