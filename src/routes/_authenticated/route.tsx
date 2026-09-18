import { createFileRoute, lazyRouteComponent, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { robotsMeta } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({ meta: robotsMeta() }),
  // Code-split: the authenticated chrome (sidebar, nav, modules) stays out of
  // the public entry chunk. beforeLoad (the auth gate) stays eager.
  component: lazyRouteComponent(
    () => import("@/components/tethyr/authenticated-shell"),
    "AuthenticatedShell",
  ),
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw redirect({ to: "/login" });
      return { user: data.user };
    } catch (err) {
      if (err && typeof err === "object" && "isRedirect" in err) throw err;
      throw redirect({ to: "/login" });
    }
  },
});
