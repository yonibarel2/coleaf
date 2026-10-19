# CoLeaf – Competitors

Oct 16, 2026

Who else edits Markdown in Git repos with AI and teams, what each one is for, and where CoLeaf can be different.

## At a glance

No product combines all of CoLeaf's pieces, and none exports to Word. Closest by form is OpenKnowledge (desktop, Git, free); closest by features is GitBook (comments, review, AI), but it is a web SaaS.

| Product | Platform | Git-native | Non-dev friendly | Comments | Review / permissions | AI | Live co-editing | Word / PDF export | Price |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **CoLeaf (planned)** | Desktop | Yes | Yes (Word-like) | Yes (Stage 2) | Yes (Stage 2) | Claude (Stage 3) | Later | Yes / Yes | TBD |
| OpenKnowledge | Desktop + local web | Yes | Partial | Not found | Not found | Any agent via MCP | Unclear | No / No | Free, GPL |
| Nimbalyst | Desktop (+iOS) | Yes | Partial | Yes | Partial (AI diffs, admin) | Claude Code / Codex | Yes (Teams) | No / Yes | Free; Teams $20/user |
| Mintlify editor | Web | Yes | Yes | Yes | Yes (via PRs) | Agent + MCP | Yes | No / Partial | $0–450/mo+ |
| GitBook | Web | Partial (sync) | Yes | Yes | Yes (change requests) | Agent + assistant | Yes (paid) | No / Yes (paid) | $65/site/mo + $12/user |
| Graft | VS Code / web | Yes | Partial | Yes (in Git) | Partial (suggest mode) | No | Yes | No / No | Free |
| Obsidian + Git plugin | Desktop + mobile | Yes (plugin) | Partial | No | No | No (core) | No | Plugin / Yes | Free; Sync $4/mo |
| Typora | Desktop | No | Yes | No | No | No | No | Yes / Yes | $14.99 once |
| TinaCMS | Web, in your site | Yes | Partial | No | Partial (PRs) | Coming soon | No | No / No | Free–$249/mo |
| HackMD | Web | Partial | Partial | Yes | Partial | No (API) | Yes | No / Yes | Free; $5/seat |
| Markra | Desktop + web | No | Partial | No | No | Yes (previews edits) | No | ? / Yes | Free, AGPL |
| Decap CMS | Web, in your site | Yes | Partial | No | Yes (PRs) | No | No | No / No | Free, MIT |

## Each competitor

The big players (GitBook, Mintlify, HackMD, Obsidian) each have 1M+ users or 20,000+ customers; the closest desktop tools (OpenKnowledge, Nimbalyst) are a few months old with a few thousand stars.

| Product | Goal (their words) | Target users | Size / traction | Notes for CoLeaf |
| --- | --- | --- | --- | --- |
| [OpenKnowledge](https://github.com/inkeep/open-knowledge) | "AI-native markdown IDE and LLM wiki. Private, local, and free" | Knowledge bases, LLM wikis, specs; leans technical | 4.1k stars; public Jun 2026; Inkeep raised $13M seed (Khosla, YC) | Closest in form. GPL-3.0, so we can't reuse its code unless CoLeaf is GPL |
| [Nimbalyst](https://nimbalyst.com) | "The visual workspace for building with Codex and Claude Code" | Developers, PMs, feature teams | 1.7k stars; "thousands of builders"; v0.81.5 (Oct 2026) | Electron + Lexical editor; red/green AI diffs; comments; MIT licence |
| [Mintlify editor](https://mintlify.com/blog/editor) | Editor "built for collaboration across teams and agents" | Whole orgs: PMs, support, marketing | 20,000+ companies; $45M Series B at $500M (Apr 2026) | Comments kept outside the repo, summarised into the PR; review = Request review → approve in GitHub → merge |
| [GitBook](https://www.gitbook.com/) | "The knowledge layer for AI" | Product, engineering, support teams | 2M+ users, 30,000+ teams | Change requests like PRs with reviewers; source of truth is GitBook, Git is synced |
| [Graft](https://github.com/tkjaer/graft) | "A collaborative editor for markdown files that live in GitHub" | Teams writing ADRs, RFCs, docs | \~10 stars; hobby project (Feb 2026) | TipTap; comments stored on a separate Git branch — one model for our Stage 2 |
| [Obsidian](https://obsidian.md/) + [Git plugin](https://github.com/Vinzent03/obsidian-git) | Local, private knowledge base | Individuals; teams via Sync | \~1M users (2023 est.); Git plugin 3.29M downloads | Git plugin auto-commits but is "highly unstable" on mobile; editing shows syntax near the cursor |
| [Typora](https://typora.io/) | Seamless WYSIWYG Markdown editor | Individual writers | Not found | Benchmark for clean WYSIWYG and DOCX/PDF export; no Git |
| [TinaCMS](https://tina.io/) | "Visual Editor for Markdown" with Git built in | Website content editors, set up by developers | 13.8k stars | Review = branch + draft PR, merge in GitHub |
| [HackMD](https://hackmd.io/) | "Where teams and agents build together" | Teams, education | 1M+ users, 30K+ teams | Split edit/preview, not WYSIWYG; manual GitHub push/pull with monthly limits |
| [Markra](https://github.com/markrahq/markra) | WYSIWYG Markdown editor with native AI, data stays local | Writers of docs, blogs, research | 909 stars | Switched editor engine from Milkdown to CodeMirror in v2 — a warning to test round-trip early; previews every AI edit |
| [Decap CMS](https://github.com/decaporg/decap-cms) | Git-based CMS | Website content editors | 19.4k stars | "Approve and publish" merges a PR — proven review pattern |

## Gaps nobody fills well

The opening is a local desktop app where non-developers review and edit repo docs, with the repo as the only source of truth.

| Gap | Who comes close | CoLeaf's chance |
| --- | --- | --- |
| **Word (.docx) export** | Only Typora (no Git) | Nobody with Git does it; a clear differentiator |
| **Comments + review on a local, Git-native desktop app** | Mintlify, GitBook (web, cloud); Graft (hobby) | Word-style comments and "Submit for review → Approve" built on branches and PRs |
| **Where comments live in Git** | Graft (separate branch), Mintlify (outside the repo) | Pick one clean model; still unsolved in the market |
| **Truly non-developer Git** | Obsidian Git is unstable on mobile; HackMD push/pull has quotas | One Sync button, friendly conflicts, no Git words |
| **Word-like editing** | Typora, Mintlify | A real ribbon and page look; most others are Notion-style |
| **No per-site or per-seat cloud fee** | GitBook $65/site, Mintlify $450/mo | Local app, the user's own GitHub |

## Brainstorm

Questions to answer before Stage 1 is final; add your answers inline.

1. **Who is the first user?** Architects, PMs, a specific company team — one real person we can test with.
2. **Why desktop instead of web?** Mintlify and GitBook are web; our answer: local files, privacy, works offline, no cloud fee.
3. **What is the "wow" in the first 5 minutes?** Candidates: open a repo and edit like Word; one-click Sync; export to Word.
4. **Should Word export move earlier (Stage 1 or Release 1)?** Nobody with Git has it.
5. **Review model:** "Submit for review → Approve" on branches + PRs, like Mintlify and Decap?
6. **Comment storage:** separate Git branch (Graft), sidecar files in the repo, or PR comments?
7. **AI angle:** preview-before-apply (Markra, Nimbalyst) is now expected — what makes ours better for non-developers?
8. **Price:** free core + paid team features? Anchors: Typora $15 once, HackMD $5/seat, GitBook $65/site.
9. **Open source?** Nimbalyst is MIT, OpenKnowledge GPL; open source helps trust and adoption.

**Answers so far (Oct 16):** (1) First users: architects and PMs who work with AI and want repo context shared with developers in VS Code; no right-to-left (Hebrew) support planned. (2) Desktop: yes, for local files, privacy and offline. (3) The wow: open a repo, edit like Word, one-click Sync. (4) Word export is minor, not the core. (8) Price: not now. Questions 5–7 are decided in their stages (2 and 3). Exactly why CoLeaf is unique is refined as we build.

## Sources

Star counts and user numbers are from the products' own pages or GitHub as of Oct 2026; some figures (marked partial or ? above) could not be confirmed.

- OpenKnowledge: [GitHub](https://github.com/inkeep/open-knowledge), [docs](https://open-knowledge-docs.preview.inkeep.com/), [Inkeep funding](https://inkeep.com/blog/inkeep-funding-announcement)
- Nimbalyst: [site](https://nimbalyst.com), [GitHub](https://github.com/Nimbalyst/nimbalyst), [pricing](https://nimbalyst.com/pricing), [changelog](https://nimbalyst.com/changelog)
- Mintlify: [editor launch](https://mintlify.com/blog/editor), [editor docs](https://www.mintlify.com/docs/editor), [comments](https://www.mintlify.com/docs/editor/comments), [review](https://www.mintlify.com/docs/editor/review), [pricing](https://www.mintlify.com/pricing), [Series B](https://www.gunder.com/en/news-insights/client-news/mintlify-raises-dollar45-million-series-b-at-500-million-usd-valuation)
- GitBook: [site](https://www.gitbook.com/), [Git Sync](https://gitbook.com/docs/getting-started/git-sync), [change requests](https://gitbook.com/docs/collaborate/change-requests), [pricing](https://www.gitbook.com/pricing)
- Graft: [GitHub](https://github.com/tkjaer/graft)
- Obsidian: [site](https://obsidian.md/), [pricing](https://obsidian.md/pricing), [Obsidian Git](https://github.com/Vinzent03/obsidian-git), [plugin stats](https://www.obsidianstats.com/plugins/obsidian-git)
- Typora: [site](https://typora.io/)
- TinaCMS: [site](https://tina.io/), [editorial workflow](https://tina.io/docs/tinacloud/editorial-workflow), [pricing](https://tina.io/pricing)
- HackMD: [site](https://hackmd.io/), [GitHub sync](https://hackmd.io/s/link-with-github), [pricing](https://hackmd.io/pricing)
- Markra: [GitHub](https://github.com/markrahq/markra)
- Decap CMS: [GitHub](https://github.com/decaporg/decap-cms), [editorial workflow](https://decapcms.org/docs/editorial-workflows/)
