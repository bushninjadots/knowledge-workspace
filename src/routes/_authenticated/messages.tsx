// Direct messages surface — list of accepted connections + active thread.
// Includes pagination, typing indicators, read receipts, unread badges.

const searchSchema = z.object({
  c: z.string().optional(),
  project: z.string().optional(),
  projectName: z.string().optional(),
});

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Messages — Tethyr" },
      { name: "description", content: "Focused conversations at the meeting table." },
    ],
  }),
  // Code-split: the page component loads after the eager route surface
  // (loader/head/beforeLoad) so the entry chunk stays small.
  component: lazyRouteComponent(() => import("./-messages-page"), "MessagesPage"),
});
