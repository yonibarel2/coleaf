import type { CoLeafHtmlWrap, Nodes, Parent, PhrasingContent } from 'mdast'
import { parseTag } from './htmlTags'

// Markdown gives inline HTML tag by tag: `<b>`, text, `</b>`. GitHub shows them as the element
// they make. This pairs an opening tag with its closing tag among the same siblings and wraps
// what lies between (a coleafHtmlWrap node, an htmlMark in the editor); the file gets the two
// tags back as they were. Tags with nothing between them become one piece; a tag with no
// partner stays one piece too (shown as a chip). A wrap inside a wrap with the same tags
// counts its depth, so the editor tells the two marks apart.

const phrasingParents = new Set([
  'paragraph',
  'heading',
  'emphasis',
  'strong',
  'delete',
  'link',
  'linkReference',
  'tableCell',
  'coleafHtmlWrap'
])

/** Pairs the inline HTML tags of a tree, in place. */
export function pairInlineHtml(tree: Nodes): void {
  if (!('children' in tree)) return
  const parent = tree as Parent
  if (phrasingParents.has(parent.type)) {
    parent.children = pairSiblings(parent.children as PhrasingContent[], [])
  }
  for (const child of parent.children) pairInlineHtml(child)
}

function pairSiblings(children: PhrasingContent[], enclosing: CoLeafHtmlWrap[]): PhrasingContent[] {
  const result: PhrasingContent[] = []
  for (let index = 0; index < children.length; index++) {
    const node = children[index]
    const tag = node.type === 'html' ? parseTag(node.value) : null
    if (node.type !== 'html' || tag?.kind !== 'open') {
      result.push(node)
      continue
    }
    const close = findClose(children, index + 1, tag.name)
    if (close === -1) {
      result.push(node)
    } else if (close === index + 1) {
      const partner = children[close] as { value: string }
      result.push({ type: 'html', value: node.value + partner.value })
    } else {
      const open = node.value
      const closeValue = (children[close] as { value: string }).value
      const wrap: CoLeafHtmlWrap = {
        type: 'coleafHtmlWrap',
        open,
        close: closeValue,
        depth: enclosing.filter((outer) => outer.open === open && outer.close === closeValue)
          .length,
        children: []
      }
      wrap.children = pairSiblings(children.slice(index + 1, close), [...enclosing, wrap])
      result.push(wrap)
    }
    if (close !== -1) index = close
  }
  return result
}

// The closing tag for an opening tag at the same level, past any nested pair of the same name.
function findClose(children: PhrasingContent[], from: number, name: string): number {
  let depth = 0
  for (let index = from; index < children.length; index++) {
    const node = children[index]
    if (node.type !== 'html') continue
    const tag = parseTag(node.value)
    if (tag.name !== name) continue
    if (tag.kind === 'open') depth++
    else if (tag.kind === 'close') {
      if (depth === 0) return index
      depth--
    }
  }
  return -1
}
