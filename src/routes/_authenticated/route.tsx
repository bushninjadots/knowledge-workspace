import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw redirect({ to: "/login" });
      return { user: data.user };
    } catch (err) {
      // If it's already a redirect (from above), re-throw it
      if (err && typeof err === "object" && "isRedirect" in err) throw err;
      // Any other error (network, etc.) — redirect to login
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
