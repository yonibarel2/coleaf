import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { imagePathOf, imageTypeOf, readImage } from '../../src/main/files/images'

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
})
