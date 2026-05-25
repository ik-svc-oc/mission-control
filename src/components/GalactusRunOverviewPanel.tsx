'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { createClientLogger } from '@/lib/client-logger'
import {
  classifySource,
  sourceColor,
  formatFreshness,
  type StateFreshness,
} from '@/lib/galactus-state-source'
import type { AgentRun, RunStatus, RunOutcome } from '@/lib/runs'

const log = createClientLogger('GalactusRunOverviewPanel')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${rem}s`
}

function statusColor(status: RunStatus): string {
  switch (status) {
    case 'running':   return '#2ea043'
    case 'completed': return '#1f6feb'
    case 'failed':    return '#da3633'
    case 'cancelled': return '#6e7681'
    case 'timeout':   return '#e3b341'
    default:          return '#8b949e'
  }
}

function outcomeColor(outcome: RunOutcome): string {
  switch (outcome) {
    case 'success':   return '#2ea043'
    case 'failed':    return '#da3633'
    case 'partial':   return '#e3b341'
    case 'abandoned': return '#6e7681'
    default:          return '#8b949e'
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

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        background: color,
        color: '#fff',
        borderRadius: '4px',
        padding: '2px 7px',
        fontSize: '0.72rem',
        fontWeight: 600,
        display: 'inline-block',
      }}
    >
      {label.toUpperCase()}
    </span>
  )
}

interface FieldRowProps {
  label: string
  value: ReactNode
}

function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        padding: '6px 0',
        borderBottom: '1px solid #21262d',
        fontSize: '0.82rem',
        fontFamily: "'SF Mono', 'Fira Code', monospace",
      }}
    >
      <span style={{ color: '#8b949e', minWidth: '120px', flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#c9d1d9' }}>{value}</span>
    </div>
  )
}

function CodeSpan({ children }: { children: string }) {
  return (
    <code
      style={{
        color: '#c9d1d9',
        background: '#010409',
        padding: '1px 4px',
        borderRadius: '3px',
      }}
    >
      {children}
    </code>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface GalactusRunOverviewPanelProps {
  runId: string
  /** Base URL for Managed Agents API — defaults to empty (same origin) */
  apiBase?: string
}

export function GalactusRunOverviewPanel({ runId, apiBase = '' }: GalactusRunOverviewPanelProps) {
  const [run, setRun] = useState<AgentRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [freshness, setFreshness] = useState<StateFreshness | null>(null)

  const fetchRun = useCallback(async () => {
    const start = new Date()
    try {
      const res = await fetch(`${apiBase}/api/v1/runs/${encodeURIComponent(runId)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: AgentRun = await res.json() as AgentRun
      setRun(data)
      setFreshness({
        source: classifySource(res.headers),
        fetched_at: new Date(),
        lag_ms: Date.now() - start.getTime(),
      })
      setError(null)
    } catch (err) {
      log.error({ err }, 'fetch run overview failed')
      setRun(null)
      setFreshness(null)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [runId, apiBase])

  useEffect(() => {
    setRun(null)
    setFreshness(null)
    setError(null)
    setLoading(true)
    void fetchRun()
    const interval = setInterval(fetchRun, 1_000)
    return () => clearInterval(interval)
  }, [fetchRun])

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
          Panel 1: Run Overview
        </h3>
        <StateSourceBadge freshness={freshness} />
      </div>

      {/* Loading / error / empty states */}
      {loading && <div style={{ color: '#8b949e' }}>Loading run…</div>}
      {error && <div style={{ color: '#da3633' }}>Error: {error}</div>}
      {!loading && !error && !run && (
        <div style={{ color: '#8b949e', fontStyle: 'italic' }}>Run not found.</div>
      )}

      {/* Run fields */}
      {!error && run && (
        <div>
          <FieldRow label="Run ID" value={<CodeSpan>{run.id}</CodeSpan>} />
          {run.agent_name && <FieldRow label="Agent" value={run.agent_name} />}
          <FieldRow
            label="Status"
            value={<StatusBadge label={run.status} color={statusColor(run.status)} />}
          />
          {run.outcome && (
            <FieldRow
              label="Outcome"
              value={<StatusBadge label={run.outcome} color={outcomeColor(run.outcome)} />}
            />
          )}
          {run.model && <FieldRow label="Model" value={run.model} />}
          {run.provider && <FieldRow label="Provider" value={run.provider} />}
          {run.trigger && <FieldRow label="Trigger" value={run.trigger} />}
          <FieldRow label="Started" value={relativeTime(run.started_at)} />
          {run.ended_at && <FieldRow label="Ended" value={relativeTime(run.ended_at)} />}
          {run.duration_ms != null && (
            <FieldRow label="Duration" value={formatDuration(run.duration_ms)} />
          )}
          <FieldRow label="Steps" value={String(run.steps.length)} />
          {run.cost.cost_usd != null && (
            <FieldRow label="Cost (USD)" value={`$${run.cost.cost_usd.toFixed(4)}`} />
          )}
          <FieldRow
            label="Tokens"
            value={`${run.cost.input_tokens.toLocaleString()} in / ${run.cost.output_tokens.toLocaleString()} out`}
          />
          {run.git_branch && <FieldRow label="Branch" value={run.git_branch} />}
          {run.git_commit && (
            <FieldRow label="Commit" value={<CodeSpan>{run.git_commit.slice(0, 8)}</CodeSpan>} />
          )}
          {run.workspace_id && <FieldRow label="Workspace" value={run.workspace_id} />}
          {run.task_id && <FieldRow label="Task ID" value={<CodeSpan>{run.task_id}</CodeSpan>} />}
          {run.error && (
            <div
              style={{
                marginTop: '10px',
                padding: '8px',
                background: '#1c0a0a',
                border: '1px solid #da3633',
                borderRadius: '4px',
                color: '#da3633',
                fontSize: '0.8rem',
              }}
            >
              <strong>Error:</strong> {run.error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
