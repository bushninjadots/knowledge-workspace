// Library boards (kanban): a member's boards, their columns and cards.
// Re-exported from use-library.ts, so callers keep importing from there.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./use-current-user";

/* ───────── Types ───────── */

import { libraryKeys } from "./library-keys";

/* ───────── Types ───────── */

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
      const { data, error } = await supabase
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
      const { data: board, error } = await supabase
        .from("library_boards")
        .select("*")
        .eq("id", boardId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!board) return null;

      const [{ data: columns, error: colErr }, { data: cards, error: cardErr }] = await Promise.all(
        [
          supabase
            .from("library_board_columns")
            .select("*")
            .eq("board_id", boardId)
            .order("position", { ascending: true }),
          supabase
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
      const { data: existing } = await supabase
        .from("library_boards")
        .select("position")
        .eq("user_id", me.userId)
        .order("position", { ascending: false })
        .limit(1);
      const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

      const { data: board, error } = await supabase
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
      const { error: colError } = await supabase.from("library_board_columns").insert(
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
      const { error } = await supabase.from("library_boards").update(patch).eq("id", id);
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
      const { error } = await supabase.from("library_boards").delete().eq("id", id);
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
      const { data: existing } = await supabase
        .from("library_board_columns")
        .select("position")
        .eq("board_id", input.board_id)
        .order("position", { ascending: false })
        .limit(1);
      const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;
      const { data, error } = await supabase
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
      const { error } = await supabase.from("library_board_columns").update(patch).eq("id", id);
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
      const { error } = await supabase.from("library_board_columns").delete().eq("id", id);
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
      const { data: existing } = await supabase
        .from("library_board_cards")
        .select("position")
        .eq("column_id", input.column_id)
        .order("position", { ascending: false })
        .limit(1);
      const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;
      const { data, error } = await supabase
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
      const { error } = await supabase
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
      const { error } = await supabase.from("library_board_cards").update(patch).eq("id", id);
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
      const { error } = await supabase.from("library_board_cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.board(variables.board_id) });
    },
  });
}
