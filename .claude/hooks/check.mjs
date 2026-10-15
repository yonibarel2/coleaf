// Claude Code Stop hook: run `npm run check` (typecheck, lint, tests) before Claude finishes a turn,
// but only when the working tree has code or config changes. On failure, exit 2 with the output
// on stderr so Claude keeps working instead of stopping. Claude Code caps consecutive blocks.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd())
process.stdin.resume()

if (!existsSync(join(root, 'node_modules'))) process.exit(0)

const status = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' })
const changedPaths = (status.stdout ?? '')
  .split('\n')
  .filter(Boolean)
  .map((line) => line.slice(3).replace(/^"|"$/g, '').split(' -> ').pop() ?? '')

const hasCodeChanges = changedPaths.some(
  (path) => /^(src|tests|\.claude\/hooks)\//.test(path) || /^[^/]+\.(json|ts|mjs|yaml)$/.test(path)
)
if (!hasCodeChanges) process.exit(0)

const result = spawnSync('npm', ['run', 'check', '--silent'], {
  cwd: root,
  encoding: 'utf8',
  shell: true
})
if (result.status === 0) process.exit(0)

const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim().slice(-6000)
process.stderr.write(
  `npm run check failed. Fix the problems below before finishing.\n\n${output}\n`
)
process.exit(2)
