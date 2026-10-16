import {
  remarkProseMirror,
  toPmMark,
  toPmNode,
  type RemarkProseMirrorOptions
} from '@handlewithcare/remark-prosemirror'
import type { Parent, PhrasingContent, Root, RootContent } from 'mdast'
import type { Node as PmNode, Schema } from 'prosemirror-model'
import type { Position } from 'unist'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import {
  gfmOptions,
  markdownOfBlock,
  markdownOfInline,
  sourceOf,
  splitFrontMatter,
  withoutPositions
} from './mdast'

type Handlers = RemarkProseMirrorOptions['handlers']

/** Turns Markdown text into an editor document. Nothing the parser produces is dropped. */
export function markdownToDoc(text: string, schema: Schema): PmNode {
  const { frontMatter, body } = splitFrontMatter(text)
  const file = unified()
    .use(remarkParse)
    .use(remarkGfm, gfmOptions)
    .use(() => (tree: Root) => keepRawBlocks(tree, body, frontMatter))
    .use(remarkProseMirror, { schema, handlers: createHandlers(schema, body) })
    .processSync(body)
  return file.result as PmNode
}

// Blocks the editor does not edit yet (docs/markdown-spec.md: Later and Kept as-is).
function isRawBlock(node: RootContent): boolean {
  return node.type === 'definition' || node.type === 'footnoteDefinition'
}

/**
 * Top-level raw blocks keep their exact source text, and neighbours with no blank line between
 * them (link definitions, HTML comments) become one block, so nothing is restyled on save.
 * Nested raw blocks are re-written from their mdast instead: their source carries the
 * container's prefixes. Front matter, split off before parsing, comes first. A top-level
 * table also remembers its source, so it is written back verbatim while it is untouched.
 */
function keepRawBlocks(tree: Root, text: string, frontMatter: string | null): void {
  const children: RootContent[] = []
  if (frontMatter !== null) children.push({ type: 'coleafRaw', value: frontMatter })
  let run: RootContent[] = []
  const flush = (): void => {
    if (run.length === 0) return
    const first = run[0]
    const last = run[run.length - 1]
    const start = first.position?.start.offset
    const end = last.position?.end.offset
    // A lone HTML block stays an HTML block; it is raw by itself.
    const keepAsIs = start == null || end == null || (run.length === 1 && first.type === 'html')
    if (keepAsIs) children.push(...run)
    else children.push({ type: 'coleafRaw', value: text.slice(start, end) })
    run = []
  }
  for (const node of tree.children) {
    if (!isRawBlock(node) && node.type !== 'html') {
      flush()
      if (node.type === 'table') {
        const source = sourceOf(node, text)
        if (source !== null) node.data = { ...node.data, coleafSource: source }
      }
      children.push(node)
      continue
    }
    const previous = run[run.length - 1]
    const gap = previous
      ? text.slice(previous.position?.end.offset ?? 0, node.position?.start.offset ?? 0)
      : ''
    if (previous && /\n[ \t]*\n/.test(gap)) flush()
    run.push(node)
  }
  flush()
  // An empty file (File › New File, or only blank lines) opens as one empty paragraph: the
  // editor needs a block to put the cursor in. It is saved as empty text again.
  if (children.length === 0) children.push({ type: 'paragraph', children: [] })
  tree.children = children
}

// Loose (blank lines between the parts) is read off the source lines: remark's own `spread`
// flag also turns on for a trailing blank line inside a blockquote, which is no blank line
// between anything and would make the next save write the list loose.
function isLoose(
  children: { position?: Position }[],
  fallback: boolean | null | undefined
): boolean {
  if (children.some((child) => !child.position)) return fallback ?? false
  return children.some(
    (child, index) =>
      index > 0 && child.position!.start.line > children[index - 1].position!.end.line + 1
  )
}

// Inline (phrasing) content lives under these mdast parents.
const phrasingParents = new Set([
  'paragraph',
  'heading',
  'emphasis',
  'strong',
  'delete',
  'link',
  'linkReference',
  'tableCell'
])

function createHandlers(schema: Schema, text: string): Handlers {
  const nodes = schema.nodes
  const marks = schema.marks

  // Raw blocks and inlines keep their source when it is exact, else their mdast node.
  const rawBlock = (node: RootContent): PmNode =>
    nodes.rawBlock.create({ markdown: markdownOfBlock(node), node: withoutPositions(node) })
  const rawInline = (node: PhrasingContent): PmNode => {
    const source = node.type === 'html' ? node.value : sourceOf(node, text)
    return source != null && !source.includes('\n')
      ? nodes.rawInline.create({ markdown: source, source })
      : nodes.rawInline.create({ markdown: markdownOfInline(node), node: withoutPositions(node) })
  }
  const rawMark = (node: Parent & PhrasingContent, children: PmNode[]): PmNode[] => {
    const mark = marks.rawMark.create({ node: withoutPositions({ ...node, children: [] }) })
    return children.map((child) => child.mark(mark.addToSet(child.marks)))
  }

  // A text node's line breaks become softBreak nodes, so the file keeps its wrapping.
  const textNodes = (value: string): PmNode[] => {
    const result: PmNode[] = []
    value.split('\n').forEach((line, index) => {
      if (index > 0) result.push(nodes.softBreak.create())
      if (line) result.push(schema.text(line))
    })
    return result
  }

  return {
    paragraph: toPmNode(nodes.paragraph),
    heading: toPmNode(nodes.heading, (node) => ({ level: node.depth })),
    blockquote: toPmNode(nodes.blockquote),
    thematicBreak: toPmNode(nodes.horizontalRule),
    code: (node) =>
      nodes.codeBlock.create(
        { language: node.lang ?? null, meta: node.meta ?? null },
        node.value ? schema.text(node.value) : undefined
      ),
    list: (node, _, state) => {
      const type = node.ordered ? nodes.orderedList : nodes.bulletList
      const spread = isLoose(node.children, node.spread)
      const attrs = node.ordered ? { start: node.start ?? 1, spread } : { spread }
      return type.createAndFill(attrs, state.all(node))
    },
    listItem: (node, _, state) =>
      nodes.listItem.createAndFill(
        { spread: isLoose(node.children, node.spread), checked: node.checked ?? null },
        state.all(node)
      ),
    // The first row is the header; a cell is one paragraph of inline content, aligned as its
    // column says. The rows as opened are kept on the table: an untouched one is saved as it was.
    table: (node, _, state) => {
      const align = node.align ?? []
      const rows = node.children.map((row, rowIndex) =>
        nodes.tableRow.create(
          null,
          row.children.map((cell, column) =>
            (rowIndex === 0 ? nodes.tableHeader : nodes.tableCell).create(
              { align: align[column] ?? null },
              nodes.paragraph.create(null, state.all(cell))
            )
          )
        )
      )
      return nodes.table.create(
        { source: node.data?.coleafSource ?? null, original: rows.map((row) => row.toJSON()) },
        rows
      )
    },
    html: (node, parent) =>
      phrasingParents.has(parent.type)
        ? rawInline(node)
        : nodes.htmlBlock.create({ html: node.value }),
    coleafRaw: (node) => nodes.rawBlock.create({ markdown: node.value, source: node.value }),
    text: (node) => textNodes(node.value),
    emphasis: toPmMark(marks.italic),
    strong: toPmMark(marks.bold),
    inlineCode: (node) => schema.text(node.value, [marks.code.create()]),
    link: (node, _, state) => {
      // A bare URL, www. address or email (GFM autolink literal) is kept literally, as a
      // raw mark; anything written as [text](url) or <url> becomes a real link.
      const source = sourceOf(node, text)
      if (source != null && !source.startsWith('[') && !source.startsWith('<')) {
        return rawMark({ ...node, data: { ...node.data, literal: true } }, state.all(node))
      }
      const form = source?.startsWith('<') ? 'autolink' : 'resource'
      const mark = marks.link.create({ href: node.url, title: node.title ?? null, form })
      return state.all(node).map((child) => child.mark(mark.addToSet(child.marks)))
    },
    image: (node) =>
      nodes.image.create({ src: node.url, alt: node.alt ?? null, title: node.title ?? null }),
    break: () => nodes.hardBreak.create(),
    definition: rawBlock,
    footnoteDefinition: rawBlock,
    footnoteReference: rawInline,
    imageReference: rawInline,
    linkReference: (node, _, state) => rawMark(node, state.all(node)),
    delete: toPmMark(marks.strike)
  }
}
