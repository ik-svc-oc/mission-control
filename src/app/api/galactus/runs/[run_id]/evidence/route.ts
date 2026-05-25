/**
 * /api/galactus/runs/[run_id]/evidence
 *
 * Returns the evidence ledger for a Galactus run. Source-of-truth lives in
 * the Managed Agents API; this route is currently a bridge-snapshot stub
 * that returns an empty ledger so the Evidence Panel renders without errors
 * during development.
 *
 * TODO(p3-2): Proxy through to `${MANAGED_AGENTS_BASE}/runs/{run_id}/evidence`
 *             and propagate the upstream `X-State-Source` header verbatim.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

const log = logger.child({ name: 'api/galactus/runs/evidence' })

interface EvidenceEntry {
  id: string
  kind: 'test_result' | 'diff' | 'artifact' | 'screenshot'
  verification_status: 'machine_verified' | 'human_verified' | 'self_reported'
  storage_ref: string
  content_hash: string
  produced_at: string
  scope_epoch: number
  payload?: Record<string, unknown>
}

interface EvidenceResponse {
  entries: EvidenceEntry[]
  scope_epoch: number
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ run_id: string }> },
) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { run_id } = await params
  log.info({ run_id }, 'evidence ledger requested (bridge snapshot stub)')

  const body: EvidenceResponse = { entries: [], scope_epoch: 1 }
  return NextResponse.json(body, {
    headers: { 'X-State-Source': 'bridge snapshot' },
  })
}
