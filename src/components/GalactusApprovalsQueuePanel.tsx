'use client'

/**
 * GalactusApprovalsQueuePanel — Panel 4: Approvals Queue
 *
 * Authoritative spec: MC-DASHBOARD-SPEC.md §Panel 4
 *
 * Rules:
 *  - Read-only — there is NO approve button. Approvals happen in GitHub PR UI.
 *  - Refresh every 60s
 *  - Source: /api/galactus/runs/{run_id}/approval-ledger (pending entries only)
 *  - Display State Source badge at top-right
 */

import { useCallback, useEffect, useState } from 'react'
import { createClientLogger } from '@/lib/client-logger'
import {
  classifySource,
  formatFreshness,
  sourceColor,
  type StateFreshness,
} from '@/lib/galactus-state-source'

const log = createClientLogger('GalactusApprovalsQueuePanel')

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApprovalType = 'scope' | 'contract_lock' | 'deploy' | 'prod_release'

export interface PendingApproval {
  id: string
  approval_type: ApprovalType
  required_approver: string
  pr_url?: string
  waiting_since: string // ISO-8601
  gate_predicate_id: string
}

interface ApprovalLedgerResponse {
  approvals: PendingApproval[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeColor(t: ApprovalType): string {
  const colors: Record<ApprovalType, string> = {
    scope: '#1f6feb',
    contract_lock: '#6e40c9',
    deploy: '#e3b341',
    prod_release: '#da3633',
  }
  return colors[t]
}

function typeTextColor(t: ApprovalType): string {
  return t === 'deploy' ? '#000' : '#fff'
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return `${Math.round(ms / 1_000)}s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`
  return new Date(iso).toLocaleDateString()
}

function safeGitHubPrUrl(url: string | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') return null
    if (!/\/pull\/\d+(?:\/)?$/.test(parsed.pathname)) return null
    return parsed.toString()
  } catch {
    return null
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StateSourceBadge({ freshness }: { freshness: StateFreshness | null }) {
  if (!freshness) return null
  return (
    <span
      style={{
        fontSize: '0.72rem',
        color: '#fff',
        background: sourceColor(freshness.source),
        borderRadius: '4px',
        padding: '2px 7px',
      }}
    >
      {freshness.source} · {formatFreshness(freshness)}
    </span>
  )
}

function TypeBadge({ approval_type }: { approval_type: ApprovalType }) {
  return (
    <span
      style={{
        background: typeColor(approval_type),
        color: typeTextColor(approval_type),
        borderRadius: '4px',
        padding: '2px 7px',
        fontSize: '0.72rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {approval_type.replace(/_/g, ' ').toUpperCase()}
    </span>
  )
}

function ApprovalRow({ approval }: { approval: PendingApproval }) {
  const prUrl = safeGitHubPrUrl(approval.pr_url)
  return (
    <div
      style={{
        borderBottom: '1px solid #21262d',
        padding: '10px 0',
        display: 'grid',
        gridTemplateColumns: '1.1fr 1.3fr 0.9fr 0.9fr 1.4fr',
        gap: '10px',
        alignItems: 'center',
        fontSize: '0.82rem',
        fontFamily: "'SF Mono', 'Fira Code', monospace",
      }}
    >
      <TypeBadge approval_type={approval.approval_type} />
      <span style={{ color: '#c9d1d9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {approval.required_approver}
      </span>
      {prUrl ? (
        <a
          href={prUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#58a6ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={prUrl}
        >
          ↗ GitHub PR
        </a>
      ) : (
        <span style={{ color: '#6e7681', fontStyle: 'italic' }}>(no PR linked)</span>
      )}
      <span
        title={new Date(approval.waiting_since).toLocaleString()}
        style={{ color: '#8b949e' }}
      >
        {relativeTime(approval.waiting_since)}
      </span>
      <code
        style={{
          color: '#c9d1d9',
          background: '#010409',
          padding: '1px 4px',
          borderRadius: '3px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={approval.gate_predicate_id}
      >
        {approval.gate_predicate_id}
      </code>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface GalactusApprovalsQueuePanelProps {
  runId: string
  apiBase?: string
}

export function GalactusApprovalsQueuePanel({ runId, apiBase = '' }: GalactusApprovalsQueuePanelProps) {
  const [approvals, setApprovals] = useState<PendingApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [freshness, setFreshness] = useState<StateFreshness | null>(null)

  const fetchApprovals = useCallback(async () => {
    const start = new Date()
    try {
      const res = await fetch(`${apiBase}/api/galactus/runs/${encodeURIComponent(runId)}/approval-ledger`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ApprovalLedgerResponse
      setApprovals(data.approvals ?? [])
      setFreshness({
        source: classifySource(res.headers),
        fetched_at: new Date(),
        lag_ms: Date.now() - start.getTime(),
      })
      setError(null)
    } catch (err) {
      log.error('fetch approvals failed', err)
      setApprovals([])
      setFreshness(null)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [runId, apiBase])

  useEffect(() => {
    setApprovals([])
    setFreshness(null)
    setError(null)
    setLoading(true)
    void fetchApprovals()
    const interval = setInterval(fetchApprovals, 60_000)
    return () => clearInterval(interval)
  }, [fetchApprovals])

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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <h3 style={{ color: '#79c0ff', fontSize: '0.95rem', margin: 0 }}>
          Panel 4: Approvals Queue
          {approvals.length > 0 && (
            <span style={{ color: '#6e7681', marginLeft: '8px', fontSize: '0.8rem' }}>
              ({approvals.length} pending)
            </span>
          )}
        </h3>
        <StateSourceBadge freshness={freshness} />
      </div>

      {/* Column header */}
      {!error && approvals.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 1.3fr 0.9fr 0.9fr 1.4fr',
            gap: '10px',
            color: '#6e7681',
            fontSize: '0.72rem',
            textTransform: 'uppercase',
            paddingBottom: '6px',
            borderBottom: '1px solid #30363d',
          }}
        >
          <span>Type</span>
          <span>Approver</span>
          <span>PR</span>
          <span>Waiting</span>
          <span>Gate predicate</span>
        </div>
      )}

      {/* Body */}
      {loading && <div style={{ color: '#8b949e' }}>Loading approvals…</div>}
      {error && <div style={{ color: '#da3633' }}>Error: {error}</div>}
      {!loading && !error && approvals.length === 0 && (
        <div style={{ color: '#8b949e', fontStyle: 'italic' }}>
          {isBridgeSnapshot
            ? 'Bridge snapshot stub active; upstream approval ledger is not wired yet.'
            : 'No pending approvals.'}
        </div>
      )}
      {!error && approvals.map((approval) => (
        <ApprovalRow key={approval.id} approval={approval} />
      ))}

      {/* Read-only footer */}
      <div
        style={{
          marginTop: '12px',
          paddingTop: '8px',
          borderTop: '1px solid #30363d',
          color: '#8b949e',
          fontSize: '0.75rem',
          fontStyle: 'italic',
        }}
      >
        Click PR link to approve in GitHub — Mission Control is read-only.
      </div>
    </div>
  )
}
