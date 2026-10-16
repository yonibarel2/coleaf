import {
  remarkProseMirror,
  toPmMark,
  toPmNode,
  type RemarkProseMirrorOptions
} from '@handlewithcare/remark-prosemirror'
import type { Parent, PhrasingContent, Root, RootContent } from 'mdast'
import type { Node as PmNode, Schema } from 'prosemirror-model'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { markdownOfBlock, markdownOfInline, sourceOf, withoutPositions } from './mdast'

type Handlers = RemarkProseMirrorOptions['handlers']

/** Turns Markdown text into an editor document. Nothing the parser produces is dropped. */
export function markdownToDoc(text: string, schema: Schema): PmNode {
  const file = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ['yaml', 'toml'])
    .use(() => (tree: Root) => keepRawBlocks(tree, text))
    .use(remarkProseMirror, { schema, handlers: createHandlers(schema, text) })
    .processSync(text)
  return file.result as PmNode
}

// Blocks the editor does not edit yet (docs/markdown-spec.md: Later and Kept as-is).
function isRawBlock(node: RootContent): boolean {
  switch (node.type) {
    case 'definition':
    case 'footnoteDefinition':
    case 'table':
    case 'yaml':
    case 'toml':
      return true
    case 'list':
      return node.children.some((item) => item.checked != null) // task list
    default:
      return false
  }
}

/**
 * Top-level raw blocks keep their exact source text, and neighbours with no blank line between
 * them (typically link definitions) become one block, so nothing is restyled on save. Nested raw
 * blocks are re-written from their mdast instead: their source carries the container's prefixes.
 */
function keepRawBlocks(tree: Root, text: string): void {
  const children: RootContent[] = []
  let run: RootContent[] = []
  const flush = (): void => {
    if (run.length === 0) return
    const first = run[0]
    const last = run[run.length - 1]
    const start = first.position?.start.offset
    const end = last.position?.end.offset
    if (start != null && end != null) {
      children.push({
        type: 'coleafRaw',
        value: text.slice(start, end),
        position: { start: first.position!.start, end: last.position!.end }
      })
    } else {
      children.push(...run)
    }
    run = []
  }
  for (const node of tree.children) {
    if (!isRawBlock(node)) {
      flush()
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
  tree.children = children
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
      const trimmed = index > 0 ? line.replace(/^[ \t]+/, '') : line
      if (trimmed) result.push(schema.text(trimmed))
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
      if (isRawBlock(node)) return rawBlock(node) // a nested task list
      const type = node.ordered ? nodes.orderedList : nodes.bulletList
      const spread = node.spread ?? false
      const attrs = node.ordered ? { start: node.start ?? 1, spread } : { spread }
      return type.createAndFill(attrs, state.all(node))
    },
    listItem: (node, _, state) =>
      nodes.listItem.createAndFill({ spread: node.spread ?? false }, state.all(node)),
    html: (node, parent) =>
      phrasingParents.has(parent.type)
        ? rawInline(node)
        : nodes.htmlBlock.create({ html: node.value }),
    coleafRaw: (node) => nodes.rawBlock.create({ markdown: node.value, source: node.value }),
    text: (node) => textNodes(node.value),
    emphasis: toPmMark(marks.italic),
    strong: toPmMark(marks.bold),
    inlineCode: (node) => schema.text(node.value, [marks.code.create()]),
    link: toPmMark(marks.link, (node) => ({ href: node.url, title: node.title ?? null })),
    image: (node) =>
      nodes.image.create({ src: node.url, alt: node.alt ?? null, title: node.title ?? null }),
    break: () => nodes.hardBreak.create(),
    definition: rawBlock,
    footnoteDefinition: rawBlock,
    table: rawBlock,
    yaml: rawBlock,
    toml: rawBlock,
    footnoteReference: rawInline,
    imageReference: rawInline,
    linkReference: (node, _, state) => rawMark(node, state.all(node)),
    delete: (node, _, state) => rawMark(node, state.all(node))
  }
}
