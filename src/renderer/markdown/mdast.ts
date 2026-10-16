import type { CoLeafRaw, Nodes, Parent, PhrasingContent, Root, RootContent } from 'mdast'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'

declare module 'mdast' {
  // remark-frontmatter produces `toml` nodes (Hugo front matter); @types/mdast declares only `yaml`.
  interface Toml extends Literal {
    type: 'toml'
  }
  /** Markdown kept exactly as it was in the file: shown, never edited, written back verbatim. */
  interface CoLeafRaw extends Literal {
    type: 'coleafRaw'
  }
  interface RootContentMap {
    toml: Toml
    coleafRaw: CoLeafRaw
  }
  interface PhrasingContentMap {
    coleafRaw: CoLeafRaw
  }
}

// Front matter: YAML (GitHub shows it as a table) and TOML (Hugo).
const frontMatter = ['yaml', 'toml'] as const

// One consistent, Prettier-compatible style for everything we write (AGENTS.md rule 1).
export const stringifyOptions = {
  bullet: '-',
  emphasis: '_',
  strong: '*',
  fences: true,
  rule: '-',
  listItemIndent: 'one',
  incrementListMarker: true,
  handlers: {
    coleafRaw: (node: CoLeafRaw): string => node.value
  }
} as const

/** Parses GitHub-flavored Markdown into mdast. */
export function parseMarkdown(text: string): Root {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, [...frontMatter])
    .parse(text)
}

/** Writes mdast as Markdown in CoLeaf's style. */
export function stringifyMdast(root: Root): string {
  return unified()
    .use(remarkGfm)
    .use(remarkFrontmatter, [...frontMatter])
    .use(remarkStringify, stringifyOptions)
    .stringify(root)
}

/** The Markdown of one block, without the trailing newline. */
export function markdownOfBlock(node: RootContent): string {
  return stringifyMdast({ type: 'root', children: [node] }).replace(/\n$/, '')
}

/** The Markdown of one inline node. */
export function markdownOfInline(node: PhrasingContent): string {
  return markdownOfBlock({ type: 'paragraph', children: [node] })
}

/** The exact text a node came from, when it was parsed from text. */
export function sourceOf(node: Nodes, text: string): string | null {
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  return start != null && end != null ? text.slice(start, end) : null
}

/** A copy of a node without source positions, small enough to keep in an editor attribute. */
export function withoutPositions<T extends Nodes>(node: T): T {
  return JSON.parse(JSON.stringify(node, (key, value) => (key === 'position' ? undefined : value)))
}

/** Joins neighbouring text nodes, which conversion from the editor produces around line breaks. */
export function mergeText<T extends Nodes>(node: T): T {
  if (!('children' in node)) return node
  const merged: Parent['children'] = []
  for (const child of (node as Parent).children) {
    const last = merged[merged.length - 1]
    if (child.type === 'text' && last?.type === 'text') last.value += child.value
    else merged.push(mergeText(child))
  }
  return { ...node, children: merged }
}
