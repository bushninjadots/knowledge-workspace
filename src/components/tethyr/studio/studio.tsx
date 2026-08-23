// ── Creativity Studio ────────────────────────────────────────────────────────
// Three-column editing environment for profiles and projects.
// Owns all state and mutation wiring — children receive data + callbacks.

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Monitor, Tablet, Smartphone,
  Eye, Save, Send,
  PanelLeftClose, PanelLeftOpen,
  PanelRightClose, PanelRightOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { EditModeProvider } from "@/components/tethyr/page/edit-mode-context";
import { createDefaultProfileLayout, createDefaultProjectLayout } from "@/lib/default-layouts";
import {
  useCreatePage, useUpdatePageLayout, usePublishPage, useUnpublishPage,
} from "@/hooks/use-page-editor";
import { usePage, invalidatePage } from "@/hooks/use-page";
import { useThemeCatalog } from "@/hooks/use-theme-catalog";
import { useUpdatePageTheme } from "@/hooks/use-page-editor";
import { usePublicTemplates, useApplyTemplate, useSaveAsTemplate } from "@/hooks/use-templates";
import { useForkLayout } from "@/hooks/use-fork";
import { createBlockInstance, getBlock } from "@/lib/block-registry";
import { useQueryClient } from "@tanstack/react-query";
import { StudioSidebar } from "./studio-sidebar";
import { StudioCanvas } from "./studio-canvas";
import { StudioInspector } from "./studio-inspector";
import type { PageLayout, PageOwnerType } from "@/lib/page-blocks";

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
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ── Page selection ────────────────────────────────────────────────────
  const [activePage, setActivePage] = useState<StudioPage | null>(() => {
    if (profile) return { id: profile.id, handle: profile.handle ?? undefined, title: profile.display_name ?? "My Studio", type: "profile" };
    if (projects.length > 0) return { id: projects[0].id, title: projects[0].title, type: "project" };
    return null;
  });

  const [devicePreview, setDevicePreview] = useState<DevicePreview>("desktop");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<string>("pages");
  const ensuringRef = useRef(false);

  // ── Query data ────────────────────────────────────────────────────────
  const { data: pageData, isLoading: pageLoading, isError: pageError, refetch: refetchPage } = usePage({
    ownerId: activePage?.id ?? "",
    ownerType: (activePage?.type ?? "project") as PageOwnerType,
  });

  const { data: themeCatalog = [] } = useThemeCatalog();
  const { data: publicTemplates = [] } = usePublicTemplates({ sort: "popular" });

  // Theme name lookup for template cards.
  const themeNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of themeCatalog) m.set(t.id, t.name);
    return m;
  }, [themeCatalog]);

  // ── Mutations ─────────────────────────────────────────────────────────
  const createPage = useCreatePage();
  const updateLayout = useUpdatePageLayout();
  const updateTheme = useUpdatePageTheme();
  const publishPage = usePublishPage();
  const unpublishPage = useUnpublishPage();
  const applyTemplate = useApplyTemplate();
  const saveAsTemplate = useSaveAsTemplate();
  const forkLayout = useForkLayout();

  // Auto-create page when owner visits studio and no page exists yet.
  useEffect(() => {
    if (!pageLoading && !pageData && activePage && !createPage.isPending && !ensuringRef.current) {
      ensuringRef.current = true;
      const layout = activePage.type === "profile"
        ? createDefaultProfileLayout()
        : createDefaultProjectLayout();
      createPage.mutate({ ownerId: activePage.id, ownerType: activePage.type, userId, defaultLayout: layout });
    }
  }, [pageLoading, pageData, activePage, createPage, userId]);

  // Refetch after page creation.
  useEffect(() => {
    if (createPage.isSuccess) refetchPage();
  }, [createPage.isSuccess, refetchPage]);

  // ── Layout helpers ────────────────────────────────────────────────────
  const layout: PageLayout = pageData?.layout ?? { sections: [] };
  const isPublished = pageData?.status === "published";

  const writeLayout = useCallback(
    (newLayout: PageLayout, opts?: { onDone?: () => void }) => {
      if (!pageData) return;
      updateLayout.mutate(
        { pageId: pageData.id, layoutId: pageData.layoutId, layout: newLayout },
        { onSuccess: () => { refetchPage(); opts?.onDone?.(); } },
      );
    },
    [pageData, updateLayout, refetchPage],
  );

  // ── Add block ─────────────────────────────────────────────────────────
  const handleAddBlock = useCallback(
    (blockType: string) => {
      const inst = createBlockInstance(blockType as any);
      if (!inst) return;
      const existing = pageData?.layout?.sections ?? [];
      const sections = existing.map((s: any) => ({ ...s, blocks: [...s.blocks] }));
      let last = sections[sections.length - 1];
      if (!last) {
        last = { id: `sect_${Date.now()}`, position: 0, layout: "full", blocks: [] };
        sections.push(last);
      }
      const newBlock = {
        id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: inst.type,
        position: last.blocks.length,
        config: { ...inst.config } as Record<string, unknown>,
        visible: true,
      };
      sections[sections.length - 1] = { ...last, blocks: [...last.blocks, newBlock] };
      writeLayout({ sections });
      setSelectedBlockId(newBlock.id);
    },
    [layout, writeLayout],
  );

  // ── Remove block ──────────────────────────────────────────────────────
  const handleRemoveBlock = useCallback(
    (blockId: string) => {
      const sections = layout.sections
        .map((s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== blockId) }))
        .filter((s) => s.blocks.length > 0);
      writeLayout({ sections });
      if (selectedBlockId === blockId) setSelectedBlockId(null);
    },
    [layout, writeLayout, selectedBlockId],
  );

  // ── Toggle visibility ─────────────────────────────────────────────────
  const handleToggleVisibility = useCallback(
    (blockId: string) => {
      const sections = layout.sections.map((s) => ({
        ...s,
        blocks: s.blocks.map((b) =>
          b.id === blockId ? { ...b, visible: !b.visible } : b,
        ),
      }));
      writeLayout({ sections });
    },
    [layout, writeLayout],
  );

  // ── Move block ────────────────────────────────────────────────────────
  const handleMoveBlock = useCallback(
    (blockId: string, direction: "up" | "down") => {
      const sections = layout.sections.map((s) => ({ ...s, blocks: [...s.blocks] }));
      for (const section of sections) {
        const idx = section.blocks.findIndex((b) => b.id === blockId);
        if (idx === -1) continue;
        const newIdx = direction === "up" ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= section.blocks.length) return;
        const [moved] = section.blocks.splice(idx, 1);
        section.blocks.splice(newIdx, 0, moved);
        break;
      }
      writeLayout({ sections });
    },
    [layout, writeLayout],
  );

  // ── Drag reorder blocks ────────────────────────────────────────────────
  const handleReorderBlocks = useCallback(
    (sectionId: string, blockId: string, targetIndex: number) => {
      const sections = layout.sections.map((s) => ({ ...s, blocks: [...s.blocks] }));
      for (const section of sections) {
        const idx = section.blocks.findIndex((b) => b.id === blockId);
        if (idx === -1) continue;
        const [moved] = section.blocks.splice(idx, 1);
        const clampedTarget = Math.min(targetIndex, section.blocks.length);
        section.blocks.splice(clampedTarget, 0, moved);
        break;
      }
      writeLayout({ sections });
    },
    [layout, writeLayout],
  );

  // ── Publish / Save Draft / Preview ────────────────────────────────────
  const handlePublish = useCallback(async () => {
    if (!pageData) return;
    try {
      await publishPage.mutateAsync({ pageId: pageData.id });
      toast.success("Published");
      refetchPage();
    } catch (err) {
      toast.error(friendlyError(err, "Failed to publish"));
    }
  }, [pageData, publishPage, refetchPage]);

  const handleUnpublish = useCallback(async () => {
    if (!pageData) return;
    try {
      await unpublishPage.mutateAsync({ pageId: pageData.id });
      toast.success("Reverted to draft");
      refetchPage();
    } catch (err) {
      toast.error(friendlyError(err, "Failed to unpublish"));
    }
  }, [pageData, unpublishPage, refetchPage]);

  const handlePreview = useCallback(() => {
    if (!activePage) return;
    if (activePage.type === "profile") {
      navigate({ to: "/u/$handle", params: { handle: activePage.handle ?? activePage.id } });
    } else {
      navigate({ to: "/projects/$id", params: { id: activePage.id } });
    }
  }, [activePage, navigate]);

  // ── Apply theme ───────────────────────────────────────────────────────
  const handleApplyTheme = useCallback(
    (themeId: string) => {
      if (!pageData) return;
      updateTheme.mutate(
        { pageId: pageData.id, themeId },
        { onSuccess: () => { refetchPage(); toast.success("Theme applied"); } },
      );
    },
    [pageData, updateTheme, refetchPage],
  );

  // ── Apply template ────────────────────────────────────────────────────
  const handleApplyTemplate = useCallback(
    (templateId: string) => {
      if (!pageData || !activePage) return;
      applyTemplate.mutate(
        {
          templateId, pageId: pageData.id, layoutId: pageData.layoutId,
          ownerId: activePage.id, ownerType: activePage.type,
        },
        { onSuccess: () => { refetchPage(); toast.success("Template applied"); } },
      );
    },
    [pageData, activePage, applyTemplate, refetchPage],
  );

  // ── Save as template ──────────────────────────────────────────────────
  const handleSaveAsTemplate = useCallback(
    (name: string, options?: { description?: string; category?: string }) => {
      if (!pageData) return;
      saveAsTemplate.mutate(
        { layoutId: pageData.layoutId, name, ...options },
        { onSuccess: () => { toast.success("Template published"); } },
      );
    },
    [pageData, saveAsTemplate],
  );

  // ── Re-seed templates ────────────────────────────────────────────────
  const handleReseed = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any).rpc("reseed_default_templates");
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success(`Templates refreshed`);
    } catch (err) {
      toast.error(friendlyError(err, "Failed to re-seed"));
    }
  }, [qc]);

  // ── Fork template ─────────────────────────────────────────────────────
  const handleForkTemplate = useCallback(
    (templateId: string) => {
      if (!activePage) return;
      forkLayout.mutate(
        { parentLayoutId: templateId },
        { onSuccess: () => { refetchPage(); toast.success("Layout forked"); } },
      );
    },
    [activePage, forkLayout, refetchPage],
  );

  // ── Page selection ────────────────────────────────────────────────────
  const handleSelectPage = useCallback((page: StudioPage) => {
    setActivePage(page);
    setSelectedBlockId(null);
  }, []);

  // ── Device class ──────────────────────────────────────────────────────
  const deviceClass = useMemo(() => {
    switch (devicePreview) {
      case "mobile": return "max-w-[375px]";
      case "tablet": return "max-w-[768px]";
      default: return "max-w-full";
    }
  }, [devicePreview]);

  // ── Blocks for canvas/inspector ───────────────────────────────────────
  const blocks = layout.sections.flatMap((s) => s.blocks);
  const selectedBlock = selectedBlockId ? blocks.find((b) => b.id === selectedBlockId) ?? null : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* ── Top toolbar ─────────────────────────────────────────────────── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/30 bg-surface-elevated/30 px-4">
        <div className="flex items-center gap-4">
          <span className="font-display text-sm font-semibold tracking-tight text-foreground">
            Creativity Studio
          </span>
          <span className="h-4 w-px bg-border/40" aria-hidden="true" />

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
            {([
              ["desktop", Monitor],
              ["tablet", Tablet],
              ["mobile", Smartphone],
            ] as const).map(([key, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setDevicePreview(key)}
                className={`rounded px-2 py-1 transition-colors ${
                  devicePreview === key ? "bg-surface-elevated text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label={`${key} preview`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          <span className="h-4 w-px bg-border/40" aria-hidden="true" />

          {isPublished ? (
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-[11px]" onClick={handleUnpublish}>
              Unpublish
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-[11px]">
              <Save className="h-3.5 w-3.5" /> Draft
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-[11px]" onClick={handlePreview}>
            <Eye className="h-3.5 w-3.5" /> Preview
          </Button>
          {!isPublished && (
            <Button variant="default" size="sm" className="h-7 gap-1.5 text-[11px]" onClick={handlePublish} disabled={publishPage.isPending}>
              <Send className="h-3.5 w-3.5" /> {publishPage.isPending ? "Publishing…" : "Publish"}
            </Button>
          )}
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
              activeTab={sidebarTab}
              onTabChange={setSidebarTab}
              onAddBlock={handleAddBlock}
              onApplyTemplate={handleApplyTemplate}
              onForkTemplate={handleForkTemplate}
              onApplyTheme={handleApplyTheme}
              onSaveAsTemplate={handleSaveAsTemplate}
              onReseed={handleReseed}
              themeNames={themeNames}
              templates={publicTemplates}
              themes={themeCatalog}
              currentThemeId={pageData?.themeId ?? null}
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
                    pageData={pageData}
                    pageLoading={pageLoading}
                    pageError={pageError}
                    selectedBlockId={selectedBlockId}
                    onSelectBlock={setSelectedBlockId}
                    onRemoveBlock={handleRemoveBlock}
                    onToggleVisibility={handleToggleVisibility}
                    onMoveBlock={handleMoveBlock}
                    onReorderBlocks={handleReorderBlocks}
                    onAddBlock={handleAddBlock}
                    onLayoutChange={writeLayout}
                    onRefetch={refetchPage}
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
              selectedBlock={selectedBlock}
              selectedBlockDef={selectedBlockId ? getBlock(selectedBlockId) : undefined}
              pageData={pageData}
              isPublished={isPublished}
              onPublish={handlePublish}
              onUnpublish={handleUnpublish}
              onSelectBlock={setSelectedBlockId}
              onMoveBlock={handleMoveBlock}
              onRemoveBlock={handleRemoveBlock}
              onRefetch={refetchPage}
            />
          )}
        </div>
      </div>

      {/* ── Panel toggles ───────────────────────────────────────────────── */}
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