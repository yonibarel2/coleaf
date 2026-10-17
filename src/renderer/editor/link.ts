import type { Editor } from '@tiptap/core'
import type { LinkDraft } from './LinkPanel'
import { isMarkdownPath, resolveRepoPath } from './paths'

/** What the link panel starts with: the selected text, and the link under the cursor if any. */
export function linkDraftFor(editor: Editor): LinkDraft {
  const href = editor.getAttributes('link')['href']
  if (typeof href === 'string') editor.commands.extendMarkRange('link')
  const { from, to } = editor.state.selection
  return {
    text: editor.state.doc.textBetween(from, to),
    href: typeof href === 'string' ? href : ''
  }
}

/** Puts a link in the document: over the selection, or replacing the link under the cursor. */
export function insertLink(editor: Editor, { text, href }: LinkDraft): void {
  editor
    .chain()
    .focus()
    .extendMarkRange('link')
    .insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] })
    .run()
}

export type LinkTarget =
  { kind: 'web'; url: string } | { kind: 'file'; path: string; fragment: string | null }

const webSchemes = new Set(['http', 'https', 'mailto'])

/**
 * What a link points at: a web address (opened in the browser), a Markdown file of the project
 * with an optional `#heading`, or nothing CoLeaf acts on (other files, other schemes, paths
 * that leave the project).
 */
export function resolveLink(documentPath: string, href: string): LinkTarget | null {
  const url = href.trim()
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]?.toLowerCase()
  if (scheme) return webSchemes.has(scheme) ? { kind: 'web', url } : null
  const hash = url.indexOf('#')
  const fragment = hash >= 0 ? decode(url.slice(hash + 1)) : ''
  const file = hash >= 0 ? url.slice(0, hash) : url
  const path = file === '' ? documentPath : resolveRepoPath(documentPath, file)
  if (!path || !isMarkdownPath(path)) return null
  return { kind: 'file', path, fragment: fragment || null }
}

function decode(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

/** GitHub's heading anchors: lowercase, punctuation dropped, spaces to hyphens, repeats numbered. */
export function headingSlugs(headings: string[]): string[] {
  const seen = new Map<string, number>()
  return headings.map((text) => {
    const slug = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M} _-]/gu, '')
      .replace(/ /g, '-')
    const count = seen.get(slug) ?? 0
    seen.set(slug, count + 1)
    return count === 0 ? slug : `${slug}-${count}`
  })
}

/** Puts the cursor on the heading a `#fragment` names and scrolls it to the top of the page. */
export function jumpToHeading(editor: Editor, fragment: string): void {
  whenShown(editor, () => {
    const headings: { pos: number; text: string }[] = []
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') headings.push({ pos, text: node.textContent })
    })
    const index = headingSlugs(headings.map((heading) => heading.text)).indexOf(
      fragment.toLowerCase()
    )
    if (index < 0) return
    const { pos } = headings[index]
    editor
      .chain()
      .focus(pos + 1)
      .run()
    const dom = editor.view.nodeDOM(pos)
    if (dom instanceof HTMLElement) dom.scrollIntoView({ block: 'start' })
  })
}

// A tab that was just opened shows its editor a moment later, once React has put it in the page.
function whenShown(editor: Editor, action: () => void, tries = 30): void {
  if (editor.view.dom.isConnected) action()
  else if (tries > 0) requestAnimationFrame(() => whenShown(editor, action, tries - 1))
}
