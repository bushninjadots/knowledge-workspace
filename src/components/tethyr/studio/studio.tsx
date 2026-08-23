// ── Creativity Studio ────────────────────────────────────────────────────────
// Three-column editing environment for profiles and projects.
// Left: navigation + blocks, Center: live canvas, Right: properties/design.

import { useState, useCallback, useMemo } from "react";
import {
  Monitor,
  Tablet,
  Smartphone,
  Eye,
  Save,
  Send,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditModeProvider, useEditMode } from "@/components/tethyr/page/edit-mode-context";
import { StudioSidebar } from "./studio-sidebar";
import { StudioCanvas } from "./studio-canvas";
import { StudioInspector } from "./studio-inspector";
import type { BlockDefinition } from "@/lib/page-blocks";

export type StudioPage = {
  id: string;
  handle?: string;
  title: string;
  type: "profile" | "project";
};

export type DevicePreview = "desktop" | "tablet" | "mobile";

interface StudioProps {
  userId: string;
  profile: { id: string; handle: string | null; display_name: string | null } | null;
  projects: { id: string; title: string; status: string }[];
}

export function Studio({ userId, profile, projects }: StudioProps) {
  const [activePage, setActivePage] = useState<StudioPage | null>(() => {
    if (profile) return { id: profile.id, handle: profile.handle ?? undefined, title: profile.display_name ?? "My Studio", type: "profile" };
    if (projects.length > 0) return { id: projects[0].id, title: projects[0].title, type: "project" };
    return null;
  });
  const [devicePreview, setDevicePreview] = useState<DevicePreview>("desktop");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const handleSelectPage = useCallback((page: StudioPage) => {
    setActivePage(page);
    setSelectedBlockId(null);
  }, []);

  const deviceClass = useMemo(() => {
    switch (devicePreview) {
      case "mobile": return "max-w-[375px]";
      case "tablet": return "max-w-[768px]";
      default: return "max-w-full";
    }
  }, [devicePreview]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* ── Top toolbar ─────────────────────────────────────────────────── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/30 bg-surface-elevated/30 px-4">
        <div className="flex items-center gap-4">
          <span className="font-display text-sm font-semibold tracking-tight text-foreground">
            Creativity Studio
          </span>
          <span className="h-4 w-px bg-border/40" aria-hidden="true" />

          {/* Page selector */}
          <select
            value={`${activePage?.type}:${activePage?.id}`}
            onChange={(e) => {
              const [type, id] = e.target.value.split(":");
              if (type === "profile" && profile) {
                handleSelectPage({ id: profile.id, handle: profile.handle ?? undefined, title: profile.display_name ?? "My Studio", type: "profile" });
              } else {
                const proj = projects.find((p) => p.id === id);
                if (proj) handleSelectPage({ id: proj.id, title: proj.title, type: "project" });
              }
            }}
            className="h-7 rounded-md border border-border/40 bg-transparent px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {profile && (
              <option value={`profile:${profile.id}`}>
                Profile: {profile.display_name ?? profile.handle ?? "My Studio"}
              </option>
            )}
            {projects.map((p) => (
              <option key={p.id} value={`project:${p.id}`}>
                Project: {p.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Device preview */}
          <div className="flex items-center rounded-md border border-border/30 bg-surface/50 p-0.5">
            <button
              type="button"
              onClick={() => setDevicePreview("desktop")}
              className={`rounded px-2 py-1 text-[11px] transition-colors ${
                devicePreview === "desktop" ? "bg-surface-elevated text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Desktop preview"
            >
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDevicePreview("tablet")}
              className={`rounded px-2 py-1 text-[11px] transition-colors ${
                devicePreview === "tablet" ? "bg-surface-elevated text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Tablet preview"
            >
              <Tablet className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDevicePreview("mobile")}
              className={`rounded px-2 py-1 text-[11px] transition-colors ${
                devicePreview === "mobile" ? "bg-surface-elevated text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Mobile preview"
            >
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </div>

          <span className="h-4 w-px bg-border/40" aria-hidden="true" />

          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-[11px]">
            <Save className="h-3.5 w-3.5" /> Save Draft
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-[11px]">
            <Eye className="h-3.5 w-3.5" /> Preview
          </Button>
          <Button variant="default" size="sm" className="h-7 gap-1.5 text-[11px]">
            <Send className="h-3.5 w-3.5" /> Publish
          </Button>
        </div>
      </header>

      {/* ── Three-column body ────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div
          className={`shrink-0 overflow-y-auto border-r border-border/30 bg-surface-elevated/10 transition-all duration-200 ${
            leftOpen ? "w-60" : "w-0 overflow-hidden border-r-0"
          }`}
        >
          {leftOpen && (
            <StudioSidebar
              activePage={activePage}
              onSelectBlock={(blockId) => setSelectedBlockId(blockId)}
            />
          )}
        </div>

        {/* Center canvas */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 justify-center overflow-y-auto bg-noise p-6">
            <div className={`w-full ${deviceClass} transition-all duration-200`}>
              {activePage && (
                <EditModeProvider>
                  <StudioCanvas
                    page={activePage}
                    selectedBlockId={selectedBlockId}
                    onSelectBlock={setSelectedBlockId}
                  />
                </EditModeProvider>
              )}
            </div>
          </div>
        </div>

        {/* Right inspector */}
        <div
          className={`shrink-0 overflow-y-auto border-l border-border/30 bg-surface-elevated/10 transition-all duration-200 ${
            rightOpen ? "w-64" : "w-0 overflow-hidden border-l-0"
          }`}
        >
          {rightOpen && (
            <StudioInspector
              activePage={activePage}
              selectedBlockId={selectedBlockId}
              onSelectBlock={setSelectedBlockId}
            />
          )}
        </div>
      </div>

      {/* ── Panel toggles (bottom corners) ───────────────────────────────── */}
      <div className="pointer-events-none fixed bottom-4 left-4 z-40 flex gap-2">
        <button
          type="button"
          onClick={() => setLeftOpen(!leftOpen)}
          className="pointer-events-auto rounded-md border border-border/40 bg-surface-elevated p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={leftOpen ? "Close sidebar" : "Open sidebar"}
        >
          {leftOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex gap-2">
        <button
          type="button"
          onClick={() => setRightOpen(!rightOpen)}
          className="pointer-events-auto rounded-md border border-border/40 bg-surface-elevated p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={rightOpen ? "Close inspector" : "Open inspector"}
        >
          {rightOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}