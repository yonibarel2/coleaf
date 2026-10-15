// Claude Code PostToolUse hook (Edit | Write): run Prettier on the file Claude just changed.
// Reads the hook JSON from stdin. Best-effort: always exits 0.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd())
const prettier = join(root, 'node_modules', 'prettier', 'bin', 'prettier.cjs')

let input = ''
for await (const chunk of process.stdin) input += chunk

const filePath = JSON.parse(input || '{}').tool_input?.file_path
const file = filePath ? resolve(filePath) : undefined

// Only files inside the project: .prettierignore cannot protect anything outside it.
const insideProject = file !== undefined && file.toLowerCase().startsWith(root.toLowerCase())
if (!file || !insideProject || !existsSync(file) || !existsSync(prettier)) process.exit(0)

spawnSync(
  process.execPath,
  [prettier, '--write', '--ignore-unknown', '--log-level', 'warn', file],
  { cwd: root, stdio: 'inherit' }
)
