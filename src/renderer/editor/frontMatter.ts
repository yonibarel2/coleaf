// YAML front matter (between `---` lines at the top of the file) shown as a table of its keys
// and values, as GitHub shows it. The yaml library loads the first time one is shown.

export type FrontMatterRow = [key: string, value: string]
export type FrontMatterTable = { rows: FrontMatterRow[] } | { error: string }

type Yaml = typeof import('yaml')

let loading: Promise<Yaml> | null = null

function load(): Promise<Yaml> {
  loading ??= import('yaml')
  return loading
}

/** The YAML between the `---` lines of a front matter block. */
export function frontMatterBody(source: string): string {
  return source.replace(/^---[ \t]*\n?/, '').replace(/\n?---[ \t]*$/, '')
}

/** The keys and values of a front matter block, each value on one line where it fits. */
export async function frontMatterTable(source: string): Promise<FrontMatterTable> {
  const yaml = await load()
  let data: unknown
  try {
    data = yaml.parse(frontMatterBody(source))
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
  if (data === null || data === undefined) return { rows: [] }
  if (typeof data !== 'object' || Array.isArray(data)) {
    return { error: 'Front matter should be a list of keys and values.' }
  }
  const rows = Object.entries(data).map(([key, value]): FrontMatterRow => [
    key,
    cellText(value, yaml)
  ])
  return { rows }
}

function cellText(value: unknown, yaml: Yaml): string {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'object') return String(value)
  if (Array.isArray(value) && value.every((item) => typeof item !== 'object' || item === null)) {
    return value.map((item) => String(item ?? '')).join(', ')
  }
  return yaml.stringify(value).trim()
}
