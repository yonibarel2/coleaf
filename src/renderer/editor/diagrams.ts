// Mermaid diagrams, drawn from a code block's text. The library loads the first time a diagram
// is shown (it is big) and runs in its strict mode: labels are sanitized, and no script or
// link in a diagram ever runs (the window's content security policy forbids it anyway).

type Mermaid = typeof import('mermaid').default

let loading: Promise<Mermaid> | null = null
let counter = 0

function load(): Promise<Mermaid> {
  loading ??= import('mermaid').then(({ default: mermaid }) => {
    const styles = getComputedStyle(document.documentElement)
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'neutral',
      fontFamily: styles.getPropertyValue('--font-doc').trim(),
      suppressErrorRendering: true
    })
    return mermaid
  })
  return loading
}

export type Diagram = { svg: string } | { error: string }

// Diagrams already drawn, by their code: toggling between code and picture draws nothing twice.
const drawn = new Map<string, Diagram>()
const keep = 100

/** The SVG of a diagram, or the message Mermaid gives for code it cannot draw. */
export async function renderDiagram(code: string): Promise<Diagram> {
  const cached = drawn.get(code)
  if (cached) return cached
  const mermaid = await load()
  let result: Diagram
  try {
    const { svg } = await mermaid.render(`coleaf-diagram-${++counter}`, code)
    result = { svg }
  } catch (error) {
    result = { error: error instanceof Error ? error.message : String(error) }
  }
  if (drawn.size >= keep) drawn.delete(drawn.keys().next().value as string)
  drawn.set(code, result)
  return result
}
