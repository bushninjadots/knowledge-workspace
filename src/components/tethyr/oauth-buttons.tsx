import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-error";
import { Button } from "@/components/ui/button";

/**
 * Social sign-in buttons for the auth pages. Each button starts a Supabase
 * OAuth flow and, on success, the provider redirects the browser to
 * `redirectTarget` (e.g. /dashboard) with the session in the URL hash —
 * supabase-js picks it up automatically and the authenticated route guard
 * passes.
 *
 * Providers must be enabled in the Supabase dashboard (Authentication →
 * Providers) and their URLs added to the allowed redirect list; until then
 * clicking one surfaces the provider's "not enabled" error via a toast.
 */

type OAuthProvider = "google" | "github" | "apple" | "gitlab" | "discord";

const PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
  { id: "apple", label: "Apple" },
  { id: "gitlab", label: "GitLab" },
  { id: "discord", label: "Discord" },
];

export function OAuthButtons({ redirectTarget = "/dashboard" }: { redirectTarget?: string }) {
  const [pending, setPending] = useState<OAuthProvider | null>(null);

  async function continueWith(provider: OAuthProvider) {
    setPending(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          // Land back on the page the user was headed to; the provider
          // appends the session to this URL as a hash fragment.
          redirectTo: `${window.location.origin}${redirectTarget}`,
        },
      });
      if (error) toast.error(getAuthErrorMessage(error));
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-2">
      {PROVIDERS.map(({ id, label }) => (
        <Button
          key={id}
          type="button"
          variant="outline"
          className="w-full justify-center gap-2"
          disabled={pending !== null}
          onClick={() => continueWith(id)}
          aria-label={`Continue with ${label}`}
        >
          <ProviderMark provider={id} />
          {pending === id ? "Redirecting…" : `Continue with ${label}`}
        </Button>
      ))}
    </div>
  );
}

/** Subtle monochrome brand marks (simple-icons paths, tinted by currentColor). */
function ProviderMark({ provider }: { provider: OAuthProvider }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "currentColor",
    className: "h-4 w-4 shrink-0 text-foreground/80",
    "aria-hidden": true,
  } as const;

  switch (provider) {
    case "google":
      return (
        <svg {...common}>
          <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
        </svg>
      );
    case "github":
      return (
        <svg {...common}>
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
      );
    case "apple":
      return (
        <svg {...common}>
          <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.03 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.702" />
        </svg>
      );
    case "gitlab":
      return (
        <svg {...common}>
          <path d="m23.6004 9.5927-.0337-.0862L20.3 1.6354c-.1128-.2876-.349-.5117-.6304-.5989-.2809-.0866-.5859-.0398-.8198.1272-.1367.0985-.2502.2283-.3285.3774L16.437 6.7414H7.561L5.4765 1.5405c-.0783-.1491-.1918-.2789-.3285-.3774-.2338-.167-.539-.2136-.8198-.1272-.2814.0872-.5176.3113-.6304.5989L.4333 9.5065l-.0337.0862a2.6407 2.6407 0 0 0 .9159 3.0938l.0047.0035.0116.0085 7.8731 5.9014.006.0044 2.6686 2.0198.8364.6331a.6296.6296 0 0 0 .7705 0l.8364-.6331 2.6686-2.0198.006-.0044 7.8731-5.9014.0116-.0085.0047-.0035a2.6407 2.6407 0 0 0 .9158-3.0938z" />
        </svg>
      );
    case "discord":
      return (
        <svg {...common}>
          <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
        </svg>
      );
  }
}
