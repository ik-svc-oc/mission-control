'use client'

/**
 * GalactusTrajectoryPanel — Panel 5: Trajectory Pending Review
 *
 * Authoritative spec: MC-DASHBOARD-SPEC.md §Panel 5: Trajectory Pending Review
 *
 * Rules:
 *  - Refresh is MANUAL only (refresh button) — do NOT poll mem0 automatically
 *  - Approve  → PATCH /api/mem0/{id} with {action: 'approve'}
 *  - Reject   → PATCH /api/mem0/{id} with {action: 'reject'}
 *  - Defer    → no state change, UI shows "deferred"
 *  - Approve/Reject call mcp__mem0__add update ONLY — never Managed Agents
 */

import { useState, useCallback } from 'react'
import { createClientLogger } from '@/lib/client-logger'
import {
  classifySource,
  formatFreshness,
  sourceColor,
  type StateFreshness,
} from '@/lib/galactus-state-source'

const log = createClientLogger('GalactusTrajectoryPanel')

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrajectoryCategory = 'decision' | 'failure' | 'pattern' | 'gotcha'

export interface TrajectoryCandidate {
  id: string
  category: TrajectoryCategory
  description: string
  supporting_run_ids: string[]
  recurrence_count: number
  suggested_action?: string
  promoted?: boolean
  rejected?: boolean
}

type ActionState = 'idle' | 'pending' | 'approved' | 'rejected' | 'deferred' | 'error'

// ─── Badge helpers ────────────────────────────────────────────────────────────

function categoryColor(cat: TrajectoryCategory): string {
  const colors: Record<TrajectoryCategory, string> = {
    decision: '#1f6feb',
    failure: '#da3633',
    pattern: '#6e40c9',
    gotcha: '#e3b341',
  }
  return colors[cat]
}

function categoryTextColor(cat: TrajectoryCategory): string {
  return cat === 'gotcha' ? '#000' : '#fff'
}

function StateSourceBadge({ freshness }: { freshness: StateFreshness | null }) {
  if (!freshness) return null
  return (
    <span style={{ fontSize: '0.72rem', color: '#fff', background: sourceColor(freshness.source), borderRadius: '4px', padding: '2px 7px' }}>
      {freshness.source} · {formatFreshness(freshness)}
    </span>
  )
}

// ─── Single candidate card ────────────────────────────────────────────────────

interface CandidateCardProps {
  candidate: TrajectoryCandidate
  onApprove: (id: string) => Promise<void>
  onReject: (id: string) => Promise<void>
  onDefer: (id: string) => void
}

function CandidateCard({ candidate, onApprove, onReject, onDefer }: CandidateCardProps) {
  const [actionState, setActionState] = useState<ActionState>('idle')
  const [actionError, setActionError] = useState<string | null>(null)

  const handleApprove = useCallback(async () => {
    setActionState('pending')
    try {
      await onApprove(candidate.id)
      setActionState('approved')
    } catch (err) {
      setActionError(String(err))
      setActionState('error')
    }
  }, [candidate.id, onApprove])

  const handleReject = useCallback(async () => {
    setActionState('pending')
    try {
      await onReject(candidate.id)
      setActionState('rejected')
    } catch (err) {
      setActionError(String(err))
      setActionState('error')
    }
  }, [candidate.id, onReject])

  const handleDefer = useCallback(() => {
    onDefer(candidate.id)
    setActionState('deferred')
  }, [candidate.id, onDefer])

  const isDone = actionState === 'approved' || actionState === 'rejected'

  return (
    <div
      style={{
        background: '#0d1117',
        border: '1px solid #30363d',
        borderRadius: '4px',
        padding: '12px',
        marginBottom: '10px',
        opacity: isDone ? 0.5 : 1,
        transition: 'opacity 0.3s',
      }}
    >
      {/* Header: category badge + recurrence */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span
          style={{
            background: categoryColor(candidate.category),
            color: categoryTextColor(candidate.category),
            borderRadius: '4px',
            padding: '2px 7px',
            fontSize: '0.72rem',
            fontWeight: 600,
          }}
        >
          {candidate.category}
        </span>
        {candidate.recurrence_count > 1 && (
          <span style={{ color: '#8b949e', fontSize: '0.78rem' }}>
            seen {candidate.recurrence_count}x
          </span>
        )}
        {actionState === 'deferred' && (
          <span style={{ color: '#e3b341', fontSize: '0.78rem' }}>deferred</span>
        )}
        {actionState === 'approved' && (
          <span style={{ color: '#2ea043', fontSize: '0.78rem' }}>approved ✓</span>
        )}
        {actionState === 'rejected' && (
          <span style={{ color: '#da3633', fontSize: '0.78rem' }}>rejected</span>
        )}
        {actionState === 'error' && (
          <span style={{ color: '#da3633', fontSize: '0.78rem' }}>error: {actionError}</span>
        )}
      </div>

      {/* Description */}
      <p style={{ color: '#c9d1d9', fontSize: '0.85rem', marginBottom: '8px', lineHeight: 1.5 }}>
        {candidate.description}
      </p>

      {/* Supporting run IDs */}
      {candidate.supporting_run_ids.length > 0 && (
        <div style={{ marginBottom: '8px', fontSize: '0.78rem' }}>
          <span style={{ color: '#8b949e' }}>Runs: </span>
          {candidate.supporting_run_ids.map((rid) => (
            <a
              key={rid}
              href={`?run_id=${encodeURIComponent(rid)}`}
              style={{ color: '#58a6ff', marginRight: '6px' }}
            >
              {rid.slice(0, 12)}…
            </a>
          ))}
        </div>
      )}

      {/* Suggested action */}
      {candidate.suggested_action && (
        <div style={{ color: '#8b949e', fontSize: '0.78rem', marginBottom: '8px', fontStyle: 'italic' }}>
          Suggested: {candidate.suggested_action}
        </div>
      )}

      {/* Action buttons */}
      {!isDone && actionState !== 'deferred' && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleApprove}
            disabled={actionState === 'pending'}
            style={{
              background: '#2ea043',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 12px',
              cursor: 'pointer',
              fontSize: '0.82rem',
              opacity: actionState === 'pending' ? 0.7 : 1,
            }}
          >
            Approve
          </button>
          <button
            onClick={handleReject}
            disabled={actionState === 'pending'}
            style={{
              background: '#da3633',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 12px',
              cursor: 'pointer',
              fontSize: '0.82rem',
              opacity: actionState === 'pending' ? 0.7 : 1,
            }}
          >
            Reject
          </button>
          <button
            onClick={handleDefer}
            disabled={actionState === 'pending'}
            style={{
              background: '#21262d',
              color: '#c9d1d9',
              border: '1px solid #30363d',
              borderRadius: '4px',
              padding: '4px 12px',
              cursor: 'pointer',
              fontSize: '0.82rem',
              opacity: actionState === 'pending' ? 0.7 : 1,
            }}
          >
            Defer
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function GalactusTrajectoryPanel() {
  const [candidates, setCandidates] = useState<TrajectoryCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const [freshness, setFreshness] = useState<StateFreshness | null>(null)

  const fetchCandidates = useCallback(async () => {
    const start = new Date()
    setLoading(true)
    try {
      const res = await fetch('/api/mem0/search?query=promoted%3Afalse')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCandidates(data.results ?? [])
      setFreshness({
        source: classifySource(res.headers),
        fetched_at: new Date(),
        lag_ms: Date.now() - start.getTime(),
      })
      setError(null)
      setLastFetched(new Date())
    } catch (err) {
      log.error('fetch trajectory candidates failed', err)
      setCandidates([])
      setFreshness(null)
      setLastFetched(null)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleApprove = useCallback(async (id: string) => {
    const res = await fetch(`/api/mem0/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    // Remove from local list
    setCandidates((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const handleReject = useCallback(async (id: string) => {
    const res = await fetch(`/api/mem0/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    setCandidates((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const handleDefer = useCallback((id: string) => {
    // No state change — UI feedback only (handled inside CandidateCard)
    log.info('deferred candidate', id)
  }, [])

  const pending = candidates.filter((c) => !c.promoted && !c.rejected)
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
          Panel 5: Trajectory Pending Review
          {pending.length > 0 && (
            <span style={{ color: '#6e7681', marginLeft: '8px', fontSize: '0.8rem' }}>
              ({pending.length} pending)
            </span>
          )}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StateSourceBadge freshness={freshness} />
          <button
            onClick={fetchCandidates}
            disabled={loading}
            style={{
              background: '#21262d',
              color: '#c9d1d9',
              border: '1px solid #30363d',
              borderRadius: '4px',
              padding: '4px 10px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.78rem',
            }}
          >
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {lastFetched && (
        <div style={{ color: '#8b949e', fontSize: '0.75rem', marginBottom: '8px' }}>
          Last fetched: {lastFetched.toLocaleTimeString()} — refresh manually to update
        </div>
      )}

      {!lastFetched && !loading && (
        <div style={{ color: '#8b949e', fontStyle: 'italic', fontSize: '0.85rem' }}>
          Click Refresh to load pending trajectory candidates from mem0.
        </div>
      )}

      {error && <div style={{ color: '#da3633', marginBottom: '8px' }}>Error: {error}</div>}

      {pending.length === 0 && lastFetched && !loading && !error && (
        <div style={{ color: '#8b949e', fontStyle: 'italic' }}>
          {isBridgeSnapshot
            ? 'Bridge snapshot stub active; upstream trajectory search is not wired yet.'
            : 'No pending trajectory candidates.'}
        </div>
      )}

      {!error && pending.map((candidate) => (
        <CandidateCard
          key={candidate.id}
          candidate={candidate}
          onApprove={handleApprove}
          onReject={handleReject}
          onDefer={handleDefer}
        />
      ))}
    </div>
  )
}
