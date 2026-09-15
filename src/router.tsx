import { QueryClient, dehydrate, hydrate, type DehydratedState } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * Global query defaults. Individual hooks still override staleTime where they
 * need fresher data — these only fill the (previously empty) baseline:
 * - failed queries stop after 2 attempts instead of React Query's default 3
 *   with exponential backoff, and 4xx-class errors (auth, permission,
 *   not-found, bad request) never retry because retrying cannot fix them —
 *   previously a revoked session looked like the app "hanging".
 * - mutations never retry (a double-fired insert is worse than a visible
 *   error).
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        retry: (failureCount, error) => {
          const status = (error as { status?: number } | null)?.status;
          if (typeof status === "number" && status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export const getRouter = () => {
  // Fresh QueryClient per router — on the server this is per request, so
  // dehydrated cache state never leaks between users.
  const queryClient = makeQueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // SSR: routes that prefetch in their loader (e.g. the landing page) get
    // their query cache serialized into the HTML and rehydrated on the client,
    // so server-rendered content and the client's first render always match.
    // The router's compile-time serializer validator rejects React Query's
    // DehydratedState (its query/mutation keys are typed `unknown[]`), even
    // though the values are plain JSON at runtime — hence the ts-expect-error.
    // @ts-expect-error DehydratedState fails ValidateSerializableInput
    dehydrate: () => ({ queryClientState: dehydrate(queryClient) }),
    hydrate: (dehydrated: { queryClientState?: DehydratedState }) => {
      if (dehydrated.queryClientState) hydrate(queryClient, dehydrated.queryClientState);
    },
  });

  return router;
};
