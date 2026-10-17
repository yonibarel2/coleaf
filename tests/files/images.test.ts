import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  imageFolderOf,
  imagePathOf,
  imageTypeOf,
  importImage,
  readImage,
  removeImages,
  safeImageName,
  storeImage,
  unusedImages
} from '../../src/main/files/images'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

describe('images', () => {
  let root: string

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'coleaf-img-'))
    await mkdir(join(root, 'docs', 'images'), { recursive: true })
    await mkdir(join(root, '.git'))
    await writeFile(join(root, 'docs', 'images', 'my pic.PNG'), png)
    await writeFile(join(root, '.git', 'x.png'), png)
    await writeFile(join(root, 'notes.md'), '# Notes\n')
  })

  afterAll(() => rm(root, { recursive: true, force: true }))

  it('knows image types by extension, whatever the case', () => {
    expect(imageTypeOf('a/b.PNG')).toBe('image/png')
    expect(imageTypeOf('b.jpeg')).toBe('image/jpeg')
    expect(imageTypeOf('c.svg')).toBe('image/svg+xml')
    expect(imageTypeOf('notes.md')).toBeUndefined()
    expect(imageTypeOf('no-extension')).toBeUndefined()
  })

  it('reads the tree path out of an image URL', () => {
    expect(imagePathOf('coleaf-image://project/docs/images/my%20pic.PNG')).toBe(
      'docs/images/my pic.PNG'
    )
  })

  it('serves a picture from inside the project only', async () => {
    const image = await readImage(root, 'docs/images/my pic.PNG')
    expect(image.type).toBe('image/png')
    expect([...image.bytes]).toEqual([...png])
    await expect(readImage(root, 'notes.md')).rejects.toThrow(/Not an image/)
    await expect(readImage(root, '../outside.png')).rejects.toThrow(/outside the project/)
    await expect(readImage(root, '.git/x.png')).rejects.toThrow(/inside \.git/)
    await expect(readImage(root, 'docs/images/missing.png')).rejects.toThrow()
  })

  it('names pictures safely', () => {
    expect(imageFolderOf('docs/plan.md')).toBe('md-images/docs/plan')
    expect(imageFolderOf('README.markdown')).toBe('md-images/README')
    expect(safeImageName('My Shot (1).PNG')).toBe('My-Shot-1.PNG')
    expect(safeImageName('C:\\Users\\x\\..\\evil.png')).toBe('evil.png')
    expect(safeImageName('image.png')).toBe('picture.png')
    expect(safeImageName('notes.txt')).toBeNull()
    expect(safeImageName('.png')).toBeNull()
  })

  it('stores pictures beside the document, never replacing one', async () => {
    await writeFile(join(root, 'docs', 'plan.md'), '# Plan\n')
    expect(await storeImage(root, 'docs/plan.md', 'image.png', png)).toBe(
      'md-images/docs/plan/picture-1.png'
    )
    expect(await storeImage(root, 'docs/plan.md', 'image.png', png)).toBe(
      'md-images/docs/plan/picture-2.png'
    )
    expect(await storeImage(root, 'docs/plan.md', 'diagram.png', png)).toBe(
      'md-images/docs/plan/diagram.png'
    )
    expect(await storeImage(root, 'docs/plan.md', 'diagram.png', png)).toBe(
      'md-images/docs/plan/diagram-2.png'
    )
    expect([...(await readFile(join(root, 'md-images', 'docs', 'plan', 'diagram.png')))]).toEqual([
      ...png
    ])
    await expect(storeImage(root, 'docs/plan.md', 'notes.txt', png)).rejects.toThrow(/Not an image/)
    await expect(storeImage(root, '../other.md', 'a.png', png)).rejects.toThrow(/outside/)
  })

  it('copies a picked file beside the document', async () => {
    const source = join(root, 'docs', 'images', 'my pic.PNG')
    expect(await importImage(root, 'docs/plan.md', source)).toBe('md-images/docs/plan/my-pic.PNG')
  })
})

describe('unused pictures', () => {
  let root: string

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'coleaf-unused-'))
    const put = async (path: string, text: string | Uint8Array): Promise<void> => {
      await mkdir(join(root, ...path.split('/').slice(0, -1)), { recursive: true })
      await writeFile(join(root, ...path.split('/')), text)
    }
    await put('md-images/docs/plan/shown.png', png)
    await put('md-images/docs/plan/Linked.PNG', png)
    await put('md-images/docs/plan/in html.png', png)
    await put('md-images/docs/plan/by reference.png', png)
    await put('md-images/docs/plan/from root.png', png)
    await put('md-images/docs/plan/from elsewhere.png', png)
    await put('md-images/docs/plan/unused.png', png)
    await put('md-images/notes/unused too.png', png)
    await put('md-images/notes/notes.txt', 'not a picture')
    await put('docs/elsewhere.png', png) // outside md-images: never touched
    await put(
      'docs/plan.md',
      [
        '![a](../md-images/docs/plan/shown.png)',
        '[b](../md-images/docs/plan/linked.png)',
        '<img src="../md-images/docs/plan/in%20html.png">',
        '![c][ref]',
        '',
        '[ref]: <../md-images/docs/plan/by reference.png>',
        '![d](/md-images/docs/plan/from%20root.png)',
        '![e](https://example.com/md-images/docs/plan/unused.png)',
        ''
      ].join('\n')
    )
    // A target with a space needs <…> or %20 to be a link at all, on GitHub as here.
    await put('README.md', '![f](<md-images/docs/plan/from elsewhere.png>)\n')
    await put('node_modules/pkg/readme.md', '![g](../../md-images/docs/plan/unused.png)\n')
  })

  afterAll(() => rm(root, { recursive: true, force: true }))

  it('finds the pictures no Markdown file points at, whatever the link style or case', async () => {
    expect(await unusedImages(root)).toEqual([
      'md-images/docs/plan/unused.png',
      'md-images/notes/unused too.png'
    ])
  })

  it('removes them with their empty folders, and nothing outside md-images', async () => {
    await expect(removeImages(root, ['docs/elsewhere.png'])).rejects.toThrow(/Not a picture of/)
    await expect(removeImages(root, ['md-images/notes/notes.txt'])).rejects.toThrow(/Not a picture/)
    await removeImages(root, ['md-images/notes/unused too.png', 'md-images/docs/plan/unused.png'])
    expect(await unusedImages(root)).toEqual([])
    await expect(
      readFile(join(root, 'md-images', 'docs', 'plan', 'shown.png'))
    ).resolves.toBeDefined()
    await expect(readFile(join(root, 'md-images', 'notes', 'notes.txt'), 'utf8')).resolves.toBe(
      'not a picture'
    )
    await expect(readFile(join(root, 'docs', 'elsewhere.png'))).resolves.toBeDefined()
  })

  it('removes the folders a deleted picture leaves empty', async () => {
    const dir = join(root, 'md-images', 'empty', 'deep')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'last.png'), png)
    await removeImages(root, ['md-images/empty/deep/last.png'])
    await expect(readFile(join(root, 'md-images', 'empty', 'deep', 'last.png'))).rejects.toThrow()
    await expect(mkdir(join(root, 'md-images', 'empty'))).resolves.toBeUndefined() // was gone
  })
})
