import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState, type CSSProperties, type JSX } from 'react'
import type { TreeEntry } from '../../preload/contract'
import { useProjectTree, type ProjectTree } from './useProjectTree'

interface ProjectSectionProps {
  activePath: string | null
  onOpenFile: (path: string) => void
}

/**
 * The Project section: a collapsible header with the "Only .md" tick, and the folder tree.
 * Mounted once per project (keyed on the root by the Explorer), so its state starts fresh.
 */
export function ProjectSection({ activePath, onOpenFile }: ProjectSectionProps): JSX.Element {
  const [open, setOpen] = useState(true)
  const [onlyMarkdown, setOnlyMarkdown] = useState(false)
  const tree = useProjectTree()
  const rows: RowsContext = { tree, onlyMarkdown, activePath, onOpenFile }

  return (
    <section className="section">
      <div
        className="section__header"
        role="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Chevron open={open} />
        <span className="section__title">Project</span>
        <label className="section__option" onClick={(event) => event.stopPropagation()}>
          <input
            type="checkbox"
            checked={onlyMarkdown}
            onChange={(event) => setOnlyMarkdown(event.target.checked)}
          />
          Only .md
        </label>
      </div>
      {open && (
        <ul className="tree">
          <TreeRows path="" depth={0} context={rows} />
        </ul>
      )}
    </section>
  )
}

interface RowsContext {
  tree: ProjectTree
  onlyMarkdown: boolean
  activePath: string | null
  onOpenFile: (path: string) => void
}

interface TreeRowsProps {
  path: string
  depth: number
  context: RowsContext
}

function TreeRows({ path, depth, context }: TreeRowsProps): JSX.Element {
  const entries = context.tree.entries[path] ?? []
  const shown = context.onlyMarkdown ? entries.filter(showsMarkdown) : entries
  return (
    <>
      {shown.map((entry) => (
        <TreeRow key={entry.path} entry={entry} depth={depth} context={context} />
      ))}
    </>
  )
}

interface TreeRowProps {
  entry: TreeEntry
  depth: number
  context: RowsContext
}

function TreeRow({ entry, depth, context }: TreeRowProps): JSX.Element {
  const { tree, activePath, onOpenFile } = context
  const isDir = entry.kind === 'dir'
  const expanded = isDir && tree.expanded.has(entry.path)
  // Greyed: a file that isn't Markdown, or a folder known to hold none (still expandable).
  const muted = isDir ? entry.hasMarkdown === false : !entry.isMarkdown
  const classes = ['tree__row']
  if (muted) classes.push('tree__row--muted')
  if (!isDir && muted) classes.push('tree__row--static')
  if (entry.path === activePath) classes.push('tree__row--active')
  const onClick = isDir
    ? () => tree.toggle(entry.path)
    : entry.isMarkdown
      ? () => onOpenFile(entry.path)
      : undefined
  return (
    <>
      <li
        className={classes.join(' ')}
        style={{ '--depth': depth } as CSSProperties}
        data-tip={entry.path}
        onClick={onClick}
      >
        <span className="tree__chevron">{isDir && <Chevron open={expanded} />}</span>
        <span className="tree__name">{entry.name}</span>
      </li>
      {expanded && <TreeRows path={entry.path} depth={depth + 1} context={context} />}
    </>
  )
}

function Chevron({ open }: { open: boolean }): JSX.Element {
  return open ? <ChevronDown /> : <ChevronRight />
}

// "Only .md": keep Markdown files and folders that hold (or may still hold) Markdown.
function showsMarkdown(entry: TreeEntry): boolean {
  return entry.kind === 'dir' ? entry.hasMarkdown !== false : entry.isMarkdown
}
