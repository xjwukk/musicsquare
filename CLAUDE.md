# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

MusicSquare is a single-file static web app for searching, playing, and downloading music from multiple Chinese music platforms. All code lives in `index.html` (~3400 lines) — HTML structure, CSS styles, and JavaScript logic are embedded in one file. No build tools, no npm dependencies, no framework.

Live demo: https://charlespikachu.github.io/musicsquare/

## How to run locally

Since this is a pure static HTML file, use any static file server:

```bash
# Python (simplest)
python -m http.server 8080

# Or just open index.html directly in a browser
```

Then navigate to `http://localhost:8080` and open `index.html`.

## Architecture

### Three-panel layout (CSS Grid)
- **Left panel** — Search: keyword input, source checkboxes (Netease/QQ/Kuwo/JOOX), per-source limit selector, mini search results list
- **Center panel** — Player: cover art with spinning disc placeholder, track metadata, progress bar, playback controls, volume slider, time-synced lyrics display
- **Right panel** — Playlist: three tabs (search results / favorites / custom playlists), play mode toggle (list/single/shuffle), playlist CRUD (create/import/export/delete)

### State management
A single global `state` object (see `const state = {...}` around line 1681) holds everything:
- `language`, `enabledSources`, `perSourceLimit` — search config
- `searchKeyword`, `searchResults`, `trackMap` (Map) — search cache
- `favorites`, `playlists` — user library
- `currentTrack`, `playContext` (type/index/playlistId), `playMode`, `isPlaying` — playback state
- `lyricLines`, `currentLyricIndex` — lyrics state

### API integration (4 music sources)

| Source  | Search API                                    | Details API                                  |
|---------|-----------------------------------------------|----------------------------------------------|
| Netease | `api.qijieya.cn/meting/` (meting search)      | `api.qijieya.cn/meting/` (url + lrc by id)   |
| QQ      | `tang.api.s01s.cn/music_open_api.php` (list)  | `tang.api.s01s.cn/music_open_api.php` (by mid) |
| Kuwo    | `kw-api.cenguigui.cn/` (search by name)       | `kw-api.cenguigui.cn/` (detail by rid)       |
| JOOX    | `apicx.asia/api/joox_music` (search)          | `apicx.asia/api/joox_music` (detail by n)    |

Key implementation details:
- Search results are **interleaved** across sources (round-robin: netease → qq → kuwo → joox) via `getInterleavedSearchList()`
- Each track gets a compound `uid` like `netease-{songId}` or `qq-{mid}` for deduplication via `state.trackMap`
- Audio details (URL + lyrics) are fetched lazily on play via `ensureTrackDetails()` → source-specific `fetch*Details()` functions
- Audio quality is inferred from URL file extension (FLAC/WAV/APE → LOSSLESS, otherwise → 320K)
- JOOX probes multiple quality tiers (Atmos, FLAC, Hi-Res, OGG 320, MP3 320, etc.) with HEAD/ranged GET to find a playable URL

### Data persistence
- All user data stored in `localStorage` under key `pikachu-music-library-v1`
- Language preference: `pikachu-music-lang`
- Serialization via `serializeTrack()` / `deserializeTrack()` strips transient fields (audioUrl, lrc) before storage
- Import/export uses JSON files; import merges into existing library

### LRC lyrics parsing
`parseLRC()` parses standard `[mm:ss.xxx]` LRC format. `updateLyricsHighlight()` finds the current line by time and auto-scrolls the lyrics container.

### Visual effects
- **Particle background**: Canvas-based particle system with mouse repulsion and audio-reactive brightness/size (via `audioLevel`)
- **Ripple effect**: Dual-circle expanding rings on pointerdown for elements with `.ripple-target`
- **Lyrics glow**: Active line gets gradient text with glow shadow; container has animated conic gradient and sweeping light overlay. Toggle with `L` key / `state.lyricsAlt`

### i18n
Built-in Chinese/English via the `translations` object at the top of the script. `setLanguage()` updates all `[data-i18n]` elements and placeholder text. Language persists in localStorage.

### Keyboard shortcuts
Space (play/pause), ←/→ (seek ±5s), ↑/↓ (volume), N/P (prev/next track), F (favorite), L (lyrics FX toggle), M (mute), / (focus search), Esc (close modals)

## CI/CD

A GitHub Actions workflow (`.github/workflows/g4f-issue-reply.yml`) auto-replies to new issues using the Python script at `scripts/g4f_issue_reply.py`. The script tries multiple LLM providers in order: OpenAI-compatible API → Ecylt Free GPT → g4f. It reads `README.md` and `index.html` as repository context for generating replies.
