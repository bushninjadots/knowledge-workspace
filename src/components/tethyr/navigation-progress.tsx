import { useRouterState } from "@tanstack/react-router";

/** A quiet transition cue shared by authenticated and public shells. */
export function NavigationProgress() {
  const isNavigating = useRouterState({ select: (state) => state.status === "pending" });

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden"
    >
      <div
        className={`h-full origin-left bg-[var(--user-accent,var(--learning))] transition-[transform,opacity] duration-150 motion-reduce:transition-opacity ${
          isNavigating ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
        }`}
      />
    </div>
  );
}
