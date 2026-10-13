// Library boards: the kanban itself — draggable columns and cards, column
// settings, and adding columns. Rendered by BoardView (boards.tsx).

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
  ExternalLink,
  FileText,
  Globe,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useCreateCard,
  useCreateColumn,
  useDeleteCard,
  useDeleteColumn,
  useMoveCard,
  useUpdateCard,
  useUpdateColumn,
  type LibraryBoardCard,
  type LibraryBoardColumn,
  type LibraryBoardData,
} from "@/hooks/use-library";
import { cn } from "@/lib/utils";
import { CardDialog, ItemPickerDialog } from "./board-card-dialogs";

export function Kanban({ data }: { data: LibraryBoardData }) {
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

export function AddColumnControl({
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

export function BoardColumnView({
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

export function ColumnSettingsItems({
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

export function BoardCardView({
  card,
  column,
}: {
  card: LibraryBoardCard;
  column: LibraryBoardColumn;
}) {
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

export function BoardCardBody({ card }: { card: LibraryBoardCard }) {
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

export function ItemGlyph({ fields }: { fields: LibraryBoardCard["fields"] }) {
  const type = fields.itemType as string | undefined;
  if (type === "link") return <Globe className="h-3 w-3 shrink-0" />;
  if (type === "upload") return <Upload className="h-3 w-3 shrink-0" />;
  return <FileText className="h-3 w-3 shrink-0" />;
}
