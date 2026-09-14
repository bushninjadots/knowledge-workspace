import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFeaturedProjects, useLandingStats, useRecentActivity } from "./data";

/**
 * Hydration-parity guard for the landing sections.
 *
 * The server paints these sections in their loading/empty state because the
 * route streams its HTML before the serialized query cache is written (and
 * `dehydrate()` only includes queries that already succeeded). If a warm client
 * cache is allowed to render real content on the first client render, React
 * reports a hydration mismatch. These tests fail if the data stops being
 * withheld until after mount — and equally if it is withheld permanently.
 */
function trackRenders<T>(hook: () => T) {
  const observed: T[] = [];
  function Probe() {
    observed.push(hook());
    return null;
  }
  return { Probe, observed };
}

function wrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function clientWith(key: string, data: unknown) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
  });
  client.setQueryData([key], data);
  return client;
}

describe("landing section hydration parity", () => {
  it("withholds featured projects on the first render, then shows them after mount", () => {
    const client = clientWith("landing-featured-projects", [{ id: "p1", title: "Bloom" }]);
    const { Probe, observed } = trackRenders(() => useFeaturedProjects());

    render(<Probe />, { wrapper: wrapper(client) });

    // First render must match a server render that had no data.
    expect(observed[0].isLoading).toBe(true);
    expect(observed[0].data).toBeUndefined();
    // ...and the real content must arrive once mounted, not stay withheld.
    expect(observed.at(-1)!.isLoading).toBe(false);
    expect(observed.at(-1)!.data).toEqual([{ id: "p1", title: "Bloom" }]);
  });

  it("withholds landing stats on the first render, then shows them after mount", () => {
    const client = clientWith("landing-stats", { members: 10, projects: 9 });
    const { Probe, observed } = trackRenders(() => useLandingStats());

    render(<Probe />, { wrapper: wrapper(client) });

    expect(observed[0].isLoading).toBe(true);
    expect(observed[0].data).toBeUndefined();
    expect(observed.at(-1)!.data).toEqual({ members: 10, projects: 9 });
  });

  it("withholds recent activity on the first render, then shows it after mount", () => {
    const client = clientWith("landing-activity", [{ id: "post-1", title: "Shipped" }]);
    const { Probe, observed } = trackRenders(() => useRecentActivity());

    render(<Probe />, { wrapper: wrapper(client) });

    expect(observed[0].isLoading).toBe(true);
    expect(observed[0].data).toBeUndefined();
    expect(observed.at(-1)!.data).toEqual([{ id: "post-1", title: "Shipped" }]);
  });
});
