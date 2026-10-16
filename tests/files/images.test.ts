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
  safeImageName,
  storeImage
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
    expect(imageFolderOf('docs/plan.md')).toBe('images/docs/plan')
    expect(imageFolderOf('README.markdown')).toBe('images/README')
    expect(safeImageName('My Shot (1).PNG')).toBe('My-Shot-1.PNG')
    expect(safeImageName('C:\\Users\\x\\..\\evil.png')).toBe('evil.png')
    expect(safeImageName('image.png')).toBe('picture.png')
    expect(safeImageName('notes.txt')).toBeNull()
    expect(safeImageName('.png')).toBeNull()
  })

  it('stores pictures beside the document, never replacing one', async () => {
    await writeFile(join(root, 'docs', 'plan.md'), '# Plan\n')
    expect(await storeImage(root, 'docs/plan.md', 'image.png', png)).toBe(
      'images/docs/plan/picture-1.png'
    )
    expect(await storeImage(root, 'docs/plan.md', 'image.png', png)).toBe(
      'images/docs/plan/picture-2.png'
    )
    expect(await storeImage(root, 'docs/plan.md', 'diagram.png', png)).toBe(
      'images/docs/plan/diagram.png'
    )
    expect(await storeImage(root, 'docs/plan.md', 'diagram.png', png)).toBe(
      'images/docs/plan/diagram-2.png'
    )
    expect([...(await readFile(join(root, 'images', 'docs', 'plan', 'diagram.png')))]).toEqual([
      ...png
    ])
    await expect(storeImage(root, 'docs/plan.md', 'notes.txt', png)).rejects.toThrow(/Not an image/)
    await expect(storeImage(root, '../other.md', 'a.png', png)).rejects.toThrow(/outside/)
  })

  it('copies a picked file beside the document', async () => {
    const source = join(root, 'docs', 'images', 'my pic.PNG')
    expect(await importImage(root, 'docs/plan.md', source)).toBe('images/docs/plan/my-pic.PNG')
  })
})
