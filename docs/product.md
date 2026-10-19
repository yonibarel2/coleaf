# CoLeaf – Product

Oct 19, 2026 · @Yehonatan

What CoLeaf is and why. How and when we build it: [plan.md](plan.md).

## Project description

In most projects, the code lives in a repo while the docs live somewhere else, like Word or Confluence, where anyone can edit and comment easily, but the docs drift away from the code, and AI agents can't see them. Many teams also keep docs as `.md` files in the repo, next to the code, with full history and in the format AI agents work with best, but Markdown is hard for people to read, edit and review together.

**CoLeaf gives you the best of both.** It's a desktop text editor for the `.md` files in your repo, where you, your team and AI co-work on them directly, in a simple, intuitive way.

- **Anyone can edit:** works like any document editor, with no Markdown or Git skills needed.
- **Docs live with the code:** in the repo, next to the code.
- **Teamwork with history:** Sync, versions, comments and review, all on Git.
- **AI on the team:** agents work on the docs alongside the team, with the full repo as context.
- **Files stay clean:** always plain Markdown that any tool can read. CoLeaf adds nothing of its own.

## Why us

maybe say who are competitors what they give and what we bring up new (the bullets unot)

The main question. Our bet: many people struggle to work on a repo's Markdown files together, as a team, side by side with AI. If there's no strong answer, we stop here.

**Our edge:** truly for non-developers (Word-like ribbon), Word-style comments with permissions and review, readable diffs on the formatted page (not raw text), friendly Sync and conflicts, Word/PDF export. Competitors: [market/competitors.md](market/competitors.md).

- [ ] First target group: PMs, architects, technical writers, or another?
- [ ] One-sentence promise, tested with real users
- [ ] The "only we" list: teamwork + AI + plain Markdown in Git; what else?
- [ ] Competitors: also Word and Claude Docs; what each does well and where it falls short
- [ ] Final tagline ("All the power of a repo. None of the nerd." is temporary)
- [ ] The full feature list, each feature traced back to this section

## Open decisions

Tick a decision when it's made and note the answer next to it.

### Features

- [ ] Rule for adding a feature: which user, which job, what we remove or hide to keep it simple
- [ ] Must-have features per target group (e.g. diagrams for architects, review for PMs)
- [ ] Order of the "Later" rows in [editor/markdown.md](editor/markdown.md)
- [ ] Plugin and skills marketplace: when, and what it may change
- [ ] Word/PDF export: priority and quality bar

### UI

- [ ] Design bar: which products we match (Word, Notion, Linear?)
- [ ] Real designer and Figma for Stage 4, or keep designing with Claude
- [ ] Accessibility level: keyboard-only use, screen readers, contrast
- [ ] First-run experience: what a new user sees in the first 60 seconds

### Legal

- [ ] Before publishing: a lawyer reviews the privacy policy, terms of use, licenses, IP and liability (who, cost, when)
- [ ] Our own license: closed source, open source, or dual
- [ ] Privacy policy (what CoLeaf stores and where), terms of use, end-user license agreement
- [ ] Trademark check for the final name
- [ ] Anthropic's terms for using Claude in the product (Stage 3)

### Marketing and business

- [ ] Path: own product, acquisition target, or open source
- [ ] Pricing: free, freemium, per seat, team plans
- [ ] Launch channels, website and demo video
- [ ] Positioning against OpenKnowledge, GitBook and Obsidian

### Users and feedback

- [ ] 5–10 real PMs and architects to interview (who?)
- [ ] Beta group: when, how many, how they send feedback
- [ ] Opt-in usage data: what we measure, and the tool
- [ ] Our own team uses CoLeaf daily for its docs

### AI

- [ ] Which AI features first: edit with review, chat on a selection, generate a new doc?
- [ ] Access: the user's own API key, our paid proxy, or log in with Claude
- [ ] Cost and privacy: who pays, what leaves the computer, consent
- [ ] Claude only, or other AI tools later

### Distribution and support

- [ ] Platforms at launch: Windows only, or Windows + macOS
- [ ] Windows signing route (Azure isn't available in Israel; an OV certificate?)
- [ ] Updates and downloads: GitHub Releases or our website
- [ ] User Guide content, including "How Publish works"
- [ ] How users report bugs: in-app button, email, or GitHub issues

## Ideas for later stages

- **Diagram creator:** drag-and-drop diagram editing for non-developers, saved as text inside the `.md` (Mermaid) so Git shows changes and AI can read and edit it. A key differentiator.
- **View-only preview of images and PDFs** from the sidebar (architects' drawings), without leaving CoLeaf.
- **Richer tables:** Markdown tables can't merge cells but are easy for AI agents; consider HTML tables or another approach for merged cells.
- **Slash menu:** type `/` to insert Heading, Table, Image, Quote, Code block or Diagram, with a small live preview (seen in a Claude Docs–style editor).
- **Live cursors:** show teammates and the AI as named cursors while they edit (with Co-Work and AI stages).
- Optional Settings toggle for typed Markdown shortcuts (`# ` → heading), if power users ask
