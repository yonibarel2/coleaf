import { Transform } from '@tiptap/pm/transform'
import { describe, expect, it } from 'vitest'
import { schema } from '../../src/renderer/editor/extensions'
import { markdownToDoc } from '../../src/renderer/markdown/toDoc'
import { needsSave } from '../../src/renderer/tabs/saveRule'

const text = '# Title\n\nSome text.\n'

describe('save rule', () => {
  it('never writes an untouched document', () => {
    const opened = markdownToDoc(text, schema)
    expect(needsSave(opened, opened)).toBe(false)
    expect(needsSave(opened, markdownToDoc(text, schema))).toBe(false)
  })

  it('writes an edited document', () => {
    const opened = markdownToDoc(text, schema)
    const position = opened.content.size - 1
    const edited = new Transform(opened).replaceWith(position, position, schema.text('!')).doc
    expect(needsSave(opened, edited)).toBe(true)
  })

  it('treats an edit that was undone as untouched', () => {
    const opened = markdownToDoc(text, schema)
    const position = opened.content.size - 1
    const edited = new Transform(opened).replaceWith(position, position, schema.text('!')).doc
    const undone = new Transform(edited).delete(position, position + 1).doc
    expect(needsSave(opened, undone)).toBe(false)
  })
})
