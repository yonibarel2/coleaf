// Every keyboard shortcut, in ProseMirror's key notation (Mod is Ctrl, or Cmd on a Mac). The
// editor's keymap, the ribbon tooltips and Help › Keyboard Shortcuts all read this one list;
// docs/markdown-spec.md is the source. tests/editor/shortcuts.test.ts checks the keymap agrees.

export type ShortcutGroup = 'Edit' | 'Styles' | 'Text' | 'Paragraph' | 'Insert' | 'File'

export interface Shortcut {
  id: string
  label: string
  keys: string
  group: ShortcutGroup
}

export const shortcuts: Shortcut[] = [
  { id: 'undo', label: 'Undo', keys: 'Mod-z', group: 'Edit' },
  { id: 'redo', label: 'Redo', keys: 'Mod-y', group: 'Edit' },
  { id: 'find', label: 'Find / Replace', keys: 'Mod-f', group: 'Edit' },
  { id: 'normal', label: 'Normal text', keys: 'Mod-Shift-n', group: 'Styles' },
  { id: 'heading1', label: 'Heading 1', keys: 'Mod-Alt-1', group: 'Styles' },
  { id: 'heading2', label: 'Heading 2', keys: 'Mod-Alt-2', group: 'Styles' },
  { id: 'heading3', label: 'Heading 3', keys: 'Mod-Alt-3', group: 'Styles' },
  { id: 'bold', label: 'Bold', keys: 'Mod-b', group: 'Text' },
  { id: 'italic', label: 'Italic', keys: 'Mod-i', group: 'Text' },
  { id: 'lineBreak', label: 'Line break', keys: 'Shift-Enter', group: 'Text' },
  { id: 'bulletList', label: 'Bullets', keys: 'Mod-Shift-l', group: 'Paragraph' },
  { id: 'indent', label: 'Increase indent', keys: 'Tab', group: 'Paragraph' },
  { id: 'outdent', label: 'Decrease indent', keys: 'Shift-Tab', group: 'Paragraph' },
  { id: 'link', label: 'Link', keys: 'Mod-k', group: 'Insert' },
  { id: 'save', label: 'Save', keys: 'Mod-s', group: 'File' },
  { id: 'newFile', label: 'New file', keys: 'Mod-n', group: 'File' },
  { id: 'openProject', label: 'Open project', keys: 'Mod-o', group: 'File' }
]

/** The keys bound to a shortcut id, if it has any. */
export function shortcutKeys(id: string): string | undefined {
  return shortcuts.find((shortcut) => shortcut.id === id)?.keys
}

const onMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac')

/** How a shortcut is shown to people: `Mod-Shift-n` → `Ctrl+Shift+N`, or `⌘⇧N` on a Mac. */
export function keysLabel(keys: string, mac = onMac): string {
  const parts = keys.split('-').map((part) => {
    switch (part) {
      case 'Mod':
        return mac ? '⌘' : 'Ctrl'
      case 'Shift':
        return mac ? '⇧' : 'Shift'
      case 'Alt':
        return mac ? '⌥' : 'Alt'
      default:
        return part.length === 1 ? part.toUpperCase() : part
    }
  })
  return parts.join(mac ? '' : '+')
}
