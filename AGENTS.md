# Mission Control Agent Guide

This file is the first stop for agents working on this checkout. Read `CLAUDE.md`
next for project commands and conventions.

## Canonical Local Layout

- Canonical development checkout: `/Users/oc_runtime/Development/mission-control`.
- Runtime data directory: `/Users/oc_runtime/Development/mission-control-data`.
- Retired deployment clone archive:
  `/Users/oc_runtime/Development/worktrees/_archive/mission-control-deploy-retired-20260513-161337`.
- General worktree root for other projects: `/Users/oc_runtime/Development/worktrees`.

Do not create sibling Mission Control clones such as `mission-control-pr-*` or
`mission-control-upstream-*`. If an isolated checkout is required, use a named
Git worktree under `/Users/oc_runtime/Development/worktrees/` and document why.

## Repository And PR Rules

- `fork` is the writable fork remote: `git@github.com:ik-svc-oc/mission-control.git`.
- `origin` points at upstream: `https://github.com/builderz-labs/mission-control.git`.
- Do not open upstream PRs or push branches to upstream unless the operator
  explicitly requests it in the current task.
- Before any PR operation, show/verify the target owner, repository, base branch,
  and head branch.
- Keep task work on fork/local branches by default.

## Consolidation Rules

- Treat `/Users/oc_runtime/Development/mission-control` as the source of truth
  for code edits, tests, and branch work.
- Treat `mission-control-data` as runtime state, not source code. Do not delete
  or move it during repo cleanup.
- `mission-control-deploy` was archived after tracing LaunchAgent and launcher
  references back to the canonical checkout. Do not recreate it as a sibling
  clone; restore the archived copy only if a runtime dependency is discovered.
- Before removing any checkout or worktree, trace references with `rg` across
  `/Users/oc_runtime/Development` and patch live scripts back to the canonical
  path first.

Recommended trace command:

```bash
rg -n "mission-control-pr-upstream|mission-control-deploy|mission-control-data|/Users/oc_runtime/Development/mission-control|MISSION_CONTROL_REPO_ROOT" \
  /Users/oc_runtime/Development \
  --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/.git/**'
```

Run `bash ~/.codex/hooks/git-hygiene-audit.sh /Users/oc_runtime/Development`
before creating branches, PRs, worktrees, or cleanup plans.
