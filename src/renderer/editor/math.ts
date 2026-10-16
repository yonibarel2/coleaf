// Math (LaTeX) drawn with KaTeX, as GitHub does: `$E = mc^2$` inline, `$$` or a `math` fence
// as a block. KaTeX loads the first time a formula is shown; its stylesheet comes with the
// editor's (Editor.tsx).

type Katex = typeof import('katex').default

let loading: Promise<Katex> | null = null

function load(): Promise<Katex> {
  loading ??= import('katex').then(({ default: katex }) => katex)
  return loading
}

/** The TeX of an inline formula: GitHub's `` $`E = mc^2`$ `` form carries backticks to drop. */
export function mathSource(code: string): string {
  const match = /^`(.*)`$/s.exec(code)
  return match ? match[1] : code
}

/** The HTML of a formula; bad TeX is shown as it is, in the caution color, with the problem as its title. */
export async function renderMath(code: string, display: boolean): Promise<string> {
  const katex = await load()
  return katex.renderToString(mathSource(code), {
    displayMode: display,
    output: 'html',
    throwOnError: false,
    errorColor: cautionColor(),
    strict: 'ignore'
  })
}

// The token's value, read from the page (tests run without one).
function cautionColor(): string | undefined {
  if (typeof document === 'undefined') return undefined
  return getComputedStyle(document.documentElement).getPropertyValue('--color-caution').trim()
}
