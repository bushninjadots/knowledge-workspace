import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthenticatedShell } from "@/components/tethyr/authenticated-shell";
import { robotsMeta } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({ meta: robotsMeta() }),
  component: AuthenticatedShell,
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
