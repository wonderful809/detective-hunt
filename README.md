# Detective Hunt — Etrons 2K26 (Version 2)

A mobile-friendly web app for a QR-based detective game.

## Features
- Team creation with constraints: **3 to 4 members**.
- Supports up to **20 teams**.
- Admin controls global timer: **start, stop, restart timer, refresh game**.
- Leaderboard ranking: **higher points first**, and tie-break on **lower game time**.
- QR clue validation and +2 points for each correct clue.
- Camera scan with `BarcodeDetector` + `jsQR` fallback.
- Supabase sync for teams, clues, and scan logs.

## Supabase database setup
1. Open Supabase SQL Editor.
2. Run `supabase/schema.sql`.
3. Open app in admin mode (`?mode=admin`) and save:
   - Supabase URL
   - Supabase Publishable Key

After saving config:
- Clue codes are loaded from `public.clues`.
- New teams are written to `public.teams`.
- Each correct scan is inserted into `public.scan_logs`.

## Run locally
```bash
python3 -m http.server 4173
```

Open:
- User view: `http://localhost:4173`
- Admin view: `http://localhost:4173/?mode=admin`

## Important mobile note
Camera access requires secure context on phones:
- `https://...` OR
- `http://localhost`
