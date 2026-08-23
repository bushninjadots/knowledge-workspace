// ── Creativity Studio ────────────────────────────────────────────────────────
// Three-column editing environment for profiles and projects.
// Owns all state and mutation wiring — children receive data + callbacks.
// Includes a status bar showing auth, page, registry, and template state to
// help users understand exactly what's happening.

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Monitor, Tablet, Smartphone,
  Eye, Save, Send,
  PanelLeftClose, PanelLeftOpen,
  PanelRightClose, PanelRightOpen,
  AlertTriangle, CheckCircle2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { EditModeProvider } from "@/components/tethyr/page/edit-mode-context";
import { createDefaultProfileLayout, createDefaultProjectLayout } from "@/lib/default-layouts";
import {
  useCreatePage, useUpdatePageLayout, usePublishPage, useUnpublishPage,
  useUpdateThemeOverrides,
} from "@/hooks/use-page-editor";
import { usePage, invalidatePage } from "@/hooks/use-page";
import { useThemeCatalog } from "@/hooks/use-theme-catalog";
import { useUpdatePageTheme } from "@/hooks/use-page-editor";
import { usePublicTemplates, useApplyTemplate, useSaveAsTemplate } from "@/hooks/use-templates";
import { useForkLayout } from "@/hooks/use-fork";
import { createBlockInstance, getBlock, getAllBlocks } from "@/lib/block-registry";
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
  const { data: pageData, isLoading: pageLoading, isError: pageError, refetch: refetchPage, error: pageFetchError } = usePage({
    ownerId: activePage?.id ?? "",
    ownerType: (activePage?.type ?? "project") as PageOwnerType,
  });

  const { data: themeCatalog = [], isLoading: themesLoading } = useThemeCatalog();
  const { data: publicTemplates = [], isLoading: templatesLoading, isError: templatesError, error: templateFetchError } = usePublicTemplates({ sort: "popular" });

  // Block registry diagnostic
  const [blockCount, setBlockCount] = useState(0);
  useEffect(() => {
    // Dynamic import to avoid circular deps
    import("@/lib/block-registry").then(({ getAllBlocks }) => {
      const count = getAllBlocks().length;
      setBlockCount(count);
      if (count === 0) {
        console.error("[Studio] ⚠ ZERO blocks registered — block picker and renderer will be empty");
        toast.error("Block system not loaded. Refresh the page.");
      } else {
        console.log(`[Studio] ✅ ${count} blocks registered`);
      }
    });
  }, []);

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
  const updateThemeOverrides = useUpdateThemeOverrides();
  const publishPage = usePublishPage();
  const unpublishPage = useUnpublishPage();
  const applyTemplate = useApplyTemplate();
  const saveAsTemplate = useSaveAsTemplate();
  const forkLayout = useForkLayout();

  // Auto-create page when owner visits studio and no page exists yet.
  useEffect(() => {
    if (!pageLoading && !pageData && activePage && !createPage.isPending && !ensuringRef.current) {
      ensuringRef.current = true;
      console.log(`[Studio] No page found for ${activePage.type}/${activePage.id} — auto-creating with default layout`);
      toast.info(`Creating default ${activePage.type} page...`);
      const layout = activePage.type === "profile"
        ? createDefaultProfileLayout()
        : createDefaultProjectLayout();
      createPage.mutate(
        { ownerId: activePage.id, ownerType: activePage.type, userId, defaultLayout: layout },
        {
          onSuccess: (data) => {
            console.log("[Studio] ✅ Page auto-created:", data);
            toast.success("Page created! You can now customize it.");
          },
          onError: (err) => {
            console.error("[Studio] ❌ Failed to auto-create page:", err);
            toast.error(friendlyError(err, "Failed to create page"));
          },
        },
      );
    }
  }, [pageLoading, pageData, activePage, createPage, userId]);

  // Refetch after page creation.
  useEffect(() => {
    if (createPage.isSuccess) {
      setTimeout(() => refetchPage(), 300); // Small delay for DB commit visibility
    }
  }, [createPage.isSuccess, refetchPage]);

  // Log template loading status
  useEffect(() => {
    if (templatesLoading) return;
    if (templatesError) {
      console.error("[Studio] ❌ Template fetch error:", templateFetchError);
      toast.error(friendlyError(templateFetchError, "Could not load templates"));
    } else {
      console.log(`[Studio] ✅ ${publicTemplates.length} templates loaded`);
    }
  }, [templatesLoading, templatesError, publicTemplates.length, templateFetchError]);

  // ── Layout helpers ────────────────────────────────────────────────────
  const layout: PageLayout = pageData?.layout ?? { sections: [] };
  const isPublished = pageData?.status === "published";

  const writeLayout = useCallback(
    (newLayout: PageLayout, opts?: { onDone?: () => void }) => {
      if (!pageData) {
        console.warn("[Studio] writeLayout skipped — no pageData");
        toast.error("No page loaded yet. Wait for the page to finish loading.");
        return;
      }
      console.log(`[Studio] writeLayout → pageId=${pageData.id} layoutId=${pageData.layoutId} sections=${newLayout.sections.length}`);
      updateLayout.mutate(
        { pageId: pageData.id, layoutId: pageData.layoutId, layout: newLayout },
        {
          onSuccess: () => {
            console.log("[Studio] ✅ writeLayout success, refetching");
            // Small delay to let the mutation's own cache invalidation propagate.
            setTimeout(() => refetchPage(), 100);
            opts?.onDone?.();
          },
          onError: (err) => {
            console.error("[Studio] ❌ writeLayout error:", err);
            toast.error(friendlyError(err, "Failed to save layout. Check if you own this page."));
          },
        },
      );
    },
    [pageData, updateLayout, refetchPage],
  );

  // ── Add block ─────────────────────────────────────────────────────────
  const handleAddBlock = useCallback(
    (blockType: string) => {
      console.log(`[Studio] handleAddBlock type="${blockType}" pageData=${pageData?.id ?? "null"} blockCount=${blockCount}`);
      if (!pageData) {
        toast.error("Page not loaded yet. Wait a moment.");
        return;
      }
      const inst = createBlockInstance(blockType as any);
      if (!inst) {
        console.warn(`[Studio] ❌ createBlockInstance returned null for "${blockType}"`);
        toast.error(`Block type "${blockType}" not registered. Total blocks: ${blockCount}. Try refreshing.`);
        return;
      }
      console.log(`[Studio] ✅ Block instance created:`, inst.type);
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
      toast.success(`Added ${inst.type.replace(/-/g, " ")}`);
      writeLayout({ sections });
      setSelectedBlockId(newBlock.id);
    },
    [layout, writeLayout, pageData, blockCount],
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

  // ── Update block config ──────────────────────────────────────────────
  const handleUpdateBlockConfig = useCallback(
    (blockId: string, config: Record<string, unknown>) => {
      const sections = layout.sections.map((s) => ({
        ...s,
        blocks: s.blocks.map((b) =>
          b.id === blockId ? { ...b, config: { ...b.config, ...config } } : b,
        ),
      }));
      writeLayout({ sections });
    },
    [layout, writeLayout],
  );

  // ── Update theme overrides ──────────────────────────────────────────
  const handleUpdateThemeOverrides = useCallback(
    (overrides: any) => {
      if (!pageData) { toast.error("No page loaded"); return; }
      console.log(`[Studio] Saving theme overrides to page ${pageData.id}`);
      updateThemeOverrides.mutate(
        { pageId: pageData.id, overrides },
        {
          onSuccess: () => {
            console.log("[Studio] ✅ Theme overrides saved");
            refetchPage();
            toast.success("Theme updated");
          },
          onError: (err) => {
            console.error("[Studio] ❌ Theme override error:", err);
            toast.error(friendlyError(err, "Failed to save theme"));
          },
        },
      );
    },
    [pageData, updateThemeOverrides, refetchPage],
  );

  // ── Publish / Save Draft / Preview ────────────────────────────────────
  const handlePublish = useCallback(async () => {
    if (!pageData) { toast.error("No page to publish"); return; }
    try {
      await publishPage.mutateAsync({ pageId: pageData.id });
      toast.success("Published — visible to everyone");
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
      if (!pageData) { toast.error("No page loaded"); return; }
      console.log(`[Studio] Applying theme ${themeId} to page ${pageData.id}`);
      updateTheme.mutate(
        { pageId: pageData.id, themeId },
        {
          onSuccess: () => {
            console.log("[Studio] ✅ Theme applied, refetching");
            refetchPage();
            toast.success("Theme applied");
          },
          onError: (err) => {
            console.error("[Studio] ❌ Theme apply error:", err);
            toast.error(friendlyError(err, "Failed to apply theme"));
          },
        },
      );
    },
    [pageData, updateTheme, refetchPage],
  );

  // ── Apply template ────────────────────────────────────────────────────
  const handleApplyTemplate = useCallback(
    (templateId: string) => {
      if (!pageData || !activePage) { toast.error("No page loaded"); return; }
      console.log(`[Studio] Applying template ${templateId} to page ${pageData.id}`);
      toast.info("Applying template...");
      applyTemplate.mutate(
        {
          templateId, pageId: pageData.id, layoutId: pageData.layoutId,
          ownerId: activePage.id, ownerType: activePage.type,
        },
        {
          onSuccess: () => {
            console.log("[Studio] ✅ Template applied");
            refetchPage();
            toast.success("Template applied — page updated");
          },
          onError: (err) => {
            console.error("[Studio] ❌ Template apply error:", err);
            toast.error(friendlyError(err, "Failed to apply template"));
          },
        },
      );
    },
    [pageData, activePage, applyTemplate, refetchPage],
  );

  // ── Save as template ──────────────────────────────────────────────────
  const handleSaveAsTemplate = useCallback(
    (name: string, options?: { description?: string; category?: string }) => {
      if (!pageData) { toast.error("No page to save"); return; }
      if (!name.trim()) { toast.error("Enter a template name"); return; }
      console.log(`[Studio] Saving template "${name}" from layout ${pageData.layoutId}`);
      saveAsTemplate.mutate(
        { layoutId: pageData.layoutId, name, ...options },
        {
          onSuccess: () => {
            console.log("[Studio] ✅ Template published");
            toast.success(`"${name}" published as a template`);
            qc.invalidateQueries({ queryKey: ["templates"] });
          },
          onError: (err) => {
            console.error("[Studio] ❌ Save template error:", err);
            toast.error(friendlyError(err, "Failed to save template. Make sure you own this layout."));
          },
        },
      );
    },
    [pageData, saveAsTemplate, qc],
  );

  // ── Re-seed templates ────────────────────────────────────────────────
  const handleReseed = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any).rpc("reseed_default_templates");
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Templates refreshed");
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
        {
          onSuccess: () => {
            refetchPage();
            qc.invalidateQueries({ queryKey: ["templates"] });
            toast.success("Layout forked");
          },
          onError: (err) => toast.error(friendlyError(err, "Failed to fork")),
        },
      );
    },
    [activePage, forkLayout, refetchPage, qc],
  );

  // ── Page selection ────────────────────────────────────────────────────
  const handleSelectPage = useCallback((page: StudioPage) => {
    setActivePage(page);
    setSelectedBlockId(null);
    ensuringRef.current = false; // Reset so auto-create works for new page
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
                ✦ Studio: {profile.display_name ?? profile.handle ?? "My Profile"}
              </option>
            )}
            {projects.map((p) => (
              <option key={p.id} value={`project:${p.id}`}>
                📁 {p.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Device preview */}
          <div className="flex items-center rounded-md border border-border/30 bg-surface/50 p-0.5">
            {(["desktop", "tablet", "mobile"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setDevicePreview(key)}
                className={`rounded px-2 py-1 transition-colors ${
                  devicePreview === key ? "bg-surface-elevated text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label={`${key} preview`}
              >
                {key === "desktop" ? <Monitor className="h-3.5 w-3.5" /> : key === "tablet" ? <Tablet className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
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
              templatesLoading={templatesLoading}
              templatesError={templatesError}
              themes={themeCatalog}
              currentThemeId={pageData?.themeId ?? null}
            />
          )}
        </div>

        {/* Center canvas */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 justify-center overflow-y-auto bg-noise p-6">
            <div className={`w-full ${deviceClass} transition-all duration-200`}>
              {activePage ? (
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
              ) : (
                <div className="flex min-h-[50vh] items-center justify-center">
                  <div className="max-w-sm text-center">
                    <p className="text-sm text-muted-foreground">
                      {!profile && projects.length === 0
                        ? "Create a profile or project first to start customizing."
                        : "Select a page above to start editing."}
                    </p>
                  </div>
                </div>
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
              onUpdateBlockConfig={handleUpdateBlockConfig}
              onUpdateThemeOverrides={handleUpdateThemeOverrides}
              currentOverrides={pageData?.theme ?? null}
              themes={themeCatalog}
              currentThemeId={pageData?.themeId ?? null}
              onRefetch={refetchPage}
            />
          )}
        </div>
      </div>

      {/* ── Status bar ───────────────────────────────────────────────────── */}
      <StatusBar
        userId={userId}
        pageLoading={pageLoading}
        pageError={pageError}
        pageFetchError={pageFetchError as Error | null}
        pageData={pageData}
        blockCount={blockCount}
        templatesLoading={templatesLoading}
        templatesError={templatesError}
        templateCount={publicTemplates.length}
        createPending={createPage.isPending}
      />

      {/* ── Panel toggles ───────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed bottom-10 left-4 z-40 flex gap-2">
        <button
          type="button"
          onClick={() => setLeftOpen(!leftOpen)}
          className="pointer-events-auto rounded-md border border-border/40 bg-surface-elevated p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={leftOpen ? "Close sidebar" : "Open sidebar"}
        >
          {leftOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div className="pointer-events-none fixed bottom-10 right-4 z-40 flex gap-2">
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

// ── Status Bar ───────────────────────────────────────────────────────────────
// Shows real-time diagnostic info: auth, page state, block count, templates.

function StatusBar({
  userId, pageLoading, pageError, pageFetchError, pageData, blockCount,
  templatesLoading, templatesError, templateCount, createPending,
}: {
  userId: string;
  pageLoading: boolean;
  pageError: boolean;
  pageFetchError: Error | null;
  pageData: { id: string; layout?: { sections: any[] }; status: string; themeId: string } | null | undefined;
  blockCount: number;
  templatesLoading: boolean;
  templatesError: boolean;
  templateCount: number;
  createPending: boolean;
}) {
  const sectionCount = pageData?.layout?.sections?.length ?? 0;
  const blockInstanceCount = pageData?.layout?.sections?.reduce((sum: number, s: any) => sum + (s.blocks?.length ?? 0), 0) ?? 0;

  return (
    <div className="h-8 shrink-0 border-t border-border/20 bg-surface-elevated/20 px-4 flex items-center gap-4 text-[10px] text-muted-foreground">
      {/* Auth */}
      <span className="flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3 text-green-500" />
        Logged in
      </span>

      {/* Page */}
      {pageLoading || createPending ? (
        <span className="flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          {createPending ? "Creating page..." : "Loading page..."}
        </span>
      ) : pageError ? (
        <span className="flex items-center gap-1 text-red-400" title={pageFetchError?.message}>
          <AlertTriangle className="h-3 w-3" />
          Page error
        </span>
      ) : pageData ? (
        <span className="flex items-center gap-1" title={`ID: ${pageData.id}`}>
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          Page: {sectionCount}s · {blockInstanceCount}b · {pageData.status}
        </span>
      ) : (
        <span className="flex items-center gap-1 text-amber-400">
          <Loader2 className="h-3 w-3" />
          No page yet
        </span>
      )}

      <span className="text-border/40">|</span>

      {/* Blocks */}
      <span className={`flex items-center gap-1 ${blockCount === 0 ? "text-red-400" : ""}`}>
        {blockCount === 0 ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3 text-green-500" />}
        {blockCount} blocks
      </span>

      <span className="text-border/40">|</span>

      {/* Templates */}
      {templatesLoading ? (
        <span className="flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />Loading templates...
        </span>
      ) : templatesError ? (
        <span className="flex items-center gap-1 text-red-400">
          <AlertTriangle className="h-3 w-3" />Template error
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          {templateCount} templates
        </span>
      )}

      {/* Page ID indicator */}
      {pageData && (
        <>
          <span className="text-border/40">|</span>
          <span className="text-muted-foreground/40 font-mono truncate max-w-[200px]" title={pageData.id}>
            {pageData.id.slice(0, 8)}…
          </span>
        </>
      )}
    </div>
  );
}