# CoLeaf – Code map

Oct 19, 2026 · Updated at the end of every slice.

One line per folder and module, then how data flows through them. [architecture.md](architecture.md) says why it is built this way; this file says where things are.

## Background (`src/main/`, Node.js)

| Module | Does |
| --- | --- |
| `index.ts` | App start: the window (no Node access, sandboxed), the right-click menu with spelling suggestions, the `coleaf-image://` scheme for repo pictures, `COLEAF_PROJECT` in development |
| `menu.ts` | The application menu (File, Help), rebuilt whenever the session changes; its labels and drop-downs for the title bar |
| `files/session.ts` | The one open project; the window and the menu mirror it |
| `files/project.ts` | Lists a folder for the tree: folders first, Git internals and system clutter hidden |
| `files/ignore.ts` | Folders never scanned for Markdown: `node_modules` and `.gitignore` rules |
| `files/markdown-index.ts` | Which folders hold Markdown at any depth, built in the background and kept current |
| `files/watch.ts` | One recursive watcher on the project root; changes reported per folder |
| `files/document.ts` | Reads and writes `.md` files, keeping BOM, line endings and final newline |
| `files/images.ts` | Pictures under `md-images/` (one folder per document), the image scheme's lookup, and which pictures no `.md` file uses |
| `git/run.ts` | Runs the bundled Git (dugite): no prompts, no credential helpers, no optional locks; Git's wording as the error |
| `git/repo.ts` | Status (porcelain v2 → branch and changed files), commit of the ticked files only, the identity in Git's config |
| `git/tracker.ts` | The project's status, refreshed after every change on disk (debounced, one run at a time), reported when it differs; every Git action goes through it |
| `git/remote.ts` | Sync: commit → fetch → merge → push with the branch's remote; the token for github.com only, through the process environment; Git's errors sorted into outcomes (offline, denied, conflicts…); Finish sync and Cancel |
| `git/conflicts.ts` | Git's conflict markers split into shared and conflicting parts and joined back from the choices; a file kept whole from one side |
| `auth/github.ts`, `store.ts`, `account.ts` | GitHub's device flow (the public client ID, no secret), the account file with the token encrypted, the account service (signed out / signing in / signed in) |
| `ipc/*.ts` | One file per area (app, project, file, images, git, auth): the handlers behind the preload's allowlist; `windows.ts` sends to every window |

## Bridge (`src/preload/`)

| Module | Does |
| --- | --- |
| `contract.ts` | Channel names and the data they carry; both sides import it |
| `index.ts` | Exposes `window.coleaf` (project, file, dialog, app, images, git, account): the allowlist, nothing more |

## Window (`src/renderer/`, React)

| Folder / module | Does |
| --- | --- |
| `main.tsx`, `styles/` | Entry point; `tokens.css` holds every color, font, size and spacing, `app.css` the shell |
| `app/App.tsx`, `TitleBar.tsx`, `IconBar.tsx`, `ProjectView.tsx` | The frame: title bar (the app icon, the native menus dropped down from their labels, the system's window controls colored from the tokens), icon bar (Explorer, Sync with its badge, the account), one sidebar view at a time, tabs, ribbon and editor; `ProjectView` also follows Ctrl+clicked links and holds the conflict tab |
| `app/useProject.ts`, `useGit.ts`, `useAccount.ts`, `settings.ts`, `ShortcutsDialog.tsx` | The open project, its Git status and the GitHub account mirrored from the background; small window preferences; Help › Keyboard Shortcuts |
| `app/Account.tsx` | The account button and its card: Sign in with GitHub, the code to enter, the picture and Sign out |
| `sidebar/Explorer.tsx`, `ProjectSection.tsx`, `useProjectTree.ts` | The Explorer: the fixed header with the "Only .md" tick (remembered), then the project section headed with the folder's name, the lazy folder tree and its rows |
| `sidebar/SyncView.tsx`, `IdentityForm.tsx`, `HowSyncDialog.tsx` | The Sync view: changed files with ticks (unsaved documents listed too), the required message, Sync and how it went; conflicted files, Finish sync, Cancel; name and email asked once; "How Sync works" |
| `conflict/ConflictTab.tsx` | A conflicted Markdown file as Mine and Theirs pages (read-only segments), Mine / Theirs / Both per highlighted part, Done |
| `tabs/useTabs.ts`, `TabBar.tsx` | One TipTap editor per open file, the unsaved dot, save all before a Sync, reload after one, and the save rule (`saveRule.ts`: an untouched document is never written); the tab bar also shows the conflict tab |
| `ribbon/Ribbon.tsx` | The five groups of buttons above the document and the Styles menu |
| `editor/extensions.ts` | The schema: TipTap's extensions tuned to the spec (shortcuts, attributes) plus CoLeaf's own nodes and marks |
| `editor/nodes.ts` | CoLeaf's nodes and marks: HTML block, inline and mark, front matter, footnotes, raw block, inline and mark, emoji, inline math, soft break; `hrefOfMark` |
| `editor/Editor.tsx` | The sheet with the link, find and table panels; loads the editor and KaTeX stylesheets |
| `editor/CodeBlockView.tsx`, `highlight.ts`, `diagrams.ts` | The code block: language picker, lowlight colors, Mermaid diagram shown while the cursor is elsewhere |
| `editor/math.ts`, `MathInlineView.tsx` | KaTeX, loaded on first use; the inline formula and its click-to-edit field |
| `editor/html.ts`, `HtmlBlockView.tsx`, `HtmlInlineView.tsx` | DOMPurify for HTML blocks and chips, the inline-tag allowlist, repo pictures in HTML |
| `editor/frontMatter.ts`, `FrontMatterView.tsx`, `EditCode.tsx` | Front matter as a table (yaml, loaded on first use); the shared Edit code button and code field |
| `editor/alerts.ts`, `taskItem.ts` | Decorations for GitHub alerts; the task-list checkbox node view |
| `editor/link.ts`, `LinkPanel.tsx`, `paths.ts` | Link resolution, heading anchors and jumps; the Ctrl+K panel; repo paths and picture URLs |
| `editor/search.ts`, `FindPanel.tsx`, `TableBar.tsx`, `pictures.ts`, `languages.ts`, `shortcuts.ts` | Find / Replace, the table bar, pasted and dropped pictures, the language list, the one list of shortcuts |
| `markdown/mdast.ts` | remark setup: parsing (GFM + math), the house style and escaping, front matter split-off, table layout, CoLeaf's mdast node types |
| `markdown/toDoc.ts` | Markdown → editor document: blocks kept as-is, definitions collected, the bridge handlers |
| `markdown/toMarkdown.ts` | Editor document → Markdown: the bridge handlers, minimal escaping with the full-escaping safety net |
| `markdown/emoji.ts`, `htmlTags.ts`, `inlineHtml.ts` | Emoji shortcodes; inline HTML tag parsing and GitHub's tag filter; pairing tags into wraps |

## Tests (`tests/`)

| Folder | Covers |
| --- | --- |
| `roundtrip/` | Golden files per spec row (open + save = same bytes), normalizations, random documents and edits |
| `markdown/` | The bridge, escaping, the viewers, inline HTML, footnotes and references |
| `editor/` | Links and paths, the shortcut list, code highlighting |
| `files/`, `realfiles/`, `tabs/` | Background file work on temporary folders; the repo's own docs; the save rule |
| `git/` | Status, commit, identity, the tracker, Sync with a bare repository and a teammate's clone, conflicts; all on temporary repositories with Git's configuration isolated (`temp-repo.ts`) |
| `auth/` | The device flow against a fake GitHub server, the account file with a fake cipher, the account service |
| `tokens.test.ts`, `compliance/` | The palette lives only in `tokens.css`; the license checker |

## How data flows

1. **Open:** a click in the Explorer → `useTabs.open` → `window.coleaf.file.read` → background `files/document.ts` → `markdownToDoc`: remark (GFM, math) parses, `keepRawBlocks` keeps what is not edited yet as exact text, `pairInlineHtml` pairs tags, the bridge handlers build the ProseMirror document → a TipTap editor with the schema from `extensions.ts`. Node views draw the rest on demand: Mermaid, KaTeX and yaml load the first time they are needed; HTML passes through DOMPurify.
2. **Edit:** ProseMirror transactions; after each, `needsSave` compares with the document last read or written and sets the unsaved dot.
3. **Save:** Ctrl+S → menu → `app:save` → `docToMarkdown`: the bridge turns the document into mdast, remark writes it with minimal escaping, and the full-escaping form is used when the two would read differently → `window.coleaf.file.write` → `files/document.ts` keeps the file's line endings and BOM. An untouched document is never written.
4. **Pictures:** paste, drop or Insert › Picture → `images.save` → a file under `md-images/` → an image node with a relative path, shown through `coleaf-image://`.
5. **Links:** Ctrl+click → `hrefOfMark` (Markdown link, inline HTML `<a>`, reference link or bare URL) → `ProjectView.followLink` → `resolveLink` → a tab (with a jump to the heading) or the browser.
6. **Git status:** any change on disk (a save, a commit, another program) → the watcher → `GitTracker.touch` → `git status` through `git/run.ts` → `git:changed` when it differs → `useGitStatus` → the badge, the branch in the headers, the Sync view's list.
7. **Sync:** the Sync button → `useTabs.saveAll` → a fresh `git:status` → `git:sync` with the ticked files → `git/remote.ts`: commit those paths only, fetch, merge the remote branch, push (a github.com remote gets the signed-in token through the Git process's environment, nothing else does) → an outcome the Sync view puts into words → open documents without edits reload when others' changes came in. Without a name and email in Git's config, the Sync view asks once and saves them with `git:set-identity`.
8. **Conflicts:** the merge stops → the status says `merging` and marks the files → a Markdown file: `git:conflict-read` → `git/conflicts.ts` splits the markers → `ConflictTab` shows Mine and Theirs with the parts highlighted → Done → `git:conflict-resolve` writes the choices and stages the file; any other file: Keep mine / Keep theirs → `git:conflict-file` → Finish sync → `git:sync-finish` commits the merge and pushes; Cancel sync → `git:sync-cancel` aborts the merge.
9. **Sign-in:** the account button → `account:sign-in` → `auth/github.ts` asks GitHub for a code → `account:changed` shows it in the card → the user enters it on GitHub → the poll gets the token → `GET /user` → the token and account are kept encrypted (`auth/store.ts`, Electron's safeStorage) → the picture in the icon bar.
