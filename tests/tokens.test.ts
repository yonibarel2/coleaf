import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererDir = resolve('src', 'renderer')
const tokensFile = join(rendererDir, 'styles', 'tokens.css')

// The Leaf palette as fixed in AGENTS.md rule 8.
const palette = {
  accent: '#2f7d32',
  ground: '#f3f3f1',
  sheet: '#fcfcfb',
  ink: '#171717',
  'accent-tint': '#e3f1e4'
}

describe('design tokens', () => {
  const tokens = readFileSync(tokensFile, 'utf8')

  it.each(Object.entries(palette))('defines --color-%s as %s', (name, value) => {
    expect(tokens).toMatch(new RegExp(`--color-${name}:\\s*${value};`, 'i'))
  })

  it('is the only renderer file with a hex color', () => {
    const offenders = readdirSync(rendererDir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(css|tsx?)$/.test(entry.name))
      .map((entry) => join(entry.parentPath, entry.name))
      .filter((file) => file !== tokensFile)
      .filter((file) => /#[0-9a-f]{3,8}\b/i.test(readFileSync(file, 'utf8')))
      .map((file) => relative(rendererDir, file))
    expect(offenders).toEqual([])
  })
})
