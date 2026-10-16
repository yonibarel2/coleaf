import type { Node as PmNode } from 'prosemirror-model'

/**
 * The save rule (AGENTS.md rule 1): a document is written only when it differs from what was
 * last read or written, so an untouched file is never rewritten, and an edit that was undone
 * counts as untouched.
 */
export function needsSave(savedDoc: PmNode, doc: PmNode): boolean {
  return !doc.eq(savedDoc)
}
