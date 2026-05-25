'use client'

/**
 * GalactusEvidencePanel — Panel 2 of the Galactus x Claude Platform dashboard.
 *
 * Authoritative spec: MC-DASHBOARD-SPEC.md §Panel 2: Evidence Panel
 *
 * Critical rendering rules (from spec):
 *  - NEVER collapse evidence entries
 *  - Every entry MUST show: kind badge, verification_status badge, freshness, verdict
 *  - STALE badge when entry.scope_epoch < currentRunScopeEpoch
 *  - NEVER show "artifact attached" as a verdict; only pass / fail / pending
 */

import { useState, useEffect, useCallback } from 'react'
import { createClientLogger } from '@/lib/client-logger'
import {
  classifySource,
  formatFreshness,
  sourceColor,
  type StateFreshness,
} from '@/lib/galactus-state-source'

const log = createClientLogger('GalactusEvidencePanel')

// ─── Types ──────────────────────────────────────────────────────────────────

export type EvidenceKind = 'test_result' | 'diff' | 'artifact' | 'screenshot'
export type VerificationStatus = 'machine_verified' | 'human_verified' | 'self_reported'
export type Verdict = 'pass' | 'fail' | 'pending'

export interface EvidencePayload {
  conclusion?: string    // "success" | "failure"
  pass?: boolean
  fail?: number          // count of failures
  [key: string]: unknown
}

export interface EvidenceEntry {
  id: string
  kind: EvidenceKind
  verification_status: VerificationStatus
  storage_ref: string
  content_hash: string
  produced_at: string    // ISO-8601
  scope_epoch: number
  payload?: EvidencePayload
}

// ─── Verdict computation ─────────────────────────────────────────────────────

/**
 * Compute a verdict from an evidence entry.
 * NEVER returns "artifact attached" — only "pass", "fail", or "pending".
 */
export function computeVerdict(entry: EvidenceEntry): Verdict {
  if (entry.verification_status === 'machine_verified') {
    const p = entry.payload ?? {}
    if (p.conclusion === 'success' || p.pass === true) return 'pass'
    if (p.conclusion === 'failure' || (typeof p.fail === 'number' && p.fail > 0)) return 'fail'
  }
  if (entry.verification_status === 'human_verified') return 'pass'
  return 'pending' // self_reported or unverifiable
}

/** Returns true when this evidence was produced under an older scope. */
export function isStale(entry: EvidenceEntry, currentScopeEpoch: number): boolean {
  return entry.scope_epoch < currentScopeEpoch
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

function kindColor(kind: EvidenceKind): string {
  const colors: Record<EvidenceKind, string> = {
    test_result: '#1f6feb',
    diff: '#6e40c9',
    artifact: '#2ea043',
    screenshot: '#e3b341',
  }
  return colors[kind]
}

function verificationColor(status: VerificationStatus): string {
  const colors: Record<VerificationStatus, string> = {
    machine_verified: '#2ea043',
    human_verified: '#1f6feb',
    self_reported: '#6e7681',
  }
  return colors[status]
}

function verdictColor(v: Verdict): string {
  const colors: Record<Verdict, string> = {
    pass: '#2ea043',
    fail: '#da3633',
    pending: '#6e7681',
  }
  return colors[v]
}

function relativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  if (diffMs < 60_000) return `${Math.round(diffMs / 1_000)}s ago`
  if (diffMs < 3_600_000) return `${Math.round(diffMs / 60_000)}m ago`
  if (diffMs < 86_400_000) return `${Math.round(diffMs / 3_600_000)}h ago`
  return new Date(isoDate).toLocaleDateString()
}

function shortHash(hash: string): string {
  return hash.slice(0, 8)
}

function safeEvidenceUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    const allowedHost = host === 'github.com'
      || host === 'raw.githubusercontent.com'
      || host === 'gist.github.com'
      || host === 'objects.githubusercontent.com'
      || host.endsWith('.githubusercontent.com')
    if (parsed.protocol !== 'https:' || !allowedHost) return null
    return parsed.toString()
  } catch {
    return null
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface BadgeProps {
  label: string
  color: string
  title?: string
}

function Badge({ label, color, title }: BadgeProps) {
  return (
    <span
      title={title}
      style={{
        background: color,
        color: '#fff',
        borderRadius: '4px',
        padding: '2px 7px',
        fontSize: '0.72rem',
        fontWeight: 600,
        marginRight: '5px',
        display: 'inline-block',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

interface EvidenceEntryRowProps {
  entry: EvidenceEntry
  currentScopeEpoch: number
}

function EvidenceEntryRow({ entry, currentScopeEpoch }: EvidenceEntryRowProps) {
  const [copied, setCopied] = useState(false)
  const verdict = computeVerdict(entry)
  const stale = isStale(entry, currentScopeEpoch)

  const copyHash = useCallback(() => {
    navigator.clipboard.writeText(entry.content_hash).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [entry.content_hash])

  const safeUrl = safeEvidenceUrl(entry.storage_ref)

  return (
    <div
      style={{
        borderBottom: '1px solid #21262d',
        padding: '10px 0',
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        fontSize: '0.82rem',
      }}
    >
      {/* Row 1: badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
        <Badge label={entry.kind} color={kindColor(entry.kind)} />
        <Badge label={entry.verification_status} color={verificationColor(entry.verification_status)} />
        <span style={{ color: '#8b949e', marginRight: '5px' }}>{relativeTime(entry.produced_at)}</span>
        {/* Scope epoch match icon */}
        <span
          title={`Evidence scope_epoch: ${entry.scope_epoch} | Run scope_epoch: ${currentScopeEpoch}`}
          style={{ marginRight: '5px', color: stale ? '#da3633' : '#2ea043' }}
        >
          {stale ? '⚠' : '✓'} epoch {entry.scope_epoch}
        </span>
        <Badge label={verdict.toUpperCase()} color={verdictColor(verdict)} />
        {stale && (
          <Badge label="STALE" color="#da3633" title="Evidence produced under a different scope epoch — may not apply to current run" />
        )}
      </div>

      {/* Row 2: storage_ref */}
      <div style={{ marginBottom: '3px' }}>
        {safeUrl ? (
          <a href={safeUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#58a6ff' }}>
            {safeUrl}
          </a>
        ) : (
          <code style={{ color: '#c9d1d9', background: '#010409', padding: '1px 4px', borderRadius: '3px' }}>
            {entry.storage_ref}
          </code>
        )}
      </div>

      {/* Row 3: content_hash + produced_at */}
      <div style={{ display: 'flex', gap: '12px', color: '#8b949e', alignItems: 'center' }}>
        <span>
          hash:{' '}
          <code style={{ color: '#c9d1d9', background: '#010409', padding: '1px 4px', borderRadius: '3px' }}>
            {shortHash(entry.content_hash)}
          </code>
          <button
            onClick={copyHash}
            title="Copy full hash"
            style={{
              marginLeft: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: copied ? '#2ea043' : '#8b949e',
              fontSize: '0.8rem',
            }}
          >
            {copied ? '✓' : '⧉'}
          </button>
        </span>
        <span title={new Date(entry.produced_at).toLocaleString()}>
          produced: {relativeTime(entry.produced_at)}
        </span>
      </div>
    </div>
  )
}

// ─── State Source Badge ───────────────────────────────────────────────────────

function StateSourceBadge({ freshness }: { freshness: StateFreshness | null }) {
  if (!freshness) return null
  return (
    <span style={{ fontSize: '0.72rem', color: '#fff', background: sourceColor(freshness.source), borderRadius: '4px', padding: '2px 7px' }}>
      {freshness.source} · {formatFreshness(freshness)}
    </span>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface GalactusEvidencePanelProps {
  runId: string
  /** Base URL for Managed Agents API — defaults to env var or localhost */
  apiBase?: string
}

export function GalactusEvidencePanel({ runId, apiBase = '' }: GalactusEvidencePanelProps) {
  const [entries, setEntries] = useState<EvidenceEntry[]>([])
  const [currentScopeEpoch, setCurrentScopeEpoch] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [freshness, setFreshness] = useState<StateFreshness | null>(null)

  const fetchEvidence = useCallback(async () => {
    const start = new Date()
    try {
      const res = await fetch(`${apiBase}/api/galactus/runs/${encodeURIComponent(runId)}/evidence`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setEntries(data.entries ?? [])
      setCurrentScopeEpoch(data.scope_epoch ?? 1)
      setFreshness({
        source: classifySource(res.headers),
        fetched_at: new Date(),
        lag_ms: Date.now() - start.getTime(),
      })
      setError(null)
    } catch (err) {
      log.error('fetch evidence failed', err)
      setEntries([])
      setCurrentScopeEpoch(1)
      setFreshness(null)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [runId, apiBase])

  useEffect(() => {
    setEntries([])
    setCurrentScopeEpoch(1)
    setFreshness(null)
    setError(null)
    setLoading(true)
    void fetchEvidence()
    const interval = setInterval(fetchEvidence, 30_000)
    return () => clearInterval(interval)
  }, [fetchEvidence])

  const isBridgeSnapshot = freshness?.source === 'bridge snapshot'

  return (
    <div
      style={{
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '6px',
        padding: '16px',
        fontFamily: "'SF Mono', 'Fira Code', monospace",
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ color: '#79c0ff', fontSize: '0.95rem', margin: 0 }}>
          Panel 2: Evidence
          {entries.length > 0 && (
            <span style={{ color: '#6e7681', marginLeft: '8px', fontSize: '0.8rem' }}>
              ({entries.length} entr{entries.length === 1 ? 'y' : 'ies'})
            </span>
          )}
        </h3>
        <StateSourceBadge freshness={freshness} />
      </div>

      {/* Scope epoch info */}
      <div style={{ color: '#8b949e', fontSize: '0.78rem', marginBottom: '10px' }}>
        Current scope epoch: <strong style={{ color: '#c9d1d9' }}>{currentScopeEpoch}</strong>
        &nbsp;— entries with lower epoch are marked STALE
      </div>

      {/* Content */}
      {loading && <div style={{ color: '#8b949e' }}>Loading evidence…</div>}
      {error && <div style={{ color: '#da3633' }}>Error: {error}</div>}
      {!loading && !error && entries.length === 0 && (
        <div style={{ color: '#8b949e', fontStyle: 'italic' }}>
          {isBridgeSnapshot
            ? 'Bridge snapshot stub active; upstream evidence ledger is not wired yet.'
            : 'No evidence recorded for this run yet.'}
        </div>
      )}
      {!error && entries.map((entry) => (
        <EvidenceEntryRow key={entry.id} entry={entry} currentScopeEpoch={currentScopeEpoch} />
      ))}
    </div>
  )
}
