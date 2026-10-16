# CoLeaf – Code map

Oct 16, 2026 · Updated at the end of every slice.

One line per folder and module, then how data flows through them. [architecture.md](architecture.md) says why it is built this way; this file says where things are.

## Background (`src/main/`, Node.js)

| Module | Does |
| --- | --- |
| `index.ts` | App start: the window (no Node access, sandboxed), the right-click menu with spelling suggestions, the `coleaf-image://` scheme for repo pictures, `COLEAF_PROJECT` in development |
| `menu.ts` | The application menu (File, Help), rebuilt whenever the session changes |
| `files/session.ts` | The one open project; the window and the menu mirror it |
| `files/project.ts` | Lists a folder for the tree: folders first, Git internals and system clutter hidden |
| `files/ignore.ts` | Folders never scanned for Markdown: `node_modules` and `.gitignore` rules |
| `files/markdown-index.ts` | Which folders hold Markdown at any depth, built in the background and kept current |
| `files/watch.ts` | One recursive watcher on the project root; changes reported per folder |
| `files/document.ts` | Reads and writes `.md` files, keeping BOM, line endings and final newline |
| `files/images.ts` | Pictures under `images/` (one folder per document) and the image scheme's lookup |
| `ipc/*.ts` | One file per area (app, project, file, images): the handlers behind the preload's allowlist |

## Bridge (`src/preload/`)

| Module | Does |
| --- | --- |
| `contract.ts` | Channel names and the data they carry; both sides import it |
| `index.ts` | Exposes `window.coleaf` (project, file, dialog, app, images): the allowlist, nothing more |

## Window (`src/renderer/`, React)

| Folder / module | Does |
| --- | --- |
| `main.tsx`, `styles/` | Entry point; `tokens.css` holds every color, font, size and spacing, `app.css` the shell |
| `app/App.tsx`, `IconBar.tsx`, `ProjectView.tsx` | The frame: icon bar, Explorer, tabs, ribbon and editor; `ProjectView` also follows Ctrl+clicked links |
| `app/useProject.ts`, `settings.ts`, `ShortcutsDialog.tsx` | The open project mirrored from the background; small window preferences; Help › Keyboard Shortcuts |
| `sidebar/` | The Explorer: the lazy folder tree (`useProjectTree.ts`), its rows and the "Only .md" tick |
| `tabs/useTabs.ts` | One TipTap editor per open file, the unsaved dot and the save rule (`saveRule.ts`: an untouched document is never written) |
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
| `tokens.test.ts`, `compliance/` | The palette lives only in `tokens.css`; the license checker |

## How data flows

1. **Open:** a click in the Explorer → `useTabs.open` → `window.coleaf.file.read` → background `files/document.ts` → `markdownToDoc`: remark (GFM, math) parses, `keepRawBlocks` keeps what is not edited yet as exact text, `pairInlineHtml` pairs tags, the bridge handlers build the ProseMirror document → a TipTap editor with the schema from `extensions.ts`. Node views draw the rest on demand: Mermaid, KaTeX and yaml load the first time they are needed; HTML passes through DOMPurify.
2. **Edit:** ProseMirror transactions; after each, `needsSave` compares with the document last read or written and sets the unsaved dot.
3. **Save:** Ctrl+S → menu → `app:save` → `docToMarkdown`: the bridge turns the document into mdast, remark writes it with minimal escaping, and the full-escaping form is used when the two would read differently → `window.coleaf.file.write` → `files/document.ts` keeps the file's line endings and BOM. An untouched document is never written.
4. **Pictures:** paste, drop or Insert › Picture → `images.save` → a file under `images/` → an image node with a relative path, shown through `coleaf-image://`.
5. **Links:** Ctrl+click → `hrefOfMark` (Markdown link, inline HTML `<a>`, reference link or bare URL) → `ProjectView.followLink` → `resolveLink` → a tab (with a jump to the heading) or the browser.
