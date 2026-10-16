import { common, createLowlight } from 'lowlight'

// Code colors come from highlight.js grammars through lowlight: the common languages, under
// their names and the aliases people write after a fence (`js`, `ts`, `sh`, `html`).
const lowlight = createLowlight(common)

/**
 * The highlighter the code block uses. A fence with no language, or one highlight.js does not
 * know (`mermaid`, `math`, `elixir`), stays plain: GitHub guesses nothing either.
 */
export const highlighter = {
  highlight: (language: string, code: string) => lowlight.highlight(language, code),
  highlightAuto: () => ({ type: 'root', children: [] }),
  listLanguages: () => lowlight.listLanguages(),
  registered: (language: string) => lowlight.registered(language)
}

/** What a code block shows instead of its code while the cursor is elsewhere. */
export type PreviewKind = 'mermaid'

export function previewKindOf(language: string | null): PreviewKind | null {
  return language === 'mermaid' ? 'mermaid' : null
}
