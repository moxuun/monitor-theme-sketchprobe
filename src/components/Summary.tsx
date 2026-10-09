import { speedHistory, type Node } from "@/lib/api"
import { bytes, rate } from "@/lib/format"
import { loadColor } from "@/lib/derive"
import { Icon } from "@/components/Icon"
import { SketchBox, SketchSvg, useBoxSize, usePenFactor, useSketchSeed } from "@/sketch/Sketch"
import { chip, rack, speedGauge, transfer } from "@/sketch/shapes"

/** Two lines of throughput over the last two minutes, one point per push. */
function Spark({ series }: { series: { rx: number; tx: number }[] }) {
  const [ref, [w, h]] = useBoxSize<HTMLDivElement>()
  // Deliberately not memoised: the series array is mutated in place by the
  // stream, so its identity never changes and a dependency on it would never
  // fire. Sixty points twice over is not worth the bookkeeping.
  const path = (pick: (s: { rx: number; tx: number }) => number) => {
    if (w <= 0 || h <= 0 || series.length < 2) return null
    const peak = Math.max(1, ...series.map((s) => Math.max(s.rx, s.tx)))
    const step = w / (series.length - 1)
    return series
      .map((s, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)} ${(h - 2 - (pick(s) / peak) * (h - 6)).toFixed(1)}`)
      .join(" ")
  }
  const rx = path((s) => s.rx)
  const tx = path((s) => s.tx)
  return (
    <div className="spark" ref={ref}>
      {rx ? (
        <svg viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
          <path d={tx ?? ""} fill="none" stroke="var(--plum)" strokeWidth={1.4} strokeLinejoin="round" />
          <path d={rx} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinejoin="round" />
        </svg>
      ) : null}
    </div>
  )
}

function Tile({ label, children, note, art, seedKey }: { label: string; children: React.ReactNode; note?: React.ReactNode; art?: React.ReactNode; seedKey: string }) {
  return (
    <SketchBox className="tile tile-figure" seedKey={seedKey} radius={10}>
      <div className="tile-text">
        <div className="label">{label}</div>
        <div className="tile-value">{children}</div>
        {note ? <div className="tile-note">{note}</div> : null}
      </div>
      {art ? <div className="tile-art">{art}</div> : null}
    </SketchBox>
  )
}

/** The node tile's figure: a rack of slots. */
function RackArt() {
  const factor = usePenFactor()
  const seed = useSketchSeed("sum-art-nodes")
  return <SketchSvg seed={seed} revision={factor} render={(gen, w, h) => rack(gen, w, h, { factor, seed })} />
}

/** The busiest node's figure: a hand-drawn chip with color-mix core shading. */
function CpuArt({ cpu }: { cpu: number | null }) {
  const factor = usePenFactor()
  const seed = useSketchSeed("sum-art-busy")
  const frac = cpu === null ? null : Math.min(1, Math.max(0, cpu / 100))
  return (
    <SketchSvg
      seed={seed}
      revision={`${factor}|${frac}`}
      render={(gen, w, h) => chip(gen, w, h, { factor, seed, frac, color: cpu === null ? undefined : loadColor(cpu) })}
    />
  )
}

/** The day's throughput: pencil-shaded up & down flow arrows. */
function TransferArt() {
  const factor = usePenFactor()
  const seed = useSketchSeed("sum-art-day")
  return <SketchSvg seed={seed} revision={factor} render={(gen, w, h) => transfer(gen, w, h, { factor, seed })} />
}

/** The live rate: a pencil-shaded speedometer gauge. */
function SpeedArt() {
  const factor = usePenFactor()
  const seed = useSketchSeed("sum-art-speed")
  return <SketchSvg seed={seed} revision={factor} render={(gen, w, h) => speedGauge(gen, w, h, { factor, seed })} />
}

/** The four figures above the node list, scoped to the tab that is showing. */
export function Summary({ nodes, group }: { nodes: Node[]; group: string | null }) {
  const reporting = nodes.filter((n) => n.online && n.metrics)
  const busiest = reporting.reduce<Node | null>(
    (top, n) => (!top || (n.metrics?.cpu ?? 0) > (top.metrics?.cpu ?? 0) ? n : top),
    null,
  )
  const dayRx = nodes.reduce((sum, n) => sum + (n.day_rx || 0), 0)
  const dayTx = nodes.reduce((sum, n) => sum + (n.day_tx || 0), 0)
  // Keyed as the stream keys it: null for the whole fleet, "" for the ungrouped.
  const series = speedHistory.get(group) ?? []
  const last = series[series.length - 1] ?? { rx: 0, tx: 0 }
  const groups = new Set(nodes.map((n) => n.group ?? "").filter(Boolean)).size

  return (
    <div className="summary">
      <Tile
        label="节点"
        seedKey="sum-nodes"
        art={<RackArt />}
        note={`${groups} 个分组`}
      >
        {reporting.length}
        <span className="tile-of"> / {nodes.length}</span>
      </Tile>
      <Tile
        label="最忙节点"
        seedKey="sum-busy"
        art={<CpuArt cpu={busiest ? (busiest.metrics?.cpu ?? 0) : null} />}
        note={busiest ? busiest.name : "没有节点在线"}
      >
        {busiest ? `${(busiest.metrics?.cpu ?? 0).toFixed(0)}%` : "—"}
      </Tile>
      <Tile
        label="今日流量"
        seedKey="sum-day"
        art={<TransferArt />}
        note={
          <span className="io">
            <span className="io-item down">
              <Icon name="down" size={12} />
              {bytes(dayRx)}
            </span>
            <span className="io-item up">
              <Icon name="up" size={12} />
              {bytes(dayTx)}
            </span>
          </span>
        }
      >
        {bytes(dayRx + dayTx)}
      </Tile>
      <SketchBox className="tile tile-figure" seedKey="sum-speed" radius={10}>
        <div className="tile-text">
          <div className="label">实时网速</div>
          <div className="tile-value small">
            <span className="io-item down">
              <Icon name="down" size={13} />
              {rate(last.rx)}
            </span>
          </div>
          <div className="tile-note">
            <span className="io-item up">
              <Icon name="up" size={12} />
              {rate(last.tx)}
            </span>
          </div>
        </div>
        <div className="tile-art">
          <SpeedArt />
        </div>
        <Spark series={series} />
      </SketchBox>
    </div>
  )
}
