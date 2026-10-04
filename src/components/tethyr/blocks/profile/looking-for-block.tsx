import { Search } from "lucide-react";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

const DEFAULT_ITEMS = ["Collaborators", "Feedback", "Community"];

function ProfileLookingForBlock({ config, onChange, context }: BlockProps) {
  const items = Array.isArray(config.items)
    ? config.items.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : DEFAULT_ITEMS;
  const note = typeof config.note === "string" ? config.note : "Open to thoughtful collaborations and useful conversations.";

  if (context.isEditing) {
    return (
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Search className="size-4 text-primary" />
          Looking for
        </div>
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item} className="rounded-full border border-border px-2.5 py-1 text-xs text-foreground">
              {item}
            </span>
          ))}
        </div>
        <button
          type="button"
          className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => onChange?.({ ...config, items: [...items, "New connection"] })}
        >
          Add a category
        </button>
        <p className="text-sm leading-relaxed text-muted-foreground">{note}</p>
      </div>
    );
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="Looking for">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Search className="size-4 text-primary" />
        Looking for
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
            {item}
          </span>
        ))}
      </div>
      {note && <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{note}</p>}
    </section>
  );
}

registerBlock({
  type: "profile-looking-for",
  category: "people",
  label: "Looking for",
  description: "Show the kinds of collaborators, feedback, or conversations you want next.",
  icon: "Search",
  contentSource: "config",
  defaults: {
    items: DEFAULT_ITEMS,
    note: "Open to thoughtful collaborations and useful conversations.",
  },
  fields: [
    {
      key: "note",
      label: "Short note",
      type: "textarea",
      placeholder: "What would be useful right now?",
    },
  ],
  component: ProfileLookingForBlock,
});

export { ProfileLookingForBlock };
