import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GalactusTrajectoryPanel } from '@/components/GalactusTrajectoryPanel'

vi.mock('@/lib/client-logger', () => ({
  createClientLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

function response(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      'X-State-Source': 'bridge snapshot',
      ...init.headers,
    },
  })
}

describe('GalactusTrajectoryPanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('labels mem0 search results as a bridge snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ results: [], bridge_snapshot: true })))

    render(<GalactusTrajectoryPanel />)
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))

    expect(await screen.findAllByText(/bridge snapshot/i)).toHaveLength(2)
    expect(screen.getByText(/upstream trajectory search is not wired yet/i)).toBeInTheDocument()
  })

  it('clears stale trajectory candidates after a failed refresh', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({
        results: [{
          id: 'candidate-1',
          category: 'pattern',
          description: 'Persist durable orchestration pattern',
          supporting_run_ids: [],
          recurrence_count: 2,
        }],
        bridge_snapshot: true,
      }))
      .mockResolvedValueOnce(response({ error: 'failed' }, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<GalactusTrajectoryPanel />)

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
    expect(await screen.findByText('Persist durable orchestration pattern')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))

    await waitFor(() => {
      expect(screen.getByText(/HTTP 500/)).toBeInTheDocument()
    })
    expect(screen.queryByText('Persist durable orchestration pattern')).not.toBeInTheDocument()
    expect(screen.queryByText(/last fetched/i)).not.toBeInTheDocument()
  })
})
