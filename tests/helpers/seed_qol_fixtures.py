#!/usr/bin/env python3
"""Seed a scheduled session for the demo user so the iCal browser check has data.

Idempotent: skips when a 'QoL Verification Session' already exists.

Usage:
    python3 tests/helpers/seed_qol_fixtures.py
Requires docker CLI with the local supabase_db container running.
"""
import subprocess
import sys

CONTAINER = "supabase_db_mfeinmphbsnjcchkmldi"
USER_ID = "a1d676d3-1a76-401f-bc30-0e4195569e26"  # handle 'testuser'

SQL = """
-- The lightbox check navigates to the 'Signal Garden' project. The demo seed
-- doesn't create it, so insert it here (idempotent) before attaching gallery
-- images to it below.
INSERT INTO projects
  (id, profile_id, title, description, goal, vision, status, stage, visibility,
   progress_percent, started_at, tags, is_featured, looking_for_feedback,
   looking_for_collaborators, gallery, resources, links, media, readme)
SELECT '51000000-0000-0000-0000-000000000001', '{uid}', 'Signal Garden',
       'A browser canvas that grows generative artwork from ambient sound.',
       'Ship an embeddable garden that any project can plant on its landing page.',
       'Creative coding should feel like gardening: plant seeds, tend, and watch patterns emerge.',
       'active', 'building', 'public', 30, now() - interval '60 days',
       ARRAY['generative-art', 'creative-coding', 'web-audio'],
       false, true, true, '[]'::jsonb, '[]'::jsonb, '{{}}'::jsonb, '[]'::jsonb,
       E'# Signal Garden\\n\\nGenerative artwork grown from ambient sound in the browser.\\n\\n## Current focus\\n- Seed-palette editor\\n- Embeddable widget'
WHERE NOT EXISTS (
  SELECT 1 FROM projects WHERE title = 'Signal Garden'
);

INSERT INTO sessions (organizer_id, title, description, session_type, status,
                      starts_at, ends_at, duration_minutes, timezone, location)
SELECT '{uid}', 'QoL Verification Session', 'Browser-check for the iCal export.',
       'general', 'scheduled',
       now() + interval '3 days', now() + interval '3 days' + interval '45 minutes',
       45, 'UTC', 'Tethyr Lab'
WHERE NOT EXISTS (
  SELECT 1 FROM sessions WHERE title = 'QoL Verification Session'
);

-- The sessions page lists sessions where the user is organizer OR participant;
-- the organizer must also exist as a participant row for it to appear.
INSERT INTO session_participants (session_id, profile_id, role, status)
SELECT s.id, '{uid}', 'organizer', 'accepted'
FROM sessions s
WHERE s.title = 'QoL Verification Session'
  AND NOT EXISTS (
    SELECT 1 FROM session_participants sp
    WHERE sp.session_id = s.id AND sp.profile_id = '{uid}'
  );

-- Attach external-image gallery entries to the shelf's demo project so the
-- lightbox zoom path has real data. Only touches the seeded 'Signal Garden'
-- project when its gallery is still empty.
UPDATE projects
SET gallery = '[
  {{"url": "https://picsum.photos/seed/tethyr-qol-1/1200/800", "caption": "Interface study", "type": "image"}},
  {{"url": "https://picsum.photos/seed/tethyr-qol-2/1200/800", "caption": "Color system", "type": "image"}},
  {{"url": "https://picsum.photos/seed/tethyr-qol-3/1200/800", "caption": "Motion pass", "type": "image"}}
]'::jsonb
WHERE title = 'Signal Garden' AND gallery = '[]'::jsonb;
"""


def main() -> int:
    result = subprocess.run(
        [
            "docker",
            "exec",
            CONTAINER,
            "psql",
            "-U",
            "postgres",
            "-d",
            "postgres",
            "-c",
            SQL.format(uid=USER_ID),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        return 1
    print("seed ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
