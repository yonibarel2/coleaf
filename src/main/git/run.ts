import { exec } from 'dugite'

/** A Git command that exited with an error: what Git said, in plain words where possible. */
export class GitError extends Error {
  constructor(
    readonly args: string[],
    readonly exitCode: number,
    readonly stderr: string
  ) {
    super(explain(stderr) || `git ${args[0]} failed (exit code ${exitCode})`)
    this.name = 'GitError'
  }
}

export interface RunOptions {
  /** Extra environment variables for this one Git process. */
  env?: Record<string, string | undefined>
  /** Exit codes that are answers, not failures (`git config --get` exits 1 when unset). */
  ok?: number[]
  /** Text written to Git's standard input (a commit message, a file list). */
  stdin?: string
}

/**
 * Runs the bundled Git in a folder and returns its output. Git never asks anything: terminal
 * prompts are off and credential helpers are cleared, so a missing login fails instead of
 * opening a sign-in window. Optional locks are off too, so `git status` never writes the index
 * (which the project watcher would report as a change).
 */
export async function git(root: string, args: string[], options: RunOptions = {}): Promise<string> {
  const result = await exec(['--no-optional-locks', '-c', 'credential.helper=', ...args], root, {
    env: { GIT_TERMINAL_PROMPT: '0', ...options.env },
    stdin: options.stdin
  })
  if (result.exitCode !== 0 && !options.ok?.includes(result.exitCode)) {
    throw new GitError(args, result.exitCode, result.stderr)
  }
  return result.stdout
}

// Git's own wording, trimmed to its first useful line.
function explain(stderr: string): string {
  const line = stderr
    .split(/\r?\n/)
    .map((text) => text.replace(/^(fatal|error|warning):\s*/, '').trim())
    .find(Boolean)
  return line ?? ''
}
