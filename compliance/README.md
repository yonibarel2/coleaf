# Compliance checks

Run at the end of every stage; the report is committed with the stage (AGENTS.md rule 12).

## What is checked

| Check | When | How |
| --- | --- | --- |
| Dependency licenses | every stage | Every installed package (`license-checker-rseidelsohn`) is sorted by the license it declares against the allow list in `policy.json`. Packages that a file under `src/` imports, their whole dependency trees and Electron itself count as **shipped**: they must be on the allow list, no exceptions. Everything else is **dev-only** (build, lint and test tools): on the allow list, or listed under `exceptions` with a reason. Copyleft licenses (GPL, AGPL, LGPL), unknown licenses and licenses only guessed from a LICENSE file always fail. |
| Code origin | `--release`, when a full stage is complete (Stage 1, 2, …) | [ScanCode Toolkit](https://github.com/aboutcode-org/scancode-toolkit) scans `src/` for license texts and references and for copyright and author notices. Any license, and any notice not naming an owner from `policy.json`, is a finding and fails the check. ScanCode finds the traces copied code carries; it does not compare our code against a corpus of open-source code (that would need ScanCode.io's matching service). |

## How to run

```
npm run compliance -- --stage 1b
npm run compliance -- --stage 1 --release
```

The license check needs nothing beyond `npm install`. ScanCode is a Python tool and not a project dependency: install Python 3.9 or newer and pipx (`python -m pip install --user pipx`, then `python -m pipx ensurepath`), or put `scancode` on the PATH; the script then runs it through `pipx run --spec scancode-toolkit scancode`. The first run downloads ScanCode (a few hundred MB) and takes a few minutes.

## How to read the results

The report lands in `reports/stage-<id>.md`. Its first line gives the date, the commit and **PASS** or **FAIL**.

- **Dependency licenses:** the counts per result, the shipped packages listed by license, the dev-only packages counted by license, the exceptions in force and, when something failed, the failing packages with the reason. A failure means: change the dependency, or, for a dev-only package with a permissive license that is simply not on the list, add it to `allow` or `exceptions` in `policy.json` with the owner's approval.
- **Code origin:** the number of files scanned and either "no finding" or a table of file, line, kind and detail. A finding means a license or a foreign copyright or author notice sits in our code: find out where the code came from and rewrite it.

## policy.json

| Field | Meaning |
| --- | --- |
| `allow` | SPDX identifiers every dependency may use. SPDX expressions in packages are evaluated: `(MIT OR GPL-3.0)` passes, `MIT AND GPL-3.0` fails. |
| `exceptions` | Dev-only packages allowed although their license is not on the list: package name (a trailing `*` matches a prefix) → reason. Never applied to shipped packages. |
| `shipped` | Packages that ship without being imported by a source file (Electron). |
| `owners` | Copyright holders and authors that count as ours for the ScanCode pass. |
