import { useState } from "react";
import { Check, Mail, RotateCw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

/**
 * Shown across authenticated pages while the account email is unconfirmed.
 * Kept intentionally slim — a single strip, resend + dismiss, nothing else.
 * Dismissal is remembered per session so it never re-nags mid-session, but
 * reappears on the next sign-in until the email is actually verified.
 */
export function EmailVerificationBanner() {
  const { data: me } = useCurrentUser();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(`email-banner-dismissed:${me?.userId ?? ""}`) === "1",
  );
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<"sent" | "error" | null>(null);

  if (!me || me.emailVerified || dismissed || !me.email || !me.userId) return null;
  const email = me.email;
  const userId = me.userId;

  async function resend(address: string) {
    setSending(true);
    setFeedback(null);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: address,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        setFeedback("error");
      } else {
        setFeedback("sent");
      }
    } catch {
      setFeedback("error");
    } finally {
      setSending(false);
    }
  }

  function dismiss(id: string) {
    sessionStorage.setItem(`email-banner-dismissed:${id}`, "1");
    setDismissed(true);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-warning/25 bg-warning-subtle/70 px-4 py-2 text-xs text-foreground/80">
      <span className="flex items-center gap-1.5">
        <Mail className="h-3.5 w-3.5 shrink-0 text-warning" />
        <span>
          Confirm your email to show your account is verified — your profile stays marked unverified
          until you do.
        </span>
      </span>
      <span className="ml-auto">
        {feedback === "sent" && (
          <span className="inline-flex items-center gap-1 font-medium">
            <Check className="h-3 w-3" /> Sent — check your inbox
          </span>
        )}
        {feedback === "error" && (
          <span className="font-medium">Couldn't send — try again in a moment</span>
        )}
        {feedback === null && (
          <button
            type="button"
            onClick={() => resend(email)}
            disabled={sending}
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 font-medium text-warning transition-colors hover:bg-warning/10 disabled:opacity-50"
          >
            <RotateCw className={`h-3 w-3 ${sending ? "animate-spin" : ""}`} />
            {sending ? "Sending…" : "Resend email"}
          </button>
        )}
      </span>
      <button
        type="button"
        onClick={() => dismiss(userId)}
        aria-label="Dismiss"
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
