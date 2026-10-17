import { beforeAll, describe, expect, it } from 'vitest'
import {
  joinParts,
  readConflict,
  resolveConflict,
  splitConflicts
} from '../../src/main/git/conflicts'
import { git } from '../../src/main/git/run'
import type { ConflictPart } from '../../src/preload/contract'
import { initRepo, isolateGitConfig, read, tempDir, write } from './temp-repo'

beforeAll(isolateGitConfig)

const conflicted = [
  '# Title',
  '',
  '<<<<<<< HEAD',
  'My line.',
  '=======',
  'Their line.',
  '>>>>>>> origin/main',
  '',
  'Shared end.',
  ''
].join('\n')

describe('splitConflicts', () => {
  it('splits shared text and conflicts, each line with its newline', () => {
    expect(splitConflicts(conflicted)).toEqual([
      { kind: 'same', text: '# Title\n\n' },
      { kind: 'conflict', mine: 'My line.\n', theirs: 'Their line.\n' },
      { kind: 'same', text: '\nShared end.\n' }
    ])
  })

  it('keeps a file without markers as one part, and an empty one as none', () => {
    expect(splitConflicts('a\nb\n')).toEqual([{ kind: 'same', text: 'a\nb\n' }])
    expect(splitConflicts('')).toEqual([])
  })

  it('handles several conflicts, markers at the edges and no final newline', () => {
    const text =
      '<<<<<<< HEAD\na\n=======\nb\n>>>>>>> theirs\nmid\n<<<<<<< HEAD\nc\n=======\n\n>>>>>>> theirs'
    expect(splitConflicts(text)).toEqual([
      { kind: 'conflict', mine: 'a\n', theirs: 'b\n' },
      { kind: 'same', text: 'mid\n' },
      { kind: 'conflict', mine: 'c\n', theirs: '\n' }
    ])
  })

  it('drops a diff3 base section and keeps unclosed markers as a conflict', () => {
    const diff3 = 'x\n<<<<<<< HEAD\nmine\n||||||| base\nold\n=======\ntheirs\n>>>>>>> other\n'
    expect(splitConflicts(diff3)).toEqual([
      { kind: 'same', text: 'x\n' },
      { kind: 'conflict', mine: 'mine\n', theirs: 'theirs\n' }
    ])
    expect(splitConflicts('<<<<<<< HEAD\nmine\n=======\ntheirs\n')).toEqual([
      { kind: 'conflict', mine: 'mine\n', theirs: 'theirs\n' }
    ])
  })

  it('treats a lone ======= outside a conflict as text (a setext underline)', () => {
    expect(splitConflicts('Title\n=======\n')).toEqual([{ kind: 'same', text: 'Title\n=======\n' }])
  })
})

describe('joinParts', () => {
  const parts: ConflictPart[] = [
    { kind: 'same', text: 'a\n' },
    { kind: 'conflict', mine: 'm1\n', theirs: 't1\n' },
    { kind: 'same', text: 'b\n' },
    { kind: 'conflict', mine: 'm2\n', theirs: 't2\n' }
  ]

  it('keeps mine, theirs or both per conflict, in order', () => {
    expect(joinParts(parts, ['mine', 'theirs'])).toBe('a\nm1\nb\nt2\n')
    expect(joinParts(parts, ['both', 'mine'])).toBe('a\nm1\nt1\nb\nm2\n')
  })

  it('needs exactly one choice per conflict', () => {
    expect(() => joinParts(parts, ['mine'])).toThrow(/Expected 2 choices/)
  })

  it('gives the text back when every part is kept as both sides wrote it', () => {
    const split = splitConflicts(conflicted)
    expect(joinParts(split, ['mine'])).toBe(
      conflicted.replace(/<<<<<<< HEAD\n|=======\nTheir line.\n>>>>>>> origin\/main\n/g, '')
    )
  })
})

describe('readConflict and resolveConflict', () => {
  it('reads the parts of a file and writes the choices back in its format, staged', async () => {
    const root = await tempDir('proj')
    await initRepo(root)
    await write(root, 'docs/plan.md', '﻿' + conflicted.replaceAll('\n', '\r\n'))
    expect(await readConflict(root, 'docs/plan.md')).toEqual([
      { kind: 'same', text: '# Title\n\n' },
      { kind: 'conflict', mine: 'My line.\n', theirs: 'Their line.\n' },
      { kind: 'same', text: '\nShared end.\n' }
    ])

    await resolveConflict(root, 'docs/plan.md', ['both'])
    const bytes = await read(root, 'docs/plan.md')
    expect(bytes).toBe('﻿# Title\n\nMy line.\nTheir line.\n\nShared end.\n')
    const staged = await git(root, ['ls-files', '--stage', '--', 'docs/plan.md'])
    expect(staged).toMatch(/docs\/plan\.md/)
  })

  it('refuses a path outside the project', async () => {
    const root = await tempDir('proj')
    await initRepo(root)
    await expect(readConflict(root, '../x.md')).rejects.toThrow(/outside/)
  })
})
