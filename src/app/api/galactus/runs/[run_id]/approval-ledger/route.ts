/**
 * /api/galactus/runs/[run_id]/approval-ledger
 *
 * Returns pending approvals for a Galactus run. Source-of-truth lives in
 * the Managed Agents API; this route is a bridge-snapshot stub returning
 * an empty list so the Approvals Queue panel renders without errors.
 *
 * Approvals themselves are NEVER actioned through Mission Control —
 * approval happens in the GitHub PR UI. This endpoint is read-only.
 *
 * TODO(p3-2): Proxy through to
 *             `${MANAGED_AGENTS_BASE}/runs/{run_id}/approval-ledger?status=pending`
 *             and propagate the upstream `X-State-Source` header verbatim.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

const log = logger.child({ name: 'api/galactus/runs/approval-ledger' })

interface PendingApproval {
  id: string
  approval_type: 'scope' | 'contract_lock' | 'deploy' | 'prod_release'
  required_approver: string
  pr_url?: string
  waiting_since: string
  gate_predicate_id: string
}

interface ApprovalLedgerResponse {
  approvals: PendingApproval[]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ run_id: string }> },
) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { run_id } = await params
  log.info({ run_id }, 'approval-ledger requested (bridge snapshot stub)')

  const body: ApprovalLedgerResponse = { approvals: [] }
  return NextResponse.json(body, {
    headers: { 'X-State-Source': 'bridge snapshot' },
  })
}
