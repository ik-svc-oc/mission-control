#!/usr/bin/env node
// Copies the project-local better-sqlite3 native binary into the standalone
// bundle after `next build`. The standalone bundle strips the build/Release/
// directory during file tracing, so without this the E2E server returns 500
// on every DB operation.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = 'better-sqlite3'
const pnpmPath = `.pnpm/${pkg}@12.6.2/node_modules/${pkg}`
const releasePath = 'build/Release/better_sqlite3.node'

const src = path.join(root, 'node_modules', pnpmPath, releasePath)
const dst = path.join(root, '.next/standalone/node_modules', pnpmPath, releasePath)

if (!fs.existsSync(src)) {
  console.error(`postbuild: source binary not found at ${src}`)
  process.exit(1)
}

if (!fs.existsSync(path.join(root, '.next/standalone'))) {
  // standalone output not present (e.g. next build without output:standalone) — skip silently
  process.exit(0)
}

fs.mkdirSync(path.dirname(dst), { recursive: true })
fs.copyFileSync(src, dst)
console.log(`postbuild: copied better_sqlite3.node into standalone bundle`)
