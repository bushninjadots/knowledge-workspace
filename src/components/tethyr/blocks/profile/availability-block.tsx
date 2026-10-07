import { useEffect } from "react";
import { BlockTitle } from "@/components/tethyr/blocks/block-title";
import { CalendarClock } from "lucide-react";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

const DEFAULT_SERVICES = ["Projects", "Collaboration"];
const DEFAULT_CAPACITY = "limited";
const DEFAULT_SCHEDULE = "Async, with focused sessions";

function ProfileAvailabilityBlock({ config, onChange, context }: BlockProps) {
  const capacity = typeof config.capacity === "string" ? config.capacity : DEFAULT_CAPACITY;
  const schedule = typeof config.schedule === "string" ? config.schedule : DEFAULT_SCHEDULE;
  const services = Array.isArray(config.services)
    ? config.services.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      )
    : DEFAULT_SERVICES;
  // Starter values the member never set read as claims they didn't make, so
  // visitors only see this block once something has been chosen.
  const untouched =
    capacity === DEFAULT_CAPACITY &&
    schedule === DEFAULT_SCHEDULE &&
    services.join("|") === DEFAULT_SERVICES.join("|");
  const hidden = !context.isEditing && untouched;
  const { blockId, onBlockEmptyChange } = context;

  useEffect(() => {
    if (!blockId) return;
    onBlockEmptyChange?.(blockId, hidden);
  }, [blockId, context.isEditing, hidden, onBlockEmptyChange]);

  if (hidden) return null;

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="Availability">
      <BlockTitle config={config} icon={<CalendarClock aria-hidden />}>
        Availability
      </BlockTitle>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
        <span className="text-sm capitalize text-foreground">{capacity}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {services.map((service) => (
          <span
            key={service}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
          >
            {service}
          </span>
        ))}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{schedule}</p>
      {context.isEditing && (
        <button
          type="button"
          className="inline-flex min-h-6 items-center self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline pointer-coarse:min-h-10"
          onClick={() =>
            onChange?.({ ...config, capacity: capacity === "open" ? "limited" : "open" })
          }
        >
          Toggle capacity
        </button>
      )}
    </section>
  );
}

registerBlock({
  type: "profile-availability",
  category: "identity",
  label: "Availability",
  title: "Availability",
  description: "Set a clear, human signal for how you can collaborate right now.",
  icon: "CalendarClock",
  contentSource: "config",
  defaults: {
    capacity: DEFAULT_CAPACITY,
    services: DEFAULT_SERVICES,
    schedule: DEFAULT_SCHEDULE,
  },
  fields: [
    {
      key: "capacity",
      label: "Capacity",
      type: "select",
      options: [
        { label: "Open", value: "open" },
        { label: "Limited", value: "limited" },
        { label: "Busy", value: "busy" },
      ],
    },
    {
      key: "schedule",
      label: "Preferred rhythm",
      type: "text",
      placeholder: "Async, with focused sessions",
    },
  ],
  component: ProfileAvailabilityBlock,
});

export { ProfileAvailabilityBlock };
