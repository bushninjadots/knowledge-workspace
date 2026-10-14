import { Outlet } from "@tanstack/react-router";
import { DashboardSidebar } from "./dashboard-sidebar";
import { AppFrame } from "./app-frame";

/**
 * Shared layout for all authenticated routes — the app frame with the member
 * sidebar, mounted once so it never remounts on navigation.
 */
export function AuthenticatedShell() {
  return (
    <AppFrame isAuthed renderSidebar={(props) => <DashboardSidebar {...props} />}>
      <Outlet />
    </AppFrame>
  );
}
