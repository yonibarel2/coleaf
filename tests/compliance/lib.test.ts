import { describe, expect, it } from 'vitest'
import {
  classify,
  exceptionFor,
  packageNamesFromImports,
  renderReport,
  satisfies,
  scanCodeFindings
} from '../../compliance/lib.mts'

const allow = ['MIT', 'ISC', 'Apache-2.0', 'BSD-3-Clause']

describe('satisfies', () => {
  it('accepts allowed licenses and SPDX expressions with an allowed branch', () => {
    expect(satisfies('MIT', allow)).toBe(true)
    expect(satisfies('mit', allow)).toBe(true)
    expect(satisfies('(MIT OR GPL-3.0)', allow)).toBe(true)
    expect(satisfies('(MPL-2.0 OR Apache-2.0)', allow)).toBe(true)
    expect(satisfies('(MIT AND ISC)', allow)).toBe(true)
    expect(satisfies('MIT AND (ISC OR GPL-2.0)', allow)).toBe(true)
    expect(satisfies(['MIT', 'ISC'], allow)).toBe(true)
  })

  it('rejects copyleft, unknown, guessed and partly allowed licenses', () => {
    expect(satisfies('GPL-3.0', allow)).toBe(false)
    expect(satisfies('(GPL-2.0 OR LGPL-2.1)', allow)).toBe(false)
    expect(satisfies('MIT AND Zlib', allow)).toBe(false)
    expect(satisfies(['MIT', 'Zlib'], allow)).toBe(false)
    expect(satisfies('MIT*', allow)).toBe(false)
    expect(satisfies('UNKNOWN', allow)).toBe(false)
    expect(satisfies('', allow)).toBe(false)
    expect(satisfies(undefined, allow)).toBe(false)
    expect(satisfies('Apache-2.0 WITH LLVM-exception', allow)).toBe(false)
    expect(satisfies('GPL-3.0+', allow)).toBe(false)
    expect(satisfies('(MIT', allow)).toBe(false)
    expect(satisfies('MIT)', allow)).toBe(false)
  })
})

describe('classify', () => {
  const policy = {
    allow,
    exceptions: { 'lightningcss*': 'dev-only build tool, not shipped', 'caniuse-lite': 'data' },
    shipped: ['electron'],
    bundled: [],
    owners: ['CoLeaf']
  }
  const packages = {
    'react@19.0.0': { licenses: 'MIT' },
    'lightningcss-win32-x64-msvc@1.0.0': { licenses: 'MPL-2.0' },
    'caniuse-lite@1.0.0': { licenses: 'CC-BY-4.0' },
    'some-tool@1.0.0': { licenses: 'GPL-3.0' },
    'shipped-mpl@1.0.0': { licenses: 'MPL-2.0' },
    'guessed@1.0.0': { licenses: 'MIT*' }
  }

  it('allows, excepts dev-only packages by name and fails the rest', () => {
    const result = classify(packages, policy, new Set(['react', 'shipped-mpl']))
    expect(result.allowed.map((entry) => entry.name)).toEqual(['react'])
    expect(result.excepted.map((entry) => [entry.name, entry.reason])).toEqual([
      ['caniuse-lite', 'data'],
      ['lightningcss-win32-x64-msvc', 'dev-only build tool, not shipped']
    ])
    expect(result.failed.map((entry) => [entry.name, entry.shipped])).toEqual([
      ['guessed', false],
      ['shipped-mpl', true],
      ['some-tool', false]
    ])
    expect(result.failed.find((entry) => entry.name === 'some-tool')?.reason).toMatch(/copyleft/)
  })

  it('never excepts a shipped package', () => {
    const result = classify(packages, policy, new Set(['caniuse-lite']))
    const entry = result.failed.find((item) => item.name === 'caniuse-lite')
    expect(entry?.shipped).toBe(true)
    expect(entry?.reason).toMatch(/dev-only packages only/)
  })

  it('matches exceptions by name or prefix', () => {
    expect(exceptionFor('lightningcss', policy.exceptions)).toBe('dev-only build tool, not shipped')
    expect(exceptionFor('lightningcss-linux-x64-gnu', policy.exceptions)).toBe(
      'dev-only build tool, not shipped'
    )
    expect(exceptionFor('caniuse-lite', policy.exceptions)).toBe('data')
    expect(exceptionFor('caniuse-lite-extra', policy.exceptions)).toBeNull()
  })
})

describe('packageNamesFromImports', () => {
  it('finds bare package names, not paths, builtins or assets', () => {
    const source = `
      import { Editor } from '@tiptap/core'
      import Image, { type ImageOptions } from '@tiptap/extension-image'
      import '@fontsource/ibm-plex-sans/400.css'
      import { X } from 'lucide-react'
      import { join } from 'node:path'
      import icon from '../../build/icon.png?asset'
      import './styles/app.css'
      const lazy = await import('mermaid/dist/mermaid.esm.mjs')
      export { schema } from "prosemirror-model"
    `
    expect([...packageNamesFromImports(source)].sort()).toEqual([
      '@fontsource/ibm-plex-sans',
      '@tiptap/core',
      '@tiptap/extension-image',
      'lucide-react',
      'mermaid',
      'prosemirror-model'
    ])
  })
})

describe('scanCodeFindings', () => {
  it('reports licenses and foreign notices, not our own', () => {
    const scan = {
      files: [
        { path: 'src', type: 'directory' },
        {
          path: 'src/a.ts',
          type: 'file',
          license_detections: [
            {
              license_expression: 'gpl-3.0',
              license_expression_spdx: 'GPL-3.0-only',
              matches: [{ start_line: 3 }]
            }
          ],
          copyrights: [
            { copyright: 'Copyright (c) 2026 Yehonatan Barel', start_line: 1 },
            { copyright: 'Copyright (c) 2020 Someone Else', start_line: 2 }
          ],
          authors: [{ author: 'Someone Else', start_line: 2 }]
        },
        {
          path: 'src/b.ts',
          type: 'file',
          licenses: [{ key: 'mit', spdx_license_key: 'MIT', start_line: 5 }]
        }
      ]
    }
    expect(scanCodeFindings(scan, ['Yehonatan Barel', 'CoLeaf'])).toEqual([
      { file: 'src/a.ts', kind: 'license', detail: 'GPL-3.0-only', line: 3 },
      { file: 'src/a.ts', kind: 'copyright', detail: 'Copyright (c) 2020 Someone Else', line: 2 },
      { file: 'src/a.ts', kind: 'author', detail: 'Someone Else', line: 2 },
      { file: 'src/b.ts', kind: 'license', detail: 'MIT', line: 5 }
    ])
  })
})

describe('renderReport', () => {
  it('writes the verdict, the tables and the ScanCode section', () => {
    const report = renderReport({
      stage: '1a',
      date: '2026-10-16',
      commit: 'abc1234',
      pass: false,
      licenses: {
        allowed: [{ name: 'react', version: '19.0.0', license: 'MIT', shipped: true }],
        excepted: [
          {
            name: 'caniuse-lite',
            version: '1.0.0',
            license: 'CC-BY-4.0',
            shipped: false,
            reason: 'data'
          }
        ],
        failed: [
          { name: 'tool', version: '2.0.0', license: 'GPL-3.0', shipped: false, reason: 'copyleft' }
        ]
      },
      bundled: [
        {
          name: 'Git',
          version: '2.53.0',
          license: 'GPL-2.0-only',
          source: 'https://github.com/git/git',
          licenseFile: 'node_modules/dugite/git/LICENSE.txt',
          note: 'separate process | not linked'
        }
      ],
      scancode: null
    })
    expect(report).toContain('# Compliance report: Stage 1a')
    expect(report).toContain('Result: **FAIL**')
    expect(report).toContain('| MIT | react@19.0.0 |')
    expect(report).toContain('| caniuse-lite@1.0.0 | CC-BY-4.0 | data |')
    expect(report).toContain('| tool@2.0.0 | GPL-3.0 | no | copyleft |')
    expect(report).toContain(
      '| Git | 2.53.0 | GPL-2.0-only | https://github.com/git/git | node_modules/dugite/git/LICENSE.txt | separate process \\| not linked |'
    )
    expect(report).toContain('Not run: ScanCode runs with `--release`')
  })

  it('says so when nothing is bundled', () => {
    const report = renderReport({
      stage: '1a',
      date: '2026-10-16',
      commit: 'abc1234',
      pass: true,
      licenses: { allowed: [], excepted: [], failed: [] },
      bundled: [],
      scancode: null
    })
    expect(report).toContain('## Bundled programs\n\nNone.')
  })
})
