import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabasePending } from "@/lib/supabase-pending-schema";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./use-current-user";
import { ilikeOrFilter, SEARCH_MIN_LENGTH } from "@/lib/search";
import { sanitizeFilename, validateLibraryFile } from "@/lib/validators";
import { parseGithubSource, type GithubSource } from "@/lib/github-source";

/* ───────── Types ───────── */

export type LibraryItem = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: "note" | "document" | "link" | "upload";
  collection_id: string | null;
  url: string | null;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
  thumbnail_url: string | null;
  is_pinned: boolean;
  is_favorite: boolean;
  /** World-readable when true (RLS: `shared = true` grants public SELECT). */
  shared: boolean;
  project_id: string | null;
  reading_progress: number;
  content_format: "html" | "markdown";
  github_source: GithubSource | null;
  created_at: string;
  updated_at: string;
};

export type LibraryCollection = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  parent_id: string | null;
  position: number;
  /** World-readable when true (items inside become public too). */
  shared: boolean;
  created_at: string;
  updated_at: string;
};

type LibraryTag = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
};

type LibraryItemWithTags = LibraryItem & {
  tags: LibraryTag[];
  collection?: LibraryCollection | null;
};

type LibraryFilter = {
  type?: LibraryItem["type"];
  collection_id?: string;
  tag_id?: string;
  is_favorite?: boolean;
  is_pinned?: boolean;
  search?: string;
};

/* ───────── Query Keys ───────── */

/* ───────── Boards (kanban) ───────── */

export type LibraryBoard = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  position: number;
  created_at: string;
  updated_at: string;
};

export type LibraryBoardColumn = {
  id: string;
  board_id: string;
  user_id: string;
  name: string;
  position: number;
  is_done: boolean;
  wip_limit: number | null;
  created_at: string;
};

/** A member-defined field value on a card — free-form JSONB at rest. */
type LibraryCardFieldValue =
  string | number | boolean | null | string[] | { text: string; checked: boolean }[];

export type LibraryBoardCard = {
  id: string;
  board_id: string;
  column_id: string;
  user_id: string;
  title: string;
  /** When set, the card wraps an existing library item and links to it. */
  item_id: string | null;
  position: number;
  fields: Record<string, LibraryCardFieldValue>;
  accent: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

/** A board ready to render: columns and cards bundled. */
export type LibraryBoardData = {
  board: LibraryBoard;
  columns: LibraryBoardColumn[];
  cards: LibraryBoardCard[];
};

export const libraryKeys = {
  all: ["library"] as const,
  items: () => [...libraryKeys.all, "items"] as const,
  sharedItem: (id: string) => [...libraryKeys.all, "shared", id] as const,
  boards: () => [...libraryKeys.all, "boards"] as const,
  board: (id: string) => [...libraryKeys.boards(), id] as const,
  item: (id: string) => [...libraryKeys.items(), id] as const,
  collections: () => [...libraryKeys.all, "collections"] as const,
  tags: () => [...libraryKeys.all, "tags"] as const,
  versions: (itemId: string) => [...libraryKeys.all, "versions", itemId] as const,
  search: (query: string) => [...libraryKeys.all, "search", query] as const,
};

/* ───────── Items ───────── */

// Rows come back with content_format as a plain string and github_source as
// raw JSONB; normalize both so consumers always see the validated shape.
function normalizeItem<T>(item: T): T {
  const row = item as Record<string, unknown>;
  return {
    ...item,
    content_format: row.content_format === "markdown" ? "markdown" : "html",
    github_source: parseGithubSource(row.github_source),
  } as T;
}

export function useLibraryItems(filters?: LibraryFilter) {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;

  return useQuery({
    queryKey: [...libraryKeys.items(), filters],
    enabled: !!userId,
    queryFn: async (): Promise<LibraryItem[]> => {
      if (!userId) return [];
      let query = supabasePending
        .from("library_items")
        .select("*")
        .eq("user_id", userId)
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false });

      if (filters?.type) query = query.eq("type", filters.type);
      if (filters?.collection_id) query = query.eq("collection_id", filters.collection_id);
      if (filters?.is_favorite) query = query.eq("is_favorite", true);
      if (filters?.is_pinned) query = query.eq("is_pinned", true);
      if (filters?.search) {
        query = query.or(ilikeOrFilter(["title", "content"], filters.search));
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return (data ?? []).map(normalizeItem) as LibraryItem[];
    },
  });
}

/**
 * Library items linked to a project — visible to the project's team. Used on
 * the project page to surface a project's notes, docs, links, and uploads.
 */
export function useProjectLibraryItems(projectId: string | null) {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;

  return useQuery({
    queryKey: [...libraryKeys.items(), "project", projectId ?? "none"],
    enabled: !!userId && !!projectId,
    queryFn: async (): Promise<LibraryItem[]> => {
      if (!userId || !projectId) return [];
      const { data, error } = await supabasePending
        .from("library_items")
        .select("*")
        .eq("project_id", projectId)
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(normalizeItem) as LibraryItem[];
    },
  });
}

export function useLibraryItem(id: string | null) {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;

  return useQuery({
    queryKey: libraryKeys.item(id ?? ""),
    enabled: !!userId && !!id,
    queryFn: async (): Promise<LibraryItemWithTags | null> => {
      if (!userId || !id) return null;

      const { data: item, error } = await supabasePending
        .from("library_items")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      if (!item) return null;

      // Fetch tags
      const { data: tagLinks } = await supabasePending
        .from("library_item_tags")
        .select("tag_id, library_tags(*)")
        .eq("item_id", id);

      const tags = (tagLinks ?? [])
        .map((link: Record<string, unknown>) => link.library_tags as LibraryTag)
        .filter(Boolean) as LibraryTag[];

      // Fetch collection
      let collection: LibraryCollection | null = null;
      if (item.collection_id) {
        const { data: col } = await supabasePending
          .from("library_collections")
          .select("*")
          .eq("id", item.collection_id)
          .single();
        collection = col as LibraryCollection | null;
      }

      return { ...normalizeItem(item), tags, collection } as LibraryItemWithTags;
    },
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();

  return useMutation({
    mutationFn: async (input: {
      title?: string;
      content?: string;
      type?: LibraryItem["type"];
      collection_id?: string;
      project_id?: string | null;
      url?: string;
    }) => {
      if (!me?.userId) throw new Error("Not authenticated");
      const { data, error } = await supabasePending
        .from("library_items")
        .insert({
          user_id: me.userId,
          title: input.title ?? "Untitled",
          content: input.content ?? "",
          type: input.type ?? "note",
          collection_id: input.collection_id ?? null,
          project_id: input.project_id ?? null,
          url: input.url ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as LibraryItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.items() });
    },
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      title?: string;
      content?: string;
      collection_id?: string | null;
      project_id?: string | null;
      is_pinned?: boolean;
      is_favorite?: boolean;
      reading_progress?: number;
      url?: string;
      content_format?: "html" | "markdown";
      github_source?: GithubSource | null;
    }) => {
      const { id, ...updates } = input;
      const { data, error } = await supabasePending
        .from("library_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as LibraryItem;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.items() });
      queryClient.invalidateQueries({ queryKey: libraryKeys.item(variables.id) });
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabasePending.from("library_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.items() });
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_favorite }: { id: string; is_favorite: boolean }) => {
      const { error } = await supabasePending.from("library_items").update({ is_favorite }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.items() });
    },
  });
}

export function useTogglePin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_pinned }: { id: string; is_pinned: boolean }) => {
      const { error } = await supabasePending.from("library_items").update({ is_pinned }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.items() });
    },
  });
}

/**
 * Toggle a collection's world-readable flag. The RLS policies (`shared = true`
 * grants public SELECT on the collection AND its items) make this the single
 * switch: on = anyone with the link can read the whole collection, off =
 * owner-only again. Item-level `shared` flags keep working independently.
 */
export function useToggleCollectionShared() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, shared }: { id: string; shared: boolean }) => {
      const { error } = await supabasePending.from("library_collections").update({ shared }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.collections() });
      queryClient.invalidateQueries({ queryKey: libraryKeys.items() });
    },
  });
}

/**
 * Public read of one shared collection with its items — no auth required.
 * Backs /library/shared/collection/$id; RLS shows rows only while `shared`
 * is true, so a revoked link reads as empty/not found, never as a leak.
 */
export function useSharedLibraryCollection(id: string | null) {
  return useQuery({
    queryKey: [...libraryKeys.all, "shared-collection", id] as const,
    enabled: !!id,
    staleTime: 30_000,
    queryFn: async (): Promise<{ name: string; items: LibraryItem[] } | null> => {
      if (!id) return null;
      const { data: collection, error } = await supabasePending
        .from("library_collections")
        .select("name")
        .eq("id", id)
        .eq("shared", true)
        .maybeSingle();
      if (error) throw error;
      if (!collection) return null;
      const { data: items, error: itemsError } = await supabasePending
        .from("library_items")
        .select("*")
        .eq("collection_id", id)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (itemsError) throw itemsError;
      return {
        name: collection.name,
        items: (items ?? []).map(normalizeItem) as LibraryItem[],
      };
    },
  });
}

/**
 * Toggle an item's world-readable flag. The RLS policy (`shared = true`
 * grants public SELECT) makes this the single switch: on = anyone with the
 * link can read it, off = owner-only again.
 */
export function useToggleShared() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, shared }: { id: string; shared: boolean }) => {
      const { error } = await supabasePending.from("library_items").update({ shared }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.items() });
      queryClient.invalidateQueries({ queryKey: libraryKeys.item(variables.id) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.sharedItem(variables.id) });
    },
  });
}

/**
 * Public read of one shared item — no auth requirement. Backs the
 * /library/shared/$id page; RLS shows the row only while `shared` is true,
 * so a revoked link 404s (PGRST116) rather than leaking content.
 */
export function useSharedLibraryItem(id: string | null) {
  return useQuery({
    queryKey: libraryKeys.sharedItem(id ?? ""),
    enabled: !!id,
    staleTime: 30_000,
    queryFn: async (): Promise<LibraryItem | null> => {
      if (!id) return null;
      const { data, error } = await supabasePending
        .from("library_items")
        .select("*")
        .eq("id", id)
        .eq("shared", true)
        .maybeSingle();
      if (error) throw error;
      return data ? (normalizeItem(data) as LibraryItem) : null;
    },
  });
}

/* ───────── Collections ───────── */

export function useLibraryCollections() {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;

  return useQuery({
    queryKey: libraryKeys.collections(),
    enabled: !!userId,
    queryFn: async (): Promise<LibraryCollection[]> => {
      if (!userId) return [];
      const { data, error } = await supabasePending
        .from("library_collections")
        .select("*")
        .eq("user_id", userId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LibraryCollection[];
    },
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      icon?: string;
      color?: string;
      parent_id?: string;
    }) => {
      if (!me?.userId) throw new Error("Not authenticated");

      // Get max position
      const { data: existing } = await supabasePending
        .from("library_collections")
        .select("position")
        .eq("user_id", me.userId)
        .order("position", { ascending: false })
        .limit(1);

      const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

      const { data, error } = await supabasePending
        .from("library_collections")
        .insert({
          user_id: me.userId,
          name: input.name,
          icon: input.icon ?? "folder",
          color: input.color ?? "oklch(0.65 0.15 260)",
          parent_id: input.parent_id ?? null,
          position: nextPosition,
        })
        .select()
        .single();
      if (error) throw error;
      return data as LibraryCollection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.collections() });
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Unset collection_id on items in this collection
      await supabasePending.from("library_items").update({ collection_id: null }).eq("collection_id", id);

      const { error } = await supabasePending.from("library_collections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.collections() });
      queryClient.invalidateQueries({ queryKey: libraryKeys.items() });
    },
  });
}

/* ───────── Tags ───────── */

export function useLibraryTags() {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;

  return useQuery({
    queryKey: libraryKeys.tags(),
    enabled: !!userId,
    queryFn: async (): Promise<LibraryTag[]> => {
      if (!userId) return [];
      const { data, error } = await supabasePending
        .from("library_tags")
        .select("*")
        .eq("user_id", userId)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LibraryTag[];
    },
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();

  return useMutation({
    mutationFn: async (input: { name: string; color?: string }) => {
      if (!me?.userId) throw new Error("Not authenticated");
      const { data, error } = await supabasePending
        .from("library_tags")
        .insert({
          user_id: me.userId,
          name: input.name,
          color: input.color ?? "oklch(0.65 0.15 260)",
        })
        .select()
        .single();
      if (error) throw error;
      return data as LibraryTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.tags() });
    },
  });
}

export function useAddTagToItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ item_id, tag_id }: { item_id: string; tag_id: string }) => {
      const { error } = await supabasePending.from("library_item_tags").insert({ item_id, tag_id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.items() });
    },
  });
}

export function useRemoveTagFromItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ item_id, tag_id }: { item_id: string; tag_id: string }) => {
      const { error } = await supabasePending
        .from("library_item_tags")
        .delete()
        .eq("item_id", item_id)
        .eq("tag_id", tag_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.items() });
    },
  });
}

/* ───────── File Upload ───────── */

export function useUploadLibraryFile() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();

  return useMutation({
    mutationFn: async (input: {
      file: File;
      collection_id?: string;
      project_id?: string | null;
      title?: string;
      description?: string;
    }) => {
      if (!me?.userId) throw new Error("Not authenticated");

      const validation = validateLibraryFile(input.file);
      if (!validation.ok) throw new Error(validation.error);
      const ext = validation.ext;
      const filename = sanitizeFilename(input.file.name) || `upload.${ext}`;
      const path = `${me.userId}/${Date.now()}-${filename}`;

      const { error: uploadError } = await supabase.storage
        .from("library-files")
        .upload(path, input.file);

      if (uploadError) throw uploadError;

      // Determine type from extension
      const imageExts = [
        "jpg",
        "jpeg",
        "png",
        "gif",
        "webp",
        "svg",
        "bmp",
        "tiff",
        "tif",
        "ico",
        "heic",
        "heif",
      ];
      const docExts = [
        "pdf",
        "doc",
        "docx",
        "ppt",
        "pptx",
        "xls",
        "xlsx",
        "odt",
        "ods",
        "odp",
        "pages",
        "numbers",
        "key",
      ];
      const videoExts = ["mp4", "webm", "mov", "avi", "mkv", "wmv", "flv", "m4v"];
      const audioExts = ["mp3", "wav", "aac", "ogg", "flac", "m4a", "wma", "aiff"];
      const designExts = ["psd", "ai", "eps", "sketch", "fig", "xd", "indd", "afdesign", "afphoto"];
      const modelExts = [
        "blend",
        "fbx",
        "obj",
        "stl",
        "glb",
        "gltf",
        "usd",
        "usdz",
        "dae",
        "3ds",
        "max",
        "ma",
        "mb",
        "c4d",
      ];
      const archiveExts = ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"];
      const textExts = [
        "txt",
        "md",
        "csv",
        "json",
        "xml",
        "yaml",
        "yml",
        "toml",
        "rtf",
        "tex",
        "log",
      ];

      let type: LibraryItem["type"] = "upload";
      if (
        imageExts.includes(ext) ||
        videoExts.includes(ext) ||
        audioExts.includes(ext) ||
        designExts.includes(ext) ||
        modelExts.includes(ext) ||
        archiveExts.includes(ext)
      )
        type = "upload";
      else if (docExts.includes(ext) || textExts.includes(ext)) type = "document";

      // Build description content for text-based files
      let content = "";
      if (input.description) {
        content = input.description;
      }

      const { data: item, error: itemError } = await supabasePending
        .from("library_items")
        .insert({
          user_id: me.userId,
          title: input.title ?? input.file.name,
          content,
          type,
          collection_id: input.collection_id ?? null,
          project_id: input.project_id ?? null,
          // Despite its legacy name, file_url stores a private storage object path.
          file_url: path,
          file_type: input.file.type,
          file_size: input.file.size,
        })
        .select()
        .single();

      if (itemError) throw itemError;
      return item as LibraryItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.items() });
    },
  });
}

/* ───────── Boards (kanban) ───────── */

/** Columns a new board starts with — the member renames/adds/reorders freely. */
const DEFAULT_BOARD_COLUMNS = [
  { name: "To do", is_done: false, wip_limit: null },
  { name: "Doing", is_done: false, wip_limit: 3 },
  { name: "Done", is_done: true, wip_limit: null },
];

export function useLibraryBoards() {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;

  return useQuery({
    queryKey: libraryKeys.boards(),
    enabled: !!userId,
    queryFn: async (): Promise<LibraryBoard[]> => {
      if (!userId) return [];
      const { data, error } = await supabasePending
        .from("library_boards")
        .select("*")
        .eq("user_id", userId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LibraryBoard[];
    },
  });
}

/** One board with its columns + cards — the render shape for the board page. */
export function useLibraryBoard(boardId: string | null) {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;

  return useQuery({
    queryKey: libraryKeys.board(boardId ?? ""),
    enabled: !!userId && !!boardId,
    queryFn: async (): Promise<LibraryBoardData | null> => {
      if (!userId || !boardId) return null;
      const { data: board, error } = await supabasePending
        .from("library_boards")
        .select("*")
        .eq("id", boardId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!board) return null;

      const [{ data: columns, error: colErr }, { data: cards, error: cardErr }] = await Promise.all(
        [
          supabasePending
            .from("library_board_columns")
            .select("*")
            .eq("board_id", boardId)
            .order("position", { ascending: true }),
          supabasePending
            .from("library_board_cards")
            .select("*")
            .eq("board_id", boardId)
            .eq("archived", false)
            .order("position", { ascending: true }),
        ],
      );
      if (colErr) throw colErr;
      if (cardErr) throw cardErr;
      return {
        board: board as LibraryBoard,
        columns: (columns ?? []) as LibraryBoardColumn[],
        cards: (cards ?? []).map(
          (card: Record<string, unknown>) =>
            ({ ...card, fields: card.fields ?? {} }) as LibraryBoardCard,
        ),
      };
    },
  });
}

export function useCreateBoard() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();

  return useMutation({
    mutationFn: async (input: { name: string; icon?: string; color?: string }) => {
      if (!me?.userId) throw new Error("Not authenticated");
      const { data: existing } = await supabasePending
        .from("library_boards")
        .select("position")
        .eq("user_id", me.userId)
        .order("position", { ascending: false })
        .limit(1);
      const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

      const { data: board, error } = await supabasePending
        .from("library_boards")
        .insert({
          user_id: me.userId,
          name: input.name,
          icon: input.icon ?? "columns",
          color: input.color ?? "var(--learning)",
          position: nextPosition,
        })
        .select()
        .single();
      if (error) throw error;

      // Seed the default column set so the board is usable immediately.
      const { error: colError } = await supabasePending.from("library_board_columns").insert(
        DEFAULT_BOARD_COLUMNS.map((column, index) => ({
          board_id: board.id,
          user_id: me.userId,
          name: column.name,
          is_done: column.is_done,
          wip_limit: column.wip_limit,
          position: index,
        })),
      );
      if (colError) throw colError;
      return board as LibraryBoard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.boards() });
    },
  });
}

export function useUpdateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<LibraryBoard>) => {
      const { error } = await supabasePending.from("library_boards").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.boards() });
      queryClient.invalidateQueries({ queryKey: libraryKeys.board(variables.id) });
    },
  });
}

export function useDeleteBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabasePending.from("library_boards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.boards() });
    },
  });
}

/** Column CRUD — add, rename/reorder/restyle, remove (cards cascade). */
export function useCreateColumn() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();

  return useMutation({
    mutationFn: async (input: {
      board_id: string;
      name: string;
      is_done?: boolean;
      wip_limit?: number | null;
    }) => {
      if (!me?.userId) throw new Error("Not authenticated");
      const { data: existing } = await supabasePending
        .from("library_board_columns")
        .select("position")
        .eq("board_id", input.board_id)
        .order("position", { ascending: false })
        .limit(1);
      const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;
      const { data, error } = await supabasePending
        .from("library_board_columns")
        .insert({
          board_id: input.board_id,
          user_id: me.userId,
          name: input.name,
          is_done: input.is_done ?? false,
          wip_limit: input.wip_limit ?? null,
          position: nextPosition,
        })
        .select()
        .single();
      if (error) throw error;
      return data as LibraryBoardColumn;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.board(variables.board_id) });
    },
  });
}

export function useUpdateColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      board_id: _board_id,
      ...patch
    }: { id: string; board_id: string } & Partial<LibraryBoardColumn>) => {
      const { error } = await supabasePending.from("library_board_columns").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.board(variables.board_id) });
    },
  });
}

export function useDeleteColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, board_id: _board_id }: { id: string; board_id: string }) => {
      const { error } = await supabasePending.from("library_board_columns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.board(variables.board_id) });
    },
  });
}

export function useCreateCard() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();

  return useMutation({
    mutationFn: async (input: {
      board_id: string;
      column_id: string;
      title: string;
      item_id?: string | null;
      fields?: Record<string, LibraryCardFieldValue>;
      accent?: string | null;
    }) => {
      if (!me?.userId) throw new Error("Not authenticated");
      const { data: existing } = await supabasePending
        .from("library_board_cards")
        .select("position")
        .eq("column_id", input.column_id)
        .order("position", { ascending: false })
        .limit(1);
      const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;
      const { data, error } = await supabasePending
        .from("library_board_cards")
        .insert({
          board_id: input.board_id,
          column_id: input.column_id,
          user_id: me.userId,
          title: input.title,
          item_id: input.item_id ?? null,
          position: nextPosition,
          fields: input.fields ?? {},
          accent: input.accent ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as LibraryBoardCard;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.board(variables.board_id) });
      // A card may wrap an item — item pages show "On boards" context.
      queryClient.invalidateQueries({ queryKey: libraryKeys.items() });
    },
  });
}

/** Move a card between columns / reorder within one (the drag primitive). */
export function useMoveCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      board_id: string;
      column_id: string;
      position: number;
    }) => {
      const { error } = await supabasePending
        .from("library_board_cards")
        .update({ column_id: input.column_id, position: input.position })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.board(variables.board_id) });
    },
  });
}

export function useUpdateCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      board_id: _board_id,
      ...patch
    }: { id: string; board_id: string } & Partial<LibraryBoardCard>) => {
      const { error } = await supabasePending.from("library_board_cards").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.board(variables.board_id) });
    },
  });
}

export function useDeleteCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, board_id: _board_id }: { id: string; board_id: string }) => {
      const { error } = await supabasePending.from("library_board_cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.board(variables.board_id) });
    },
  });
}

/* ───────── Search ───────── */

export function useLibrarySearch(query: string) {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;
  const trimmed = query.trim();

  return useQuery({
    queryKey: libraryKeys.search(trimmed),
    enabled: !!userId && trimmed.length >= SEARCH_MIN_LENGTH,
    staleTime: 30_000,
    queryFn: async (): Promise<LibraryItem[]> => {
      if (!userId || trimmed.length < SEARCH_MIN_LENGTH) return [];
      const { data, error } = await supabasePending
        .from("library_items")
        .select("*")
        .eq("user_id", userId)
        .or(ilikeOrFilter(["title", "content"], trimmed))
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map(normalizeItem) as LibraryItem[];
    },
  });
}
