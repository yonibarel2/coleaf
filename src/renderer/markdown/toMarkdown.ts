import {
  fromPmMark,
  fromPmNode,
  fromProseMirror,
  type FromProseMirrorOptions
} from '@handlewithcare/remark-prosemirror'
import type { PhrasingContent, RootContent } from 'mdast'
import type { Node as PmNode } from 'prosemirror-model'
import { mergeText, stringifyMdast } from './mdast'

type Options = FromProseMirrorOptions<string, string>

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
  listItem: fromPmNode('listItem', (node) => ({ spread: node.attrs['spread'], checked: null })),
  hardBreak: () => ({ type: 'break' }),
  softBreak: () => ({ type: 'text', value: '\n' }),
  image: (node) => ({
    type: 'image',
    url: node.attrs['src'],
    alt: node.attrs['alt'] ?? null,
    title: node.attrs['title'] ?? null
  }),
  htmlBlock: (node) => ({ type: 'html', value: node.attrs['html'] }),
  rawBlock: rawContent,
  rawInline: (node) => rawContent(node) as PhrasingContent
}

const markHandlers: Options['markHandlers'] = {
  bold: fromPmMark('strong'),
  italic: fromPmMark('emphasis'),
  code: (_mark, _parent, children) => ({
    type: 'inlineCode',
    value: children.map((child) => ('value' in child ? child.value : '')).join('')
  }),
  link: fromPmMark('link', (mark) => ({
    url: mark.attrs['href'],
    title: mark.attrs['title'] ?? null
  })),
  rawMark: (mark, _parent, children) =>
    ({ ...(structuredClone(mark.attrs['node']) as PhrasingContent), children }) as PhrasingContent
}

/** Turns an editor document into Markdown text in CoLeaf's style. */
export function docToMarkdown(doc: PmNode): string {
  const root = fromProseMirror(doc, { schema: doc.type.schema, nodeHandlers, markHandlers })
  return stringifyMdast(mergeText(root))
}
