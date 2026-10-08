import { useEffect, useState } from "react"

import { api } from "@/lib/api"

/** One bucket of a node's history, on the hub's own grid. */
export type MetricRow = {
  /** Seconds since the epoch. */
  ts: number
  cpu: number
  cpu_max?: number
  mem_used: number
  disk_used: number
  net_rx: number
  net_tx: number
  net_rx_max?: number
  net_tx_max?: number
  /** How many minutes this bucket covers, on an hourly tier. */
  minutes?: number
}

/**
 * A node's history for the last `hours`.
 *
 * The window is asked for as a bucket count rather than a resolution: the hub
 * narrows it to the finest tier that fits, so a month comes back hourly and an
 * hour comes back per minute without the theme knowing which tier it is talking
 * to.
 */
export function useMetrics(nodeId: number, hours: number) {
  const [rows, setRows] = useState<MetricRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Bumped by `retry`. The same window asked for twice is the same effect, so
  // without this the request would not be made again.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    setRows(null)
    setError(null)
    // One point per device pixel the chart can draw. The hub buckets the window to
    // whatever count is asked for, so asking for more than the plot is wide would
    // be read, shipped and never drawn; asking for fewer would leave the line
    // visibly stepped on a dense screen.
    const points = Math.round(innerWidth * (devicePixelRatio || 1))
    api<{ metrics: MetricRow[] }>(`/nodes/${nodeId}/metrics?series=metrics&hours=${hours}&points=${points}`)
      .then((d) => {
        if (live) setRows(d.metrics ?? [])
      })
      .catch((e: Error) => {
        if (live) setError(e.message)
      })
    return () => {
      live = false
    }
  }, [nodeId, hours, attempt])

  return { rows, error, retry: () => setAttempt((n) => n + 1) }
}
