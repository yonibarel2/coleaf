import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { relativePath } from './paths'

export interface PicturesOptions {
  /** Tree path of the document, whose `md-images/` folder receives the pictures. */
  documentPath: string
  /** Stores a picture's bytes under `md-images/` and returns its tree path (the background does it). */
  savePicture: (name: string, bytes: Uint8Array) => Promise<string>
}

/**
 * Pasted or dropped pictures are stored under `md-images/` by the background (one folder per
 * document, see main/files/images.ts) and inserted where they landed, linked relative to the
 * document. Pictures picked with Insert › Picture arrive through insertPictures.
 */
export const CoLeafPictures = Extension.create<PicturesOptions>({
  name: 'coleafPictures',
  addOptions: () => ({
    documentPath: '',
    savePicture: () => Promise.reject(new Error('no store'))
  }),
  addProseMirrorPlugins() {
    const { options } = this
    return [
      new Plugin({
        key: new PluginKey('coleafPictures'),
        props: {
          handlePaste: (view, event) => {
            const files = pictureFiles(event.clipboardData)
            if (files.length === 0) return false
            void storeAndInsert(view, options, files, null)
            return true
          },
          handleDrop: (view, event, _slice, moved) => {
            if (moved) return false
            const files = pictureFiles(event.dataTransfer)
            if (files.length === 0) return false
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? null
            void storeAndInsert(view, options, files, pos)
            return true
          }
        }
      })
    ]
  }
})

function pictureFiles(data: DataTransfer | null): File[] {
  return [...(data?.files ?? [])].filter((file) => file.type.startsWith('image/'))
}

async function storeAndInsert(
  view: EditorView,
  { documentPath, savePicture }: PicturesOptions,
  files: File[],
  pos: number | null
): Promise<void> {
  const paths: string[] = []
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    paths.push(await savePicture(file.name || 'image.png', bytes))
  }
  insertPictures(view, documentPath, paths, pos)
}

/**
 * Puts pictures (tree paths under `md-images/`) into the document at a position, or over the
 * selection, each linked relative to the document. Nothing happens inside a code block.
 */
export function insertPictures(
  view: EditorView,
  documentPath: string,
  treePaths: string[],
  pos: number | null
): void {
  if (treePaths.length === 0) return
  const { schema, selection } = view.state
  const tr = view.state.tr
  if (pos === null) tr.deleteSelection()
  const at = tr.mapping.map(pos ?? selection.from)
  const parent = tr.doc.resolve(at).parent
  if (!parent.inlineContent || parent.type.spec.code) return
  const nodes = treePaths.map((path) =>
    schema.nodes.image.create({ src: relativePath(documentPath, path), alt: stemOf(path) })
  )
  view.dispatch(tr.insert(at, nodes).scrollIntoView())
  view.focus()
}

function stemOf(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1)
  return name.replace(/\.[^.]+$/, '')
}
