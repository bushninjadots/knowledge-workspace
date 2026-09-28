-- Library boards: kanban boards inside the personal library. A member can run
-- any workflow they want — the board is theirs. Design:
--
--   library_boards           the board (name, icon, color, like collections)
--   library_board_columns    user-definable columns with position + optional
--                            "done" semantics (WIP counters can skip done)
--   library_board_cards      a card either wraps an existing library_item
--                            (item_id; the card renders its title/type and
--                            deep-links to the item detail page) or stands
--                            alone (own title + arbitrary JSONB fields the
--                            member defines: dates, checklists, links, notes…)
--
-- Ownership mirrors the rest of the library: user_id + "Owner CRUD" policies.
-- No new RPCs, no SECURITY DEFINER — anon EXECUTE surface unchanged.

-- ── TABLES ──
CREATE TABLE IF NOT EXISTS library_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'columns',
  color TEXT NOT NULL DEFAULT 'var(--learning)',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS library_board_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES library_boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  -- A column marked is_done renders count/limit differently (no WIP cap).
  is_done BOOLEAN NOT NULL DEFAULT false,
  -- Optional soft WIP limit; the UI surfaces it, nothing enforces it.
  wip_limit INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS library_board_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES library_boards(id) ON DELETE CASCADE,
  column_id UUID NOT NULL REFERENCES library_board_columns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled card',
  -- When set, the card wraps an existing library item and links to it.
  item_id UUID REFERENCES library_items(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  -- Member-defined fields (dates, checklists, links, notes…) — free-form.
  fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Arbitrary accent for the card edge; empty = no accent.
  accent TEXT,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS ──
ALTER TABLE library_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_board_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_board_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner CRUD boards" ON library_boards;
CREATE POLICY "Owner CRUD boards"
  ON library_boards FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner CRUD board columns" ON library_board_columns;
CREATE POLICY "Owner CRUD board columns"
  ON library_board_columns FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner CRUD board cards" ON library_board_cards;
CREATE POLICY "Owner CRUD board cards"
  ON library_board_cards FOR ALL
  USING (auth.uid() = user_id);

-- ── INDEXES ──
CREATE INDEX IF NOT EXISTS idx_library_boards_user ON library_boards(user_id, position);
CREATE INDEX IF NOT EXISTS idx_library_board_columns_board ON library_board_columns(board_id, position);
CREATE INDEX IF NOT EXISTS idx_library_board_cards_board ON library_board_cards(board_id, position);
CREATE INDEX IF NOT EXISTS idx_library_board_cards_column ON library_board_cards(column_id, position);
CREATE INDEX IF NOT EXISTS idx_library_board_cards_item ON library_board_cards(item_id);

-- ── TRIGGERS (same updated_at convention as the rest of the library) ──
CREATE OR REPLACE FUNCTION update_library_board_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS library_boards_updated_at ON library_boards;
CREATE TRIGGER library_boards_updated_at
  BEFORE UPDATE ON library_boards
  FOR EACH ROW EXECUTE FUNCTION update_library_board_updated_at();

DROP TRIGGER IF EXISTS library_board_cards_updated_at ON library_board_cards;
CREATE TRIGGER library_board_cards_updated_at
  BEFORE UPDATE ON library_board_cards
  FOR EACH ROW EXECUTE FUNCTION update_library_board_updated_at();
