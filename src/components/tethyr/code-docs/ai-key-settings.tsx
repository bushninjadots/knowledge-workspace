// Settings → "AI (bring your own key)". The member pastes their own Anthropic
// key; it's checked with a free call, stored server-side only, and used just
// for the "Explain with AI" button. Without it, Code → docs still works.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AI_MODELS } from "@/lib/ai-models";
import { getAiKeyStatus, removeAiKey, saveAiKey } from "@/lib/code-docs-server";

const AI_KEY_STATUS = ["ai-key-status"] as const;

export function useAiKeyStatus() {
  return useQuery({ queryKey: AI_KEY_STATUS, queryFn: () => getAiKeyStatus(), staleTime: 60_000 });
}

export function AiKeySettingsSection() {
  const qc = useQueryClient();
  const { data: status } = useAiKeyStatus();
  const [key, setKey] = useState("");
  const [model, setModel] = useState<string | null>(null);
  const chosen = model ?? status?.model ?? AI_MODELS[0].id;

  const save = useMutation({
    mutationFn: () => saveAiKey({ data: { apiKey: key || undefined, model: chosen } }),
    onSuccess: (r) => {
      if (!r.ok) return void toast.error(r.error);
      toast.success("Key saved — Explain with AI is on");
      setKey("");
      void qc.invalidateQueries({ queryKey: AI_KEY_STATUS });
    },
    onError: () => toast.error("Couldn't save the key."),
  });
  const remove = useMutation({
    mutationFn: () => removeAiKey(),
    onSuccess: () => {
      toast.success("Key removed");
      void qc.invalidateQueries({ queryKey: AI_KEY_STATUS });
    },
  });

  return (
    <section id="ai-key" className="surface-card p-5">
      <h2 className="flex items-center gap-2 font-display text-base font-semibold">
        <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden />
        AI — bring your own key
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Code → docs works without AI. Add your own Anthropic API key and an{" "}
        <span className="font-medium text-foreground">Explain with AI</span> button rewrites the
        outline into plain language. You pay Anthropic directly for what you use; Tethyr never
        charges you. The key is stored on our server only, never shown again, and used only when you
        press the button.
      </p>

      {status?.hasKey && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-surface-elevated/60 px-3 py-1.5 text-xs">
          <KeyRound className="h-3.5 w-3.5" aria-hidden />
          Key ending <code className="font-mono">…{status.last4}</code> is saved
        </p>
      )}

      <form
        className="mt-4 grid gap-3 sm:grid-cols-[1fr_16rem]"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Input
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={status?.hasKey ? "Paste a new key to replace it" : "sk-ant-…"}
          aria-label="Anthropic API key"
        />
        <Select value={chosen} onValueChange={setModel}>
          <SelectTrigger aria-label="Model">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AI_MODELS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <Button
            type="submit"
            size="sm"
            busy={save.isPending}
            disabled={!key.trim() && !(status?.hasKey && model && model !== status.model)}
          >
            {status?.hasKey && !key.trim() ? "Save model" : "Check & save key"}
          </Button>
          {status?.hasKey && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              busy={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Remove key
            </Button>
          )}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Get a key from Anthropic
          </a>
        </div>
      </form>
    </section>
  );
}
