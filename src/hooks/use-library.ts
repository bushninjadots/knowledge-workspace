import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./use-current-user";
import { sanitizeFilename, validateLibraryFile } from "@/lib/validators";

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
  reading_progress: number;
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
  created_at: string;
  updated_at: string;
};

export type LibraryTag = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
};

export type LibraryVersion = {
  id: string;
  item_id: string;
  title: string;
  content: string;
  editor_id: string;
  created_at: string;
};

export type LibraryItemWithTags = LibraryItem & {
  tags: LibraryTag[];
  collection?: LibraryCollection | null;
};

export type LibraryFilter = {
  type?: LibraryItem["type"];
  collection_id?: string;
  tag_id?: string;
  is_favorite?: boolean;
  is_pinned?: boolean;
  search?: string;
};

/* ───────── Query Keys ───────── */

export const libraryKeys = {
  all: ["library"] as const,
  items: () => [...libraryKeys.all, "items"] as const,
  item: (id: string) => [...libraryKeys.items(), id] as const,
  collections: () => [...libraryKeys.all, "collections"] as const,
  tags: () => [...libraryKeys.all, "tags"] as const,
  versions: (itemId: string) => [...libraryKeys.all, "versions", itemId] as const,
  search: (query: string) => [...libraryKeys.all, "search", query] as const,
};

/* ───────── Items ───────── */

export function useLibraryItems(filters?: LibraryFilter) {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;

  return useQuery({
    queryKey: [...libraryKeys.items(), filters],
    enabled: !!userId,
    queryFn: async (): Promise<LibraryItem[]> => {
      if (!userId) return [];
      let query = supabase
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
        query = query.or(`title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return (data ?? []) as LibraryItem[];
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

      const { data: item, error } = await supabase
        .from("library_items")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      if (!item) return null;

      // Fetch tags
      const { data: tagLinks } = await supabase
        .from("library_item_tags")
        .select("tag_id, library_tags(*)")
        .eq("item_id", id);

      const tags = (tagLinks ?? [])
        .map((link: Record<string, unknown>) => link.library_tags as LibraryTag)
        .filter(Boolean) as LibraryTag[];

      // Fetch collection
      let collection: LibraryCollection | null = null;
      if (item.collection_id) {
        const { data: col } = await supabase
          .from("library_collections")
          .select("*")
          .eq("id", item.collection_id)
          .single();
        collection = col as LibraryCollection | null;
      }

      return { ...item, tags, collection } as LibraryItemWithTags;
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
      url?: string;
    }) => {
      if (!me?.userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("library_items")
        .insert({
          user_id: me.userId,
          title: input.title ?? "Untitled",
          content: input.content ?? "",
          type: input.type ?? "note",
          collection_id: input.collection_id ?? null,
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
      is_pinned?: boolean;
      is_favorite?: boolean;
      reading_progress?: number;
      url?: string;
    }) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
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
      const { error } = await supabase.from("library_items").delete().eq("id", id);
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
      const { error } = await supabase.from("library_items").update({ is_favorite }).eq("id", id);
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
      const { error } = await supabase.from("library_items").update({ is_pinned }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.items() });
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
      const { data, error } = await supabase
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
      const { data: existing } = await supabase
        .from("library_collections")
        .select("position")
        .eq("user_id", me.userId)
        .order("position", { ascending: false })
        .limit(1);

      const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

      const { data, error } = await supabase
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

export function useUpdateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      icon?: string;
      color?: string;
      parent_id?: string | null;
      position?: number;
    }) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from("library_collections")
        .update(updates)
        .eq("id", id)
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
      await supabase.from("library_items").update({ collection_id: null }).eq("collection_id", id);

      const { error } = await supabase.from("library_collections").delete().eq("id", id);
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("library_tags").delete().eq("id", id);
      if (error) throw error;
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
      const { error } = await supabase.from("library_item_tags").insert({ item_id, tag_id });
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
      const { error } = await supabase
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

/* ───────── Versions ───────── */

export function useLibraryVersions(itemId: string) {
  return useQuery({
    queryKey: libraryKeys.versions(itemId),
    enabled: !!itemId,
    queryFn: async (): Promise<LibraryVersion[]> => {
      const { data, error } = await supabase
        .from("library_versions")
        .select("*")
        .eq("item_id", itemId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as LibraryVersion[];
    },
  });
}

export function useCreateVersion() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();

  return useMutation({
    mutationFn: async (input: { item_id: string; title: string; content: string }) => {
      if (!me?.userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("library_versions")
        .insert({
          item_id: input.item_id,
          title: input.title,
          content: input.content,
          editor_id: me.userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as LibraryVersion;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.versions(variables.item_id) });
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
      const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
      const docExts = ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx"];
      const videoExts = ["mp4", "webm", "mov", "avi"];
      const textExts = ["txt", "md", "csv", "json", "rtf"];

      let type: LibraryItem["type"] = "upload";
      if (imageExts.includes(ext) || videoExts.includes(ext)) type = "upload";
      else if (docExts.includes(ext) || textExts.includes(ext)) type = "document";

      // Build description content for text-based files
      let content = "";
      if (input.description) {
        content = input.description;
      }

      const { data: item, error: itemError } = await supabase
        .from("library_items")
        .insert({
          user_id: me.userId,
          title: input.title ?? input.file.name,
          content,
          type,
          collection_id: input.collection_id ?? null,
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

/* ───────── Search ───────── */

export function useLibrarySearch(query: string) {
  const { data: me } = useCurrentUser();
  const userId = me?.userId;
  const trimmed = query.trim();

  return useQuery({
    queryKey: libraryKeys.search(trimmed),
    enabled: !!userId && trimmed.length >= 2,
    queryFn: async (): Promise<LibraryItem[]> => {
      if (!userId || trimmed.length < 2) return [];
      const { data, error } = await supabase
        .from("library_items")
        .select("*")
        .eq("user_id", userId)
        .or(`title.ilike.%${trimmed}%,content.ilike.%${trimmed}%`)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as LibraryItem[];
    },
  });
}
