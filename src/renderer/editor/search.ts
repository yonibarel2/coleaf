import { Extension, type Editor } from '@tiptap/core'
import {
  findNext,
  findPrev,
  getSearchState,
  replaceAll,
  replaceNext,
  search,
  SearchQuery,
  setSearchState
} from 'prosemirror-search'

export interface SearchOptions {
  /** Ctrl+F: the app opens its Find / Replace panel. */
  onFind: () => void
}

/** Find / Replace: prosemirror-search keeps the query and highlights the matches. */
export const CoLeafSearch = Extension.create<SearchOptions>({
  name: 'coleafSearch',
  addOptions: () => ({ onFind: () => {} }),
  addKeyboardShortcuts() {
    return {
      'Mod-f': () => {
        this.options.onFind()
        return true
      }
    }
  },
  addProseMirrorPlugins: () => [search()]
})

/** Sets what to find and what to replace it with; an empty search clears the highlights. */
export function setSearch(editor: Editor, text: string, replace: string): void {
  const query = new SearchQuery({ search: text, replace, caseSensitive: false })
  editor.view.dispatch(setSearchState(editor.state.tr, query))
}

/** How many matches the current query has in the document. */
export function countMatches(editor: Editor): number {
  const query = getSearchState(editor.state)?.query
  if (!query?.valid) return 0
  let count = 0
  let from = 0
  const end = editor.state.doc.content.size
  for (;;) {
    const result = query.findNext(editor.state, from, end)
    if (!result) return count
    count++
    from = Math.max(result.to, result.from + 1)
    if (from > end) return count
  }
}

export const searchCommands = {
  next: (editor: Editor): boolean => findNext(editor.state, editor.view.dispatch),
  previous: (editor: Editor): boolean => findPrev(editor.state, editor.view.dispatch),
  replace: (editor: Editor): boolean => replaceNext(editor.state, editor.view.dispatch),
  replaceAll: (editor: Editor): boolean => replaceAll(editor.state, editor.view.dispatch)
}
