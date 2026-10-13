// React Query keys for the Library (items, collections, tags, boards, search).
// Shared by use-library.ts and use-library-boards.ts.

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
