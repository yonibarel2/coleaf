// Stage-end compliance checks (see README.md): dependency licenses at every stage, and with
// --release also a ScanCode pass over our own code. Writes reports/stage-<id>.md and exits 1
// when anything fails. Run directly by Node (TypeScript stripped, no build step).
import { execFile as execFileCallback } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { builtinModules, createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import {
  classify,
  packageNamesFromImports,
  renderReport,
  scanCodeFindings,
  type PackageInfo,
  type Policy,
  type Scan,
  type ScanResult
} from './lib.mts'

const execFile = promisify(execFileCallback)
const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
// A CommonJS package without a default export: loaded the CommonJS way.
const checker: typeof import('license-checker-rseidelsohn') = createRequire(import.meta.url)(
  'license-checker-rseidelsohn'
)

const args = process.argv.slice(2)
const stage = args[args.indexOf('--stage') + 1]
const release = args.includes('--release')
if (!args.includes('--stage') || !stage || stage.startsWith('--')) {
  console.error('Usage: npm run compliance -- --stage <id> [--release]')
  process.exit(2)
}

const policy: Policy = JSON.parse(await readFile(join(here, 'policy.json'), 'utf8'))
const packages = await installedPackages()
const shipped = await shippedNames()
const licenses = classify(packages, policy, shipped)
const scancode = release ? await runScanCode() : null
const date = new Date().toISOString().slice(0, 10)
const commit = (
  await execFile('git', ['rev-parse', '--short', 'HEAD'], { cwd: root })
).stdout.trim()
const pass =
  licenses.failed.length === 0 &&
  (scancode === null || (scancode.ok && scancode.findings.length === 0))

const report = renderReport({ stage, date, commit, pass, licenses, scancode })
const file = join(here, 'reports', `stage-${stage}.md`)
await mkdir(dirname(file), { recursive: true })
await writeFile(file, report, 'utf8')

const total = licenses.allowed.length + licenses.excepted.length + licenses.failed.length
const scanSummary = scancode
  ? `; ScanCode: ${scancode.ok ? `${scancode.findings.length} findings` : 'did not run'}`
  : ''
console.log(
  `${pass ? 'PASS' : 'FAIL'}: ${total} packages, ${licenses.allowed.length} allowed, ${licenses.excepted.length} excepted, ${licenses.failed.length} failed${scanSummary}`
)
console.log(`Report: ${file}`)
process.exit(pass ? 0 : 1)

/** Every installed package, as license-checker lists them (`name@version` → details). */
function installedPackages(): Promise<Record<string, PackageInfo>> {
  return new Promise((res, rej) => {
    checker.init({ start: root, excludePrivatePackages: true }, (error, result) =>
      error ? rej(error) : res(result as Record<string, PackageInfo>)
    )
  })
}

/**
 * The packages that end up in the app: everything a file under src/ imports, their whole
 * dependency trees, and the policy's own list (Electron itself). Everything else is dev-only.
 */
async function shippedNames(): Promise<Set<string>> {
  const names = new Set(policy.shipped)
  for (const source of await sourceFiles(join(root, 'src'))) {
    for (const name of packageNamesFromImports(await readFile(source, 'utf8'))) {
      if (!builtinModules.includes(name)) names.add(name)
    }
  }
  const queue = [...names].map((name) => ({ name, from: root }))
  const seen = new Set<string>()
  for (let item = queue.shift(); item; item = queue.shift()) {
    const dir = findPackageDir(item.from, item.name)
    if (!dir || seen.has(dir)) continue
    seen.add(dir)
    names.add(item.name)
    const manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
    const dependencies: Record<string, string> = {
      ...manifest.dependencies,
      ...manifest.optionalDependencies,
      ...manifest.peerDependencies
    }
    for (const dependency of Object.keys(dependencies)) queue.push({ name: dependency, from: dir })
  }
  return names
}

// Where Node would find a package imported from a folder: the nearest node_modules holding it.
function findPackageDir(from: string, name: string): string | null {
  for (let dir = from; dir.length >= root.length; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) return candidate
    if (dirname(dir) === dir) break
  }
  return null
}

async function sourceFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)))
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) files.push(path)
  }
  return files
}

/** ScanCode over src/: license texts and references, copyright and author notices. */
async function runScanCode(): Promise<ScanResult> {
  const command = await scanCodeCommand()
  if (!command) {
    return {
      ok: false,
      error:
        'ScanCode not found. Install Python 3.9 or newer and pipx (`python -m pip install --user pipx`, then `python -m pipx ensurepath`), or put `scancode` on the PATH.',
      findings: [],
      files: 0
    }
  }
  const temp = await mkdtemp(join(tmpdir(), 'coleaf-scancode-'))
  const output = join(temp, 'scan.json')
  try {
    const options = ['--license', '--copyright', '--info', '--strip-root', '--quiet']
    await execFile(
      command[0],
      [...command.slice(1), ...options, '--json-pp', output, join(root, 'src')],
      { cwd: root, maxBuffer: 64 * 1024 * 1024 }
    )
    const scan: Scan = JSON.parse(await readFile(output, 'utf8'))
    return {
      ok: true,
      findings: scanCodeFindings(scan, policy.owners),
      files: (scan.files ?? []).filter((entry) => entry.type === 'file').length,
      version: scan.headers?.[0]?.tool_version
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: message, findings: [], files: 0 }
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
}

// `scancode` on the PATH, else ScanCode through pipx; as absolute paths, so no shell is involved.
async function scanCodeCommand(): Promise<string[] | null> {
  const scancode = await resolveCommand('scancode')
  if (scancode) return [scancode]
  const pipx = await resolveCommand('pipx')
  if (pipx) return [pipx, 'run', '--spec', 'scancode-toolkit', 'scancode']
  return null
}

async function resolveCommand(name: string): Promise<string | null> {
  try {
    const { stdout } = await execFile(process.platform === 'win32' ? 'where' : 'which', [name])
    const found = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    return found.find((line) => /\.(exe|cmd|bat)$/i.test(line)) ?? found[0] ?? null
  } catch {
    return null
  }
}
