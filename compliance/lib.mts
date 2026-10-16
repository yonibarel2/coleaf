// The pure parts of the compliance check, kept apart from the file and process work in run.mts
// so tests/compliance/lib.test.ts can cover them.

export interface Policy {
  /** SPDX identifiers every dependency may use. */
  allow: string[]
  /** Dev-only packages allowed anyway: name (a trailing `*` matches a prefix) → reason. */
  exceptions: Record<string, string>
  /** Packages shipped in the app although no source file imports them. */
  shipped: string[]
  /** Programs shipped next to the app's code, not npm packages (the Git binary). */
  bundled: BundledProgram[]
  /** Copyright holders and authors that count as ours. */
  owners: string[]
}

/** A program the installer carries as separate files, run as its own process. */
export interface BundledProgram {
  name: string
  version: string
  /** SPDX identifier; copyleft is fine for a separate program whose license text ships. */
  license: string
  /** Where its source code is. */
  source: string
  /** Where its license text sits in the package. */
  licenseFile: string
  /** How it reaches the app and why its license allows that. */
  note: string
}

export interface Entry {
  name: string
  version: string
  /** The license expression as the package declares it. */
  license: string
  /** Whether the package ends up in the app. */
  shipped: boolean
  /** Why it is excepted, or why it failed. */
  reason?: string
}

export interface Classified {
  allowed: Entry[]
  excepted: Entry[]
  failed: Entry[]
}

export interface Finding {
  file: string
  kind: 'license' | 'copyright' | 'author'
  detail: string
  line: number | undefined
}

export interface ScanResult {
  ok: boolean
  error?: string
  findings: Finding[]
  files: number
  version?: string
}

/** A package as license-checker lists it. */
export interface PackageInfo {
  licenses?: string | string[]
}

const guessedOrUnknown = /\*$|^UNKNOWN$|^$/i

/**
 * Whether a license expression is satisfied by the allow list: any OR branch may match, every
 * AND part must. A guessed license (`MIT*`: read from a LICENSE file, not declared) or an
 * unknown one never passes. A list of licenses must pass as a whole.
 */
export function satisfies(
  expression: string | string[] | null | undefined,
  allow: string[]
): boolean {
  const text = Array.isArray(expression)
    ? expression.map((part) => `(${part})`).join(' AND ')
    : String(expression ?? '').trim()
  if (guessedOrUnknown.test(text)) return false
  const allowed = new Set(allow.map((id) => id.toLowerCase()))
  const tokens = text.replace(/[()]/g, ' $& ').split(/\s+/).filter(Boolean)
  let index = 0
  const peek = (): string | undefined => tokens[index]?.toUpperCase()
  const next = (): string | undefined => tokens[index++]

  function parseOr(): boolean {
    let value = parseAnd()
    while (peek() === 'OR') {
      next()
      const right = parseAnd()
      value = value || right
    }
    return value
  }

  function parseAnd(): boolean {
    let value = parseFactor()
    while (peek() === 'AND') {
      next()
      const right = parseFactor()
      value = value && right
    }
    return value
  }

  function parseFactor(): boolean {
    const token = next()
    if (token === undefined) return false
    if (token === '(') {
      const value = parseOr()
      return next() === ')' && value
    }
    let id = token
    if (peek() === 'WITH') {
      next()
      id = `${id} WITH ${next() ?? ''}`
    }
    return allowed.has(id.toLowerCase())
  }

  const result = parseOr()
  return index === tokens.length && result
}

/** The exception that covers a package name, if any. */
export function exceptionFor(name: string, exceptions: Record<string, string>): string | null {
  for (const [pattern, reason] of Object.entries(exceptions)) {
    const matches = pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : name === pattern
    if (matches) return reason
  }
  return null
}

/**
 * Sorts every installed package into allowed, excepted (dev-only, by name) or failed. Anything
 * shipped must be on the allow list: exceptions never apply to it.
 */
export function classify(
  packages: Record<string, PackageInfo>,
  policy: Policy,
  shippedNames: Set<string>
): Classified {
  const result: Classified = { allowed: [], excepted: [], failed: [] }
  for (const key of Object.keys(packages).sort()) {
    const info = packages[key]
    const at = key.lastIndexOf('@')
    const name = key.slice(0, at)
    const version = key.slice(at + 1)
    const license = Array.isArray(info.licenses)
      ? info.licenses.join(' AND ')
      : String(info.licenses ?? 'UNKNOWN')
    const shipped = shippedNames.has(name)
    const entry: Entry = { name, version, license, shipped }
    if (satisfies(info.licenses, policy.allow)) {
      result.allowed.push(entry)
      continue
    }
    const reason = exceptionFor(name, policy.exceptions)
    if (reason !== null && !shipped) {
      result.excepted.push({ ...entry, reason })
      continue
    }
    const copyleft = /\b(A|L)?GPL\b/i.test(license) ? 'copyleft license; ' : ''
    const why = shipped
      ? reason !== null
        ? 'shipped: exceptions apply to dev-only packages only'
        : 'shipped: license not on the allow list'
      : 'license not on the allow list and no exception'
    result.failed.push({ ...entry, reason: copyleft + why })
  }
  return result
}

const specifierPattern = /\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g

/**
 * The npm package names a source file imports: bare specifiers only, subpaths and `?asset`
 * suffixes stripped. Relative paths and `node:` builtins are not packages.
 */
export function packageNamesFromImports(source: string): Set<string> {
  const names = new Set<string>()
  for (const match of source.matchAll(specifierPattern)) {
    const specifier = match[1].replace(/\?.*$/, '')
    if (/^(\.|\/|node:|[a-z]:)/i.test(specifier)) continue
    const parts = specifier.split('/')
    names.add(specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0])
  }
  return names
}

/** One entry of ScanCode's JSON output, the fields this check reads. */
export interface ScanFile {
  path: string
  type: string
  license_detections?: {
    license_expression?: string
    license_expression_spdx?: string
    matches?: { start_line?: number }[]
  }[]
  /** ScanCode before version 32. */
  licenses?: { key?: string; spdx_license_key?: string; start_line?: number }[]
  copyrights?: { copyright?: string; value?: string; start_line?: number }[]
  authors?: { author?: string; value?: string; start_line?: number }[]
}

export interface Scan {
  headers?: { tool_version?: string }[]
  files?: ScanFile[]
}

/**
 * What ScanCode found in our files that points at someone else's code: any license text or
 * reference, and copyright or author notices that are not ours.
 */
export function scanCodeFindings(scan: Scan, owners: string[]): Finding[] {
  const ours = (text: string): boolean =>
    owners.some((owner) => text.toLowerCase().includes(owner.toLowerCase()))
  const findings: Finding[] = []
  for (const file of scan.files ?? []) {
    if (file.type !== 'file') continue
    for (const detection of file.license_detections ?? []) {
      findings.push({
        file: file.path,
        kind: 'license',
        detail: detection.license_expression_spdx ?? detection.license_expression ?? '?',
        line: detection.matches?.[0]?.start_line
      })
    }
    for (const item of file.licenses ?? []) {
      findings.push({
        file: file.path,
        kind: 'license',
        detail: item.spdx_license_key ?? item.key ?? '?',
        line: item.start_line
      })
    }
    for (const item of file.copyrights ?? []) {
      const text = item.copyright ?? item.value ?? ''
      if (!ours(text)) {
        findings.push({ file: file.path, kind: 'copyright', detail: text, line: item.start_line })
      }
    }
    for (const item of file.authors ?? []) {
      const text = item.author ?? item.value ?? ''
      if (!ours(text)) {
        findings.push({ file: file.path, kind: 'author', detail: text, line: item.start_line })
      }
    }
  }
  return findings
}

export interface ReportData {
  stage: string
  date: string
  commit: string
  pass: boolean
  licenses: Classified
  bundled: BundledProgram[]
  scancode: ScanResult | null
}

/** The stage report as Markdown. */
export function renderReport({
  stage,
  date,
  commit,
  pass,
  licenses,
  bundled,
  scancode
}: ReportData): string {
  const all = [...licenses.allowed, ...licenses.excepted, ...licenses.failed]
  const shipped = all.filter((entry) => entry.shipped)
  const dev = all.filter((entry) => !entry.shipped)
  const count = (entries: Entry[], shippedOnly: boolean): number =>
    entries.filter((entry) => entry.shipped === shippedOnly).length
  const byLicense = (entries: Entry[]): [string, Entry[]][] => {
    const groups = new Map<string, Entry[]>()
    for (const entry of entries) {
      groups.set(entry.license, [...(groups.get(entry.license) ?? []), entry])
    }
    return [...groups].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  }
  const cell = (text: string | undefined): string => String(text ?? '').replace(/\|/g, '\\|')
  const id = (entry: Entry): string => `${entry.name}@${entry.version}`
  const lines = [
    `# Compliance report: Stage ${stage}`,
    '',
    `Date: ${date} · Commit: ${commit} · Result: **${pass ? 'PASS' : 'FAIL'}**`,
    '',
    '## Dependency licenses',
    '',
    `${all.length} installed packages checked against the allow list in policy.json: ${shipped.length} shipped (bundled into the app or run by it), ${dev.length} dev-only (build, lint and test tools).`,
    '',
    '| Result | Shipped | Dev-only |',
    '| --- | --- | --- |',
    `| Allowed | ${count(licenses.allowed, true)} | ${count(licenses.allowed, false)} |`,
    `| Excepted | ${count(licenses.excepted, true)} | ${count(licenses.excepted, false)} |`,
    `| Failed | ${count(licenses.failed, true)} | ${count(licenses.failed, false)} |`,
    '',
    '### Shipped packages by license',
    '',
    '| License | Packages |',
    '| --- | --- |',
    ...byLicense(shipped).map(
      ([license, entries]) => `| ${cell(license)} | ${entries.map(id).join(', ')} |`
    ),
    '',
    '### Dev-only packages by license',
    '',
    '| License | Packages |',
    '| --- | --- |',
    ...byLicense(dev).map(([license, entries]) => `| ${cell(license)} | ${entries.length} |`),
    '',
    '### Exceptions',
    ''
  ]
  if (licenses.excepted.length === 0) lines.push('None.')
  else {
    lines.push('| Package | License | Reason |', '| --- | --- | --- |')
    for (const entry of licenses.excepted) {
      lines.push(`| ${id(entry)} | ${cell(entry.license)} | ${cell(entry.reason)} |`)
    }
  }
  lines.push('', '### Failures', '')
  if (licenses.failed.length === 0) lines.push('None.')
  else {
    lines.push('| Package | License | Shipped | Why |', '| --- | --- | --- | --- |')
    for (const entry of licenses.failed) {
      const shippedText = entry.shipped ? 'yes' : 'no'
      lines.push(
        `| ${id(entry)} | ${cell(entry.license)} | ${shippedText} | ${cell(entry.reason)} |`
      )
    }
  }
  lines.push('', '## Bundled programs', '')
  if (bundled.length === 0) lines.push('None.')
  else {
    lines.push(
      'Programs shipped as separate files and run as their own process; their license text ships with them.',
      '',
      '| Program | Version | License | Source | License text | Note |',
      '| --- | --- | --- | --- | --- | --- |'
    )
    for (const program of bundled) {
      lines.push(
        `| ${cell(program.name)} | ${cell(program.version)} | ${cell(program.license)} | ${cell(program.source)} | ${cell(program.licenseFile)} | ${cell(program.note)} |`
      )
    }
  }
  lines.push('', '## Code origin (ScanCode)', '')
  if (scancode === null) {
    lines.push('Not run: ScanCode runs with `--release`, when a full stage is complete.')
  } else if (!scancode.ok) {
    lines.push(`ScanCode did not run: ${scancode.error}`)
  } else {
    const version = scancode.version ? ` ${scancode.version}` : ''
    lines.push(
      `${scancode.files} files under src/ scanned with ScanCode${version} for license texts and references, copyright and author notices.`,
      ''
    )
    if (scancode.findings.length === 0) {
      lines.push('No license or foreign copyright or author notice found.')
    } else {
      lines.push('| File | Line | Kind | Detail |', '| --- | --- | --- | --- |')
      for (const finding of scancode.findings) {
        lines.push(
          `| ${finding.file} | ${finding.line ?? ''} | ${finding.kind} | ${cell(finding.detail)} |`
        )
      }
    }
  }
  lines.push('')
  return lines.join('\n')
}
