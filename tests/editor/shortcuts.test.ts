import type { AnyExtension } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { createExtensions } from '../../src/renderer/editor/extensions'
import { keysLabel, shortcuts } from '../../src/renderer/editor/shortcuts'

// The editor's shortcuts, from the one list the ribbon and the Help dialog also read; the File
// group (save, new file, open project) belongs to the application menu.
const specShortcuts = shortcuts
  .filter((shortcut) => shortcut.group !== 'File')
  .map((shortcut) => shortcut.keys)

// Plain editing keys TipTap binds for lists and code blocks: not formatting shortcuts.
const editingKeys = [
  'Enter',
  'Backspace',
  'Delete',
  'Mod-Backspace',
  'Mod-Delete',
  'ArrowUp',
  'ArrowDown'
]

type ConfigMethod = (this: unknown) => unknown

// Calls an extension's config method the way TipTap does, without an editor: the commands
// inside are closures that never run here, only the returned keys and extensions matter.
function callConfig(
  extension: AnyExtension,
  method: 'addKeyboardShortcuts' | 'addExtensions'
): unknown {
  const fn = extension.config[method] as ConfigMethod | undefined
  return fn?.call({
    name: extension.name,
    options: extension.options,
    storage: extension.storage,
    editor: {},
    type: null,
    parent: extension.parent?.config[method]
  })
}

function flatten(extensions: AnyExtension[]): AnyExtension[] {
  return extensions.flatMap((extension) => [
    extension,
    ...flatten((callConfig(extension, 'addExtensions') as AnyExtension[] | undefined) ?? [])
  ])
}

function boundKeys(extension: AnyExtension): string[] {
  return Object.keys((callConfig(extension, 'addKeyboardShortcuts') as object | undefined) ?? {})
}

// 'Mod-B' is the same key as 'Mod-b' (TipTap binds both).
const normalize = (key: string): string =>
  key.replace(/-([A-Z])$/, (_, c: string) => `-${c.toLowerCase()}`)

describe('editor keyboard shortcuts', () => {
  it('bind exactly the shortcuts of the spec, plus plain editing keys', () => {
    const extensions = flatten(
      createExtensions({
        onLink: () => {},
        onFind: () => {},
        onActivateLink: () => {},
        documentPath: ''
      })
    )
    const keys = new Set(extensions.flatMap(boundKeys).map(normalize))
    const expected = new Set([...specShortcuts, ...editingKeys])
    expect([...keys].sort()).toEqual([...expected].sort())
  })

  it('have unique ids and keys', () => {
    const ids = shortcuts.map((shortcut) => shortcut.id)
    const keys = shortcuts.map((shortcut) => shortcut.keys)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('are shown the way people read them', () => {
    expect(keysLabel('Mod-Shift-n', false)).toBe('Ctrl+Shift+N')
    expect(keysLabel('Mod-Alt-1', false)).toBe('Ctrl+Alt+1')
    expect(keysLabel('Shift-Enter', false)).toBe('Shift+Enter')
    expect(keysLabel('Tab', false)).toBe('Tab')
    expect(keysLabel('Mod-Shift-n', true)).toBe('⌘⇧N')
  })
})
