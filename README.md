# Detective Hunt Web App - Etrons 2K26

A professional single-page web app prototype for a QR-code detective hunt game.

## Features
- Team creation with member validation (`min 3`, `max 4`) and cap of 20 teams.
- Admin-controlled global timer (start, stop, refresh/reset).
- QR scan simulation workflow:
  - Text QR with valid clue -> +2 points and congratulations popup.
  - Image/emoji QR -> prompts user to scan another QR.
  - Wrong text clue -> prompts user to scan another QR.
- 10 clue slots, each valid clue gives +2 points.
- Leaderboard sorted by:
  1. Highest points
  2. Fastest finish time
- Green point highlighting and stylish game-themed UI.
- User invite link field with one-click copy.

## Run
Open `index.html` directly in a browser, or run a local server:

```bash
python -m http.server 4173
```

Then visit `http://localhost:4173`.

## Notes
- The app currently uses a scan-input simulation for scanned payload text.
- To enable real mobile back-camera scanning, connect this logic with an HTML5 QR scanner SDK/library.
