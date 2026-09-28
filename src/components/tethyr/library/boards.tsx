import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  AlignLeft,
  Columns3,
  ExternalLink,
  FileText,
  Globe,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCreateBoard,
  useCreateCard,
  useCreateColumn,
  useDeleteBoard,
  useDeleteCard,
  useDeleteColumn,
  useLibraryBoard,
  useLibraryBoards,
  useLibraryItems,
  useMoveCard,
  useUpdateBoard,
  useUpdateCard,
  useUpdateColumn,
  type LibraryBoard,
  type LibraryBoardCard,
  type LibraryBoardColumn,
  type LibraryBoardData,
} from "@/hooks/use-library";
import { cn } from "@/lib/utils";

/**
 * Library boards — kanban the member can shape into any workflow. Columns are
 * user-defined (rename, reorder, mark done, soft WIP limit); a card either
 * wraps an existing library item (deep-links to the item page) or stands
 * alone. Cards carry free-form fields; the card dialog edits the common ones
 * (due date, notes, checklist) so the shape stays discoverable without
 * hard-coding a workflow into the data model.
 *
 * This is the board surface for one board. Board selection lives in
 * BoardSwitcher; "Boards" shows up in the library sidebar.
 */
export function LibraryBoards() {
  const { data: boards = [], isLoading } = useLibraryBoards();
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const createBoard = useCreateBoard();

  // First board wins until the member picks one (selection isn't persisted —
  // boards are few; re-visiting lands on the first, matching collections).
  const boardId = activeBoardId ?? boards[0]?.id ?? null;

  function handleCreate(name: string) {
    createBoard.mutate(
      { name },
      {
        onSuccess: (board) => {
          setCreating(false);
          setActiveBoardId(board.id);
          toast.success(`Board "${board.name}" created`);
        },
        onError: (err) => toast.error(err.message ?? "Failed to create board"),
      },
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <div className="grid min-w-[60rem] grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (boards.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 border-dashed bg-surface/40 px-6 py-12 text-center">
        <Columns3 className="h-8 w-8 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-display text-base font-semibold text-foreground">
            Run anything on a board
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            A kanban you shape yourself: reading queues, project pipelines, research moves — the
            columns are yours. Cards can wrap library items or stand alone.
          </p>
        </div>
        <Button
          size="sm"
          className="mt-1 bg-[var(--user-accent,var(--trust))] text-[var(--user-accent-foreground,var(--background))] hover:opacity-90"
          onClick={() => setCreating(true)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          New board
        </Button>
        <NewBoardDialog open={creating} onOpenChange={setCreating} onCreate={handleCreate} />
      </Card>
    );
  }

  return (
    <div>
      <BoardSwitcher
        boards={boards}
        activeId={boardId}
        onSelect={setActiveBoardId}
        onCreate={() => setCreating(true)}
      />
      {boardId && <BoardView boardId={boardId} />}
      <NewBoardDialog open={creating} onOpenChange={setCreating} onCreate={handleCreate} />
    </div>
  );
}

function NewBoardDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New board</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onCreate(name.trim());
          }}
          placeholder="e.g. Reading queue, Project pipeline"
          className="h-9"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={() => onCreate(name.trim())}
            className="bg-[var(--user-accent,var(--trust))] text-[var(--user-accent-foreground,var(--background))] hover:opacity-90"
          >
            Create board
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BoardSwitcher({
  boards,
  activeId,
  onSelect,
  onCreate,
}: {
  boards: LibraryBoard[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-1.5" role="group" aria-label="Boards">
      {boards.map((board) => (
        <button
          key={board.id}
          type="button"
          aria-pressed={board.id === activeId}
          onClick={() => onSelect(board.id)}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            board.id === activeId
              ? "bg-foreground text-background"
              : "bg-surface/60 text-muted-foreground hover:bg-surface-elevated hover:text-foreground",
          )}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: board.color }}
            aria-hidden
          />
          {board.name}
        </button>
      ))}
      <button
        type="button"
        onClick={onCreate}
        aria-label="New board"
        className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** The full board: columns, drag between them, per-column and per-card menus. */
function BoardView({ boardId }: { boardId: string }) {
  const { data, isLoading } = useLibraryBoard(boardId);
  const updateBoard = useUpdateBoard();
  const deleteBoard = useDeleteBoard();
  const [boardSettingsOpen, setBoardSettingsOpen] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="grid min-w-[60rem] grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-64 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Drag cards between columns. {data.columns.length} column
          {data.columns.length === 1 ? "" : "s"} ·{" "}
          {data.cards.length === 1 ? "1 card" : `${data.cards.length} cards`}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
              <Settings2 className="h-3.5 w-3.5" />
              Board settings
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setBoardSettingsOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Rename board
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                if (!window.confirm(`Delete the board "${data.board.name}" and all its cards?`))
                  return;
                deleteBoard.mutate(boardId);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete board
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Kanban data={data} />

      <BoardSettingsDialog
        board={data.board}
        open={boardSettingsOpen}
        onOpenChange={setBoardSettingsOpen}
        onRename={(name) => updateBoard.mutate({ id: boardId, name })}
      />
    </div>
  );
}

function BoardSettingsDialog({
  board,
  open,
  onOpenChange,
  onRename,
}: {
  board: LibraryBoard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (name: string) => void;
}) {
  const [name, setName] = useState(board.name);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename board</DialogTitle>
        </DialogHeader>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (name.trim() && name.trim() !== board.name) onRename(name.trim());
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Kanban core ──────────────────────────────────────────────────────────────

function Kanban({ data }: { data: LibraryBoardData }) {
  const createColumn = useCreateColumn();
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<
    Record<string, { column_id: string; position: number }>
  >({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const grouped = useMemo(() => {
    const map = new Map<string, LibraryBoardCard[]>();
    for (const column of data.columns) map.set(column.id, []);
    for (const card of data.cards) {
      if (!map.has(card.column_id)) map.set(card.column_id, []);
      map.get(card.column_id)!.push(card);
    }
    // Reorder within a column per pending optimistic move.
    for (const [columnId, cards] of map) {
      map.set(
        columnId,
        [...cards].sort((a, b) => {
          const pa = pendingMove[a.id]?.position ?? a.position;
          const pb = pendingMove[b.id]?.position ?? b.position;
          return pa - pb;
        }),
      );
    }
    return map;
  }, [data.columns, data.cards, pendingMove]);

  const activeCard = activeCardId
    ? (data.cards.find((card) => card.id === activeCardId) ?? null)
    : null;

  function handleDragEnd(event: DragEndEvent) {
    setActiveCardId(null);
    const { active, over } = event;
    if (!over) return;
    const card = data.cards.find((c) => c.id === active.id);
    if (!card) return;
    // Drop target is a column (id = column id) or a card (data.columnId).
    const targetColumnId =
      (over.data.current?.columnId as string | undefined) ??
      (data.columns.some((c) => c.id === over.id) ? (over.id as string) : undefined);
    if (!targetColumnId) return;

    const columnCards = grouped.get(targetColumnId) ?? [];
    let position: number;
    if (over.id === card.id) return;
    if (over.data.current?.columnId && over.id !== card.id) {
      const overIndex = columnCards.findIndex((c) => c.id === over.id);
      const overCard = columnCards[overIndex];
      if (!overCard) return;
      // Insert before the card we landed on (same math whether moving within
      // the column or across columns — positions renumber on the client).
      position = overIndex;
    } else {
      position = columnCards.length;
    }
    if (card.column_id === targetColumnId) {
      const currentIndex = columnCards.findIndex((c) => c.id === card.id);
      if (currentIndex !== -1 && currentIndex < position) position -= 1;
      if (currentIndex === position) return;
    }

    setPendingMove((prev) => ({ ...prev, [card.id]: { column_id: targetColumnId, position } }));
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event) => setActiveCardId(event.active.id as string)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveCardId(null)}
    >
      <div className="-mx-1 overflow-x-auto px-1 pb-2" aria-label="Board columns">
        <div className="flex min-w-fit gap-3">
          {data.columns.map((column) => (
            <BoardColumnView
              key={column.id}
              column={column}
              cards={grouped.get(column.id) ?? []}
              onDragStart={setActiveCardId}
              pendingMove={pendingMove}
              clearPending={(cardId) =>
                setPendingMove((prev) => {
                  if (!(cardId in prev)) return prev;
                  const next = { ...prev };
                  delete next[cardId];
                  return next;
                })
              }
            />
          ))}
          <AddColumnControl
            adding={addingColumn}
            onAddingChange={setAddingColumn}
            value={newColumnName}
            onValueChange={setNewColumnName}
            onConfirm={() => {
              if (!newColumnName.trim()) return;
              createColumn.mutate(
                { board_id: data.board.id, name: newColumnName.trim() },
                {
                  onSuccess: () => {
                    setNewColumnName("");
                    setAddingColumn(false);
                  },
                },
              );
            }}
          />
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeCard ? (
          // pointer-events-none: dnd-kit stopped applying it for us (v6.1+),
          // and an overlay that catches the pointer breaks every drop hit-test.
          <div className="pointer-events-none w-60 -rotate-1 rounded-lg border border-border/80 bg-surface-elevated/95 p-3 shadow-lg">
            <BoardCardBody card={activeCard} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function AddColumnControl({
  adding,
  onAddingChange,
  value,
  onValueChange,
  onConfirm,
}: {
  adding: boolean;
  onAddingChange: (v: boolean) => void;
  value: string;
  onValueChange: (v: string) => void;
  onConfirm: () => void;
}) {
  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => onAddingChange(true)}
        className="flex h-9 w-56 shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-border/70 px-3 text-xs text-muted-foreground hover:border-border-strong hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        Add column
      </button>
    );
  }
  return (
    <div className="flex w-56 shrink-0 items-center gap-1.5">
      <Input
        autoFocus
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onConfirm();
          if (e.key === "Escape") onAddingChange(false);
        }}
        placeholder="Column name"
        className="h-9 text-xs"
      />
      <Button size="sm" className="h-9 px-2 text-xs" onClick={onConfirm}>
        Add
      </Button>
    </div>
  );
}

function BoardColumnView({
  column,
  cards,
  pendingMove,
  clearPending,
}: {
  column: LibraryBoardColumn;
  cards: LibraryBoardCard[];
  onDragStart: (id: string) => void;
  pendingMove: Record<string, { column_id: string; position: number }>;
  clearPending: (cardId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { columnId: column.id } });
  const createCard = useCreateCard();
  const updateColumn = useUpdateColumn();
  const deleteColumn = useDeleteColumn();
  const moveCard = useMoveCard();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);

  const overLimit = column.wip_limit != null && !column.is_done && cards.length > column.wip_limit;

  // Commit pending drops (one query per moved card) after render.
  for (const card of cards) {
    const pending = pendingMove[card.id];
    if (pending && (pending.column_id !== card.column_id || pending.position !== card.position)) {
      moveCard.mutate(
        {
          id: card.id,
          board_id: column.board_id,
          column_id: pending.column_id,
          position: pending.position,
        },
        {
          onSettled: () => clearPending(card.id),
          onError: () => toast.error("Couldn't move the card"),
        },
      );
    }
  }

  function addCard(title: string, itemId?: string | null) {
    createCard.mutate(
      { board_id: column.board_id, column_id: column.id, title, item_id: itemId ?? null },
      {
        onSuccess: () => {
          setNewTitle("");
          setAdding(false);
          setLinkPickerOpen(false);
        },
        onError: () => toast.error("Couldn't add the card"),
      },
    );
  }

  return (
    <section
      ref={setNodeRef}
      aria-label={column.name}
      className={cn(
        "flex w-64 shrink-0 flex-col rounded-lg p-3 transition-colors",
        isOver
          ? "bg-surface-elevated/70 ring-1 ring-inset ring-[var(--user-accent-border,var(--border-strong))]"
          : "bg-background/45",
      )}
    >
      <header className="flex items-center gap-2 border-b border-border/50 pb-2">
        <h4 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {column.name}
        </h4>
        <span
          className={cn(
            "text-xs tabular-nums",
            overLimit ? "font-semibold text-warning" : "text-muted-foreground",
          )}
        >
          {column.wip_limit != null ? `${cards.length}/${column.wip_limit}` : cards.length}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Column options for ${column.name}`}
              className="rounded-sm p-1 text-muted-foreground hover:bg-surface-sunken hover:text-foreground"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <ColumnSettingsItems column={column} onUpdate={updateColumn.mutate} />
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                if (!window.confirm(`Delete column "${column.name}" and its cards?`)) return;
                deleteColumn.mutate({ id: column.id, board_id: column.board_id });
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete column
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="mt-2 flex min-h-16 flex-1 flex-col gap-2">
        {cards.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">Drop cards here.</p>
        )}
        {cards.map((card) => (
          <BoardCardView key={card.id} card={card} column={column} />
        ))}
      </div>

      {adding ? (
        <div className="mt-2">
          <Input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTitle.trim()) addCard(newTitle.trim());
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="Card title"
            className="h-8 text-xs"
          />
          <div className="mt-1.5 flex items-center gap-1.5">
            <Button
              size="sm"
              className="h-7 px-2 text-2xs"
              disabled={!newTitle.trim()}
              onClick={() => addCard(newTitle.trim())}
            >
              Add card
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-2xs"
              onClick={() => setLinkPickerOpen(true)}
            >
              <AlignLeft className="h-3 w-3" /> From library…
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-2xs"
              onClick={() => setAdding(false)}
            >
              Cancel
            </Button>
          </div>
          <ItemPickerDialog
            open={linkPickerOpen}
            onOpenChange={setLinkPickerOpen}
            onPick={(item) => addCard(item.title, item.id)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 flex items-center gap-1 rounded-sm px-1 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add card
        </button>
      )}
    </section>
  );
}

function ColumnSettingsItems({
  column,
  onUpdate,
}: {
  column: LibraryBoardColumn;
  onUpdate: (input: { id: string; board_id: string } & Partial<LibraryBoardColumn>) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(column.name);
  if (!renaming) {
    return (
      <>
        <DropdownMenuItem onClick={() => setRenaming(true)}>
          <Pencil className="h-3.5 w-3.5" /> Rename column
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            onUpdate({ id: column.id, board_id: column.board_id, is_done: !column.is_done })
          }
        >
          {column.is_done ? "Unmark as done" : "Mark as done column"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            onUpdate({
              id: column.id,
              board_id: column.board_id,
              wip_limit: column.wip_limit == null ? 3 : null,
            })
          }
        >
          {column.wip_limit == null ? "Set WIP limit (3)" : "Remove WIP limit"}
        </DropdownMenuItem>
      </>
    );
  }
  return (
    <div
      className="flex items-center gap-1 px-1.5 py-1"
      onKeyDown={(e) => {
        if (e.key === "Escape") setRenaming(false);
      }}
    >
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            onUpdate({ id: column.id, board_id: column.board_id, name: name.trim() });
            setRenaming(false);
          }
        }}
        className="h-7 text-xs"
      />
      <Button
        size="sm"
        className="h-7 px-2 text-2xs"
        onClick={() => {
          if (name.trim())
            onUpdate({ id: column.id, board_id: column.board_id, name: name.trim() });
          setRenaming(false);
        }}
      >
        Save
      </Button>
    </div>
  );
}

function BoardCardView({ card, column }: { card: LibraryBoardCard; column: LibraryBoardColumn }) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { columnId: column.id },
  });
  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();
  const [editOpen, setEditOpen] = useState(false);

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className={cn(
        "group/card cursor-grab rounded-lg border border-border/60 bg-surface-elevated/40 p-3 transition-colors active:cursor-grabbing hover:border-border hover:bg-surface-elevated/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-1.5">
        <BoardCardBody card={card} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Card options for ${card.title}`}
              className="rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-surface-sunken hover:text-foreground focus-visible:opacity-100 group-hover/card:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit card
            </DropdownMenuItem>
            {card.item_id && (
              <DropdownMenuItem
                onClick={() => navigate({ to: "/library/$id", params: { id: card.item_id! } })}
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open library item
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => deleteCard.mutate({ id: card.id, board_id: card.board_id })}
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove card
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CardDialog
        card={card}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdate={(patch) => updateCard.mutate({ id: card.id, board_id: card.board_id, ...patch })}
      />
    </div>
  );
}

function BoardCardBody({ card }: { card: LibraryBoardCard }) {
  const due = card.fields.due as string | undefined;
  const notes = card.fields.notes as string | undefined;
  const checklist = card.fields.checklist as { text: string; checked: boolean }[] | undefined;

  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium leading-snug text-foreground">{card.title}</p>
      {card.item_id && (
        <Link
          to="/library/$id"
          params={{ id: card.item_id }}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-2xs text-trust hover:underline"
        >
          <ItemGlyph fields={card.fields} />
          <span className="truncate">Linked library item</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </Link>
      )}
      {due && (
        <p className="mt-1 text-2xs tabular-nums text-muted-foreground">
          Due {new Date(due).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </p>
      )}
      {notes && <p className="mt-1 line-clamp-2 text-2xs text-muted-foreground">{notes}</p>}
      {checklist && checklist.length > 0 && (
        <p className="mt-1 text-2xs tabular-nums text-muted-foreground">
          {checklist.filter((c) => c.checked).length}/{checklist.length} done
        </p>
      )}
    </div>
  );
}

function ItemGlyph({ fields }: { fields: LibraryBoardCard["fields"] }) {
  const type = fields.itemType as string | undefined;
  if (type === "link") return <Globe className="h-3 w-3 shrink-0" />;
  if (type === "upload") return <Upload className="h-3 w-3 shrink-0" />;
  return <FileText className="h-3 w-3 shrink-0" />;
}

/** Card editor: title + the common field shapes (due date, notes, checklist). */
function CardDialog({
  card,
  open,
  onOpenChange,
  onUpdate,
}: {
  card: LibraryBoardCard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (patch: Partial<LibraryBoardCard>) => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [due, setDue] = useState((card.fields.due as string | undefined) ?? "");
  const [notes, setNotes] = useState((card.fields.notes as string | undefined) ?? "");
  const [checklist, setChecklist] = useState(
    (card.fields.checklist as { text: string; checked: boolean }[] | undefined) ?? [],
  );
  const [newItem, setNewItem] = useState("");

  function save() {
    onUpdate({
      title: title.trim() || card.title,
      fields: {
        ...card.fields,
        due: due || null,
        notes: notes || null,
        checklist: checklist.length > 0 ? checklist : null,
      } as LibraryBoardCard["fields"],
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit card</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Title</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Due date</span>
            <Input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="h-9"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Checklist
            </span>
            <ul className="space-y-1">
              {checklist.map((entry, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={entry.checked}
                    onChange={() =>
                      setChecklist((prev) =>
                        prev.map((c, i) => (i === index ? { ...c, checked: !c.checked } : c)),
                      )
                    }
                    className="h-3.5 w-3.5"
                  />
                  <span
                    className={cn("flex-1", entry.checked && "text-muted-foreground line-through")}
                  >
                    {entry.text}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${entry.text}`}
                    onClick={() => setChecklist((prev) => prev.filter((_, i) => i !== index))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-1.5 flex gap-1.5">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newItem.trim()) {
                    setChecklist((prev) => [...prev, { text: newItem.trim(), checked: false }]);
                    setNewItem("");
                  }
                }}
                placeholder="Add checklist item"
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2 text-2xs"
                disabled={!newItem.trim()}
                onClick={() => {
                  setChecklist((prev) => [...prev, { text: newItem.trim(), checked: false }]);
                  setNewItem("");
                }}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Pick an existing library item to wrap as a card. */
function ItemPickerDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (item: { id: string; title: string }) => void;
}) {
  const { data: items = [] } = useLibraryItems();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((item) => !q || item.title.toLowerCase().includes(q));
    return list.slice(0, 30);
  }, [items, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link a library item</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your library…"
          className="h-9"
        />
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {filtered.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  onPick({ id: item.id, title: item.title });
                  onOpenChange(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-sunken"
              >
                <ItemGlyphStatic type={item.type} />
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-2 py-4 text-center text-xs text-muted-foreground">No items match.</li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function ItemGlyphStatic({ type }: { type: string }) {
  if (type === "link") return <Globe className="h-3.5 w-3.5 text-teaching" />;
  if (type === "upload") return <Upload className="h-3.5 w-3.5 text-ai" />;
  return <FileText className="h-3.5 w-3.5 text-trust" />;
}
