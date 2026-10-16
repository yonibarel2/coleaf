# Compliance report: Stage 1a

Date: 2026-10-16 · Commit: 27f1894 · Result: **PASS**

## Dependency licenses

573 installed packages checked against the allow list in policy.json: 153 shipped (bundled into the app or run by it), 420 dev-only (build, lint and test tools).

| Result | Shipped | Dev-only |
| --- | --- | --- |
| Allowed | 153 | 415 |
| Excepted | 0 | 5 |
| Failed | 0 | 0 |

### Shipped packages by license

| License | Packages |
| --- | --- |
| MIT | @electron-toolkit/utils@4.0.0, @electron/get@5.1.0, @floating-ui/core@1.8.0, @floating-ui/dom@1.8.0, @floating-ui/utils@0.2.12, @handlewithcare/remark-prosemirror@0.1.5, @tiptap/core@3.32.0, @tiptap/extension-blockquote@3.32.0, @tiptap/extension-bold@3.32.0, @tiptap/extension-bubble-menu@3.32.0, @tiptap/extension-code-block@3.32.0, @tiptap/extension-code@3.32.0, @tiptap/extension-document@3.32.0, @tiptap/extension-floating-menu@3.32.0, @tiptap/extension-hard-break@3.32.0, @tiptap/extension-heading@3.32.0, @tiptap/extension-horizontal-rule@3.32.0, @tiptap/extension-image@3.32.0, @tiptap/extension-italic@3.32.0, @tiptap/extension-link@3.32.0, @tiptap/extension-list@3.32.0, @tiptap/extension-paragraph@3.32.0, @tiptap/extension-table@3.32.0, @tiptap/extension-text@3.32.0, @tiptap/extensions@3.32.0, @tiptap/pm@3.32.0, @tiptap/react@3.32.0, @types/debug@4.1.13, @types/hast@3.0.5, @types/mdast@4.0.4, @types/ms@2.1.0, @types/node@24.19.2, @types/react-dom@19.3.0, @types/react@19.3.0, @types/unist@3.0.3, @types/use-sync-external-store@0.0.6, bail@2.0.2, ccount@2.0.1, character-entities@2.0.2, comma-separated-tokens@2.0.3, csstype@3.2.3, debug@4.4.3, decode-named-character-reference@1.3.0, dequal@2.0.3, devlop@1.1.0, electron@44.7.2, env-paths@2.2.1, env-paths@3.0.0, escape-string-regexp@4.0.0, escape-string-regexp@5.0.0, extend@3.0.2, fast-equals@5.4.5, hast-util-from-html@2.0.3, hast-util-from-parse5@8.0.3, hast-util-parse-selector@4.0.0, hastscript@9.0.1, ignore@5.3.2, ignore@7.0.12, is-plain-obj@4.1.0, linkifyjs@4.3.3, longest-streak@3.1.0, markdown-table@3.0.4, mdast-util-find-and-replace@3.0.3, mdast-util-from-markdown@2.1.0, mdast-util-gfm-autolink-literal@2.0.1, mdast-util-gfm-footnote@2.1.0, mdast-util-gfm-strikethrough@2.0.1, mdast-util-gfm-table@2.0.0, mdast-util-gfm-task-list-item@2.0.0, mdast-util-gfm@3.1.0, mdast-util-phrasing@4.1.0, mdast-util-to-markdown@2.2.0, mdast-util-to-string@4.0.0, micromark-core-commonmark@2.0.4, micromark-extension-gfm-autolink-literal@2.1.0, micromark-extension-gfm-footnote@2.1.0, micromark-extension-gfm-strikethrough@2.1.0, micromark-extension-gfm-table@2.1.2, micromark-extension-gfm-tagfilter@2.0.0, micromark-extension-gfm-task-list-item@2.1.0, micromark-extension-gfm@3.0.0, micromark-factory-destination@2.0.1, micromark-factory-label@2.0.1, micromark-factory-space@2.1.0, micromark-factory-title@2.0.1, micromark-factory-whitespace@2.0.1, micromark-util-character@2.1.1, micromark-util-chunked@2.0.1, micromark-util-classify-character@2.0.1, micromark-util-combine-extensions@2.0.1, micromark-util-decode-numeric-character-reference@2.0.2, micromark-util-decode-string@2.0.1, micromark-util-edit-map@1.0.0, micromark-util-encode@2.0.1, micromark-util-html-tag-name@2.0.1, micromark-util-normalize-identifier@2.0.1, micromark-util-resolve-all@2.0.1, micromark-util-sanitize-uri@2.0.1, micromark-util-subtokenize@2.1.0, micromark-util-symbol@2.0.1, micromark-util-types@2.0.3, micromark@4.0.3, ms@2.1.3, orderedmap@2.1.1, parse5@7.3.0, progress@2.0.3, property-information@7.2.0, prosemirror-changeset@2.4.4, prosemirror-commands@1.7.2, prosemirror-dropcursor@1.8.4, prosemirror-gapcursor@1.4.1, prosemirror-history@1.5.1, prosemirror-inputrules@1.5.1, prosemirror-keymap@1.2.3, prosemirror-model@1.25.12, prosemirror-schema-list@1.5.1, prosemirror-state@1.4.4, prosemirror-tables@1.8.5, prosemirror-transform@1.12.2, prosemirror-view@1.42.6, react-dom@19.3.1, react@19.3.1, remark-gfm@4.0.1, remark-parse@11.0.0, remark-stringify@11.0.0, rope-sequence@1.3.4, scheduler@0.28.0, space-separated-tokens@2.0.2, trim-lines@3.0.1, trough@2.2.0, undici-types@7.24.6, undici@6.29.1, undici@7.30.1, unified@11.0.5, unist-util-is@6.0.1, unist-util-stringify-position@4.0.0, unist-util-visit-parents@6.0.2, unist-util-visit@5.1.0, use-sync-external-store@1.7.0, vfile-location@5.0.3, vfile-message@4.0.3, vfile@6.0.3, w3c-keyname@2.2.8, web-namespaces@2.0.1, zwitch@2.0.4 |
| ISC | graceful-fs@4.2.11, lucide-react@1.57.0, semver@6.3.1, semver@7.8.5 |
| BSD-2-Clause | @electron-internal/extract-zip@1.0.5, entities@6.0.1 |
| Apache-2.0 | sumchecker@3.0.1 |
| OFL-1.1 | @fontsource/ibm-plex-sans@5.3.0 |

### Dev-only packages by license

| License | Packages |
| --- | --- |
| MIT | 300 |
| ISC | 63 |
| Apache-2.0 | 28 |
| BlueOak-1.0.0 | 11 |
| BSD-2-Clause | 8 |
| BSD-3-Clause | 3 |
| MPL-2.0 | 2 |
| (MIT AND CC-BY-3.0) | 1 |
| CC-BY-3.0 | 1 |
| CC-BY-4.0 | 1 |
| CC0-1.0 | 1 |
| Python-2.0 | 1 |

### Exceptions

| Package | License | Reason |
| --- | --- | --- |
| caniuse-lite@1.0.30001816 | CC-BY-4.0 | dev-only build tool, not shipped |
| lightningcss-win32-x64-msvc@1.33.0 | MPL-2.0 | dev-only build tool, not shipped |
| lightningcss@1.33.0 | MPL-2.0 | dev-only build tool, not shipped |
| spdx-exceptions@2.5.0 | CC-BY-3.0 | dev-only data of the license checker, not shipped |
| spdx-ranges@2.1.1 | (MIT AND CC-BY-3.0) | dev-only data of the license checker, not shipped |

### Failures

None.

## Code origin (ScanCode)

Not run: ScanCode runs with `--release`, when a full stage is complete.
