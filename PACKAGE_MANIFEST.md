# Package manifest

## Identity

| Field | Value |
| --- | --- |
| Repository | `Sadlifer101/mistral-field-ui` (public) |
| Origin archive | `MISTRAL_UI_PORTABLE.zip`, SHA-256 `913711fc020a6d4f7d6438cbec38452de3ba2d05d2f1e1826cbfff271ad6a5eb` |
| Source of the UI | `mistral-full/mistral-ui-package/mistral-ui` @ commit `fddecb5` (working tree clean) |
| Generated client refs | `convex/_generated/*` from `mistral-full/convex/_generated` (backend tree byte-identical to `mistral-backend/convex`) |
| Prepared / published | 2026-11-21 |
| Authoring host | Windows 11, Node `v22.23.2`, npm `10.9.8`, Vite `8.3.8`, TypeScript `7.0.2` |
| Per-file checksums | [`SHA256SUMS.txt`](./SHA256SUMS.txt) — every file in this repository except that file itself (`sha256sum -c` compatible, LF endings) |

The repository is the maintained handoff artifact; the archive is its sealed origin and is unchanged.

## Contents by area

| Area | Files | Notes |
| --- | --- | --- |
| `mistral-ui-package/mistral-ui/` (app root) | 12 | HTML entry points, `package.json`, both lockfiles, `tsconfig.json`, `vite.config.ts`, sanitized `.env.example`, `.gitignore`, `metadata.json` |
| `src/` application source | 50 | components, nurse modules, utils, theme, dev-only preview harness, assets |
| `public/media/` runtime assets | 2 | meadow video (451 KB) + poster (30 KB) |
| `convex/_generated/` client references | 5 | `api.js`, `api.d.ts`, `dataModel.d.ts`, `server.js`, `server.d.ts` |
| Documentation | 8 | `README.md`, `INTEGRATION_README.md`, `CONVEX_CONTRACT_MAP.md`, `CURSOR_INTEGRATION_PROMPT.md`, `INTEGRATION_CHECKLIST.md`, `FUNCTIONALITY_CHECKLIST.md`, `PACKAGE_MANIFEST.md`, `SHA256SUMS.txt` |
| Git configuration | 1 | `.gitattributes` (`* -text`, keeps clones byte-identical to the archive) |

Exact paths and hashes: `SHA256SUMS.txt`.

## Document roles

| Document | Owns |
| --- | --- |
| `README.md` | Public landing page: what the UI is, how to preview it, where to start |
| `INTEGRATION_README.md` | Setup, Option A / Option B strategies, environment, auth, aliases, backend concerns, limitations |
| `CONVEX_CONTRACT_MAP.md` | The thirteen Convex references with validators, return fields, call sites, state machines, vocabularies |
| `INTEGRATION_CHECKLIST.md` | Setup and end-to-end verification, including what a green run does not prove |
| `CURSOR_INTEGRATION_PROMPT.md` | Paste-ready agent prompt for the integration work |
| `FUNCTIONALITY_CHECKLIST.md` | Per-feature status and evidence |
| `PACKAGE_MANIFEST.md` | This file: inventory, exclusions, verification record, provenance |

## Explicitly excluded

| Excluded | Why |
| --- | --- |
| `node_modules/`, `dist/` | Reinstall with `npm ci`; build with `npm run build`. |
| `.env.local` | Machine-specific (`VITE_CONVEX_URL` pointed at a local deployment); replaced by the sanitized `.env.example`. |
| Convex backend sources (`convex/*.ts`) | The backend owner keeps control; a copy here would invite a second implementation. |
| `.convex/` deployment state, storage blobs, uploads | Runtime and patient data. |
| OAuth credentials, API keys, tokens, `.git` history of the source monorepo | Secrets and noise. |
| UI Forge library, unrelated applications, QA screenshots | Not required at runtime. |

## Verification record

| Check | Where | Result |
| --- | --- | --- |
| Per-file hashes of the pushed commit vs the sealed archive | this repository | **PASS** — 72/72 documented entries byte-identical, 0 mismatches |
| `npx vite build` | packaged tree | **PASS** — 2259 modules, single `index.html` entry, exit 0 |
| `npx tsc --noEmit` | packaged tree + backend sources for module resolution | **PASS** — exit 0, no diagnostics |
| Archive extraction integrity | `MISTRAL_UI_PORTABLE.zip` | **PASS** — 73/73 files, matching hashes |
| Secret scan (working tree + full history) | this repository | **PASS** — no API keys, OAuth secrets, tokens, private keys, JWTs |
| Local environment / database files | this repository | **PASS** — only `.env.example`, no `.env.local`, no `.convex/` |
| Media provenance | this repository | **PASS** — five project assets, no UI Forge or third-party media |
| Documentation references | this repository | checked against real paths, scripts and exports |

**Not verified**: an authenticated end-to-end run against a live deployment. The authoring deployment held
placeholder Google credentials (`401 invalid_client`), so the authenticated surface was never exercised. See
`FUNCTIONALITY_CHECKLIST.md` for the per-feature breakdown.

### Notes on the type-check

`convex/_generated/api.d.ts` is type-only and imports the backend modules (`../triageLogbook.js`,
`../schema.js`, …). Those modules are not shipped, so `tsc` in this repository alone reports missing modules
until you run `npx convex dev` against your own backend. The recorded pass was produced with the backend
sources present temporarily; the runtime build does not need them.

## Provenance and redistribution

| Item | Status |
| --- | --- |
| Application code | Original work for this project; no third-party library source vendored. |
| `atelier-vale/cinematic-hero` (UI Forge) | Interaction pattern adapted into `src/nurse/MeadowBackdrop.tsx` from the author's own private prototype. The Forge manifest records that no third-party asset redistribution clearance is implied — **none of its media is included**. |
| `editorial-stagger`, `liquid-glass` (UI Forge) | Author's own private project source, no upstream code vendored. Used as a stagger pattern and as a reduced-transparency fallback only. |
| Background media (5 files) | Produced for this project from project-supplied material; re-encoded locally. No stock, clinical or identifiable imagery. |
| Typefaces | Loaded at runtime from Google Fonts; no font binaries redistributed. |
| Preview/demo data | Synthetic (`src/data/mockTriageData.ts`, `src/preview/previewData.ts`); no real patient data. |

## Reproducing the package

```powershell
# from the source monorepo (read-only)
robocopy .\mistral-full\mistral-ui-package\mistral-ui <stage>\mistral-ui-package\mistral-ui /E /XD node_modules dist /XF .env.local
robocopy .\mistral-full\convex\_generated <stage>\convex\_generated /E /XD ai
# docs written, SHA256SUMS.txt generated, stage zipped, archive hashed
```

No file in the source project was added, edited or deleted during packaging or publication.

