import type {
  AlignType,
  CoLeafFrontMatter,
  CoLeafRaw,
  Link,
  Nodes,
  Parent,
  PhrasingContent,
  Root,
  RootContent,
  Table,
  Text
} from 'mdast'
import { defaultHandlers, type ConstructName } from 'mdast-util-to-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkStringify, { type Options as StringifyOptions } from 'remark-stringify'
import { unified } from 'unified'

declare module 'mdast' {
  /** Markdown kept exactly as it was in the file: shown, never edited, written back verbatim. */
  interface CoLeafRaw extends Literal {
    type: 'coleafRaw'
    data?: CoLeafRawData
  }
  interface CoLeafRawData extends Data {
    /** What the raw text holds, when it is all of one kind: link reference definitions. */
    coleafKind?: 'definitions'
  }
  interface LinkReferenceData {
    /** The address its definition gives, for showing it as a link; null when there is none. */
    coleafUrl?: string | null
  }
  interface ImageReferenceData {
    /** The address its definition gives, for showing the picture; null when there is none. */
    coleafUrl?: string | null
  }
  /** YAML front matter, with its `---` lines: shown as a table, written back verbatim. */
  interface CoLeafFrontMatter extends Literal {
    type: 'coleafFrontMatter'
  }
  /** Inline HTML tags paired around their content (`<sub>2</sub>`), see inlineHtml.ts. */
  interface CoLeafHtmlWrap extends Parent {
    type: 'coleafHtmlWrap'
    open: string
    close: string
    /** How many wraps with the same tags enclose this one. */
    depth: number
    children: PhrasingContent[]
  }
  interface RootContentMap {
    coleafRaw: CoLeafRaw
    coleafFrontMatter: CoLeafFrontMatter
    coleafHtmlWrap: CoLeafHtmlWrap
  }
  interface PhrasingContentMap {
    coleafRaw: CoLeafRaw
    coleafHtmlWrap: CoLeafHtmlWrap
  }
  interface LinkData {
    /** How the file wrote the link; null when it was made in the editor. */
    coleafForm?: 'resource' | 'autolink' | null
    /** A bare URL, www. address or email (GFM autolink literal): written as its text. */
    literal?: boolean
  }
  interface TableData {
    /** The exact source of a top-level table: written back while the table is untouched. */
    coleafSource?: string
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

// Always escaped: backslashes, backticks and tags, and inside a table cell also pipes and line
// breaks. At a line start also `#`, `>`, list markers and `1.`; not `[`, `=`, `_` or `~`,
// which only matter in shapes the safety net catches.
const keptEverywhere = new Set(['\\', '`', '<'])
const leftToSafetyNet = new Set(['[', '=', '_', '~'])
const inTableCell = (rule: Unsafe): boolean => toArray(rule.inConstruct).includes('tableCell')

const minimalText: Handle = (node: Text, _parent, state, info) => {
  const all = state.unsafe
  state.unsafe = all.filter(
    (rule: Unsafe) =>
      keptEverywhere.has(rule.character) ||
      inTableCell(rule) ||
      (rule.atBreak && !leftToSafetyNet.has(rule.character))
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

// A link the file wrote as `[text](url)` stays that way even when the text is the URL; remark
// would otherwise shorten it to `<url>`. Links made in the editor get remark's choice. And an
// `&` in the address is left alone (`?a=1&b=2`): remark escapes it, Prettier and GitHub don't.
const destinations: ConstructName[] = ['destinationRaw', 'destinationLiteral']
const link: Handle = (node, parent, state, info) => {
  const savedResourceLink = state.options.resourceLink
  const savedUnsafe = state.unsafe
  state.options.resourceLink = (node as Link).data?.coleafForm === 'resource'
  state.unsafe = savedUnsafe.map((rule: Unsafe) =>
    rule.character === '&'
      ? { ...rule, notInConstruct: [...toArray(rule.notInConstruct), ...destinations] }
      : rule
  )
  try {
    return defaultHandlers.link(node as Link, parent, state, info)
  } finally {
    state.options.resourceLink = savedResourceLink
    state.unsafe = savedUnsafe
  }
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  return value == null ? [] : Array.isArray(value) ? value : [value]
}

// A table is laid out like Prettier: every column padded to its widest cell (at least 3), the
// text centered or right-aligned in aligned columns, and a `---` delimiter row with colons for
// the alignment. The cells themselves are written by remark-gfm (pipes escaped).
const table: Handle = (node: Table, _parent, state, info) => {
  const exit = state.enter('table')
  const rows = node.children.map((row) => {
    const exitRow = state.enter('tableRow')
    const cells = row.children.map((cell) => state.handle(cell, row, state, info))
    exitRow()
    return cells
  })
  exit()
  return layoutTable(rows, node.align ?? [])
}

function layoutTable(rows: string[][], align: (AlignType | null)[]): string {
  const header = rows[0] ?? []
  const widths = header.map((_, column) =>
    Math.max(3, ...rows.map((row) => stringWidth(row[column] ?? '')))
  )
  const pad = (text: string, column: number): string => {
    const width = widths[column]
    if (width === undefined) return text
    const spaces = Math.max(0, width - stringWidth(text))
    const kind = align[column]
    const left = kind === 'center' ? Math.floor(spaces / 2) : kind === 'right' ? spaces : 0
    return ' '.repeat(left) + text + ' '.repeat(spaces - left)
  }
  const line = (cells: string[]): string => `| ${cells.join(' | ')} |`
  const delimiter = widths.map((width, column) => {
    const kind = align[column]
    const start = kind === 'left' || kind === 'center' ? ':' : '-'
    const end = kind === 'right' || kind === 'center' ? ':' : '-'
    return start + '-'.repeat(width - 2) + end
  })
  const body = rows.slice(1).map((row) => line(row.map(pad)))
  return [line(header.map(pad)), line(delimiter), ...body].join('\n')
}

// Emoji sequences and East Asian wide characters take two columns, as in Prettier.
const emoji = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*/gu
const wide = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦\u{20000}-\u{3FFFD}]/u

/** The display width of a cell's text, counted the way Prettier pads table columns. */
export function stringWidth(text: string): number {
  if (/^[\x20-\x7e]*$/.test(text)) return text.length
  let width = 0
  for (const char of text.replace(emoji, '  ')) {
    const code = char.codePointAt(0) ?? 0
    if (code < 0x20 || (code >= 0x7f && code < 0xa0) || /\p{M}/u.test(char)) continue
    width += wide.test(char) ? 2 : 1
  }
  return width
}

// A backslash at the end of a text run, or right before its last letter, is written as `\\`:
// remark may encode that last letter as `&#x61;` next to an emphasis marker, and a marker or
// line end may follow the run, none of which may turn a literal backslash into an escape or a
// hard break. `\\` is a literal backslash in every case. A task item whose text starts with a
// parenthesis gets it escaped (`- [ ] \(Optional)`), as GitHub asks; the text node is marked
// beforehand by markTaskItemParentheses, since the handler cannot see the item.
const backslashAtEnd = /\\([\p{L}\p{N}]?)$/u
function withSafeEnds(handle: Handle): Handle {
  return (node: Text, parent, state, info) => {
    const escapeParenthesis = (node.data as { coleafTaskStart?: boolean } | undefined)
      ?.coleafTaskStart
    const value = escapeParenthesis ? node.value.slice(1) : node.value
    const prefix = escapeParenthesis ? '\\(' : ''
    const match = backslashAtEnd.exec(value)
    if (!match) return prefix + handle({ ...node, value }, parent, state, info)
    const head = value.slice(0, value.length - match[0].length)
    return prefix + handle({ ...node, value: head }, parent, state, info) + '\\\\' + match[1]
  }
}

function markTaskItemParentheses(node: Nodes): void {
  if (!('children' in node)) return
  for (const child of (node as Parent).children) {
    if (child.type === 'listItem' && child.checked != null) {
      const paragraph = child.children[0]
      const text = paragraph?.type === 'paragraph' ? paragraph.children[0] : undefined
      if (text?.type === 'text' && text.value.startsWith('(')) {
        text.data = { ...text.data, coleafTaskStart: true }
      }
    }
    markTaskItemParentheses(child)
  }
}

// One consistent, Prettier-compatible style for everything we write (AGENTS.md rule 1).
export function stringifyOptions(escaping: Escaping): StringifyOptions {
  const handlers: Handlers = {
    coleafRaw: (node: CoLeafRaw): string => node.value,
    coleafFrontMatter: (node: CoLeafFrontMatter): string => node.value,
    emphasis,
    link,
    table,
    text: withSafeEnds(escaping === 'minimal' ? minimalText : defaultHandlers.text)
  }
  return {
    bullet: '-',
    emphasis: '_',
    strong: '*',
    fences: true,
    rule: '-',
    listItemIndent: 'one',
    incrementListMarker: true,
    // remark-math's own `$` rule carries an empty `after` condition, so remark skips the escape
    // when the next character is escaped too (`$_` came out as `$\_`, which reopens as math).
    // This rule has no condition: every `$` in text is escaped.
    unsafe: [{ character: '$', inConstruct: 'phrasing' }],
    handlers
  }
}

/** Parses GitHub-flavored Markdown (without front matter), with GitHub's math, into mdast. */
export function parseMarkdown(text: string): Root {
  return unified().use(remarkParse).use(remarkGfm, gfmOptions).use(remarkMath).parse(text)
}

/** Writes mdast as Markdown in CoLeaf's style. */
export function stringifyMdast(root: Root, escaping: Escaping = 'full'): string {
  chooseEmphasisMarkers(root)
  markTaskItemParentheses(root)
  return unified()
    .use(remarkGfm, gfmOptions)
    .use(remarkMath)
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
