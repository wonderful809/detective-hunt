# Detective Hunt — Etrons 2K26

A mobile-friendly web app for a QR-based detective game.

## Features
- Team creation with constraints: **3 to 4 members**.
- Supports up to **20 teams**.
- Admin controls global timer: **start, stop, refresh**.
- QR clue validation for **10 text clues** (`CLUE-01` ... `CLUE-10`).
- Correct clue gives **+2 points** (shown in green).
- Leaderboard auto-sorts by:
  1. Highest points
  2. Fastest correct-clue time (global timer)
- Wrong / unsupported QR content displays: **"Scan another QR"** message.
- Success popup on correct clue scan.
- Admin mode with shareable player link.

## Run locally
```bash
python3 -m http.server 4173
```

Open:
- User view: `http://localhost:4173`
- Admin view: `http://localhost:4173/?mode=admin`

## Notes
- Camera scanning uses browser `BarcodeDetector` and back camera preference.
- If browser QR detection is unsupported, use the manual QR text input.
