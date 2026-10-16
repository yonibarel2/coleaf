// Temporary repositories for the Git tests. The user's own Git configuration is never read or
// written: every test file calls `isolateGitConfig` first, which points Git at a scratch file.
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { git } from '../../src/main/git/run'

/** A fresh temporary folder, with `name` under it when given. */
export async function tempDir(name?: string): Promise<string> {
  const base = await mkdtemp(join(tmpdir(), 'coleaf-git-'))
  if (!name) return base
  const dir = join(base, name)
  await mkdir(dir)
  return dir
}

/** Routes Git's global and system configuration to a scratch file for this test process. */
export async function isolateGitConfig(): Promise<void> {
  process.env['GIT_CONFIG_GLOBAL'] = join(await tempDir(), 'gitconfig')
  process.env['GIT_CONFIG_NOSYSTEM'] = '1'
}

/** A new repository on branch `main` with a local identity, so commits work right away. */
export async function initRepo(dir: string): Promise<void> {
  await git(dir, ['init', '--quiet', '--initial-branch=main'])
  await git(dir, ['config', 'user.name', 'Test User'])
  await git(dir, ['config', 'user.email', 'test@example.com'])
}

/** Writes a file (folders created as needed), path `/`-separated under the repository. */
export async function write(dir: string, path: string, text: string): Promise<void> {
  const file = join(dir, ...path.split('/'))
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, text)
}

/** Stages everything and commits it. */
export async function commitAll(dir: string, message: string): Promise<void> {
  await git(dir, ['add', '--all'])
  await git(dir, ['commit', '--quiet', '-m', message])
}

/** The subject lines of the branch's history, newest first. */
export async function log(dir: string): Promise<string[]> {
  const output = await git(dir, ['log', '--format=%s'])
  return output.split(/\r?\n/).filter(Boolean)
}

/** The files the last commit touched. */
export async function lastCommitFiles(dir: string): Promise<string[]> {
  const output = await git(dir, ['show', '--name-only', '--format=', 'HEAD'])
  return output.split(/\r?\n/).filter(Boolean).sort()
}
