# AGENTS.md

Instructions for any AI coding agent working in this repo (Claude Code, Codex, Cursor and others).

## How to work with the owner

- Answers: max 100 words. No intros, recaps or "let me know" endings.
- Yes/no questions: answer only "Yes" or "No". If "No", add one short line on what's wrong. Explain only when asked "why".
- Prefer a small table or list over paragraphs.
- Step-by-step tasks: one step at a time, then wait.
- Unclear or missing info: ask in one line instead of guessing.
- Before big changes (new library, new folder, refactor, large rewrite): propose a short plan and wait for approval.

## Project

CoLeaf: Word-style editing of a repo's `.md` files, with simple Git and (later) AI, for people who'd rather not touch code.

- What we build, by stage: [docs/plan.md](docs/plan.md)
- How it's built: [docs/architecture.md](docs/architecture.md)
- UI mockups: [docs/ui/](docs/ui/)
- Current phase: **Stage 1a: prove the core** (see "Work plan" in the plan).

`docs/` is the source of truth for what we build and how. Keep [docs/plan.md](docs/plan.md) current: tick a work-plan item (`- [x]`) once it is done and verified. Ask before changing any decision, requirement or design text in `docs/`.

## Stack (confirmed)

| Part | Pick |
| --- | --- |
| App shell | Electron + electron-vite |
| Screen | React + TypeScript |
| Editor | TipTap v3 (ProseMirror); `prosemirror-search` for Find / Replace |
| Markdown | remark + remark-gfm + `@handlewithcare/remark-prosemirror` (front matter is split off by hand; remark-frontmatter misreads files that start with a `---` rule) |
| Diagrams | Mermaid |
| Diffs | jsdiff, shown as highlights on the formatted page (never raw text) |
| Git | dugite (bundled Git) |
| GitHub | GitHub App (device flow) + Octokit; token in Electron `safeStorage` |
| Tooling | Vitest, ESLint + Prettier, `@electron-toolkit/*` (utils, tsconfig, ESLint configs), `@fontsource/ibm-plex-sans`, `lucide-react` (icons), `ignore` (.gitignore rules) |

Don't add libraries outside this list without approval. Not used: Monaco, TipTap typed-Markdown input rules.

## Rules

1. **Save rule:** an untouched file is never rewritten (open + save with no edits = no git diff). Edited files are saved in one consistent, Prettier-compatible Markdown style. Never add hard line breaks.
2. **Plain Markdown only:** files stay GitHub-flavored Markdown. No CoLeaf-only syntax or hidden metadata in `.md` files.
3. **Embedded HTML and other GitHub-rendered content** (math, maps, 3D): shown formatted, HTML through a safe sanitizer; saved back unchanged; scripts and styles never run.
4. **Editable files:** only `.md` and `.markdown`.
5. **Security:** the window has no Node access (`contextIsolation` on, `nodeIntegration` off). All disk and Git work goes through the preload's allowlisted IPC messages.
6. **Left-to-right only:** no RTL support.
7. **No AI features** before Stage 3.
8. **Look:** Leaf palette (accent `#2F7D32`, ground `#F3F3F1`, sheet `#FCFCFB`, ink `#171717`), IBM Plex Sans for the app UI, the system font for documents. See `docs/ui/style.png`. All colors, fonts, sizes and spacing come from one tokens file in `src/renderer/styles/`; never hard-code them in components, so the whole look can be redesigned in one place (Stage 4).
9. **English** for code, comments and commits. Small commits with clear messages.
10. **Tool-neutral context:** shared agent rules live in this file, not in tool-specific files.
11. **Keep the repo clean:** follow the layout below. No new top-level files or folders, and no new dependencies, without approval. No scratch, debug or backup files in the repo; delete temporary files before finishing. Reuse existing helpers instead of adding near-duplicates. One small slice per change, ready to review as a single diff.
12. **Our own code only:** never copy code from other projects, especially GPL ones such as OpenKnowledge; read for ideas, write it fresh. At the end of every stage run `npm run compliance -- --stage <id>` and commit its report; when a full stage is complete (Stage 1, 2, …) add `--release`, which also runs ScanCode. Dependency licenses must be on the allow list in `compliance/policy.json`; exceptions are for dev-only packages, never for anything shipped.

## Layout

Standard electron-vite layout:

| Folder | Holds |
| --- | --- |
| `src/main/` | Background (Node.js): files, Git, later AI |
| `src/preload/` | The safe bridge: the only allowed IPC messages |
| `src/renderer/` | The window (React): everything the user sees |
| `tests/` | Round-trip, Git and end-to-end tests |
| `compliance/` | License and code-origin checks; one report per stage in `reports/` |

Full planned tree: [docs/architecture.md](docs/architecture.md#repo-layout).

## Commands

| Command | Does |
| --- | --- |
| `npm install` | Installs dependencies and downloads Electron |
| `npm run dev` | Starts the app with hot reload; Chromium remote debugging on port 9222. `COLEAF_PROJECT=<folder>` opens that folder at start (dev only). If it crashes with `reading 'isPackaged'`, unset `ELECTRON_RUN_AS_NODE` first (VS Code's extension host sets it, and Electron then runs as plain Node) |
| `npm run check` | Typecheck + lint + tests. Must pass before a change is finished |
| `npm run typecheck` | TypeScript for both the background and the window |
| `npm run lint` | ESLint |
| `npm run test` / `npm run test:watch` | Vitest, once / on every change |
| `npm run format` | Prettier on the repo (Markdown is never formatted, see `.prettierignore`) |
| `npm run build` | Typecheck + production build to `out/` |
| `npm run start` | Runs the production build |
| `npm run compliance -- --stage <id>` | Checks dependency licenses against `compliance/policy.json` and writes `compliance/reports/stage-<id>.md`; `--release` adds the ScanCode pass (needs Python and pipx) |

## Testing

- Any change to Markdown reading or saving must pass the round-trip tests: golden `.md` files in `tests/roundtrip/<section>/`, one per row of `docs/markdown-spec.md`, where open + save must be byte-identical (Stage 1 rows must also be what Prettier writes). Alternate spellings live in `tests/roundtrip/normalize/` as `.in.md` → `.out.md`; `properties.test.ts` saves random documents and random edits.
- Every Markdown bug fixed gets a new golden file. Known gaps are listed in `roundtrip.test.ts`, never silently skipped.
- Git features are tested against temporary repos, never the real one.
- `npm run check` must pass before a change is finished. Claude Code runs it automatically through the hooks in `.claude/settings.json` (Prettier after every edit, `npm run check` when a turn ends); other agents run it themselves.
