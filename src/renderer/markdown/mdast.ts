import type { CoLeafRaw, Nodes, Parent, PhrasingContent, Root, RootContent, Text } from 'mdast'
import { defaultHandlers } from 'mdast-util-to-markdown'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkStringify, { type Options as StringifyOptions } from 'remark-stringify'
import { unified } from 'unified'

declare module 'mdast' {
  /** Markdown kept exactly as it was in the file: shown, never edited, written back verbatim. */
  interface CoLeafRaw extends Literal {
    type: 'coleafRaw'
  }
  interface RootContentMap {
    coleafRaw: CoLeafRaw
  }
  interface PhrasingContentMap {
    coleafRaw: CoLeafRaw
  }
}

// `~~strike~~` only: a single `~` stays text, so `H~2~O` (Pandoc subscript) is kept as-is.
export const gfmOptions = { singleTilde: false } as const

/**
 * Front matter: YAML between `---` lines (GitHub shows it as a table) or TOML between `+++`
 * lines (Hugo), at the very top. Split off before parsing and kept verbatim. (remark-frontmatter
 * is not used: it misreads a file that merely starts with a `---` rule.)
 */
const frontMatterPattern = /^(---|\+\+\+)\n(?:[^\n]*\n)*?\1[ \t]*(?:\n|$)/

export function splitFrontMatter(text: string): { frontMatter: string | null; body: string } {
  const match = frontMatterPattern.exec(text)
  if (!match) return { frontMatter: null, body: text }
  return { frontMatter: match[0].replace(/\n$/, ''), body: text.slice(match[0].length) }
}

/**
 * How much of a text node to escape. `full` is remark's default: safe, but it also escapes
 * syntax other tools rely on (`[[wiki]]`, `[!NOTE]`, `H~2~O`). `minimal` escapes only what
 * starts a block at a line start, backslashes, backticks and tags; toMarkdown.ts checks the
 * result re-parses the same and falls back to `full` when it does not.
 */
export type Escaping = 'full' | 'minimal'

type Handlers = NonNullable<StringifyOptions['handlers']>
type Handle = NonNullable<Handlers['text']>
type Unsafe = NonNullable<StringifyOptions['unsafe']>[number]

// Always escaped: backslashes, backticks and tags. At a line start also `#`, `>`, list markers
// and `1.`; not `[`, `=`, `_` or `~`, which only matter in shapes the safety net catches.
const keptEverywhere = new Set(['\\', '`', '<'])
const leftToSafetyNet = new Set(['[', '=', '_', '~'])

const minimalText: Handle = (node: Text, _parent, state, info) => {
  const all = state.unsafe
  state.unsafe = all.filter(
    (rule: Unsafe) =>
      keptEverywhere.has(rule.character) || (rule.atBreak && !leftToSafetyNet.has(rule.character))
  )
  try {
    return state.safe(node.value, info)
  } finally {
    state.unsafe = all
  }
}

// Italic is `_text_`, but `*text*` when it touches a word or sits inside another italic, like
// Prettier: `_` cannot open or close emphasis inside a word, and remark would otherwise encode
// the neighbouring letters as entities. The choice is made per node before serializing and
// handed to remark as the marker preference.
const wordCharacter = /[\p{L}\p{N}]/u
const inlineWrappers = new Set(['emphasis', 'strong', 'link', 'linkReference', 'delete'])

interface Place {
  parent: Parent
  index: number
}

// The character next to an inline node on one side, looking outward through inline wrappers
// (`a**_b_**` touches `a`). Unknown neighbours count as non-word.
function neighbour(chain: Place[], side: -1 | 1): string {
  for (let depth = chain.length - 1; depth >= 0; depth--) {
    const { parent, index } = chain[depth]
    const sibling = parent.children[index + side]
    if (sibling)
      return sibling.type === 'text' ? (sibling.value.at(side === -1 ? -1 : 0) ?? '') : ''
    if (!inlineWrappers.has(parent.type)) return ''
  }
  return ''
}

function chooseEmphasisMarkers(node: Nodes, chain: Place[] = [], insideEmphasis = false): void {
  if (!('children' in node)) return
  const parent = node as Parent
  parent.children.forEach((child, index) => {
    const place = [...chain, { parent, index }]
    if (child.type === 'emphasis') {
      const touchesWord =
        wordCharacter.test(neighbour(place, -1)) || wordCharacter.test(neighbour(place, 1))
      child.data = { ...child.data, coleafMarker: insideEmphasis || touchesWord ? '*' : '_' }
    }
    chooseEmphasisMarkers(child, place, insideEmphasis || child.type === 'emphasis')
  })
}

const emphasis: Handle = Object.assign(
  (...args: Parameters<Handle>) => defaultHandlers.emphasis(...args),
  {
    peek: defaultHandlers.emphasis.peek,
    attention: (node: Nodes, state: Parameters<Handle>[2]) => {
      const info = defaultHandlers.emphasis.attention(node as never, state)
      const marker = (node.data as { coleafMarker?: string } | undefined)?.coleafMarker
      return marker === '*' ? { ...info, markers: ['*', '_'] } : info
    }
  }
)

// A backslash at the end of a text run, or right before its last letter, is written as `\\`:
// remark may encode that last letter as `&#x61;` next to an emphasis marker, and a marker or
// line end may follow the run, none of which may turn a literal backslash into an escape or a
// hard break. `\\` is a literal backslash in every case.
const backslashAtEnd = /\\([\p{L}\p{N}]?)$/u
function withSafeEnd(handle: Handle): Handle {
  return (node: Text, parent, state, info) => {
    const match = backslashAtEnd.exec(node.value)
    if (!match) return handle(node, parent, state, info)
    const head = node.value.slice(0, node.value.length - match[0].length)
    return handle({ ...node, value: head }, parent, state, info) + '\\\\' + match[1]
  }
}

// One consistent, Prettier-compatible style for everything we write (AGENTS.md rule 1).
export function stringifyOptions(escaping: Escaping): StringifyOptions {
  const handlers: Handlers = {
    coleafRaw: (node: CoLeafRaw): string => node.value,
    emphasis,
    text: withSafeEnd(escaping === 'minimal' ? minimalText : defaultHandlers.text)
  }
  return {
    bullet: '-',
    emphasis: '_',
    strong: '*',
    fences: true,
    rule: '-',
    listItemIndent: 'one',
    incrementListMarker: true,
    handlers
  }
}

/** Parses GitHub-flavored Markdown (without front matter) into mdast. */
export function parseMarkdown(text: string): Root {
  return unified().use(remarkParse).use(remarkGfm, gfmOptions).parse(text)
}

/** Writes mdast as Markdown in CoLeaf's style. */
export function stringifyMdast(root: Root, escaping: Escaping = 'full'): string {
  chooseEmphasisMarkers(root)
  return unified()
    .use(remarkGfm, gfmOptions)
    .use(remarkStringify, stringifyOptions(escaping))
    .stringify(root)
}

/** Whether two trees have the same structure and text, wherever they came from. */
export function sameShape(a: Nodes, b: Nodes): boolean {
  return JSON.stringify(withoutPositions(a)) === JSON.stringify(withoutPositions(b))
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

/**
 * Joins neighbouring text nodes, which conversion from the editor produces around line breaks,
 * and drops spaces around those line breaks: Markdown ignores them (two trailing spaces would
 * even be a hard break), so writing them would make the next save differ from this one.
 */
export function mergeText<T extends Nodes>(node: T): T {
  if (!('children' in node)) return node
  const merged: Parent['children'] = []
  for (const child of (node as Parent).children) {
    const last = merged[merged.length - 1]
    if (child.type === 'text' && last?.type === 'text') last.value += child.value
    else merged.push(mergeText(child))
  }
  for (const child of merged) {
    if (child.type === 'text') child.value = child.value.replace(/[ \t]*\n[ \t]*/g, '\n')
  }
  return { ...node, children: merged }
}
