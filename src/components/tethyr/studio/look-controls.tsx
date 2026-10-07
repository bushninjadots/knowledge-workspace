// Controls for the Studio's visual language (src/lib/visual-language.ts):
// the direction picker with small previews of each, and a visual option grid
// for every page-wide setting, each with a Reset back to the direction.
// Shared by the desktop Style panel and the phone sheet (via GStyleSections).

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { fontStack } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import {
  LOOK_GROUPS,
  LOOK_OPTIONS,
  VISUAL_LANGUAGES,
  chooseVisualLanguage,
  isGroupModified,
  isLookModified,
  resetLook,
  resetLookGroup,
  resolveLook,
  setLookValue,
  typePairing,
  visualLanguage,
  type Look,
  type LookGroupId,
  type LookKey,
  type VisualLanguage,
} from "@/lib/visual-language";
import type { GStudioConfig } from "./g-studio-surface";

type OnChange = (patch: Partial<GStudioConfig>) => void;

const tile =
  "group/tile relative flex min-w-0 flex-col items-stretch gap-1 border px-1.5 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] focus-visible:ring-offset-1";
const tileState = (active: boolean) =>
  active
    ? "border-[var(--user-accent-border)] bg-[var(--user-accent-subtle)]"
    : "border-border hover:border-[var(--border-strong)]";

/** "Modified" marker and a Reset for one group. */
export function GroupHeading({
  config,
  group,
  onChange,
  hint,
}: {
  config: GStudioConfig;
  group: LookGroupId;
  onChange: OnChange;
  hint?: string;
}) {
  const modified = isGroupModified(config, group);
  const direction = visualLanguage(config.visualLanguage)?.label ?? "Original";
  return (
    <div className="mb-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="t-label">{LOOK_GROUPS[group].label}</p>
        {modified && (
          <button
            type="button"
            onClick={() => onChange(resetLookGroup(config, group))}
            className="inline-flex items-center gap-1 text-2xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))]"
            title={`Back to ${direction}'s ${LOOK_GROUPS[group].label.toLowerCase()}`}
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Reset
          </button>
        )}
      </div>
      {hint && <p className="mt-0.5 text-2xs leading-snug text-muted-foreground-subtle">{hint}</p>}
    </div>
  );
}

/** Pick a direction: compact previews, the current one marked (and whether
 *  it has been changed), with a reset back to it. */
export function LanguagePicker({
  config,
  onChange,
}: {
  config: GStudioConfig;
  onChange: OnChange;
}) {
  const current = visualLanguage(config.visualLanguage);
  const modified = isLookModified(config);
  return (
    <section className="mb-5" aria-labelledby="vl-heading">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p id="vl-heading" className="t-label">
          Visual language
        </p>
        {modified && (
          <button
            type="button"
            onClick={() => onChange(resetLook(config))}
            className="inline-flex items-center gap-1 text-2xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))]"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Reset all
          </button>
        )}
      </div>
      <p className="mb-2 text-2xs leading-snug text-muted-foreground-subtle" aria-live="polite">
        <span className="font-medium text-foreground">{current?.label ?? "Original"}</span>
        {modified ? " · Modified" : ""} — a starting direction for how your space feels. Change
        anything after; your content and layout stay as they are.
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {VISUAL_LANGUAGES.map((language) => (
          <button
            key={language.id}
            type="button"
            aria-pressed={current?.id === language.id}
            onClick={() => onChange(chooseVisualLanguage(language.id))}
            className={cn(tile, tileState(current?.id === language.id))}
          >
            <LanguagePreview language={language} />
            <span className="flex items-baseline justify-between gap-1">
              <span className="truncate text-2xs font-medium text-foreground">
                {language.label}
              </span>
              {current?.id === language.id && modified && (
                <span className="text-3xs text-muted-foreground">Modified</span>
              )}
            </span>
            <span className="line-clamp-2 text-3xs leading-snug text-muted-foreground">
              {language.feels}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-pressed={!current}
        onClick={() => onChange(chooseVisualLanguage(null))}
        className={cn(
          "mt-1.5 w-full border px-2 py-1.5 text-left text-2xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))]",
          tileState(!current),
        )}
      >
        <span className="font-medium text-foreground">Original</span>
        <span className="text-muted-foreground"> — Tethyr&rsquo;s standard look</span>
      </button>
    </section>
  );
}

/** A tiny page drawn in the direction's own type, surface, border and image. */
function LanguagePreview({ language }: { language: VisualLanguage }) {
  const look = language.look;
  const pairing = typePairing(look.typePairing);
  const heading = fontStack(pairing.heading) ?? "inherit";
  const meta = fontStack(pairing.meta) ?? "inherit";
  const paper: Record<string, string> = {
    warm: "#f7f2ea",
    cool: "#eef2f7",
    vivid: "color-mix(in oklab, var(--user-accent, #3f8f8a) 9%, #fbfbfa)",
  };
  const card =
    look.surface === "open" || look.surface === "outline"
      ? "transparent"
      : look.surface === "inset"
        ? "rgb(0 0 0 / 0.05)"
        : "#ffffff";
  const line = "rgb(0 0 0 / 0.28)";
  const cardBorder: CSSProperties =
    look.borders === "none" && look.surface !== "outline"
      ? {}
      : look.borders === "underline"
        ? { borderBottom: `1px solid ${line}` }
        : {
            border: `${look.borders === "double" ? "3px double" : `1px ${look.borders === "dashed" ? "dashed" : look.borders === "dotted" ? "dotted" : "solid"}`} ${line}`,
          };
  const radius =
    look.shapes === "geometric" || look.shapes === "mixed" ? 0 : look.shapes === "organic" ? 7 : 4;
  return (
    <span
      aria-hidden
      className="relative block h-14 overflow-hidden border border-border/60 p-1.5 text-[#1d1d1d]"
      style={{
        background: paper[look.atmosphere] ?? "#f6f6f4",
        backgroundImage:
          look.grid === "technical" || look.grid === "modular"
            ? "linear-gradient(90deg, rgb(0 0 0 / 0.06) 1px, transparent 1px)"
            : undefined,
        backgroundSize: look.grid === "modular" ? "8px 8px" : "calc(100% / 6) 100%",
      }}
    >
      <span
        className="block truncate leading-none"
        style={{
          fontFamily: heading,
          fontSize: look.typeScale === "display" ? 15 : look.typeScale === "expressive" ? 13 : 11,
          fontWeight: 600,
          letterSpacing: look.typeScale === "display" ? "-0.04em" : "-0.01em",
          color: look.accent === "bold" ? "var(--user-accent, #3f8f8a)" : undefined,
        }}
      >
        {look.details === "editorial" || look.dividers === "numbered" ? "01 " : ""}Aa
      </span>
      <span className="mt-1 flex gap-1">
        <span
          className="h-5 flex-1"
          style={{
            background: card,
            borderRadius: radius,
            boxShadow:
              look.surface === "raised"
                ? "0 3px 6px rgb(0 0 0 / 0.14)"
                : look.borders === "offset"
                  ? `2px 2px 0 ${line}`
                  : undefined,
            ...cardBorder,
          }}
        >
          <span
            className="m-1 block h-0.5 w-3/5"
            style={{ background: "rgb(0 0 0 / 0.35)", fontFamily: meta }}
          />
          <span
            className="mx-1 block h-0.5 w-2/5"
            style={{
              background:
                look.accent === "structural" || look.accent === "bold"
                  ? "var(--user-accent, #3f8f8a)"
                  : "rgb(0 0 0 / 0.2)",
            }}
          />
        </span>
        <span
          className="h-5 w-6 shrink-0"
          style={{
            borderRadius:
              look.images === "rounded"
                ? 4
                : look.images === "soft"
                  ? 2
                  : look.shapes === "organic"
                    ? "6px 3px 5px 2px"
                    : 0,
            background:
              look.images === "duotone"
                ? "linear-gradient(135deg, #222, var(--user-accent, #3f8f8a))"
                : look.images === "monochrome"
                  ? "linear-gradient(135deg, #555, #ddd)"
                  : "linear-gradient(135deg, #c98b5e, #6a9fb5)",
          }}
        />
      </span>
    </span>
  );
}

/** A small drawing of each option, so the choice reads before it's made. */
function OptionPreview<K extends LookKey>({ setting, value }: { setting: K; value: Look[K] }) {
  const v = value as string;
  const line = "currentColor";
  switch (setting) {
    case "typePairing": {
      const pairing = typePairing(value as Look["typePairing"]);
      return (
        <span
          className="block truncate text-sm leading-none"
          style={{ fontFamily: fontStack(pairing.heading) ?? undefined }}
        >
          Aa
          <span
            className="ml-1 text-3xs text-muted-foreground"
            style={{ fontFamily: fontStack(pairing.meta) ?? undefined }}
          >
            Aa
          </span>
        </span>
      );
    }
    case "typeScale": {
      const size = { compact: 10, standard: 12, expressive: 15, display: 19 }[v] ?? 12;
      return (
        <span
          className="block leading-none"
          style={{ fontSize: size, fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          Aa
        </span>
      );
    }
    case "borders":
      return (
        <span
          className="block h-3 w-full"
          style={
            v === "none"
              ? { borderBottom: "1px solid transparent" }
              : v === "underline"
                ? { borderBottom: `1px solid ${line}` }
                : v === "offset"
                  ? { border: `1px solid ${line}`, boxShadow: `2px 2px 0 ${line}` }
                  : v === "corners"
                    ? {
                        background: `linear-gradient(${line},${line}) top left/4px 1px no-repeat, linear-gradient(${line},${line}) top left/1px 4px no-repeat, linear-gradient(${line},${line}) bottom right/4px 1px no-repeat, linear-gradient(${line},${line}) bottom right/1px 4px no-repeat`,
                      }
                    : { border: `${v === "double" ? "3px" : "1px"} ${v} ${line}` }
          }
        />
      );
    case "dividers": {
      const glyph: Record<string, string> = {
        none: " ",
        line: "────",
        double: "════",
        dotted: "········",
        dashed: "- - - -",
        fade: "─────",
        short: "──",
        numbered: "01 ───",
        crosshair: "+ ── +",
        marker: "§ ───",
      };
      return (
        <span
          className={cn(
            "block truncate font-mono text-3xs leading-none",
            v === "fade" && "opacity-50",
          )}
        >
          {glyph[v]}
        </span>
      );
    }
    case "surface":
      return (
        <span
          className="block h-3 w-full"
          style={{
            background:
              v === "outline" || v === "open"
                ? "transparent"
                : v === "inset"
                  ? "rgb(0 0 0 / 0.08)"
                  : "var(--surface-elevated)",
            border:
              v === "outline"
                ? `1px solid ${line}`
                : v === "open"
                  ? "1px dashed var(--border)"
                  : "1px solid var(--border)",
            boxShadow:
              v === "raised"
                ? "0 3px 6px rgb(0 0 0 / 0.18)"
                : v === "paper"
                  ? "0 1px 2px rgb(0 0 0 / 0.12)"
                  : v === "inset"
                    ? "inset 0 1px 2px rgb(0 0 0 / 0.18)"
                    : undefined,
          }}
        />
      );
    case "shapes":
      return (
        <span
          className="block h-3 w-5 bg-current opacity-70"
          style={{
            borderRadius:
              v === "geometric"
                ? 0
                : v === "soft"
                  ? 3
                  : v === "organic"
                    ? "7px 3px 6px 2px"
                    : "0 6px 0 6px",
          }}
        />
      );
    case "images":
      return (
        <span
          className="block h-3 w-5"
          style={{
            borderRadius: v === "rounded" ? 4 : v === "soft" ? 2 : 0,
            background:
              v === "duotone"
                ? "linear-gradient(135deg, #222, var(--user-accent, #3f8f8a))"
                : "linear-gradient(135deg, #c98b5e, #6a9fb5)",
            filter:
              v === "monochrome"
                ? "grayscale(1)"
                : v === "contrast"
                  ? "contrast(1.4) saturate(1.3)"
                  : v === "faded"
                    ? "saturate(0.5) brightness(1.15)"
                    : undefined,
            aspectRatio: v === "crop" ? "4 / 3" : undefined,
          }}
        />
      );
    case "atmosphere": {
      const pairs: Record<string, [string, string]> = {
        theme: ["var(--background)", "var(--foreground)"],
        warm: ["#f7f2ea", "#2b2520"],
        cool: ["#f1f4f8", "#18202b"],
        muted: ["#f2f1ee", "#6d6a66"],
        vivid: [
          "color-mix(in oklab, var(--user-accent, #3f8f8a) 18%, #fff)",
          "var(--user-accent, #3f8f8a)",
        ],
        contrast: ["#ffffff", "#000000"],
      };
      const [bg, fg] = pairs[v] ?? pairs.theme;
      return (
        <span className="flex h-3 w-full overflow-hidden border border-border">
          <span className="flex-1" style={{ background: bg }} />
          <span className="w-1/3" style={{ background: fg }} />
        </span>
      );
    }
    case "accent": {
      const strength = { signature: 2, minimal: 0, structural: 1, bold: 3, monochrome: -1 }[v] ?? 1;
      return (
        <span className="flex h-3 items-center gap-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5"
              style={{
                background:
                  strength < 0
                    ? "currentColor"
                    : i < strength
                      ? "var(--user-accent, #3f8f8a)"
                      : "var(--border-strong)",
              }}
            />
          ))}
        </span>
      );
    }
    case "grid": {
      const size: Record<string, string> = {
        subtle: "6px 100%",
        editorial: "12px 100%",
        technical: "4px 4px",
        modular: "6px 6px",
        baseline: "100% 3px",
      };
      return (
        <span
          className="block h-3 w-full border border-border"
          style={
            v === "invisible"
              ? undefined
              : {
                  backgroundImage:
                    v === "baseline"
                      ? "linear-gradient(currentColor 1px, transparent 1px)"
                      : v === "technical" || v === "modular"
                        ? "linear-gradient(90deg, currentColor 1px, transparent 1px), linear-gradient(currentColor 1px, transparent 1px)"
                        : "linear-gradient(90deg, currentColor 1px, transparent 1px)",
                  backgroundSize: size[v],
                  opacity: 0.45,
                }
          }
        />
      );
    }
    case "rhythm": {
      const gaps: Record<string, number[]> = {
        regular: [2, 2, 2],
        editorial: [1, 4, 2],
        asymmetric: [3, 1, 4],
        compressed: [1, 1, 1],
        breathing: [4, 4, 4],
      };
      return (
        <span className="flex h-3 flex-col justify-center">
          {(gaps[v] ?? gaps.regular).map((gap, i) => (
            <span
              key={i}
              className="block h-px bg-current opacity-60"
              style={{
                marginTop: i ? gap : 0,
                width: v === "asymmetric" ? `${[70, 100, 55][i]}%` : "100%",
              }}
            />
          ))}
        </span>
      );
    }
    case "header":
      return (
        <span className="flex h-3 w-full gap-0.5">
          {v === "split" ? (
            <>
              <span className="w-1/2 bg-current opacity-30" />
              <span className="w-1/2 border-b-2 border-current" />
            </>
          ) : (
            <span
              className={cn(
                "block w-full",
                v === "poster" && "bg-current opacity-40",
                v === "signature" && "bg-[var(--user-accent,#3f8f8a)] opacity-50",
                v === "classic" && "border border-current opacity-50",
                v === "editorial" && "border-b-[3px] border-current",
                v === "minimal" && "border-b border-current opacity-50",
              )}
            />
          )}
        </span>
      );
    case "details": {
      const text: Record<string, string> = {
        none: "Title",
        minimal: "01 Title",
        editorial: "01 Title",
        technical: "[01] +",
        expressive: "→ 01 •",
      };
      return <span className="block truncate font-mono text-3xs leading-none">{text[v]}</span>;
    }
    case "transitions": {
      return (
        <span className="flex h-3 flex-col justify-between">
          <span
            className={cn(
              "block h-1",
              v === "band" ? "bg-[var(--user-accent,#3f8f8a)] opacity-30" : "bg-current opacity-40",
            )}
          />
          <span className={cn("block h-1 bg-current opacity-40", v === "space" && "mt-1")} />
        </span>
      );
    }
    case "motion":
      return (
        <span className="block font-mono text-3xs leading-none">
          {
            (
              { still: "·", subtle: "◌", reveal: "↑", editorial: "▭", playful: "✦" } as Record<
                string,
                string
              >
            )[v]
          }
        </span>
      );
    default:
      return null;
  }
}

/** One page-wide setting as a grid of small drawn options. */
export function LookOptions<K extends LookKey>({
  config,
  setting,
  onChange,
  label,
  columns = 3,
  activeValue,
}: {
  config: GStudioConfig;
  setting: K;
  onChange: OnChange;
  /** Visible group label for the radios (screen readers). */
  label: string;
  columns?: 2 | 3 | 4;
  /** What the page actually shows, when something outside the look decides it. */
  activeValue?: Look[K];
}) {
  const look = resolveLook(config);
  const options = LOOK_OPTIONS[setting] as ReadonlyArray<{ id: Look[K]; label: string }>;
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "mb-4 grid gap-1",
        columns === 2 ? "grid-cols-2" : columns === 4 ? "grid-cols-4" : "grid-cols-3",
      )}
    >
      {options.map((option) => {
        const active = (activeValue ?? look[setting]) === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(setLookValue(config, setting, option.id))}
            className={cn(tile, tileState(active), "items-start text-foreground")}
          >
            <span aria-hidden className="flex h-4 w-full items-center text-muted-foreground">
              <OptionPreview setting={setting} value={option.id} />
            </span>
            <span className="truncate text-3xs text-foreground">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A disclosure for the lower-level controls. Closed, its controls aren't
 *  rendered at all, so they can't be reached or read until asked for. */
export function FineTune({
  children,
  label = "Fine tune",
}: {
  children: ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="mb-4 border-t border-border pt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="text-2xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))]"
      >
        <span
          aria-hidden
          className={cn("mr-1 inline-block transition-transform", open && "rotate-90")}
        >
          ›
        </span>
        {label}
      </button>
      {open && (
        <div id={id} className="pt-3">
          {children}
        </div>
      )}
    </div>
  );
}
