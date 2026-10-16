import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PmNode } from 'prosemirror-model'

// GitHub alerts: a quote whose first line is `[!NOTE]` (or TIP, IMPORTANT, WARNING, CAUTION)
// alone. The marker stays in the text, so the file is saved as it was; decorations give the
// quote its color and show the marker as a label (editor.css).

export type AlertKind = 'note' | 'tip' | 'important' | 'warning' | 'caution'

export interface Alert {
  kind: AlertKind
  /** The blockquote. */
  from: number
  to: number
  /** The `[!KIND]` text. */
  markerFrom: number
  markerTo: number
}

const marker = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/
const lineBreaks = new Set(['softBreak', 'hardBreak'])

export const alertLabels: Record<AlertKind, string> = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution'
}

/** Every alert in the document, outermost quotes first. */
export function findAlerts(doc: PmNode): Alert[] {
  const alerts: Alert[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'blockquote') return
    const paragraph = node.firstChild
    const text = paragraph?.firstChild
    if (paragraph?.type.name !== 'paragraph' || !text?.isText || !text.text) return
    const match = marker.exec(text.text)
    const next = paragraph.maybeChild(1)
    const alone = next === null || lineBreaks.has(next.type.name)
    if (!match || !alone || text.marks.length > 0) return
    const markerFrom = pos + 2 // past the quote's and the paragraph's opening
    alerts.push({
      kind: match[1].toLowerCase() as AlertKind,
      from: pos,
      to: pos + node.nodeSize,
      markerFrom,
      markerTo: markerFrom + text.text.length
    })
  })
  return alerts
}

function decorate(doc: PmNode): DecorationSet {
  return DecorationSet.create(
    doc,
    findAlerts(doc).flatMap((alert) => [
      Decoration.node(alert.from, alert.to, { class: `alert alert--${alert.kind}` }),
      Decoration.inline(alert.markerFrom, alert.markerTo, {
        class: 'alert__marker',
        'data-label': alertLabels[alert.kind]
      })
    ])
  )
}

export const CoLeafAlerts = Extension.create({
  name: 'coleafAlerts',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: new PluginKey('coleafAlerts'),
        state: {
          init: (_, state) => decorate(state.doc),
          apply: (tr, old) => (tr.docChanged ? decorate(tr.doc) : old)
        },
        props: {
          decorations(state) {
            return this.getState(state)
          }
        }
      })
    ]
  }
})
