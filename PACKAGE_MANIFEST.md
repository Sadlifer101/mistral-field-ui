# Package Manifest — MISTRAL_UI_PORTABLE

## Identity

| Field | Value |
| --- | --- |
| Archive | `MISTRAL_UI_PORTABLE.zip` |
| Built from | `mistral-full/mistral-ui-package/mistral-ui` @ commit `fddecb5` (working tree clean) |
| Also contains | `convex/_generated/*` (generated Convex **client** references, from `mistral-full/convex/_generated`) |
| Packaging date | 2026-11-21 |
| Packaging host | Windows 11, Node `v22.23.2`, npm `10.9.8`, Vite `8.3.8`, TypeScript `7.0.2` |
| Archive checksum | see `MISTRAL_UI_PORTABLE.zip.sha256` (written next to the archive after it was sealed) |
| Per-file checksums | `SHA256SUMS.txt` (inside this archive, `sha256sum -c` compatible) |

## Contents by area

| Area | Files | Notes |
| --- | --- | --- |
| `mistral-ui-package/mistral-ui/` (app root) | 12 | HTML entry points, `package.json`, both lockfiles, `tsconfig.json`, `vite.config.ts`, `.env.example`, `.gitignore`, `metadata.json` |
| `src/` application source | 50 | components, nurse modules, utils, theme, preview harness, assets |
| `public/media/` runtime assets | 2 | meadow video + poster (nurse background) |
| `convex/_generated/` client references | 5 | `api.js`, `api.d.ts`, `dataModel.d.ts`, `server.js`, `server.d.ts` |
| Documentation (this package) | 4 | `INTEGRATION_README.md`, `FUNCTIONALITY_CHECKLIST.md`, `PACKAGE_MANIFEST.md`, `SHA256SUMS.txt` |

Exact file list and byte sizes: see `SHA256SUMS.txt` (one line per file, with its SHA-256).

## Explicitly excluded

| Excluded | Why |
| --- | --- |
| `node_modules/` | ~500 MB of registry content; reinstall with `npm ci`. |
| `dist/` | Build artifact produced by `npm run build`. |
| `.env.local` | Machine-specific (`VITE_CONVEX_URL=http://127.0.0.1:3210`); replaced by the sanitized `.env.example`. |
| `.git/` | History not required for integration. |
| Convex backend sources (`convex/*.ts`, `mistral-backend/**`) | You own the backend; shipping a copy would invite a second implementation. |
| `.convex/` local deployment state, storage blobs, uploads | Runtime/patient data. |
| OAuth credentials, API keys, tokens | Secrets. |
| UI Forge reference library, Clara Agent app, screenshots, QA captures | Not required at runtime. |

## Verification record

| Check | Command (run in the extraction of this archive) | Result |
| --- | --- | --- |
| Module graph / production build | `npx vite build` | **PASS** — `2259 modules transformed`, `built in 328 ms`, exit 0; emits `dist/index.html` + CSS + JS + the meadow video/poster and both photographs |
| Type check | `npx tsc --noEmit` | **PASS** — exit 0, no diagnostics (see caveat below) |
| Runtime assets present | inventory of `public/media` + `src/assets/images` | **PASS** — `meadow-8s.mp4` (461,524 B), `meadow-poster.jpg` (30,283 B), 3 photographs |
| No secrets | pattern scan for `AIza…`, `sk-…`, `-----BEGIN … KEY`, `client_secret=`, JWT-shaped strings, `.env.local` | **PASS** — none found; `.env.example` carries names only |
| No local database / uploads | pattern + path scan | **PASS** — no `.convex/`, no recordings, no documents |
| Archive extracts | extraction to a clean directory, then per-file SHA-256 compare against the staged tree | **PASS** — see report |

### Caveats on the two checks (read before quoting these results)

1. **`tsc --noEmit` requires the backend.** `convex/_generated/api.d.ts` is a *type-only* re-export of your
   backend modules (`../triageLogbook.js`, `../schema.js`, `../aiPipeline.js`, …). Those modules are **not**
   shipped. The check above was run in the extracted archive **plus a temporary copy of the backend `.ts`
   sources** (helper only, deleted afterwards, never part of the archive). In a repository that already has
   `convex/`, no helper is needed: run `npx convex dev` to regenerate, then `npm run lint`.
2. **Both checks were run from the archive contents**, mirroring a repository layout (dependencies installed at
   the level that contains `convex/`, which is normal whenever the backend is installed at the repo root).
   The generated client imports `convex/server`, so `convex` must be resolvable from the directory that holds
   `convex/_generated`. If you extract this archive on its own, run `npm ci` in `mistral-ui-package/mistral-ui`
   and place the app inside a tree that has `convex/` beside a `node_modules` (your repository), or install
   dependencies at the package root as well.

No browser-based end-to-end run of the packaged archive was performed as part of packaging, and **no claim is
made that this frontend has been tested against your Convex deployment**.

## Reproducing the packaging

```powershell
# from the source repo (read-only)
robocopy .\mistral-full\mistral-ui-package\mistral-ui <stage>\mistral-ui-package\mistral-ui /E /XD node_modules dist /XF .env.local
robocopy .\mistral-full\convex\_generated <stage>\convex\_generated /E /XD ai
# then: write INTEGRATION_README.md, FUNCTIONALITY_CHECKLIST.md, PACKAGE_MANIFEST.md, .env.example,
#       generate SHA256SUMS.txt, zip the stage, hash the archive.
```

The source project was not modified: no files were added, edited or deleted in `mistral-full` during packaging
(the only writes were inside `.handoff/` under `HEALTHHACK/`).

## Notes for the integrator

- Duplicate asset: `src/assets/images/nurse_bg.jpg` is byte-identical to
  `src/assets/images/hero_botanical_meadow_1794722134618.jpg` (same SHA-256), so the bundler emits it once.
  It can be de-duplicated without changing behaviour, but this package keeps the source tree untouched.
- `bun.lock` is included for provenance; `package-lock.json` + `npm ci` is the supported path.
- The three dev-only HTML harnesses (`nurse.html`, `preview.html`, `motion.html`) and `src/preview/*` are not
  part of a production build. Keep or delete them; see `INTEGRATION_README.md` §9 for the `/nurse` dev-server
  rewrite that exists because `nurse.html` sits at the app root.
