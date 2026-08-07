import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useProjectScrollSpy } from "./use-project-scroll-spy";

// tests/setup.ts installs a MockIntersectionObserver with a static `instances`
// list. Reach through the global to drive it from tests.
type MockIO = {
  callback: IntersectionObserverCallback;
  elements: Set<Element>;
};

function ioInstances(): MockIO[] {
  const ctor = (globalThis as unknown as { IntersectionObserver: unknown })
    .IntersectionObserver as unknown as {
    instances: MockIO[];
  };
  return ctor.instances;
}

/** The most recently created observer (the one from the current render). */
function latestObserver(): MockIO | undefined {
  return ioInstances()[ioInstances().length - 1];
}

type FakeEntry = {
  isIntersecting: boolean;
  target: Element;
  boundingClientRect: { top: number };
};

function fire(entries: FakeEntry[]) {
  const obs = latestObserver();
  if (!obs) throw new Error("No IntersectionObserver created");
  act(() => {
    obs.callback(entries as unknown as IntersectionObserverEntry[], {} as IntersectionObserver);
  });
}

beforeEach(() => {
  // Reset the mock's instance registry so tests don't see stale observers.
  ioInstances().length = 0;
  (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear();
});

function Harness({ ids, renderSections = ids }: { ids: string[]; renderSections?: string[] }) {
  const { activeSection, scrollTo } = useProjectScrollSpy(ids);
  return (
    <div>
      <p data-testid="active">{activeSection ?? "none"}</p>
      {renderSections.map((id) => (
        <section key={id} id={id}>
          {id}
        </section>
      ))}
      <button data-testid="go" onClick={() => scrollTo(ids[0])}>
        go
      </button>
      <button data-testid="go-ghost" onClick={() => scrollTo("does-not-exist")}>
        ghost
      </button>
    </div>
  );
}

describe("useProjectScrollSpy", () => {
  it("observes the given section ids once they exist in the DOM", () => {
    render(<Harness ids={["vision", "roles", "milestones"]} />);
    const obs = latestObserver()!;
    expect(obs.elements.size).toBe(3);
    expect([...obs.elements].map((el) => el.id).sort()).toEqual(["milestones", "roles", "vision"]);
  });

  it("creates no observer and stays idle when no elements match", () => {
    const before = ioInstances().length;
    // The hook asks for an id that has no element in the DOM.
    render(<Harness ids={["ghost"]} renderSections={[]} />);
    // The hook bails before constructing an observer when nothing is found.
    expect(ioInstances().length).toBe(before);
    expect(screen.getByTestId("active")).toHaveTextContent("none");
  });

  it("sets the active section from intersecting entries, topmost first", () => {
    render(<Harness ids={["vision", "roles"]} />);
    const el = (id: string) => [...latestObserver()!.elements].find((e) => e.id === id)!;

    fire([
      { isIntersecting: true, target: el("roles"), boundingClientRect: { top: 120 } },
      { isIntersecting: true, target: el("vision"), boundingClientRect: { top: 40 } },
    ]);
    expect(screen.getByTestId("active")).toHaveTextContent("vision");
  });

  it("keeps the last active section when nothing intersects", () => {
    render(<Harness ids={["vision"]} />);
    const el = [...latestObserver()!.elements][0];

    fire([{ isIntersecting: true, target: el, boundingClientRect: { top: 10 } }]);
    expect(screen.getByTestId("active")).toHaveTextContent("vision");

    fire([{ isIntersecting: false, target: el, boundingClientRect: { top: 500 } }]);
    expect(screen.getByTestId("active")).toHaveTextContent("vision");
  });

  it("scrollTo calls scrollIntoView on the matching element", () => {
    render(<Harness ids={["vision", "roles"]} />);
    screen.getByTestId("go").click();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
  });

  it("scrollTo is a no-op for unknown ids", () => {
    render(<Harness ids={["vision"]} />);
    screen.getByTestId("go-ghost").click();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
});
