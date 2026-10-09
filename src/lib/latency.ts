import { useEffect, useState } from "react"

import { api } from "@/lib/api"

type Ping = { ts: number; task_id: number; latency: number | null }
type PingHistory = { ping?: Ping[]; probes?: Record<string, string> }
export type LatencySample = { ts: number; value: number | null }
export type Latency = {
  id: number
  name: string
  /** The newest sample in the window, which is the one the row prints. */
  ts: number
  value: number | null
  /** The whole window, oldest first, so the row can draw how it got here. */
  series: LatencySample[]
}
export type LatencyResult = { lines: Latency[]; error: boolean }

// Keep the request limit across group changes and React effect remounts too.
const lanes: Promise<void>[] = [Promise.resolve(), Promise.resolve(), Promise.resolve()]
let nextLane = 0

/** Minute-level probe samples from the hub, not a browser speed test. */
export function useLatencies(nodeIds: number[]) {
  const key = nodeIds.join(",")
  const [results, setResults] = useState<Record<number, LatencyResult>>({})

  useEffect(() => {
    const ids = key ? key.split(",").map(Number) : []
    let live = true
    let generation = 0
    const pending = new Set<number>()
    setResults({})

    const enqueue = (id: number) => {
        if (!live || document.hidden || pending.has(id)) return
        pending.add(id)
        const ticket = generation
        const lane = nextLane++ % lanes.length
        lanes[lane] = lanes[lane].then(async () => {
          try {
            if (!live || document.hidden || ticket !== generation) return
            const data = await api<PingHistory>(`/nodes/${id}/metrics?series=ping&hours=1&points=60`)
            const history = new Map<number, LatencySample[]>()
            for (const point of data.ping ?? []) {
              if (!Number.isFinite(point.task_id) || !Number.isFinite(point.ts)) continue
              if (point.latency !== null && (!Number.isFinite(point.latency) || point.latency < 0)) continue
              const samples = history.get(point.task_id)
              const sample = { ts: point.ts, value: point.latency }
              if (samples) samples.push(sample)
              else history.set(point.task_id, [sample])
            }
            const lines = [...history.entries()].map(([taskId, samples]) => {
              // Oldest first: the row draws left to right, and the newest sample
              // is the one it prints beside the line.
              samples.sort((a, b) => a.ts - b.ts)
              const newest = samples[samples.length - 1]
              return {
                id: taskId,
                name: data.probes?.[String(taskId)] ?? `探测 ${taskId}`,
                ts: newest.ts,
                value: newest.value,
                series: samples,
              }
            })
            if (live && !document.hidden && ticket === generation) {
              setResults((old) => ({ ...old, [id]: { lines, error: false } }))
            }
          } catch {
            if (live && !document.hidden && ticket === generation) {
              setResults((old) => ({ ...old, [id]: { lines: [], error: true } }))
            }
          } finally {
            pending.delete(id)
            // A request begun before the tab was hidden must not populate it
            // after resuming; replace that discarded request with a fresh one.
            if (live && !document.hidden && ticket !== generation) enqueue(id)
          }
        })
    }
    const refresh = () => ids.forEach(enqueue)
    const visibility = () => {
      generation++
      setResults({})
      refresh()
    }
    refresh()
    const timer = window.setInterval(refresh, 60_000)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      live = false
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [key])

  return results
}
