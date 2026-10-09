import { useMemo, useState } from "react"

import { clockFor } from "@/lib/format"
import type { LatencySample } from "@/lib/latency"
import { useBoxSize } from "@/sketch/Sketch"

/** The rows are one hour of minute samples, so a reading is a clock time. */
const CLOCK = clockFor(1)

/** The line is straight, so the colour is all it has to say. */
const TREND_COLOR = { flat: "var(--muted)", up: "var(--warn)", down: "var(--accent)" } as const
type Trend = keyof typeof TREND_COLOR

/** The hour in ten-minute windows, each read against the window twenty minutes
    back: a drift is not visible between neighbours, only over twenty minutes. */
const WINDOWS = 6
const BACK = 2

type Run = { trend: Trend; from: number; to: number }

/**
 * The hour behind a probe's latest reading, drawn in the space the row leaves
 * between the probe's name and its value.
 *
 * The line is straight, because a row this short cannot show the shape of an
 * hour -- only its colour can. A stretch is amber while the probe is getting
 * slower, blue while it is getting faster, grey while it holds, and it is
 * measured in ten-minute windows against the window twenty minutes back, since
 * a drift over twenty minutes is what a reader can act on.
 *
 * What a move has to stand out from is the probe's own minute-to-minute wobble,
 * so a noisy line needs a bigger move to say anything; a twentieth of the
 * probe's own latency is the floor, since a line that wobbles by half a
 * millisecond is quiet whatever it is. A minute the probe did not answer is not
 * a hole in the line -- the row beside it already says when it last timed out --
 * though it counts for nothing in the means either. Pointing at the line names
 * the reading under the cursor.
 */
export function LatencySpark({ samples }: { samples: LatencySample[] }) {
  const [ref, [w, h]] = useBoxSize<HTMLDivElement>()
  const [at, setAt] = useState<number | null>(null)

  const plot = useMemo(() => {
    const values: number[] = []
    for (const sample of samples) if (sample.value !== null) values.push(sample.value)
    if (w < 40 || h < 12 || values.length < 2) return null

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    // How far the line moves in a minute, which is what a real move has to
    // stand out from: the average step, not the average sample.
    let wobble = 0
    let steps = 0
    for (let i = 1; i < samples.length; i++) {
      const before = samples[i - 1].value
      const now = samples[i].value
      if (before === null || now === null) continue
      wobble += Math.abs(now - before)
      steps++
    }
    const dead = Math.max(mean / 25, steps ? (wobble / steps) * 1.5 : 0)

    // The hour in windows, the last carrying whatever the hour's length left
    // over. A window the probe did not answer at all has no mean to read.
    const per = Math.ceil(samples.length / WINDOWS)
    const windows: (number | null)[] = []
    for (let from = 0; from < samples.length; from += per) {
      let sum = 0
      let count = 0
      for (let i = from; i < Math.min(from + per, samples.length); i++) {
        const value = samples[i].value
        if (value === null) continue
        sum += value
        count++
      }
      windows.push(count ? sum / count : null)
    }

    const trend = (i: number): Trend => {
      const k = Math.floor(i / per)
      const now = windows[k]
      const back = windows[Math.max(0, k - BACK)] ?? now
      if (now === null || back === null) return "flat"
      if (now - back > dead) return "up"
      if (back - now > dead) return "down"
      return "flat"
    }

    // One straight piece per stretch of colour; the pieces meet end to end, so
    // the hour reads as a single line however many colours it is spliced from.
    const runs: Run[] = []
    for (let i = 0; i < samples.length; i++) {
      const colour = trend(i)
      const last = runs[runs.length - 1]
      if (last && last.trend === colour) last.to = i
      else runs.push({ trend: colour, from: i, to: i })
    }

    const step = samples.length > 1 ? w / (samples.length - 1) : 0
    return { step, y: h / 2 - 2, runs }
  }, [samples, w, h])

  const readout = useMemo(() => {
    if (!plot || at === null) return null
    const sample = samples[at]
    if (!sample || sample.value === null) return null
    const run = plot.runs.find((piece) => piece.from <= at && at <= piece.to)
    if (!run) return null
    const x = at * plot.step
    // Keep the reading inside the row: at the ends of the hour it has nowhere
    // else to go, so the anchor flips rather than the text running off.
    const anchor: "start" | "end" = x > w / 2 ? "end" : "start"
    return {
      x,
      y: plot.y,
      text: `${CLOCK(sample.ts * 1000)} · ${Math.round(sample.value)} ms`,
      textX: anchor === "end" ? x - 5 : x + 5,
      readoutY: h - 2,
      anchor,
      colour: TREND_COLOR[run.trend],
    }
  }, [plot, at, samples, w])

  return (
    <div
      className="latency-spark"
      ref={ref}
      onPointerMove={(event) => {
        if (!plot) return
        const box = event.currentTarget.getBoundingClientRect()
        setAt(Math.max(0, Math.min(samples.length - 1, Math.round((event.clientX - box.left) / plot.step))))
      }}
      onPointerLeave={() => setAt(null)}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="presentation">
        {plot?.runs.map((run) => (
          <line
            key={`${run.from}-${run.to}`}
            x1={run.from * plot.step}
            y1={plot.y}
            x2={run.to * plot.step}
            y2={plot.y}
            stroke={TREND_COLOR[run.trend]}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}
        {readout ? (
          <>
            <circle cx={readout.x} cy={readout.y} r={3} fill={readout.colour} stroke="var(--card)" strokeWidth={1} />
            <text
              className="latency-spark-readout"
              x={readout.textX}
              y={readout.readoutY}
              textAnchor={readout.anchor}
            >
              {readout.text}
            </text>
          </>
        ) : null}
      </svg>
    </div>
  )
}
