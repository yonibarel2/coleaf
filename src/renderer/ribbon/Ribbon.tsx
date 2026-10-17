import type { ChainedCommands, Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import {
  Bold,
  ChevronDown,
  ChevronUp,
  Code,
  Image,
  Indent,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Outdent,
  Redo2,
  Replace,
  Search,
  SquareCode,
  Table,
  TextQuote
} from 'lucide-react'
import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react'
import { keysLabel, shortcutKeys } from '../editor/shortcuts'
import './ribbon.css'

interface RibbonProps {
  editor: Editor
  collapsed: boolean
  onToggleCollapsed: () => void
  /** Insert › Link: the app opens its link panel. */
  onLink: () => void
  /** Edit › Find / Replace; the buttons are off until the app provides it. */
  onFind?: (replace: boolean) => void
  /** Insert › Picture; the button is off until the app provides it. */
  onPicture?: () => void
}

type Command = (chain: ChainedCommands) => ChainedCommands

const headingLevels = [1, 2, 3, 4, 5, 6] as const

/**
 * The formatting toolbar above the document: the five groups of docs/ui/ribbon.png (Edit,
 * Styles, Text, Paragraph, Insert) plus a Table button, on a slightly darker bar, collapsible.
 */
export function Ribbon(props: RibbonProps): JSX.Element {
  const { editor, collapsed, onToggleCollapsed, onLink, onFind, onPicture } = props
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      editable: editor.isEditable,
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
      heading: Number(editor.getAttributes('heading')['level'] ?? 0),
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      code: editor.isActive('code'),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      blockquote: editor.isActive('blockquote'),
      codeBlock: editor.isActive('codeBlock'),
      inTable: editor.isActive('table'),
      canIndent: editor.can().sinkListItem('listItem'),
      canOutdent: editor.can().liftListItem('listItem')
    })
  })
  const run = (command: Command) => (): void => {
    command(editor.chain().focus()).run()
  }
  const off = !state.editable

  if (collapsed) {
    return (
      <div className="ribbon ribbon--collapsed" role="toolbar" aria-label="Formatting">
        <Button label="Show the ribbon" icon={<ChevronDown />} onClick={onToggleCollapsed} />
      </div>
    )
  }

  return (
    <div className="ribbon" role="toolbar" aria-label="Formatting">
      <Group
        label="Edit"
        rows={[
          <>
            <Button
              label="Undo"
              shortcut="undo"
              icon={<Redo2 className="ribbon__mirror" />}
              disabled={off || !state.canUndo}
              onClick={run((chain) => chain.undo())}
            />
            <Button
              label="Redo"
              shortcut="redo"
              icon={<Redo2 />}
              disabled={off || !state.canRedo}
              onClick={run((chain) => chain.redo())}
            />
          </>,
          <>
            <Button
              label="Find"
              shortcut="find"
              icon={<Search />}
              text="Find"
              disabled={off || !onFind}
              onClick={() => onFind?.(false)}
            />
            <Button
              label="Replace"
              icon={<Replace />}
              text="Replace"
              disabled={off || !onFind}
              onClick={() => onFind?.(true)}
            />
          </>
        ]}
      />
      <Group
        label="Styles"
        rows={[
          <>
            <Button
              label="Normal text"
              shortcut="normal"
              text="Normal"
              className="ribbon__style"
              active={state.heading === 0 && !state.codeBlock}
              disabled={off}
              onClick={run((chain) => chain.setParagraph())}
            />
            <Button
              label="Heading 1"
              shortcut="heading1"
              text="Heading 1"
              className="ribbon__style ribbon__style--h1"
              active={state.heading === 1}
              disabled={off}
              onClick={run((chain) => chain.setHeading({ level: 1 }))}
            />
          </>,
          <>
            <Button
              label="Heading 2"
              shortcut="heading2"
              text="Heading 2"
              className="ribbon__style ribbon__style--h2"
              active={state.heading === 2}
              disabled={off}
              onClick={run((chain) => chain.setHeading({ level: 2 }))}
            />
            <Button
              label="Heading 3"
              shortcut="heading3"
              text="Heading 3"
              className="ribbon__style ribbon__style--h3"
              active={state.heading === 3}
              disabled={off}
              onClick={run((chain) => chain.setHeading({ level: 3 }))}
            />
          </>
        ]}
        after={<StylesMenu editor={editor} heading={state.heading} disabled={off} />}
      />
      <Group
        label="Text"
        rows={[
          <>
            <Button
              label="Bold"
              shortcut="bold"
              icon={<Bold />}
              active={state.bold}
              disabled={off}
              onClick={run((chain) => chain.toggleBold())}
            />
            <Button
              label="Italic"
              shortcut="italic"
              icon={<Italic />}
              active={state.italic}
              disabled={off}
              onClick={run((chain) => chain.toggleItalic())}
            />
          </>,
          <Button
            key="code"
            label="Code"
            icon={<Code />}
            active={state.code}
            disabled={off}
            onClick={run((chain) => chain.toggleCode())}
          />
        ]}
      />
      <Group
        label="Paragraph"
        rows={[
          <>
            <Button
              label="Bullets"
              shortcut="bulletList"
              icon={<List />}
              active={state.bulletList}
              disabled={off || state.inTable}
              onClick={run((chain) => chain.toggleBulletList())}
            />
            <Button
              label="Numbering"
              icon={<ListOrdered />}
              active={state.orderedList}
              disabled={off || state.inTable}
              onClick={run((chain) => chain.toggleOrderedList())}
            />
            <Button
              label="Quote"
              icon={<TextQuote />}
              active={state.blockquote}
              disabled={off || state.inTable}
              onClick={run((chain) => chain.toggleBlockquote())}
            />
          </>,
          <>
            <Button
              label="Decrease indent"
              shortcut="outdent"
              icon={<Outdent />}
              disabled={off || !state.canOutdent}
              onClick={run((chain) => chain.liftListItem('listItem'))}
            />
            <Button
              label="Increase indent"
              shortcut="indent"
              icon={<Indent />}
              disabled={off || !state.canIndent}
              onClick={run((chain) => chain.sinkListItem('listItem'))}
            />
            <Button
              label="Horizontal line"
              icon={<Minus />}
              disabled={off || state.inTable}
              onClick={run((chain) => chain.setHorizontalRule())}
            />
          </>
        ]}
      />
      <Group
        label="Insert"
        rows={[
          <>
            <Button label="Link" shortcut="link" icon={<Link />} disabled={off} onClick={onLink} />
            <Button
              label="Picture"
              icon={<Image />}
              disabled={off || !onPicture}
              onClick={() => onPicture?.()}
            />
            <Button
              label="Table"
              icon={<Table />}
              disabled={off || state.inTable}
              onClick={run((chain) => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))}
            />
          </>,
          <Button
            key="codeBlock"
            label="Code block"
            icon={<SquareCode />}
            active={state.codeBlock}
            disabled={off || state.inTable}
            onClick={run((chain) => chain.toggleCodeBlock())}
          />
        ]}
      />
      <div className="ribbon__spacer" />
      <Button label="Hide the ribbon" icon={<ChevronUp />} onClick={onToggleCollapsed} />
    </div>
  )
}

interface GroupProps {
  label: string
  rows: ReactNode[]
  /** Something standing beside the rows, as tall as both: the Styles menu button. */
  after?: ReactNode
}

function Group({ label, rows, after }: GroupProps): JSX.Element {
  return (
    <div className="ribbon__group">
      <div className="ribbon__body">
        <div className="ribbon__rows">
          {rows.map((row, index) => (
            <div key={index} className="ribbon__row">
              {row}
            </div>
          ))}
        </div>
        {after}
      </div>
      <div className="ribbon__label">{label}</div>
    </div>
  )
}

interface ButtonProps {
  label: string
  /** A shortcut id from shortcuts.ts, shown in the tooltip. */
  shortcut?: string
  icon?: ReactNode
  text?: string
  className?: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

function Button(props: ButtonProps): JSX.Element {
  const { label, shortcut, icon, text, className, active, disabled, onClick } = props
  const keys = shortcut ? shortcutKeys(shortcut) : undefined
  const classes = ['ribbon__button']
  if (active) classes.push('ribbon__button--active')
  if (className) classes.push(className)
  return (
    <button
      type="button"
      className={classes.join(' ')}
      data-tip={keys ? `${label} (${keysLabel(keys)})` : label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()} // the document keeps its selection
      onClick={onClick}
    >
      {icon}
      {text && <span>{text}</span>}
    </button>
  )
}

interface StylesMenuProps {
  editor: Editor
  heading: number
  disabled: boolean
}

// The ▾ beside the Styles buttons: Normal and every heading level, with their keys.
function StylesMenu({ editor, heading, disabled }: StylesMenuProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent): void => {
      if (!anchor.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const choose = (level: number): void => {
    setOpen(false)
    const chain = editor.chain().focus()
    if (level === 0) chain.setParagraph().run()
    else chain.setHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run()
  }
  const item = (level: number, label: string, shortcut: string): JSX.Element => {
    const keys = shortcutKeys(shortcut)
    return (
      <button
        key={level}
        type="button"
        role="menuitem"
        className={`ribbon__menu-item ribbon__menu-item--h${level}${heading === level ? ' ribbon__menu-item--active' : ''}`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => choose(level)}
      >
        <span>{label}</span>
        {keys && <kbd>{keysLabel(keys)}</kbd>}
      </button>
    )
  }

  return (
    <div ref={anchor} className="ribbon__menu-anchor">
      <button
        type="button"
        className="ribbon__button ribbon__button--tall"
        data-tip="All styles"
        aria-label="All styles"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown />
      </button>
      {open && (
        <div role="menu" className="ribbon__menu">
          {item(0, 'Normal', 'normal')}
          {headingLevels.map((level) => item(level, `Heading ${level}`, `heading${level}`))}
        </div>
      )}
    </div>
  )
}
