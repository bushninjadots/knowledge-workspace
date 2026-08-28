// ── Creativity Studio ────────────────────────────────────────────────────────
// Three-column editing environment for profiles and projects.
// Owns all state and mutation wiring — children receive data + callbacks.
// Includes a status bar showing auth, page, registry, and template state to
// help users understand exactly what's happening.

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Monitor,
  Tablet,
  Smartphone,
  Eye,
  Save,
  Send,
  Undo2,
  Redo2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { EditModeProvider } from "@/components/tethyr/page/edit-mode-context";
import { createDefaultProfileLayout, createDefaultProjectLayout } from "@/lib/default-layouts";
import {
  useCreatePage,
  useUpdatePageLayout,
  usePublishPage,
  useUnpublishPage,
  useUpdateThemeOverrides,
} from "@/hooks/use-page-editor";
import { usePage } from "@/hooks/use-page";
import { useTheme } from "@/hooks/use-theme";
import { useThemeCatalog } from "@/hooks/use-theme-catalog";
import { useUpdatePageTheme } from "@/hooks/use-page-editor";
import { themeTokensToStyle, deepMergeTokens } from "@/lib/theme-tokens";
import { usePublicTemplates, useApplyTemplate, useSaveAsTemplate } from "@/hooks/use-templates";
import { useForkLayout } from "@/hooks/use-fork";
import { createBlockInstance, getBlock, blockPageScope } from "@/lib/block-registry";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { StudioSidebar } from "./studio-sidebar";
import { StudioCanvas, type BlockAddTarget } from "./studio-canvas";
import { StudioInspector } from "./studio-inspector";
import { SECTION_PRESETS, type SectionPreset } from "./section-presets";
import type {
  LayoutBlockInstance,
  LayoutSection,
  PageData,
  PageLayout,
  PageOwnerType,
  SectionLayoutType,
  ThemeTokens,
} from "@/lib/page-blocks";

export type StudioPage = {
  id: string;
  handle?: string;
  title: string;
  type: "profile" | "project";
};

export type SelectionType = "page" | "section" | "block";
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
    if (profile)
      return {
        id: profile.id,
        handle: profile.handle ?? undefined,
        title: profile.display_name ?? "My Studio",
        type: "profile",
      };
    if (projects.length > 0)
      return { id: projects[0].id, title: projects[0].title, type: "project" };
    return null;
  });

  const [devicePreview, setDevicePreview] = useState<DevicePreview>("desktop");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectionType, setSelectionType] = useState<SelectionType>("page");
  const [sidebarTab, setSidebarTab] = useState<string>("pages");
  const ensuringRef = useRef(false);

  // ── Draft editing state ───────────────────────────────────────────────
  // The Studio edits a local working copy of the layout. Every change (width,
  // text, reorder, visibility) updates the draft and the undo history
  // instantly — nothing touches the database until the user presses Save.
  // This replaces the old per-click mutation + refetch loop.
  const [draftLayout, setDraftLayout] = useState<PageLayout>({ sections: [] });
  const [pageProvisioning, setPageProvisioning] = useState(false);
  const [draftOverrides, setDraftOverrides] = useState<ThemeTokens | null>(null);
  const [history, setHistory] = useState<PageLayout[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [dirty, setDirty] = useState(false);
  const historyRef = useRef<PageLayout[]>([]);
  const historyIndexRef = useRef(-1);
  const dirtyRef = useRef(false);
  // Last-persisted state, for accurate dirty detection after undo/redo.
  const savedLayoutRef = useRef<PageLayout | null>(null);
  const savedOverridesRef = useRef<ThemeTokens | null>(null);
  // Tracks whether the user actually edited the theme this session. Theme
  // overrides only hit the DB on Save when this is true — otherwise a plain
  // layout save would persist the entire merged theme as overrides.
  const overridesDirtyRef = useRef(false);

  // When a page loads or the page selection changes, adopt the server layout
  // as the fresh draft and reset the undo history.
  const resetDraft = useCallback((layout: PageLayout, overrides: ThemeTokens | null = null) => {
    setDraftLayout(layout);
    setDraftOverrides(overrides);
    setHistory([layout]);
    setHistoryIndex(0);
    historyRef.current = [layout];
    historyIndexRef.current = 0;
    setDirty(false);
    dirtyRef.current = false;
    savedLayoutRef.current = layout;
    savedOverridesRef.current = overrides;
    overridesDirtyRef.current = false;
  }, []);

  // Track which page the draft belongs to so we only reset on page change,
  // not on every refetch (refetches after save return the same layout).
  const draftOwnerRef = useRef<string | null>(null);

  // ── Query data ────────────────────────────────────────────────────────
  const {
    data: pageData,
    isLoading: pageLoading,
    isError: pageError,
    refetch: refetchPage,
    error: pageFetchError,
  } = usePage({
    ownerId: activePage?.id ?? "",
    ownerType: (activePage?.type ?? "project") as PageOwnerType,
    // Studio is an authenticated owner surface: it must load the draft rather
    // than treating an existing unpublished page as missing.
    includeDraft: true,
  });

  // When a page loads or the page selection changes, adopt the server layout
  // as the fresh draft and reset the undo history.
  useEffect(() => {
    if (!pageData) return;
    if (draftOwnerRef.current !== pageData.id) {
      draftOwnerRef.current = pageData.id;
      resetDraft(pageData.layout ?? { sections: [] }, pageData.theme ?? null);
    }
  }, [pageData, resetDraft]);

  const { data: themeCatalog = [] } = useThemeCatalog();
  // Base theme CSS vars for the active page — identical to PageShell so the
  // canvas reflects exactly what the real studio page renders.
  const { data: themeVars = {} } = useTheme(pageData?.themeId);
  const canvasContainerStyle = useMemo(() => {
    const effectiveTheme = deepMergeTokens(pageData?.theme ?? {}, draftOverrides ?? {});
    return { ...themeVars, ...themeTokensToStyle(effectiveTheme) } as React.CSSProperties;
  }, [themeVars, pageData?.theme, draftOverrides]);
  const {
    data: publicTemplates = [],
    isLoading: templatesLoading,
    isError: templatesError,
    error: templateFetchError,
  } = usePublicTemplates({ sort: "popular" });

  // Active-owner data for data-driven blocks (project-hero, project-status,
  // …) so they resolve inside the editor instead of showing a loading or
  // empty state. Matches the `previewData` shape the preview routes pass.
  const { data: activeOwnerData } = useQuery({
    queryKey: ["studio-page-owner-data", activePage?.type ?? "", activePage?.id ?? ""],
    queryFn: async () => {
      if (!activePage?.id) return undefined;
      if (activePage.type === "project") {
        const select =
          "id, title, description, status, stage, progress_percent, cover_url, tags, looking_for_collaborators, looking_for_feedback";
        const [{ data: project, error: projectError }, { data: owner }] = await Promise.all([
          supabase.from("projects").select(select).eq("id", activePage.id).maybeSingle(),
          supabase.from("projects").select("profile_id").eq("id", activePage.id).maybeSingle(),
        ]);
        if (projectError) throw projectError;
        if (!project) return undefined;
        let ownerData: Record<string, unknown> = {};
        if (owner?.profile_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("id", owner.profile_id)
            .maybeSingle();
          ownerData = { ownerName: profile?.display_name, ownerAvatarUrl: profile?.avatar_url };
        }
        return { project, ...ownerData };
      }
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, banner_url")
        .eq("id", activePage.id)
        .maybeSingle();
      if (error) throw error;
      return profile ? { profile } : undefined;
    },
    enabled: !!activePage,
  });

  // Block registry diagnostic
  const [blockCount, setBlockCount] = useState(0);
  useEffect(() => {
    // Dynamic import to avoid circular deps
    import("@/lib/block-registry").then(({ getAllBlocks }) => {
      const count = getAllBlocks().length;
      setBlockCount(count);
      if (count === 0) {
        console.error(
          "[Studio] ⚠ ZERO blocks registered — block picker and renderer will be empty",
        );
        toast.error("Block system not loaded. Refresh the page.");
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
      setPageProvisioning(true);
      toast.info(`Creating default ${activePage.type} page...`);
      const layout =
        activePage.type === "profile" ? createDefaultProfileLayout() : createDefaultProjectLayout();
      createPage.mutate(
        { ownerId: activePage.id, ownerType: activePage.type, userId, defaultLayout: layout },
        {
          onSuccess: () => {
            setPageProvisioning(false);
            toast.success("Page created! You can now customize it.");
          },
          onError: (err) => {
            setPageProvisioning(false);
            ensuringRef.current = false;
            console.error("[Studio] ❌ Failed to auto-create page:", err);
            toast.error(
              friendlyError(
                err,
                "Failed to create your private Studio page. Check your session and try again.",
              ),
            );
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
    }
  }, [templatesLoading, templatesError, publicTemplates.length, templateFetchError]);

  // ── Layout helpers ────────────────────────────────────────────────────
  const isPublished = pageData?.status === "published";
  const studioMode = "Private draft" as const;
  const pageReady = !!pageData && !pageLoading && !pageProvisioning;
  const pageStatusLabel = pageLoading
    ? "Loading page"
    : pageProvisioning
      ? "Creating private draft"
      : pageError && !pageData
        ? "Page unavailable"
        : pageData
          ? isPublished
            ? "Editing private draft · published version live"
            : "Editing private draft · not published"
          : "Preparing private draft";

  // Apply an edit to the draft: update the layout, push the previous state
  // onto the undo stack (truncating any redo tail), and mark dirty.
  const applyDraft = useCallback((newLayout: PageLayout) => {
    // Normalize positions here, once, so every mutation (move, add, duplicate,
    // reorder, template apply) stays consistent. Renderers sort sections and
    // blocks by `position` — without reindexing, drag/move sequences would
    // render a stale order after a refetch.
    const normalized: PageLayout = {
      sections: newLayout.sections.map((section, i) => ({
        ...section,
        position: i,
        blocks: [...section.blocks].map((block, j): LayoutBlockInstance => ({
          ...block,
          position: j,
        })),
      })),
    };
    setDraftLayout(normalized);
    setDirty(true);
    dirtyRef.current = true;
    // Truncate redo tail, then push the new snapshot.
    const next = historyRef.current.slice(0, historyIndexRef.current + 1);
    next.push(normalized);
    // Cap history at 100 entries.
    if (next.length > 100) next.shift();
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
    setHistory(next);
    setHistoryIndex(next.length - 1);
  }, []);

  // Persist the draft (layout + theme overrides) to the database.
  const handleSave = useCallback(() => {
    if (!pageReady) {
      toast.info(
        pageProvisioning
          ? "Your private draft is still being created."
          : pageError
            ? "Your private draft could not be loaded. Try refreshing."
            : "Your private draft is still loading.",
      );
      return;
    }
    if (!dirtyRef.current) {
      toast.info("No unsaved changes");
      return;
    }
    updateLayout.mutate(
      { pageId: pageData.id, layoutId: pageData.layoutId, layout: draftLayout },
      {
        onSuccess: async () => {
          // Save theme overrides after layout save succeeds (not in parallel).
          if (overridesDirtyRef.current && draftOverrides != null) {
            try {
              await updateThemeOverrides.mutateAsync({
                pageId: pageData.id,
                overrides: draftOverrides,
              });
              overridesDirtyRef.current = false;
            } catch (themeErr) {
              toast.error(friendlyError(themeErr, "Failed to save theme"));
            }
          }
          setDirty(false);
          dirtyRef.current = false;
          savedLayoutRef.current = draftLayout;
          savedOverridesRef.current = draftOverrides ?? null;
          toast.success("Changes saved");
          await refetchPage();
        },
        onError: (err) => {
          toast.error(friendlyError(err, "Failed to save changes. Check if you own this page."));
        },
      },
    );
  }, [
    pageData,
    draftLayout,
    draftOverrides,
    updateLayout,
    updateThemeOverrides,
    refetchPage,
    pageError,
    pageProvisioning,
    pageReady,
  ]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Undo/redo restore a history snapshot. Mark the draft dirty only if the
  // restored state actually differs from what's persisted (so undoing back to
  // the saved state shows a clean "Saved" indicator instead of false "unsaved").
  const syncDirtyAfterHistory = useCallback(
    (layout: PageLayout) => {
      const equal =
        savedLayoutRef.current != null &&
        JSON.stringify(layout) === JSON.stringify(savedLayoutRef.current) &&
        JSON.stringify(draftOverrides ?? null) ===
          JSON.stringify(savedOverridesRef.current ?? null);
      setDirty(!equal);
      dirtyRef.current = !equal;
    },
    [draftOverrides],
  );

  const handleUndo = useCallback(() => {
    const idx = historyIndexRef.current - 1;
    if (idx < 0) return;
    historyIndexRef.current = idx;
    setHistoryIndex(idx);
    const restored = historyRef.current[idx];
    setDraftLayout(restored);
    syncDirtyAfterHistory(restored);
  }, [syncDirtyAfterHistory]);

  const handleRedo = useCallback(() => {
    const idx = historyIndexRef.current + 1;
    if (idx >= historyRef.current.length) return;
    historyIndexRef.current = idx;
    setHistoryIndex(idx);
    const restored = historyRef.current[idx];
    setDraftLayout(restored);
    syncDirtyAfterHistory(restored);
  }, [syncDirtyAfterHistory]);

  // ── Add block ─────────────────────────────────────────────────────────
  const handleAddBlock = useCallback(
    (blockType: string, target?: BlockAddTarget) => {
      if (!pageReady) {
        toast.info(
          pageProvisioning
            ? "Your private draft is still being created."
            : "Your private draft is still loading.",
        );
        return;
      }
      const inst = createBlockInstance(blockType);
      if (!inst) {
        console.warn(`[Studio] ❌ createBlockInstance returned null for "${blockType}"`);
        toast.error(
          `Block type "${blockType}" not registered. Total blocks: ${blockCount}. Try refreshing.`,
        );
        return;
      }
      const existing = draftLayout.sections;
      const sections = existing.map((s: LayoutSection) => ({ ...s, blocks: [...s.blocks] }));
      const targetSection = target ? sections.find((s) => s.id === target.sectionId) : undefined;
      let last = targetSection
        ? { ...targetSection, blocks: [...targetSection.blocks] }
        : sections[sections.length - 1];
      if (!last) {
        last = { id: `sect_${Date.now()}`, position: 0, layout: "full", blocks: [] };
        sections.push(last);
      }
      const col = targetSection ? target?.column : undefined;
      const colBlocks = col != null ? last.blocks.filter((b) => b.column === col) : last.blocks;
      const newBlock = {
        id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: inst.type,
        position: colBlocks.length,
        config: { ...inst.config } as Record<string, unknown>,
        visible: true,
        ...(col != null ? { column: col } : {}),
      };
      const targetIndex = targetSection
        ? sections.findIndex((s) => s.id === targetSection.id)
        : sections.length - 1;
      sections[targetIndex] = { ...last, blocks: [...last.blocks, newBlock] };
      toast.success(`Added ${inst.type.replace(/-/g, " ")}`);
      applyDraft({ sections });
      setSelectionType("block");
      setSelectedBlockId(newBlock.id);
    },
    [applyDraft, draftLayout, pageReady, pageProvisioning, blockCount],
  );

  // ── Remove block ──────────────────────────────────────────────────────
  const handleRemoveBlock = useCallback(
    (blockId: string) => {
      const sections = draftLayout.sections
        .map((s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== blockId) }))
        .filter((s) => s.blocks.length > 0);
      applyDraft({ sections });
      if (selectedBlockId === blockId) {
        setSelectionType("page");
        setSelectedBlockId(null);
        setSelectedSectionId(null);
      }
    },
    [draftLayout, applyDraft, selectedBlockId],
  );

  // ── Toggle visibility ─────────────────────────────────────────────────
  const handleToggleVisibility = useCallback(
    (blockId: string) => {
      const sections = draftLayout.sections.map((s) => ({
        ...s,
        blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, visible: !b.visible } : b)),
      }));
      applyDraft({ sections });
    },
    [draftLayout, applyDraft],
  );

  // ── Move block ────────────────────────────────────────────────────────
  const handleMoveBlock = useCallback(
    (blockId: string, direction: "up" | "down") => {
      const sections = draftLayout.sections.map((s) => ({ ...s, blocks: [...s.blocks] }));
      for (const section of sections) {
        const idx = section.blocks.findIndex((b) => b.id === blockId);
        if (idx === -1) continue;
        const newIdx = direction === "up" ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= section.blocks.length) return;
        const [moved] = section.blocks.splice(idx, 1);
        section.blocks.splice(newIdx, 0, moved);
        break;
      }
      applyDraft({ sections });
    },
    [draftLayout, applyDraft],
  );

  // ── Drag reorder blocks ────────────────────────────────────────────────
  const handleReorderBlocks = useCallback(
    (sectionId: string, blockId: string, targetIndex: number) => {
      const sections = draftLayout.sections.map((s) => ({ ...s, blocks: [...s.blocks] }));
      for (const section of sections) {
        const idx = section.blocks.findIndex((b) => b.id === blockId);
        if (idx === -1) continue;
        const [moved] = section.blocks.splice(idx, 1);
        const clampedTarget = Math.min(targetIndex, section.blocks.length);
        section.blocks.splice(clampedTarget, 0, moved);
        break;
      }
      applyDraft({ sections });
    },
    [draftLayout, applyDraft],
  );

  // ── Guided recipes ───────────────────────────────────────────────────
  const handleApplyRecipe = useCallback(
    (recipeId: string) => {
      const recipeSections: Record<string, SectionPreset[]> = {
        showcase: [
          SECTION_PRESETS.find((p) => p.id === "hero")!,
          SECTION_PRESETS.find((p) => p.id === "one-column")!,
        ],
        collaborate: [
          SECTION_PRESETS.find((p) => p.id === "hero")!,
          SECTION_PRESETS.find((p) => p.id === "two-columns")!,
        ],
        document: [
          SECTION_PRESETS.find((p) => p.id === "one-column")!,
          SECTION_PRESETS.find((p) => p.id === "two-row")!,
        ],
      };
      const presets = recipeSections[recipeId];
      if (!presets?.length || !pageReady) return;
      const sections = presets.map((preset, index) => ({
        id: `sect_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
        position: index,
        layout: preset.layout,
        blocks: (preset.starterBlocks ?? []).map((starter, blockIndex) => {
          const instance = createBlockInstance(starter.type);
          return {
            id: `blk_${Date.now()}_${index}_${blockIndex}`,
            type: starter.type,
            position: blockIndex,
            config: { ...(instance?.config ?? {}), ...(starter.config ?? {}) } as Record<
              string,
              unknown
            >,
            visible: true,
          };
        }),
      }));
      applyDraft({ sections });
      setSelectionType("page");
      setSelectedBlockId(null);
      setSelectedSectionId(null);
      toast.success("Starting layout added — make it yours");
    },
    [applyDraft, pageReady],
  );

  // ── Add section ──────────────────────────────────────────────────────
  const handleAddSection = useCallback(
    (preset: SectionPreset) => {
      if (!pageReady) {
        toast.info(
          pageProvisioning
            ? "Your private draft is still being created."
            : "Your private draft is still loading.",
        );
        return;
      }
      const pageType = activePage?.type === "profile" ? "profile" : "project";
      const newBlocks = (preset.starterBlocks ?? [])
        .filter((sb) => blockPageScope(sb.type) === "both" || blockPageScope(sb.type) === pageType)
        .map((sb, i) => {
          const inst = createBlockInstance(sb.type);
          return {
            id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: sb.type,
            position: i,
            config: { ...(inst?.config ?? {}), ...(sb.config ?? {}) } as Record<string, unknown>,
            visible: true,
          };
        });
      const newSection: LayoutSection = {
        id: `sect_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        position: draftLayout.sections.length,
        layout: preset.layout,
        blocks: newBlocks,
      };
      const sections = [...draftLayout.sections, newSection];
      applyDraft({ sections });
      setSelectionType("section");
      setSelectedSectionId(newSection.id);
      setSelectedBlockId(null);
      toast.success(`Added ${preset.label} section`);
    },
    [applyDraft, draftLayout, pageReady, pageProvisioning, activePage],
  );

  // ── Remove section ──────────────────────────────────────────────────────
  const handleRemoveSection = useCallback(
    (sectionId: string) => {
      const sections = draftLayout.sections.filter((s) => s.id !== sectionId);
      applyDraft({ sections });
      if (selectedSectionId === sectionId) {
        setSelectionType("page");
        setSelectedSectionId(null);
      }
    },
    [draftLayout, applyDraft, selectedSectionId],
  );

  // ── Move section ─────────────────────────────────────────────────────────
  const handleMoveSection = useCallback(
    (sectionId: string, direction: "up" | "down") => {
      const sections = draftLayout.sections.map((s) => ({ ...s, blocks: [...s.blocks] }));
      const idx = sections.findIndex((s) => s.id === sectionId);
      if (idx === -1) return;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= sections.length) return;
      const [moved] = sections.splice(idx, 1);
      sections.splice(newIdx, 0, moved);
      applyDraft({ sections });
    },
    [draftLayout, applyDraft],
  );

  // ── Update section layout ────────────────────────────────────────────────
  const handleUpdateSectionLayout = useCallback(
    (sectionId: string, layout: SectionLayoutType) => {
      const sections = draftLayout.sections.map((s) => (s.id === sectionId ? { ...s, layout } : s));
      applyDraft({ sections });
    },
    [draftLayout, applyDraft],
  );

  // ── Duplicate section ──────────────────────────────────────────────────
  const handleDuplicateSection = useCallback(
    (sectionId: string) => {
      const idx = draftLayout.sections.findIndex((s) => s.id === sectionId);
      if (idx === -1) return;
      const original = draftLayout.sections[idx];
      const clone: LayoutSection = {
        id: `sect_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        position: idx + 1,
        layout: original.layout,
        blocks: original.blocks.map((b) => ({
          ...b,
          id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          config: { ...b.config },
        })),
      };
      const sections = [...draftLayout.sections];
      sections.splice(idx + 1, 0, clone);
      applyDraft({ sections });
      setSelectionType("section");
      setSelectedSectionId(clone.id);
      toast.success("Section duplicated");
    },
    [draftLayout, applyDraft],
  );

  // ── Duplicate block ──────────────────────────────────────────────────────
  const handleDuplicateBlock = useCallback(
    (blockId: string) => {
      const sections = draftLayout.sections.map((s) => ({ ...s, blocks: [...s.blocks] }));
      for (const section of sections) {
        const idx = section.blocks.findIndex((b) => b.id === blockId);
        if (idx === -1) continue;
        const original = section.blocks[idx];
        const clone = {
          ...original,
          id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          config: { ...original.config },
        };
        section.blocks.splice(idx + 1, 0, clone);
        applyDraft({ sections });
        setSelectionType("block");
        setSelectedBlockId(clone.id);
        toast.success("Block duplicated");
        return;
      }
    },
    [draftLayout, applyDraft],
  );

  // ── Update block config ──────────────────────────────────────────────
  const handleUpdateBlockConfig = useCallback(
    (blockId: string, config: Record<string, unknown>) => {
      const sections = draftLayout.sections.map((s) => ({
        ...s,
        blocks: s.blocks.map((b) =>
          b.id === blockId ? { ...b, config: { ...b.config, ...config } } : b,
        ),
      }));
      applyDraft({ sections });
    },
    [draftLayout, applyDraft],
  );

  // ── Update block instance (column, span, etc.) ─────────────────────
  const handleUpdateBlock = useCallback(
    (blockId: string, updates: Partial<LayoutBlockInstance>) => {
      const sections = draftLayout.sections.map((s) => ({
        ...s,
        blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, ...updates } : b)),
      }));
      applyDraft({ sections });
    },
    [draftLayout, applyDraft],
  );

  // ── Update theme overrides ──────────────────────────────────────────
  // Local-only: edits land in the draft and persist on Save, matching the
  // layout editing model instead of writing to the DB on every slider move.
  const handleUpdateThemeOverrides = useCallback((overrides: ThemeTokens | null) => {
    setDraftOverrides(overrides);
    setDirty(true);
    dirtyRef.current = true;
    overridesDirtyRef.current = true;
  }, []);

  const handleApplyThemeOverrides = useCallback(
    (overrides: ThemeTokens) => {
      const merged = deepMergeTokens(draftOverrides ?? {}, overrides);
      handleUpdateThemeOverrides(merged);
      toast.success("Theme preview updated — save when ready");
    },
    [draftOverrides, handleUpdateThemeOverrides],
  );

  // ── Publish / Save Draft / Preview ────────────────────────────────────
  const handlePublish = useCallback(async () => {
    if (!pageData) {
      toast.error("No page to publish");
      return;
    }
    // Save any unsaved draft edits before publishing so the live page
    // reflects what the user sees in the Studio.
    if (dirtyRef.current) {
      try {
        await updateLayout.mutateAsync({
          pageId: pageData.id,
          layoutId: pageData.layoutId,
          layout: draftLayout,
        });
        if (overridesDirtyRef.current && draftOverrides != null) {
          await updateThemeOverrides.mutateAsync({
            pageId: pageData.id,
            overrides: draftOverrides,
          });
          overridesDirtyRef.current = false;
        }
        setDirty(false);
        dirtyRef.current = false;
      } catch (err) {
        toast.error(friendlyError(err, "Failed to save changes before publishing"));
        return;
      }
    }
    try {
      await publishPage.mutateAsync({ pageId: pageData.id });
      // Invalidate ALL page-related queries so the public profile page
      // picks up the fresh layout immediately (not just the Studio's query).
      qc.invalidateQueries({ queryKey: ["page"] });
      qc.invalidateQueries({ queryKey: ["public-profile"] });
      qc.invalidateQueries({ queryKey: ["profile-page"] });
      await refetchPage();
      toast.success("Published — visible to everyone");
    } catch (err) {
      toast.error(friendlyError(err, "Failed to publish"));
    }
  }, [
    pageData,
    draftLayout,
    draftOverrides,
    publishPage,
    updateLayout,
    updateThemeOverrides,
    refetchPage,
    qc,
  ]);

  const handleUnpublish = useCallback(async () => {
    if (!pageData) return;
    try {
      await unpublishPage.mutateAsync({ pageId: pageData.id });
      toast.success("Reverted to draft");
      await refetchPage();
    } catch (err) {
      toast.error(friendlyError(err, "Failed to unpublish"));
    }
  }, [pageData, unpublishPage, refetchPage]);

  // Persist the working copy when it has unsaved edits, and always hand the
  // exact draft (layout + theme) to the preview route via sessionStorage.
  // Every preview surface — Private and Public for both profiles and projects —
  // reads this same payload, so a preview always renders exactly what the
  // Studio canvas shows, even when the draft is unchanged since the last save.
  const saveBeforePreview = useCallback(async () => {
    if (!pageData) return true;
    try {
      if (dirtyRef.current) {
        await updateLayout.mutateAsync({
          pageId: pageData.id,
          layoutId: pageData.layoutId,
          layout: draftLayout,
        });
        if (overridesDirtyRef.current && draftOverrides != null) {
          await updateThemeOverrides.mutateAsync({
            pageId: pageData.id,
            overrides: draftOverrides,
          });
          overridesDirtyRef.current = false;
        }
        setDirty(false);
        dirtyRef.current = false;
        savedLayoutRef.current = draftLayout;
        savedOverridesRef.current = draftOverrides ?? null;
      }
      if (typeof window !== "undefined") {
        // Carry the full effective theme (base tokens merged with the manual
        // overrides) so previews never fall back to a partial token set.
        sessionStorage.setItem(
          `tethyr:studio-preview:${activePage?.type}:${activePage?.id}`,
          JSON.stringify({
            layout: draftLayout,
            theme: deepMergeTokens(pageData.theme ?? {}, draftOverrides ?? {}),
            pageId: pageData.id,
            ownerId: activePage?.id ?? "",
            ownerType: activePage?.type ?? "project",
          }),
        );
      }
      return true;
    } catch (err) {
      toast.error(friendlyError(err, "Failed to save changes before preview"));
      return false;
    }
  }, [
    activePage?.id,
    activePage?.type,
    pageData,
    draftLayout,
    draftOverrides,
    updateLayout,
    updateThemeOverrides,
  ]);

  const handlePreview = useCallback(async () => {
    if (!activePage || !pageReady || !(await saveBeforePreview())) return;
    if (activePage.type === "profile") {
      navigate({
        to: "/u/$handle",
        params: { handle: activePage.handle ?? activePage.id },
        search: { preview: "public", from: "studio" },
      });
    } else {
      navigate({
        to: "/projects/$id",
        params: { id: activePage.id },
        search: { preview: "public" },
      });
    }
  }, [activePage, navigate, pageReady, saveBeforePreview]);

  const handlePrivatePreview = useCallback(async () => {
    if (!activePage || !pageReady || !(await saveBeforePreview())) return;
    if (activePage.type === "profile") {
      navigate({ to: "/profile", search: { preview: "private", from: "studio" } });
    } else {
      navigate({
        to: "/projects/$id",
        params: { id: activePage.id },
        search: { preview: "private", from: "studio" },
      });
    }
  }, [activePage, navigate, pageReady, saveBeforePreview]);

  // ── Apply theme ───────────────────────────────────────────────────────
  const handleApplyTheme = useCallback(
    (themeId: string) => {
      if (!pageData) {
        toast.error("No page loaded");
        return;
      }
      updateTheme.mutate(
        { pageId: pageData.id, themeId },
        {
          onSuccess: async () => {
            // Adopt the fresh merged theme so the theme editor and dirty
            // detection track the newly applied theme, not the stale draft.
            const fresh = await refetchPage();
            const data = fresh?.data ?? pageData;
            if (data) {
              setDraftOverrides(data.theme ?? null);
              savedOverridesRef.current = data.theme ?? null;
              overridesDirtyRef.current = false;
            }
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
      if (!pageData || !activePage) {
        toast.error("No page loaded");
        return;
      }
      toast.info("Applying template...");
      applyTemplate.mutate(
        {
          templateId,
          pageId: pageData.id,
          layoutId: pageData.layoutId,
          ownerId: activePage.id,
          ownerType: activePage.type,
        },
        {
          onSuccess: async () => {
            // Deterministically adopt the server's freshly applied layout as
            // the new draft (refetch resolves with the updated page data).
            const fresh = await refetchPage();
            const data = fresh?.data ?? pageData;
            if (data) {
              draftOwnerRef.current = data.id;
              resetDraft(data.layout ?? { sections: [] }, data.theme ?? null);
            }
            toast.success("Template applied — page updated");
          },
          onError: (err) => {
            console.error("[Studio] ❌ Template apply error:", err);
            toast.error(friendlyError(err, "Failed to apply template"));
          },
        },
      );
    },
    [pageData, activePage, applyTemplate, refetchPage, resetDraft],
  );

  // ── Save as template ──────────────────────────────────────────────────
  const handleSaveAsTemplate = useCallback(
    (name: string, options?: { description?: string; category?: string }) => {
      if (!pageData) {
        toast.error("No page to save");
        return;
      }
      if (!name.trim()) {
        toast.error("Enter a template name");
        return;
      }
      saveAsTemplate.mutate(
        { layoutId: pageData.layoutId, name, ...options },
        {
          onSuccess: () => {
            toast.success(`"${name}" published as a template`);
            qc.invalidateQueries({ queryKey: ["templates"] });
          },
          onError: (err) => {
            console.error("[Studio] ❌ Save template error:", err);
            toast.error(
              friendlyError(err, "Failed to save template. Make sure you own this layout."),
            );
          },
        },
      );
    },
    [pageData, saveAsTemplate, qc],
  );

  // ── Re-seed templates ────────────────────────────────────────────────
  const handleReseed = useCallback(async () => {
    try {
      const { error } = await supabase.rpc("reseed_default_templates");
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
            // A fork creates an independent copy owned by the user; it does
            // NOT change the current page's layout, so the draft stays put
            // (including any unsaved edits).
            qc.invalidateQueries({ queryKey: ["templates"] });
          },
          onError: (err) => toast.error(friendlyError(err, "Failed to fork")),
        },
      );
    },
    [activePage, forkLayout, qc],
  );

  // ── Page selection ────────────────────────────────────────────────────
  const handleSelectPage = useCallback((page: StudioPage) => {
    setActivePage(page);
    setSelectionType("page");
    setSelectedBlockId(null);
    setSelectedSectionId(null);
    ensuringRef.current = false; // Reset so auto-create works for new page
  }, []);

  // ── Device class ──────────────────────────────────────────────────────
  const deviceClass = useMemo(() => {
    switch (devicePreview) {
      case "mobile":
        return "max-w-[375px]";
      case "tablet":
        return "max-w-[768px]";
      default:
        return "max-w-full";
    }
  }, [devicePreview]);

  // ── Selection helpers ─────────────────────────────────────────────────
  const blocks = draftLayout.sections.flatMap((s) => s.blocks);
  const selectedBlock = selectedBlockId
    ? (blocks.find((b) => b.id === selectedBlockId) ?? null)
    : null;
  const selectedSection = selectedSectionId
    ? (draftLayout.sections.find((s) => s.id === selectedSectionId) ?? null)
    : null;

  const handleSelectPageLevel = useCallback(() => {
    setSelectionType("page");
    setSelectedBlockId(null);
    setSelectedSectionId(null);
  }, []);

  const handleSelectSection = useCallback((sectionId: string) => {
    setSelectionType("section");
    setSelectedBlockId(null);
    setSelectedSectionId(sectionId);
  }, []);

  const handleSelectBlock = useCallback(
    (blockId: string) => {
      setSelectionType("block");
      setSelectedBlockId(blockId);
      // Also track which section the block belongs to.
      for (const section of draftLayout.sections) {
        if (section.blocks.some((b) => b.id === blockId)) {
          setSelectedSectionId(section.id);
          break;
        }
      }
    },
    [draftLayout],
  );

  // Keyboard shortcuts: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo,
  // Ctrl/Cmd+S save, Escape deselect. Ignore when typing in inputs.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      // Escape: deselect everything → page selection
      if (e.key === "Escape") {
        handleSelectPageLevel();
        return;
      }
      // Delete / Backspace: remove selected block or section
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectionType === "block" && selectedBlockId) {
          handleRemoveBlock(selectedBlockId);
        } else if (selectionType === "section" && selectedSectionId) {
          handleRemoveSection(selectedSectionId);
        }
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (key === "y") {
        e.preventDefault();
        handleRedo();
      } else if (key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    handleUndo,
    handleRedo,
    handleSave,
    handleSelectPageLevel,
    handleRemoveBlock,
    handleRemoveSection,
    selectionType,
    selectedBlockId,
    selectedSectionId,
  ]);

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
                handleSelectPage({
                  id: profile.id,
                  handle: profile.handle ?? undefined,
                  title: profile.display_name ?? "My Studio",
                  type: "profile",
                });
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
                  devicePreview === key
                    ? "bg-surface-elevated text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label={`${key} preview`}
              >
                {key === "desktop" ? (
                  <Monitor className="h-3.5 w-3.5" />
                ) : key === "tablet" ? (
                  <Tablet className="h-3.5 w-3.5" />
                ) : (
                  <Smartphone className="h-3.5 w-3.5" />
                )}
              </button>
            ))}
          </div>
          <span className="h-4 w-px bg-border/40" aria-hidden="true" />
          {/* The canvas always renders the selected owner's working copy. */}
          <span
            className="hidden text-[9px] text-muted-foreground/60 select-none sm:inline"
            title="Editing: private draft. Public preview renders the saved draft as a visitor."
            data-studio-mode="private-draft"
          >
            {studioMode}
          </span>
          <span className="h-4 w-px bg-border/40" aria-hidden="true" />
          {/* Undo / Redo */}
          <div className="flex items-center rounded-md border border-border/30 bg-surface/50 p-0.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              className="rounded px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
              aria-label="Undo (Ctrl+Z)"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              className="rounded px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
              aria-label="Redo (Ctrl+Shift+Z)"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Save with dirty indicator */}{" "}
          <Button
            variant={dirty ? "outline" : "ghost"}
            aria-label={`${dirty ? "Save private draft changes" : "Private draft saved"}`}

            size="sm"
            className={`h-7 gap-1.5 text-[11px] ${dirty ? "border-primary/40 text-primary" : ""}`}
            onClick={handleSave}
            disabled={updateLayout.isPending}
            title={dirty ? "Save changes (Ctrl+S)" : "No unsaved changes"}
          >
            {dirty && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
                aria-hidden="true"
              />
            )}
            <Save className="h-3.5 w-3.5" />
            {updateLayout.isPending ? "Saving…" : dirty ? "Save" : "Saved"}
          </Button>
          {/* Status badge */}{" "}
          <span className="sr-only" role="status" aria-live="polite">
            {pageStatusLabel}
          </span>
          <span
            className={`hidden items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium sm:inline-flex ${
              isPublished
                ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
            }`}
            title={
              isPublished
                ? "Private draft is being edited. Published version is live and visible to everyone."
                : "Private draft is being edited. It is not visible publicly until you publish."
            }
            aria-label={pageStatusLabel}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${isPublished ? "bg-emerald-500" : "bg-amber-500"}`}
            />
            {isPublished ? "Published" : "Draft"}
          </span>
          {isPublished ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-[11px]"
              onClick={handleUnpublish}
            >
              Unpublish
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="hidden h-7 gap-1.5 text-[11px] md:inline-flex"
            onClick={handlePrivatePreview}
          >
            <Eye className="h-3.5 w-3.5" /> Private preview
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-[11px]"
            onClick={handlePreview}
          >
            <Eye className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Public </span>Preview
          </Button>
          {!isPublished && (
            <Button
              variant="default"
              size="sm"
              className="h-7 gap-1.5 text-[11px]"
              onClick={handlePublish}
              disabled={publishPage.isPending || updateLayout.isPending}
            >
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
              onAddSection={handleAddSection}
              onApplyRecipe={handleApplyRecipe}
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
            <div
              className={`w-full ${deviceClass} bg-background font-sans text-foreground transition-all duration-200`}
              style={canvasContainerStyle}
              data-studio-preview="private-draft"
              aria-label={`${activePage?.type === "profile" ? "Private Studio" : "Private project"} draft preview`}
            >
              {activePage ? (
                <EditModeProvider>
                  <StudioCanvas
                    page={activePage}
                    pageData={pageData}
                    layout={draftLayout}
                    contextData={activeOwnerData}
                    pageLoading={pageLoading}
                    pageError={pageError}
                    selectionType={selectionType}
                    selectedBlockId={selectedBlockId}
                    selectedSectionId={selectedSectionId}
                    onSelectBlock={handleSelectBlock}
                    onSelectSection={handleSelectSection}
                    onSelectPage={handleSelectPageLevel}
                    onRemoveBlock={handleRemoveBlock}
                    onRemoveSection={handleRemoveSection}
                    onToggleVisibility={handleToggleVisibility}
                    onMoveBlock={handleMoveBlock}
                    onReorderBlocks={handleReorderBlocks}
                    onAddBlock={handleAddBlock}
                    onAddSection={handleAddSection}
                    onUpdateBlockConfig={handleUpdateBlockConfig}
                    onDuplicateBlock={handleDuplicateBlock}
                    onLayoutChange={applyDraft}
                    onRefetch={refetchPage}
                    devicePreview={devicePreview}
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
              selectionType={selectionType}
              selectedBlock={selectedBlock}
              selectedBlockDef={selectedBlock ? getBlock(selectedBlock.type) : undefined}
              selectedSection={selectedSection}
              pageData={pageData}
              onMoveBlock={handleMoveBlock}
              onRemoveBlock={handleRemoveBlock}
              onRemoveSection={handleRemoveSection}
              onMoveSection={handleMoveSection}
              onDuplicateSection={handleDuplicateSection}
              onUpdateBlockConfig={handleUpdateBlockConfig}
              onUpdateBlock={handleUpdateBlock}
              onUpdateSectionLayout={handleUpdateSectionLayout}
              onUpdateThemeOverrides={handleUpdateThemeOverrides}
              onApplyThemeOverrides={handleApplyThemeOverrides}
              currentOverrides={draftOverrides ?? pageData?.theme ?? null}
              themes={themeCatalog}
              currentThemeId={pageData?.themeId ?? null}
              onSelectBlock={handleSelectBlock}
              onRefetch={refetchPage}
            />
          )}
        </div>
      </div>

      {/* ── Status bar ───────────────────────────────────────────────────── */}
      <StatusBar
        pageLoading={pageLoading}
        pageError={pageError}
        pageFetchError={pageFetchError as Error | null}
        pageData={pageData}
        layout={draftLayout}
        dirty={dirty}
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
          {leftOpen ? (
            <PanelLeftClose className="h-3.5 w-3.5" />
          ) : (
            <PanelLeftOpen className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <div className="pointer-events-none fixed bottom-10 right-4 z-40 flex gap-2">
        <button
          type="button"
          onClick={() => setRightOpen(!rightOpen)}
          className="pointer-events-auto rounded-md border border-border/40 bg-surface-elevated p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={rightOpen ? "Close inspector" : "Open inspector"}
        >
          {rightOpen ? (
            <PanelRightClose className="h-3.5 w-3.5" />
          ) : (
            <PanelRightOpen className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

// ── Status Bar ───────────────────────────────────────────────────────────────
// Shows real-time diagnostic info: auth, page state, block count, templates.

function StatusBar({
  pageLoading,
  pageError,
  pageFetchError,
  pageData,
  layout,
  dirty,
  blockCount,
  templatesLoading,
  templatesError,
  templateCount,
  createPending,
}: {
  pageLoading: boolean;
  pageError: boolean;
  pageFetchError: Error | null;
  pageData: PageData | null | undefined;
  layout: PageLayout;
  dirty: boolean;
  blockCount: number;
  templatesLoading: boolean;
  templatesError: boolean;
  templateCount: number;
  createPending: boolean;
}) {
  const sectionCount = layout.sections.length;
  const blockInstanceCount = layout.sections.reduce(
    (sum: number, s: LayoutSection) => sum + (s.blocks?.length ?? 0),
    0,
  );

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
          {dirty && (
            <span className="flex items-center gap-1 text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              unsaved
            </span>
          )}
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
        {blockCount === 0 ? (
          <AlertTriangle className="h-3 w-3" />
        ) : (
          <CheckCircle2 className="h-3 w-3 text-green-500" />
        )}
        {blockCount} blocks
      </span>

      <span className="text-border/40">|</span>

      {/* Templates */}
      {templatesLoading ? (
        <span className="flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading templates...
        </span>
      ) : templatesError ? (
        <span className="flex items-center gap-1 text-red-400">
          <AlertTriangle className="h-3 w-3" />
          Template error
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
          <span
            className="text-muted-foreground/40 font-mono truncate max-w-[200px]"
            title={pageData.id}
          >
            {pageData.id.slice(0, 8)}…
          </span>
        </>
      )}
    </div>
  );
}
