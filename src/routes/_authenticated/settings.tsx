import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/tethyr/settings-page";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Tethyr" },
      {
        name: "description",
        content: "Manage your account, security, and notification preferences.",
      },
    ],
  }),
  component: SettingsPage,
});
