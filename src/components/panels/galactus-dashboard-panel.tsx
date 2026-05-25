'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { GalactusActiveLanesPanel } from '@/components/GalactusActiveLanesPanel'
import { GalactusApprovalsQueuePanel } from '@/components/GalactusApprovalsQueuePanel'
import { GalactusBudgetCostPanel } from '@/components/GalactusBudgetCostPanel'
import { GalactusEvidencePanel } from '@/components/GalactusEvidencePanel'
import { GalactusRunOverviewPanel } from '@/components/GalactusRunOverviewPanel'
import { GalactusTrajectoryPanel } from '@/components/GalactusTrajectoryPanel'

const DEFAULT_RUN_ID = 'local-dev'

export function GalactusDashboardPanel() {
  const searchParams = useSearchParams()
  const initialRunId = searchParams.get('run_id')?.trim() || DEFAULT_RUN_ID
  const [runId, setRunId] = useState(initialRunId)
  const activeRunId = useMemo(() => runId.trim() || DEFAULT_RUN_ID, [runId])

  return (
    <div className="m-4 space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Galactus Dashboard</h2>
            <p className="text-xs text-muted-foreground">
              Bridge panels for run state, evidence, approvals, trajectory review, and budget telemetry.
            </p>
          </div>
          <div className="flex flex-col gap-1 sm:min-w-80">
            <label htmlFor="galactus-run-id" className="text-xs font-medium text-muted-foreground">
              Run ID
            </label>
            <div className="flex gap-2">
              <input
                id="galactus-run-id"
                value={runId}
                onChange={(event) => setRunId(event.target.value)}
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
                placeholder={DEFAULT_RUN_ID}
              />
              <Button size="sm" variant="outline" onClick={() => setRunId(DEFAULT_RUN_ID)}>
                Reset
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <section className="xl:col-span-5">
          <GalactusRunOverviewPanel runId={activeRunId} />
        </section>
        <section className="xl:col-span-7">
          <GalactusEvidencePanel runId={activeRunId} />
        </section>
        <section className="xl:col-span-6">
          <GalactusActiveLanesPanel runId={activeRunId} />
        </section>
        <section className="xl:col-span-6">
          <GalactusApprovalsQueuePanel runId={activeRunId} />
        </section>
        <section className="xl:col-span-5">
          <GalactusTrajectoryPanel />
        </section>
        <section className="xl:col-span-7">
          <GalactusBudgetCostPanel runId={activeRunId} />
        </section>
      </div>
    </div>
  )
}
