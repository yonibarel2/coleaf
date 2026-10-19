import type { NodeViewRenderer } from '@tiptap/core'
import type { Node as PmNode } from 'prosemirror-model'

/**
 * A list item with a GFM task box (`- [ ]`, `- [x]`) shows a checkbox in place of its bullet;
 * the tick is the one thing editable about task lists for now (docs/editor/markdown.md). Any
 * other item is a plain `li`.
 */
export const listItemView: NodeViewRenderer = ({ node, editor, getPos }) => {
  const dom = document.createElement('li')
  const content = document.createElement('div')
  content.className = 'list-item__content'
  dom.append(content)
  let current = node
  let box: HTMLInputElement | null = null

  const apply = (): void => {
    const checked = current.attrs['checked']
    if (typeof checked !== 'boolean') {
      dom.removeAttribute('data-checked')
      box?.parentElement?.remove()
      box = null
      return
    }
    dom.setAttribute('data-checked', String(checked))
    if (!box) {
      const label = document.createElement('label')
      label.className = 'task-box'
      label.contentEditable = 'false'
      box = document.createElement('input')
      box.type = 'checkbox'
      box.addEventListener('click', () => {
        const pos = getPos()
        if (!editor.isEditable || pos === undefined) return
        const attrs = { ...current.attrs, checked: !current.attrs['checked'] }
        editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, attrs))
      })
      label.append(box)
      dom.prepend(label)
    }
    box.checked = checked
    box.disabled = !editor.isEditable
  }
  apply()

  return {
    dom,
    contentDOM: content,
    update: (updated: PmNode) => {
      if (updated.type !== current.type) return false
      current = updated
      apply()
      return true
    },
    // The editor leaves the checkbox alone: its clicks are ours, its DOM changes not content.
    stopEvent: (event) => box !== null && event.target === box,
    ignoreMutation: (mutation) =>
      mutation.type !== 'selection' && !content.contains(mutation.target)
  }
}
