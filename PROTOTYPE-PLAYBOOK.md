# Junkola Hyperspace — prototype playbook

How to add a new clickable prototype to the portal. Read this at the start of every
vibe-dev session so the repo stays consistent.

## The repo

- GitHub: `junkola-scout/plana-benchmark` (branch `main`, public)
- Live: https://junkola-scout.github.io/plana-benchmark/ (GitHub Pages, auto-deploys on push;
  the `deploy` job occasionally stalls in GitHub's queue — re-run it from the Actions tab)
- Push access: attach the repo with push access at the start of a session, clone fresh to
  `/home/claude/plana-benchmark`, commit as Scout, push to `main`.
- Index is password-gated (client-side only, convenience not security).

```
index.html                       portal table of contents — add a card for every new prototype
manifest.webmanifest / sw.js     PWA; start_url is platform/platform.html
shared/junkola.css               THE design system — tokens + component classes (link it, don't copy it)
shared/junkola-mark.svg          mark only (orange tangle → line)
shared/junkola-wordmark-white.svg  lockup for navy surfaces  (placeholder vector; swap for raster brush mark)
shared/junkola-wordmark-navy.svg   lockup for cream surfaces
platform/platform.html           the main app shell (530 KB, sidebar + chat/insights/calendar)
platform/login.html              sign-in (Tailwind-compiled, YouTube intro modal)
document-manager/, due-diligence/, acquisition/, capture-companion/, capture-mobile/   one folder per prototype
capture-companion/app/           Electron app (the only runnable thing here) — see its README; node_modules/ and dist/ are gitignored
```

## Brand system (captured from junkola.ai 2026-11-04)

| token | value | use |
|---|---|---|
| `--bg` | `#10182A` | navy base, every app surface |
| `--text` | `#F2E9D7` | paper cream — never pure white |
| `--brand-orange` | `#F45209` | primary accent, CTAs, active states |
| `--brand-red` | `#E0341C` | gradient start, danger accents |
| `--brand-amber` | `#F7C21B` | yellow highlight, gradient end |
| `--surface` / `--raised` | `#161F34` / `#222D48` | cards, hover |
| `--font-sans` | Libre Franklin 400/600/800 | everything |
| `--font-mono` | IBM Plex Mono | serials, code, numbers |

Rules:
- Ink on orange fills is **navy**, not cream (site convention; cream-on-orange fails contrast).
- Primary button = cream fill, navy text. Brand button = orange gradient, navy text.
- Product name is **Junkola Hyperspace**. Descriptor line is **"Company awareness"**.
  Tagline: "Chaos in, clarity out." / "Communication clutter into company awareness."
- Demo data stays a fictional customer. Don't put real PLANA/Plans.aero content in new work.

## Building a new prototype

1. **Scope it in one paragraph first** — which user, which job, which 3–5 screens. Prototypes
   here are single self-contained HTML files; no build step, no framework unless it's a
   compiled bundle you're pasting in whole.
2. **Start from the shell**: `<link rel="stylesheet" href="../shared/junkola.css">` then a
   page-local `<style>` *after* it. Never re-declare `:root` tokens. Use `.app > .sidebar + .main`,
   `.topbar`, `.card`, `.chip`, `.btn*`, `.ovl`/`.drawer`, `.table` — they're already styled.
3. **Logo**: `<img src="../shared/junkola-wordmark-white.svg" alt="Junkola Hyperspace">` in `.ws`.
   Favicon: `<link rel="icon" href="../shared/junkola-mark.svg">`.
4. **Seed data lives in a `const` block at the top of the script** so it's easy to find and
   rewrite. Give records serials (`F-00019`, `DOC-0142`) — the house style traces everything.
5. **Add the card to `index.html`** under the right workstream (or a new one) — eyebrow,
   title, two-sentence description, path.
6. **Verify before pushing**: render at 1440 and 390 wide in Playwright, check `document.fonts`
   has Libre Franklin, zero console errors, run the link checker, grep for stray `PLANA`.
7. **Commit message**: imperative subject, body says what the prototype is for and what's
   mocked vs. wired.

## The Electron app (capture-companion/app)

The one non-prototype: a real always-on-top companion. `npm install && npm start`. Builds with
`electron-builder`; Linux-made Mac builds are unsigned (ad-hoc sign on the Mac, see README).
Reuses `shared/` by copy so it's self-contained. Smoke test: `JUNKOLA_SMOKE=/tmp/p.png npx electron .`.

## Known gaps / TODO

- `platform/login.html` still links Terms / Privacy / Tutorial to `platform.pioneerxity.ai` (PLANA-era
  URLs). Repoint when Junkola has its own pages.
- Logo SVGs are vector stand-ins drawn in the lockup's style (Scout: fine for now). His real mark is
  raster (brush drawing). When ready, replace `shared/junkola-wordmark-*.svg` and `junkola-mark.svg` with the
  real assets (keep filenames, or update the ~12 references).
- Only `document-manager.html` and new pages link `shared/junkola.css`; the older pages still
  carry inline token copies (already re-tokened to Junkola values). Migrate when touching them.
