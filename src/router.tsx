import { QueryClient, dehydrate, hydrate, type DehydratedState } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { getGlobalStartContext } from "@tanstack/react-start";
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
 * - refocus refetching is off: 80+ mounted queries would each fire a Supabase
 *   request on every tab switch. Volatile surfaces (notifications, messages,
 *   chat) already subscribe to realtime channels and opt back in explicitly.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
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

  // `start.ts`'s CSP middleware puts a per-request nonce in the request
  // context; handing it to the router is what makes the scripts TanStack
  // renders (Scripts, ScriptOnce, the SSR stream barrier) carry it, and what
  // emits <meta property="csp-nonce"> for the client to read on hydration.
  // Undefined everywhere the context does not exist (client-side navigation,
  // tests), which simply means no nonce attributes — the browser only checks
  // the attribute in the response it received.
  const nonce = getGlobalStartContext()?.nonce;

  const router = createRouter({
    routeTree,
    context: { queryClient },
    ssr: { nonce },
    scrollRestoration: true,
    // Avoid repeating loader work when users move across navigation links while
    // keeping preloaded route data fresh enough for interactive surfaces.
    defaultPreloadStaleTime: 30_000,
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
