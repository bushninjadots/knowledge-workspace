import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";

/**
 * Shared wiring for route-page unit tests.
 *
 * renderRoutePage wraps the page in a fresh QueryClient (retry off, so a
 * failing query settles immediately instead of stalling the test).
 *
 * reactRouterMock is consumed from inside a vi.mock factory via a dynamic
 * import — vi.mock factories are hoisted above the test file's imports, so a
 * static import of this module would not be initialized yet:
 *
 *   vi.mock("@tanstack/react-router", async () => {
 *     const { reactRouterMock } = await import("@/test-utils/route-page");
 *     return reactRouterMock();
 *   });
 *
 * The mocked Link renders a real anchor: `search` is serialized into
 * data-search (tests can assert both the destination and its params) and
 * `$param` path segments are resolved from the `params` prop the way the real
 * router resolves them (ProfileLink only ever uses /u/$handle).
 */
export function renderRoutePage(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

export function reactRouterMock(overrides: Record<string, unknown> = {}) {
  return {
    Link: ({
      to,
      params,
      search,
      children,
      ...rest
    }: {
      to: string;
      params?: Record<string, string>;
      search?: unknown;
      children: React.ReactNode;
      [k: string]: unknown;
    }) => (
      <a
        href={
          params ? Object.entries(params).reduce((acc, [k, v]) => acc.replace(`$${k}`, v), to) : to
        }
        data-search={JSON.stringify(search ?? null)}
        {...rest}
      >
        {children}
      </a>
    ),
    useNavigate: () => vi.fn(),
    // Navigation guard — inert in unit tests.
    useBlocker: () => undefined,
    ...overrides,
  };
}
