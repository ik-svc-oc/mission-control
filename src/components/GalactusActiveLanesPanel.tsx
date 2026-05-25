'use client'

/**
 * GalactusActiveLanesPanel — Panel 3: Active Lanes
 *
 * Authoritative spec: MC-DASHBOARD-SPEC.md §Panel 3
 *
 * Rules:
 *  - Read-only surface; reads from Managed Agents API via /api/galactus/runs/{run_id}/lanes
 *  - Refresh every 15s
 *  - Sort active first, then blocked, then complete
 *  - Lane row turns red if last_updated > 30 min (visual cue for wedged lane)
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

const log = createClientLogger('GalactusActiveLanesPanel')

// ─── Types ────────────────────────────────────────────────────────────────────

export type LaneStatus =
  | 'in_progress'
  | 'complete'
  | 'blocked'
  | 'soft_block'
  | 'hard_block'
  | 'needs_operator'
  | 'timed_out'
  | 'abandoned'

export type LaneRole = 'triager' | 'author' | 'reviewer' | 'orchestrator'

export interface Lane {
  lane_id: string
  worktree_id?: string
  role: LaneRole
  current_slice_goal: string
  last_updated: string // ISO-8601
  status: LaneStatus
  model?: string
}

interface LanesResponse {
  lanes: Lane[]
  scope_epoch?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STALE_MS = 30 * 60 * 1000

function statusColor(status: LaneStatus): string {
  const colors: Record<LaneStatus, string> = {
    in_progress: '#1f6feb',
    complete: '#2ea043',
    blocked: '#da3633',
    soft_block: '#e3b341',
    hard_block: '#da3633',
    needs_operator: '#e07b2e',
    timed_out: '#9e6a03',
    abandoned: '#6e7681',
  }
  return colors[status]
}

function sortGroup(status: LaneStatus): number {
  if (status === 'in_progress' || status === 'needs_operator') return 0
  if (status === 'blocked' || status === 'soft_block' || status === 'hard_block' || status === 'timed_out') return 1
  return 2 // complete, abandoned
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return `${Math.round(ms / 1_000)}s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`
  return new Date(iso).toLocaleDateString()
}

function isStaleLane(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() > STALE_MS
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
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

function StatusBadge({ status }: { status: LaneStatus }) {
  return (
    <span
      style={{
        background: statusColor(status),
        color: '#fff',
        borderRadius: '4px',
        padding: '2px 7px',
        fontSize: '0.72rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {status.replace(/_/g, ' ').toUpperCase()}
    </span>
  )
}

function LaneRow({ lane }: { lane: Lane }) {
  const stale = isStaleLane(lane.last_updated)
  const fullGoal = lane.current_slice_goal
  const displayGoal = truncate(fullGoal, 80)
  return (
    <div
      style={{
        borderBottom: '1px solid #21262d',
        padding: '8px 0',
        display: 'grid',
        gridTemplateColumns: '1.1fr 0.8fr 2.2fr 0.9fr 0.9fr',
        gap: '10px',
        alignItems: 'center',
        fontSize: '0.82rem',
        fontFamily: "'SF Mono', 'Fira Code', monospace",
      }}
    >
      <code
        title={lane.worktree_id ? `worktree: ${lane.worktree_id}` : undefined}
        style={{
          color: '#c9d1d9',
          background: '#010409',
          padding: '1px 4px',
          borderRadius: '3px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {lane.lane_id}
      </code>
      <span style={{ color: '#8b949e' }}>{lane.role}</span>
      <span title={fullGoal} style={{ color: '#c9d1d9' }}>
        {displayGoal}
      </span>
      <span
        title={new Date(lane.last_updated).toLocaleString()}
        style={{ color: stale ? '#da3633' : '#8b949e' }}
      >
        {relativeTime(lane.last_updated)}
      </span>
      <StatusBadge status={lane.status} />
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface GalactusActiveLanesPanelProps {
  runId: string
  /** Base URL for Managed Agents API — defaults to '' (same origin) */
  apiBase?: string
}

export function GalactusActiveLanesPanel({ runId, apiBase = '' }: GalactusActiveLanesPanelProps) {
  const [lanes, setLanes] = useState<Lane[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [freshness, setFreshness] = useState<StateFreshness | null>(null)

  const fetchLanes = useCallback(async () => {
    const start = new Date()
    try {
      const res = await fetch(`${apiBase}/api/galactus/runs/${encodeURIComponent(runId)}/lanes`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as LanesResponse
      const sorted = [...(data.lanes ?? [])].sort((a, b) => {
        const g = sortGroup(a.status) - sortGroup(b.status)
        if (g !== 0) return g
        return new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
      })
      setLanes(sorted)
      setFreshness({
        source: classifySource(res.headers),
        fetched_at: new Date(),
        lag_ms: Date.now() - start.getTime(),
      })
      setError(null)
    } catch (err) {
      log.error('fetch lanes failed', err)
      setLanes([])
      setFreshness(null)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [runId, apiBase])

  useEffect(() => {
    setLanes([])
    setFreshness(null)
    setError(null)
    setLoading(true)
    void fetchLanes()
    const interval = setInterval(fetchLanes, 15_000)
    return () => clearInterval(interval)
  }, [fetchLanes])

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
          Panel 3: Active Lanes
          {lanes.length > 0 && (
            <span style={{ color: '#6e7681', marginLeft: '8px', fontSize: '0.8rem' }}>
              ({lanes.length} lane{lanes.length === 1 ? '' : 's'})
            </span>
          )}
        </h3>
        <StateSourceBadge freshness={freshness} />
      </div>

      {/* Column header */}
      {!error && lanes.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 0.8fr 2.2fr 0.9fr 0.9fr',
            gap: '10px',
            color: '#6e7681',
            fontSize: '0.72rem',
            textTransform: 'uppercase',
            paddingBottom: '6px',
            borderBottom: '1px solid #30363d',
          }}
        >
          <span>Lane</span>
          <span>Role</span>
          <span>Slice goal</span>
          <span>Updated</span>
          <span>Status</span>
        </div>
      )}

      {/* Body */}
      {loading && <div style={{ color: '#8b949e' }}>Loading lanes…</div>}
      {error && <div style={{ color: '#da3633' }}>Error: {error}</div>}
      {!loading && !error && lanes.length === 0 && (
        <div style={{ color: '#8b949e', fontStyle: 'italic' }}>
          {isBridgeSnapshot
            ? 'Bridge snapshot stub active; upstream lane roster is not wired yet.'
            : 'No lanes active for this run.'}
        </div>
      )}
      {!error && lanes.map((lane) => (
        <LaneRow key={lane.lane_id} lane={lane} />
      ))}
    </div>
  )
}
