import { useState } from "react";
import { Columns3, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
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
  useDeleteBoard,
  useLibraryBoard,
  useLibraryBoards,
  useUpdateBoard,
  type LibraryBoard,
} from "@/hooks/use-library";
import { cn } from "@/lib/utils";
import { Kanban } from "./board-kanban";

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
