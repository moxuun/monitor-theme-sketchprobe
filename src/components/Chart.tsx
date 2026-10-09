import { useMemo, useRef } from "react"

import { axisTop, byteTop, clockFor, quarters, rateAxis, timeTicks } from "@/lib/format"
import type { MetricRow } from "@/lib/history"
import { generator, pathStyle, toPaths } from "@/sketch/core"
import { axes, gridLine } from "@/sketch/shapes"
import { useBoxSize, usePenFactor, useSketchSeed } from "@/sketch/Sketch"

/**
 * `percent` snaps to decimal decades, which is right for a utilisation axis and
 * wrong for bytes -- see `byteTop`.
 */
export type Axis =
  | { kind: "linear"; unit: "percent" | "bytes"; floor: number; cap: number }
  | { kind: "log" }

export type Series = {
  pick: (row: MetricRow) => number | undefined
  color: string
  /** Shade the area beneath this line. Only one series per chart should. */
  fill?: boolean
}

type Scale = {
  ticks: number[]
  /** A value to a y coordinate inside the plot area, measured from its top. */
  y: (v: number) => number
}

function linearScale(top: number, height: number): Scale {
  const safe = top > 0 ? top : 1
  return { ticks: quarters(top), y: (v) => height - (Math.min(v, safe) / safe) * height }
}

function logScale(domain: [number, number], ticks: number[], height: number): Scale {
  const [lo, hi] = domain
  const span = Math.log(hi) - Math.log(lo)
  return { ticks, y: (v) => height - ((Math.log(Math.min(hi, Math.max(lo, v))) - Math.log(lo)) / span) * height }
}

const PAD = { left: 58, right: 10, top: 10, bottom: 20 }

/**
 * One resource over time, drawn as an instrument reading on hand-drawn axes.
 *
 * The split is the whole point of the theme: the axes and gridlines are rough.js
 * shapes, because they are structure, and the series are plain SVG paths,
 * because they are data. A hand-drawn series line is charming for six points and
 * unreadable for 1,440.
 */
export function ResourceChart({
  rows,
  series,
  axis,
  format,
  hours,
  height = 220,
}: {
  rows: MetricRow[]
  series: Series[]
  axis: Axis
  format: (v: number) => string
  /** The window the rows cover, which decides the time format on the axis. */
  hours: number
  /** Plot height. The detail page stacks its four panels, so each one is as wide
   * as the page; 150 was sized for a half-width panel and left a band. */
  height?: number
}) {
  const [ref, [w, h]] = useBoxSize<HTMLDivElement>()
  const factor = usePenFactor()
  const seed = useSketchSeed()
  // The caller writes `series` and `format` inline, so both are new on every
  // render -- and this page re-renders every two seconds whether or not the
  // window changed. Read through a ref, they stay out of the dependencies.
  const latest = useRef({ series, format })
  latest.current = { series, format }
  const kind = axis.kind
  const unit = axis.kind === "linear" ? axis.unit : "bytes"
  const floor = axis.kind === "linear" ? axis.floor : 0
  const cap = axis.kind === "linear" ? axis.cap : 0

  const plot = useMemo(() => {
    const iw = w - PAD.left - PAD.right
    const ih = h - PAD.top - PAD.bottom
    if (iw <= 12 || ih <= 12 || rows.length < 2) return null

    const finite = (v: number | undefined): v is number => v !== undefined && Number.isFinite(v)
    // One axis across every series, so a download line and an upload line are
    // read against the same scale.
    const values: number[] = []
    for (const s of latest.current.series) {
      for (const r of rows) {
        const v = s.pick(r)
        if (finite(v)) values.push(v)
      }
    }
    if (!values.length) return null

    const scale: Scale =
      kind === "log"
        ? (() => {
            const { domain, ticks } = rateAxis(Math.max(1, Math.min(...values)), Math.max(...values))
            return logScale(domain, ticks, ih)
          })()
        : linearScale((unit === "bytes" ? byteTop : axisTop)(Math.max(...values), floor, cap), ih)

    const from = rows[0].ts * 1000
    const to = rows[rows.length - 1].ts * 1000
    const span = Math.max(1, to - from)
    const x = (ms: number) => ((ms - from) / span) * iw

    // Break the line where the samples stop. A node offline for a day leaves a
    // day of missing buckets, and drawing straight across it reads as a day of
    // steady load. The usual spacing is the median gap rather than the hub's
    // bucket, since an agent reporting every few minutes leaves sparse rows.
    const gaps = rows.slice(1).map((r, i) => r.ts - rows[i].ts).sort((a, b) => a - b)
    const usual = gaps[(gaps.length - 1) >> 1] ?? 0

    const drawn = latest.current.series.map((s) => {
      const lines: string[] = []
      const areas: string[] = []
      let run: string[] = []
      let first = 0
      let last = 0
      const flush = () => {
        if (run.length > 1) {
          lines.push(`M${run.join("L")}`)
          areas.push(`M${run[0]}L${run.slice(1).join("L")}L${last},${ih}L${first},${ih}Z`)
        }
        run = []
      }
      rows.forEach((r, i) => {
        const v = s.pick(r)
        if (!finite(v) || (i > 0 && r.ts - rows[i - 1].ts > 2 * usual)) {
          flush()
          return
        }
        const px = x(r.ts * 1000)
        if (!run.length) first = px
        last = px
        run.push(`${px.toFixed(1)},${scale.y(v).toFixed(1)}`)
      })
      flush()
      return { lines, areas }
    })

    const rough = [
      ...axes(generator, iw, ih, { factor, seed }),
      ...scale.ticks.map((t, i) => gridLine(generator, iw, scale.y(t), { factor, seed: seed + i * 7 })),
    ].flatMap(toPaths)

    const clock = clockFor(hours)
    // The count is a cap, not a target: timeTicks takes the smallest round step
    // that fits under it. Six labels sit comfortably across a desktop card but
    // collide on a phone-width one, where the plot is ~250 px and each "13:00"
    // is 30 px wide, so the cap follows the width actually available.
    const xTicks = timeTicks(from, to, Math.max(2, Math.min(6, Math.floor(iw / 72))))
    return {
      ih,
      rough,
      drawn,
      yLabels: scale.ticks.map((t) => ({ t, y: scale.y(t) })),
      xLabels: xTicks.map((t) => ({ t, x: x(t) })),
      clock,
    }
    // `axis` and `series` are compared through what they mean rather than by
    // identity: the caller writes both inline, so the objects are new every
    // render. The pick functions come from the ref.
  }, [rows, w, h, kind, unit, floor, cap, factor, seed, hours])

  return (
    <div className="chart" ref={ref} style={{ height }}>
      <svg viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        {plot ? (
          <>
            <g transform={`translate(${PAD.left} ${PAD.top})`}>
              {plot.rough.map((p, i) => (
                <path key={i} d={p.d} style={pathStyle(p)} />
              ))}
              {plot.drawn.map((d, si) => (
                <g key={si}>
                  {series[si]?.fill
                    ? d.areas.map((a, i) => <path key={i} d={a} fill={series[si].color} opacity={0.13} />)
                    : null}
                  {d.lines.map((line, i) => (
                    <path
                      key={i}
                      d={line}
                      fill="none"
                      stroke={series[si]?.color}
                      strokeWidth={1.7}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  ))}
                </g>
              ))}
            </g>
            {plot.yLabels.map(({ t, y }, i) => (
              <text key={i} x={PAD.left - 7} y={PAD.top + y} textAnchor="end" dominantBaseline="middle">
                {latest.current.format(t)}
              </text>
            ))}
            {plot.xLabels.map(({ t, x }, i) => (
              <text
                key={i}
                x={PAD.left + x}
                y={h - 5}
                textAnchor={i === 0 ? "start" : i === plot.xLabels.length - 1 ? "end" : "middle"}
              >
                {plot.clock(t)}
              </text>
            ))}
          </>
        ) : null}
      </svg>
    </div>
  )
}
