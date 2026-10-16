# CoLeaf – The human layer for your repo

Oct 15, 2026 · @Yehonatan

## Project description

CoLeaf is a desktop text editor for the `.md` files in your repo, nothing more. One repo holds both code and docs: use your code editor (e.g. VS Code) for code, and open the same repo folder in CoLeaf when you work on Markdown.

- **Same folder:** both apps read and write the same files on disk.
- **Git built in:** CoLeaf pulls, commits and pushes, so changes sync with GitHub like any other tool.
- **AI context from the repo:** agent instructions and context files live in the repo, so any AI agent in CoLeaf sees the same context as the agents in your code editor.

How it is built (software, structure, decisions): [architecture.md](architecture.md)

**Pitch:** Word-style teamwork on docs, with the Git repo as the database, and AI working in the same repo as the team.

**For:** All the power of a repo. None of the nerd. For you, or your whole team. (Architects, senior engineers, PMs, designers, writers, legal, researchers.)

**Competition (Oct 2026):** OpenKnowledge (free, GPL desktop editor + Git + AI) is the closest; also Mintlify editor (web, docs sites), Nimbalyst (developers), Graft (Git-stored comments, experimental), GitBook. **Our edge:** truly for non-developers (Word-like ribbon), Word-style comments with permissions and review, readable diffs on the formatted page (not raw text), friendly Sync and conflicts, Word/PDF export.

## Stage 1 – Core editor + basic Git

### Goal

Build a human-friendly Markdown view in the CoLeaf desktop app that people edit directly, with every edit saved as plain `.md`. One file format that works for humans and AI agents together.

### Requirements

1. **View-only editing:** all editing happens in our rendered view; the Markdown updates as you type and is written to the `.md` file on save (Ctrl+S), like Word.
2. **Formatting without raw syntax:** a Word-like toolbar and keyboard shortcuts replace typing `#`, `**`, `-`, etc.
3. **Custom shortcuts:** users can bind their own keys to any supported syntax.
4. **Full standard Markdown (CommonMark + GitHub-flavored):** headings, bold/italic/strikethrough, lists, task lists, links, images, tables, code blocks, quotes, horizontal rules.
5. **Round-trip fidelity:** untouched files never change (open + save with no edits = no git diff). Edited files are saved in one consistent Markdown style (Prettier-compatible).
6. **Shows what GitHub shows:** everything GitHub renders formatted, CoLeaf renders formatted too, from Stage 1: embedded HTML (through a safe sanitizer) and math (LaTeX), besides Mermaid diagrams; maps, 3D models and PlantUML follow in Stage 4. Each such block gets a small "edit code" button and is saved back unchanged. Nothing is ever dropped from the file, and embedded scripts or styles never run. Needs new libraries, approved when we reach them (see TODOs).
7. **Simple Git:** a Sync button (pull, commit, push) and basic version history.
8. **Friendly conflicts:** when Sync finds the same lines changed by two people, show Mine and Theirs side by side with Keep mine, Keep theirs or Keep both. Never raw Git markers.
9. **Maximize the document area:** the main UI rule; everything else stays small or can be hidden.
10. **Left-to-right only:** no Hebrew or other right-to-left text in this stage.
11. **No AI** in this stage.
12. **No typed Markdown shortcuts:** typing `# ` or `- ` stays plain text (saved as `\#`, `\-`). Formatting only via the ribbon and keyboard shortcuts (Ctrl+B etc.).

### Design

#### Frame

Always visible, with or without a project open.

| Part | No project open | Project open |
| --- | --- | --- |
| Menu bar | File, Help | File, Help |
| Left sidebar | "No project open" with Open project and Clone from GitHub buttons | One view at a time, picked from the left icon bar, like VS Code. **Explorer view:** header "Explorer" + grey branch name; sections Project (folder structure) and History (commits of the focused file, this branch only). **Sync view:** see Sync view below. Clicking the active icon hides the sidebar |
| Tab bar | Welcome tab (the opening screen) | One tab per open `.md` file |
| Account (bottom-left, above the gear) | Signed out: "Sign in with GitHub". Signed in: your GitHub picture; click for Sign out | Same |
| Settings (gear, bottom-left) | Light theme (dark comes in Stage 4) | Same |
| Window controls (top-right) | Minimize, maximize, close | Same; closing with unsaved changes asks "Save?", like Word |
| App icon | Simple placeholder (window, taskbar, installer); final logo in Stage 4 | Same |
| Left icon bar | Explorer icon at the top; account and gear at the bottom | Explorer and Sync icons at the top, each opening its own sidebar view; Sync shows a badge with the number of changed files. Account and gear at the bottom |
| Search (top bar, center) | Hidden | Search box across all .md files in the project. Inside a document: Find / Replace (Ctrl+F) in the ribbon |

**Menu bar**

| Menu | Item | What it does |
| --- | --- | --- |
| File | New File | Creates a blank `.md` file |
| File | Open | Opens a project folder or a single `.md` file |
| File | Save | Writes the current tab to disk (Ctrl+S) |
| File | Close Project | Closes the project and returns to the Welcome tab |
| Help | User Guide | Opens a short guide to using CoLeaf, including a "How Publish works" chapter (Git basics). In-app messages link to it with "Learn more" |
| Help | Keyboard Shortcuts | Lists all shortcuts, including custom ones |
| Help | About CoLeaf | Shows the version and license info |

#### Welcome tab

The opening screen, shown in a tab when no project is open.

| Button | Does |
| --- | --- |
| Open project | Pick a folder or repo on your computer |
| Clone from GitHub | Download a repo by its link |
| Open file | Edit a single `.md` file |
| New file | Start a blank `.md` file |
| New folder | Start a new project with no Git yet |
| Recent | List of recently opened projects |

#### Project view

Shown after opening a project or a single file.

| Part | What it does |
| --- | --- |
| Tab = document | Each tab is its own document, like a Word file, with its own formatting toolbar at the top |
| File name | Shows only on the tab, not again above the document |
| Document area | Gets most of the window; most people will close the sidebar while writing |
| Unsaved dot (●) | Shows on the tab when there are changes not yet saved (Ctrl+S) |
| Side by side | Up to 3 documents next to each other; drag to set their widths. No top/bottom split. History follows the focused document |
| Outside changes | Rare: another program on this computer (e.g. VS Code) changed an open file. No auto-reload; CoLeaf asks: Keep mine (my version wins on next save) or Reload (load the new version; my unsaved edits are lost) |
| Non-.md files and folders | Files that aren't `.md` (can't be opened), and folders with no `.md` file at any depth, are shown greyed in the Project section; `node_modules` and git-ignored folders are never scanned and always greyed. The "Only .md" tick in the section header hides them all. .git and system files are always hidden |
| Pictures | Pasted or dragged pictures are saved under the root images/ folder, in a subfolder mirroring the doc's path (images/docs/plan/diagram-1.png). Created only when a doc gets its first picture. Moving or renaming a doc renames its image folder and updates its links automatically |
| Restore a version | Right-click a version in History → Restore. If the current version isn't committed yet, a short message explains it will be lost, with three buttons: Override (restore, lose current), Commit and restore (current version kept in History first), Cancel. The restored file is a normal change, committed on the next Sync. Nothing in History is deleted |
| Page layout | A soft off-white sheet (about A4 width, \~800 px) centered on the grey background, below a slightly darker toolbar. On a narrow window or split pane the sheet shrinks and text re-wraps (no sideways scrolling). No page breaks; CoLeaf never adds line breaks to the file |
| Editing like Word | Blinking cursor; select with mouse or Shift+arrows (highlighted in the accent tint); Ctrl+C/X/V, Ctrl+A, Ctrl+Z/Y; double-click selects a word, triple-click a paragraph. Pasting from Word or the web keeps what Markdown supports (bold, lists, links, tables) and drops the rest (fonts, colors) |
| Outline (TOC) | Slim column at the left edge of the page, built automatically from the headings, like Word's Navigation pane; one button shows or hides it; click a heading to jump. Follows the focused tab. Nothing is written to the file |

#### Sync view

Its own sidebar view (Sync icon in the left icon bar) for sharing work through Git, in plain words.

| Part | What it does |
| --- | --- |
| Changed files | Files changed since the last Sync, each with a checkbox to include it |
| Message | A short note on what changed; required when there are changes |
| Sync button | With changes: commit → pull → push. No changes: pull only (get the latest) |
| Help | Messages such as "Sync your changes first" link to the User Guide with "Learn more" |

### Work plan

**Stage 1a – Prove the core**

Build this first and see it work; then review and detail 1b. Stage 1 rows of [markdown-spec.md](markdown-spec.md) are editable (no ribbon); everything else is shown as a raw block and saved unchanged.

- [x] Set up the desktop app project
- [x] Open a repo folder and show a file tree of `.md` files
- [x] Add the editor with Markdown read and write (remark + bridge) and basic keyboard shortcuts
- [x] Save: never rewrite untouched files; save edited files in one consistent style; test the round-trip (open and save with no edits = no git diff)
- [ ] Test on real repo files

**Stage 1b – Complete Stage 1**

**Part A – Formatting spec**

- [ ] Map every supported Markdown syntax in one table: Description | Markdown | Toolbar button | Shortcut
- [ ] Decide which items get a toolbar button and which get a default shortcut (common ones: bold, italic, headings, lists)
- [ ] Define custom shortcuts: users bind their own keys to any syntax
- [ ] Toolbar design: a mockup of the layout and button groups

**Part B – Build**

- [ ] Ribbon and shortcuts for the Stage 1 rows (from Part A)
- [ ] Formatted read-only views of all other rows: tables, task lists, strikethrough, alerts, footnotes, Mermaid, math and common HTML (`<img>`, `<details>`, `<sub>`/`<sup>`, `<kbd>`, `<br>`, …); libraries to approve first (KaTeX, a safe HTML sanitizer)
- [ ] Git: Sync button (commit, pull, push) with friendly conflicts
- [ ] History and Restore
- [ ] Test on real repo files

## Release 1 – First public version

### Goal

Ship Stage 1 to testers and the public as a signed app that updates itself.

### Requirements

1. **Signed installers:** Windows (no "unknown publisher" warning) and macOS (notarized).
2. **Auto-update:** new versions install themselves.
3. **Crash reports:** errors reach us so we can fix them.

### Work plan

TODO

## Stage 2 – Co-Work

### Goal

Word-like permissions per `.md` file (read only, comment, write), with comments and review requests tied to GitHub accounts.

### Requirements

1. **Branches:** create, switch and merge branches.
2. **Branches view:** its own sidebar view (Branches icon in the left icon bar), with the branches drawn as an actual tree (graph); click a commit to see its changes.
3. **Ownership per file:** a `.md` file can have one owner or several; others get view-only or comment access.
4. **Comments like Word:** a sidebar where each comment points to the exact text, shows the commenter's name, an @ for the person it's addressed to, and the comment.
5. **Discussion threads:** people reply under a comment; anyone with edit permission can close (resolve) the thread.
6. **Comments sync:** comments are pulled and pushed with Sync, so everyone sees the same threads.

### Design

TODO

### Work plan

TODO

## Stage 3 – AI integration

### Goal

Integrate AI into CoLeaf so it works on our `.md` files like Claude Code works on code, plus Claude Docs-style chat on a selected paragraph.

### Requirements

1. **Review AI edits (baseline):** AI changes appear as red/green pending edits for the user to accept or reject. In auto mode, AI applies changes directly.
2. **Chat on selection:** mark text and open a small AI chat right there, focused on that paragraph (like Claude Docs).
3. **AI access:** version 1 uses the user's own Claude API key; "log in with Claude" only if Anthropic approves it later.

### Design

**Right sidebar (concept):** an AI panel on the right, like the chat panel in VS Code. The first version supports Claude only.

### Work plan

TODO

## Stage 4 – UI

### Goal

A full-window, Word-like workspace with modern styling, working side by side with VS Code on the same repo and supporting every feature from Stages 1–3.

### Requirements

1. **Final logo:** replaces the Stage 1 placeholder icon.
2. **Final name:** confirm the product name before launch.
3. **Dark theme:** a dark version of the whole app, switched in Settings.
4. **Viewers:** map (GeoJSON/TopoJSON), 3D model (STL) and PlantUML blocks rendered like GitHub and GitLab do; libraries to approve first.

### Design

- [ ] If the redesign needs a real designer, design it in Figma and connect the Figma MCP so Claude builds from those designs.
- [ ] Decide the full editing table and ribbon UI for all "Later" rows in [markdown-spec.md](markdown-spec.md).

### Work plan

TODO

## Stage 5 – Full source preservation

### Goal

Saving changes only the parts the user edited; the rest of the file stays byte-for-byte as it was, even in files written by other tools.

### Requirements

TODO

### Design

TODO

### Work plan

TODO

## Ideas for later stages

- **Diagram creator:** drag-and-drop diagram editing for non-developers, saved as text inside the `.md` (Mermaid) so Git shows changes and AI can read and edit it. A key differentiator.
- **View-only preview of images and PDFs** from the sidebar (architects' drawings), without leaving CoLeaf.
- **Richer tables:** Markdown tables can't merge cells but are easy for AI agents; consider HTML tables or another approach for merged cells.
- **Slash menu:** type `/` to insert Heading, Table, Image, Quote, Code block or Diagram, with a small live preview (seen in a Claude Docs–style editor).
- **Live cursors:** show teammates and the AI as named cursors while they edit (with Co-Work and AI stages).
- Optional Settings toggle for typed Markdown shortcuts (`# ` → heading), if power users ask

## TODOs

- [x] Decide the best platform: desktop app (Electron/Tauri) vs VS Code extension vs hybrid → Electron
- [x] Web research on the best tools, libraries and AI services for the build → see [architecture.md](architecture.md)
- [x] Review the repo description
- [x] Confirm the tech stack → confirmed (see Architecture); first slice tests the Markdown bridge
- [ ] Stage 1 Part A: formatting table + toolbar mockup
- [x] Add `AGENTS.md` to the repo
- [ ] Co-Work: find a way to store and enforce per-file ownership, permissions (edit / comment / view) and comments through GitHub. Foundation for Google Docs–style co-work + AI later
- [x] Deep research before implementation: which AI tools, MCP servers, paid tools and skills to use for building CoLeaf
- [ ] Export ("compiler"): design with the user how `.md` files compile to Word and PDF so the output always looks good (page size, page breaks, styles)
- [x] Color palette: replace the current dark green with a livelier, natural green (same lightness and strength, new hue)
- [ ] Part A: check that every Markdown syntax is reachable from the ribbon, and list the blocks that show a preview plus a small "edit code" button (Mermaid, code blocks, math, raw HTML, front matter...)
- [ ] Think of a better tagline than "All the power of a repo. None of the nerd."
- [ ] Approve the libraries for GitHub-style rendering before building it: for Stage 1b, KaTeX (math) and a safe HTML sanitizer (e.g. DOMPurify); for Stage 4, a map viewer for GeoJSON/TopoJSON (e.g. Leaflet), a 3D viewer for STL (e.g. three.js) and a PlantUML renderer
