import type { AnyExtension } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { createExtensions } from '../../src/renderer/editor/extensions'

// The shortcuts of docs/markdown-spec.md (Stage 1 rows). Ctrl+S is handled by the window.
const specShortcuts = [
  'Mod-b',
  'Mod-i',
  'Mod-k',
  'Mod-Alt-1',
  'Mod-Alt-2',
  'Mod-Alt-3',
  'Mod-Shift-n',
  'Mod-Shift-l',
  'Tab',
  'Shift-Tab',
  'Shift-Enter',
  'Mod-z',
  'Mod-y'
]

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
    const extensions = flatten(createExtensions({ onLink: () => {} }))
    const keys = new Set(extensions.flatMap(boundKeys).map(normalize))
    const expected = new Set([...specShortcuts, ...editingKeys])
    expect([...keys].sort()).toEqual([...expected].sort())
  })
})
