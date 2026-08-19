import { QueryClient, dehydrate, hydrate, type DehydratedState } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Fresh QueryClient per router — on the server this is per request, so
  // dehydrated cache state never leaks between users.
  const queryClient = new QueryClient();

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
