# Karpathy Coding Rules (you-kol adaptation)

<!-- begin karpathy-rules -->

## Karpathy Coding Rules

These rules address the most common LLM coding failure modes. They apply to
every session in this repo. No exceptions.

### Rule 1 — Think Before Coding

Before writing any code, state your assumptions explicitly. If the goal is
ambiguous, ask for clarifications. Surface tradeoffs to the operator before
starting. Do not begin implementing until the goal is falsifiable — "make it
work" is not a goal, "the function must return X when given Y" is a goal.

### Rule 2 — Simplicity First

Write the minimum code that achieves the goal. Do not add abstractions,
utilities, wrappers, or patterns that were not explicitly requested. Prefer
simple functions over clever classes. Prefer direct logic over indirection.
A solution that does exactly what was asked in 20 lines beats a "flexible"
framework in 200 lines.

### Rule 3 — Surgical Changes

Only touch the code paths necessary for the requested change. Match the
existing style, naming conventions, and file structure. Do not refactor
adjacent code unless explicitly asked. Do not rename variables, reformat
sections, or "clean up" things you weren't asked to touch. Do not translate
or modify pre-existing non-English (e.g., Chinese) comments — leave them
exactly as they are.

### Rule 4 — Goal-Driven

Convert vague goals into verifiable criteria before coding. Restate the goal
as a falsifiable assertion and confirm with the operator before proceeding.

- Vague: "Make it better"
- Goal: "The endpoint must return HTTP 200 with `{ok: true}` when the input is valid"

If the goal cannot be verified by a test, a grep, or a manual step, it is not
a goal yet.

### Rule 5 — Conventional Commits, No AI Attribution

Use conventional commit format for all commits:
`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`

Never add `Co-Authored-By`, `Generated-By`, or AI attribution trailers to
commits. No emojis in code, commit messages, or PR descriptions unless
explicitly requested by the operator.

---

Reported baseline: applying these rules improved task completion accuracy from
~65% to ~94% across agentic coding sessions. Source: Karpathy / multica-ai
adaptation for you-kol repos.

<!-- end karpathy-rules -->

---

# Mission Control

Open-source dashboard for AI agent orchestration. Manage agent fleets, track tasks, monitor costs, and orchestrate workflows.

**Stack**: Next.js 16, React 19, TypeScript 5, SQLite (better-sqlite3), Tailwind CSS 3, Zustand, pnpm

## Prerequisites

- Node.js >= 22 (LTS recommended; 24.x also supported)
- pnpm (`corepack enable` to auto-install)

## Setup

```bash
pnpm install
pnpm build
```

Secrets (AUTH_SECRET, API_KEY) auto-generate on first run if not set.
Visit `http://localhost:3000/setup` to create an admin account, or set `AUTH_USER`/`AUTH_PASS` in `.env` for headless/CI seeding.

## Run

```bash
pnpm dev              # development (localhost:3000)
pnpm start            # production
node .next/standalone/server.js   # standalone mode (after build)
```

## Docker

```bash
docker compose up                 # zero-config
bash install.sh --docker          # full guided setup
```

Production hardening: `docker compose -f docker-compose.yml -f docker-compose.hardened.yml up -d`

## Tests

```bash
pnpm test             # unit tests (vitest)
pnpm test:e2e         # end-to-end (playwright)
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint
pnpm test:all         # lint + typecheck + test + build + e2e
```

## Key Directories

```
src/app/          Next.js pages + API routes (App Router)
src/components/   UI panels and shared components
src/lib/          Core logic, database, utilities
.data/            SQLite database + runtime state (gitignored)
scripts/          Install, deploy, diagnostics scripts
docs/             Documentation and guides
```

Path alias: `@/*` maps to `./src/*`

## Data Directory

Set `MISSION_CONTROL_DATA_DIR` env var to change the data location (defaults to `.data/`).
Database path: defaults to `<MISSION_CONTROL_DATA_DIR>/mission-control.db`.

## Conventions

- **Commits**: Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`)
- **No AI attribution**: Never add `Co-Authored-By` or similar trailers to commits
- **Package manager**: pnpm only (no npm/yarn)
- **Icons**: No icon libraries -- use raw text/emoji in components
- **Standalone output**: `next.config.js` sets `output: 'standalone'`

## Agent Control Interfaces

Mission Control provides three interfaces for autonomous agents:

### MCP Server (recommended for agents)
```bash
# Add to any Claude Code agent:
claude mcp add mission-control -- node /path/to/mission-control/scripts/mc-mcp-server.cjs

# Environment config:
MC_URL=http://127.0.0.1:3000 MC_API_KEY=<key>
```
35 tools: agents, tasks, sessions, memory, soul, comments, tokens, skills, cron, status.
See `docs/cli-agent-control.md` for full tool list.

### CLI
```bash
pnpm mc agents list --json
pnpm mc tasks queue --agent Aegis --max-capacity 2 --json
pnpm mc events watch --types agent,task
```

### REST API
OpenAPI spec: `openapi.json`. Interactive docs at `/docs` when running.

## Common Pitfalls

- **Standalone mode**: Use `node .next/standalone/server.js`, not `pnpm start` (which requires full `node_modules`)
- **better-sqlite3**: Native addon -- needs rebuild when switching Node versions (`pnpm rebuild better-sqlite3`)
- **AUTH_PASS with `#`**: Quote it (`AUTH_PASS="my#pass"`) or use `AUTH_PASS_B64` (base64-encoded)
- **Gateway optional**: Set `NEXT_PUBLIC_GATEWAY_OPTIONAL=true` for standalone deployments without gateway connectivity

## lessons.md Maintenance

Update `lessons.md` in the repo root IMMEDIATELY when:
1. Unexpected behavior occurs (not in spec, not in docs, but happening)
2. An edge case gets discovered (condition that breaks normal flow)
3. A config fix needed (setting that prevents failures, undocumented)
4. 2AM intervention required (prod fix that wasn't preventable by design)

Never wait until "after" to document. The context will be gone.
See lessons.md in this repo root for format and examples.
