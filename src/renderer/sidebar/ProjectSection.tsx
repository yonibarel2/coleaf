import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState, type CSSProperties, type JSX } from 'react'
import type { TreeEntry } from '../../preload/contract'
import { useProjectTree, type ProjectTree } from './useProjectTree'

/**
 * The Project section: a collapsible header with the "Only .md" tick, and the folder tree.
 * Mounted once per project (keyed on the root by the Explorer), so its state starts fresh.
 */
export function ProjectSection(): JSX.Element {
  const [open, setOpen] = useState(true)
  const [onlyMarkdown, setOnlyMarkdown] = useState(false)
  const tree = useProjectTree()

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
          <TreeRows path="" depth={0} tree={tree} onlyMarkdown={onlyMarkdown} />
        </ul>
      )}
    </section>
  )
}

interface TreeRowsProps {
  path: string
  depth: number
  tree: ProjectTree
  onlyMarkdown: boolean
}

function TreeRows({ path, depth, tree, onlyMarkdown }: TreeRowsProps): JSX.Element {
  const entries = tree.entries[path] ?? []
  const shown = onlyMarkdown ? entries.filter(showsMarkdown) : entries
  return (
    <>
      {shown.map((entry) => (
        <TreeRow
          key={entry.path}
          entry={entry}
          depth={depth}
          tree={tree}
          onlyMarkdown={onlyMarkdown}
        />
      ))}
    </>
  )
}

interface TreeRowProps {
  entry: TreeEntry
  depth: number
  tree: ProjectTree
  onlyMarkdown: boolean
}

function TreeRow({ entry, depth, tree, onlyMarkdown }: TreeRowProps): JSX.Element {
  const isDir = entry.kind === 'dir'
  const expanded = isDir && tree.expanded.has(entry.path)
  // Greyed: a file that isn't Markdown, or a folder known to hold none (still expandable).
  const muted = isDir ? entry.hasMarkdown === false : !entry.isMarkdown
  const classes = ['tree__row']
  if (muted) classes.push('tree__row--muted')
  if (!isDir && muted) classes.push('tree__row--static')
  return (
    <>
      <li
        className={classes.join(' ')}
        style={{ '--depth': depth } as CSSProperties}
        title={entry.path}
        onClick={isDir ? () => tree.toggle(entry.path) : undefined}
      >
        <span className="tree__chevron">{isDir && <Chevron open={expanded} />}</span>
        <span className="tree__name">{entry.name}</span>
      </li>
      {expanded && (
        <TreeRows path={entry.path} depth={depth + 1} tree={tree} onlyMarkdown={onlyMarkdown} />
      )}
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
