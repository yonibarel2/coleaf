import {
  fromPmMark,
  fromPmNode,
  fromProseMirror,
  type FromProseMirrorOptions
} from '@handlewithcare/remark-prosemirror'
import type { AlignType, ListItem, Nodes, PhrasingContent, RootContent, TableRow } from 'mdast'
import type { Node as PmNode } from 'prosemirror-model'
import { mergeText, parseMarkdown, sameShape, stringifyMdast } from './mdast'

type Options = FromProseMirrorOptions<string, string>
type NodeHandler = Options['nodeHandlers'][string]

// A GFM cell is one line of inline text: its paragraph's content, a line break as `<br>`.
function cellContent(blocks: RootContent[]): PhrasingContent[] {
  return blocks
    .flatMap((block) => (block.type === 'paragraph' ? block.children : []))
    .map((child): PhrasingContent => {
      if (child.type === 'break') return { type: 'html', value: '<br>' }
      if (child.type === 'text') return { ...child, value: child.value.replace(/\n/g, ' ') }
      return child
    })
}

const tableCell: NodeHandler = (node, _parent, state) => ({
  type: 'tableCell',
  children: cellContent(state.all(node) as RootContent[])
})

// Only a list starting at 1 may follow a paragraph without a blank line (CommonMark); a nested
// list starting elsewhere needs the item written loose, or it would read as paragraph text.
function needsBlankLine(children: ListItem['children']): boolean {
  return children.some(
    (child, index) =>
      child.type === 'paragraph' &&
      children[index + 1]?.type === 'list' &&
      (children[index + 1] as { start?: number | null }).start != null &&
      (children[index + 1] as { start?: number | null }).start !== 1
  )
}

// A raw node goes back as its exact source when it has one, else as the mdast node it kept.
function rawContent(node: PmNode): RootContent {
  const source = node.attrs['source']
  if (typeof source === 'string') return { type: 'coleafRaw', value: source }
  return structuredClone(node.attrs['node']) as RootContent
}

const nodeHandlers: Options['nodeHandlers'] = {
  paragraph: fromPmNode('paragraph'),
  heading: fromPmNode('heading', (node) => ({ depth: node.attrs['level'] })),
  blockquote: fromPmNode('blockquote'),
  horizontalRule: () => ({ type: 'thematicBreak' }),
  codeBlock: (node) => ({
    type: 'code',
    lang: node.attrs['language'] ?? null,
    meta: node.attrs['meta'] ?? null,
    value: node.textContent
  }),
  bulletList: fromPmNode('list', (node) => ({ ordered: false, spread: node.attrs['spread'] })),
  orderedList: fromPmNode('list', (node) => ({
    ordered: true,
    start: node.attrs['start'],
    spread: node.attrs['spread']
  })),
  listItem: (node, _parent, state) => {
    const children = state.all(node) as ListItem['children']
    return {
      type: 'listItem',
      spread: node.attrs['spread'] || needsBlankLine(children),
      checked: typeof node.attrs['checked'] === 'boolean' ? node.attrs['checked'] : null,
      children
    }
  },
  hardBreak: () => ({ type: 'break' }),
  softBreak: () => ({ type: 'text', value: '\n' }),
  image: (node) => ({
    type: 'image',
    url: node.attrs['src'],
    alt: node.attrs['alt'] ?? null,
    title: node.attrs['title'] ?? null
  }),
  htmlBlock: (node) => ({ type: 'html', value: node.attrs['html'] }),
  // Untouched since it was opened: written back exactly as the file had it (see toDoc.ts).
  table: (node, _parent, state) => {
    const source = node.attrs['source']
    const untouched =
      JSON.stringify(node.content.toJSON()) === JSON.stringify(node.attrs['original'])
    if (typeof source === 'string' && untouched) return { type: 'coleafRaw', value: source }
    const align: AlignType[] = []
    node.firstChild?.forEach((cell) => align.push((cell.attrs['align'] as AlignType) ?? null))
    return { type: 'table', align, children: state.all(node) as TableRow[] }
  },
  tableRow: fromPmNode('tableRow'),
  tableCell,
  tableHeader: tableCell,
  rawBlock: rawContent,
  rawInline: (node) => rawContent(node) as PhrasingContent
}

const markHandlers: Options['markHandlers'] = {
  bold: fromPmMark('strong'),
  italic: fromPmMark('emphasis'),
  strike: fromPmMark('delete'),
  code: (_mark, _parent, children) => ({
    type: 'inlineCode',
    value: children.map((child) => ('value' in child ? child.value : '')).join('')
  }),
  link: fromPmMark('link', (mark) => ({
    url: mark.attrs['href'],
    title: mark.attrs['title'] ?? null,
    data: { coleafForm: mark.attrs['form'] ?? null }
  })),
  rawMark: (mark, _parent, children) => {
    const node = structuredClone(mark.attrs['node']) as PhrasingContent
    // A bare URL (GFM autolink literal) is written as its text; GitHub links it again.
    if (node.type === 'link' && node.data?.['literal']) return children as Nodes[]
    return { ...node, children } as PhrasingContent
  }
}

/**
 * Turns an editor document into Markdown text in CoLeaf's style. Text is escaped as little as
 * possible, so syntax other tools rely on survives; when that would change what the file means
 * (a typed `*word*` would become italic), the whole file is written with full escaping instead.
 */
export function docToMarkdown(doc: PmNode): string {
  const root = mergeText(
    fromProseMirror(doc, { schema: doc.type.schema, nodeHandlers, markHandlers })
  )
  const minimal = stringifyMdast(root, 'minimal')
  const full = stringifyMdast(root, 'full')
  if (minimal === full) return minimal
  const same = sameShape(mergeText(parseMarkdown(minimal)), mergeText(parseMarkdown(full)))
  return same ? minimal : full
}
